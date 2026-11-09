'use strict';
// Cookie-only auth backend checks (wave 3 track K): boots the REAL backend
// (src/index.js) from a temp CWD with dummy env and a temp DB, then checks
//  - login/register bodies carry no token, session cookie is HttpOnly + SameSite=Strict
//  - cookie GET works; cookie POST needs CSRF; Bearer is still accepted (non-browser clients)
//  - websocket: cookie auth on upgrade, Origin check, deprecated ?token= fallback
// The browser e2e (Playwright) is not part of `npm test`.
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { check, run, dep, BACKEND } = require('./helpers/checks');
require('./helpers/exit');

const WebSocket = dep('ws');
const HOST = '127.0.0.1';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'prtop-k-boot-'));
const ADMIN = { email: 'admin@test.local', password: 'Admin123!test' };

function freePort() {
  return new Promise((resolve) => { const s = net.createServer(); s.listen(0, HOST, () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}

function makeCaller(port) {
  return function call(method, urlPath, { headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({ host: HOST, port, method, path: urlPath, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => { let json = null; try { json = JSON.parse(buf); } catch (e) { /* not json */ } resolve({ status: res.statusCode, json, headers: res.headers, text: buf }); });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  };
}

function wsTry(url, headers) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    const out = { frames: [], closed: null };
    ws.on('message', (m) => out.frames.push(String(m)));
    ws.on('close', (code) => { out.closed = code; resolve(out); });
    ws.on('error', () => { /* close follows */ });
    setTimeout(() => { out.timeout = true; try { ws.close(); } catch (e) { /* ignore */ } }, 1500);
  });
}

run('cookie-only auth: login body, CSRF gate, websocket (wave 3 track K)', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(BACKEND, 'src', 'index.js')], {
    cwd: TMP, // no .env here
    env: Object.assign({}, process.env, {
      NODE_ENV: 'test', PORT: String(port), LOG_LEVEL: 'error',
      JWT_SECRET: 'test-jwt-secret-xxxxxxxxxxxxxxxx', ENCRYPTION_MASTER_KEY: 'test-master-key-xxxxxxxxxxxxxxxx',
      BOT_API_KEY: 'test-bot-api-key-xxxxxxxxxxxxxx', SIGNED_LINK_SECRET: 'test-signed-link-xxxxxxxxxxxxxx',
      LOGIN_CODE_PEPPER: 'test-pepper-xxxxxxxxxxxxxxxxxxxx',
      DATABASE_URL: 'sqlite:' + path.join(TMP, 'db.sqlite').split(path.sep).join('/'),
      SUPERADMIN_EMAIL: ADMIN.email, SUPERADMIN_PASSWORD: ADMIN.password, BACKUP_DIR: path.join(TMP, 'backups'),
      STRIPE_SECRET_KEY: '', SMTP_HOST: '', OPENAI_API_KEY: '', TELEGRAM_BOT_TOKEN: '', ANTIBOT_ENABLED: 'false',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  try {
    const call = makeCaller(port);
    const deadline = Date.now() + 90000;
    for (;;) {
      try { const r = await call('GET', '/api/health/live'); if (r.status === 200) break; } catch (_) { /* not up yet */ }
      if (Date.now() > deadline) throw new Error('backend did not start');
      await new Promise((r) => setTimeout(r, 500));
    }

    const csrf = (await call('GET', '/api/csrf-token')).json.csrfToken;
    // Register a fresh therapist: the body must carry the user and no token.
    const reg = await call('POST', '/api/auth/register', { headers: { 'X-CSRF-Token': csrf }, body: { email: `k${Date.now()}@example.test`, password: 'Sup3r-Secret-Pass!9', role: 'therapist', language: 'en', timezone: 'UTC' } });
    if (reg.status === 201 || reg.status === 200) {
      check('register body has no token', !reg.json || !('token' in reg.json), Object.keys(reg.json || {}));
    } else {
      // Register may be gated (anti-bot / verification flow): not what is tested here.
      check('register did not 5xx', reg.status < 500, reg.status);
    }

    const login = await call('POST', '/api/auth/login', { headers: { 'X-CSRF-Token': csrf }, body: { email: ADMIN.email, password: ADMIN.password } });
    check('login 200', login.status === 200, login.status);
    check('login body has user and no token', !!login.json && !!login.json.user && !('token' in login.json));
    const setCookie = [].concat(login.headers['set-cookie'] || []).find((c) => c.startsWith('session_token='));
    check('session cookie is HttpOnly + SameSite=Strict', !!setCookie && /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie), setCookie);
    if (!setCookie) throw new Error('no session cookie, cannot continue');
    const jwt = setCookie.split(';')[0].split('=')[1];
    const cookie = `session_token=${jwt}`;

    check('GET /api/auth/me with cookie only -> 200', (await call('GET', '/api/auth/me', { headers: { Cookie: cookie } })).status === 200);
    check('GET /api/auth/me with nothing -> 401', (await call('GET', '/api/auth/me')).status === 401);

    const noCsrf = await call('POST', '/api/auth/logout-all', { headers: { Cookie: cookie } });
    check('cookie POST without CSRF -> 403 CSRF', noCsrf.status === 403 && /CSRF/.test(noCsrf.text), noCsrf.status);
    const badCsrf = await call('POST', '/api/auth/logout-all', { headers: { Cookie: cookie, 'X-CSRF-Token': 'deadbeef' } });
    check('cookie POST with unknown CSRF -> 403 CSRF', badCsrf.status === 403 && /CSRF/.test(badCsrf.text));
    const patch = await call('PATCH', '/api/profile/language', { headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: { language: 'en' } });
    check('cookie PATCH with CSRF passes the CSRF gate', patch.status !== 403 || !/CSRF/.test(patch.text), patch.status);
    const bearer = await call('PATCH', '/api/profile/language', { headers: { Authorization: 'Bearer ' + jwt }, body: { language: 'en' } });
    check('Bearer (non-browser client) still accepted without CSRF', bearer.status !== 401 && !/CSRF/.test(bearer.text), bearer.status);

    const origin = `http://${HOST}:${port}`;
    const wsUrl = `ws://${HOST}:${port}/ws`;
    const wsCookie = await wsTry(wsUrl, { Cookie: cookie, Origin: origin });
    check('WS cookie auth (same-origin) -> connected frame', wsCookie.frames.some((f) => f.includes('"connected"')), wsCookie.frames);
    const wsNoOrigin = await wsTry(wsUrl, { Cookie: cookie });
    check('WS cookie auth without Origin header (non-browser) -> connected', wsNoOrigin.frames.some((f) => f.includes('"connected"')));
    const wsEvil = await wsTry(wsUrl, { Cookie: cookie, Origin: 'https://evil.example' });
    check('WS cookie auth from foreign Origin -> closed 4003, no frames', wsEvil.closed === 4003 && wsEvil.frames.length === 0, wsEvil.closed);
    const wsNone = await wsTry(wsUrl, {});
    check('WS with no credentials -> closed 4001', wsNone.closed === 4001, wsNone.closed);
    const wsQuery = await wsTry(`${wsUrl}?token=${jwt}`, {});
    check('WS deprecated ?token= fallback still works', wsQuery.frames.some((f) => f.includes('"connected"')));
    const wsBad = await wsTry(wsUrl, { Cookie: 'session_token=garbage', Origin: origin });
    check('WS with garbage cookie -> closed 4001', wsBad.closed === 4001, wsBad.closed);
  } finally {
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* windows: db handle may be busy */ }
  }
});
