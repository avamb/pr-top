'use strict';
// Ported from the wave-2 orchestrator scratch suite.
const { setupEnv, check, run, request, dep, src } = require('./helpers/checks');
setupEnv('orch');
const express = dep('express');
const jwt = dep('jsonwebtoken');
const tok = (id, role, tv) => jwt.sign({ userId: id, role, ...(tv != null ? { tv } : {}) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const req = (port, method, url, { token, body, headers } = {}) => request(port, method, url, { token, body, headers });

run('admin link, revoked tokens, voice-query gate (wave 2 orchestrator checks)', async () => {
  const conn = src('db/connection.js'); await conn.initDatabase(); const db = conn.getDatabase();
  const one = (s, p = []) => { const r = db.exec(s, p); return r.length && r[0].values.length ? r[0].values[0] : null; };
  const ins = (s, p) => { db.run(s, p); return one('SELECT last_insert_rowid()')[0]; };
  const T1 = ins("INSERT INTO users (email,password_hash,role,telegram_id) VALUES ('t1@x.t','x','therapist','777')");
  const TB = ins("INSERT INTO users (email,password_hash,role,blocked_at) VALUES ('tb@x.t','x','therapist',datetime('now'))");
  const SA = ins("INSERT INTO users (email,password_hash,role) VALUES ('sa@x.t','x','superadmin')");
  const C1 = ins("INSERT INTO users (email,password_hash,role) VALUES ('c1@x.t','x','client')");
  const { authenticate } = src('middleware/auth.js');
  const app = express(); app.use(express.json());
  app.use('/api/clients', authenticate, src('routes/clients.js'));
  app.use('/api/exercises', src('routes/exercises.js'));
  app.use('/api/subscription', src('routes/subscription.js'));
  app.use('/api/bot', src('routes/bot.js'));
  const srv = app.listen(0); const port = srv.address().port;
  db.run("INSERT INTO subscriptions (therapist_id, plan, status, created_at) VALUES (?, 'pro', 'active', datetime('now'))", [T1]);
  const sa = tok(SA, 'superadmin');
  let r = await req(port, 'POST', '/api/clients/link', { token: sa, body: { client_id: C1 } });
  check('link without target -> 400', r.status === 400, r);
  r = await req(port, 'POST', '/api/clients/link', { token: sa, body: { client_id: C1, target_therapist_id: SA } });
  check('link to self -> 400', r.status === 400, r);
  r = await req(port, 'POST', '/api/clients/link', { token: sa, body: { client_id: C1, target_therapist_id: TB } });
  check('link to blocked therapist -> 400', r.status === 400, r);
  r = await req(port, 'POST', '/api/clients/link', { token: sa, body: { client_id: C1, target_therapist_id: T1 } });
  check('link to active therapist -> ok', r.status === 200 && one('SELECT therapist_id FROM users WHERE id=?', [C1])[0] === T1, r);
  check('admin link does not grant consent', one('SELECT consent_therapist_access FROM users WHERE id=?', [C1])[0] === 0, r.body);
  db.run('UPDATE users SET consent_therapist_access = 1 WHERE id = ?', [C1]); // client consents via bot
  // exercises/subscription: revoked token rejected, valid works
  r = await req(port, 'GET', '/api/exercises', { token: tok(T1, 'therapist') });
  check('exercises valid token -> 200', r.status === 200, r.status);
  db.run('UPDATE users SET token_version = 3 WHERE id = ?', [T1]);
  r = await req(port, 'GET', '/api/exercises', { token: tok(T1, 'therapist', 0) });
  check('exercises revoked token -> 401', r.status === 401, r.status);
  r = await req(port, 'GET', '/api/subscription/current', { token: tok(T1, 'therapist', 0) });
  check('subscription revoked token -> 401', r.status === 401, r.status);
  r = await req(port, 'GET', '/api/subscription/current', { token: tok(T1, 'therapist', 3) });
  check('subscription current token -> not 401', r.status !== 401 && r.status < 500, r);
  r = await req(port, 'GET', '/api/subscription/current', { token: jwt.sign({ userId: T1, role: 'therapist', tv: 3 }, process.env.JWT_SECRET, { algorithm: 'HS512' }) });
  check('subscription HS512 token -> 401', r.status === 401, r.status);
  // bot voice-query gate: canceled-in-grace pro is allowed past the gate
  const future = new Date(Date.now() + 5 * 864e5).toISOString();
  db.run("DELETE FROM subscriptions WHERE therapist_id = ?", [T1]);
  db.run("INSERT INTO subscriptions (therapist_id, plan, status, current_period_end, created_at) VALUES (?, 'pro', 'canceled', ?, datetime('now'))", [T1, future]);
  const voiceUrl = '/voice-query';
  const bk = { 'x-bot-api-key': process.env.BOT_API_KEY };
  r = await req(port, 'POST', '/api/bot' + voiceUrl, { headers: bk, body: { telegram_id: '777', client_id: C1, voice_text: 'hello' } });
  check('voice: canceled-in-grace pro passes gate', r.status !== 403 && r.status !== 400, r);
  db.run("UPDATE subscriptions SET current_period_end = ? WHERE therapist_id = ?", [new Date(Date.now() - 864e5).toISOString(), T1]);
  r = await req(port, 'POST', '/api/bot' + voiceUrl, { headers: bk, body: { telegram_id: '777', client_id: C1, voice_text: 'hello' } });
  check('voice: canceled past period -> 403 inactive', r.status === 403 && r.body.error === 'Subscription inactive', r);
  db.run("UPDATE subscriptions SET status='active', plan='basic' WHERE therapist_id = ?", [T1]);
  r = await req(port, 'POST', '/api/bot' + voiceUrl, { headers: bk, body: { telegram_id: '777', client_id: C1, voice_text: 'hello' } });
  check('voice: basic -> 403 upgrade', r.status === 403 && r.body.error === 'Plan upgrade required', r);
  srv.close();
});
