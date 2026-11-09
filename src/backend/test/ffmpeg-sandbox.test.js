'use strict';
// ffmpeg wrapper (services/ffmpeg.js) and the transcode path, WITHOUT a real
// ffmpeg: a fake (test/fixtures/fake-ffmpeg.js, run as `node fake.js <args>`)
// stands in, so this suite runs everywhere. Covers: argument building, env
// scrubbing, kill on timeout (FFMPEG_TIMEOUT_MS), one process at a time,
// 0600 output, failure cleanup, availability probe / FFMPEG_PATH, and the
// session transcription path end to end (transcode -> MP3 split -> stubbed
// API; failure / hang / no ffmpeg -> 'transcription_too_long').
// The real-ffmpeg counterpart is test/transcode.test.js.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { test, before, after } = require('node:test');

const BACKEND = path.resolve(__dirname, '..');
const SRC = path.join(BACKEND, 'src');
const FAKE = path.join(__dirname, 'fixtures', 'fake-ffmpeg.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prtop-ffsandbox-'));
const LIMIT = 3 * 1024 * 1024;
Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-xxxxxxxxxxxx',
  ENCRYPTION_MASTER_KEY: 'test-master-xxxxxxxxxxxx',
  BOT_API_KEY: 'test-bot-key-xxxxxxxx',
  SIGNED_LINK_SECRET: 'test-signed-link-secret-xxxx',
  DATABASE_URL: 'sqlite:' + path.join(tmp, 'test.db').split(path.sep).join('/'),
  BACKUP_DIR: path.join(tmp, 'backups'),
  LOG_LEVEL: 'error',
  TRANSCRIPTION_API_KEY: 'sk-test-transcription-key-xxxx',
  TRANSCRIPTION_API_URL: 'http://stub.invalid/v1',
  TRANSCRIPTION_MAX_FILE_BYTES: String(LIMIT),
  MEDIA_TMP_DIR: path.join(tmp, 'media-tmp'),
  STRIPE_SECRET_KEY: 'sk_test_should_not_leak_xxxxxxxx',
  SMTP_PASS: 'smtp-pass-should-not-leak',
});
delete process.env.AI_API_KEY;
delete process.env.FFMPEG_TIMEOUT_MS;
process.chdir(tmp);

const TMP_DIR = process.env.MEDIA_TMP_DIR;
const SESS_DIR = path.join(BACKEND, 'data', 'sessions');
const ownFiles = [];
const tmpLeftovers = () => (fs.existsSync(TMP_DIR) ? fs.readdirSync(TMP_DIR) : []);

const apiCalls = [];
global.fetch = async (url, init) => {
  if (String(url).includes('/audio/transcriptions')) {
    const file = init.body.get('file');
    const head = Buffer.from(await file.slice(0, 4).arrayBuffer());
    apiCalls.push({ name: file.name, size: file.size, type: file.type, head });
    return new Response(`part${apiCalls.length}`, { status: 200 });
  }
  return new Response('{}', { status: 500 });
};

let conn, enc, fc, transcription, ffmpeg, ids = {};
const one = (sql, p = []) => { const r = conn.getDatabase().exec(sql, p); return r.length && r[0].values.length ? r[0].values[0] : null; };
const ins = (sql, p) => { conn.getDatabase().run(sql, p); return one('SELECT last_insert_rowid()')[0]; };
const useFake = () => ffmpeg._internal.setCommandOverride({ command: process.execPath, prefixArgs: [FAKE] });

before(async () => {
  conn = require(path.join(SRC, 'db/connection.js'));
  await conn.initDatabase();
  enc = require(path.join(SRC, 'services/encryption.js'));
  fc = require(path.join(SRC, 'services/fileCrypto.js'));
  transcription = require(path.join(SRC, 'services/transcription.js'));
  ffmpeg = require(path.join(SRC, 'services/ffmpeg.js'));
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(SESS_DIR, { recursive: true });
  ids.T = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('tf@m.test','x','therapist','en')");
  ids.C = ins("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language) VALUES ('cf@m.test','x','client',?,1,'en')", [ids.T]);
  useFake();
});

after(() => {
  for (const f of ownFiles) fs.rmSync(f, { force: true });
  process.chdir(os.tmpdir());
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* windows db handle */ }
  setTimeout(() => process.exit(process.exitCode || 0), 300).unref();
});

function input(name, bytes = 1000) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, Buffer.concat([Buffer.from('OggS'), crypto.randomBytes(bytes)]));
  return p;
}

async function transcribeSession(content) {
  const ref = `${crypto.randomUUID()}.ogg.enc`;
  fc.encryptBufferToFileSync(content, path.join(SESS_DIR, ref), { contentType: 'audio/ogg' });
  ownFiles.push(path.join(SESS_DIR, ref));
  const sid = ins("INSERT INTO sessions (therapist_id, client_id, audio_ref, status) VALUES (?, ?, ?, 'pending')", [ids.T, ids.C, ref]);
  const res = await transcription.processSessionTranscription(sid);
  const row = one('SELECT status, transcript_encrypted FROM sessions WHERE id = ?', [sid]);
  return { res, status: row[0], transcript: row[1] ? enc.decrypt(row[1]) : null };
}

test('argument list: file-only input, no stdin, audio only, mono 16 kHz 32 kbit/s MP3', () => {
  const args = ffmpeg.buildTranscodeArgs('/in/a b;$(rm -rf).m4a', '/out/dec-x.mp3');
  assert.deepStrictEqual(args, [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-protocol_whitelist', 'file',
    '-i', '/in/a b;$(rm -rf).m4a',
    '-vn', '-sn', '-dn', '-map_metadata', '-1',
    '-ac', '1', '-ar', '16000',
    '-c:a', 'libmp3lame', '-b:a', '32k',
    '-threads', '1',
    '-f', 'mp3', '-y', '/out/dec-x.mp3',
  ]);
  // -protocol_whitelist must precede -i to apply to the input
  assert.ok(args.indexOf('-protocol_whitelist') < args.indexOf('-i'));
});

test('child env is scrubbed and the args reach ffmpeg verbatim (no shell)', async () => {
  const src = input('x-dumpenv.ogg');
  const out = await ffmpeg.transcodeToSpeechMp3(src, { tmpDir: TMP_DIR });
  try {
    const dump = JSON.parse(fs.readFileSync(out.path, 'utf8'));
    const allowed = new Set(['PATH', 'SystemRoot', 'SYSTEMROOT', 'windir', 'WINDIR']);
    // Added by the platform, not by us: POSIX shells/exec may set PWD etc.;
    // on Windows libuv always injects these non-secret system variables.
    const platformAdded = /^(PWD|SHLVL|_|OLDPWD|HOMEDRIVE|HOMEPATH|LOGONSERVER|SYSTEMDRIVE|SYSTEMROOT|TEMP|TMP|USERDOMAIN|USERNAME|USERPROFILE|WINDIR)$/i;
    const keys = Object.keys(dump.env).filter((k) => !platformAdded.test(k));
    assert.ok(keys.every((k) => allowed.has(k)), 'unexpected env: ' + keys.join(','));
    const blob = JSON.stringify(dump.env);
    for (const secret of ['sk_test_should_not_leak', 'smtp-pass-should-not-leak', process.env.ENCRYPTION_MASTER_KEY, process.env.JWT_SECRET, process.env.TRANSCRIPTION_API_KEY]) {
      assert.ok(!blob.includes(secret), 'secret leaked to ffmpeg env');
    }
    assert.deepStrictEqual(dump.argv, ffmpeg.buildTranscodeArgs(src, out.path));
    assert.ok(path.basename(out.path).startsWith('dec-'), 'name swept by housekeeping');
    if (process.platform !== 'win32') assert.strictEqual(fs.statSync(out.path).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(out.path, { force: true });
  }
});

test('hung ffmpeg is killed at the timeout; its output is removed', async () => {
  const t0 = Date.now();
  await assert.rejects(
    () => ffmpeg.transcodeToSpeechMp3(input('x-hang.ogg'), { tmpDir: TMP_DIR, timeoutMs: 500 }),
    (e) => e.code === 'FFMPEG_TIMEOUT'
  );
  assert.ok(Date.now() - t0 < 5000, 'killed promptly');
  assert.strictEqual(ffmpeg._internal.stats().active, 0, 'no ffmpeg child left running');
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('FFMPEG_TIMEOUT_MS is honoured (default 15 min; values under 1000 ms are ignored)', async () => {
  process.env.FFMPEG_TIMEOUT_MS = '1200';
  try {
    const t0 = Date.now();
    await assert.rejects(() => ffmpeg.transcodeToSpeechMp3(input('y-hang.ogg'), { tmpDir: TMP_DIR }), (e) => e.code === 'FFMPEG_TIMEOUT');
    assert.ok(Date.now() - t0 < 5000);
  } finally {
    delete process.env.FFMPEG_TIMEOUT_MS;
  }
});

test('failing ffmpeg -> FFMPEG_FAILED, output removed', async () => {
  await assert.rejects(() => ffmpeg.transcodeToSpeechMp3(input('x-fail.ogg'), { tmpDir: TMP_DIR }), (e) => e.code === 'FFMPEG_FAILED');
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('at most one ffmpeg process at a time (queue)', async () => {
  ffmpeg._internal.resetStats();
  const outs = await Promise.all([1, 2, 3, 4].map((i) => ffmpeg.transcodeToSpeechMp3(input(`q${i}-slow.ogg`), { tmpDir: TMP_DIR })));
  try {
    assert.strictEqual(ffmpeg._internal.stats().peak, 1);
    assert.ok(outs.every((o) => o.size > 0));
  } finally {
    for (const o of outs) fs.rmSync(o.path, { force: true });
  }
  // a failure / timeout in the queue does not block the next run
  await assert.rejects(() => ffmpeg.transcodeToSpeechMp3(input('z-hang.ogg'), { tmpDir: TMP_DIR, timeoutMs: 300 }));
  const next = await ffmpeg.transcodeToSpeechMp3(input('after-timeout.ogg'), { tmpDir: TMP_DIR });
  fs.rmSync(next.path, { force: true });
});

test('availability is probed once and cached; FFMPEG_PATH is used', async () => {
  useFake();
  const p1 = ffmpeg.isAvailable();
  assert.strictEqual(ffmpeg.isAvailable(), p1, 'same cached promise');
  assert.strictEqual(await p1, true);
  ffmpeg._internal.setCommandOverride(null);
  const saved = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = path.join(tmp, 'definitely-not-ffmpeg');
  try {
    assert.strictEqual(await ffmpeg.isAvailable(), false);
  } finally {
    if (saved === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = saved;
    useFake();
  }
});

test('session path: long Ogg -> transcode -> split into MP3 pieces under the limit', async () => {
  useFake();
  apiCalls.length = 0;
  const r = await transcribeSession(Buffer.concat([Buffer.from('OggS'), crypto.randomBytes(8 * 1024 * 1024)])); // fake MP3 ~4 MB
  assert.strictEqual(r.status, 'complete', r.res.error);
  assert.ok(apiCalls.length >= 2, `pieces: ${apiCalls.length}`);
  for (const c of apiCalls) {
    assert.strictEqual(c.name, 'session_audio.mp3');
    assert.strictEqual(c.type, 'audio/mpeg');
    assert.ok(c.size <= LIMIT);
    assert.ok(c.head[0] === 0xff && (c.head[1] & 0xe0) === 0xe0, 'pieces start on an MPEG frame');
  }
  assert.strictEqual(r.transcript.split('\n').length, apiCalls.length);
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('session path: transcoded MP3 that fits is sent as one file', async () => {
  apiCalls.length = 0;
  const r = await transcribeSession(Buffer.concat([Buffer.from('OggS'), crypto.randomBytes(4 * 1024 * 1024)])); // fake MP3 ~2 MB
  assert.strictEqual(r.status, 'complete', r.res.error);
  assert.strictEqual(apiCalls.length, 1);
  assert.strictEqual(apiCalls[0].name, 'session_audio.mp3');
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('session path: small file is sent as-is (no ffmpeg)', async () => {
  apiCalls.length = 0;
  ffmpeg._internal.resetStats();
  const r = await transcribeSession(Buffer.concat([Buffer.from('OggS'), crypto.randomBytes(200 * 1024)]));
  assert.strictEqual(r.status, 'complete');
  assert.strictEqual(apiCalls.length, 1);
  assert.strictEqual(apiCalls[0].name, 'session_audio.ogg');
  assert.strictEqual(ffmpeg._internal.stats().peak, 0, 'ffmpeg not run');
});

test('session path: ffmpeg failure / hang / missing -> transcription_too_long, nothing left', async () => {
  useFake();
  apiCalls.length = 0;
  let r = await transcribeSession(Buffer.concat([Buffer.from('OggS fail '), crypto.randomBytes(LIMIT + 1000)]));
  assert.strictEqual(r.status, 'transcription_too_long');
  assert.strictEqual(r.res.code, 'FILE_TOO_LONG_TO_TRANSCRIBE');
  assert.match(r.res.error, /ffmpeg transcode failed \(exit 1\)/);

  process.env.FFMPEG_TIMEOUT_MS = '1000';
  try {
    const t0 = Date.now();
    r = await transcribeSession(Buffer.concat([Buffer.from('OggS hang '), crypto.randomBytes(LIMIT + 1000)]));
    assert.strictEqual(r.status, 'transcription_too_long');
    assert.match(r.res.error, /timed out/);
    assert.ok(Date.now() - t0 < 10000);
  } finally {
    delete process.env.FFMPEG_TIMEOUT_MS;
  }

  ffmpeg._internal.setCommandOverride(null);
  const saved = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = path.join(tmp, 'definitely-not-ffmpeg');
  try {
    r = await transcribeSession(Buffer.concat([Buffer.from('OggS'), crypto.randomBytes(LIMIT + 1000)]));
    assert.strictEqual(r.status, 'transcription_too_long');
    assert.match(r.res.error, /ffmpeg is not available/);
  } finally {
    if (saved === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = saved;
    useFake();
  }
  assert.strictEqual(apiCalls.length, 0, 'the API is never called with an oversized file');
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('long MP3 is cut losslessly without running ffmpeg', async () => {
  apiCalls.length = 0;
  ffmpeg._internal.resetStats();
  const frame = Buffer.alloc(417, 0x55);
  Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(frame, 0);
  const mp3 = Buffer.concat(Array.from({ length: Math.ceil((7 * 1024 * 1024) / 417) }, () => frame));
  const ref = `${crypto.randomUUID()}.mp3.enc`;
  fc.encryptBufferToFileSync(mp3, path.join(SESS_DIR, ref), { contentType: 'audio/mpeg' });
  ownFiles.push(path.join(SESS_DIR, ref));
  const sid = ins("INSERT INTO sessions (therapist_id, client_id, audio_ref, status) VALUES (?, ?, ?, 'pending')", [ids.T, ids.C, ref]);
  const res = await transcription.processSessionTranscription(sid);
  assert.ok(res.success, res.error);
  assert.ok(apiCalls.length >= 3 && apiCalls.every((c) => c.size <= LIMIT));
  assert.strictEqual(ffmpeg._internal.stats().peak, 0, 'lossless cut, no transcode');
  assert.deepStrictEqual(tmpLeftovers(), []);
});
