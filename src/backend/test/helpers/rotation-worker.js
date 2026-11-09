'use strict';
// One phase of the two-key rotation scenario, in its own process (the DB
// module keeps module-level state; a real restart is what we want to test).
// Usage: node rotation_worker.js <phase> <tmpDir>
// Prints a single JSON line "RESULT <json>" on success; exits non-zero on failure.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { SRC, KEY_A, KEY_B, setupEnv, loadLegacy, rowsOf, seedEncryptedColumns } = require('./wave3-o');

const [phase, tmp] = process.argv.slice(2);
const ROT_ENV = { ENCRYPTION_MASTER_KEY: KEY_B, ENCRYPTION_MASTER_KEY_VERSION: '2', ENCRYPTION_MASTER_KEY_PREVIOUS: KEY_A };
const NEW_ONLY_ENV = { ENCRYPTION_MASTER_KEY: KEY_B, ENCRYPTION_MASTER_KEY_VERSION: '2' };
const keyEnv = { seed: {}, crash: ROT_ENV, resume: ROT_ENV, newonly: NEW_ONLY_ENV, wrongprev: { ...ROT_ENV, ENCRYPTION_MASTER_KEY_PREVIOUS: 'not-the-old-key-xxxxxxxxxxxxxxxx' }, badversion: { ENCRYPTION_MASTER_KEY: KEY_B, ENCRYPTION_MASTER_KEY_VERSION: '1', ENCRYPTION_MASTER_KEY_PREVIOUS: undefined }, mixed: {} }[phase];
if (!keyEnv) { console.error('unknown phase ' + phase); process.exit(2); }
setupEnv('rot', { tmp, keyEnv });
if (phase === 'badversion') delete process.env.ENCRYPTION_MASTER_KEY_PREVIOUS;

const EXPECTED = path.join(tmp, 'expected.json');
const FILES_DIR = path.join(tmp, 'files');
const conn = require(path.join(SRC, 'db/connection.js'));

// Written synchronously to a file: the crash phase SIGKILLs itself right after.
function result(obj) { fs.writeFileSync(path.join(tmp, `result-${phase}.json`), JSON.stringify(obj)); }

(async () => {
  await conn.initDatabase();
  const enc = require(path.join(SRC, 'services/encryption.js'));
  const backupService = require(path.join(SRC, 'services/backupService.js'));
  const kr = require(path.join(SRC, 'services/keyRotation.js'));
  require(path.join(SRC, 'services/vectorStore.js')).ensureTable();
  kr.configure({ batchRows: 4, batchPauseMs: 2, fileDirs: [FILES_DIR] });
  const db = () => conn.getDatabase();

  if (phase === 'seed') {
    const expected = seedEncryptedColumns(db(), enc, 9);
    // unlisted column holding ciphertext (found by the schema scan)
    const u = enc.encrypt('unlisted secret value');
    db().run("INSERT INTO platform_settings (key, value) VALUES ('trackO_unlisted', ?)", [u.encrypted]);
    expected.push({ table: 'platform_settings', column: 'value', rowid: db().exec("SELECT rowid FROM platform_settings WHERE key='trackO_unlisted'")[0].values[0][0], plaintext: 'unlisted secret value', unlisted: true });
    // encrypted media: one legacy-format file (v1) and one unrecognised file
    fs.mkdirSync(path.join(FILES_DIR, 'sub'), { recursive: true });
    // media under key A: a legacy-format file, a chunked v1-format file (old
    // key), a damaged chunked file, temp leftovers (*.part) and an unknown file
    const crypto = require('crypto');
    const fc = require(path.join(SRC, 'services/fileCrypto.js'));
    const media = {};
    const legacyBytes = crypto.randomBytes(70000);
    fs.writeFileSync(path.join(FILES_DIR, 'legacy.ogg.enc'), enc.encrypt(legacyBytes.toString('base64')).encrypted);
    media['legacy.ogg.enc'] = crypto.createHash('sha256').update(legacyBytes).digest('hex');
    const v1Bytes = crypto.randomBytes(200000);
    fc.encryptBufferToFileSync(v1Bytes, path.join(FILES_DIR, 'sub', 'chunked.webm.enc'), { contentType: 'audio/webm' });
    media['sub/chunked.webm.enc'] = crypto.createHash('sha256').update(v1Bytes).digest('hex');
    fc.encryptBufferToFileSync(crypto.randomBytes(150000), path.join(FILES_DIR, 'damaged.mp3.enc'), { contentType: 'audio/mpeg' });
    { const p = path.join(FILES_DIR, 'damaged.mp3.enc'); const b = fs.readFileSync(p); b[b.length - 5000] ^= 0xff; fs.writeFileSync(p, b); }
    fs.writeFileSync(path.join(FILES_DIR, 'half.ogg.enc.part'), crypto.randomBytes(1000));
    fs.writeFileSync(path.join(FILES_DIR, 'abc.upload.enc'), crypto.randomBytes(1000));
    fs.writeFileSync(path.join(FILES_DIR, 'sub', 'other.webm.enc.rewrite.part'), crypto.randomBytes(1000));
    fs.writeFileSync(path.join(FILES_DIR, 'sub', 'mystery.bin'), Buffer.from([0, 1, 2, 3, 4]));
    fs.writeFileSync(path.join(FILES_DIR, '.gitkeep'), '');
    // backups: one GCM (wave 3) and one legacy CBC (pre-wave-3 module), both under key A
    const gcm = await backupService.backup();
    assert.ok(gcm.success, gcm.error);
    const cbc = loadLegacy('backupService.head.js').backup();
    assert.ok(cbc.success, cbc.error);
    // a corrupt value (valid layout, wrong tag): must be reported, never changed
    const good = enc.encrypt('will be corrupted').encrypted.split(':');
    const tag = Buffer.from(good[2], 'base64'); tag[0] ^= 0xff; good[2] = tag.toString('base64');
    const corrupt = good.join(':');
    db().run('INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted) VALUES (1, 1, ?)', [corrupt]);
    const corruptRowid = db().exec('SELECT last_insert_rowid()')[0].values[0][0];
    const fingerprintV1 = enc.getKeyFingerprint(1);
    conn.saveDatabaseAfterWrite();
    conn.saveDatabase();
    fs.writeFileSync(EXPECTED, JSON.stringify({ expected, corruptRowid, corrupt, fingerprintV1, backups: [gcm.filename, cbc.filename], media }));
    result({ seeded: expected.length, active: enc.getActiveKeyVersion() });
    process.exit(0);
  }

  if (phase === 'mixed') {
    // No canary yet; oldest rows written with some earlier secret, newest with
    // the configured one: the check must NOT report a false mismatch.
    const crypto = require('crypto');
    const pack = (secret, text) => {
      const key = crypto.pbkdf2Sync(secret, 'prtop-key-v1', 100000, 32, 'sha256');
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
      return ['1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
    };
    const ins = (v) => db().run('INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted) VALUES (1, 1, ?)', [v]);
    for (let i = 0; i < 12; i++) ins(pack('an-earlier-secret-xxxxxxxxxxxxxx', 'old ' + i));
    ins(pack(KEY_A, 'new 1'));
    ins(pack(KEY_A, 'new 2'));
    db().run('UPDATE encryption_keys SET key_check = NULL');
    enc.reloadKeyRing(process.env);
    const mixedCheck = enc.verifyKeyVersion(1);
    // all rows from a foreign secret -> mismatch; enforce refuses, warn allows
    db().run('DELETE FROM therapist_notes WHERE note_encrypted IN (SELECT note_encrypted FROM therapist_notes ORDER BY rowid DESC LIMIT 2)');
    db().run('UPDATE encryption_keys SET key_check = NULL');
    enc.reloadKeyRing(process.env);
    const foreignCheck = enc.verifyKeyVersion(1);
    let enforceErr = null;
    try { enc.encrypt('x'); } catch (e) { enforceErr = e.code; }
    process.env.ENCRYPTION_KEY_CHECK = 'warn';
    let warnOk = false;
    try { warnOk = enc.decrypt(enc.encrypt('written in warn mode').encrypted) === 'written in warn mode'; } catch (e) { warnOk = e.message; }
    result({ mixedCheck, foreignCheck, enforceErr, warnOk });
    process.exit(0);
  }

  const exp = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));

  if (phase === 'wrongprev') {
    // Wrong previous key: v1 check reports mismatch; the job re-encrypts nothing.
    const st = await kr.getRotationStatus();
    const v1 = st.keys.find((k) => k.key_version === 1);
    const before = st.inventory.column_values_outdated;
    const { job } = kr.startReencryption({ actorId: 1 });
    await kr.waitForIdle();
    const after = await kr.getRotationStatus();
    // Nothing changed: every value still exactly as seeded with key A
    const untouched = exp.expected.every((e) => {
      const v = rowsOf(db(), `SELECT "${e.column}" AS v FROM "${e.table}" WHERE rowid = ?`, [e.rowid])[0].v;
      return enc.getPackedKeyVersion(v) === 1;
    });
    result({ v1check: v1.key_check, v1source: v1.key_source, before, after: after.inventory.column_values_outdated, status: after.job.status, reenc: after.job.stats.values_reencrypted, failed: after.job.stats.values_failed, untouched, jobId: job.id });
    process.exit(0); // DB of this phase is discarded by the caller (copy)
  }

  if (phase === 'badversion') {
    // New secret declared as version 1 (wrong): key check must refuse writes.
    let encErr = null;
    try { enc.encrypt('x'); } catch (e) { encErr = e.code; }
    let startErr = null;
    try { kr.startReencryption({}); } catch (e) { startErr = e.code; }
    let readErr = null;
    try { enc.decrypt(exp.expected[0] && rowsOf(db(), `SELECT "${exp.expected[0].column}" AS v FROM "${exp.expected[0].table}" WHERE rowid = ?`, [exp.expected[0].rowid])[0].v); } catch (e) { readErr = e.message; }
    result({ encErr, startErr, check: enc.verifyKeyVersion(1), readFailed: !!readErr });
    process.exit(0);
  }

  if (phase === 'crash') {
    const active = enc.getActiveKeyVersion();
    const keys = enc.listKeyVersions();
    const st = await kr.getRotationStatus();
    const newCt = enc.encrypt('written after rotation').encrypted;
    const before = {
      active, keys: keys.map((k) => [k.key_version, k.status, k.key_source, k.key_check]),
      fingerprintV1: enc.getKeyFingerprint(1), newVersion: enc.getPackedKeyVersion(newCt),
      outdated: st.inventory.column_values_outdated, unlisted: st.inventory.unlisted_columns_with_ciphertext,
      backupsOutdated: st.inventory.backups.outdated, files: st.inventory.files, safe: st.safe_to_retire_previous,
      listedCovered: enc.ENCRYPTED_COLUMNS.every((c) => st.inventory.columns.some((x) => x.table === c.table && x.column === c.column && x.listed && x.outdated > 0)),
    };
    kr.startReencryption({ actorId: 1 });
    // Hard crash once part of the work is done: flush what the job committed so
    // far (as the debounced save would) and kill the process without cleanup.
    const timer = setInterval(() => {
      const j = rowsOf(db(), 'SELECT stats_json FROM encryption_rotation_jobs ORDER BY id DESC LIMIT 1')[0];
      const n = JSON.parse(j.stats_json).values_reencrypted || 0;
      if (n >= 40 && !conn.inOpenTransaction()) {
        clearInterval(timer);
        conn.saveDatabase();
        result({ before, reencryptedAtCrash: n });
        process.kill(process.pid, 'SIGKILL');
      }
    }, 1);
    return;
  }

  if (phase === 'resume') {
    const st0 = await kr.getRotationStatus();
    const atStart = { status: st0.job.status, interrupted: st0.job.interrupted, reenc: st0.job.stats.values_reencrypted, outdated: st0.inventory.column_values_outdated };
    assert.ok(kr.resumeInterruptedJob(), 'resumed');
    await kr.waitForIdle();
    const st1 = await kr.getRotationStatus();
    const first = {
      status: st1.job.status, failed: st1.job.stats.values_failed, failures: st1.job.stats.failures,
      remaining: st1.job.stats.remaining, backups: st1.job.stats.backups, files: st1.inventory.files, filesJob: st1.job.stats.files_reencrypt,
      outdated: st1.inventory.column_values_outdated, safe: st1.safe_to_retire_previous,
      backupFormats: st1.inventory.backups.by_format,
    };
    // Operator fixes what is left: delete the corrupt row, the legacy media file is
    // upgraded (simulated by removing it), the mystery file removed. Then re-run.
    const corruptStill = rowsOf(db(), 'SELECT note_encrypted AS v FROM therapist_notes WHERE rowid = ?', [exp.corruptRowid])[0].v === exp.corrupt;
    db().run('DELETE FROM therapist_notes WHERE rowid = ?', [exp.corruptRowid]);
    // a boot migration copies therapist_notes into comments: remove that copy too
    db().run('DELETE FROM comments WHERE content_encrypted = ?', [exp.corrupt]);
    conn.saveDatabaseAfterWrite();
    fs.rmSync(path.join(FILES_DIR, 'damaged.mp3.enc'));
    fs.rmSync(path.join(FILES_DIR, 'sub', 'mystery.bin'));
    kr.configure({ fileDirs: [FILES_DIR] }); // drop caches
    // A backup taken now (live data fully on v2) must carry data-v2 in its header
    const fresh = await backupService.backup();
    kr.startReencryption({ actorId: 1 });
    await kr.waitForIdle();
    const st2 = await kr.getRotationStatus();
    // Verify every seeded value: right plaintext, on v2
    const bad = [];
    for (const e of exp.expected) {
      const v = rowsOf(db(), `SELECT "${e.column}" AS v FROM "${e.table}" WHERE rowid = ?`, [e.rowid])[0].v;
      let pt = null; try { pt = enc.decrypt(v); } catch (err) { pt = 'ERR ' + err.message; }
      if (pt !== e.plaintext || enc.getPackedKeyVersion(v) !== 2) bad.push({ ...e, got: pt, ver: enc.getPackedKeyVersion(v) });
    }
    // key-id metadata now points at v2's row
    const v2id = enc.getKeyId(2);
    const kidStale = rowsOf(db(), 'SELECT COUNT(*) AS n FROM diary_entries WHERE encryption_key_id IS NOT ? ', [v2id])[0].n +
      rowsOf(db(), 'SELECT COUNT(*) AS n FROM assignment_reports WHERE therapist_comment_key_id IS NOT ?', [v2id])[0].n +
      rowsOf(db(), "SELECT COUNT(*) AS n FROM users WHERE custom_summary_prompt_encrypted IS NOT NULL AND custom_summary_prompt_key_id IS NOT ?", [v2id])[0].n;
    const jobs = rowsOf(db(), 'SELECT id, status FROM encryption_rotation_jobs ORDER BY id');
    const audits = rowsOf(db(), "SELECT action FROM audit_logs WHERE action LIKE 'key_rotation_%' ORDER BY id").map((r) => r.action);
    conn.saveDatabase();
    result({
      atStart, first, corruptStill, freshBackup: backupService.listBackups().backups.find((b) => b.filename === fresh.filename),
      final: { status: st2.job.status, outdated: st2.inventory.column_values_outdated, backups: st2.inventory.backups, files: st2.inventory.files, safe: st2.safe_to_retire_previous, keys: st2.keys.map((k) => [k.key_version, k.status, k.key_source, k.key_check]) },
      bad, kidStale, jobs, audits,
    });
    process.exit(0);
  }

  if (phase === 'newonly') {
    // Only key B configured: everything must still be readable, and every backup
    // must restore to a database whose Class A values open with B alone.
    const bad = [];
    const checkAll = (label) => {
      for (const e of exp.expected) {
        const row = rowsOf(db(), `SELECT "${e.column}" AS v FROM "${e.table}" WHERE rowid = ?`, [e.rowid])[0];
        if (!row) continue; // rows created after a backup's snapshot are absent from it
        let pt; try { pt = enc.decrypt(row.v); } catch (err) { pt = 'ERR ' + err.message; }
        if (pt !== e.plaintext) bad.push({ label, ...e, got: pt });
      }
    };
    checkAll('live');
    let v1Err = null;
    try { enc.deriveSubKey(1, 'backup'); } catch (e) { v1Err = e.code; }
    const restored = [];
    const names = backupService.listBackups().backups.map((b) => b.filename);
    for (const name of exp.backups) {
      const r = await backupService.restore(name);
      restored.push({ name, success: r.success, format: r.format, error: r.error });
      if (r.success) {
        checkAll('restored ' + name);
        // Class A values inside the restored image: any left on v1?
        const kr2 = require(path.join(SRC, 'services/keyRotation.js'));
        const inv = kr2.inventoryColumns(db(), kr2.discoverTargets(db()), 2);
        restored[restored.length - 1].minVersion = inv.minVersion;
        restored[restored.length - 1].active = enc.getActiveKeyVersion();
        restored[restored.length - 1].canWrite = (() => { try { enc.encrypt('x'); return true; } catch (e) { return e.code; } })();
      }
    }
    const fc = require(path.join(SRC, 'services/fileCrypto.js'));
    const crypto = require('crypto');
    const played = {};
    for (const [rel, digest] of Object.entries(exp.media)) {
      const p = path.join(FILES_DIR, ...rel.split('/'));
      try {
        const info = await fc.readFileInfo(p);
        const { buffer: buf } = await fc.readFileToBuffer(p);
        played[rel] = { ok: crypto.createHash('sha256').update(buf).digest('hex') === digest, format: info.format, keyVersion: info.keyVersion };
      } catch (e) { played[rel] = { ok: false, error: e.code || e.message }; }
    }
    const leftovers = fs.readdirSync(FILES_DIR).concat(fs.readdirSync(path.join(FILES_DIR, 'sub')));
    result({ bad, v1Err, restored, names, played, leftovers });
    process.exit(0);
  }
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
