'use strict';
// Track M (wave 3) — upload -> encrypted storage -> stream, through the real
// routers mounted on a throwaway express app. Covers M12 (streaming
// encryption + magic-byte validation), H8 (Range streaming, signed media
// URLs), M20 (Whisper limit: split / too-long status, stubbed API), M24
// (bot media limits + error codes) and the legacy-format read path.
// Self-contained: dummy env, temp DB, never reads the repo .env, no network
// (global fetch is stubbed).
//
// NOTE: the routers write into src/backend/data/{sessions,diary_files}
// (fixed paths in the route modules). Cleanup removes only files referenced by
// THIS test's private database (plus its private MEDIA_TMP_DIR), so parallel
// test files cannot delete each other's files. RUN_SLOW_TESTS=1 runs the full
// 100 MB HTTP memory test (default: 40 MB).
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { test, before, after } = require('node:test');

const BACKEND = path.resolve(__dirname, '..');
const SLOW = process.env.RUN_SLOW_TESTS === '1';
const SRC = path.join(BACKEND, 'src');
const dep = (m) => require(path.join(BACKEND, 'node_modules', m));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prtop-trackM-rt-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-xxxxxxxxxxxx',
  ENCRYPTION_MASTER_KEY: 'test-master-xxxxxxxxxxxx',
  BOT_API_KEY: 'test-bot-key-xxxxxxxx',
  SIGNED_LINK_SECRET: 'test-signed-link-secret-xxxx',
  DATABASE_URL: 'sqlite:' + path.join(tmp, 'test.db').split(path.sep).join('/'),
  BACKUP_DIR: path.join(tmp, 'backups'),
  LOG_LEVEL: 'error',
  // "configured" transcription so the real upload path runs (fetch is stubbed)
  TRANSCRIPTION_API_KEY: 'sk-test-transcription-key-xxxx',
  TRANSCRIPTION_API_URL: 'http://stub.invalid/v1',
  TRANSCRIPTION_MAX_FILE_BYTES: String(3 * 1024 * 1024),
  // private tmp dir: the startup purge must not touch other test processes
  MEDIA_TMP_DIR: path.join(tmp, 'media-tmp'),
});
delete process.env.AI_API_KEY;
process.chdir(tmp);

const SESS_DIR = path.join(BACKEND, 'data', 'sessions');
const DIARY_DIR = path.join(BACKEND, 'data', 'diary_files');
const TMP_DIR = process.env.MEDIA_TMP_DIR;
const snapshot = (d) => new Set(fs.existsSync(d) ? fs.readdirSync(d) : []);
const before0 = { s: snapshot(SESS_DIR), d: snapshot(DIARY_DIR), t: snapshot(TMP_DIR) };
const newFiles = (d, base) => [...snapshot(d)].filter((f) => !base.has(f));

// ---- stubbed transcription API -------------------------------------------
const apiCalls = [];
global.fetch = async (url, init) => {
  if (String(url).includes('/audio/transcriptions')) {
    const file = init.body.get('file');
    apiCalls.push({ name: file.name, size: file.size, type: file.type });
    return new Response(`part${apiCalls.length} ok`, { status: 200 });
  }
  return new Response('{}', { status: 500 });
};

let conn, db, enc, fc, server, port, ids = {};
const one = (sql, p = []) => { const r = conn.getDatabase().exec(sql, p); return r.length && r[0].values.length ? r[0].values[0] : null; };
const ins = (sql, p) => { conn.getDatabase().run(sql, p); return one('SELECT last_insert_rowid()')[0]; };
let tokenFor;

function req(method, url, { token, body, headers = {}, raw } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...headers };
    if (token) h.authorization = 'Bearer ' + token;
    let data = null;
    if (raw) data = raw;
    else if (body !== undefined) { data = Buffer.from(JSON.stringify(body)); h['content-type'] = 'application/json'; }
    if (data) h['content-length'] = data.length;
    const r = http.request({ host: '127.0.0.1', port, method, path: url, headers: h }, (res) => {
      const parts = [];
      res.on('data', (c) => parts.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(parts);
        let json = null; try { json = JSON.parse(buf.toString('utf8')); } catch (_) { /* binary */ }
        resolve({ status: res.statusCode, headers: res.headers, buf, json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function multipart(fields, file) {
  const boundary = '----trackM' + crypto.randomBytes(8).toString('hex');
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  if (file) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    parts.push(file.data);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { raw: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

function upload(token, clientId, data, name, type, extra = {}) {
  const mp = multipart({ client_id: String(clientId), ...extra }, { field: 'audio', name, type, data });
  return req('POST', '/api/sessions', { token, raw: mp.raw, headers: mp.headers });
}

// ---- synthetic media -------------------------------------------------------
function mp3Bytes(size) {
  // MPEG-1 Layer III, 128 kbps, 44.1 kHz, no padding -> 417-byte frames.
  const hdr = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
  const n = Math.ceil(size / 417);
  const out = Buffer.alloc(n * 417);
  for (let i = 0; i < n; i++) {
    hdr.copy(out, i * 417);
    out.fill(0x55, i * 417 + 4, (i + 1) * 417); // no 0xFF bytes -> no false sync
  }
  return out;
}
function wavBytes(dataLen) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataLen, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dataLen, 40);
  return Buffer.concat([h, crypto.randomBytes(dataLen)]);
}
const m4aBytes = (size) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A \0\0\0\0isomM4A '), crypto.randomBytes(size)]);
const oggBytes = (size) => Buffer.concat([Buffer.from('OggS'), Buffer.alloc(24), Buffer.from('OpusHead'), crypto.randomBytes(size)]);
const webmBytes = (size) => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84]), Buffer.from('webm'), crypto.randomBytes(size)]);
const jpegBytes = (size) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(size)]);
const pngBytes = (size) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(size)]);

async function waitFor(fn, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  return fn();
}

before(async () => {
  conn = require(path.join(SRC, 'db/connection.js'));
  await conn.initDatabase();
  db = conn.getDatabase();
  enc = require(path.join(SRC, 'services/encryption.js'));
  fc = require(path.join(SRC, 'services/fileCrypto.js'));
  const jwt = dep('jsonwebtoken');
  tokenFor = (id, role) => jwt.sign({ userId: id, role, tv: Number(one('SELECT COALESCE(token_version,0) FROM users WHERE id = ?', [id])[0]) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

  ids.T1 = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('t1@m.test','x','therapist','en')");
  ids.T2 = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('t2@m.test','x','therapist','en')");
  for (const t of [ids.T1, ids.T2]) ins("INSERT INTO subscriptions (therapist_id, plan, status) VALUES (?, 'premium', 'active')", [t]);
  ids.C1 = ins("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language, telegram_id) VALUES ('c1@m.test','x','client',?,1,'en','9101')", [ids.T1]);
  ids.C2 = ins("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language, telegram_id) VALUES ('c2@m.test','x','client',?,1,'en','9102')", [ids.T2]);

  const express = dep('express');
  const cookieParser = dep('cookie-parser');
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());
  app.use('/api/sessions', require(path.join(SRC, 'routes/sessions.js')));
  app.use('/api/diary', require(path.join(SRC, 'routes/diary.js')));
  app.use('/api/bot', require(path.join(SRC, 'routes/bot.js')));
  app.use('/api/clients', require(path.join(SRC, 'routes/clients.js')));
  app.use((err, _req, res, _next) => res.status(500).json({ error: 'unhandled: ' + err.message }));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  port = server.address().port;
});

after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
  const refs = (sql) => { try { return conn.getDatabase().exec(sql)[0].values.map((r) => r[0]).filter(Boolean); } catch (_) { return []; } };
  const rmRefs = (dir, list) => {
    let names = []; try { names = fs.readdirSync(dir); } catch (_) { return; }
    for (const n of names) if (list.some((r) => n === r || n.startsWith(r + '.'))) fs.rmSync(path.join(dir, n), { force: true, recursive: true });
  };
  rmRefs(SESS_DIR, refs('SELECT audio_ref FROM sessions'));
  rmRefs(DIARY_DIR, [...refs('SELECT audio_file_ref FROM diary_entries'), ...refs('SELECT file_ref FROM assignment_report_attachments')]);
  fs.rmSync(TMP_DIR, { force: true, recursive: true });
  process.chdir(os.tmpdir());
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* windows db handle */ }
  // services/emailService.js keeps a non-unref'd interval; same as test/helpers/checks.js
  setTimeout(() => process.exit(process.exitCode || 0), 300).unref();
});

const sessionRow = (id) => {
  const r = one('SELECT audio_ref, status, transcript_encrypted FROM sessions WHERE id = ?', [id]);
  return r && { audio_ref: r[0], status: r[1], transcript: r[2] ? enc.decrypt(r[2]) : null };
};

let S1, S1data;

test('upload: non-media rejected 415, nothing stored', async () => {
  const beforeSet = snapshot(SESS_DIR);
  const r = await upload(tokenFor(ids.T1, 'therapist'), ids.C1, Buffer.from('<html><script>alert(1)</script></html>'), 'evil.mp3', 'audio/mpeg');
  assert.strictEqual(r.status, 415, JSON.stringify(r.json));
  assert.strictEqual(r.json.code, 'UNSUPPORTED_MEDIA_TYPE');
  assert.deepStrictEqual(newFiles(SESS_DIR, beforeSet), []);
});

test('upload: client of another therapist -> 403 and the encrypted file is removed', async () => {
  const beforeSet = snapshot(SESS_DIR);
  const r = await upload(tokenFor(ids.T1, 'therapist'), ids.C2, mp3Bytes(5000), 'a.mp3', 'audio/mpeg');
  assert.strictEqual(r.status, 403);
  assert.deepStrictEqual(newFiles(SESS_DIR, beforeSet), []);
});

test('upload: type from magic bytes, encrypted chunked file, no plaintext on disk', async () => {
  const beforeSet = snapshot(SESS_DIR);
  S1data = mp3Bytes(300 * 1024);
  const r = await upload(tokenFor(ids.T1, 'therapist'), ids.C1, S1data, 'recording.bin', 'application/octet-stream');
  assert.strictEqual(r.status, 201, JSON.stringify(r.json));
  S1 = r.json.id;
  assert.match(r.json.audio_ref, /^[0-9a-f-]{36}\.mp3\.enc$/);
  const created = newFiles(SESS_DIR, beforeSet);
  assert.deepStrictEqual(created, [r.json.audio_ref], 'only the encrypted file exists');
  const onDisk = fs.readFileSync(path.join(SESS_DIR, r.json.audio_ref));
  assert.ok(onDisk.subarray(0, 8).equals(fc.MAGIC));
  assert.ok(!onDisk.includes(S1data.subarray(1000, 1400)), 'plaintext not visible in file');
  const info = await fc.readFileInfo(path.join(SESS_DIR, r.json.audio_ref));
  assert.strictEqual(info.contentType, 'audio/mpeg');
  assert.strictEqual(info.plaintextSize, S1data.length);
  // auto-transcription (stubbed API) completes: one call, real extension
  const done = await waitFor(() => { const s = sessionRow(S1); return s && s.status === 'complete' && s; });
  assert.ok(done, 'transcription completed');
  assert.ok(apiCalls.some((c) => c.name === 'session_audio.mp3' && c.size === S1data.length));
});

test('stream: full, ranges, 416, headers, ownership', async () => {
  const tk = tokenFor(ids.T1, 'therapist');
  let r = await req('GET', `/api/sessions/${S1}/stream`, { token: tk });
  assert.strictEqual(r.status, 200);
  assert.ok(r.buf.equals(S1data));
  assert.strictEqual(r.headers['content-type'], 'audio/mpeg');
  assert.strictEqual(r.headers['accept-ranges'], 'bytes');
  assert.strictEqual(r.headers['cache-control'], 'private, no-store');
  assert.strictEqual(r.headers['x-accel-buffering'], 'no', 'nginx must not spool decrypted media');
  assert.strictEqual(r.headers['content-length'], String(S1data.length));
  r = await req('GET', `/api/sessions/${S1}/stream`, { token: tk, headers: { range: 'bytes=65530-131080' } });
  assert.strictEqual(r.status, 206);
  assert.strictEqual(r.headers['content-range'], `bytes 65530-131080/${S1data.length}`);
  assert.ok(r.buf.equals(S1data.subarray(65530, 131081)));
  r = await req('GET', `/api/sessions/${S1}/stream`, { token: tk, headers: { range: 'bytes=-100' } });
  assert.strictEqual(r.status, 206);
  assert.ok(r.buf.equals(S1data.subarray(S1data.length - 100)));
  r = await req('GET', `/api/sessions/${S1}/stream`, { token: tk, headers: { range: `bytes=${S1data.length}-` } });
  assert.strictEqual(r.status, 416);
  assert.strictEqual(r.headers['content-range'], `bytes */${S1data.length}`);
  r = await req('GET', `/api/sessions/${S1}/stream`, { token: tokenFor(ids.T2, 'therapist') });
  assert.strictEqual(r.status, 403);
  r = await req('GET', `/api/sessions/${S1}/stream`);
  assert.strictEqual(r.status, 401);
  // one audit row per playback start, none for continuation ranges
  // Audit: every cookie/Bearer stream request that serves content is audited
  // (full, bytes=65530-, bytes=-100 -> 3 rows; 416/403/401 serve nothing).
  const auditCount = () => one("SELECT COUNT(*) FROM audit_logs WHERE action = 'stream_session_audio' AND target_id = ?", [S1])[0];
  assert.strictEqual(auditCount(), 3);
  r = await req('GET', `/api/sessions/${S1}/stream`, { token: tk, headers: { range: 'bytes=1-' } });
  assert.strictEqual(r.status, 206);
  assert.strictEqual(auditCount(), 4, 'a range not starting at 0 is audited too');
  r = await req('HEAD', `/api/sessions/${S1}/stream`, { token: tk });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers['content-length'], String(S1data.length));
  assert.strictEqual(r.headers['x-accel-buffering'], 'no');
  assert.strictEqual(r.buf.length, 0);
  assert.strictEqual(auditCount(), 4, 'HEAD is never audited');
  // signed link: one row when issued, none for the requests made with it
  const mu = await req('GET', `/api/sessions/${S1}/media-url`, { token: tk });
  assert.strictEqual(auditCount(), 5, 'issuing a media URL is audited');
  const via = JSON.parse(one("SELECT details_encrypted FROM audit_logs WHERE action = 'stream_session_audio' AND target_id = ? ORDER BY id DESC LIMIT 1", [S1])[0]);
  assert.strictEqual(via.via, 'media_url');
  for (const range of ['bytes=0-', 'bytes=5000-', 'bytes=1-10']) {
    r = await req('GET', mu.json.url, { headers: { range } });
    assert.strictEqual(r.status, 206);
    assert.strictEqual(r.headers['x-accel-buffering'], 'no');
  }
  assert.strictEqual(auditCount(), 5, 'signed-link requests were audited at issue time');
});

test('media-url: signed link works without credentials, is bound and revocable', async () => {
  const tk = tokenFor(ids.T1, 'therapist');
  let r = await req('GET', `/api/sessions/${S1}/media-url`, { token: tk });
  assert.strictEqual(r.status, 200, JSON.stringify(r.json));
  assert.strictEqual(r.json.content_type, 'audio/mpeg');
  assert.strictEqual(r.json.is_video, false);
  assert.match(r.json.url, new RegExp(`^/api/sessions/${S1}/stream\\?uid=${ids.T1}&exp=\\d+&sig=`));
  const url = r.json.url;
  r = await req('GET', url, { headers: { range: 'bytes=0-99' } });
  assert.strictEqual(r.status, 206);
  assert.ok(r.buf.equals(S1data.subarray(0, 100)));
  // tampered signature / other resource / other user -> 401
  r = await req('GET', url.replace(/sig=.{4}/, 'sig=AAAA'));
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.json.code, 'MEDIA_LINK_INVALID');
  const other = await upload(tk, ids.C1, mp3Bytes(3000), 'b.mp3', 'audio/mpeg');
  r = await req('GET', url.replace(`/sessions/${S1}/`, `/sessions/${other.json.id}/`));
  assert.strictEqual(r.status, 401);
  r = await req('GET', url.replace(`uid=${ids.T1}`, `uid=${ids.T2}`));
  assert.strictEqual(r.status, 401);
  // T2 cannot mint one
  r = await req('GET', `/api/sessions/${S1}/media-url`, { token: tokenFor(ids.T2, 'therapist') });
  assert.strictEqual(r.status, 403);
  // expired link
  const { createMediaUrl } = require(path.join(SRC, 'utils/mediaLinks.js'));
  const expired = createMediaUrl({ kind: 'session', resourceId: S1, userId: ids.T1, streamPath: `/api/sessions/${S1}/stream`, ttlSec: -5 });
  r = await req('GET', expired.url);
  assert.strictEqual(r.status, 401);
  // consent revoked -> the link no longer opens the file (consent re-checked)
  conn.getDatabase().run('UPDATE users SET consent_therapist_access = 0 WHERE id = ?', [ids.C1]);
  r = await req('GET', url);
  assert.strictEqual(r.status, 403);
  conn.getDatabase().run('UPDATE users SET consent_therapist_access = 1 WHERE id = ?', [ids.C1]);
  r = await req('GET', url);
  assert.ok(r.status === 200, 'works again with consent');
  // token_version bump (logout everywhere) revokes outstanding links
  conn.getDatabase().run('UPDATE users SET token_version = COALESCE(token_version,0) + 1 WHERE id = ?', [ids.T1]);
  r = await req('GET', url);
  assert.strictEqual(r.status, 401);
});

test('legacy session file: served via route, upgraded in place', async () => {
  const data = webmBytes(200 * 1024);
  const ref = `${crypto.randomUUID()}.webm.enc`;
  fs.writeFileSync(path.join(SESS_DIR, ref), enc.encrypt(data.toString('base64')).encrypted);
  const sid = ins("INSERT INTO sessions (therapist_id, client_id, audio_ref, status) VALUES (?, ?, ?, 'complete')", [ids.T1, ids.C1, ref]);
  const tk = tokenFor(ids.T1, 'therapist');
  const mu = await req('GET', `/api/sessions/${sid}/media-url`, { token: tk });
  assert.strictEqual(mu.status, 200);
  assert.strictEqual(mu.json.content_type, 'audio/webm');
  const r = await req('GET', mu.json.url, { headers: { range: 'bytes=1000-70000' } });
  assert.strictEqual(r.status, 206, JSON.stringify(r.json));
  assert.ok(r.buf.equals(data.subarray(1000, 70001)));
  const info = await fc.readFileInfo(path.join(SESS_DIR, ref));
  assert.strictEqual(info.format, 'v1');
  assert.strictEqual(info.contentType, 'audio/webm');
});

test('M20: long MP3 and WAV are split; long M4A -> transcription_too_long', async () => {
  const tk = tokenFor(ids.T1, 'therapist');
  // MP3 7 MB -> pieces of <= 2 MB target (limit 3 MB in this test)
  apiCalls.length = 0;
  const big = mp3Bytes(7 * 1024 * 1024);
  let r = await upload(tk, ids.C1, big, 'long.mp3', 'audio/mpeg');
  assert.strictEqual(r.status, 201);
  let s = await waitFor(() => { const x = sessionRow(r.json.id); return x && x.status === 'complete' && x; }, 20000);
  assert.ok(s, 'mp3 transcription complete');
  const mp3Calls = apiCalls.filter((c) => c.name === 'session_audio.mp3');
  assert.ok(mp3Calls.length >= 4, `split into ${mp3Calls.length}`);
  assert.ok(mp3Calls.every((c) => c.size <= 3 * 1024 * 1024));
  assert.strictEqual(mp3Calls.reduce((a, c) => a + c.size, 0), big.length, 'pieces cover the file exactly');
  assert.ok(s.transcript.split('\n').length === mp3Calls.length);

  apiCalls.length = 0;
  const wav = wavBytes(7 * 1024 * 1024);
  r = await upload(tk, ids.C1, wav, 'long.wav', 'audio/wav');
  assert.strictEqual(r.status, 201);
  s = await waitFor(() => { const x = sessionRow(r.json.id); return x && x.status === 'complete' && x; }, 20000);
  assert.ok(s, 'wav transcription complete');
  assert.ok(apiCalls.length >= 4 && apiCalls.every((c) => c.name === 'session_audio.wav' && c.size <= 3 * 1024 * 1024));

  apiCalls.length = 0;
  r = await upload(tk, ids.C1, m4aBytes(4 * 1024 * 1024), 'long.m4a', 'audio/mp4');
  assert.strictEqual(r.status, 201);
  assert.match(r.json.audio_ref, /\.m4a\.enc$/);
  s = await waitFor(() => { const x = sessionRow(r.json.id); return x && x.status === 'transcription_too_long' && x; }, 20000);
  assert.ok(s, 'status transcription_too_long');
  assert.strictEqual(apiCalls.length, 0, 'API not called');
  const manual = await req('POST', `/api/sessions/${r.json.id}/transcribe`, { token: tk });
  assert.strictEqual(manual.status, 422);
  assert.strictEqual(manual.json.code, 'FILE_TOO_LONG_TO_TRANSCRIBE');
  // no decrypted temp files or split pieces left behind
  await new Promise((res) => setTimeout(res, 200));
  assert.deepStrictEqual(newFiles(TMP_DIR, before0.t), []);
});

test('voice note: memory only, magic-byte check', async () => {
  const tk = tokenFor(ids.T1, 'therapist');
  apiCalls.length = 0;
  const beforeSet = snapshot(SESS_DIR);
  let mp = multipart({}, { field: 'audio', name: 'voice-note.webm', type: 'audio/webm', data: webmBytes(5000) });
  let r = await req('POST', `/api/sessions/${S1}/transcribe-voice-note`, { token: tk, raw: mp.raw, headers: mp.headers });
  assert.strictEqual(r.status, 200, JSON.stringify(r.json));
  assert.ok(apiCalls.length === 1 && apiCalls[0].name === 'session_audio.webm' && apiCalls[0].type === 'audio/webm');
  mp = multipart({}, { field: 'audio', name: 'x.webm', type: 'audio/webm', data: Buffer.from('not audio at all') });
  r = await req('POST', `/api/sessions/${S1}/transcribe-voice-note`, { token: tk, raw: mp.raw, headers: mp.headers });
  assert.strictEqual(r.status, 415);
  assert.deepStrictEqual(newFiles(SESS_DIR, beforeSet), [], 'voice notes never touch the disk');
});

test('bot diary media: stored encrypted, limits and codes (M24), diary stream + media-url', async () => {
  const BK = { 'x-bot-api-key': process.env.BOT_API_KEY };
  const count = () => one('SELECT COUNT(*) FROM diary_entries WHERE client_id = ?', [ids.C1])[0];
  const n0 = count();
  // too large: rejected before decoding, no entry
  let r = await req('POST', '/api/bot/diary', { headers: BK, body: { telegram_id: '9101', entry_type: 'voice', content: '[v]', file_ref: 'f', file_data: Buffer.alloc(21 * 1024 * 1024, 1).toString('base64'), file_ext: '.ogg' } });
  assert.strictEqual(r.status, 413);
  assert.strictEqual(r.json.code, 'MEDIA_TOO_LARGE');
  assert.strictEqual(r.json.max_bytes, 20 * 1024 * 1024);
  // not media
  r = await req('POST', '/api/bot/diary', { headers: BK, body: { telegram_id: '9101', entry_type: 'voice', content: '[v]', file_ref: 'f', file_data: Buffer.from('#!/bin/sh\nrm -rf /').toString('base64'), file_ext: '.ogg' } });
  assert.strictEqual(r.status, 415);
  assert.strictEqual(r.json.code, 'UNSUPPORTED_MEDIA_TYPE');
  assert.strictEqual(count(), n0, 'no entries created for rejected media');
  // valid ogg voice
  const ogg = oggBytes(150 * 1024);
  r = await req('POST', '/api/bot/diary', { headers: BK, body: { telegram_id: '9101', entry_type: 'voice', content: '[v]', file_ref: 'f', file_data: ogg.toString('base64'), file_ext: '.ogg' } });
  assert.strictEqual(r.status, 201, JSON.stringify(r.json));
  assert.strictEqual(r.json.entry.has_audio_file, true);
  const entryId = r.json.entry.id;
  const ref = one('SELECT audio_file_ref FROM diary_entries WHERE id = ?', [entryId])[0];
  const info = await fc.readFileInfo(path.join(DIARY_DIR, ref));
  assert.strictEqual(info.format, 'v1');
  assert.strictEqual(info.contentType, 'audio/ogg');
  // therapist streams it via a signed link
  const tk = tokenFor(ids.T1, 'therapist');
  const mu = await req('GET', `/api/diary/${entryId}/media-url`, { token: tk });
  assert.strictEqual(mu.status, 200, JSON.stringify(mu.json));
  assert.match(mu.json.url, new RegExp(`^/api/diary/${entryId}/stream\\?`));
  const st = await req('GET', mu.json.url, { headers: { range: 'bytes=10-20000' } });
  assert.strictEqual(st.status, 206);
  assert.ok(st.buf.equals(ogg.subarray(10, 20001)));
  // a session link cannot open a diary entry with the same id
  const { createMediaUrl } = require(path.join(SRC, 'utils/mediaLinks.js'));
  const cross = createMediaUrl({ kind: 'session', resourceId: entryId, userId: ids.T1, streamPath: `/api/diary/${entryId}/stream` });
  assert.strictEqual((await req('GET', cross.url)).status, 401);
  // other therapist / private entry
  assert.strictEqual((await req('GET', `/api/diary/${entryId}/media-url`, { token: tokenFor(ids.T2, 'therapist') })).status, 403);
  conn.getDatabase().run('UPDATE diary_entries SET is_private = 1 WHERE id = ?', [entryId]);
  assert.strictEqual((await req('GET', mu.json.url)).status, 404);
  conn.getDatabase().run('UPDATE diary_entries SET is_private = 0 WHERE id = ?', [entryId]);
  // video entry, generic mp4 brand -> stored as video/mp4
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom\0\0\0\0isomavc1'), crypto.randomBytes(5000)]);
  r = await req('POST', '/api/bot/diary', { headers: BK, body: { telegram_id: '9101', entry_type: 'video', content: '[v]', file_ref: 'f', file_data: mp4.toString('base64'), file_ext: '.mp4' } });
  assert.strictEqual(r.status, 201);
  const vref = one('SELECT audio_file_ref FROM diary_entries WHERE id = ?', [r.json.entry.id])[0];
  assert.strictEqual((await fc.readFileInfo(path.join(DIARY_DIR, vref))).contentType, 'video/mp4');
  const vmu = await req('GET', `/api/diary/${r.json.entry.id}/media-url`, { token: tk });
  assert.strictEqual(vmu.json.is_video, true);
});

test('legacy diary file still streams', async () => {
  const data = oggBytes(90000);
  const ref = `${crypto.randomUUID()}.ogg.enc`;
  fs.writeFileSync(path.join(DIARY_DIR, ref), enc.encrypt(data.toString('base64')).encrypted);
  const id = ins("INSERT INTO diary_entries (client_id, entry_type, audio_file_ref, transcription_status) VALUES (?, 'voice', ?, 'completed')", [ids.C1, ref]);
  const r = await req('GET', `/api/diary/${id}/stream`, { token: tokenFor(ids.T1, 'therapist') });
  assert.strictEqual(r.status, 200);
  assert.ok(r.buf.equals(data));
  assert.strictEqual(r.headers['content-type'], 'audio/ogg');
});

test('bot report photo: real image type stored and served; legacy photo served', async () => {
  const BK = { 'x-bot-api-key': process.env.BOT_API_KEY };
  const title = enc.encrypt('Homework').encrypted;
  const A = ins("INSERT INTO assignments (therapist_id, client_id, title_encrypted) VALUES (?, ?, ?)", [ids.T1, ids.C1, title]);
  let r = await req('POST', `/api/bot/assignments/${A}/reports`, { headers: BK, body: { telegram_id: '9101', report_type: 'text', content: 'did it' } });
  assert.strictEqual(r.status, 201, JSON.stringify(r.json));
  const R = r.json.report.id;
  // claimed jpeg, really png -> stored as png
  const png = pngBytes(3000);
  r = await req('POST', `/api/bot/assignments/${A}/reports/${R}/attachments`, { headers: BK, body: { telegram_id: '9101', file_data: png.toString('base64'), mime_type: 'image/jpeg' } });
  assert.strictEqual(r.status, 201, JSON.stringify(r.json));
  const att = r.json.attachment;
  assert.strictEqual(one('SELECT mime_type FROM assignment_report_attachments WHERE id = ?', [att.id])[0], 'image/png');
  // not an image -> 415
  r = await req('POST', `/api/bot/assignments/${A}/reports/${R}/attachments`, { headers: BK, body: { telegram_id: '9101', file_data: oggBytes(100).toString('base64'), mime_type: 'image/jpeg' } });
  assert.strictEqual(r.status, 415);
  const tk = tokenFor(ids.T1, 'therapist');
  r = await req('GET', `/api/clients/${ids.C1}/assignments/${A}/reports/${R}/attachments/${att.id}/stream`, { token: tk });
  assert.strictEqual(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.buf.equals(png));
  assert.strictEqual(r.headers['content-type'], 'image/png');
  // legacy-format photo
  const jpg = jpegBytes(4000);
  const lref = `${crypto.randomUUID()}.jpg.enc`;
  fs.writeFileSync(path.join(DIARY_DIR, lref), enc.encrypt(jpg.toString('base64')).encrypted);
  const LA = ins("INSERT INTO assignment_report_attachments (report_id, file_ref, mime_type, size_bytes) VALUES (?, ?, 'image/jpeg', ?)", [R, lref, jpg.length]);
  r = await req('GET', `/api/clients/${ids.C1}/assignments/${A}/reports/${R}/attachments/${LA}/stream`, { token: tk });
  assert.strictEqual(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.buf.equals(jpg));
});

test(`memory: serve a ${SLOW ? 100 : 40} MB recording over HTTP with bounded RSS`, async () => {
  const total = (SLOW ? 100 : 40) * 1024 * 1024;
  const ref = `${crypto.randomUUID()}.mp3.enc`;
  const { Readable } = require('node:stream');
  let produced = 0;
  const frame = mp3Bytes(417 * 600);
  await fc.encryptStreamToFile(new Readable({
    read() {
      if (produced >= total) return this.push(null);
      const n = Math.min(frame.length, total - produced);
      produced += n;
      this.push(frame.subarray(0, n));
    },
  }), path.join(SESS_DIR, ref), { contentType: 'audio/mpeg' });
  const sid = ins("INSERT INTO sessions (therapist_id, client_id, audio_ref, status) VALUES (?, ?, ?, 'complete')", [ids.T1, ids.C1, ref]);
  global.gc && global.gc();
  const rss0 = process.memoryUsage().rss;
  let peak = rss0;
  const tk = tokenFor(ids.T1, 'therapist');
  // Client in a child process: only the server's memory is measured here.
  const { spawn } = require('node:child_process');
  const clientCode = `const http=require('http');let n=0;http.get({host:'127.0.0.1',port:${port},path:'/api/sessions/${sid}/stream',headers:{authorization:'Bearer ${tk}'}},(res)=>{res.on('data',(c)=>{n+=c.length});res.on('end',()=>{process.stdout.write(JSON.stringify({status:res.statusCode,n}))})})`;
  const sampler = setInterval(() => { const m = process.memoryUsage().rss; if (m > peak) peak = m; }, 5);
  const got = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', clientCode]);
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('error', reject);
    child.on('close', () => { try { resolve(JSON.parse(out)); } catch (e) { reject(new Error('client output: ' + out)); } });
  });
  clearInterval(sampler);
  assert.strictEqual(got.status, 200);
  assert.strictEqual(got.n, total);
  const growth = (peak - rss0) / 1024 / 1024;
  console.log(`  [mem] HTTP stream: RSS growth ${growth.toFixed(1)} MB`);
  // Observed 9-33 MB across runs: every decrypted 64 KiB chunk is a fresh
  // external Buffer and V8 collects them on its own schedule (the old code
  // held ~180 MB of strings per request). The fileCrypto-level test asserts
  // < 30 MB; over HTTP the bound is 40 MB to keep the test deterministic.
  assert.ok(growth < 40, `RSS growth ${growth} MB`);
});

test('upload over 100 MB -> 413 FILE_TOO_LARGE, nothing kept', async () => {
  const beforeSet = snapshot(SESS_DIR);
  const tk = tokenFor(ids.T1, 'therapist');
  const boundary = '----trackMbig';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n${ids.C1}\r\n--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="huge.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const chunk = mp3Bytes(1024 * 1024);
  const res = await new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/api/sessions', headers: { authorization: 'Bearer ' + tk, 'content-type': `multipart/form-data; boundary=${boundary}` } }, (resp) => {
      let s = ''; resp.on('data', (c) => (s += c)); resp.on('end', () => resolve({ status: resp.statusCode, body: s }));
    });
    r.on('error', (e) => resolve({ status: 'socket-error', body: e.message }));
    (async () => {
      r.write(head);
      for (let i = 0; i < 102; i++) {
        if (!r.write(chunk)) await new Promise((d) => r.once('drain', d));
      }
      r.end(tail);
    })().catch(reject);
  });
  assert.strictEqual(res.status, 413, res.body);
  assert.strictEqual(JSON.parse(res.body).code, 'FILE_TOO_LARGE');
  await new Promise((r) => setTimeout(r, 300));
  assert.deepStrictEqual(newFiles(SESS_DIR, beforeSet), []);
});
