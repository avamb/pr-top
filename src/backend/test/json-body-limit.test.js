// Track N (audit wave 3) M13 test — boots the REAL backend (src/index.js)
// from a scratch CWD (no .env) with dummy env and a temp DB, then checks the
// JSON body limits: 1mb everywhere, BOT_JSON_BODY_LIMIT (30mb) on /api/bot.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const BACKEND = path.resolve(__dirname, '..');
require('./helpers/exit');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'trackN-boot-'));

function freePort() {
  return new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}
function call(port, method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : body;
    const r = http.request({ host: '127.0.0.1', port, method, path: url, headers: Object.assign({ 'content-type': 'application/json' }, data ? { 'content-length': Buffer.byteLength(data) } : {}, headers || {}) }, (res) => {
      let s = ''; res.on('data', (c) => (s += c)); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (_) {} resolve({ status: res.statusCode, body: j }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const jsonOfSize = (bytes) => JSON.stringify({ email: 'a@b.test', password: 'x', pad: 'p'.repeat(bytes) });

let child, port;
test.before(async () => {
  port = await freePort();
  child = spawn(process.execPath, [path.join(BACKEND, 'src', 'index.js')], {
    cwd: TMP,
    env: Object.assign({}, process.env, {
      NODE_ENV: 'test', PORT: String(port), LOG_LEVEL: 'error',
      JWT_SECRET: 'test-jwt-secret-xxxxxxxxxxxxxxxx', ENCRYPTION_MASTER_KEY: 'test-master-key-xxxxxxxxxxxxxxxx',
      BOT_API_KEY: 'test-bot-api-key-xxxxxxxxxxxxxx', SIGNED_LINK_SECRET: 'test-signed-link-xxxxxxxxxxxxxx',
      LOGIN_CODE_PEPPER: 'test-pepper-xxxxxxxxxxxxxxxxxxxx', DATABASE_URL: 'sqlite:' + path.join(TMP, 'db.sqlite').replace(/\\/g, '/'),
      SUPERADMIN_EMAIL: 'admin@trackn.test', SUPERADMIN_PASSWORD: 'AdminPass123', BACKUP_DIR: path.join(TMP, 'backups'),
      CSRF_TOKEN_RATE_LIMIT_MAX: '5', STRIPE_SECRET_KEY: '', SMTP_HOST: '', OPENAI_API_KEY: '', TELEGRAM_BOT_TOKEN: '', ANTIBOT_ENABLED: 'false'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  const deadline = Date.now() + 90000;
  for (;;) {
    try { const r = await call(port, 'GET', '/api/health/live'); if (r.status === 200) break; } catch (_) { /* not up yet */ }
    if (Date.now() > deadline) throw new Error('backend did not start');
    await new Promise((r) => setTimeout(r, 500));
  }
});
test.after(() => { if (child) child.kill(); });

test('M13: >1mb JSON on a normal route -> 413 PAYLOAD_TOO_LARGE', async () => {
  const r = await call(port, 'POST', '/api/auth/login', jsonOfSize(2 * 1024 * 1024));
  assert.equal(r.status, 413);
  assert.equal(r.body.code, 'PAYLOAD_TOO_LARGE');
});

test('M13: <1mb JSON on a normal route is parsed as before', async () => {
  const r = await call(port, 'POST', '/api/auth/login', jsonOfSize(500 * 1024));
  assert.notEqual(r.status, 413);
});

test('M13: the internal bot API still accepts large JSON (base64 media)', async () => {
  const r = await call(port, 'POST', '/api/bot/connect', jsonOfSize(5 * 1024 * 1024), { 'x-bot-api-key': 'wrong' });
  assert.equal(r.status, 401, 'parsed, then rejected by the bot key check (not 413)');
});

test('M13: bot API over BOT_JSON_BODY_LIMIT -> 413', async () => {
  const r = await call(port, 'POST', '/api/bot/diary', jsonOfSize(31 * 1024 * 1024), { 'x-bot-api-key': 'wrong' });
  assert.equal(r.status, 413);
});

test('M13: proxied requests to the bot API are still 404 before any parsing', async () => {
  const r = await call(port, 'POST', '/api/bot/connect', jsonOfSize(5 * 1024 * 1024), { 'x-forwarded-for': '1.2.3.4' });
  assert.equal(r.status, 404);
});

// Review round: GET /api/csrf-token has its own limiter (CSRF_TOKEN_RATE_LIMIT_MAX
// is set low for this boot, see the spawn env).
test('Review: /api/csrf-token is rate limited per IP', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await call(port, 'GET', '/api/csrf-token');
  assert.equal(last.status, 429);
  const other = await call(port, 'GET', '/api/csrf-token', undefined, { 'cf-connecting-ip': '198.51.100.99' });
  assert.equal(other.status, 200, 'another IP is unaffected');
});
