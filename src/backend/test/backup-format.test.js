'use strict';
require('./helpers/exit');
// Track O (M15): backup format, legacy CBC restore, async gzip, single export,
// off-site hook; plus field-encryption backward compatibility.
// Run: node --test test_trackO_backup.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { SRC, KEY_A, setupEnv, loadLegacy, rowsOf } = require('./helpers/wave3-o');

const env = setupEnv('backup');
const conn = require(path.join(SRC, 'db/connection.js'));
let enc;
let backupService;
let legacyEnc;
let legacyBackup;

test.before(async () => {
  await conn.initDatabase();
  enc = require(path.join(SRC, 'services/encryption.js'));
  backupService = require(path.join(SRC, 'services/backupService.js'));
  legacyEnc = loadLegacy('encryption.head.js');
  legacyBackup = loadLegacy('backupService.head.js');
});

function noteCount(marker) {
  const db = conn.getDatabase();
  return rowsOf(db, 'SELECT note_encrypted FROM therapist_notes').filter((r) => {
    try { return enc.decrypt(r.note_encrypted) === marker; } catch (e) { return false; }
  }).length;
}

function addNote(text) {
  const db = conn.getDatabase();
  const e = enc.encrypt(text);
  db.run('INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted, encryption_key_id) VALUES (1, 1, ?, ?)', [e.encrypted, e.keyId]);
  conn.saveDatabaseAfterWrite();
}

test('field ciphertext is unchanged: old <-> new interoperate', () => {
  const oldCt = legacyEnc.encrypt('written by the pre-wave-3 module').encrypted;
  assert.strictEqual(enc.decrypt(oldCt), 'written by the pre-wave-3 module');
  const newCt = enc.encrypt('written by the wave-3 module').encrypted;
  assert.strictEqual(legacyEnc.decrypt(newCt), 'written by the wave-3 module');
  assert.ok(enc.isEncryptedValue(newCt));
  assert.strictEqual(enc.getPackedKeyVersion(newCt), 1);
  // Independent re-implementation of the historical derivation.
  const key = crypto.pbkdf2Sync(KEY_A, 'prtop-key-v1', 100000, 32, 'sha256');
  const [, iv, tag, ct] = newCt.split(':');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  assert.strictEqual(Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8'), 'written by the wave-3 module');
});

test('purpose keys are HKDF-separated from each other and from the field key', () => {
  const field = crypto.pbkdf2Sync(KEY_A, 'prtop-key-v1', 100000, 32, 'sha256');
  const b1 = enc.deriveSubKey(1, enc.KEY_PURPOSE.BACKUP);
  const f1 = enc.deriveSubKey(1, enc.KEY_PURPOSE.FILE);
  const b2 = enc.deriveSubKey(2, enc.KEY_PURPOSE.BACKUP);
  assert.strictEqual(b1.length, 32);
  assert.ok(!b1.equals(f1) && !b1.equals(field) && !f1.equals(field) && !b1.equals(b2));
  assert.ok(b1.equals(enc.deriveSubKey(1, 'backup')), 'deterministic');
  b1.fill(0);
  assert.ok(!enc.deriveSubKey(1, 'backup').equals(b1), 'returns a copy (cache not mutable)');
  assert.throws(() => enc.deriveSubKey(1, 'Bad Purpose'));
  assert.throws(() => enc.deriveSubKey(0, 'backup'));
});

test('GCM backup round-trip, header, tamper detection', async () => {
  addNote('round-trip marker');
  const res = await backupService.backup();
  assert.strictEqual(res.success, true, res.error);
  assert.strictEqual(res.format, 'gcm-v1');
  assert.strictEqual(res.key_version, 1);
  const file = path.join(env.tmp, 'backups', res.filename);
  const data = fs.readFileSync(file);
  assert.strictEqual(data.subarray(0, 8).toString('ascii'), 'PRTOPBAK');
  assert.strictEqual(data.readUInt8(8), 1);
  assert.strictEqual(data.readUInt32BE(9), 1);
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  const listed = backupService.listBackups().backups.find((b) => b.filename === res.filename);
  assert.deepStrictEqual([listed.format, listed.key_version], ['gcm-v1', 1]);

  // Tampered copies (body byte, header key-version byte) are rejected; DB untouched.
  const db = conn.getDatabase();
  db.run("DELETE FROM therapist_notes");
  conn.saveDatabaseAfterWrite();
  assert.strictEqual(noteCount('round-trip marker'), 0);
  const preRestoreBefore = fs.readdirSync(path.join(env.tmp, 'backups')).filter((f) => f.startsWith('pre_restore_')).length;
  for (const [offset, label] of [[data.length - 40, 'body'], [12, 'header'], [data.length - 1, 'tag']]) {
    const bad = Buffer.from(data);
    bad[offset] ^= 0x01;
    const name = `prtop_backup_tampered_${label}.db.gz.enc`;
    fs.writeFileSync(path.join(env.tmp, 'backups', name), bad);
    const r = await backupService.restore(name);
    assert.strictEqual(r.success, false, `${label} tamper must fail`);
    fs.unlinkSync(path.join(env.tmp, 'backups', name));
  }
  // Truncation
  const trunc = 'prtop_backup_truncated.db.gz.enc';
  fs.writeFileSync(path.join(env.tmp, 'backups', trunc), data.subarray(0, data.length - 100));
  assert.strictEqual((await backupService.restore(trunc)).success, false);
  fs.unlinkSync(path.join(env.tmp, 'backups', trunc));
  assert.strictEqual(fs.readdirSync(path.join(env.tmp, 'backups')).filter((f) => f.startsWith('pre_restore_')).length, preRestoreBefore,
    'no safety backup for a rejected file');

  const r = await backupService.restore(res.filename);
  assert.strictEqual(r.success, true, r.error);
  assert.strictEqual(r.format, 'gcm-v1');
  assert.ok(r.safety_backup && r.safety_backup.startsWith('pre_restore_'));
  assert.strictEqual(noteCount('round-trip marker'), 1, 'restored data decrypts');
  // the safety backup itself is a valid GCM backup
  const safety = backupService.listBackups().backups.find((b) => b.filename === r.safety_backup);
  assert.strictEqual(safety.format, 'gcm-v1');
});

test('legacy AES-CBC backup (pre-wave-3 module) still restores', async () => {
  addNote('legacy cbc marker');
  const old = legacyBackup.backup(); // the HEAD implementation, sync, CBC
  assert.strictEqual(old.success, true, old.error);
  const listed = backupService.listBackups().backups.find((b) => b.filename === old.filename);
  assert.strictEqual(listed.format, 'legacy-cbc');
  conn.getDatabase().run('DELETE FROM therapist_notes');
  conn.saveDatabaseAfterWrite();
  const r = await backupService.restore(old.filename);
  assert.strictEqual(r.success, true, r.error);
  assert.strictEqual(r.format, 'legacy-cbc');
  assert.strictEqual(noteCount('legacy cbc marker'), 1);

  // A CBC file under a key we do not hold fails cleanly.
  const iv = crypto.randomBytes(16);
  const k = crypto.createHash('sha256').update('some-other-master-key-zzzzzzzz').digest();
  const c = crypto.createCipheriv('aes-256-cbc', k, iv);
  const foreign = Buffer.concat([iv, c.update(zlib.gzipSync(Buffer.from('SQLite format 3\0' + 'x'.repeat(200), 'latin1'))), c.final()]);
  fs.writeFileSync(path.join(env.tmp, 'backups', 'prtop_backup_foreign.db.gz.enc'), foreign);
  const f = await backupService.restore('prtop_backup_foreign.db.gz.enc');
  assert.strictEqual(f.success, false);
  assert.match(f.error, /Decryption failed/);
  fs.unlinkSync(path.join(env.tmp, 'backups', 'prtop_backup_foreign.db.gz.enc'));
});

test('async gzip, a single export, no event-loop blocking gzipSync', async () => {
  const origGzipSync = zlib.gzipSync;
  let gzipSyncCalls = 0;
  zlib.gzipSync = (...a) => { gzipSyncCalls++; return origGzipSync(...a); };
  const db = conn.getDatabase();
  const origExport = db.export.bind(db);
  let exports = 0;
  db.export = (...a) => { exports++; return origExport(...a); };
  try {
    let tickRan = false;
    const p = backupService.backup();
    assert.ok(p && typeof p.then === 'function', 'backup() returns a Promise');
    setImmediate(() => { tickRan = true; });
    const res = await p;
    assert.strictEqual(res.success, true, res.error);
    assert.ok(tickRan, 'event loop ran while the backup was in progress');
    assert.strictEqual(gzipSyncCalls, 0, 'gzipSync not used');
    assert.strictEqual(exports, 1, 'exactly one db.export() per backup');
  } finally {
    zlib.gzipSync = origGzipSync;
    delete db.export;
  }
  // concurrent backups serialise and both succeed
  const [a, b] = await Promise.all([backupService.backup(), backupService.backup()]);
  assert.ok(a.success && b.success && a.filename !== b.filename);
});

test('restore rejects bad filenames before touching the filesystem', async () => {
  for (const name of ['../x.db.gz.enc', 'a/b.db.gz.enc', 'notes.txt', '', null, 'x\\y.db.gz.enc']) {
    const r = await backupService.restore(name);
    assert.deepStrictEqual(r, { success: false, error: 'Invalid filename' }, String(name));
  }
});

test('off-site hook: path argument, scrubbed env, timeout, never blocks', async () => {
  const hookDir = path.join(env.tmp, 'hook');
  fs.mkdirSync(hookDir, { recursive: true });
  const recorder = path.join(hookDir, 'record.js');
  const outFile = path.join(hookDir, 'out.json');
  fs.writeFileSync(recorder, `require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify({
    argv: process.argv.slice(2), backupFile: process.env.BACKUP_FILE,
    hasJwt: !!process.env.JWT_SECRET, hasMaster: !!process.env.ENCRYPTION_MASTER_KEY, hasPath: !!(process.env.PATH || process.env.Path),
    present: ["AI_API_KEY","GOOGLE_AI_API_KEY","TRANSCRIPTION_API_KEY","TURNSTILE_SECRET","UMAMI_DB_PASSWORD","UMAMI_APP_SECRET","SMTP_PASS","LOGIN_CODE_PEPPER","STRIPE_PRICE_PRO","RCLONE_CONFIG_REMOTE_PASS","AWS_SECRET_ACCESS_KEY","SSH_AUTH_SOCK","B2_APPLICATION_KEY","GOOGLE_APPLICATION_CREDENTIALS","TZ"].filter((k) => process.env[k] !== undefined)
  }));`);
  const sleeper = path.join(hookDir, 'sleep.js');
  fs.writeFileSync(sleeper, 'setTimeout(() => {}, 60000);');
  const nodeCmd = `"${process.execPath}"`;

  assert.deepStrictEqual(await backupService.runOffsiteHook('/x', { command: '' }), { skipped: true, reason: 'not_configured' });

  const target = path.join(env.tmp, 'backups', 'name with space.db.gz.enc');
  const planted = { AI_API_KEY: 'x', GOOGLE_AI_API_KEY: 'x', TRANSCRIPTION_API_KEY: 'x', TURNSTILE_SECRET: 'x', UMAMI_DB_PASSWORD: 'x', UMAMI_APP_SECRET: 'x', SMTP_PASS: 'x', STRIPE_PRICE_PRO: 'x',
    RCLONE_CONFIG_REMOTE_PASS: 'x', AWS_SECRET_ACCESS_KEY: 'x', SSH_AUTH_SOCK: 'x', B2_APPLICATION_KEY: 'x', GOOGLE_APPLICATION_CREDENTIALS: 'x', TZ: 'UTC' };
  Object.assign(process.env, planted);
  const ok = await backupService.runOffsiteHook(target, { command: `${nodeCmd} "${recorder}"`, timeoutMs: 20000 });
  assert.strictEqual(ok.ok, true, JSON.stringify(ok));
  const rec = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.deepStrictEqual(rec.argv, [target], 'path passed as a single last argument');
  assert.strictEqual(rec.backupFile, target);
  assert.strictEqual(rec.hasJwt, false, 'JWT_SECRET scrubbed');
  assert.strictEqual(rec.hasMaster, false, 'ENCRYPTION_MASTER_KEY scrubbed');
  assert.strictEqual(rec.hasPath, true);
  assert.deepStrictEqual(rec.present.sort(), ['AWS_SECRET_ACCESS_KEY', 'B2_APPLICATION_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'RCLONE_CONFIG_REMOTE_PASS', 'SSH_AUTH_SOCK', 'TZ'],
    'secret-looking names scrubbed, copy-tool credentials and harmless vars kept');
  for (const k of Object.keys(planted)) delete process.env[k];

  const failing = await backupService.runOffsiteHook(target, { command: `${nodeCmd} -e "process.exit(3)"` });
  assert.strictEqual(failing.ok, false);
  assert.strictEqual(failing.code, 3);

  const t0 = Date.now();
  const slow = await backupService.runOffsiteHook(target, { command: `${nodeCmd} "${sleeper}"`, timeoutMs: 700 });
  assert.strictEqual(slow.ok, false);
  assert.strictEqual(slow.timedOut, true);
  assert.ok(Date.now() - t0 < 10000, 'killed promptly');

  // Through backup(): the hook runs after the file exists, backup() does not wait for it.
  fs.rmSync(outFile, { force: true });
  process.env.BACKUP_OFFSITE_COMMAND = `${nodeCmd} "${recorder}"`;
  try {
    const res = await backupService.backup();
    assert.strictEqual(res.success, true);
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(outFile) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    const rec2 = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    assert.strictEqual(path.basename(rec2.argv[0]), res.filename);
    // wait for the hook to settle, then status reports it
    const d2 = Date.now() + 10000;
    while (backupService.getBackupStatus().offsite.running && Date.now() < d2) await new Promise((r) => setTimeout(r, 50));
    const st = backupService.getBackupStatus();
    assert.strictEqual(st.offsite.configured, true);
    assert.strictEqual(st.offsite.last_result.file, res.filename);
    assert.strictEqual(st.offsite.last_result.ok, true);

    // A hook that hangs does not delay backup().
    process.env.BACKUP_OFFSITE_COMMAND = `${nodeCmd} "${sleeper}"`;
    process.env.BACKUP_OFFSITE_TIMEOUT_MS = '1500';
    const t1 = Date.now();
    const res2 = await backupService.backup();
    assert.strictEqual(res2.success, true);
    assert.ok(Date.now() - t1 < 1400, 'backup returned before the hook finished');
    const d3 = Date.now() + 10000;
    while (backupService.getBackupStatus().offsite.running && Date.now() < d3) await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(backupService.getBackupStatus().offsite.last_result.timed_out, true);
  } finally {
    delete process.env.BACKUP_OFFSITE_COMMAND;
    delete process.env.BACKUP_OFFSITE_TIMEOUT_MS;
  }
});

test.after(() => {
  process.chdir(require('os').tmpdir());
  try { fs.rmSync(env.tmp, { recursive: true, force: true }); } catch (e) { /* windows: db file may be busy */ }
});
