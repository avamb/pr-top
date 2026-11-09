'use strict';
require('./helpers/exit');
// Track O (M16): master-key rotation with two keys, across real process
// restarts (rotation_worker.js runs each phase in its own process).
//   seed      key A: every listed Class A column (9 rows each), an unlisted
//             column with ciphertext, a corrupt value, legacy media file,
//             GCM + legacy CBC backups
//   crash     key B (v2) + PREVIOUS=A: start the job, SIGKILL mid-way
//   resume    same env: job is "interrupted", resumes from its cursor, ends
//             completed_with_errors (corrupt value); operator cleans up; re-run
//             -> completed, v1 retired, safe_to_retire_previous
//   newonly   key B only: all data readable, both old backups restore to
//             databases whose Class A values open with B alone
//   wrongprev wrong PREVIOUS: mismatch reported, nothing modified
//   badversion new secret declared as v1: writes refused (fail closed)
// Run: node --test test_trackO_rotation.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const WORKER = path.join(__dirname, 'helpers', 'rotation-worker.js');

function phase(name, dir, { expectCrash = false } = {}) {
  const r = spawnSync(process.execPath, [WORKER, name, dir], { encoding: 'utf8', timeout: 240000 });
  const file = path.join(dir, `result-${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`phase ${name} produced no result (exit ${r.status} ${r.signal})\n${r.stdout}\n${r.stderr}`);
  }
  if (!expectCrash) assert.strictEqual(r.status, 0, `phase ${name} exit ${r.status}\n${r.stderr}`);
  else assert.notStrictEqual(r.status, 0, 'crash phase must die abnormally');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prtop-trackO-rotation-'));
const main = path.join(root, 'main');
const wrong = path.join(root, 'wrongprev');
const bad = path.join(root, 'badversion');
fs.mkdirSync(main);

let seed;
let expected;

test('seed with key A', () => {
  seed = phase('seed', main);
  expected = JSON.parse(fs.readFileSync(path.join(main, 'expected.json'), 'utf8'));
  assert.strictEqual(seed.active, 1);
  assert.ok(expected.expected.length >= 9 * 23, 'every listed column seeded');
  fs.cpSync(main, wrong, { recursive: true });
  fs.cpSync(main, bad, { recursive: true });
});

test('wrong previous key: mismatch reported, nothing modified', () => {
  const backupsBefore = Object.fromEntries(fs.readdirSync(path.join(wrong, 'backups')).map((f) => [f, sha(path.join(wrong, 'backups', f))]));
  const r = phase('wrongprev', wrong);
  assert.strictEqual(r.v1source, 'previous');
  assert.strictEqual(r.v1check, 'mismatch');
  assert.strictEqual(r.reenc, 0);
  assert.strictEqual(r.failed, r.before, 'every old value reported as failed');
  assert.strictEqual(r.after, r.before);
  assert.strictEqual(r.untouched, true);
  assert.strictEqual(r.status, 'completed_with_errors');
  for (const [f, h] of Object.entries(backupsBefore)) {
    assert.strictEqual(sha(path.join(wrong, 'backups', f)), h, `backup ${f} untouched`);
  }
});

test('new secret wrongly declared as v1: fail closed', () => {
  const r = phase('badversion', bad);
  assert.strictEqual(r.check, 'mismatch');
  assert.strictEqual(r.encErr, 'KEY_CHECK_FAILED');
  assert.strictEqual(r.startErr, 'KEY_CHECK_FAILED');
  assert.strictEqual(r.readFailed, true);
});

test('key check: no false mismatch on mixed history; ENCRYPTION_KEY_CHECK=warn escape hatch', () => {
  const dir = path.join(root, 'mixed');
  fs.mkdirSync(dir);
  const r = phase('mixed', dir);
  assert.strictEqual(r.mixedCheck, 'ok', 'newest rows decrypt -> ok');
  assert.strictEqual(r.foreignCheck, 'mismatch');
  assert.strictEqual(r.enforceErr, 'KEY_CHECK_FAILED');
  assert.strictEqual(r.warnOk, true);
});

let crash;
test('rotate to key B (v2), job killed mid-way', () => {
  crash = phase('crash', main, { expectCrash: true });
  const b = crash.before;
  assert.strictEqual(b.active, 2, 'active version advanced to ENCRYPTION_MASTER_KEY_VERSION');
  assert.deepStrictEqual(b.keys, [[1, 'rotated', 'previous', 'ok'], [2, 'active', 'current', 'ok']]);
  assert.strictEqual(b.fingerprintV1, expected.fingerprintV1, 'PREVIOUS key fingerprint matches the old current key');
  assert.strictEqual(b.newVersion, 2, 'new writes use v2');
  assert.ok(b.listedCovered, 'every ENCRYPTED_COLUMNS entry has old-version values');
  assert.deepStrictEqual(b.unlisted, ['platform_settings.value'], 'schema scan finds the unlisted column');
  assert.strictEqual(b.backupsOutdated, 2);
  // legacy + chunked + damaged chunked on v1; mystery.bin unknown; *.part leftovers and dotfiles not counted
  assert.deepStrictEqual([b.files.legacy, b.files.chunked, b.files.unknown, b.files.outdated, b.files.total], [{ 1: 1 }, { 1: 2 }, 1, 3, 4]);
  assert.deepStrictEqual(b.files.unknown_files, ['0:sub/mystery.bin']);
  assert.strictEqual(b.safe, false);
  assert.ok(crash.reencryptedAtCrash >= 40 && crash.reencryptedAtCrash < b.outdated);
});

let resume;
test('resume after restart, finish, clean up, re-run to completion', () => {
  resume = phase('resume', main);
  const s = resume.atStart;
  assert.strictEqual(s.status, 'running');
  assert.strictEqual(s.interrupted, true);
  assert.ok(s.reenc >= 40, 'progress before the crash was persisted');
  assert.strictEqual(s.outdated, crash.before.outdated - s.reenc, 'resumes where it stopped');

  const f = resume.first;
  assert.strictEqual(f.status, 'completed_with_errors');
  // the corrupt note and its copy in comments (boot migration) are reported, not changed
  assert.strictEqual(f.failed, 2, 'DB value failures (file failures counted separately)');
  assert.ok(f.failures.filter((x) => !x.file).every((x) => x.key_version === 1 && /authenticate/.test(x.error)));
  assert.ok(f.failures.some((x) => x.table === 'therapist_notes' && x.rowid === expected.corruptRowid));
  assert.strictEqual(resume.corruptStill, true, 'corrupt value left byte-identical');
  assert.deepStrictEqual(f.remaining, { column_values: 2, backups: 0, files: 1, files_unknown: 1 });
  // media: legacy + chunked re-encrypted, the damaged file fails and the job carries on
  // skipped = mystery.bin (unknown format: never handed to reencryptFile)
  assert.deepStrictEqual(f.filesJob, { reencrypted: 2, failed: 1, skipped: 1 });
  const ff = f.failures.filter((x) => x.file);
  assert.strictEqual(ff.length, 1);
  assert.strictEqual(ff[0].file, '0:damaged.mp3.enc');
  assert.strictEqual(ff[0].key_version, 1);
  assert.deepStrictEqual([f.files.legacy, f.files.chunked, f.files.outdated], [{}, { 1: 1, 2: 2 }, 1]);
  assert.deepStrictEqual(f.backups, { rewrapped: 2, failed: 0, skipped: 0, errors: [] });
  assert.deepStrictEqual(f.backupFormats, { 'gcm-v1:v2/data-v2': 2 }, 'legacy CBC + v1 GCM backups re-encrypted, contents included');
  assert.strictEqual(f.safe, false);

  assert.strictEqual(resume.freshBackup.key_version, 2);
  assert.strictEqual(resume.freshBackup.data_key_version_min, 2);

  const fin = resume.final;
  assert.strictEqual(fin.status, 'completed');
  assert.strictEqual(fin.outdated, 0);
  assert.strictEqual(fin.backups.outdated, 0);
  assert.strictEqual(fin.files.outdated, 0);
  assert.deepStrictEqual([fin.files.chunked, fin.files.legacy, fin.files.unknown], [{ 2: 2 }, {}, 0]);
  assert.strictEqual(fin.safe, true);
  assert.deepStrictEqual(fin.keys, [[1, 'retired', 'previous', 'ok'], [2, 'active', 'current', 'ok']]);
  assert.deepStrictEqual(resume.bad, [], 'every seeded value decrypts to its plaintext and is on v2');
  assert.strictEqual(resume.kidStale, 0, 'key-id metadata points at v2');
  assert.deepStrictEqual(resume.audits, ['key_rotation_started', 'key_rotation_resumed', 'key_rotation_completed', 'key_rotation_started', 'key_rotation_completed']);
});

test('previous key retired: everything readable with key B alone, old backups restore', () => {
  const r = phase('newonly', main);
  assert.deepStrictEqual(r.bad, []);
  assert.strictEqual(r.v1Err, 'KEY_VERSION_UNAVAILABLE', 'v1 really is gone');
  assert.strictEqual(r.restored.length, 2);
  // every media file plays with key B alone, now chunked v1-format on key v2
  for (const [rel, p] of Object.entries(r.played)) {
    assert.deepStrictEqual(p, { ok: true, format: 'v1', keyVersion: 2 }, rel);
  }
  assert.strictEqual(Object.keys(r.played).length, 2);
  assert.ok(r.leftovers.includes('half.ogg.enc.part') && r.leftovers.includes('abc.upload.enc') && r.leftovers.includes('other.webm.enc.rewrite.part'), 'leftovers were skipped, not touched');
  for (const x of r.restored) {
    assert.strictEqual(x.success, true, x.error);
    assert.strictEqual(x.format, 'gcm-v1');
    assert.strictEqual(x.minVersion, 2, 'no v1 value inside the restored image');
    assert.strictEqual(x.active, 2);
    assert.strictEqual(x.canWrite, true);
  }
});

test.after(() => {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* best effort */ }
});
