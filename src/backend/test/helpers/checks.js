'use strict';
// Shared helpers for the backend test suites (node:test).
//
// Every suite file runs in its own process (`node --test` does that), because
// db/connection.js keeps the database in module-level state. Each file must
// call setupEnv() BEFORE requiring anything from src/.
//
//   const { setupEnv, check, run, SRC, BACKEND } = require('./helpers/checks');
//   const env = setupEnv('mysuite');           // dummy env + temp DB path
//   run('my suite', async (t) => { ...; check('name', cond, extra); });
//
// check() records a result without throwing; run() turns each recorded check
// into a node:test subtest once the body finishes, so one run reports every
// failing assertion (same behaviour as the original scratch suites).
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');

const BACKEND = path.resolve(__dirname, '..', '..');
const SRC = path.join(BACKEND, 'src');

const results = [];
const cleanups = [];

// Dummy environment + isolated temp dir. Never reads the repo .env: the
// backend's dotenv call reads .env from the CWD, so we also chdir to the temp
// dir. Returns { tmp, dbFile }.
function setupEnv(label, extraEnv = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `prtop-${label}-`));
  const dbFile = path.join(tmp, 'test.db');
  Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-xxxxxxxxxxxx',
    ENCRYPTION_MASTER_KEY: 'test-master-xxxxxxxxxxxx',
    BOT_API_KEY: 'test-bot-key-xxxxxxxx',
    SIGNED_LINK_SECRET: 'test-signed-link-secret-xxxx',
    LOGIN_CODE_PEPPER: 'test-login-pepper-xxxxxxxx',
    DATABASE_URL: 'sqlite:' + dbFile.split(path.sep).join('/'),
    BACKUP_DIR: path.join(tmp, 'backups'),
    SUPERADMIN_EMAIL: 'admin@test.local',
    SUPERADMIN_PASSWORD: 'Admin123!test',
    LOG_LEVEL: 'error',
    TELEGRAM_BOT_TOKEN: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
  }, extraEnv);
  for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) {
    if (process.env[k] === '') delete process.env[k];
  }
  process.chdir(tmp);
  cleanups.push(() => fs.rmSync(tmp, { recursive: true, force: true }));
  return { tmp, dbFile };
}

// The modules under test start timers (scheduler, caches, save debounce) that
// keep the process alive after the last test, and `--test-force-exit` can cut
// the process off before the final TAP lines are flushed. So each suite file
// exits itself shortly after its last test, with a failing exit code if any
// check failed.
let anyFailed = false;
after(() => {
  setTimeout(() => process.exit(anyFailed ? 1 : 0), 300);
});

function check(name, cond, extra) {
  results.push({ name, pass: !!cond, extra });
}

// Throwing variant (aborts the suite at the first failure).
function ok(cond, name) {
  assert.ok(cond, name);
}

// Run `fn(t)` as one top-level test; afterwards report every check() as a
// subtest. A body that throws fails the parent test, and the checks recorded
// so far are still reported.
function run(name, fn) {
  test(name, async (t) => {
    try {
      await fn(t);
    } catch (e) {
      anyFailed = true;
      throw e;
    } finally {
      const batch = results.splice(0, results.length);
      if (batch.some((r) => !r.pass)) anyFailed = true;
      for (const r of batch) {
        await t.test(r.name, () => {
          assert.ok(r.pass, r.extra === undefined ? r.name : `${r.name} -> ${safeJson(r.extra)}`);
        });
      }
      for (const c of cleanups.splice(0)) { try { c(); } catch (_) { /* best effort */ } }
    }
  });
}

function safeJson(v) {
  try { return JSON.stringify(v); } catch (_) { return String(v); }
}

// Minimal JSON HTTP client against a listening server or port.
const http = require('node:http');
function request(portOrServer, method, url, { token, body, headers, raw } = {}) {
  const port = typeof portOrServer === 'number' ? portOrServer : portOrServer.address().port;
  return new Promise((resolve, reject) => {
    const data = body === undefined || body === null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const h = Object.assign(
      { 'content-type': 'application/json' },
      token ? { authorization: 'Bearer ' + token } : {},
      headers || {},
      data ? { 'content-length': Buffer.byteLength(data) } : {}
    );
    const r = http.request({ host: '127.0.0.1', port, method, path: url, headers: h }, (res) => {
      let s = '';
      res.on('data', (c) => (s += c));
      res.on('end', () => {
        let j = null; try { j = JSON.parse(s); } catch (_) { /* not json */ }
        resolve({ status: res.statusCode, body: j, json: j, raw: s, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const dep = (m) => require(path.join(BACKEND, 'node_modules', m));
const src = (p) => require(path.join(SRC, p));

module.exports = { setupEnv, check, ok, run, request, dep, src, SRC, BACKEND };
