'use strict';
// Core primitives: database boot/persistence, field encryption, signed links.
const fs = require('fs');
const { setupEnv, check, run, src } = require('./helpers/checks');
const { dbFile } = setupEnv('core');

run('database boots, is idempotent and persists atomically', async () => {
  const conn = src('db/connection.js');
  await conn.initDatabase();
  const db = conn.getDatabase();
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0].values.map((r) => r[0]);
  for (const t of ['users', 'sessions', 'subscriptions', 'audit_logs', 'stripe_webhook_events']) {
    check('table exists: ' + t, tables.includes(t), tables.length);
  }
  const superadmin = db.exec("SELECT role FROM users WHERE email = 'admin@test.local'");
  check('superadmin seeded from SUPERADMIN_* env', superadmin.length && superadmin[0].values[0][0] === 'superadmin');

  // Second boot on the same process must not throw (migrations are idempotent).
  let rebootErr = null;
  try { await conn.initDatabase(); } catch (e) { rebootErr = e.message; }
  check('initDatabase twice does not throw', rebootErr === null, rebootErr);

  const live = conn.getDatabase();
  live.run("INSERT INTO users (email, password_hash, role) VALUES ('persist@x.test','x','therapist')");
  const buf = conn.snapshotDatabase();
  check('snapshotDatabase wrote the db file', fs.existsSync(dbFile) && fs.statSync(dbFile).size > 0, buf && buf.length);
  const v = conn.validateDatabaseImage(fs.readFileSync(dbFile));
  check('saved image passes validateDatabaseImage', v === true, v);
  let rejected = false;
  try { conn.validateDatabaseImage(Buffer.from('definitely not a sqlite image')); } catch (_) { rejected = true; }
  check('garbage image is rejected by validateDatabaseImage', rejected);
});

run('field encryption round-trips and rejects tampering', async () => {
  const enc = src('services/encryption.js');
  const { decrypt } = enc;
  // encrypt() returns { encrypted, keyVersion, keyId } today; accept a bare string too.
  const encrypt = (p) => { const r = enc.encrypt(p); return typeof r === 'string' ? r : r.encrypted; };
  for (const plain of ['hello', 'Привіт, світе — 日本語 🌿', 'x'.repeat(100000)]) {
    const packed = encrypt(plain);
    check('round-trip len=' + plain.length, decrypt(packed) === plain);
    if (plain) check('ciphertext differs from plaintext', !String(packed).includes(plain.slice(0, 8)));
  }
  check('same plaintext -> different ciphertext (random IV)', encrypt('same') !== encrypt('same'));
  const packed = encrypt('secret value');
  const tampered = packed.slice(0, -4) + (packed.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  let threw = false;
  try { const out = decrypt(tampered); threw = out !== 'secret value'; } catch (_) { threw = true; }
  check('tampered ciphertext does not decrypt to the original', threw);
});

run('signed attendance links verify, expire and reject tampering', async () => {
  const sl = src('utils/signedLinks.js');
  const future = new Date(Date.now() + 3600e3);
  const tok = sl.generateAttendanceToken({ session_id: 5, client_id: 7, action: 'confirm', expires_at: future });
  const v = sl.verifyAttendanceToken(tok);
  check('valid token verifies', v.ok && v.payload.session_id === 5 && v.payload.client_id === 7 && v.payload.action === 'confirm', v);

  const [p, s] = tok.split('.');
  const flipped = s.slice(0, -1) + (s.endsWith('A') ? 'B' : 'A');
  check('modified signature rejected', sl.verifyAttendanceToken(p + '.' + flipped).ok === false);
  const forgedPayload = Buffer.from(JSON.stringify({ v: 1, s: 6, c: 7, a: 'confirm', x: Math.floor(future / 1000) })).toString('base64url');
  check('modified payload rejected', sl.verifyAttendanceToken(forgedPayload + '.' + s).ok === false);

  const past = sl.generateAttendanceToken({ session_id: 5, client_id: 7, action: 'confirm', expires_at: new Date(Date.now() - 5000) });
  const ve = sl.verifyAttendanceToken(past);
  check('expired token rejected', ve.ok === false && ve.reason === 'expired', ve);
  for (const bad of [undefined, null, '', 'abc', 'a.b.c', 'forged.token']) {
    check('garbage token rejected: ' + String(bad), sl.verifyAttendanceToken(bad).ok === false);
  }
  let threw = false;
  try { sl.generateAttendanceToken({ session_id: 5, client_id: 7, action: 'nope', expires_at: future }); } catch (_) { threw = true; }
  check('unknown action refused at generation', threw);
});
