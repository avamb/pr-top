// File encryption at rest — chunked AES-256-GCM (audit H8 / M12).
//
// Session recordings, diary voice/video and report attachments are Class A
// data. They used to be stored as base64(AES-GCM(base64(file))) in a single
// GCM message: every Range request decrypted the whole file in memory
// (~178 MB of strings for a 100 MB recording) and uploads went through the
// same 3x in-memory path. This module replaces that with a binary, chunked
// format that can be written as a stream and decrypted for any byte range
// while touching only the chunks that cover it.
//
// ---------------------------------------------------------------------------
// On-disk format v1
// ---------------------------------------------------------------------------
//   header (46 + mimeLen bytes):
//     magic       8   89 50 52 54 46 0D 0A 1A   ("\x89PRTF\r\n\x1a")
//     version     1   0x01
//     keyVersion  4   uint32 BE — encryption key version (encryption_keys)
//     chunkSize   4   uint32 BE — plaintext bytes per chunk (default 64 KiB)
//     salt       16   random, per file (HKDF salt -> per-file key)
//     baseNonce  12   random, per file
//     mimeLen     1   length of the content type (<= 127)
//     mime        n   validated content type (ASCII), e.g. "audio/mpeg"
//   chunks: for i = 0..N-1
//     ciphertext (chunkSize bytes; the last chunk 0..chunkSize) || tag (16)
//
//   per-file key = HKDF-SHA256(ikm = version key, salt, info =
//                  "prtop/file-encryption/v1|kv=<keyVersion>")
//   chunk nonce  = baseNonce with its last 4 bytes XOR uint32 BE(i)
//   chunk AAD    = header bytes || uint32 BE(i) || uint8(isFinal)
//
// The header is authenticated by every chunk (AAD), so the stored content
// type and key version cannot be swapped. The final-chunk flag in the AAD
// detects truncation at a chunk boundary: the chunk that becomes "last"
// after truncation was sealed with isFinal = 0 and fails to authenticate.
// Readers check the final chunk on every open.
//
// The version key is encryption.deriveSubKey(keyVersion, 'file'): an HKDF
// purpose key of the key ring, independent of the Class A field key (and of
// the backup key). This module derives the per-file key from it with HKDF and
// the file's random salt, so every file has its own key and nonces never
// repeat across files. Only legacy files (below) use the field key.
//
// ---------------------------------------------------------------------------
// Legacy format (before wave 3)
// ---------------------------------------------------------------------------
//   "<keyVersion>:<ivB64>:<tagB64>:<base64(AES-GCM(base64(file)))>"
//   i.e. exactly encryption.encrypt(fileBuffer.toString('base64')).
// Legacy files are read with bounded memory (streaming base64 + GCM) and
// upgraded in place to v1 on first access: the new file is written next to
// the old one, decrypted again and compared (SHA-256 + length) with the
// legacy plaintext, and only then atomically renamed over it. A crash at any
// point leaves either the intact legacy file or the verified new file; a
// stale "<file>.rewrite.part" is removed by the next attempt.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { Readable, Transform, Writable, pipeline } = require('stream');
const { pipeline: pipelineAsync } = require('stream/promises');
const { logger } = require('../utils/logger');
const { sniffMedia, SNIFF_BYTES, mimeFromRef } = require('../utils/mediaSniff');

const MAGIC = Buffer.from([0x89, 0x50, 0x52, 0x54, 0x46, 0x0d, 0x0a, 0x1a]);
const FORMAT_VERSION = 1;
const DEFAULT_CHUNK_SIZE = 64 * 1024;
const MIN_CHUNK_SIZE = 1024;
const MAX_CHUNK_SIZE = 16 * 1024 * 1024;
const TAG_LEN = 16;
const SALT_LEN = 16;
const NONCE_LEN = 12;
const FIXED_HEADER_LEN = 8 + 1 + 4 + 4 + SALT_LEN + NONCE_LEN + 1; // 46
const MAX_MIME_LEN = 127;
const HKDF_INFO_PREFIX = 'prtop/file-encryption/v1|kv=';
const LEGACY_HEADER_MAX = 256;
const STREAM_HWM = 64 * 1024;

class FileCryptoError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'FileCryptoError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

// Key material comes from services/encryption.js (owned by the key-rotation
// work, which maps every key version to the master secret that serves it):
//   - v1 files:     deriveSubKey(version, 'file') — an HKDF purpose key that is
//                   independent of the Class A field key; this module then
//                   derives a per-file key from it with the file's salt.
//   - legacy files: encryption.deriveKey(version), the field key that
//                   encrypt() used, resolved through the key ring (current or
//                   previous secret). If an older encryption.js without that
//                   export is ever loaded, legacy files fall back to
//                   encryption.decrypt() in memory (pre-wave-3 behaviour);
//                   key material is never derived outside the key ring.
function encApi() {
  return require('./encryption');
}

let keyProviderOverride = null;

/** Purpose key for file encryption of a key version (32 bytes). */
function getFileVersionKey(keyVersion) {
  if (keyProviderOverride) return keyProviderOverride(keyVersion, 'file');
  const enc = encApi();
  if (typeof enc.deriveSubKey !== 'function') {
    throw new FileCryptoError('KEY_UNAVAILABLE', 'encryption.deriveSubKey(version, "file") is required for file encryption');
  }
  return enc.deriveSubKey(keyVersion, (enc.KEY_PURPOSE && enc.KEY_PURPOSE.FILE) || 'file');
}

/** Field key that encrypted a legacy file, or null if only decrypt() can open it. */
function getLegacyFieldKey(keyVersion) {
  if (keyProviderOverride) return keyProviderOverride(keyVersion, 'field');
  const enc = encApi();
  if (typeof enc.deriveKey === 'function') return enc.deriveKey(keyVersion);
  return null;
}

function getActiveKeyVersion() {
  return encApi().getActiveKeyVersion();
}

/** Same write guard as encrypt(): the version must be served by the current secret. */
function assertWritable(keyVersion) {
  if (keyProviderOverride) return;
  const enc = encApi();
  if (typeof enc.assertWritableKeyVersion === 'function') enc.assertWritableKeyVersion(keyVersion);
}

function getKeyId(keyVersion) {
  try {
    return encApi().getKeyId(keyVersion);
  } catch (_) {
    return null;
  }
}

function deriveFileKey(keyVersion, salt) {
  let ikm;
  try {
    ikm = getFileVersionKey(keyVersion);
  } catch (e) {
    if (e instanceof FileCryptoError) throw e;
    throw new FileCryptoError('KEY_UNAVAILABLE', `No key for file key version ${keyVersion}: ${e.message}`);
  }
  if (!Buffer.isBuffer(ikm) || ikm.length < 32) {
    throw new FileCryptoError('KEY_UNAVAILABLE', `No key material for key version ${keyVersion}`);
  }
  return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from(HKDF_INFO_PREFIX + keyVersion, 'utf8'), 32));
}

// ---------------------------------------------------------------------------
// Header + chunk primitives
// ---------------------------------------------------------------------------

function normalizeContentType(ct) {
  const s = String(ct || 'application/octet-stream').trim().toLowerCase();
  if (s.length > MAX_MIME_LEN || !/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(s)) {
    return 'application/octet-stream';
  }
  return s;
}

function buildHeader({ keyVersion, chunkSize, salt, baseNonce, contentType }) {
  const mime = Buffer.from(normalizeContentType(contentType), 'latin1');
  const h = Buffer.alloc(FIXED_HEADER_LEN + mime.length);
  MAGIC.copy(h, 0);
  h[8] = FORMAT_VERSION;
  h.writeUInt32BE(keyVersion, 9);
  h.writeUInt32BE(chunkSize, 13);
  salt.copy(h, 17);
  baseNonce.copy(h, 33);
  h[45] = mime.length;
  mime.copy(h, 46);
  return h;
}

function startsWithMagic(buf) {
  return buf.length >= MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC);
}

function parseHeader(buf) {
  if (!startsWithMagic(buf)) throw new FileCryptoError('CORRUPT', 'Not a PR-TOP encrypted file');
  if (buf.length < FIXED_HEADER_LEN) throw new FileCryptoError('CORRUPT', 'Truncated header');
  const version = buf[8];
  if (version !== FORMAT_VERSION) throw new FileCryptoError('CORRUPT', `Unsupported file format version ${version}`);
  const keyVersion = buf.readUInt32BE(9);
  const chunkSize = buf.readUInt32BE(13);
  if (keyVersion < 1) throw new FileCryptoError('CORRUPT', 'Invalid key version');
  if (chunkSize < MIN_CHUNK_SIZE || chunkSize > MAX_CHUNK_SIZE) throw new FileCryptoError('CORRUPT', 'Invalid chunk size');
  const mimeLen = buf[45];
  if (mimeLen > MAX_MIME_LEN || buf.length < FIXED_HEADER_LEN + mimeLen) throw new FileCryptoError('CORRUPT', 'Truncated header');
  const headerLen = FIXED_HEADER_LEN + mimeLen;
  return {
    formatVersion: version,
    keyVersion,
    chunkSize,
    salt: Buffer.from(buf.subarray(17, 33)),
    baseNonce: Buffer.from(buf.subarray(33, 45)),
    contentType: buf.toString('latin1', 46, headerLen),
    headerLen,
    headerBytes: Buffer.from(buf.subarray(0, headerLen)),
  };
}

function chunkNonce(baseNonce, index) {
  const n = Buffer.from(baseNonce);
  n.writeUInt32BE((n.readUInt32BE(8) ^ index) >>> 0, 8);
  return n;
}

function chunkAad(headerBytes, index, isFinal) {
  const tail = Buffer.alloc(5);
  tail.writeUInt32BE(index, 0);
  tail[4] = isFinal ? 1 : 0;
  return Buffer.concat([headerBytes, tail]);
}

function sealChunk(key, headerBytes, baseNonce, index, isFinal, plaintext) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, chunkNonce(baseNonce, index), { authTagLength: TAG_LEN });
  cipher.setAAD(chunkAad(headerBytes, index, isFinal));
  const ct = cipher.update(plaintext);
  const fin = cipher.final();
  return Buffer.concat([ct, fin, cipher.getAuthTag()]);
}

function openChunk(key, headerBytes, baseNonce, index, isFinal, sealed) {
  if (sealed.length < TAG_LEN) throw new FileCryptoError('CORRUPT', 'Chunk too short');
  const ct = sealed.subarray(0, sealed.length - TAG_LEN);
  const tag = sealed.subarray(sealed.length - TAG_LEN);
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, chunkNonce(baseNonce, index), { authTagLength: TAG_LEN });
    d.setAAD(chunkAad(headerBytes, index, isFinal));
    d.setAuthTag(tag);
    const pt = d.update(ct);
    const fin = d.final();
    return fin.length ? Buffer.concat([pt, fin]) : pt;
  } catch (e) {
    throw new FileCryptoError('DECRYPT_FAILED', `Chunk ${index} failed authentication (tampered, truncated or wrong key)`);
  }
}

/** Chunk layout for a v1 file of `fileSize` bytes. */
function computeGeometry(hdr, fileSize) {
  const body = fileSize - hdr.headerLen;
  const unit = hdr.chunkSize + TAG_LEN;
  if (body < TAG_LEN) throw new FileCryptoError('CORRUPT', 'File truncated (no final chunk)');
  const chunkCount = Math.ceil(body / unit);
  const lastSealed = body - (chunkCount - 1) * unit;
  const lastLen = lastSealed - TAG_LEN;
  if (lastLen < 0) throw new FileCryptoError('CORRUPT', 'File truncated (partial chunk)');
  return {
    chunkCount,
    lastLen,
    plaintextSize: (chunkCount - 1) * hdr.chunkSize + lastLen,
  };
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/**
 * Transform: plaintext in, v1 file bytes out. `contentType` may be a function
 * evaluated when the first byte arrives (lets a sniffer upstream decide).
 */
class EncryptStream extends Transform {
  constructor({ keyVersion, contentType, chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
    super({ highWaterMark: STREAM_HWM });
    if (!Number.isInteger(keyVersion) || keyVersion < 1) throw new FileCryptoError('KEY_UNAVAILABLE', 'keyVersion required');
    assertWritable(keyVersion);
    this.keyVersion = keyVersion;
    this.chunkSize = chunkSize;
    this._contentType = contentType;
    this.salt = crypto.randomBytes(SALT_LEN);
    this.baseNonce = crypto.randomBytes(NONCE_LEN);
    this.key = deriveFileKey(keyVersion, this.salt);
    this.header = null;
    this.contentType = null;
    this.index = 0;
    this.pending = [];
    this.pendingLen = 0;
    this.plaintextSize = 0;
  }

  _ensureHeader() {
    if (this.header) return;
    const ct = typeof this._contentType === 'function' ? this._contentType() : this._contentType;
    this.contentType = normalizeContentType(ct);
    this.header = buildHeader({
      keyVersion: this.keyVersion,
      chunkSize: this.chunkSize,
      salt: this.salt,
      baseNonce: this.baseNonce,
      contentType: this.contentType,
    });
    this.push(this.header);
  }

  _take(n) {
    if (n === 0) return Buffer.alloc(0);
    const first = this.pending[0];
    if (first.length >= n) {
      const out = first.subarray(0, n);
      if (first.length === n) this.pending.shift();
      else this.pending[0] = first.subarray(n);
      this.pendingLen -= n;
      return out;
    }
    const parts = [];
    let need = n;
    while (need > 0) {
      const b = this.pending[0];
      if (b.length <= need) {
        parts.push(b);
        this.pending.shift();
        need -= b.length;
      } else {
        parts.push(b.subarray(0, need));
        this.pending[0] = b.subarray(need);
        need = 0;
      }
    }
    this.pendingLen -= n;
    return Buffer.concat(parts, n);
  }

  _seal(plaintext, isFinal) {
    const out = sealChunk(this.key, this.header, this.baseNonce, this.index, isFinal, plaintext);
    this.index += 1;
    return out;
  }

  _transform(data, _enc, cb) {
    try {
      this._ensureHeader();
      if (data.length) {
        this.plaintextSize += data.length;
        this.pending.push(data);
        this.pendingLen += data.length;
      }
      // Strictly greater: the chunk in hand is known not to be the last one.
      while (this.pendingLen > this.chunkSize) {
        this.push(this._seal(this._take(this.chunkSize), false));
      }
      cb();
    } catch (e) {
      cb(e);
    }
  }

  _flush(cb) {
    try {
      this._ensureHeader();
      this.push(this._seal(this._take(this.pendingLen), true));
      cb();
    } catch (e) {
      cb(e);
    }
  }
}

/**
 * Transform that holds back the first SNIFF_BYTES, detects the media type by
 * magic bytes, then passes everything through unchanged.
 *   strict  -> unknown types fail with code UNSUPPORTED_MEDIA_TYPE
 *   lenient -> unknown types pass, `result` stays null
 * `accept(result)` may reject detected kinds (e.g. images on an audio route).
 */
class SniffStream extends Transform {
  constructor({ hints = [], strict = true, accept = null } = {}) {
    super({ highWaterMark: STREAM_HWM });
    this.hints = hints;
    this.strict = strict;
    this.accept = accept;
    this.head = [];
    this.headLen = 0;
    this.decided = false;
    this.result = null;
  }

  _decide() {
    this.decided = true;
    const head = Buffer.concat(this.head, this.headLen);
    this.head = null;
    const r = sniffMedia(head.subarray(0, SNIFF_BYTES), { hints: this.hints });
    if (r && (!this.accept || this.accept(r))) {
      this.result = r;
    } else if (this.strict) {
      throw new FileCryptoError('UNSUPPORTED_MEDIA_TYPE', 'File content is not a supported audio/video format');
    }
    return head;
  }

  _transform(data, _enc, cb) {
    try {
      if (this.decided) return cb(null, data);
      this.head.push(data);
      this.headLen += data.length;
      if (this.headLen >= SNIFF_BYTES) return cb(null, this._decide());
      cb();
    } catch (e) {
      cb(e);
    }
  }

  _flush(cb) {
    try {
      if (!this.decided) {
        const head = this._decide();
        if (head.length) this.push(head);
      }
      cb();
    } catch (e) {
      cb(e);
    }
  }
}

// Writable over an open FileHandle that leaves the handle open (so the caller
// can fsync and close it). fs.WriteStream with autoClose:false never emits
// 'close', which stalls stream.pipeline.
function fileHandleSink(fh) {
  return new Writable({
    highWaterMark: STREAM_HWM,
    write(chunk, _enc, cb) {
      writeAll(fh, chunk).then(() => cb(), cb);
    },
  });
}

async function writeAll(fh, buf) {
  let off = 0;
  while (off < buf.length) {
    const { bytesWritten } = await fh.write(buf, off, buf.length - off);
    off += bytesWritten;
  }
}

async function safeUnlink(p) {
  try { await fsp.unlink(p); } catch (_) { /* already gone */ }
}

/**
 * Encrypt a plaintext stream into `destPath` (written as "<dest>.part", fsynced,
 * then renamed; mode 0600). The .part is removed on any failure.
 *
 * @param {Readable} source
 * @param {string} destPath
 * @param {object} [opts]
 * @param {string|function} [opts.contentType]
 * @param {number} [opts.keyVersion] - defaults to the active key version
 * @param {Transform[]} [opts.transforms] - inserted between source and encryptor
 * @returns {Promise<{keyVersion:number, keyId:number|null, plaintextSize:number, contentType:string, path:string}>}
 */
async function encryptStreamToFile(source, destPath, opts = {}) {
  const keyVersion = opts.keyVersion || getActiveKeyVersion();
  const enc = new EncryptStream({ keyVersion, contentType: opts.contentType, chunkSize: opts.chunkSize });
  const tmp = destPath + '.part';
  const fh = await fsp.open(tmp, 'wx', 0o600);
  let closed = false;
  try {
    await pipelineAsync(source, ...(opts.transforms || []), enc, fileHandleSink(fh));
    await fh.sync();
    await fh.close();
    closed = true;
    await fsp.rename(tmp, destPath);
  } catch (e) {
    if (!closed) { try { await fh.close(); } catch (_) { /* ignore */ } }
    await safeUnlink(tmp);
    throw e;
  }
  return {
    keyVersion,
    keyId: getKeyId(keyVersion),
    plaintextSize: enc.plaintextSize,
    contentType: enc.contentType,
    path: destPath,
  };
}

/**
 * Synchronous variant for an in-memory buffer (bot uploads arrive as base64
 * JSON, so the bytes are already in memory). Same .part/rename semantics.
 */
function encryptBufferToFileSync(buffer, destPath, opts = {}) {
  const keyVersion = opts.keyVersion || getActiveKeyVersion();
  assertWritable(keyVersion);
  const chunkSize = opts.chunkSize || DEFAULT_CHUNK_SIZE;
  const salt = crypto.randomBytes(SALT_LEN);
  const baseNonce = crypto.randomBytes(NONCE_LEN);
  const key = deriveFileKey(keyVersion, salt);
  const contentType = normalizeContentType(opts.contentType);
  const header = buildHeader({ keyVersion, chunkSize, salt, baseNonce, contentType });
  const tmp = destPath + '.part';
  const fd = fs.openSync(tmp, 'wx', 0o600);
  let closed = false;
  try {
    fs.writeSync(fd, header);
    let offset = 0;
    let index = 0;
    do {
      const end = Math.min(offset + chunkSize, buffer.length);
      const isFinal = end >= buffer.length;
      fs.writeSync(fd, sealChunk(key, header, baseNonce, index, isFinal, buffer.subarray(offset, end)));
      offset = end;
      index += 1;
    } while (offset < buffer.length);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    closed = true;
    fs.renameSync(tmp, destPath);
  } catch (e) {
    if (!closed) { try { fs.closeSync(fd); } catch (_) { /* ignore */ } }
    try { fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
    throw e;
  }
  return { keyVersion, keyId: getKeyId(keyVersion), plaintextSize: buffer.length, contentType, path: destPath };
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

function parseLegacyHead(head) {
  const s = head.toString('latin1');
  const m = /^(\d{1,9}):([A-Za-z0-9+/=]{1,64}):([A-Za-z0-9+/=]{1,64}):/.exec(s);
  if (!m) return null;
  const iv = Buffer.from(m[2], 'base64');
  const tag = Buffer.from(m[3], 'base64');
  if (iv.length !== 12 || tag.length !== TAG_LEN) return null;
  return { keyVersion: parseInt(m[1], 10), iv, tag, dataOffset: m[0].length };
}

function describeHead(head, fileSize) {
  if (startsWithMagic(head)) {
    const hdr = parseHeader(head);
    const geo = computeGeometry(hdr, fileSize);
    return {
      format: 'v1',
      keyVersion: hdr.keyVersion,
      contentType: hdr.contentType,
      chunkSize: hdr.chunkSize,
      fileSize,
      plaintextSize: geo.plaintextSize,
      header: hdr,
      geometry: geo,
    };
  }
  const legacy = parseLegacyHead(head);
  if (legacy) {
    // base64(GCM(base64(x))): the file is ~16/9 of the plaintext.
    const est = Math.max(0, Math.floor(((fileSize - legacy.dataOffset) * 9) / 16));
    return {
      format: 'legacy',
      keyVersion: legacy.keyVersion,
      contentType: null,
      fileSize,
      plaintextSize: est,
      plaintextSizeEstimated: true,
      legacy,
    };
  }
  return { format: 'unknown', fileSize };
}

/**
 * Inspect an encrypted file without decrypting it.
 * @returns {Promise<{format:'v1'|'legacy'|'unknown', keyVersion?:number, contentType?:string|null,
 *   fileSize:number, plaintextSize?:number, plaintextSizeEstimated?:boolean}>}
 */
async function readFileInfo(filePath) {
  const fh = await fsp.open(filePath, 'r');
  try {
    const st = await fh.stat();
    const want = Math.min(st.size, Math.max(FIXED_HEADER_LEN + MAX_MIME_LEN, LEGACY_HEADER_MAX));
    const head = Buffer.alloc(want);
    const { bytesRead } = await fh.read(head, 0, want, 0);
    return describeHead(head.subarray(0, bytesRead), st.size);
  } finally {
    await fh.close();
  }
}

/** Public, trimmed version of readFileInfo (no key material in the result). */
async function getFileInfo(filePath) {
  const info = await readFileInfo(filePath);
  return {
    format: info.format,
    keyVersion: info.keyVersion != null ? info.keyVersion : null,
    contentType: info.contentType || null,
    fileSize: info.fileSize,
    plaintextSize: info.plaintextSize != null ? info.plaintextSize : null,
    plaintextSizeEstimated: !!info.plaintextSizeEstimated,
  };
}

// ---------------------------------------------------------------------------
// v1 decryption (range reads)
// ---------------------------------------------------------------------------

async function readFully(fh, len, position, into) {
  const buf = into ? into.subarray(0, len) : Buffer.alloc(len);
  let off = 0;
  while (off < len) {
    const { bytesRead } = await fh.read(buf, off, len - off, position + off);
    if (bytesRead === 0) throw new FileCryptoError('CORRUPT', 'Unexpected end of file');
    off += bytesRead;
  }
  return buf;
}

async function readChunk(ctx, index) {
  const { hdr, geo, fh, key } = ctx;
  const isFinal = index === geo.chunkCount - 1;
  const ptLen = isFinal ? geo.lastLen : hdr.chunkSize;
  const pos = hdr.headerLen + index * (hdr.chunkSize + TAG_LEN);
  // One reusable read buffer per open file (reads are sequential per stream);
  // only the decrypted output is a fresh allocation.
  if (!ctx.readBuf) ctx.readBuf = Buffer.allocUnsafe(hdr.chunkSize + TAG_LEN);
  const sealed = await readFully(fh, ptLen + TAG_LEN, pos, ctx.readBuf);
  return openChunk(key, hdr.headerBytes, hdr.baseNonce, index, isFinal, sealed);
}

/** Open a v1 file for reading; verifies the header and the final chunk. */
async function openV1(filePath) {
  const fh = await fsp.open(filePath, 'r');
  try {
    const st = await fh.stat();
    const want = Math.min(st.size, FIXED_HEADER_LEN + MAX_MIME_LEN);
    const head = Buffer.alloc(want);
    const { bytesRead } = await fh.read(head, 0, want, 0);
    const hdr = parseHeader(head.subarray(0, bytesRead));
    const geo = computeGeometry(hdr, st.size);
    const key = deriveFileKey(hdr.keyVersion, hdr.salt);
    const ctx = { fh, hdr, geo, key, size: geo.plaintextSize, closed: false };
    // Truncation / tamper check of the tail on every open (one chunk, cheap).
    await readChunk(ctx, geo.chunkCount - 1);
    return ctx;
  } catch (e) {
    await fh.close().catch(() => {});
    throw e;
  }
}

async function closeCtx(ctx) {
  if (ctx && !ctx.closed) {
    ctx.closed = true;
    await ctx.fh.close().catch(() => {});
  }
}

/** Readable of plaintext bytes [start, end] (inclusive) of an opened v1 file. */
class RangeDecryptStream extends Readable {
  constructor(ctx, start, end) {
    super({ highWaterMark: STREAM_HWM });
    this.ctx = ctx;
    this.start = start;
    this.end = end;
    const cs = ctx.hdr.chunkSize;
    this.idx = end >= start ? Math.floor(start / cs) : 1;
    this.lastIdx = end >= start ? Math.floor(end / cs) : 0;
  }

  _read() {
    if (this.idx > this.lastIdx) {
      this.push(null);
      return;
    }
    const i = this.idx;
    this.idx += 1;
    readChunk(this.ctx, i).then((pt) => {
      const chunkStart = i * this.ctx.hdr.chunkSize;
      const from = Math.max(this.start - chunkStart, 0);
      const to = Math.min(this.end - chunkStart + 1, pt.length);
      this.push(pt.subarray(from, to));
    }, (err) => this.destroy(err));
  }

  _destroy(err, cb) {
    closeCtx(this.ctx).then(() => cb(err), () => cb(err));
  }
}

// ---------------------------------------------------------------------------
// Legacy decryption (bounded memory)
// ---------------------------------------------------------------------------

/** Streaming base64 decoder (ignores whitespace). */
class Base64DecodeStream extends Transform {
  constructor() {
    super({ highWaterMark: STREAM_HWM });
    this.carry = '';
  }

  _transform(data, _enc, cb) {
    const s = this.carry + data.toString('latin1').replace(/\s+/g, '');
    const n = s.length - (s.length % 4);
    this.carry = s.slice(n);
    cb(null, n ? Buffer.from(s.slice(0, n), 'base64') : undefined);
  }

  _flush(cb) {
    if (this.carry) {
      const tail = this.carry.replace(/=+$/, '');
      if (tail.length % 4 === 1) return cb(new FileCryptoError('CORRUPT', 'Invalid base64 length'));
      this.push(Buffer.from(this.carry, 'base64'));
    }
    cb();
  }
}

/**
 * Plaintext stream of a legacy file. Authentication happens at the END (one
 * GCM message), so consumers that must not act on unauthenticated bytes
 * should only commit after the stream finished without error.
 */
function createLegacyPlaintextStream(filePath, legacy) {
  const key = getLegacyFieldKey(legacy.keyVersion);
  if (!key) return createLegacyInMemoryStream(filePath);

  const src = fs.createReadStream(filePath, { start: legacy.dataOffset, highWaterMark: STREAM_HWM });
  const outerB64 = new Base64DecodeStream();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, legacy.iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(legacy.tag);
  const out = new Base64DecodeStream();

  const fail = (err) => {
    if (out.destroyed) return;
    const wrapped = (err instanceof FileCryptoError) ? err
      : /authenticate|Unsupported state/i.test((err && err.message) || '')
        ? new FileCryptoError('DECRYPT_FAILED', 'Legacy file failed authentication')
        : err;
    out.destroy(wrapped);
  };
  src.on('error', fail);
  outerB64.on('error', fail);
  decipher.on('error', fail);
  out.on('close', () => {
    src.destroy();
    outerB64.destroy();
    decipher.destroy();
  });
  src.pipe(outerB64).pipe(decipher).pipe(out);
  return out;
}

// Last resort for legacy files whose field key only encryption.js can derive
// (key served by ENCRYPTION_MASTER_KEY_PREVIOUS while deriveKey is private):
// the pre-wave-3 in-memory decrypt, authenticated before anything is emitted.
function createLegacyInMemoryStream(filePath) {
  return Readable.from((async function* gen() {
    const packed = await fsp.readFile(filePath, 'utf8');
    let b64;
    try {
      b64 = encApi().decrypt(packed.trim());
    } catch (e) {
      if (e && e.code === 'KEY_VERSION_UNAVAILABLE') throw new FileCryptoError('KEY_UNAVAILABLE', e.message);
      throw new FileCryptoError('DECRYPT_FAILED', 'Legacy file failed authentication');
    }
    yield Buffer.from(b64, 'base64');
  })(), { objectMode: false });
}

// ---------------------------------------------------------------------------
// Rewrite (legacy upgrade / re-encryption to the active key version)
// ---------------------------------------------------------------------------

const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return run;
}

class HashTap extends Transform {
  constructor() {
    super({ highWaterMark: STREAM_HWM });
    this.hash = crypto.createHash('sha256');
    this.bytes = 0;
  }

  _transform(data, _enc, cb) {
    this.hash.update(data);
    this.bytes += data.length;
    cb(null, data);
  }
}

async function hashV1Plaintext(filePath) {
  const ctx = await openV1(filePath);
  const tap = new HashTap();
  const sink = new Writable({ write(_c, _e, cb) { cb(); } });
  await pipelineAsync(new RangeDecryptStream(ctx, 0, ctx.size - 1), tap, sink);
  return { digest: tap.hash.digest('hex'), bytes: tap.bytes, size: ctx.size };
}

/**
 * Re-encrypt `filePath` into the current v1 format and active key version if
 * it is legacy or on an older key version (or always, with force). The new
 * file is verified (plaintext SHA-256 + length) before it atomically replaces
 * the old one; on any error the old file is untouched. Idempotent and safe to
 * call concurrently (per-file lock).
 *
 * @returns {Promise<{changed:boolean, from:object, to?:object}>}
 */
async function reencryptFile(filePath, opts = {}) {
  const abs = path.resolve(filePath);
  if (/\.part$/i.test(abs)) {
    // In-flight upload / rewrite / temp: never a finished media file.
    throw new FileCryptoError('NOT_MEDIA_FILE', 'Refusing to re-encrypt a temporary .part file');
  }
  return withLock(abs, async () => {
    const before = await fsp.stat(abs); // ENOENT propagates (file deleted)
    const info = await readFileInfo(abs);
    if (info.format === 'unknown') throw new FileCryptoError('UNKNOWN_FORMAT', 'Unrecognised encrypted file format');
    const active = opts.keyVersion || getActiveKeyVersion();
    if (info.format === 'v1' && info.keyVersion === active && !opts.force) {
      return { changed: false, from: summarize(info) };
    }

    const tmp = abs + '.rewrite.part';
    await safeUnlink(tmp);
    const tap = new HashTap();
    let source;
    let sniffer = null;
    let contentType;
    if (info.format === 'legacy') {
      source = createLegacyPlaintextStream(abs, info.legacy);
      sniffer = new SniffStream({ hints: [abs.replace(/\.enc$/i, '')].concat(opts.hints || []), strict: false });
      const fallback = opts.contentTypeHint || mimeFromRef(path.basename(abs));
      contentType = () => (sniffer.result ? sniffer.result.mime : fallback);
    } else {
      const ctx = await openV1(abs);
      source = new RangeDecryptStream(ctx, 0, ctx.size - 1);
      contentType = info.contentType;
    }

    try {
      const transforms = sniffer ? [tap, sniffer] : [tap];
      await encryptStreamToFile(source, tmp, { keyVersion: active, contentType, transforms });
      const check = await hashV1Plaintext(tmp);
      const expected = tap.hash.digest('hex');
      if (check.digest !== expected || check.bytes !== tap.bytes) {
        throw new FileCryptoError('VERIFY_FAILED', 'Re-encrypted file does not match the original plaintext');
      }
      // The source must still be the file we read: if it was deleted (session
      // / entry removed meanwhile) or replaced, renaming would resurrect or
      // clobber it. Delete paths do not take this lock, so re-check here.
      let now = null;
      try { now = await fsp.stat(abs); } catch (_) { /* deleted */ }
      if (!now || now.size !== before.size || now.mtimeMs !== before.mtimeMs || (before.ino && now.ino !== before.ino)) {
        throw new FileCryptoError('SOURCE_CHANGED', 'File was deleted or replaced during re-encryption');
      }
      await fsp.rename(tmp, abs);
    } catch (e) {
      if (source && !source.destroyed) source.destroy();
      await safeUnlink(tmp);
      throw e;
    }
    const after = await readFileInfo(abs);
    logger.info(`[fileCrypto] Re-encrypted ${path.basename(abs)}: ${info.format}/kv${info.keyVersion} -> v1/kv${after.keyVersion}`);
    return { changed: true, from: summarize(info), to: summarize(after) };
  });
}

function summarize(info) {
  return {
    format: info.format,
    keyVersion: info.keyVersion != null ? info.keyVersion : null,
    contentType: info.contentType || null,
    plaintextSize: info.plaintextSize != null ? info.plaintextSize : null,
  };
}

/** Back-compat name: upgrade a legacy file in place (no-op for v1 files). */
async function upgradeLegacyFile(filePath, opts = {}) {
  const info = await readFileInfo(filePath);
  if (info.format !== 'legacy') return { changed: false, from: summarize(info) };
  return reencryptFile(filePath, opts);
}

// Errors that mean the data itself is bad (never fall back to legacy streaming).
function isIntegrityError(e) {
  return !!e && ['DECRYPT_FAILED', 'CORRUPT', 'VERIFY_FAILED', 'KEY_UNAVAILABLE', 'KEY_VERSION_UNAVAILABLE'].includes(e.code);
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/**
 * Open an encrypted file for reading. Legacy files are upgraded to v1 first
 * (lazy migration); if the upgrade fails for an environmental reason (disk
 * full, read-only volume) the legacy file is served by a sequential
 * bounded-memory stream instead (no ranges, size unknown).
 *
 * @returns {Promise<{format:'v1'|'legacy', size:number|null, contentType:string,
 *   keyVersion:number, rangeable:boolean, stream:(start?:number,end?:number)=>Readable, close:()=>Promise<void>}>}
 */
async function openForRead(filePath, opts = {}) {
  let info = await readFileInfo(filePath);
  if (info.format === 'legacy' && opts.upgradeLegacy !== false) {
    try {
      await reencryptFile(filePath, { ...opts, force: false, keyVersion: undefined });
      info = await readFileInfo(filePath);
    } catch (e) {
      if (isIntegrityError(e)) throw e;
      logger.warn(`[fileCrypto] Legacy upgrade of ${path.basename(filePath)} failed (${e.code || e.message}); serving legacy stream`);
    }
  }

  if (info.format === 'legacy') {
    let used = false;
    return {
      format: 'legacy',
      size: null,
      contentType: opts.contentTypeHint || mimeFromRef(filePath),
      keyVersion: info.keyVersion,
      rangeable: false,
      stream() {
        if (used) throw new Error('stream() already called');
        used = true;
        return createLegacyPlaintextStream(filePath, info.legacy);
      },
      async close() {},
    };
  }
  if (info.format !== 'v1') throw new FileCryptoError('CORRUPT', 'Unrecognised encrypted file format');

  const ctx = await openV1(filePath);
  let used = false;
  return {
    format: 'v1',
    size: ctx.size,
    contentType: ctx.hdr.contentType,
    keyVersion: ctx.hdr.keyVersion,
    rangeable: true,
    stream(start = 0, end = ctx.size - 1) {
      if (used) throw new Error('stream() already called');
      used = true;
      return new RangeDecryptStream(ctx, start, end);
    },
    async close() {
      if (!used) await closeCtx(ctx);
    },
  };
}

const MIME_EXT = {
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'video/webm': '.webm',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'video/ogg': '.ogv',
  'audio/amr': '.amr',
  'audio/3gpp': '.3gp',
  'video/3gpp': '.3gp',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function extForMime(mime) {
  return MIME_EXT[String(mime || '').toLowerCase()] || '.bin';
}

/** Private temp dir for decrypted working copies (created 0700). */
// Private dir for decrypted working copies. Only this process writes it, so
// it is purged completely at startup. MEDIA_TMP_DIR overrides it (tests that
// run in parallel processes need separate dirs).
const DEFAULT_TMP_DIR = process.env.MEDIA_TMP_DIR
  ? path.resolve(process.env.MEDIA_TMP_DIR)
  : path.resolve(__dirname, '../../data/tmp');

/**
 * Decrypt to a private temp file (mode 0600) — for consumers that need the
 * whole file (transcription upload). Always call cleanup() in a finally.
 *
 * @returns {Promise<{path:string, size:number, contentType:string, ext:string, cleanup:()=>Promise<void>}>}
 */
async function decryptToTempFile(filePath, opts = {}) {
  const tmpDir = opts.tmpDir || DEFAULT_TMP_DIR;
  await fsp.mkdir(tmpDir, { recursive: true, mode: 0o700 });
  const reader = await openForRead(filePath, opts);
  const ext = extForMime(reader.contentType);
  const tmp = path.join(tmpDir, `dec-${crypto.randomUUID()}${ext}`);
  const cleanup = () => safeUnlink(tmp);
  try {
    const fh = await fsp.open(tmp, 'wx', 0o600);
    try {
      await pipelineAsync(reader.stream(), fileHandleSink(fh));
    } finally {
      await fh.close().catch(() => {});
    }
    const st = await fsp.stat(tmp);
    return { path: tmp, size: st.size, contentType: reader.contentType, ext, cleanup };
  } catch (e) {
    await reader.close();
    await cleanup();
    throw e;
  }
}

/** Decrypt a small file fully into memory (photos); refuses above maxBytes. */
async function readFileToBuffer(filePath, opts = {}) {
  const maxBytes = opts.maxBytes || 25 * 1024 * 1024;
  const reader = await openForRead(filePath, opts);
  if (reader.size != null && reader.size > maxBytes) {
    await reader.close();
    throw new FileCryptoError('TOO_LARGE', 'File too large to load into memory');
  }
  const parts = [];
  let total = 0;
  for await (const c of reader.stream()) {
    total += c.length;
    if (total > maxBytes) throw new FileCryptoError('TOO_LARGE', 'File too large to load into memory');
    parts.push(c);
  }
  return { buffer: Buffer.concat(parts, total), contentType: reader.contentType };
}

// ---------------------------------------------------------------------------
// HTTP serving
// ---------------------------------------------------------------------------

/**
 * Parse a single "bytes=" range. Returns null (serve the full body),
 * 'unsatisfiable', or {start, end}. Multi-range and malformed headers are
 * ignored (RFC 9110 allows serving 200 instead).
 */
function parseRange(header, size) {
  if (!header || typeof header !== 'string') return null;
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!m) return null;
  const [, s, e] = m;
  if (s === '' && e === '') return null;
  if (s === '') {
    const n = parseInt(e, 10);
    if (n === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(size - n, 0), end: size - 1 };
  }
  const start = parseInt(s, 10);
  if (start >= size) return 'unsatisfiable';
  const end = e === '' ? size - 1 : Math.min(parseInt(e, 10), size - 1);
  if (end < start) return null;
  return { start, end };
}

/**
 * Serve a decrypted file over HTTP with bounded memory: 206 for a single
 * Range, 416 when unsatisfiable, Accept-Ranges, private/no-store caching and
 * the stored (validated) content type. The caller does all authorization
 * BEFORE calling this.
 *
 * @param {object} opts
 * @param {string} [opts.contentTypeHint] - for legacy files the header can't name
 * @param {function} [opts.onServe] - called once headers are decided, with {start, ranged}
 * @param {string} [opts.notFoundMessage]
 */
async function serveEncryptedFile(req, res, filePath, opts = {}) {
  let reader;
  try {
    reader = await openForRead(filePath, { contentTypeHint: opts.contentTypeHint });
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return res.status(404).json({ error: opts.notFoundMessage || 'File not found on disk' });
    }
    logger.error(`[fileCrypto] Cannot open ${path.basename(filePath)}: ${e.code || ''} ${e.message}`);
    return res.status(500).json({ error: opts.decryptErrorMessage || 'Failed to decrypt file' });
  }

  const headers = {
    'Content-Type': reader.contentType || 'application/octet-stream',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
    // nginx buffers proxied responses and may spill them to proxy_temp on
    // disk; decrypted Class A media must never land there.
    'X-Accel-Buffering': 'no',
  };

  let start = 0;
  let end = null;
  let ranged = false;
  if (reader.rangeable) {
    const size = reader.size;
    const range = parseRange(req.headers.range, size);
    if (range === 'unsatisfiable') {
      await reader.close();
      res.status(416).set({ ...headers, 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' });
      return res.end();
    }
    headers['Accept-Ranges'] = 'bytes';
    if (range) {
      ({ start, end } = range);
      ranged = true;
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      headers['Content-Length'] = String(end - start + 1);
      res.status(206);
    } else {
      end = size - 1;
      headers['Content-Length'] = String(size);
      res.status(200);
    }
  } else {
    headers['Accept-Ranges'] = 'none';
    res.status(200);
  }

  if (typeof opts.onServe === 'function') {
    try { opts.onServe({ start, ranged }); } catch (e) { logger.warn('[fileCrypto] onServe hook failed: ' + e.message); }
  }

  res.set(headers);
  if (req.method === 'HEAD') {
    await reader.close();
    return res.end();
  }

  const body = reader.rangeable ? reader.stream(start, end) : reader.stream();
  await new Promise((resolve) => {
    pipeline(body, res, (err) => {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        logger.error(`[fileCrypto] Streaming ${path.basename(filePath)} failed: ${err.code || ''} ${err.message}`);
      }
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

/**
 * Remove leftovers of interrupted writes (*.part, *.rewrite.part) and stale
 * decrypted temp files older than maxAgeMs. Never touches finished files.
 */
async function sweepStaleFiles(dir, maxAgeMs = 60 * 60 * 1000) {
  let removed = 0;
  let names;
  try {
    names = await fsp.readdir(dir);
  } catch (_) {
    return 0;
  }
  const now = Date.now();
  for (const name of names) {
    // *.part: interrupted encrypt (upload, bot media, .rewrite.part);
    // *.upload.enc: upload staged but never renamed to its final name;
    // dec-* / split-*: decrypted working copies (plaintext!).
    const isPart = name.endsWith('.part') || name.endsWith('.upload.enc');
    const isDecTemp = /^(dec|split)-[0-9a-f-]{36}/.test(name);
    if (!isPart && !isDecTemp) continue;
    const p = path.join(dir, name);
    try {
      const st = await fsp.stat(p);
      if (st.isFile() && now - st.mtimeMs > maxAgeMs) {
        await fsp.unlink(p);
        removed += 1;
      }
    } catch (_) { /* raced with another cleanup */ }
  }
  if (removed) logger.info(`[fileCrypto] Removed ${removed} stale temp file(s) from ${dir}`);
  return removed;
}

let housekeepingTimer = null;

/**
 * Start temp-file housekeeping once per process (later calls are no-ops):
 *  - now: delete EVERY dec-* / split-* plaintext copy in the tmp dir (left by
 *    a crash or restart; nothing else uses the dir) and *.part leftovers
 *    older than 1 h in the media dirs;
 *  - every 15 min (unref'd): delete tmp copies and media-dir *.part older
 *    than 2 h (no transcription or upload legitimately runs that long).
 */
function startHousekeeping(mediaDirs = [], { intervalMs = 15 * 60 * 1000, maxAgeMs = 2 * 60 * 60 * 1000 } = {}) {
  if (housekeepingTimer) return housekeepingTimer;
  const dirs = [...new Set(mediaDirs.map((d) => path.resolve(d)))];
  const run = (startup) => {
    sweepStaleFiles(DEFAULT_TMP_DIR, startup ? -1 : maxAgeMs).catch(() => {});
    for (const d of dirs) sweepStaleFiles(d, startup ? 60 * 60 * 1000 : maxAgeMs).catch(() => {});
  };
  setImmediate(() => run(true));
  housekeepingTimer = setInterval(() => run(false), intervalMs);
  if (typeof housekeepingTimer.unref === 'function') housekeepingTimer.unref();
  return housekeepingTimer;
}

module.exports = {
  FORMAT_VERSION,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TMP_DIR,
  MAGIC,
  FileCryptoError,
  EncryptStream,
  SniffStream,
  encryptStreamToFile,
  encryptBufferToFileSync,
  readFileInfo: getFileInfo,
  openForRead,
  reencryptFile,
  upgradeLegacyFile,
  decryptToTempFile,
  readFileToBuffer,
  serveEncryptedFile,
  parseRange,
  sweepStaleFiles,
  startHousekeeping,
  extForMime,
  isIntegrityError,
  // test hooks
  _setKeyProviderForTests(fn) { keyProviderOverride = fn; },
  _internal: { parseHeader, computeGeometry, deriveFileKey, createLegacyPlaintextStream, readFileInfo },
};
