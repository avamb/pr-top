'use strict';
// Ported from the wave-2 track E review-fix scratch suite.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { setupEnv, check, run, request, dep, SRC, BACKEND } = require('./helpers/checks');
const { dbFile: DB_FILE } = setupEnv('access2');
const express = dep('express');
const jwt = dep('jsonwebtoken');
const tokenFor = (id, role) => jwt.sign({ userId: id, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const req = (port, method, url, { token, body, botKey } = {}) =>
  request(port, method, url, { token, body, headers: botKey ? { 'x-bot-api-key': botKey } : {} });

run('restore migration, link consent, share revival, comment visibility (wave 2 track E fixes)', async () => {
  const conn = require(path.join(SRC, 'db/connection.js'));
  await conn.initDatabase();
  let db = conn.getDatabase();
  const one = (sql, p = []) => { const r = conn.getDatabase().exec(sql, p); return r.length && r[0].values.length ? r[0].values[0] : null; };
  const ins = (sql, p) => { conn.getDatabase().run(sql, p); return one('SELECT last_insert_rowid()')[0]; };
  const run = (sql, p = []) => conn.getDatabase().run(sql, p);
  const { encrypt } = require(path.join(SRC, 'services/encryption.js'));
  const enc = (s) => encrypt(s).encrypted;

  const T1 = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('t1@x.test','x','therapist','en')");
  const T2 = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('t2@x.test','x','therapist','en')");
  const SA = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('sa2@x.test','x','superadmin','en')");
  const C1 = ins("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language, telegram_id) VALUES ('c1@x.test','x','client',?,1,'en','8001')", [T1]);
  for (const t of [T1, T2]) ins("INSERT INTO subscriptions (therapist_id, plan, status) VALUES (?, 'premium', 'active')", [t]);
  const C3 = ins("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language, telegram_id) VALUES ('c3@x.test','x','client',NULL,1,'en','8003')");

  const app = express();
  app.use(express.json());
  app.use('/api/comments', require(path.join(SRC, 'routes/comments.js')));
  app.use('/api/clients', require(path.join(SRC, 'routes/clients.js')));
  app.use('/api/bot', require(path.join(SRC, 'routes/bot.js')));
  app.use('/api/share', require(path.join(SRC, 'routes/supervisionShare.js')));
  app.use('/api/search', require(path.join(SRC, 'routes/search.js')));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const BK = 'test-bot-key-xxxxxxxx';
  const tk = { T1: tokenFor(T1, 'therapist'), T2: tokenFor(T2, 'therapist'), SA: tokenFor(SA, 'superadmin') };
  const share = require(path.join(SRC, 'services/supervisionShare.js'));
  const backdate = () => { run("UPDATE sessions SET created_at = datetime('now','-2 hours'), updated_at = datetime('now','-2 hours')"); };

  // ===== 3. share links do not revive =====
  console.log('3. share link revival');
  const L1 = share.createLink({ therapistId: T1, clientId: C1, ttl: '7d' });
  let r = await req(port, 'POST', '/api/bot/revoke-consent', { botKey: BK, body: { telegram_id: '8001' } });
  check('bot revoke-consent 200', r.status === 200, r);
  check('revoke-consent revoked the link eagerly', !!one('SELECT revoked_at FROM supervision_share_links WHERE id = ?', [L1.id])[0]);
  // Audit M7 (wave 3): consent only links to the therapist from the client's own /connect.
  run("UPDATE users SET pending_connect_therapist_id = ?, pending_connect_at = datetime('now') WHERE telegram_id = '8001'", [T1]);
  r = await req(port, 'POST', '/api/bot/consent', { botKey: BK, body: { telegram_id: '8001', therapist_id: T1, consent: true, consent_version: 2 } });
  check('client re-consents to T1', r.status === 200 && r.body.linked === true, r);
  r = await req(port, 'GET', `/api/share/supervision/${L1.token}`);
  check('old link stays dead after re-consent', r.status === 404, r.status);

  // backstop: consent toggled without the handler, only audit rows (e.g. DB restored / older code)
  const L2 = share.createLink({ therapistId: T1, clientId: C1, ttl: '7d' });
  run("INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at) VALUES (?, 'consent_granted', 'user', ?, datetime('now','+5 seconds'))", [C1, T1]);
  check('backstop: consent re-granted after link -> problem', share.linkAccessProblem(conn.getDatabase(), { id: L2.id, therapist_id: T1, client_id: C1, created_at: L2.created_at }) === 'consent_changed_since_link');
  r = await req(port, 'GET', `/api/clients/${C1}/supervision-share`, { token: tk.T1 });
  const l2 = r.body && r.body.links.find((x) => x.id === L2.id);
  check('listLinks shows backstopped link as inactive/revoked', r.status === 200 && l2 && l2.is_active === false && l2.is_revoked === true, r.body);
  r = await req(port, 'GET', `/api/share/supervision/${L2.token}`);
  check('backstopped link 404', r.status === 404, r.status);
  // a fresh link after the re-consent works (audit row is in the future relative to now: move it back)
  run("UPDATE audit_logs SET created_at = datetime('now','-1 minute') WHERE action = 'consent_granted' AND actor_id = ?", [C1]);
  const L3 = share.createLink({ therapistId: T1, clientId: C1, ttl: '7d' });
  r = await req(port, 'GET', `/api/share/supervision/${L3.token}`);
  check('fresh link created after re-consent works', r.status === 200, r.status);

  // client moves to another therapist through /consent (defensive path)
  // (wave 3 M7: the client first has to /connect to T2)
  run("UPDATE users SET pending_connect_therapist_id = ?, pending_connect_at = datetime('now') WHERE telegram_id = '8001'", [T2]);
  r = await req(port, 'POST', '/api/bot/consent', { botKey: BK, body: { telegram_id: '8001', therapist_id: T2, consent: true, consent_version: 2 } });
  check('consent to a different therapist revokes old links', r.status === 200 && !!one('SELECT revoked_at FROM supervision_share_links WHERE id = ?', [L3.id])[0], r);
  run('UPDATE users SET therapist_id = ? WHERE id = ?', [T1, C1]);

  // ===== 2. /link no longer forces consent =====
  console.log('2. /link consent');
  const L4 = share.createLink({ therapistId: T1, clientId: C1, ttl: '7d' });
  r = await req(port, 'POST', '/api/clients/link', { token: tk.SA, body: { client_id: C3, target_therapist_id: T2 } });
  check('superadmin /link 200', r.status === 200, r);
  const c3 = one('SELECT therapist_id, consent_therapist_access FROM users WHERE id = ?', [C3]);
  check('/link sets therapist only, consent NOT granted (stale 1 reset to 0)', c3[0] === T2 && c3[1] === 0, c3);
  check('/link response reports consent false', r.body && r.body.consent_therapist_access === false, r.body);
  r = await req(port, 'POST', `/api/clients/${C3}/supervision-share`, { token: tk.T2, body: { ttl: '1d' } });
  check('share creation for unconsented relinked client -> 403', r.status === 403, r);
  r = await req(port, 'POST', '/api/clients/link', { token: tk.SA, body: { client_id: C3, target_therapist_id: SA } });
  check('/link to self still refused', r.status === 400, r.status);
  check('L4 (other client) unaffected', !one('SELECT revoked_at FROM supervision_share_links WHERE id = ?', [L4.id])[0]);
  const { warnClientsLinkedToSuperadmin } = require(path.join(SRC, 'utils/consentCheck.js'));
  check('warnClientsLinkedToSuperadmin = 0', warnClientsLinkedToSuperadmin() === 0);
  run('UPDATE users SET therapist_id = ? WHERE id = ?', [SA, C3]);
  check('warnClientsLinkedToSuperadmin counts 1', warnClientsLinkedToSuperadmin() === 1);
  run('UPDATE users SET therapist_id = ? WHERE id = ?', [T2, C3]);

  // ===== 4 + 6. comments =====
  console.log('4/6. comments');
  run("INSERT INTO comments (entity_type, entity_id, author_id, author_role, visibility, content_encrypted, created_at, updated_at) VALUES ('client', ?, ?, 'therapist', 'shared', ?, datetime('now','-3 hours'), datetime('now','-3 hours'))", [C1, T2, enc('OLD THERAPIST shared')]);
  const cmT1 = ins("INSERT INTO comments (entity_type, entity_id, author_id, author_role, visibility, content_encrypted, created_at, updated_at) VALUES ('client', ?, ?, 'therapist', 'shared', ?, datetime('now','-3 hours'), datetime('now','-3 hours'))", [C1, T1, enc('T1 shared')]);
  const cmC1 = ins("INSERT INTO comments (entity_type, entity_id, author_id, author_role, visibility, content_encrypted, created_at, updated_at) VALUES ('client', ?, ?, 'client', 'shared', ?, datetime('now','-3 hours'), datetime('now','-3 hours'))", [C1, C1, enc('CLIENT shared')]);
  r = await req(port, 'GET', `/api/comments?entity_type=client&entity_id=${C1}`, { token: tk.T1 });
  const txt = JSON.stringify(r.body);
  check('current therapist sees own + client shared', r.status === 200 && txt.includes('T1 shared') && txt.includes('CLIENT shared'), r.body);
  check('current therapist does NOT see previous therapist shared comment', !txt.includes('OLD THERAPIST'));
  r = await req(port, 'DELETE', `/api/comments/${cmT1}`, { token: tk.SA });
  check('superadmin delete -> 403', r.status === 403, r);
  r = await req(port, 'DELETE', `/api/comments/${cmC1}`, { token: tk.T1 });
  check('therapist cannot delete client-authored comment', r.status === 403, r);
  r = await req(port, 'DELETE', `/api/comments/${cmT1}`, { token: tk.T1 });
  check('author delete ok', r.status === 200, r);

  // ===== 7. H4 updated_at strictness =====
  console.log('7. H4 updated_at');
  ins("INSERT INTO inquiries (client_id, therapist_id, title_encrypted, created_at, updated_at) VALUES (?,?,?, datetime('now','-3 hours'), datetime('now','-3 hours'))", [C1, T1, enc('INQ unchanged')]);
  const inqEdited = ins("INSERT INTO inquiries (client_id, therapist_id, title_encrypted, created_at, updated_at) VALUES (?,?,?, datetime('now','-3 hours'), datetime('now','-3 hours'))", [C1, T1, enc('INQ edited later')]);
  const L5 = share.createLink({ therapistId: T1, clientId: C1, ttl: '7d' });
  run("UPDATE inquiries SET updated_at = datetime('now','+1 hour') WHERE id = ?", [inqEdited]);
  run("UPDATE comments SET updated_at = datetime('now','+1 hour') WHERE id = ?", [cmC1]);
  r = await req(port, 'GET', `/api/share/supervision/${L5.token}`);
  const v = JSON.stringify(r.body);
  check('view keeps unchanged inquiry', r.status === 200 && v.includes('INQ unchanged'), r.status);
  check('view excludes inquiry edited after link', !v.includes('INQ edited later'));
  check('view excludes comment edited after link', !v.includes('CLIENT shared'));

  // ===== 5. vectorStore ensure retry + VACUUM in transaction =====
  console.log('5. vectorStore ensure');
  const vsPath = require.resolve(path.join(SRC, 'services/vectorStore.js'));
  let vs = require(vsPath);
  vs.ensureTable();
  const D1 = ins("INSERT INTO diary_entries (client_id, entry_type, content_encrypted) VALUES (?, 'text', ?)", [C1, enc('x')]);
  const vrow = ins("INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count) VALUES ('diary_entry', ?, ?, ?, '1:1.0', 'PLAIN retry me', 1)", [D1, C1, T1]);
  run("CREATE TRIGGER block_ve_update BEFORE UPDATE ON vector_embeddings BEGIN SELECT RAISE(ABORT, 'blocked for test'); END");
  delete require.cache[vsPath]; vs = require(vsPath);
  vs.ensureTable();
  check('failed migration leaves plaintext (blocked)', one('SELECT text_preview FROM vector_embeddings WHERE id = ?', [vrow])[0] === 'PLAIN retry me');
  run('DROP TRIGGER block_ve_update');
  vs.ensureTable(); // same module instance: must retry because the first run failed
  check('ensureTable retried after failure and encrypted', vs.isEncryptedPreview(one('SELECT text_preview FROM vector_embeddings WHERE id = ?', [vrow])[0]));
  // VACUUM skipped inside an open transaction
  const D2 = ins("INSERT INTO diary_entries (client_id, entry_type, content_encrypted, is_private) VALUES (?, 'text', ?, 1)", [C1, enc('p')]);
  ins("INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count) VALUES ('diary_entry', ?, ?, ?, '1:1.0', NULL, 1)", [D2, C1, T1]);
  delete require.cache[vsPath]; vs = require(vsPath);
  run('BEGIN');
  let threw = null;
  try { vs.ensureTable(); } catch (e) { threw = e.message; }
  let stillOpen = false;
  try { run('COMMIT'); stillOpen = true; } catch (_) { stillOpen = false; }
  check('ensureTable inside transaction does not throw', threw === null, threw);
  check('caller transaction still open (VACUUM skipped)', stillOpen);
  check('private embedding purged inside txn', one("SELECT COUNT(*) FROM vector_embeddings WHERE source_type='diary_entry' AND source_id = ?", [D2])[0] === 0);

  // ===== 1. restore of a pre-wave-2 image =====
  console.log('1. restore migration');
  // Build an "old" image: no token_version, no stripe_webhook_events, plaintext preview.
  const SqlJs = await require(path.join(BACKEND, 'node_modules/sql.js'))();
  const cur = conn.getDatabase().export();
  const old = new SqlJs.Database(cur);
  old.run('DROP TABLE IF EXISTS stripe_webhook_events');
  old.run('ALTER TABLE users DROP COLUMN token_version');
  old.run("UPDATE vector_embeddings SET text_preview = 'OLD IMAGE plaintext' WHERE id = ?", [vrow]);
  const hasTv = old.exec("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='token_version'")[0].values[0][0];
  check('old image really lacks token_version', hasTv === 0);
  const oldBuf = Buffer.from(old.export());
  old.close();
  conn.replaceDatabase(oldBuf);
  check('after restore: token_version column exists', one("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='token_version'")[0] === 1);
  check('after restore: stripe_webhook_events exists', one("SELECT COUNT(*) FROM sqlite_master WHERE name='stripe_webhook_events'")[0] === 1);
  r = await req(port, 'GET', `/api/clients/${C1}/supervision-share`, { token: tk.T1 });
  check('authenticate works right after restore (no 500)', r.status === 200, r);
  check('restored plaintext preview encrypted immediately', vs.isEncryptedPreview(one('SELECT text_preview FROM vector_embeddings WHERE id = ?', [vrow])[0]));
  const onDisk = new SqlJs.Database(fs.readFileSync(DB_FILE));
  check('migrated image persisted to disk', onDisk.exec("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='token_version'")[0].values[0][0] === 1);
  onDisk.close();
  // a broken image (migration fails) leaves the live DB untouched
  const bad = new SqlJs.Database();
  bad.run("CREATE TABLE users (id INTEGER PRIMARY KEY, nonsense TEXT)");
  bad.run("CREATE VIEW sessions AS SELECT 1 AS id");
  const badBuf = Buffer.from(bad.export()); bad.close();
  const liveBefore = conn.getDatabase();
  let restoreErr = null;
  try { conn.replaceDatabase(badBuf); } catch (e) { restoreErr = e.message; }
  check('failed migration -> replaceDatabase throws', !!restoreErr && /schema migration/.test(restoreErr), restoreErr);
  check('failed migration -> live DB handle unchanged', conn.getDatabase() === liveBefore);
  r = await req(port, 'GET', `/api/clients/${C1}/supervision-share`, { token: tk.T1 });
  check('still serving after rejected restore', r.status === 200, r.status);

  server.close();
});
