'use strict';
require('./helpers/exit');
// Track O: HTTP surface of the rotation and backup routes (routers mounted on
// a throwaway express app; Bearer JWT as in the other suites), plus the
// explicit encrypted-column list vs the live schema, and key-ring config errors.
// Run: node --test test_trackO_routes.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const http = require('http');
const { SRC, BACKEND, KEY_A, setupEnv, rowsOf } = require('./helpers/wave3-o');

const env = setupEnv('routes');
const dep = (m) => require(require.resolve(m, { paths: [BACKEND] }));
const conn = require(path.join(SRC, 'db/connection.js'));
let server;
let port;
let tk;

function req(method, url, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, method, path: url, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
    } }, (res) => {
      let s = '';
      res.on('data', (c) => { s += c; });
      res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (e) { j = s; } resolve({ status: res.statusCode, body: j }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

test.before(async () => {
  await conn.initDatabase();
  const db = conn.getDatabase();
  db.run("INSERT INTO users (email, password_hash, role) VALUES ('t@x.local', 'x', 'therapist')");
  const T = db.exec("SELECT id FROM users WHERE email='t@x.local'")[0].values[0][0];
  const SA = db.exec("SELECT id FROM users WHERE role='superadmin'")[0].values[0][0];
  const jwt = dep('jsonwebtoken');
  const sign = (id, role) => jwt.sign({ userId: id, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  tk = { T: sign(T, 'therapist'), SA: sign(SA, 'superadmin') };
  const express = dep('express');
  const app = express();
  app.use(express.json());
  app.use('/api/encryption', require(path.join(SRC, 'routes/encryption.js')));
  app.use('/api/admin', require(path.join(SRC, 'routes/admin.js')));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  port = server.address().port;
  // some data on v1
  const enc = require(path.join(SRC, 'services/encryption.js'));
  for (let i = 0; i < 5; i++) {
    db.run('INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted) VALUES (?, ?, ?)', [T, 1, enc.encrypt('note ' + i).encrypted]);
  }
  require(path.join(SRC, 'services/keyRotation.js')).configure({ fileDirs: [path.join(env.tmp, 'nofiles')], batchPauseMs: 0 });
});

test.after(() => { if (server) server.close(); });

test('explicit ENCRYPTED_COLUMNS covers every *_encrypted column of the schema', () => {
  const enc = require(path.join(SRC, 'services/encryption.js'));
  require(path.join(SRC, 'services/vectorStore.js')).ensureTable();
  const db = conn.getDatabase();
  const listed = new Set(enc.ENCRYPTED_COLUMNS.map((c) => `${c.table}.${c.column}`));
  const missing = [];
  const tables = rowsOf(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
  for (const t of tables) {
    for (const c of rowsOf(db, `PRAGMA table_info("${t}")`)) {
      if (/_encrypted$/.test(c.name) && !listed.has(`${t}.${c.name}`)) missing.push(`${t}.${c.name}`);
    }
  }
  assert.deepStrictEqual(missing, []);
  // and every listed entry exists in the schema (no stale names)
  const stale = enc.ENCRYPTED_COLUMNS.filter((c) => !rowsOf(db, `PRAGMA table_info("${c.table}")`).some((x) => x.name === c.column));
  assert.deepStrictEqual(stale, []);
  // key-id metadata columns exist where named
  const badKid = enc.ENCRYPTED_COLUMNS.filter((c) => c.keyIdColumn && !rowsOf(db, `PRAGMA table_info("${c.table}")`).some((x) => x.name === c.keyIdColumn));
  assert.deepStrictEqual(badKid, []);
});

test('key ring configuration errors fail loudly, valid configs load', () => {
  const enc = require(path.join(SRC, 'services/encryption.js'));
  assert.throws(() => enc.reloadKeyRing({ ENCRYPTION_MASTER_KEY: 'new-key-xxxxxxxxxxxxxxxx', ENCRYPTION_MASTER_KEY_PREVIOUS: KEY_A }), /ENCRYPTION_MASTER_KEY_VERSION/);
  assert.throws(() => enc.reloadKeyRing({ ENCRYPTION_MASTER_KEY: 'k'.repeat(20), ENCRYPTION_MASTER_KEY_VERSION: 'two' }), /positive integer/);
  assert.throws(() => enc.reloadKeyRing({ ENCRYPTION_MASTER_KEY: 'k'.repeat(20), ENCRYPTION_MASTER_KEY_VERSION: '3', ENCRYPTION_MASTER_KEY_PREVIOUS: KEY_A, ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION: '3' }));
  const info = enc.reloadKeyRing({ ENCRYPTION_MASTER_KEY: 'k'.repeat(20), ENCRYPTION_MASTER_KEY_VERSION: '3' });
  assert.strictEqual(info.previous_configured, false);
  assert.ok(info.warnings.some((w) => /below 3/.test(w)));
  // a failed reload leaves the previous ring in place; restore the suite's ring
  const back = enc.reloadKeyRing(process.env);
  assert.strictEqual(back.current_from_version, 1);
  assert.strictEqual(enc.decrypt(enc.encrypt('still fine').encrypted), 'still fine');
});

test('rotation routes are superadmin-only', async () => {
  for (const [m, u] of [['GET', '/api/encryption/rotation/status'], ['POST', '/api/encryption/rotation/start'], ['POST', '/api/encryption/rotation/pause'], ['GET', '/api/encryption/keys'], ['POST', '/api/admin/backup'], ['GET', '/api/admin/backups']]) {
    assert.strictEqual((await req(m, u)).status, 401, `${m} ${u} anon`);
    assert.strictEqual((await req(m, u, { token: tk.T })).status, 403, `${m} ${u} therapist`);
  }
});

test('status -> rotate -> start -> completed, via HTTP', async () => {
  let r = await req('GET', '/api/encryption/rotation/status', { token: tk.SA });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.active_version, 1);
  assert.strictEqual(r.body.active_key_check, 'ok');
  assert.strictEqual(r.body.key_ring.current_from_version, 1);
  assert.strictEqual(r.body.inventory.column_values_outdated, 0);
  assert.ok(r.body.keys[0].fingerprint && !JSON.stringify(r.body).includes(process.env.ENCRYPTION_MASTER_KEY), 'no secret in the response');

  // a backup at v1 (async route)
  r = await req('POST', '/api/admin/backup', { token: tk.SA });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.key_version, 1);
  r = await req('GET', '/api/admin/backups', { token: tk.SA });
  assert.strictEqual(r.body.backups[0].format, 'gcm-v1');

  r = await req('POST', '/api/encryption/rotate', { token: tk.SA });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.new_version, 2);

  r = await req('GET', '/api/encryption/rotation/status', { token: tk.SA });
  assert.ok(r.body.inventory.column_values_outdated >= 5);
  assert.strictEqual(r.body.inventory.backups.outdated, 1);
  assert.strictEqual(r.body.safe_to_retire_previous, false);

  r = await req('POST', '/api/encryption/rotation/start', { token: tk.SA });
  assert.strictEqual(r.status, 202);
  assert.strictEqual(r.body.job.target_version, 2);
  // second start while running -> already_running
  const again = await req('POST', '/api/encryption/rotation/start', { token: tk.SA });
  if (again.body.already_running) assert.strictEqual(again.status, 200);
  await require(path.join(SRC, 'services/keyRotation.js')).waitForIdle();

  r = await req('GET', '/api/encryption/rotation/status', { token: tk.SA });
  assert.strictEqual(r.body.job.status, 'completed', JSON.stringify(r.body.job));
  assert.strictEqual(r.body.inventory.column_values_outdated, 0);
  assert.strictEqual(r.body.inventory.backups.outdated, 0);
  assert.strictEqual(r.body.safe_to_retire_previous, true);
  assert.strictEqual(r.body.running, false);

  // restore of the (re-encrypted) backup still works through the route
  const list = await req('GET', '/api/admin/backups', { token: tk.SA });
  const target = list.body.backups.find((b) => b.filename.startsWith('prtop_backup_'));
  r = await req('POST', '/api/admin/restore', { token: tk.SA, body: { filename: target.filename, confirm: true } });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.format, 'gcm-v1');
  const enc = require(path.join(SRC, 'services/encryption.js'));
  const notes = rowsOf(conn.getDatabase(), 'SELECT note_encrypted AS v FROM therapist_notes').map((x) => enc.decrypt(x.v));
  assert.deepStrictEqual(notes.sort(), ['note 0', 'note 1', 'note 2', 'note 3', 'note 4']);
  assert.strictEqual(enc.getActiveKeyVersion(), 2, 'a re-encrypted backup restores with v2 as its active version');
  assert.strictEqual(enc.verifyKeyVersion(2), 'ok');
});

test('pause stops after the current batch; start resumes', async () => {
  const kr = require(path.join(SRC, 'services/keyRotation.js'));
  const enc = require(path.join(SRC, 'services/encryption.js'));
  const db = conn.getDatabase();
  for (let i = 0; i < 40; i++) {
    db.run('INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted) VALUES (1, 1, ?)', [enc.encrypt('p' + i).encrypted]);
  }
  await req('POST', '/api/encryption/rotate', { token: tk.SA }); // v3
  kr.configure({ batchRows: 3, batchPauseMs: 20 });
  let r = await req('POST', '/api/encryption/rotation/start', { token: tk.SA });
  assert.strictEqual(r.status, 202);
  await new Promise((res) => setTimeout(res, 60));
  r = await req('POST', '/api/encryption/rotation/pause', { token: tk.SA });
  assert.deepStrictEqual(r.body, { pausing: true });
  await kr.waitForIdle();
  r = await req('GET', '/api/encryption/rotation/status', { token: tk.SA });
  assert.strictEqual(r.body.job.status, 'paused');
  const mid = r.body.inventory.column_values_outdated;
  assert.ok(mid > 0, 'work left after pause');
  r = await req('POST', '/api/encryption/rotation/start', { token: tk.SA });
  assert.strictEqual(r.body.resumed, true);
  await kr.waitForIdle();
  r = await req('GET', '/api/encryption/rotation/status', { token: tk.SA });
  assert.strictEqual(r.body.job.status, 'completed');
  assert.strictEqual(r.body.inventory.column_values_outdated, 0);
  assert.ok(r.body.job.stats.values_reencrypted >= mid);
});
