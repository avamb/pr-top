'use strict';
// Ported from the wave-2 track H (H13) scratch suite.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { setupEnv, check, run, dep, src } = require('./helpers/checks');
setupEnv('h13');
const express = dep('express');
const cookieParser = dep('cookie-parser');
const jwt = dep('jsonwebtoken');
const bcrypt = dep('bcryptjs');
const WebSocket = dep('ws');

run('token_version revocation, HS256 pin, logout, websocket (wave 2 track H)', async () => {
  const conn = src('db/connection');
  await conn.initDatabase();
  const db = conn.getDatabase();

  const info = db.exec('PRAGMA table_info(users)')[0].values;
  const tvCol = info.find(r => r[1] === 'token_version');
  check('users.token_version column exists', !!tvCol);
  check('token_version NOT NULL DEFAULT 0', tvCol && tvCol[3] === 1 && String(tvCol[4]) === '0', tvCol);
  // Idempotency: re-running the ALTER throws (duplicate column) and is swallowed by the migration.
  let dupThrows = false;
  try { db.run('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0'); } catch (e) { dupThrows = true; }
  check('migration re-run is a no-op (duplicate column throws, caught in applySchema)', dupThrows);

  const hash = await bcrypt.hash('Passw0rdA', 4);
  db.run("INSERT INTO users (email, password_hash, role, email_verified_at) VALUES ('t1@test.local', ?, 'therapist', datetime('now'))", [hash]);
  const uid = db.exec("SELECT id FROM users WHERE email='t1@test.local'")[0].values[0][0];
  const adminId = db.exec("SELECT id FROM users WHERE role='superadmin'")[0].values[0][0];
  check('new user token_version defaults to 0', db.exec('SELECT token_version FROM users WHERE id=?', [uid])[0].values[0][0] === 0);

  const { authenticate, requireActiveSubscription } = src('middleware/auth');
  const ws = src('services/websocketService');
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', src('routes/auth'));
  app.use('/api/admin', src('routes/admin'));
  app.get('/api/protected', authenticate, (r, s) => s.json({ ok: true, id: r.user.id }));
  app.get('/api/sub', requireActiveSubscription, (r, s) => s.json({ passed: true }));
  const server = http.createServer(app);
  ws.initWebSocket(server);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  async function call(method, url, { token, body, cookie } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch (e) { /* empty */ }
    return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
  }
  // The JWT may come back in the JSON body (older API) or only as the
  // HttpOnly session_token cookie (cookie-only auth); accept either.
  function tokenOf(res) {
    if (res.json && res.json.token) return res.json.token;
    const m = /session_token=([^;,\s]+)/.exec(res.setCookie || '');
    return m && m[1] ? m[1] : undefined;
  }
  function wsConnect(token) {
    return new Promise((resolve) => {
      const c = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`);
      const out = { messages: [], client: c };
      c.on('message', (m) => { out.messages.push(JSON.parse(m.toString())); if (!out.done) { out.done = true; resolve(out); } });
      c.on('close', (code) => { out.closeCode = code; if (!out.done) { out.done = true; resolve(out); } if (out.onClose) out.onClose(code); });
      c.on('error', () => {});
    });
  }
  const S = process.env.JWT_SECRET;

  // 1. Legacy token (no tv) survives the deploy
  const legacy = jwt.sign({ userId: uid, email: 't1@test.local', role: 'therapist' }, S, { expiresIn: '1h' });
  check('legacy token without tv accepted (tv=0)', (await call('GET', '/api/protected', { token: legacy })).status === 200);

  // 2. HS256 pin
  const hs512 = jwt.sign({ userId: uid, role: 'therapist' }, S, { algorithm: 'HS512', expiresIn: '1h' });
  check('HS512 token rejected by authenticate', (await call('GET', '/api/protected', { token: hs512 })).status === 401);
  check('HS512 token rejected by /me', (await call('GET', '/api/auth/me', { token: hs512 })).status === 401);
  const wsHs = await wsConnect(hs512);
  check('HS512 token rejected by websocket (4001)', wsHs.closeCode === 4001, wsHs.closeCode);
  const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ userId: uid, role: 'therapist' })).toString('base64url') + '.';
  check('alg=none token rejected', (await call('GET', '/api/protected', { token: none })).status === 401);

  // 3. Login issues tv claim
  const login = await call('POST', '/api/auth/login', { body: { email: 't1@test.local', password: 'Passw0rdA' } });
  check('login 200', login.status === 200, login);
  const t0 = tokenOf(login);
  const dec0 = jwt.decode(t0, { complete: true });
  check('login token has tv=0 and HS256 header', dec0.payload.tv === 0 && dec0.header.alg === 'HS256', dec0);
  check('/me works with fresh token', (await call('GET', '/api/auth/me', { token: t0 })).status === 200);
  check('/me works with cookie-only session', (await call('GET', '/api/auth/me', { cookie: 'session_token=' + t0 })).status === 200);

  // 4. Websocket accepts current token
  const wsOk = await wsConnect(t0);
  check('websocket accepts current token', wsOk.messages[0] && wsOk.messages[0].type === 'connected', wsOk.closeCode);

  // 5. logout = this device only
  const lo = await call('POST', '/api/auth/logout', { token: t0 });
  check('logout 200 + clears cookie', lo.status === 200 && /session_token=;/.test(lo.setCookie || ''), lo.setCookie);
  check('logout does not revoke other devices', (await call('GET', '/api/protected', { token: t0 })).status === 200);

  // 6. Password reset bumps token_version
  db.run("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [uid, require('crypto').createHash('sha256').update('rt-1').digest('hex'), new Date(Date.now() + 3600e3).toISOString()]);
  const wsClosed = new Promise(r => { wsOk.onClose = r; if (wsOk.closeCode) r(wsOk.closeCode); });
  const rp = await call('POST', '/api/auth/reset-password', { body: { token: 'rt-1', password: 'NewPassw0rd' } });
  check('reset-password 200', rp.status === 200, rp);
  check('token_version is 1 after reset', db.exec('SELECT token_version FROM users WHERE id=?', [uid])[0].values[0][0] === 1);
  check('old token 401 on authenticate after reset', (await call('GET', '/api/protected', { token: t0 })).status === 401);
  check('legacy token 401 after reset', (await call('GET', '/api/protected', { token: legacy })).status === 401);
  check('old token 401 on /me after reset', (await call('GET', '/api/auth/me', { token: t0 })).status === 401);
  const code = await Promise.race([wsClosed, new Promise(r => setTimeout(() => r('timeout'), 2000))]);
  check('open websocket closed with 4001 on reset', code === 4001, code);
  const wsStale = await wsConnect(t0);
  check('websocket rejects revoked token (4001)', wsStale.closeCode === 4001, wsStale.closeCode);
  const subStale = await call('GET', '/api/sub', { token: t0 });
  check('requireActiveSubscription passes revoked token on to authenticate (no 402)', subStale.status === 200 && subStale.json.passed, subStale);

  const login2 = await call('POST', '/api/auth/login', { body: { email: 't1@test.local', password: 'NewPassw0rd' } });
  const t1 = tokenOf(login2);
  check('new login after reset carries tv=1 and works', jwt.decode(t1).tv === 1 && (await call('GET', '/api/protected', { token: t1 })).status === 200);

  // 7. logout-all bumps
  const la = await call('POST', '/api/auth/logout-all', { token: t1 });
  check('logout-all 200', la.status === 200, la);
  check('token revoked after logout-all', (await call('GET', '/api/protected', { token: t1 })).status === 401);
  check('logout-all without token 401', (await call('POST', '/api/auth/logout-all')).status === 401);
  const audit = db.exec("SELECT COUNT(*) FROM audit_logs WHERE action='logout_all' AND actor_id=?", [uid])[0].values[0][0];
  check('logout-all audit row written', audit === 1, audit);

  // 8. Admin block bumps; unblock does not revive old tokens
  const login3 = await call('POST', '/api/auth/login', { body: { email: 't1@test.local', password: 'NewPassw0rd' } });
  const t2 = tokenOf(login3);
  const adminTok = jwt.sign({ userId: adminId, email: 'admin@test.local', role: 'superadmin', tv: 0 }, S, { expiresIn: '1h' });
  const blk = await call('PUT', `/api/admin/therapists/${uid}/block`, { token: adminTok });
  check('admin block 200', blk.status === 200, blk);
  const tvAfterBlock = db.exec('SELECT token_version FROM users WHERE id=?', [uid])[0].values[0][0];
  check('token_version bumped by block (now 3)', tvAfterBlock === 3, tvAfterBlock);
  const unb = await call('PUT', `/api/admin/therapists/${uid}/unblock`, { token: adminTok });
  check('admin unblock 200', unb.status === 200, unb);
  check('pre-block token stays revoked after unblock', (await call('GET', '/api/protected', { token: t2 })).status === 401);
  const login4 = await call('POST', '/api/auth/login', { body: { email: 't1@test.local', password: 'NewPassw0rd' } });
  check('fresh login after unblock works', (await call('GET', '/api/protected', { token: tokenOf(login4) })).status === 200);

  // 9. Helper semantics
  const { isTokenVersionCurrent } = src('utils/session');
  check('isTokenVersionCurrent semantics', isTokenVersionCurrent({}, 0) && !isTokenVersionCurrent({}, 1) && isTokenVersionCurrent({ tv: 2 }, 2) && !isTokenVersionCurrent({ tv: '1' }, 1) && isTokenVersionCurrent({ tv: 0 }, null));

  server.close();
});
