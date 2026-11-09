'use strict';
// Ported from the wave-2 track E scratch suite (H3/H4/H5/H6/M6).
const path = require('path');
const fs = require('fs');
const http = require('http');
const { setupEnv, check, run, request, dep, SRC } = require('./helpers/checks');
const { dbFile: DB_FILE } = setupEnv('access');
const express = dep('express');
const jwt = dep('jsonwebtoken');
const tokenFor = (id, role) => jwt.sign({ userId: id, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const req = (port, method, url, { token, body, botKey } = {}) =>
  request(port, method, url, { token, body, headers: botKey ? { 'x-bot-api-key': botKey } : {} });

run('access control: consent, share links, comments, retention (wave 2 track E)', async () => {
  const conn = require(path.join(SRC, 'db/connection.js'));
  await conn.initDatabase();
  const db = conn.getDatabase();
  const one = (sql, p = []) => { const r = db.exec(sql, p); return r.length && r[0].values.length ? r[0].values[0] : null; };
  const ins = (sql, p) => { db.run(sql, p); return one('SELECT last_insert_rowid()')[0]; };

  const { encrypt, decrypt } = require(path.join(SRC, 'services/encryption.js'));

  // ---- Seed ----
  const T1 = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('t1@x.test','x','therapist','en')");
  const T2 = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('t2@x.test','x','therapist','en')");
  const SA = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('sa@x.test','x','superadmin','en')");
  const V = ins("INSERT INTO users (email, password_hash, role, language) VALUES ('v@x.test','x','viewer','en')");
  const C1 = ins("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language) VALUES ('c1@x.test','x','client',?,1,'en')", [T1]);
  const C2 = ins("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language) VALUES ('c2@x.test','x','client',?,1,'en')", [T2]);
  const enc = (s) => encrypt(s).encrypted;
  const A1 = ins("INSERT INTO assignments (therapist_id, client_id, title_encrypted) VALUES (?,?,?)", [T1, C1, enc('a1')]);
  const R1 = ins("INSERT INTO assignment_reports (assignment_id, client_id, therapist_id, content_encrypted) VALUES (?,?,?,?)", [A1, C1, T1, enc('r1')]);
  const S1 = ins("INSERT INTO sessions (therapist_id, client_id, transcript_encrypted, summary_encrypted, status) VALUES (?,?,?,?, 'complete')", [T1, C1, enc('TRANSCRIPT one'), enc('SUMMARY one')]);
  const D1 = ins("INSERT INTO diary_entries (client_id, entry_type, content_encrypted) VALUES (?, 'text', ?)", [C1, enc('diary public before link')]);
  const D2 = ins("INSERT INTO diary_entries (client_id, entry_type, content_encrypted, is_private) VALUES (?, 'text', ?, 1)", [C1, enc('diary PRIVATE before link')]);

  // ---- Throwaway app ----
  const app = express();
  app.use(express.json());
  app.use('/api/comments', require(path.join(SRC, 'routes/comments.js')));
  app.use('/api/search', require(path.join(SRC, 'routes/search.js')));
  app.use('/api/sessions', require(path.join(SRC, 'routes/sessions.js')));
  app.use('/api/diary', require(path.join(SRC, 'routes/diary.js')));
  app.use('/api/encryption', require(path.join(SRC, 'routes/encryption.js')));
  app.use('/api/share', require(path.join(SRC, 'routes/supervisionShare.js')));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const tk = { T1: tokenFor(T1, 'therapist'), T2: tokenFor(T2, 'therapist'), SA: tokenFor(SA, 'superadmin'), V: tokenFor(V, 'viewer') };

  // ================= H3 comments =================
  console.log('H3 comments');
  let r = await req(port, 'POST', '/api/comments', { token: tk.T1, body: { entity_type: 'assignment', entity_id: A1, content: 'T1 private on A1' } });
  check('owner therapist can comment on own assignment', r.status === 201, r.body);
  const cPriv = r.body && r.body.id;
  r = await req(port, 'POST', '/api/comments', { token: tk.T1, body: { entity_type: 'assignment_report', entity_id: R1, content: 'T1 shared on R1', visibility: 'shared' } });
  check('owner therapist can comment on own assignment_report', r.status === 201, r.body);
  const cShared = r.body && r.body.id;
  for (const [who, t] of [['other therapist', tk.T2], ['viewer', tk.V], ['superadmin', tk.SA]]) {
    r = await req(port, 'GET', `/api/comments?entity_type=assignment&entity_id=${A1}`, { token: t });
    check(`${who} cannot list assignment comments`, r.status === 403 || r.status === 404, r);
    r = await req(port, 'GET', `/api/comments?entity_type=assignment_report&entity_id=${R1}`, { token: t });
    check(`${who} cannot list assignment_report comments`, r.status === 403 || r.status === 404, r);
    r = await req(port, 'POST', '/api/comments', { token: t, body: { entity_type: 'assignment', entity_id: A1, content: 'intrude' } });
    check(`${who} cannot write on assignment`, r.status === 403 || r.status === 404, r);
  }
  r = await req(port, 'GET', `/api/comments?entity_type=assignment&entity_id=999999`, { token: tk.T1 });
  check('unknown assignment id -> 404', r.status === 404, r);
  r = await req(port, 'GET', `/api/comments?entity_type=assignment_report&entity_id=${R1}`, { token: tk.T1 });
  check('owner lists report comments', r.status === 200 && r.body.total === 1, r.body);
  r = await req(port, 'PATCH', `/api/comments/${cShared}`, { token: tk.SA, body: { content: 'sa edit' } });
  check('superadmin cannot patch others comments', r.status === 403, r);
  // inconsistent report row -> denied
  const Rbad = ins("INSERT INTO assignment_reports (assignment_id, client_id, therapist_id, content_encrypted) VALUES (?,?,?,?)", [A1, C2, T2, enc('bad')]);
  r = await req(port, 'GET', `/api/comments?entity_type=assignment_report&entity_id=${Rbad}`, { token: tk.T2 });
  check('report whose owner disagrees with parent assignment is denied', r.status === 404, r);
  // consent revoked -> owner therapist denied
  db.run('UPDATE users SET consent_therapist_access = 0 WHERE id = ?', [C1]);
  r = await req(port, 'GET', `/api/comments?entity_type=assignment&entity_id=${A1}`, { token: tk.T1 });
  check('owner denied after consent revoked (list)', r.status === 403, r);
  r = await req(port, 'PATCH', `/api/comments/${cPriv}`, { token: tk.T1, body: { content: 'edit after revoke' } });
  check('author denied patch after consent revoked', r.status === 403, r);
  r = await req(port, 'GET', `/api/comments?entity_type=client&entity_id=${C1}`, { token: tk.T1 });
  check('client-entity comments also consent-gated', r.status === 403, r);
  db.run('UPDATE users SET consent_therapist_access = 1 WHERE id = ?', [C1]);
  const cs = require(path.join(SRC, 'services/comments.js'));
  check('canSeeComment: superadmin no longer sees shared', cs.canSeeComment({ id: SA, role: 'superadmin' }, { author_id: T1, visibility: 'shared' }, { therapist_id: T1, client_id: C1 }) === false);
  check('canSeeComment: client sees shared on own entity', cs.canSeeComment({ id: C1, role: 'client' }, { author_id: T1, visibility: 'shared' }, { therapist_id: T1, client_id: C1 }) === true);
  check('canSeeComment: client never sees private', cs.canSeeComment({ id: C1, role: 'client' }, { author_id: T1, visibility: 'private' }, { therapist_id: T1, client_id: C1 }) === false);
  check('checkEntityAccess: client allowed on own assignment', cs.checkEntityAccess(db, { id: C1, role: 'client' }, 'assignment', A1).allowed === true);
  check('checkEntityAccess: other client denied', cs.checkEntityAccess(db, { id: C2, role: 'client' }, 'assignment', A1).allowed === false);

  // ================= H5 sessions / diary / search / encryption =================
  console.log('H5 superadmin bypass');
  r = await req(port, 'GET', `/api/sessions/${S1}`, { token: tk.SA });
  check('superadmin GET /sessions/:id denied', r.status === 403, r.status);
  r = await req(port, 'GET', `/api/sessions/${S1}/transcript`, { token: tk.SA });
  check('superadmin GET transcript denied', r.status === 403, r.status);
  r = await req(port, 'GET', `/api/sessions/${S1}/summary`, { token: tk.SA });
  check('superadmin GET summary denied', r.status === 403, r.status);
  r = await req(port, 'GET', `/api/sessions/${S1}/transcript`, { token: tk.T1 });
  check('owner therapist GET transcript ok', r.status === 200 && JSON.stringify(r.body).includes('TRANSCRIPT one'), r);
  r = await req(port, 'GET', `/api/sessions/${S1}/transcript`, { token: tk.T2 });
  check('other therapist GET transcript denied', r.status === 403, r.status);
  r = await req(port, 'GET', `/api/diary/${D2}/stream`, { token: tk.SA });
  check('superadmin private diary stream -> 404', r.status === 404, r);
  r = await req(port, 'GET', `/api/diary/${D1}/stream`, { token: tk.SA });
  check('superadmin public diary stream -> 403', r.status === 403, r);
  r = await req(port, 'POST', `/api/diary/${D1}/retranscribe`, { token: tk.SA });
  check('superadmin diary retranscribe -> 403', r.status === 403, r);
  r = await req(port, 'GET', `/api/diary/${D1}/stream`, { token: tk.T1 });
  check('owner therapist diary stream passes gate (404 no audio)', r.status === 404 && /No audio/.test(r.raw), r);

  // encryption
  r = await req(port, 'POST', '/api/encryption/decrypt', { token: tk.T1, body: { encrypted: enc('secret') } });
  check('therapist /decrypt in test env -> 403', r.status === 403, r);
  r = await req(port, 'POST', '/api/encryption/decrypt', { token: tk.SA, body: { encrypted: enc('secret') } });
  check('superadmin /decrypt in test env works', r.status === 200 && r.body.plaintext === 'secret', r);
  // demoted superadmin with old JWT
  db.run("UPDATE users SET role='therapist' WHERE id = ?", [SA]);
  r = await req(port, 'POST', '/api/encryption/decrypt', { token: tk.SA, body: { encrypted: enc('secret') } });
  check('demoted admin with old superadmin JWT -> 403 (DB role)', r.status === 403, r);
  r = await req(port, 'GET', '/api/encryption/keys', { token: tk.SA });
  check('demoted admin /keys -> 403', r.status === 403, r);
  db.run("UPDATE users SET role='superadmin', blocked_at = datetime('now') WHERE id = ?", [SA]);
  r = await req(port, 'POST', '/api/encryption/rotate', { token: tk.SA });
  check('blocked superadmin /rotate -> 403', r.status === 403, r);
  db.run('UPDATE users SET blocked_at = NULL WHERE id = ?', [SA]);
  r = await req(port, 'GET', '/api/encryption/keys', { token: tk.SA });
  check('superadmin /keys ok', r.status === 200, r.status);
  process.env.NODE_ENV = 'production';
  r = await req(port, 'POST', '/api/encryption/decrypt', { token: tk.SA, body: { encrypted: enc('secret') } });
  check('production /decrypt -> 404 even for superadmin', r.status === 404, r);
  r = await req(port, 'POST', '/api/encryption/encrypt', { token: tk.SA, body: { plaintext: 'x' } });
  check('production /encrypt -> 404', r.status === 404, r.status);
  r = await req(port, 'POST', '/api/encryption/decrypt', { body: { encrypted: 'x' } });
  check('production /decrypt unauthenticated -> 404', r.status === 404, r.status);
  r = await req(port, 'GET', '/api/encryption/keys', { token: tk.SA });
  check('production /keys still superadmin-ok', r.status === 200, r.status);
  process.env.NODE_ENV = 'staging';
  r = await req(port, 'POST', '/api/encryption/decrypt', { token: tk.SA, body: { encrypted: enc('secret') } });
  check('unknown NODE_ENV fails closed -> 404', r.status === 404, r.status);
  process.env.NODE_ENV = 'test';

  // ================= H6 vector store =================
  console.log('H6 vector store');
  const vs = require(path.join(SRC, 'services/vectorStore.js'));
  // Legacy plaintext rows written directly, simulating pre-migration data.
  vs.ensureTable();
  const legacyId = ins("INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count) VALUES ('session_summary', ?, ?, ?, ?, ?, 2)", [S1, C1, T1, vs.serializeEmbedding(vs.generateEmbedding('anxiety sleep problems')), 'LEGACY plaintext anxiety sleep problems']);
  const legacyPriv = ins("INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count) VALUES ('diary_entry', ?, ?, ?, ?, ?, 2)", [D2, C1, T1, vs.serializeEmbedding(vs.generateEmbedding('private anxiety')), 'PRIVATE plaintext anxiety']);
  const kbId = ins("INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count) VALUES ('kb', 777, NULL, ?, ?, ?, 2)", [T1, vs.serializeEmbedding(vs.generateEmbedding('anxiety handout')), 'KB anxiety handout']);
  db.run("UPDATE diary_entries SET embedding_ref = 'emb_x' WHERE id = ?", [D2]);
  // Force ensureTable to re-run its migrations (simulate a fresh process).
  const vsPath = require.resolve(path.join(SRC, 'services/vectorStore.js'));
  delete require.cache[vsPath];
  const vs2 = require(vsPath);
  vs2.ensureTable();
  const legacyAfter = one('SELECT text_preview FROM vector_embeddings WHERE id = ?', [legacyId]);
  check('legacy plaintext preview encrypted by migration', legacyAfter && vs2.isEncryptedPreview(legacyAfter[0]) && decrypt(legacyAfter[0]) === 'LEGACY plaintext anxiety sleep problems', legacyAfter);
  check('KB preview left plaintext', one('SELECT text_preview FROM vector_embeddings WHERE id = ?', [kbId])[0] === 'KB anxiety handout');
  check('private diary embedding purged by migration', one('SELECT COUNT(*) FROM vector_embeddings WHERE id = ?', [legacyPriv])[0] === 0);
  check('private diary embedding_ref cleared', one('SELECT embedding_ref FROM diary_entries WHERE id = ?', [D2])[0] === null);
  // Idempotent re-run
  const before = legacyAfter[0];
  delete require.cache[vsPath];
  const vs3 = require(vsPath);
  vs3.ensureTable();
  check('migration idempotent (ciphertext unchanged on re-run)', one('SELECT text_preview FROM vector_embeddings WHERE id = ?', [legacyId])[0] === before);

  // New embeddings are stored encrypted
  vs3.embedSessionTranscript(S1, 'Client reports anxiety and poor sleep for weeks', C1, T1);
  vs3.embedDiaryEntry(D1, 'Felt anxiety at work, poor sleep again', C1, T1);
  const rows = db.exec("SELECT source_type, text_preview FROM vector_embeddings WHERE source_type != 'kb'")[0].values;
  check('all client previews stored encrypted', rows.every(([, p]) => vs3.isEncryptedPreview(p)), rows);
  check('no plaintext word in stored previews', rows.every(([, p]) => !/anxiety/i.test(p)));
  const pr = vs3.embedDiaryEntry(D2, 'private anxiety text', C1, T1);
  check('embedDiaryEntry refuses private entry', pr.success === false && one("SELECT COUNT(*) FROM vector_embeddings WHERE source_type='diary_entry' AND source_id=?", [D2])[0] === 0, pr);

  // Search through the route: decrypted for owner therapist
  r = await req(port, 'POST', '/api/search', { token: tk.T1, body: { query: 'anxiety sleep' } });
  const previews = (r.body && r.body.results || []).map((x) => x.text_preview);
  check('search returns decrypted previews to owner', r.status === 200 && previews.some((p) => /anxiety/i.test(p || '')) && previews.every((p) => !vs3.isEncryptedPreview(p)), r.body);
  r = await req(port, 'POST', '/api/search', { token: tk.T2, body: { query: 'anxiety sleep' } });
  check('other therapist search sees none of T1 data', r.status === 200 && r.body.results.every((x) => x.therapist_id === T2), r.body);
  r = await req(port, 'POST', '/api/search', { token: tk.SA, body: { query: 'anxiety sleep' } });
  check('superadmin search scoped to own (none)', r.status === 200 && r.body.results.length === 0, r.body);
  r = await req(port, 'POST', '/api/search', { token: tk.SA, body: { query: 'anxiety', client_id: C1 } });
  check('superadmin search with client_id -> 403', r.status === 403, r.status);
  r = await req(port, 'GET', `/api/search/embedding/session_transcript/${S1}`, { token: tk.T1 });
  check('owner embedding info returns decrypted preview', r.status === 200 && /anxiety/.test(r.body.embedding.text_preview), r.body);
  r = await req(port, 'GET', `/api/search/embedding/session_transcript/${S1}`, { token: tk.SA });
  check('superadmin embedding info -> 403', r.status === 403, r.status);
  const raw = vs3.semanticSearch('anxiety sleep', {});
  check('semanticSearch without therapist scope never returns client previews', raw.results.filter((x) => x.source_type !== 'kb').every((x) => x.text_preview === null), raw.results);

  // make-private removes embedding (bot route function)
  const del = vs3.deleteDiaryEmbeddings(D1);
  check('deleteDiaryEmbeddings removes diary embedding + ref', del.deleted === 1 && one('SELECT embedding_ref FROM diary_entries WHERE id = ?', [D1])[0] === null, del);
  check('deleteDiaryEmbeddings idempotent', vs3.deleteDiaryEmbeddings(D1).deleted === 0);

  // make-private through the real bot route
  process.env.BOT_API_KEY = 'test-bot-key-xxxxxxxx';
  const botApp = express();
  botApp.use(express.json());
  botApp.use('/api/bot', require(path.join(SRC, 'routes/bot.js')));
  const botServer = botApp.listen(0);
  await new Promise((r2) => botServer.once('listening', r2));
  db.run("UPDATE users SET telegram_id = '7001' WHERE id = ?", [C1]);
  const D3 = ins("INSERT INTO diary_entries (client_id, entry_type, content_encrypted) VALUES (?, 'text', ?)", [C1, enc('going private soon anxiety')]);
  vs3.embedDiaryEntry(D3, 'going private soon anxiety', C1, T1);
  check('D3 embedded before make-private', one("SELECT COUNT(*) FROM vector_embeddings WHERE source_type='diary_entry' AND source_id=?", [D3])[0] === 1);
  const br = await new Promise((resolve) => {
    const data = JSON.stringify({ telegram_id: '7001' });
    const rq = http.request({ host: '127.0.0.1', port: botServer.address().port, method: 'POST', path: `/api/bot/diary/${D3}/make-private`, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), 'x-bot-api-key': 'test-bot-key-xxxxxxxx' } }, (res) => { let s = ''; res.on('data', (c) => (s += c)); res.on('end', () => resolve({ status: res.statusCode, raw: s })); });
    rq.write(data); rq.end();
  });
  check('make-private 200', br.status === 200, br);
  check('make-private deleted the embedding', one("SELECT COUNT(*) FROM vector_embeddings WHERE source_type='diary_entry' AND source_id=?", [D3])[0] === 0);
  check('make-private cleared embedding_ref', one('SELECT embedding_ref FROM diary_entries WHERE id = ?', [D3])[0] === null);
  botServer.close();

  // ================= H4 supervision share =================
  console.log('H4 supervision share');
  const share = require(path.join(SRC, 'services/supervisionShare.js'));
  // Backdate existing records so the link's creation time is clearly after them.
  db.run("UPDATE sessions SET created_at = datetime('now','-2 hours')");
  db.run("UPDATE diary_entries SET created_at = datetime('now','-2 hours')");
  db.run("INSERT INTO comments (entity_type, entity_id, author_id, author_role, visibility, content_encrypted, created_at, updated_at) VALUES ('client', ?, ?, 'therapist', 'shared', ?, datetime('now','-2 hours'), datetime('now','-2 hours'))", [C1, T1, enc('T1 shared on client')]);
  db.run("INSERT INTO comments (entity_type, entity_id, author_id, author_role, visibility, content_encrypted, created_at, updated_at) VALUES ('client', ?, ?, 'therapist', 'shared', ?, datetime('now','-2 hours'), datetime('now','-2 hours'))", [C1, T2, enc('FOREIGN therapist shared on client')]);
  const link = share.createLink({ therapistId: T1, clientId: C1, ttl: '7d', anonymize: false });
  // Records created AFTER the link
  db.run("INSERT INTO sessions (therapist_id, client_id, summary_encrypted, status, created_at) VALUES (?,?,?, 'complete', datetime('now','+1 hour'))", [T1, C1, enc('SUMMARY after link')]);
  db.run("INSERT INTO diary_entries (client_id, entry_type, content_encrypted, created_at) VALUES (?, 'text', ?, datetime('now','+1 hour'))", [C1, enc('diary after link')]);
  r = await req(port, 'GET', `/api/share/supervision/${link.token}`);
  const viewStr = JSON.stringify(r.body);
  check('active link serves view', r.status === 200 && viewStr.includes('SUMMARY one'), r.status);
  check('view excludes records created after link', !viewStr.includes('SUMMARY after link') && !viewStr.includes('diary after link'));
  check('view excludes private diary', !viewStr.includes('PRIVATE'));
  check('view includes public diary from before link', viewStr.includes('diary public before link'));
  check('view excludes shared comments by other authors', viewStr.includes('T1 shared on client') && !viewStr.includes('FOREIGN therapist'));

  // consent revoked -> link dies and is revoked
  db.run('UPDATE users SET consent_therapist_access = 0 WHERE id = ?', [C1]);
  r = await req(port, 'GET', `/api/share/supervision/${link.token}`);
  check('consent revoked -> 404', r.status === 404, r);
  check('link marked revoked', !!one('SELECT revoked_at FROM supervision_share_links WHERE id = ?', [link.id])[0]);
  check('auto-revoke audited', one("SELECT COUNT(*) FROM audit_logs WHERE action = 'supervision_share_auto_revoke' AND target_id = ?", [link.id])[0] === 1);
  db.run('UPDATE users SET consent_therapist_access = 1 WHERE id = ?', [C1]);
  r = await req(port, 'GET', `/api/share/supervision/${link.token}`);
  check('re-granting consent does not resurrect the link', r.status === 404, r.status);

  // client moved to another therapist
  const link2 = share.createLink({ therapistId: T1, clientId: C1, ttl: '1d' });
  r = await req(port, 'HEAD', `/api/share/supervision/${link2.token}`);
  check('HEAD active link 200', r.status === 200, r.status);
  db.run('UPDATE users SET therapist_id = ? WHERE id = ?', [T2, C1]);
  r = await req(port, 'GET', `/api/share/supervision/${link2.token}`);
  check('client moved to other therapist -> 404', r.status === 404, r.status);
  check('link2 revoked', !!one('SELECT revoked_at FROM supervision_share_links WHERE id = ?', [link2.id])[0]);
  db.run('UPDATE users SET therapist_id = ? WHERE id = ?', [T1, C1]);

  // client deleted
  const link3 = share.createLink({ therapistId: T1, clientId: C1, ttl: '1d' });
  db.run("UPDATE users SET role = 'viewer' WHERE id = ?", [C1]); // simulate client gone (no client row)
  r = await req(port, 'GET', `/api/share/supervision/${link3.token}`);
  check('client gone -> 404 + revoked', r.status === 404 && !!one('SELECT revoked_at FROM supervision_share_links WHERE id = ?', [link3.id])[0], r.status);
  db.run("UPDATE users SET role = 'client' WHERE id = ?", [C1]);

  // therapist blocked
  const link4 = share.createLink({ therapistId: T1, clientId: C1, ttl: '1d' });
  db.run("UPDATE users SET blocked_at = datetime('now') WHERE id = ?", [T1]);
  r = await req(port, 'GET', `/api/share/supervision/${link4.token}`);
  check('therapist blocked -> 404', r.status === 404, r.status);
  db.run('UPDATE users SET blocked_at = NULL WHERE id = ?', [T1]);

  // expired link -> 404 (not marked revoked, keeps "expired" status)
  const link5 = share.createLink({ therapistId: T1, clientId: C1, ttl: '1d' });
  db.run("UPDATE supervision_share_links SET expires_at = ? WHERE id = ?", [new Date(Date.now() - 1000).toISOString(), link5.id]);
  r = await req(port, 'GET', `/api/share/supervision/${link5.token}`);
  check('expired link -> 404', r.status === 404, r.status);

  // createLink requires consent
  db.run('UPDATE users SET consent_therapist_access = 0 WHERE id = ?', [C1]);
  let code = null;
  try { share.createLink({ therapistId: T1, clientId: C1, ttl: '1d' }); } catch (e) { code = e.code; }
  check('createLink without consent -> consent_required', code === 'consent_required', code);
  code = null;
  try { share.createLink({ therapistId: T2, clientId: C1, ttl: '1d' }); } catch (e) { code = e.code; }
  check('createLink for unlinked client -> not_found', code === 'not_found', code);

  // On-disk image must not contain the migrated legacy plaintext.
  try { await conn.saveDatabase(); } catch (e) { console.log('saveDatabase: ' + e.message); }
  const img = fs.readFileSync(DB_FILE);
  check('saved DB image has no legacy plaintext preview', !img.includes(Buffer.from('LEGACY plaintext')) && !img.includes(Buffer.from('PRIVATE plaintext')));

  server.close();
});
