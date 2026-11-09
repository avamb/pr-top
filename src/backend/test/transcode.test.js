'use strict';
// Long recordings in any format -> ffmpeg speech MP3 -> MP3 frame splitter ->
// transcription API (stubbed). Also the ffmpeg sandbox: minimal env, kill on
// timeout, one process at a time, file-only input, garbage input fails
// cleanly to 'transcription_too_long', and no temp files are left behind.
//
// Tests that need ffmpeg are SKIPPED when it is not installed (FFMPEG_PATH or
// `ffmpeg` on PATH), so Windows dev boxes and CI without ffmpeg still pass.
// Self-contained: dummy env, temp DB, private MEDIA_TMP_DIR, global fetch is
// stubbed (no network). Fixtures it writes into src/backend/data/{sessions,
// diary_files} are removed at the end.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { test, before, after } = require('node:test');

const BACKEND = path.resolve(__dirname, '..');
const SRC = path.join(BACKEND, 'src');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prtop-transcode-'));
const LIMIT = 3 * 1024 * 1024; // lowered TRANSCRIPTION_MAX_FILE_BYTES
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
  // a secret that must never reach the ffmpeg child
  STRIPE_SECRET_KEY: 'sk_test_should_not_leak_xxxxxxxx',
});
delete process.env.AI_API_KEY;
process.chdir(tmp);

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const HAVE_FFMPEG = (() => {
  try { return spawnSync(FFMPEG, ['-hide_banner', '-version'], { stdio: 'ignore', timeout: 15000 }).status === 0; } catch (_) { return false; }
})();
const needFfmpeg = { skip: HAVE_FFMPEG ? false : 'ffmpeg not installed' };

const SESS_DIR = path.join(BACKEND, 'data', 'sessions');
const DIARY_DIR = path.join(BACKEND, 'data', 'diary_files');
const TMP_DIR = process.env.MEDIA_TMP_DIR;
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

let conn, enc, fc, transcription, diaryTx, ffmpeg, ids = {};
const one = (sql, p = []) => { const r = conn.getDatabase().exec(sql, p); return r.length && r[0].values.length ? r[0].values[0] : null; };
const ins = (sql, p) => { conn.getDatabase().run(sql, p); return one('SELECT last_insert_rowid()')[0]; };

// Generate a test recording with ffmpeg itself (sine tone + a little noise so
// the encoder cannot compress it to nothing).
const fixtureCache = new Map();
function makeFixture(name, seconds, codecArgs) {
  const out = path.join(tmp, name);
  if (fixtureCache.has(out)) return out;
  fixtureCache.set(out, true);
  const r = spawnSync(FFMPEG, [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${seconds}`,
    '-f', 'lavfi', '-i', `anoisesrc=color=pink:amplitude=0.2:sample_rate=48000:duration=${seconds}`,
    '-filter_complex', 'amix=inputs=2', '-ac', '2',
    ...codecArgs, '-y', out,
  ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  if (r.status !== 0) throw new Error('fixture generation failed: ' + String(r.stderr).slice(0, 300));
  return out;
}

function encryptInto(dir, plainPath, ext, mime) {
  const name = `${crypto.randomUUID()}${ext}.enc`;
  fc.encryptBufferToFileSync(fs.readFileSync(plainPath), path.join(dir, name), { contentType: mime });
  ownFiles.push(path.join(dir, name));
  return name;
}

before(async () => {
  conn = require(path.join(SRC, 'db/connection.js'));
  await conn.initDatabase();
  enc = require(path.join(SRC, 'services/encryption.js'));
  fc = require(path.join(SRC, 'services/fileCrypto.js'));
  transcription = require(path.join(SRC, 'services/transcription.js'));
  diaryTx = require(path.join(SRC, 'services/diaryTranscription.js'));
  ffmpeg = require(path.join(SRC, 'services/ffmpeg.js'));
  fs.mkdirSync(SESS_DIR, { recursive: true });
  fs.mkdirSync(DIARY_DIR, { recursive: true });
  ids.T = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('tx@m.test','x','therapist','en')");
  ids.C = ins("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language) VALUES ('cx@m.test','x','client',?,1,'en')", [ids.T]);
});

after(() => {
  for (const f of ownFiles) fs.rmSync(f, { force: true });
  process.chdir(os.tmpdir());
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* windows db handle */ }
  // modules under test keep timers alive (same as test/helpers/checks.js)
  setTimeout(() => process.exit(process.exitCode || 0), 300).unref();
});

const isMp3Head = (h) => (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0);

async function transcribeSession(ref) {
  const sid = ins("INSERT INTO sessions (therapist_id, client_id, audio_ref, status) VALUES (?, ?, ?, 'pending')", [ids.T, ids.C, ref]);
  const res = await transcription.processSessionTranscription(sid);
  const row = one('SELECT status, transcript_encrypted FROM sessions WHERE id = ?', [sid]);
  return { res, status: row[0], transcript: row[1] ? enc.decrypt(row[1]) : null };
}

test('ffmpeg child gets a minimal environment (no secrets)', () => {
  const env = ffmpeg._internal.minimalEnv();
  const allowed = new Set(['PATH', 'SystemRoot', 'SYSTEMROOT', 'windir', 'WINDIR']);
  assert.ok(Object.keys(env).every((k) => allowed.has(k)), Object.keys(env).join(','));
  assert.ok(!JSON.stringify(env).includes('sk_test_should_not_leak'));
  assert.ok(!JSON.stringify(env).includes(process.env.ENCRYPTION_MASTER_KEY));
});

test('long M4A (AAC) -> transcoded to speech MP3 -> split; pieces under the limit; no temp files', needFfmpeg, async () => {
  const src = makeFixture('long.m4a', 1100, ['-c:a', 'aac', '-b:a', '64k']); // ~8.8 MB
  assert.ok(fs.statSync(src).size > LIMIT);
  const ref = encryptInto(SESS_DIR, src, '.m4a', 'audio/mp4');
  apiCalls.length = 0;
  const r = await transcribeSession(ref);
  assert.strictEqual(r.status, 'complete', r.res.error);
  assert.ok(apiCalls.length >= 2, `split into ${apiCalls.length}`);
  for (const c of apiCalls) {
    assert.strictEqual(c.name, 'session_audio.mp3');
    assert.strictEqual(c.type, 'audio/mpeg');
    assert.ok(c.size <= LIMIT, `piece ${c.size} > limit`);
    assert.ok(isMp3Head(c.head), 'piece starts with ID3 or an MPEG frame');
  }
  assert.strictEqual(r.transcript.split('\n').length, apiCalls.length);
  assert.deepStrictEqual(tmpLeftovers(), [], 'no decrypted / transcoded / split files left');
});

test('long Ogg/Opus -> transcoded (single piece when the MP3 fits)', needFfmpeg, async () => {
  const src = makeFixture('long.ogg', 700, ['-c:a', 'libopus', '-b:a', '48k']); // ~4.2 MB, MP3 ~2.8 MB
  assert.ok(fs.statSync(src).size > LIMIT);
  const ref = encryptInto(SESS_DIR, src, '.ogg', 'audio/ogg');
  apiCalls.length = 0;
  const r = await transcribeSession(ref);
  assert.strictEqual(r.status, 'complete', r.res.error);
  assert.ok(apiCalls.length >= 1);
  assert.ok(apiCalls.every((c) => c.name === 'session_audio.mp3' && c.size <= LIMIT && isMp3Head(c.head)));
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('diary transcription uses the same path', needFfmpeg, async () => {
  const src = makeFixture('long.ogg', 700, ['-c:a', 'libopus', '-b:a', '48k']); // ~4.2 MB, reused
  const ref = encryptInto(DIARY_DIR, src, '.ogg', 'audio/ogg');
  apiCalls.length = 0;
  const r = await diaryTx.transcribeDiaryEntry('voice', null, null, ref, 'en');
  assert.ok(apiCalls.length >= 1);
  assert.ok(apiCalls.every((c) => c.name === 'diary_audio.mp3' && c.size <= LIMIT && isMp3Head(c.head)));
  assert.strictEqual(r.text.split('\n').length, apiCalls.length);
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('garbage behind a valid container header -> transcription_too_long, nothing left', needFfmpeg, async () => {
  const bad = path.join(tmp, 'bad.m4a');
  fs.writeFileSync(bad, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A \0\0\0\0isomM4A '), crypto.randomBytes(LIMIT + 500000)]));
  const ref = encryptInto(SESS_DIR, bad, '.m4a', 'audio/mp4');
  apiCalls.length = 0;
  const r = await transcribeSession(ref);
  assert.strictEqual(r.status, 'transcription_too_long');
  assert.strictEqual(r.res.code, 'FILE_TOO_LONG_TO_TRANSCRIBE');
  assert.match(r.res.error, /ffmpeg/);
  assert.strictEqual(apiCalls.length, 0);
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('non-media input and non-file protocols fail cleanly', needFfmpeg, async () => {
  const txt = path.join(tmp, 'notes.txt');
  fs.writeFileSync(txt, 'just some text, not audio\n'.repeat(1000));
  await assert.rejects(() => ffmpeg.transcodeToSpeechMp3(txt, { tmpDir: TMP_DIR }), (e) => e.code === 'FFMPEG_FAILED');
  // -protocol_whitelist file: a URL as input must be refused, not fetched
  const t0 = Date.now();
  await assert.rejects(() => ffmpeg.transcodeToSpeechMp3('http://127.0.0.1:9/x.mp3', { tmpDir: TMP_DIR }), (e) => e.code === 'FFMPEG_FAILED');
  assert.ok(Date.now() - t0 < 10000);
  assert.deepStrictEqual(tmpLeftovers(), [], 'failed outputs are deleted');
});

test('timeout kills a hung ffmpeg; transcode timeout removes its output', needFfmpeg, async () => {
  const t0 = Date.now();
  const r = await ffmpeg.runFfmpeg(
    ['-nostdin', '-hide_banner', '-loglevel', 'error', '-re', '-f', 'lavfi', '-i', 'sine=duration=120', '-f', 'null', '-'],
    { timeoutMs: 1000 }
  );
  assert.strictEqual(r.timedOut, true);
  assert.ok(Date.now() - t0 < 15000, 'killed promptly');
  const src = makeFixture('long.m4a', 1100, ['-c:a', 'aac', '-b:a', '64k']); // reused
  await assert.rejects(() => ffmpeg.transcodeToSpeechMp3(src, { tmpDir: TMP_DIR, timeoutMs: 30 }), (e) => e.code === 'FFMPEG_TIMEOUT');
  assert.deepStrictEqual(tmpLeftovers(), []);
});

test('at most one ffmpeg runs at a time', needFfmpeg, async () => {
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-re', '-f', 'lavfi', '-i', 'sine=duration=1', '-f', 'null', '-'];
  ffmpeg._internal.resetStats();
  const runs = await Promise.all([1, 2, 3, 4].map(() => ffmpeg.runFfmpeg(args)));
  assert.ok(runs.every((r) => r.code === 0));
  assert.strictEqual(ffmpeg._internal.stats().peak, 1, 'never more than one ffmpeg process alive');
  assert.strictEqual(ffmpeg._internal.stats().active, 0);
});

test('without ffmpeg, long non-MP3/WAV recordings still end in transcription_too_long', async () => {
  const saved = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = path.join(tmp, 'no-such-ffmpeg-binary');
  ffmpeg._internal.resetAvailability();
  try {
    assert.strictEqual(await ffmpeg.isAvailable(), false);
    const fake = path.join(tmp, 'fake.ogg');
    fs.writeFileSync(fake, Buffer.concat([Buffer.from('OggS'), crypto.randomBytes(LIMIT + 1000)]));
    const ref = encryptInto(SESS_DIR, fake, '.ogg', 'audio/ogg');
    apiCalls.length = 0;
    const r = await transcribeSession(ref);
    assert.strictEqual(r.status, 'transcription_too_long');
    assert.match(r.res.error, /ffmpeg is not available/);
    assert.strictEqual(apiCalls.length, 0);
    assert.deepStrictEqual(tmpLeftovers(), []);
  } finally {
    if (saved === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = saved;
    ffmpeg._internal.resetAvailability();
  }
});
