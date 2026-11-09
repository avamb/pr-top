// Media type detection by magic bytes (audit M12).
//
// Upload routes used to trust the client-supplied MIME type / file extension.
// The stored file is later served back with a Content-Type, so the type must
// come from the bytes themselves. This module looks at the first few KB of a
// file and recognises the audio/video containers PR-TOP accepts:
//
//   mp3 (ID3 tag or MPEG audio frame sync), AAC (ADTS), MP4 family
//   (ftyp box: mp4 / m4a / mov / 3gp), Ogg (Ogg/Opus/Vorbis), WebM / Matroska
//   (EBML), WAV (RIFF/WAVE), FLAC, AMR
//
// and, for report photo attachments, JPEG / PNG / WebP / GIF.
//
// Containers like MP4 and WebM carry audio-only and video recordings with
// identical magic bytes. For those the caller's hint (original extension,
// client MIME, Telegram entry type) only chooses between the audio and the
// video flavour of the SAME container; it can never turn an unrecognised file
// into an accepted one.

const SNIFF_BYTES = 4096;

// MPEG audio frame header sanity check (sync, version, layer, bitrate, rate).
function isMpegAudioFrame(b, i) {
  if (i + 4 > b.length) return false;
  if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return false;
  const version = (b[i + 1] >> 3) & 0x03; // 1 = reserved
  const layer = (b[i + 1] >> 1) & 0x03;   // 0 = reserved (ADTS uses 0)
  const bitrateIdx = (b[i + 2] >> 4) & 0x0f;
  const rateIdx = (b[i + 2] >> 2) & 0x03;
  return version !== 1 && layer !== 0 && bitrateIdx !== 0x0f && bitrateIdx !== 0 && rateIdx !== 3;
}

// ADTS (raw AAC) header: 12-bit sync, layer bits must be 00.
function isAdtsFrame(b, i) {
  if (i + 7 > b.length) return false;
  if (b[i] !== 0xff || (b[i + 1] & 0xf6) !== 0xf0) return false;
  const rateIdx = (b[i + 2] >> 2) & 0x0f;
  return rateIdx < 13;
}

function ascii(b, start, len) {
  if (start + len > b.length) return '';
  return b.toString('latin1', start, start + len);
}

function hintSaysVideo(hint) {
  if (!hint) return false;
  const h = String(hint).toLowerCase();
  return h === 'video' || h.startsWith('video/') || /\.(mp4|mov|m4v|mkv)$/.test(h);
}

function hintSaysAudio(hint) {
  if (!hint) return false;
  const h = String(hint).toLowerCase();
  return h === 'audio' || h === 'voice' || h.startsWith('audio/') || /\.(m4a|m4b|aac|mp3|ogg|oga|opus|wav|flac|weba)$/.test(h);
}

/**
 * Detect the media type of a buffer holding the start of a file.
 *
 * @param {Buffer} head - first bytes of the file (SNIFF_BYTES is plenty)
 * @param {object} [opts]
 * @param {string[]} [opts.hints] - original filename / client MIME / entry type;
 *   only used to pick audio vs video inside an ambiguous container
 * @returns {{mime:string, ext:string, kind:'audio'|'video'|'image'}|null}
 */
function sniffMedia(head, opts = {}) {
  if (!head || head.length < 4) return null;
  const b = head;
  const hints = (opts.hints || []).filter(Boolean);
  const wantsVideo = hints.some(hintSaysVideo);
  const wantsAudio = hints.some(hintSaysAudio);

  // --- images (report photo attachments) ---
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg', kind: 'image' };
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a) {
    return { mime: 'image/png', ext: '.png', kind: 'image' };
  }
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return { mime: 'image/gif', ext: '.gif', kind: 'image' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return { mime: 'image/webp', ext: '.webp', kind: 'image' };

  // --- audio / video ---
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return { mime: 'audio/wav', ext: '.wav', kind: 'audio' };
  if (ascii(b, 0, 4) === 'fLaC') return { mime: 'audio/flac', ext: '.flac', kind: 'audio' };
  if (ascii(b, 0, 4) === 'OggS') {
    // Theora in the first page = Ogg video; Opus / Vorbis = audio.
    const firstPage = ascii(b, 0, Math.min(b.length, 128));
    if (firstPage.includes('theora')) return { mime: 'video/ogg', ext: '.ogv', kind: 'video' };
    return { mime: 'audio/ogg', ext: '.ogg', kind: 'audio' };
  }
  if (ascii(b, 0, 5) === '#!AMR') return { mime: 'audio/amr', ext: '.amr', kind: 'audio' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    // EBML: the DocType element says webm or matroska.
    const top = ascii(b, 0, Math.min(b.length, 64));
    if (top.includes('webm')) {
      return wantsVideo && !wantsAudio
        ? { mime: 'video/webm', ext: '.webm', kind: 'video' }
        : { mime: 'audio/webm', ext: '.webm', kind: 'audio' };
    }
    if (top.includes('matroska')) return { mime: 'video/x-matroska', ext: '.mkv', kind: 'video' };
    return null;
  }
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (/^M4[ABP] $/.test(brand) || brand === 'F4A ') return { mime: 'audio/mp4', ext: '.m4a', kind: 'audio' };
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: '.mov', kind: 'video' };
    if (brand.startsWith('3gp') || brand.startsWith('3g2')) {
      return wantsAudio && !wantsVideo
        ? { mime: 'audio/3gpp', ext: '.3gp', kind: 'audio' }
        : { mime: 'video/3gpp', ext: '.3gp', kind: 'video' };
    }
    // Generic ISO brands (isom, mp41, mp42, dash, avc1, ...): Android voice
    // recorders write audio-only m4a files with these too.
    return wantsAudio && !wantsVideo
      ? { mime: 'audio/mp4', ext: '.m4a', kind: 'audio' }
      : { mime: 'video/mp4', ext: '.mp4', kind: 'video' };
  }
  if (ascii(b, 0, 3) === 'ID3') return { mime: 'audio/mpeg', ext: '.mp3', kind: 'audio' };
  if (isAdtsFrame(b, 0)) return { mime: 'audio/aac', ext: '.aac', kind: 'audio' };
  if (isMpegAudioFrame(b, 0)) return { mime: 'audio/mpeg', ext: '.mp3', kind: 'audio' };
  return null;
}

// Extension -> MIME for files written before content sniffing existed
// (legacy files whose head cannot be classified).
const LEGACY_EXT_MIME = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** MIME for an on-disk ref like 'abc.m4a.enc' (extension before '.enc'). */
function mimeFromRef(ref) {
  if (!ref) return 'application/octet-stream';
  const base = String(ref).replace(/\.enc$/i, '');
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot).toLowerCase() : '';
  return LEGACY_EXT_MIME[ext] || 'application/octet-stream';
}

module.exports = {
  SNIFF_BYTES,
  sniffMedia,
  mimeFromRef,
  isMpegAudioFrame,
  LEGACY_EXT_MIME,
};
