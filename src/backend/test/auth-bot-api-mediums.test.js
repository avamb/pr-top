// Track N (audit wave 3) backend tests — node:test, self-contained.
// Temp DB + dummy env, routers mounted on a throwaway express app, external
// services (email, Telegram, LLM) stubbed. Never loads the repo .env.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

const BACKEND = path.resolve(__dirname, '..');
const SRC = path.join(BACKEND, 'src');
require('./helpers/exit');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'trackN-'));
const DB_FILE = path.join(TMP, 'test.db');
process.chdir(TMP); // dotenv (if anything loads it) finds no .env here
Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-xxxxxxxxxxxxxxxx',
  ENCRYPTION_MASTER_KEY: 'test-master-key-xxxxxxxxxxxxxxxx',
  BOT_API_KEY: 'test-bot-api-key-xxxxxxxxxxxxxx',
  LOGIN_CODE_PEPPER: 'test-pepper-xxxxxxxxxxxxxxxxxxxx',
  DATABASE_URL: 'sqlite:' + DB_FILE.replace(/\\/g, '/'),
  SUPERADMIN_EMAIL: 'admin@trackn.test',
  SUPERADMIN_PASSWORD: 'AdminPass123',
  BACKUP_DIR: path.join(TMP, 'backups'),
  ANTIBOT_ENABLED: 'false',
  TURNSTILE_SECRET: '',
  AUTH_DEV_ECHO: 'true',
  LOG_LEVEL: 'error',
  SMTP_HOST: ''
});

const req = (m) => require(path.join(BACKEND, 'node_modules', m));
const express = req('express');
const cookieParser = req('cookie-parser');
const jwt = req('jsonwebtoken');
const bcrypt = req('bcryptjs');

let server, port, db, conn;
const sentEmails = [];
const telegramSent = [];
const wsEmits = [];
const logLines = [];

function one(sql, p = []) { const r = db.exec(sql, p); return r.length && r[0].values.length ? r[0].values[0] : null; }
function ins(sql, p = []) { db.run(sql, p); return one('SELECT last_insert_rowid()')[0]; }
function tokenFor(id, role) { return jwt.sign({ userId: id, role, tv: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' }); }

function call(method, url, { token, body, headers, ip } = {}) {
  return new Promise((resolve, reject) => {
    const data = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const r = http.request({
      host: '127.0.0.1', port, method, path: url,
      headers: Object.assign({ 'content-type': 'application/json' },
        token ? { authorization: 'Bearer ' + token } : {},
        data ? { 'content-length': Buffer.byteLength(data) } : {},
        ip ? { 'cf-connecting-ip': ip } : {},
        headers || {})
    }, (res) => {
      let s = '';
      res.on('data', (c) => (s += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (_) {} resolve({ status: res.statusCode, body: j, headers: res.headers }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const BOT = { 'x-bot-api-key': process.env.BOT_API_KEY };

test.before(async () => {
  conn = require(path.join(SRC, 'db/connection.js'));
  await conn.initDatabase();
  db = conn.getDatabase();

  // --- stubs (patched on the shared module objects before routes use them) ---
  const emailService = require(path.join(SRC, 'services/emailService.js'));
  for (const fn of ['sendLoginCodeEmail', 'sendBotEmailConfirmEmail', 'sendPasswordLoginLockedEmail', 'sendPasswordReset', 'sendVerificationEmail', 'sendLeadVerificationEmail', 'sendViewerWelcomeEmail', 'sendEmail']) {
    emailService[fn] = async (to, data) => { sentEmails.push({ fn, to, data }); return { sent: true }; };
  }
  const telegramNotify = require(path.join(SRC, 'utils/telegramNotify.js'));
  telegramNotify.sendMessage = async (...a) => { telegramSent.push(a); return { sent: true }; };
  const ws = require(path.join(SRC, 'services/websocketService.js'));
  for (const k of Object.keys(ws)) if (/^emit/.test(k) && typeof ws[k] === 'function') ws[k] = (...a) => { wsEmits.push([k, ...a]); };
  const { logger } = require(path.join(SRC, 'utils/logger.js'));
  for (const lvl of ['info', 'warn', 'error']) {
    const orig = logger[lvl].bind(logger);
    logger[lvl] = (msg, ...rest) => { logLines.push(String(msg)); return orig(msg, ...rest); };
  }

  const app = express();
  app.use('/api/bot', express.json({ limit: '30mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api/', require(path.join(SRC, 'middleware/i18n.js')).i18nMiddleware);
  app.use('/api/auth/login-code', require(path.join(SRC, 'routes/loginCode.js')));
  app.use('/api/auth', require(path.join(SRC, 'routes/emailVerification.js')));
  app.use('/api/auth', require(path.join(SRC, 'routes/auth.js')));
  app.use('/api/bot', require(path.join(SRC, 'routes/bot.js')));
  app.use('/api/clients', require(path.join(SRC, 'routes/clients.js')));
  app.use('/api/exercises', require(path.join(SRC, 'routes/exercises.js')));
  app.use('/api/search', require(path.join(SRC, 'routes/search.js')));
  app.use('/api/query', require(path.join(SRC, 'routes/query.js')));
  app.use('/api/assistant', require(path.join(SRC, 'routes/assistant.js')));
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  port = server.address().port;
});

test.after(() => { if (server) server.close(); });

function seedTherapist(email, password, extra = {}) {
  const hash = password ? bcrypt.hashSync(password, 12) : '';
  const id = ins("INSERT INTO users (email, password_hash, role, language, email_verified_at) VALUES (?, ?, 'therapist', 'en', datetime('now'))", [email, hash]);
  ins("INSERT INTO subscriptions (therapist_id, plan, status, current_period_end, created_at, updated_at) VALUES (?, ?, 'active', datetime('now','+30 days'), datetime('now'), datetime('now'))", [id, extra.plan || 'pro']);
  if (extra.inviteCode) db.run('UPDATE users SET invite_code = ? WHERE id = ?', [extra.inviteCode, id]);
  return id;
}

// ---------------------------------------------------------------- M4
test('M4: 10 wrong passwords lock password login (generic 401), code login still works, reset lifts the lock', async () => {
  seedTherapist('lock@trackn.test', 'RightPass123');
  const ATTACKER = '203.0.113.9', OTHER = '198.51.100.20', OTHER2 = '198.51.100.21';
  sentEmails.length = 0;
  for (let i = 0; i < 10; i++) {
    const r = await call('POST', '/api/auth/login', { ip: ATTACKER, body: { email: 'lock@trackn.test', password: 'WrongPass' + i } });
    assert.equal(r.status, 401);
  }
  const locked = await call('POST', '/api/auth/login', { ip: ATTACKER, body: { email: 'lock@trackn.test', password: 'RightPass123' } });
  assert.equal(locked.status, 401, 'right password refused while locked');
  const unknown = await call('POST', '/api/auth/login', { ip: ATTACKER, body: { email: 'nobody@trackn.test', password: 'Whatever123' } });
  assert.deepEqual(locked.body, unknown.body, 'lock answer identical to unknown-email answer');
  assert.ok(one("SELECT COUNT(*) FROM audit_logs WHERE action = 'login_password_locked'")[0] >= 1);
  const notices = sentEmails.filter((e) => e.fn === 'sendPasswordLoginLockedEmail');
  assert.equal(notices.length, 1, 'owner emailed exactly once per lock');
  assert.equal(notices[0].to, 'lock@trackn.test');
  for (let i = 0; i < 3; i++) await call('POST', '/api/auth/login', { ip: ATTACKER, body: { email: 'lock@trackn.test', password: 'More' + i } });
  assert.equal(sentEmails.filter((e) => e.fn === 'sendPasswordLoginLockedEmail').length, 1, 'no repeat notice during the lock');

  // Code login still available while password login is locked
  const reqCode = await call('POST', '/api/auth/login-code/request', { ip: ATTACKER, body: { email: 'lock@trackn.test' } });
  assert.equal(reqCode.status, 200);
  assert.match(reqCode.body.dev_code, /^\d{6}$/);
  const verify = await call('POST', '/api/auth/login-code/verify', { ip: ATTACKER, body: { email: 'lock@trackn.test', code: reqCode.body.dev_code } });
  assert.equal(verify.status, 200, 'code login works during the lock');

  // Expired lock -> correct password works and counters are clear
  db.run("UPDATE users SET password_locked_until = datetime('now', '-1 minute') WHERE email = 'lock@trackn.test'");
  const ok = await call('POST', '/api/auth/login', { ip: OTHER, body: { email: 'lock@trackn.test', password: 'RightPass123' } });
  assert.equal(ok.status, 200);
  assert.equal(one("SELECT failed_login_count FROM users WHERE email = 'lock@trackn.test'")[0], 0);

  // Lock again, then a password reset lifts it
  for (let i = 0; i < 10; i++) await call('POST', '/api/auth/login', { ip: OTHER2, body: { email: 'lock@trackn.test', password: 'Nope' + i } });
  assert.ok(one("SELECT password_locked_until FROM users WHERE email = 'lock@trackn.test'")[0]);
  sentEmails.length = 0;
  await call('POST', '/api/auth/forgot-password', { body: { email: 'lock@trackn.test' } });
  const resetMail = sentEmails.find((e) => e.fn === 'sendPasswordReset');
  assert.ok(resetMail, 'reset email sent');
  const plainToken = resetMail.data;
  const reset = await call('POST', '/api/auth/reset-password', { body: { token: plainToken, password: 'NewPass1234' } });
  assert.equal(reset.status, 200);
  assert.equal(one("SELECT password_locked_until FROM users WHERE email = 'lock@trackn.test'")[0], null);
  const after = await call('POST', '/api/auth/login', { ip: OTHER2, body: { email: 'lock@trackn.test', password: 'NewPass1234' } });
  assert.equal(after.status, 200);
});

test('M4: failures outside the 15-minute window start a new count', async () => {
  seedTherapist('window@trackn.test', 'RightPass123');
  for (let i = 0; i < 9; i++) await call('POST', '/api/auth/login', { body: { email: 'window@trackn.test', password: 'bad' + i } });
  assert.equal(one("SELECT failed_login_count FROM users WHERE email = 'window@trackn.test'")[0], 9);
  db.run("UPDATE users SET failed_login_window_start = datetime('now', '-16 minutes') WHERE email = 'window@trackn.test'");
  await call('POST', '/api/auth/login', { body: { email: 'window@trackn.test', password: 'bad-again' } });
  const row = one("SELECT failed_login_count, password_locked_until FROM users WHERE email = 'window@trackn.test'");
  assert.equal(row[0], 1);
  assert.equal(row[1], null);
});

// ---------------------------------------------------------------- M5
test('M5: unknown email and passwordless accounts cost one bcrypt compare (timing)', async () => {
  seedTherapist('timing@trackn.test', 'RightPass123');
  ins("INSERT INTO users (email, password_hash, role, language) VALUES ('viewer@trackn.test', '', 'viewer', 'en')");
  const time = async (email) => { const t0 = process.hrtime.bigint(); await call('POST', '/api/auth/login', { body: { email, password: 'Wrong12345' } }); return Number(process.hrtime.bigint() - t0) / 1e6; };
  await time('warmup@trackn.test');
  const known = await time('timing@trackn.test');
  const unknown = await time('ghost@trackn.test');
  const viewer = await time('viewer@trackn.test');
  // bcrypt cost 12 is ~100+ ms; an early return would be ~1 ms.
  assert.ok(unknown > known * 0.4, `unknown ${unknown}ms vs known ${known}ms`);
  assert.ok(viewer > known * 0.4, `viewer ${viewer}ms vs known ${known}ms`);
});

test('M5: /register with an existing email answers 201 check_email (no session), mails a sign-in code', async () => {
  seedTherapist('exists@trackn.test', 'RightPass123');
  sentEmails.length = 0;
  const r = await call('POST', '/api/auth/register', { body: { email: 'Exists@trackn.test', password: 'Another123' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.check_email, true);
  assert.equal(r.body.user, undefined);
  assert.equal(r.headers['set-cookie'], undefined, 'no session cookie');
  assert.ok(sentEmails.some((e) => e.fn === 'sendLoginCodeEmail' && e.to === 'exists@trackn.test'), 'sign-in code mailed to owner');
  assert.equal(one("SELECT COUNT(*) FROM users WHERE email = 'exists@trackn.test'")[0], 1);

  const weak = await call('POST', '/api/auth/register', { body: { email: 'exists@trackn.test', password: 'weak' } });
  assert.equal(weak.status, 400, 'weak password: same 400 as for a new email');

  const fresh = await call('POST', '/api/auth/register', { body: { email: 'fresh@trackn.test', password: 'Fresh12345' } });
  assert.equal(fresh.status, 201);
  assert.ok(fresh.body.user && fresh.body.user.email === 'fresh@trackn.test');
  assert.equal(fresh.body.check_email, undefined);
  assert.ok(fresh.headers['set-cookie'], 'new account gets a session cookie');

  const bad = await call('POST', '/api/auth/register', { body: { email: { $gt: '' }, password: 'Fresh12345' } });
  assert.equal(bad.status, 400, 'non-string email is a 400, not a 500');
});

test('M5: register-lead / register-viewer do not reveal therapist accounts', async () => {
  seedTherapist('leadcheck@trackn.test', 'RightPass123');
  const lead = await call('POST', '/api/auth/register-lead', { body: { email: 'leadcheck@trackn.test' } });
  const leadNew = await call('POST', '/api/auth/register-lead', { body: { email: 'brandnewlead@trackn.test' } });
  assert.equal(lead.status, 201);
  assert.equal(leadNew.status, 201);
  assert.deepEqual(Object.keys(lead.body).sort(), Object.keys(leadNew.body).sort());
  assert.equal(lead.body.existing_role, undefined);

  ins("INSERT INTO users (email, password_hash, role, language) VALUES ('oldviewer@trackn.test', '', 'viewer', 'en')");
  const vT = await call('POST', '/api/auth/register-viewer', { body: { email: 'leadcheck@trackn.test' } });
  const vV = await call('POST', '/api/auth/register-viewer', { body: { email: 'oldviewer@trackn.test' } });
  assert.equal(vT.status, 200);
  assert.deepEqual(vT.body, vV.body, 'therapist and viewer emails get the same answer');
});

// ------------------------------------------------- reset-password (L)
test('L: reset tokens stored hashed; concurrent use of one link succeeds once', async () => {
  seedTherapist('race@trackn.test', 'RightPass123');
  sentEmails.length = 0;
  await call('POST', '/api/auth/forgot-password', { body: { email: 'race@trackn.test' } });
  const plain = sentEmails.find((e) => e.fn === 'sendPasswordReset').data;
  const uid = one("SELECT id FROM users WHERE email = 'race@trackn.test'")[0];
  const stored = one('SELECT token FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1', [uid])[0];
  assert.notEqual(stored, plain);
  assert.equal(stored, crypto.createHash('sha256').update(plain).digest('hex'));

  const [a, b] = await Promise.all([
    call('POST', '/api/auth/reset-password', { body: { token: plain, password: 'RaceOne1234' } }),
    call('POST', '/api/auth/reset-password', { body: { token: plain, password: 'RaceTwo1234' } })
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 400], 'exactly one request wins');
  const winner = a.status === 200 ? 'RaceOne1234' : 'RaceTwo1234';
  const ok = await call('POST', '/api/auth/login', { body: { email: 'race@trackn.test', password: winner } });
  assert.equal(ok.status, 200);
});

test('L: forgot-password per-email budget, no email addresses in its logs', async () => {
  seedTherapist('forgot@trackn.test', 'RightPass123');
  const uid = one("SELECT id FROM users WHERE email = 'forgot@trackn.test'")[0];
  logLines.length = 0;
  for (let i = 0; i < 4; i++) {
    const r = await call('POST', '/api/auth/forgot-password', { body: { email: 'forgot@trackn.test' } });
    assert.equal(r.status, 200);
  }
  await call('POST', '/api/auth/forgot-password', { body: { email: 'nobody-forgot@trackn.test' } });
  assert.equal(one('SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = ?', [uid])[0], 3, '4th request inside the hour is swallowed');
  const leaked = logLines.filter((l) => /forgot@trackn\.test|nobody-forgot@trackn\.test/.test(l));
  assert.deepEqual(leaked, []);
});

test('L: legacy plaintext reset tokens are hashed by the migration (idempotent)', async () => {
  const uid = seedTherapist('legacy@trackn.test', 'RightPass123');
  const legacy = crypto.randomUUID();
  // expires_at in the ISO format /forgot-password writes
  db.run('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [uid, legacy, new Date(Date.now() + 3600e3).toISOString()]);
  conn.saveDatabase();
  await conn.initDatabase(); // re-runs every migration on the saved file
  db = conn.getDatabase();
  await conn.initDatabase(); // second run must not double-hash
  db = conn.getDatabase();
  const stored = one('SELECT token FROM password_reset_tokens WHERE user_id = ?', [uid])[0];
  assert.equal(stored, crypto.createHash('sha256').update(legacy).digest('hex'));
  const r = await call('POST', '/api/auth/reset-password', { body: { token: legacy, password: 'Legacy12345' } });
  assert.equal(r.status, 200, 'link issued before the deploy still works: ' + JSON.stringify(r.body));
});

// ---------------------------------------------------------------- M7
test('M7: /consent links only to the therapist from /connect, active and unblocked', async () => {
  const T1 = seedTherapist('m7a@trackn.test', 'RightPass123', { inviteCode: 'M7AAAA01' });
  const T2 = seedTherapist('m7b@trackn.test', 'RightPass123', { inviteCode: 'M7BBBB02' });
  const SA = one("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1")[0];
  await call('POST', '/api/bot/register', { headers: BOT, body: { telegram_id: '7001', role: 'client' } });

  // No /connect at all -> refused for any id (incl. superadmin)
  for (const tid of [T1, SA]) {
    const r = await call('POST', '/api/bot/consent', { headers: BOT, body: { telegram_id: '7001', therapist_id: tid, consent: true, consent_version: 2 } });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'CONSENT_NOT_PENDING');
  }
  // /connect to T1, then consent for T2 -> refused; for T1 -> linked
  const c = await call('POST', '/api/bot/connect', { headers: BOT, body: { telegram_id: '7001', invite_code: 'm7aaaa01' } });
  assert.equal(c.status, 200);
  const wrong = await call('POST', '/api/bot/consent', { headers: BOT, body: { telegram_id: '7001', therapist_id: T2, consent: true, consent_version: 2 } });
  assert.equal(wrong.status, 403);
  const right = await call('POST', '/api/bot/consent', { headers: BOT, body: { telegram_id: '7001', therapist_id: T1, consent: true, consent_version: 2 } });
  assert.equal(right.status, 200);
  assert.equal(right.body.linked, true);
  const row = one("SELECT therapist_id, consent_therapist_access, pending_connect_therapist_id FROM users WHERE telegram_id = '7001'");
  assert.deepEqual(row, [T1, 1, null]);

  // Expired pending connect (older than 24 h) is refused
  await call('POST', '/api/bot/register', { headers: BOT, body: { telegram_id: '7002', role: 'client' } });
  await call('POST', '/api/bot/connect', { headers: BOT, body: { telegram_id: '7002', invite_code: 'M7BBBB02' } });
  db.run("UPDATE users SET pending_connect_at = datetime('now', '-25 hours') WHERE telegram_id = '7002'");
  const stale = await call('POST', '/api/bot/consent', { headers: BOT, body: { telegram_id: '7002', therapist_id: T2, consent: true, consent_version: 2 } });
  assert.equal(stale.status, 403);

  // Therapist blocked between /connect and consent -> THERAPIST_UNAVAILABLE
  await call('POST', '/api/bot/connect', { headers: BOT, body: { telegram_id: '7002', invite_code: 'M7BBBB02' } });
  db.run("UPDATE users SET blocked_at = datetime('now') WHERE id = ?", [T2]);
  const blocked = await call('POST', '/api/bot/consent', { headers: BOT, body: { telegram_id: '7002', therapist_id: T2, consent: true, consent_version: 2 } });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'THERAPIST_UNAVAILABLE');
  db.run('UPDATE users SET blocked_at = NULL WHERE id = ?', [T2]);
});

test('M7/8: admin-linked client (consent 0) can consent to the linked therapist without /connect, limit not re-applied', async () => {
  const T = seedTherapist('m7c@trackn.test', 'RightPass123', { plan: 'trial' });
  await call('POST', '/api/bot/register', { headers: BOT, body: { telegram_id: '7003', role: 'client' } });
  db.run("UPDATE users SET therapist_id = ?, consent_therapist_access = 0 WHERE telegram_id = '7003'", [T]);
  // Fill the therapist up to any plausible client limit so a re-check would fail
  for (let i = 0; i < 30; i++) ins("INSERT INTO users (role, therapist_id, consent_therapist_access, language) VALUES ('client', ?, 1, 'en')", [T]);
  const r = await call('POST', '/api/bot/consent', { headers: BOT, body: { telegram_id: '7003', therapist_id: T, consent: true, consent_version: 2, mode: 'connect' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(one("SELECT consent_therapist_access FROM users WHERE telegram_id = '7003'")[0], 1);
});

// ---------------------------------------------------------------- M8
test('M8: bot profile type checks; email stays pending until the mailed code is confirmed', async () => {
  await call('POST', '/api/bot/register', { headers: BOT, body: { telegram_id: '8001', role: 'therapist' } });
  const notString = await call('PUT', '/api/bot/profile/8001', { headers: BOT, body: { first_name: { a: 1 } } });
  assert.equal(notString.status, 400);
  const tooLong = await call('PUT', '/api/bot/profile/8001', { headers: BOT, body: { phone: 'x'.repeat(40) } });
  assert.equal(tooLong.status, 400);
  const badTz = await call('PUT', '/api/bot/profile/8001', { headers: BOT, body: { timezone: 'Mars/Olympus' } });
  assert.equal(badTz.status, 400);
  const okName = await call('PUT', '/api/bot/profile/8001', { headers: BOT, body: { first_name: ' Ann ', timezone: 'Europe/Kyiv' } });
  assert.equal(okName.status, 200);

  sentEmails.length = 0;
  const pend = await call('PUT', '/api/bot/profile/8001', { headers: BOT, body: { email: 'Bot.Therapist@trackn.test' } });
  assert.equal(pend.status, 202);
  assert.equal(pend.body.email_pending, true);
  let row = one("SELECT email, pending_email, email_verified_at FROM users WHERE telegram_id = '8001'");
  assert.equal(row[0], null, 'account email NOT set before confirmation');
  assert.equal(row[1], 'bot.therapist@trackn.test');
  assert.ok(sentEmails.some((e) => e.fn === 'sendBotEmailConfirmEmail' && e.to === 'bot.therapist@trackn.test'));

  const wrongCode = pend.body.dev_code === '000000' ? '111111' : '000000';
  const bad = await call('POST', '/api/bot/profile/8001/confirm-email', { headers: BOT, body: { telegram_id: '8001', code: wrongCode } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'CODE_INVALID');
  assert.equal(bad.body.attempts_left, 4);

  const good = await call('POST', '/api/bot/profile/8001/confirm-email', { headers: BOT, body: { telegram_id: '8001', code: pend.body.dev_code } });
  assert.equal(good.status, 200);
  row = one("SELECT email, pending_email, email_verified_at FROM users WHERE telegram_id = '8001'");
  assert.equal(row[0], 'bot.therapist@trackn.test');
  assert.equal(row[1], null);
  assert.ok(row[2], 'confirmed address is marked verified');
});

test('M8: taken address rejected at confirmation; 5 wrong codes clear the pending email; 3 codes/hour', async () => {
  seedTherapist('taken@trackn.test', 'RightPass123');
  await call('POST', '/api/bot/register', { headers: BOT, body: { telegram_id: '8002', role: 'therapist' } });
  const p1 = await call('PUT', '/api/bot/profile/8002', { headers: BOT, body: { email: 'taken@trackn.test' } });
  assert.equal(p1.status, 202, 'no "already in use" oracle before the mailbox is proven');
  const taken = await call('POST', '/api/bot/profile/8002/confirm-email', { headers: BOT, body: { telegram_id: '8002', code: p1.body.dev_code } });
  assert.equal(taken.status, 409);
  assert.equal(taken.body.code, 'EMAIL_TAKEN');

  const p2 = await call('PUT', '/api/bot/profile/8002', { headers: BOT, body: { email: 'other@trackn.test' } });
  assert.equal(p2.status, 202);
  let last;
  for (let i = 0; i < 5; i++) {
    last = await call('POST', '/api/bot/profile/8002/confirm-email', { headers: BOT, body: { telegram_id: '8002', code: p2.body.dev_code === '999999' ? '888888' : '999999' } });
  }
  assert.equal(last.body.code, 'CODE_ATTEMPTS_EXCEEDED');
  assert.equal(one("SELECT pending_email FROM users WHERE telegram_id = '8002'")[0], null);
  const afterLock = await call('POST', '/api/bot/profile/8002/confirm-email', { headers: BOT, body: { telegram_id: '8002', code: p2.body.dev_code } });
  assert.equal(afterLock.body.code, 'CODE_EXPIRED');

  const p3 = await call('PUT', '/api/bot/profile/8002', { headers: BOT, body: { email: 'third@trackn.test' } });
  assert.equal(p3.status, 202);
  const p4 = await call('PUT', '/api/bot/profile/8002', { headers: BOT, body: { email: 'fourth@trackn.test' } });
  assert.equal(p4.status, 429);
  assert.equal(p4.body.code, 'RATE_LIMITED');
});

// ---------------------------------------------------------------- M23
test('M23: exercise answer after consent revoke is refused, not stored, nobody notified', async () => {
  const T = seedTherapist('m23@trackn.test', 'RightPass123');
  db.run("UPDATE users SET telegram_id = '9100' WHERE id = ?", [T]);
  const C = ins("INSERT INTO users (telegram_id, role, therapist_id, consent_therapist_access, language) VALUES ('9101', 'client', ?, 1, 'en')", [T]);
  const E = ins("INSERT INTO exercises (category, title_en, is_custom) VALUES ('test', 'Lib exercise', 0)");
  const D1 = ins("INSERT INTO exercise_deliveries (exercise_id, therapist_id, client_id, status, sent_at) VALUES (?, ?, ?, 'sent', datetime('now'))", [E, T, C]);
  const D2 = ins("INSERT INTO exercise_deliveries (exercise_id, therapist_id, client_id, status, sent_at) VALUES (?, ?, ?, 'sent', datetime('now'))", [E, T, C]);

  telegramSent.length = 0; wsEmits.length = 0;
  const ok = await call('POST', `/api/bot/exercises/${D1}/respond`, { headers: BOT, body: { telegram_id: '9101', response_text: 'my answer' } });
  assert.equal(ok.status, 200);
  assert.ok(telegramSent.length + wsEmits.length > 0, 'linked therapist notified');

  await call('POST', '/api/bot/revoke-consent', { headers: BOT, body: { telegram_id: '9101' } });
  telegramSent.length = 0; wsEmits.length = 0;
  const refused = await call('POST', `/api/bot/exercises/${D2}/respond`, { headers: BOT, body: { telegram_id: '9101', response_text: 'after revoke' } });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'CONSENT_REVOKED');
  assert.equal(one('SELECT response_encrypted FROM exercise_deliveries WHERE id = ?', [D2])[0], null);
  assert.equal(telegramSent.length, 0);
  assert.equal(wsEmits.length, 0);
});

// ------------------------------------------------- exercise IDOR (L)
test('L: another therapist\'s custom exercise is invisible (GET) and cannot be sent to own client', async () => {
  const A = seedTherapist('idor-a@trackn.test', 'RightPass123');
  const B = seedTherapist('idor-b@trackn.test', 'RightPass123');
  const custB = ins("INSERT INTO exercises (category, title_en, is_custom, therapist_id) VALUES ('x', 'B private', 1, ?)", [B]);
  const custA = ins("INSERT INTO exercises (category, title_en, is_custom, therapist_id) VALUES ('x', 'A own', 1, ?)", [A]);
  const lib = ins("INSERT INTO exercises (category, title_en, is_custom) VALUES ('x', 'Library', 0)");
  const tA = tokenFor(A, 'therapist');
  assert.equal((await call('GET', `/api/exercises/${custB}`, { token: tA })).status, 404);
  assert.equal((await call('GET', `/api/exercises/${custA}`, { token: tA })).status, 200);
  assert.equal((await call('GET', `/api/exercises/${lib}`, { token: tA })).status, 200);

  const CA = ins("INSERT INTO users (telegram_id, role, therapist_id, consent_therapist_access, language) VALUES ('9201', 'client', ?, 1, 'en')", [A]);
  const sendB = await call('POST', `/api/clients/${CA}/exercises`, { token: tA, body: { exercise_id: custB } });
  assert.equal(sendB.status, 404);
  const sendLib = await call('POST', `/api/clients/${CA}/exercises`, { token: tA, body: { exercise_id: lib } });
  assert.ok([200, 201].includes(sendLib.status), JSON.stringify(sendLib.body));
});

// ------------------------------------------------- search stats (L)
test('L: /api/search/stats counts only the caller\'s embeddings', async () => {
  const A = seedTherapist('stats-a@trackn.test', 'RightPass123');
  const B = seedTherapist('stats-b@trackn.test', 'RightPass123');
  require(path.join(SRC, 'services/vectorStore.js')).ensureTable();
  ins("INSERT INTO vector_embeddings (source_type, source_id, therapist_id, embedding, token_count) VALUES ('diary_entry', 990001, ?, '[]', 5)", [A]);
  ins("INSERT INTO vector_embeddings (source_type, source_id, therapist_id, embedding, token_count) VALUES ('diary_entry', 990002, ?, '[]', 7)", [B]);
  ins("INSERT INTO vector_embeddings (source_type, source_id, therapist_id, embedding, token_count) VALUES ('session_summary', 990003, ?, '[]', 9)", [B]);
  const r = await call('GET', '/api/search/stats', { token: tokenFor(A, 'therapist') });
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 1);
  assert.deepEqual(r.body.by_type, { diary_entry: { count: 1, total_tokens: 5 } });
});

// ------------------------------------------------- NL query log (L)
test('L: NL query text is not written to the log', async () => {
  const T = seedTherapist('nlq@trackn.test', 'RightPass123', { plan: 'pro' });
  const C = ins("INSERT INTO users (telegram_id, role, therapist_id, consent_therapist_access, language) VALUES ('9301', 'client', ?, 1, 'en')", [T]);
  logLines.length = 0;
  const secret = 'SUPERSECRET-clinical-phrase';
  const r = await call('POST', '/api/query', { token: tokenFor(T, 'therapist'), body: { client_id: C, query: secret } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(logLines.filter((l) => l.includes(secret)), []);
  assert.ok(logLines.some((l) => /NL query by therapist/.test(l)));
});

// ---------------------------------------------------------------- M19
test('M19: therapist assistant chat honours the spend cap and logs usage', async () => {
  const T = seedTherapist('m19@trackn.test', 'RightPass123', { plan: 'pro' });
  const tok = tokenFor(T, 'therapist');
  const aiProviders = require(path.join(SRC, 'services/aiProviders/index.js'));
  const assistantCache = require(path.join(SRC, 'services/assistantCache.js'));
  const assistantKnowledge = require(path.join(SRC, 'services/assistantKnowledge.js'));
  assistantCache.findCachedAnswer = async () => ({ hit: false });
  assistantCache.storeCachedAnswer = async () => {};
  assistantKnowledge.search = async () => [{ similarity: 0.9, source_file: 'x.md', source_type: 'doc', chunk_text: 'Some platform doc.' }];
  let llmCalls = 0;
  aiProviders.chat = async () => { llmCalls++; return { text: 'Answer from stub', input_tokens: 120, output_tokens: 30, model: 'gpt-4o-mini', provider: 'openai' }; };

  // Cap reached -> 503, LLM untouched
  db.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ai_monthly_limit_usd', '1')");
  ins("INSERT INTO ai_usage_log (therapist_id, timestamp, provider, model, operation, input_tokens, output_tokens, total_tokens, cost_usd) VALUES (0, datetime('now'), 'openai', 'x', 'seed', 0, 0, 0, 5)");
  const capped = await call('POST', '/api/assistant/chat', { token: tok, body: { message: 'How do I add a client?' } });
  assert.equal(capped.status, 503);
  assert.equal(capped.body.code, 'assistant_unavailable');
  assert.equal(llmCalls, 0);

  // Under the cap -> answered and logged as assistant_chat for this therapist
  db.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ai_monthly_limit_usd', '0')");
  const ok = await call('POST', '/api/assistant/chat', { token: tok, body: { message: 'How do I add a client?' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(llmCalls, 1);
  const row = one("SELECT input_tokens, output_tokens, cost_usd FROM ai_usage_log WHERE therapist_id = ? AND operation = 'assistant_chat'", [T]);
  assert.ok(row, 'usage row written');
  assert.equal(row[0], 120);
  assert.equal(row[1], 30);
  assert.ok(row[2] > 0);
});

test('M4 anti-DoS: an IP that signed in to the account in the last 30 days is neither counted nor locked out', async () => {
  seedTherapist('known@trackn.test', 'RightPass123');
  const HOME = '192.0.2.50', EVIL = '203.0.113.77';
  assert.equal((await call('POST', '/api/auth/login', { ip: HOME, body: { email: 'known@trackn.test', password: 'RightPass123' } })).status, 200);
  for (let i = 0; i < 12; i++) await call('POST', '/api/auth/login', { ip: HOME, body: { email: 'known@trackn.test', password: 'typo' + i } });
  assert.equal(one("SELECT password_locked_until FROM users WHERE email = 'known@trackn.test'")[0], null, 'owner typos do not lock');
  for (let i = 0; i < 10; i++) await call('POST', '/api/auth/login', { ip: EVIL, body: { email: 'known@trackn.test', password: 'guess' + i } });
  assert.ok(one("SELECT password_locked_until FROM users WHERE email = 'known@trackn.test'")[0], 'attacker IP triggers the lock');
  assert.equal((await call('POST', '/api/auth/login', { ip: EVIL, body: { email: 'known@trackn.test', password: 'RightPass123' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { ip: HOME, body: { email: 'known@trackn.test', password: 'RightPass123' } })).status, 200, 'owner still gets in from the known IP');
  db.run("UPDATE audit_logs SET created_at = datetime('now', '-31 days') WHERE actor_id = (SELECT id FROM users WHERE email = 'known@trackn.test') AND action = 'login'");
  assert.equal((await call('POST', '/api/auth/login', { ip: HOME, body: { email: 'known@trackn.test', password: 'RightPass123' } })).status, 401, 'older than 30 days: no exception');
});

test('M8 review: dedicated template; at most 5 codes per target address per day across Telegram accounts', async () => {
  sentEmails.length = 0;
  const target = 'flood-target@trackn.test';
  for (let i = 0; i < 6; i++) await call('POST', '/api/bot/register', { headers: BOT, body: { telegram_id: String(8100 + i), role: 'therapist' } });
  for (let i = 0; i < 5; i++) {
    const r = await call('PUT', '/api/bot/profile/' + (8100 + i), { headers: BOT, body: { email: target } });
    assert.equal(r.status, 202);
  }
  const sixth = await call('PUT', '/api/bot/profile/8105', { headers: BOT, body: { email: target } });
  assert.equal(sixth.status, 429);
  assert.equal(sixth.body.code, 'RATE_LIMITED');
  assert.equal(sentEmails.filter((e) => e.fn === 'sendBotEmailConfirmEmail' && e.to === target).length, 5);
  assert.equal(sentEmails.filter((e) => e.fn === 'sendLoginCodeEmail').length, 0, 'sign-in template no longer used');
  const otherAddr = await call('PUT', '/api/bot/profile/8105', { headers: BOT, body: { email: 'another-target@trackn.test' } });
  assert.equal(otherAddr.status, 202, 'cap is per address');
  const row = one("SELECT details_encrypted FROM audit_logs WHERE action = 'bot_email_code_sent' ORDER BY id DESC LIMIT 1")[0];
  assert.ok(!row.includes('@'), 'audit stores only a hash of the address');
});

test('Review: therapist-display reports availability (blocked therapist)', async () => {
  const T = seedTherapist('display@trackn.test', 'RightPass123');
  let r = await call('GET', '/api/bot/therapist-display/' + T, { headers: BOT });
  assert.equal(r.body.available, true);
  db.run("UPDATE users SET blocked_at = datetime('now') WHERE id = ?", [T]);
  r = await call('GET', '/api/bot/therapist-display/' + T, { headers: BOT });
  assert.equal(r.body.available, false);
});

test('Review: email templates render in 4 languages without the code in the subject', () => {
  const es = require(path.join(SRC, 'services/emailService.js'));
  for (const l of ['en', 'ru', 'es', 'uk']) {
    const a = es._templates.botEmailConfirmTemplate({ code: '424242', ttlMin: 15 }, l);
    assert.ok(a.html.includes('424242') && !a.subject.includes('424242'));
    const b = es._templates.passwordLoginLockedTemplate({ loginUrl: 'https://x/login', forgotUrl: 'https://x/forgot-password', lockMinutes: 15 }, l);
    assert.ok(b.html.includes('https://x/login') && b.html.includes('https://x/forgot-password') && b.html.includes('15'));
  }
  const en = es._templates.botEmailConfirmTemplate({ code: '1', ttlMin: 15 }, 'en');
  assert.match(en.html, /Telegram/);
  assert.match(en.html, /wasn't you/);
});
