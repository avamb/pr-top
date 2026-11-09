// Fitting long recordings into the transcription API limit (audit M20).
//
// The OpenAI transcription endpoint accepts at most 25 MB per request.
// prepareTranscriptionPieces() turns a decrypted recording into pieces under
// the limit, in this order:
//   1. small enough       -> the file itself;
//   2. MP3 / WAV          -> cut losslessly (below), no re-encoding;
//   3. anything else, or a cut that fails -> ffmpeg converts it to a speech
//      MP3 (mono 16 kHz 32 kbit/s, services/ffmpeg.js), which is cut again
//      if it is still over the limit;
//   4. no ffmpeg / ffmpeg fails -> null: the caller reports "too long".
//
// Lossless cuts (formats that can be cut WITHOUT a demuxer):
//
//   - MP3: a stream of self-contained frames. We cut at a frame boundary that
//     is confirmed by two following frame headers (no false sync on data
//     bytes). Every piece decodes on its own.
//   - WAV (RIFF/PCM and other fixed-block formats): the sample data is cut at
//     a multiple of blockAlign and every piece gets its own RIFF header with
//     the original 'fmt ' chunk.
//
// Everything else (MP4/M4A/MOV, Ogg/Opus, WebM, FLAC, AAC, ...) needs a demuxer
// to cut safely; for those splitForTranscription() returns null.
//
// Pieces (and the transcoded MP3) are written to the private temp dir with mode 0600; the caller
// deletes them (and the decrypted source) in a finally block.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { isMpegAudioFrame } = require('../utils/mediaSniff');

const SEARCH_WINDOW = 512 * 1024;

const MP3_BITRATES = {
  // [versionKey][layer] -> kbps table indexed by bitrate index
  v1: {
    1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  },
  v2: {
    1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  },
};
const MP3_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Length in bytes of the MPEG audio frame starting at b[i], or 0. */
function mp3FrameLength(b, i) {
  if (!isMpegAudioFrame(b, i)) return 0;
  const version = (b[i + 1] >> 3) & 0x03;       // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const layerBits = (b[i + 1] >> 1) & 0x03;     // 3 = Layer I, 2 = II, 1 = III
  const layer = 4 - layerBits;                  // 1, 2 or 3
  const bitrateIdx = (b[i + 2] >> 4) & 0x0f;
  const rateIdx = (b[i + 2] >> 2) & 0x03;
  const padding = (b[i + 2] >> 1) & 0x01;
  const table = version === 3 ? MP3_BITRATES.v1 : MP3_BITRATES.v2;
  const bitrate = table[layer][bitrateIdx] * 1000;
  const rate = MP3_RATES[version][rateIdx];
  if (!bitrate || !rate) return 0;
  if (layer === 1) return (Math.floor((12 * bitrate) / rate) + padding) * 4;
  if (layer === 3 && version !== 3) return Math.floor((72 * bitrate) / rate) + padding;
  return Math.floor((144 * bitrate) / rate) + padding;
}

async function readAt(fh, position, length) {
  const buf = Buffer.alloc(length);
  const { bytesRead } = await fh.read(buf, 0, length, position);
  return buf.subarray(0, bytesRead);
}

/** First offset >= from where three consecutive valid frames start, or null. */
async function findMp3Boundary(fh, from, size) {
  if (from >= size) return null;
  const buf = await readAt(fh, from, Math.min(SEARCH_WINDOW, size - from));
  for (let i = 0; i + 4 <= buf.length; i++) {
    const l1 = mp3FrameLength(buf, i);
    if (!l1) continue;
    const l2 = mp3FrameLength(buf, i + l1);
    if (!l2) continue;
    if (!mp3FrameLength(buf, i + l1 + l2)) continue;
    return from + i;
  }
  return null;
}

function tmpName(tmpDir, ext) {
  return path.join(tmpDir, `split-${crypto.randomUUID()}${ext}`);
}

async function copyRange(src, dest, start, endExclusive, prefix) {
  async function* body() {
    if (prefix) yield prefix;
    if (endExclusive > start) yield* fs.createReadStream(src, { start, end: endExclusive - 1 });
  }
  try {
    await pipeline(Readable.from(body()), fs.createWriteStream(dest, { flags: 'wx', mode: 0o600 }));
  } catch (e) {
    try { await fsp.unlink(dest); } catch (_) { /* not created */ }
    throw e;
  }
  const st = await fsp.stat(dest);
  return { path: dest, size: st.size };
}

async function splitMp3(filePath, size, targetBytes, tmpDir) {
  const fh = await fsp.open(filePath, 'r');
  const cuts = [0];
  try {
    while (size - cuts[cuts.length - 1] > targetBytes) {
      const from = cuts[cuts.length - 1] + targetBytes;
      const cut = await findMp3Boundary(fh, from, size);
      if (cut === null) {
        // Near the end there may be too few frames left to confirm a
        // boundary: keep the short remainder in the last piece (it is at
        // most targetBytes + SEARCH_WINDOW; callers re-check piece sizes).
        if (size - from <= SEARCH_WINDOW) break;
        // No frame sync near the cut point: not a plain MP3 stream.
        return null;
      }
      cuts.push(cut);
    }
  } finally {
    await fh.close();
  }
  cuts.push(size);
  const pieces = [];
  try {
    for (let i = 0; i < cuts.length - 1; i++) {
      pieces.push(await copyRange(filePath, tmpName(tmpDir, '.mp3'), cuts[i], cuts[i + 1]));
    }
  } catch (e) {
    await removePieces(pieces);
    throw e;
  }
  return pieces;
}

function wavHeader(fmtBytes, dataLen) {
  const fmtPad = fmtBytes.length % 2;
  const h = Buffer.alloc(12 + 8 + fmtBytes.length + fmtPad + 8);
  h.write('RIFF', 0, 'latin1');
  h.writeUInt32LE(4 + 8 + fmtBytes.length + fmtPad + 8 + dataLen + (dataLen % 2), 4);
  h.write('WAVE', 8, 'latin1');
  h.write('fmt ', 12, 'latin1');
  h.writeUInt32LE(fmtBytes.length, 16);
  fmtBytes.copy(h, 20);
  const d = 20 + fmtBytes.length + fmtPad;
  h.write('data', d, 'latin1');
  h.writeUInt32LE(dataLen, d + 4);
  return h;
}

async function splitWav(filePath, size, targetBytes, tmpDir) {
  const fh = await fsp.open(filePath, 'r');
  let fmtBytes = null;
  let dataOffset = null;
  let dataLen = null;
  try {
    const riff = await readAt(fh, 0, 12);
    if (riff.length < 12 || riff.toString('latin1', 0, 4) !== 'RIFF' || riff.toString('latin1', 8, 12) !== 'WAVE') return null;
    let pos = 12;
    while (pos + 8 <= size && dataOffset === null) {
      const ch = await readAt(fh, pos, 8);
      if (ch.length < 8) break;
      const id = ch.toString('latin1', 0, 4);
      const len = ch.readUInt32LE(4);
      if (id === 'fmt ') {
        if (len < 16 || len > 4096) return null;
        fmtBytes = await readAt(fh, pos + 8, len);
      } else if (id === 'data') {
        dataOffset = pos + 8;
        const remaining = size - dataOffset;
        dataLen = (len === 0 || len === 0xffffffff || len > remaining) ? remaining : len;
      }
      pos += 8 + len + (len % 2);
    }
  } finally {
    await fh.close();
  }
  if (!fmtBytes || dataOffset === null) return null;
  const blockAlign = fmtBytes.readUInt16LE(12);
  if (!blockAlign) return null;
  const headerLen = wavHeader(fmtBytes, 0).length;
  const perPiece = Math.floor((targetBytes - headerLen) / blockAlign) * blockAlign;
  if (perPiece <= 0) return null;

  const pieces = [];
  try {
    for (let off = 0; off < dataLen; off += perPiece) {
      const len = Math.min(perPiece, dataLen - off);
      pieces.push(await copyRange(filePath, tmpName(tmpDir, '.wav'), dataOffset + off, dataOffset + off + len, wavHeader(fmtBytes, len)));
    }
  } catch (e) {
    await removePieces(pieces);
    throw e;
  }
  return pieces;
}

async function removePieces(pieces) {
  for (const p of pieces || []) {
    try { await fsp.unlink(p.path); } catch (_) { /* gone */ }
  }
}

/**
 * Split a decrypted recording into pieces of at most ~targetBytes.
 * @returns {Promise<Array<{path:string,size:number}>|null>} null = format cannot be split safely
 */
async function splitForTranscription(filePath, { mime, size, targetBytes, tmpDir }) {
  await fsp.mkdir(tmpDir, { recursive: true, mode: 0o700 });
  if (mime === 'audio/mpeg') return splitMp3(filePath, size, targetBytes, tmpDir);
  if (mime === 'audio/wav') return splitWav(filePath, size, targetBytes, tmpDir);
  return null;
}

/**
 * Turn a decrypted recording into pieces the transcription API accepts.
 *
 * @param {{path:string, size:number, contentType:string, ext:string}} plain
 * @param {{maxBytes:number, targetBytes:number}} limits
 * @returns {Promise<{pieces:Array<{path,size,mime,ext}>|null, method:string, reason?:string,
 *   cleanup:()=>Promise<void>}>} pieces null = cannot be transcribed (reason says why).
 *   cleanup() deletes every file this function created (never `plain` itself).
 */
async function prepareTranscriptionPieces(plain, { maxBytes, targetBytes }) {
  const created = [];
  const cleanup = () => removePieces(created.splice(0));
  const tmpDir = path.dirname(plain.path);
  const ok = (pieces) => pieces && pieces.length > 0 && pieces.every((p) => p.size <= maxBytes);

  if (plain.size <= maxBytes) {
    return { pieces: [{ path: plain.path, size: plain.size, mime: plain.contentType, ext: plain.ext }], method: 'direct', cleanup };
  }

  // 2. lossless cut (MP3 / WAV)
  try {
    const pieces = await splitForTranscription(plain.path, { mime: plain.contentType, size: plain.size, targetBytes, tmpDir });
    if (ok(pieces)) {
      created.push(...pieces);
      return { pieces: pieces.map((p) => ({ ...p, mime: plain.contentType, ext: plain.ext })), method: 'split', cleanup };
    }
    await removePieces(pieces);
  } catch (e) {
    await cleanup();
    throw e;
  }

  // 3. transcode with ffmpeg
  const ffmpeg = require('./ffmpeg');
  if (!(await ffmpeg.isAvailable())) {
    return { pieces: null, method: 'none', reason: 'ffmpeg is not available', cleanup };
  }
  let mp3;
  try {
    mp3 = await ffmpeg.transcodeToSpeechMp3(plain.path, { tmpDir });
  } catch (e) {
    if (e instanceof ffmpeg.FfmpegError) {
      return { pieces: null, method: 'none', reason: e.message, cleanup };
    }
    throw e;
  }
  created.push(mp3);
  if (mp3.size <= maxBytes) {
    return { pieces: [mp3], method: 'transcode', cleanup };
  }
  try {
    const pieces = await splitForTranscription(mp3.path, { mime: 'audio/mpeg', size: mp3.size, targetBytes, tmpDir });
    if (!ok(pieces)) {
      await removePieces(pieces);
      await cleanup();
      return { pieces: null, method: 'none', reason: 'transcoded MP3 could not be split', cleanup };
    }
    created.push(...pieces);
    // The full MP3 is no longer needed; free the disk space now.
    await removePieces([mp3]);
    return { pieces: pieces.map((p) => ({ ...p, mime: 'audio/mpeg', ext: '.mp3' })), method: 'transcode+split', cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}

module.exports = {
  splitForTranscription,
  prepareTranscriptionPieces,
  removePieces,
  mp3FrameLength,
  _internal: { splitMp3, splitWav, wavHeader, findMp3Boundary },
};
