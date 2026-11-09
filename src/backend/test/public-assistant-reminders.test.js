'use strict';
// Ported from the wave-2 track F scratch suite. External services are stubbed.
const path = require('path');
const fs = require('fs');
const http = require('http');
const assert = require('assert');
const { setupEnv, run, dep, SRC } = require('./helpers/checks');
setupEnv('assistant', { PUBLIC_ASSISTANT_IP_DAILY_MAX: '12' });

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
}

// ---- stubs (set before requiring the modules under test) ----
const stub = (rel, exportsObj) => {
  const full = require.resolve(path.join(SRC, rel));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
};
const tgCalls = [];
let tgImpl = async (chat, text, opts) => ({ sent: true, messageId: 1 });
stub('utils/telegramNotify.js', { sendMessage: (...a) => { tgCalls.push(a); return tgImpl(...a); } });
const mailCalls = [];
stub('services/emailService.js', { sendSessionReminder: async (...a) => { mailCalls.push(a); return { sent: true, messageId: 'm1' }; } });
stub('utils/planLimits.js', { canUseSessionReminders: () => true });
let spendAllowed = true;
let llmCalls = 0;
stub('services/aiProviders/index.js', {
  getActiveAssistantProvider: () => ({ providerName: 'x', model: 'y' }),
  chat: async () => { llmCalls++; return { text: 'hello from llm' }; },
  chatStream: async function* () { llmCalls++; yield { text: 'hi', done: true, fullText: 'hi' }; },
});
let cacheThrows = false;
stub('services/assistantCache.js', { findCachedAnswer: async () => { if (cacheThrows) throw new Error('boom'); return { hit: false }; }, storeCachedAnswer: async () => {} });
stub('services/assistantKnowledge.js', { search: async () => [] });
const realLogger = require(path.join(SRC, 'utils/logger.js'));


run('CSV export, reminders, public assistant limits (wave 2 track F)', async () => {
  const conn = require(path.join(SRC, 'db/connection.js'));
  await conn.initDatabase();
  const db = conn.getDatabase();
  const aiLogger = require(path.join(SRC, 'services/aiUsageLogger.js'));
  aiLogger.checkSpendingLimit = () => ({ allowed: spendAllowed });

  // ================= M10 CSV =================
  const { objectsToCSV } = require(path.join(SRC, 'services/exportService.js'));
  const csv = objectsToCSV([
    { a: '=1+1', b: '+cmd', c: '-2', d: '@SUM(A1)', e: '\tx', f: 'safe', g: 5, h: -7, i: null, j: 'say "hi"', k: '\rx' },
  ]);
  const row = csv.split('\n').slice(1).join('\n');
  ok(row.startsWith('"\'=1+1","\'+cmd","\'-2","\'@SUM(A1)","\'\tx","safe","5","-7","","say ""hi""","\'\rx"'), 'M10 csv formula cells prefixed, numbers untouched, quoting kept: ' + JSON.stringify(row));
  ok(objectsToCSV([{ '=h': 1 }]).startsWith('"\'=h"'), 'M10 header neutralised');

  // ================= Retention =================
  const retention = require(path.join(SRC, 'services/retentionService.js'));
  db.run("INSERT INTO users (email, password_hash, role) VALUES ('t@x.io','x','therapist')");
  const old = "datetime('now','-200 days')", newer = "datetime('now','-10 days')";
  const ins = (sql, p) => db.run(sql, p || []);
  // conversations: anon old, anon new, therapist(1) old
  ins(`INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context) VALUES (0, ${old}, ${old}, 'landing')`);
  ins(`INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context) VALUES (0, ${newer}, ${newer}, 'landing')`);
  ins(`INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context) VALUES (1, ${old}, ${newer}, 'dash')`);
  ins(`INSERT INTO assistant_messages (conversation_id, role, content, created_at) VALUES (1,'user','old anon', ${old})`);
  ins(`INSERT INTO assistant_messages (conversation_id, role, content, created_at) VALUES (2,'user','new anon', ${newer})`);
  ins(`INSERT INTO assistant_messages (conversation_id, role, content, created_at) VALUES (3,'user','old therapist msg', ${old})`);
  ins(`INSERT INTO assistant_messages (conversation_id, role, content, created_at) VALUES (3,'user','new therapist msg', ${newer})`);
  ins(`INSERT INTO assistant_admin_comments (message_id, admin_id, comment_text) VALUES (1,1,'c-old')`);
  ins(`INSERT INTO assistant_admin_comments (message_id, admin_id, comment_text) VALUES (2,1,'c-new')`);
  ins(`INSERT INTO viewer_sessions (uuid, last_active, created_at) VALUES ('old-session-uuid', ${old}, ${old})`);
  ins(`INSERT INTO viewer_sessions (uuid, last_active, created_at) VALUES ('new-session-uuid', ${newer}, ${newer})`);
  const cache = (q, seed, ts) => ins(`INSERT INTO assistant_cached_answers (question_embedding, question_text, answer_text, is_seed, updated_at, created_at) VALUES ('[]', '${q}', 'a', ${seed}, ${ts}, ${ts})`);
  cache('old-unused', 0, "datetime('now','-300 days')");
  cache('old-seed', 1, "datetime('now','-900 days')");
  cache('recent', 0, "datetime('now','-30 days')");
  ins(`INSERT INTO ai_usage_log (therapist_id, timestamp, provider, model, operation) VALUES (1, datetime('now','-500 days'),'p','m','o')`);
  ins(`INSERT INTO ai_usage_log (therapist_id, timestamp, provider, model, operation) VALUES (1, datetime('now','-100 days'),'p','m','o')`);
  ins(`INSERT INTO audit_logs (actor_id, action, created_at) VALUES (1,'old', datetime('now','-800 days'))`);
  ins(`INSERT INTO audit_logs (actor_id, action, created_at) VALUES (1,'recent', datetime('now','-100 days'))`);
  const count = (t, w) => db.exec(`SELECT COUNT(*) FROM ${t} ${w ? 'WHERE ' + w : ''}`)[0].values[0][0];
  const before = {
    msgs: count('assistant_messages'), conv: count('assistant_conversations'), vs: count('viewer_sessions'),
    cache: count('assistant_cached_answers'), usage: count('ai_usage_log'), audit: count('audit_logs'), com: count('assistant_admin_comments'),
  };

  const dry = await retention.runRetention({ dryRun: true });
  ok(dry.dryRun && dry.counts.assistant_messages === 1 && dry.counts.viewer_sessions === 1 && dry.counts.assistant_cached_answers === 1
     && dry.counts.ai_usage_log === 1 && dry.counts.audit_logs === 1 && dry.counts.assistant_conversations_anonymous === 1 && dry.counts.assistant_admin_comments === 1,
     'retention dry-run counts: ' + JSON.stringify(dry.counts));
  ok(count('assistant_messages') === before.msgs && count('audit_logs') === before.audit && count('viewer_sessions') === before.vs, 'retention dry-run deletes nothing');

  const real = await retention.runRetention({ dryRun: false });
  ok(count('assistant_messages') === before.msgs - 1, 'old anon message deleted, recent kept');
  ok(count('assistant_messages', "content='old therapist msg'") === 1, 'therapist history is never purged');
  ok(count('assistant_messages', "content='new anon'") === 1 && count('assistant_messages', "content='new therapist msg'") === 1, 'recent messages survive');
  ok(count('assistant_admin_comments', "comment_text='c-old'") === 0 && count('assistant_admin_comments', "comment_text='c-new'") === 1, 'admin comments on deleted messages removed');
  ok(count('assistant_conversations', 'therapist_id=0') === 1 && count('assistant_conversations', 'therapist_id=1') === 1, 'only stale anonymous conversation removed');
  ok(count('viewer_sessions', "uuid='old-session-uuid'") === 0 && count('viewer_sessions', "uuid='new-session-uuid'") === 1, 'viewer_sessions purged by age');
  ok(count('assistant_cached_answers', "question_text='old-unused'") === 0 && count('assistant_cached_answers', "question_text='old-seed'") === 1 && count('assistant_cached_answers', "question_text='recent'") === 1, 'cache: unused deleted, seed + recent kept');
  ok(count('ai_usage_log') === 1, 'ai_usage_log purged');
  ok(count('audit_logs', "action='old'") === 0 && count('audit_logs', "action='recent'") === 1 && count('audit_logs', "action='retention_purge'") === 1, 'audit_logs purged + purge row recorded');
  // batching: > BATCH_SIZE rows
  db.run("BEGIN");
  for (let i = 0; i < 5200; i++) db.run("INSERT INTO ai_usage_log (therapist_id, timestamp, provider, model, operation) VALUES (1, datetime('now','-900 days'),'p','m','o')");
  db.run("COMMIT");
  await retention.runRetention({ dryRun: false });
  ok(count('ai_usage_log') === 1, 'retention batches through >5000 rows');
  process.env.AI_USAGE_RETENTION_DAYS = 'garbage';
  ok(retention.getConfig().aiUsageDays === 400, 'invalid env falls back to default');
  delete process.env.AI_USAGE_RETENTION_DAYS;

  // ---- retention round 2: curated cache rows, sessions with email, empty/orphan convs, stripe events, yielding
  db.run("INSERT INTO users (email, password_hash, role) VALUES ('viewer1@x.io','x','viewer')");
  const viewerId = db.exec("SELECT id FROM users WHERE email='viewer1@x.io'")[0].values[0][0];
  const long = "datetime('now','-400 days')";
  ins(`INSERT INTO assistant_cached_answers (question_embedding, question_text, answer_text, is_seed, source, updated_at, created_at) VALUES ('[]','admin-fix','a',0,'admin_correction',${long},${long})`);
  ins(`INSERT INTO assistant_cached_answers (question_embedding, question_text, answer_text, is_seed, source, updated_at, created_at) VALUES ('[]','admin-edit','a',0,'admin_edit',${long},${long})`);
  ins(`INSERT INTO assistant_cached_answers (question_embedding, question_text, answer_text, is_seed, updated_at, created_at) VALUES ('[]','auto-old','a',0,${long},${long})`);
  ins(`INSERT INTO viewer_sessions (uuid, ip, user_agent, fingerprint, email, last_active, created_at) VALUES ('lead-old-session','1.1.1.1','UA','fp','lead@x.io',${old},${old})`);
  ins(`INSERT INTO viewer_sessions (uuid, ip, user_agent, fingerprint, email, user_id, last_active, created_at) VALUES ('user-old-session','1.1.1.2','UA','fp','v@x.io',${viewerId},${old},${old})`);
  ins(`INSERT INTO viewer_sessions (uuid, ip, last_active, created_at) VALUES ('anon-old-session','1.1.1.3',${old},${old})`);
  // viewer-owned conversations: A all messages old (-> deleted), B mixed (-> recounted)
  ins(`INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, message_count) VALUES (${viewerId}, ${old}, ${old}, 'landing', 2)`);
  const convA = db.exec("SELECT MAX(id) FROM assistant_conversations")[0].values[0][0];
  ins(`INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, message_count) VALUES (${viewerId}, ${old}, ${newer}, 'landing', 4)`);
  const convB = db.exec("SELECT MAX(id) FROM assistant_conversations")[0].values[0][0];
  for (const [c, t] of [[convA, old], [convA, old], [convB, old], [convB, old], [convB, newer], [convB, newer]]) {
    ins(`INSERT INTO assistant_messages (conversation_id, role, content, created_at) VALUES (${c}, 'user', 'x', ${t})`);
  }
  // orphan conversation (owner user 9999 does not exist) with a recent message
  ins(`INSERT INTO assistant_conversations (therapist_id, started_at, last_message_at, page_context, message_count) VALUES (9999, ${newer}, ${newer}, 'dash', 2)`);
  const convO = db.exec("SELECT MAX(id) FROM assistant_conversations")[0].values[0][0];
  ins(`INSERT INTO assistant_messages (conversation_id, role, content, created_at) VALUES (${convO}, 'user', 'orphan msg', ${newer})`);
  // stripe events
  ins(`INSERT INTO stripe_webhook_events (event_id, type, received_at) VALUES ('evt_old','x',datetime('now','-120 days'))`);
  ins(`INSERT INTO stripe_webhook_events (event_id, type, received_at) VALUES ('evt_new','x',datetime('now','-10 days'))`);

  let ticks = 0; let ticking = true;
  (function tick() { if (ticking) { ticks++; setImmediate(tick); } })();
  db.run("BEGIN");
  for (let i = 0; i < 5200; i++) db.run("INSERT INTO ai_usage_log (therapist_id, timestamp, provider, model, operation) VALUES (1, datetime('now','-900 days'),'p','m','o')");
  db.run("COMMIT");
  const ticksBefore = ticks;
  const dry2 = await retention.runRetention({ dryRun: true });
  ok(dry2.counts.assistant_conversations_orphan === 1 && dry2.counts.stripe_webhook_events === 1 && dry2.counts.viewer_sessions_pii_nulled === 2, 'round-2 dry-run counts: ' + JSON.stringify(dry2.counts));
  await retention.runRetention({ dryRun: false });
  ticking = false;
  ok(ticks - ticksBefore > 1, 'retention yields to the event loop between batches (ticks=' + (ticks - ticksBefore) + ')');
  ok(count('assistant_cached_answers', "question_text='admin-fix'") === 1 && count('assistant_cached_answers', "question_text='admin-edit'") === 1, 'curated cache rows (source set) are never purged');
  ok(count('assistant_cached_answers', "question_text='auto-old'") === 0, 'auto-learned old cache row purged');
  ok(count('viewer_sessions', "uuid='lead-old-session'") === 1 && count('viewer_sessions', "uuid='user-old-session'") === 1, 'sessions with email/user are kept');
  ok(count('viewer_sessions', "uuid='lead-old-session' AND ip IS NULL AND user_agent IS NULL AND fingerprint IS NULL") === 1
     && count('viewer_sessions', "uuid='user-old-session' AND ip IS NULL AND fingerprint IS NULL") === 1, 'kept sessions have PII nulled');
  ok(count('viewer_sessions', "uuid='anon-old-session'") === 0, 'anonymous old session deleted');
  ok(count('assistant_conversations', `id=${convA}`) === 0, 'viewer conversation left with no messages deleted');
  ok(count('assistant_conversations', `id=${convB} AND message_count=2`) === 1, 'viewer conversation message_count recounted');
  ok(count('assistant_conversations', `id=${convO}`) === 0 && count('assistant_messages', `conversation_id=${convO}`) === 0, 'orphan conversation + its messages deleted');
  ok(count('stripe_webhook_events', "event_id='evt_old'") === 0 && count('stripe_webhook_events', "event_id='evt_new'") === 1, 'old stripe_webhook_events deleted, recent kept');

  // ================= Reminders (M18) =================
  const reminder = require(path.join(SRC, 'services/reminderService.js'));
  db.run("INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ('th@x.io','x','therapist','Ann','Th')"); // id 2? find ids
  const thId = db.exec("SELECT id FROM users WHERE email='th@x.io'")[0].values[0][0];
  db.run("INSERT INTO users (email, password_hash, role, first_name, therapist_id, consent_therapist_access, session_reminders_enabled, language, telegram_id) VALUES ('cl@x.io','x','client','Bob_*[x',?,1,1,'ru','777')", [thId]);
  const clId = db.exec("SELECT id FROM users WHERE email='cl@x.io'")[0].values[0][0];
  const future = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  db.run("INSERT INTO sessions (therapist_id, client_id, scheduled_at) VALUES (?,?,?)", [thId, clId, future]);
  const sId = db.exec("SELECT MAX(id) FROM sessions")[0].values[0][0];
  const addDisp = (off, ch) => db.run("INSERT INTO session_reminder_dispatches (session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel) VALUES (?,?,?,?,datetime('now','-1 minute'),?)", [sId, thId, clId, off, ch]);
  addDisp(1440, 'telegram');
  tgImpl = async () => { await new Promise(r => setTimeout(r, 80)); return { sent: true, messageId: 42 }; };
  const [r1, r2] = await Promise.all([reminder.dispatchDue(), reminder.dispatchDue()]);
  ok(tgCalls.length === 1, 'overlapping dispatchDue sends exactly once (calls=' + tgCalls.length + ')');
  ok(r1.sent + r2.sent === 1, 'only one run reports sent');
  ok(tgCalls[0][2].plainText && tgCalls[0][2].parse_mode === 'Markdown', 'telegram call carries plainText fallback');
  const st = db.exec("SELECT status, error, sent_at FROM session_reminder_dispatches")[0].values[0];
  ok(st[0] === 'sent' && st[1] === null && st[2], 'row sent, error NULL');
  ok(db.exec("SELECT claimed_at FROM session_reminder_dispatches")[0].values[0][0] === null, 'claimed_at cleared after send');

  // stale sending reclaimed
  db.run("DELETE FROM session_reminder_dispatches");
  addDisp(-1, 'telegram');
  db.run("UPDATE session_reminder_dispatches SET status='sending', claimed_at=datetime('now','-45 minutes')");
  tgCalls.length = 0; tgImpl = async () => ({ sent: true, messageId: 1 });
  await reminder.dispatchDue();
  ok(tgCalls.length === 1, 'stale (45 min) sending row is reclaimed and sent');
  ok(db.exec("SELECT error FROM session_reminder_dispatches")[0].values[0][0] === null, 'no leftover reclaim text in error');
  db.run("DELETE FROM session_reminder_dispatches");
  addDisp(-1, 'telegram');
  db.run("UPDATE session_reminder_dispatches SET status='sending', claimed_at=datetime('now','-5 minutes')");
  tgCalls.length = 0;
  await reminder.dispatchDue();
  ok(tgCalls.length === 0 && db.exec("SELECT status FROM session_reminder_dispatches")[0].values[0][0] === 'sending', 'fresh (5 min) sending row left alone');
  ok(db.exec("SELECT error FROM session_reminder_dispatches")[0].values[0][0] === null, 'sending row shows no error text');
  const cp = reminder.cancelPendingForSession(sId, 'rescheduled');
  ok(cp.cancelled === 1 && db.exec("SELECT status FROM session_reminder_dispatches")[0].values[0][0] === 'superseded', 'cancelPendingForSession also supersedes sending rows');
  db.run("DELETE FROM session_reminder_dispatches");
  addDisp(-1, 'telegram');
  db.run("UPDATE session_reminder_dispatches SET status='sending', error='claimed_at=2020-01-01 00:00:00', claimed_at=NULL");
  tgCalls.length = 0;
  await reminder.dispatchDue();
  ok(tgCalls.length === 1 && db.exec("SELECT error FROM session_reminder_dispatches")[0].values[0][0] === null, 'legacy sending row (no claimed_at) reclaimed, legacy error text cleared');

  // failure -> failed
  db.run("DELETE FROM session_reminder_dispatches");
  addDisp(1440, 'telegram');
  tgImpl = async () => ({ sent: false, error: 'Bad Request: nope' });
  await reminder.dispatchDue();
  ok(db.exec("SELECT status, error FROM session_reminder_dispatches")[0].values[0].join('|') === 'failed|Bad Request: nope', 'failed only after telegramNotify (which retries plain) reports failure');

  // email arg order
  db.run("DELETE FROM session_reminder_dispatches");
  addDisp(1440, 'email');
  await reminder.dispatchDue();
  ok(mailCalls.length === 1, 'email sent once');
  const [to, loc, data] = mailCalls[0];
  ok(to === 'cl@x.io' && loc === 'ru' && data && data.client_name === 'Bob_*[x' && /^Завтра в \d\d:\d\d$/.test(data.session_local_time_string)
     && /attendance-link\?token=/.test(data.confirm_url) && /attendance-link\?token=/.test(data.release_url), 'sendSessionReminder(toEmail, locale, data) with signed links: ' + JSON.stringify(data).slice(0, 160));

  // ================= Public assistant (H9) =================
  const express = dep('express');
  const app = express();
  app.use(express.json());
  app.use('/api/assistant', require(path.join(SRC, 'routes/publicAssistant.js')));
  const server = http.createServer(app).listen(0);
  const port = server.address().port;
  const post = async (body, headers) => {
    const r = await fetch(`http://127.0.0.1:${port}/api/assistant/public-chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...(headers || {}) }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };
  const vs = (w) => db.exec(`SELECT COUNT(*) FROM viewer_sessions WHERE ${w}`)[0].values[0][0];

  // X-Forwarded-For spoof ignored; CF-Connecting-IP used
  let a = await post({ message: 'What is PR-TOP?', session_uuid: 'client-made-uuid-123' }, { 'x-forwarded-for': '6.6.6.6', 'cf-connecting-ip': '9.9.9.9' });
  ok(a.status === 200 && a.json.session_uuid && a.json.session_uuid !== 'client-made-uuid-123', 'unknown client uuid replaced by server-issued id');
  ok(vs("ip='9.9.9.9'") === 1 && vs("ip='6.6.6.6'") === 0, 'IP taken from CF-Connecting-IP, XFF ignored');
  ok(vs("uuid='client-made-uuid-123'") === 0, 'client-chosen uuid never stored');
  const sid = a.json.session_uuid;
  // known id keeps counting to the cap of 5
  let last;
  for (let i = 0; i < 4; i++) last = await post({ message: 'q' + i + ' about features', session_uuid: sid }, { 'cf-connecting-ip': '9.9.9.9' });
  ok(last.status === 200 && last.json.messages_remaining === 0, 'session reaches 5/5 (remaining=' + last.json.messages_remaining + ')');
  const capped = await post({ message: 'one more', session_uuid: sid }, { 'cf-connecting-ip': '9.9.9.9' });
  ok(capped.status === 403 && capped.json.error === 'message_limit_reached', 'session cap enforced');
  // rotating unknown session ids: every one creates a NEW server session; stops (burst limiter or new-session caps)
  let rotated = 0, blocked = null;
  for (let i = 0; i < 20; i++) {
    const rr = await post({ message: 'rotate ' + i + ' hello there', session_uuid: 'rotating-uuid-' + i + '-xxxxx' }, { 'cf-connecting-ip': '9.9.9.9' });
    if (rr.status === 200) rotated++; else { blocked = rr; break; }
  }
  ok(blocked && [429, 503].includes(blocked.status) && rotated <= 12, 'rotating ids is stopped after ' + rotated + ' extra messages');
  ok(vs("ip='9.9.9.9'") <= 13, 'no unbounded viewer_sessions rows from rotation: ' + vs("ip='9.9.9.9'"));

  // per-IP cap (12 in this test) counts only sessions CREATED in the last 24h and applies only to NEW sessions
  for (let i = 0; i < 12; i++) db.run("INSERT INTO viewer_sessions (uuid, ip, message_count) VALUES (?, '5.5.5.5', 5)", ['prefill-uuid-xxxx-' + i]);
  db.run("INSERT INTO viewer_sessions (uuid, ip, message_count, created_at, last_active) VALUES ('prefill-old-uuid-1', '4.4.4.4', 0, datetime('now','-3 days'), datetime('now'))");
  const ipCap = await post({ message: 'fresh session same ip hello' }, { 'cf-connecting-ip': '5.5.5.5' });
  ok(ipCap.status === 503 && ipCap.json.code === 'public_assistant_busy' && !ipCap.json.show_cta && ipCap.json.error !== undefined && ipCap.json.error !== 'message_limit_reached', 'per-IP new-session cap -> try-later 503, not the registration CTA: ' + JSON.stringify(ipCap.json));
  ok(vs("ip='5.5.5.5'") === 12, 'blocked request did not create a session row');
  db.run("UPDATE viewer_sessions SET message_count = 0 WHERE uuid = 'prefill-uuid-xxxx-3'");
  const existingBehindCap = await post({ message: 'existing session same ip hello', session_uuid: 'prefill-uuid-xxxx-3' }, { 'cf-connecting-ip': '5.5.5.5' });
  ok(existingBehindCap.status === 200 && existingBehindCap.json.session_uuid === 'prefill-uuid-xxxx-3', 'existing session on a capped IP keeps working (CGNAT / office)');
  db.run("UPDATE viewer_sessions SET email = 'lead@x.io' WHERE uuid = 'prefill-uuid-xxxx-4'");
  const leadBehindCap = await post({ message: 'lead session same ip hello', session_uuid: 'prefill-uuid-xxxx-4' }, { 'cf-connecting-ip': '5.5.5.5' });
  ok(leadBehindCap.status !== 503, 'lead session (email) on a capped IP is never blocked by the IP cap (status ' + leadBehindCap.status + ')');
  const oldSessIp = await post({ message: 'new session from ip whose old session is 3 days old' }, { 'cf-connecting-ip': '4.4.4.4' });
  ok(oldSessIp.status === 200, 'sessions older than 24h do not count toward the IP cap');
  // other IP unaffected
  const other = await post({ message: 'hello platform', session_uuid: 'whatever-uuid-1234' }, { 'cf-connecting-ip': '8.8.4.4' });
  ok(other.status === 200, 'other IP unaffected');
  // spend limit
  spendAllowed = false; const llmBefore = llmCalls;
  const spent = await post({ message: 'hello platform again', session_uuid: other.json.session_uuid }, { 'cf-connecting-ip': '8.8.4.4' });
  ok(spent.status === 503 && llmCalls === llmBefore, 'spend limit reached -> 503, no LLM call');
  spendAllowed = true;
  // missing session_uuid accepted (server issues)
  const noUuid = await post({ message: 'no uuid at all here' }, { 'cf-connecting-ip': '7.7.7.7' });
  ok(noUuid.status === 200 && noUuid.json.session_uuid, 'missing session_uuid -> server-issued');
  // conversation_id hijack: therapist conversation id 3 must not be appended
  const msgBefore = count('assistant_messages', 'conversation_id=3');
  await post({ message: 'inject into therapist chat', session_uuid: noUuid.json.session_uuid, conversation_id: 3 }, { 'cf-connecting-ip': '7.7.7.7' });
  ok(count('assistant_messages', 'conversation_id=3') === msgBefore, 'client-supplied conversation_id of a therapist conversation is ignored');
  // SSE
  const sse = await fetch(`http://127.0.0.1:${port}/api/assistant/public-chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '6.5.4.3' }, body: JSON.stringify({ message: 'stream please hello', stream: true }) });
  const txt = await sse.text();
  ok(/"type":"done","session_uuid":"[0-9a-f-]{36}"/.test(txt), 'SSE done event carries session_uuid');

  // ---- spend logging + public monthly budget
  const usage = db.exec("SELECT COUNT(*), COALESCE(SUM(cost_usd),0) FROM ai_usage_log WHERE therapist_id = 0 AND operation = 'public_assistant'")[0].values[0];
  ok(usage[0] >= 1, 'public-chat LLM calls are logged to ai_usage_log (therapist_id 0, operation public_assistant): rows=' + usage[0] + ' cost=' + usage[1]);
  // (stubbed rag => storeCachedAnswer skipped; LLM path ran => usage logged). Budget:
  process.env.PUBLIC_ASSISTANT_MONTHLY_LIMIT_USD = '0.0000001';
  const llmB = llmCalls;
  const overBudget = await post({ message: 'budget check hello there' }, { 'cf-connecting-ip': '3.3.3.3' });
  ok(overBudget.status === 503 && llmCalls === llmB, 'public monthly budget reached -> 503, no LLM call');
  process.env.PUBLIC_ASSISTANT_MONTHLY_LIMIT_USD = '0';
  ok((await post({ message: 'budget off hello there' }, { 'cf-connecting-ip': '3.3.3.3' })).status === 200, 'budget 0 = unlimited');

  // ---- global IP-independent caps
  const nSessions = db.exec("SELECT COUNT(*) FROM viewer_sessions WHERE created_at >= datetime('now','-1 day')")[0].values[0][0];
  process.env.PUBLIC_ASSISTANT_GLOBAL_DAILY_SESSIONS = String(nSessions);
  const gs = await post({ message: 'global session cap hello' }, { 'cf-connecting-ip': '2.2.2.2' });
  ok(gs.status === 503 && gs.json.code === 'public_assistant_busy' && !gs.json.show_cta, 'global new-session cap -> try-later 503');
  const gsExisting = await post({ message: 'existing under global session cap', session_uuid: noUuid.json.session_uuid }, { 'cf-connecting-ip': '7.7.7.7' });
  ok(gsExisting.status === 200, 'global NEW-session cap does not block existing sessions');
  delete process.env.PUBLIC_ASSISTANT_GLOBAL_DAILY_SESSIONS;
  const nMsgs = db.exec("SELECT COUNT(*) FROM assistant_messages am JOIN assistant_conversations ac ON ac.id=am.conversation_id WHERE am.role='user' AND ac.page_context='landing' AND am.created_at >= datetime('now','-1 day')")[0].values[0][0];
  process.env.PUBLIC_ASSISTANT_GLOBAL_DAILY_MESSAGES = String(nMsgs);
  const gm = await post({ message: 'global message cap hello', session_uuid: noUuid.json.session_uuid }, { 'cf-connecting-ip': '7.7.7.7' });
  ok(gm.status === 503 && gm.json.code === 'public_assistant_busy', 'global message cap -> try-later 503 even for a spoofed/other IP');
  delete process.env.PUBLIC_ASSISTANT_GLOBAL_DAILY_MESSAGES;

  // ---- refund on failure (outer catch)
  const rf = await post({ message: 'refund session hello there' }, { 'cf-connecting-ip': '1.2.3.4' });
  const rfUuid = rf.json.session_uuid;
  const mcBefore = db.exec("SELECT message_count FROM viewer_sessions WHERE uuid = ?", [rfUuid])[0].values[0][0];
  cacheThrows = true;
  const rf2 = await post({ message: 'this one will blow up', session_uuid: rfUuid }, { 'cf-connecting-ip': '1.2.3.4' });
  cacheThrows = false;
  const mcAfter = db.exec("SELECT message_count FROM viewer_sessions WHERE uuid = ?", [rfUuid])[0].values[0][0];
  ok(rf2.status === 500 && mcAfter === mcBefore, 'reserved message refunded when no reply was produced (before=' + mcBefore + ' after=' + mcAfter + ')');

  // ---- conversation binding to the viewer session
  const ca = await post({ message: 'conv owner A hello there' }, { 'cf-connecting-ip': '1.2.3.5' });
  const cb = await post({ message: 'conv owner B hello there' }, { 'cf-connecting-ip': '1.2.3.6' });
  const cb2 = await post({ message: 'B tries A conversation', session_uuid: cb.json.session_uuid, conversation_id: ca.json.conversation_id }, { 'cf-connecting-ip': '1.2.3.6' });
  ok(cb2.status === 200 && cb2.json.conversation_id !== ca.json.conversation_id, 'session B cannot continue session A conversation (new one created)');
  ok(count('assistant_messages', `conversation_id=${ca.json.conversation_id}`) === 2, 'A conversation untouched by B');
  const ca2 = await post({ message: 'A continues own conversation', session_uuid: ca.json.session_uuid, conversation_id: ca.json.conversation_id }, { 'cf-connecting-ip': '1.2.3.5' });
  ok(ca2.json.conversation_id === ca.json.conversation_id && count('assistant_messages', `conversation_id=${ca.json.conversation_id}`) === 4, 'A can continue its own conversation');
  ok(count('assistant_conversations', `id=${ca.json.conversation_id} AND viewer_session_id = (SELECT id FROM viewer_sessions WHERE uuid='${ca.json.session_uuid}')`) === 1, 'conversation stores viewer_session_id');

  // ---- auth.js register-viewer re-parenting is scoped to the visitor's own session
  const authSrc = fs.readFileSync(path.join(SRC, 'routes/auth.js'), 'utf8');
  const m = authSrc.match(/"(UPDATE assistant_conversations SET therapist_id = \? WHERE [^"]*viewer_session_id = \?)"/);
  ok(!!m, 'auth.js re-parent statement is scoped by viewer_session_id');
  const vsA = db.exec("SELECT id FROM viewer_sessions WHERE uuid=?", [ca.json.session_uuid])[0].values[0][0];
  db.run(m[1], [viewerId, vsA]);
  ok(count('assistant_conversations', `id=${ca.json.conversation_id} AND therapist_id=${viewerId}`) === 1
     && count('assistant_conversations', `id=${cb2.json.conversation_id} AND therapist_id=0`) === 1, 'only the visitor own conversations are re-parented');
  server.close();

  // ================= M9 admin viewers stats =================
  stub('middleware/auth.js', { authenticate: (q, s, n) => n(), requireRole: () => (q, s, n) => n(), authorize: () => (q, s, n) => n() });
  let adminRouter;
  try {
    adminRouter = require(path.join(SRC, 'routes/admin.js'));
  } catch (e) { console.log('admin.js require failed:', e.message); }
  if (adminRouter) {
    const app2 = express();
    app2.use('/api/admin', adminRouter);
    const s2 = http.createServer(app2).listen(0);
    const p2 = s2.address().port;
    const get = async (qs) => { const r = await fetch(`http://127.0.0.1:${p2}/api/admin/stats/viewers?${qs}`); return { status: r.status, json: await r.json().catch(() => ({})) }; };
    const bad = await get("range=custom&start=2026-01-01' OR 1=1--&end=2026-12-31");
    ok(bad.status === 400, 'M9 injection payload rejected with 400');
    ok((await get('range=custom&start=2026-02-30&end=2026-12-31')).status === 400, 'M9 impossible date rejected');
    const good = await get('range=custom&start=2020-01-01&end=2099-12-31');
    ok(good.status === 200 && typeof good.json.totalSessions === 'number' && good.json.totalSessions >= 1, 'M9 valid custom range works, totalSessions=' + good.json.totalSessions);
    const none = await get('range=custom&start=2001-01-01&end=2001-01-02');
    ok(none.status === 200 && none.json.totalSessions === 0, 'M9 empty range returns zero');
    ok((await get('range=7d')).status === 200 && (await get('')).status === 200, 'M9 non-custom ranges still work');
    s2.close();
  }

  // ================= Attendance link: GET is side-effect free =================
  {
    const { generateAttendanceToken } = require(path.join(SRC, 'utils/signedLinks.js'));
    const sg = require(path.join(SRC, 'utils/signedLinks.js'));
    const futureS = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    db.run("INSERT INTO sessions (therapist_id, client_id, scheduled_at) VALUES (?,?,?)", [thId, clId, futureS]);
    const aId = db.exec("SELECT MAX(id) FROM sessions")[0].values[0][0];
    const tok = (action, sid) => generateAttendanceToken({ session_id: sid || aId, client_id: clId, action, expires_at: new Date(Date.now() + 3600e3) });
    const status = () => db.exec("SELECT attendance_status FROM sessions WHERE id=?", [aId])[0].values[0][0];
    const app3 = express();
    app3.use('/api/public', require(path.join(SRC, 'routes/publicAttendance.js')));
    const s3 = http.createServer(app3).listen(0);
    const u = (t) => `http://127.0.0.1:${s3.address().port}/api/public/attendance-link${t ? '?token=' + encodeURIComponent(t) : ''}`;
    const auditBefore = count('audit_logs', "action LIKE 'attendance_%'");

    let r = await fetch(u(tok('confirm'))); let body = await r.text();
    ok(r.status === 200 && /<form method="POST"/.test(body) && body.includes('name="token"') && status() === null, 'GET shows confirm button and changes nothing');
    await fetch(u(tok('release'))); await fetch(u(tok('reschedule')));
    ok(status() === null && count('audit_logs', "action LIKE 'attendance_%'") === auditBefore, 'GET of release/reschedule links also changes nothing (prefetch-safe)');
    ok((await fetch(u('garbage.token'))).status === 400, 'GET invalid token -> 400');
    // opt-in via GET must not change state either
    db.run("UPDATE users SET session_reminders_enabled = NULL WHERE id = ?", [clId]);
    await fetch(u(sg.generateAttendanceToken({ session_id: aId, client_id: clId, action: 'optin_no', expires_at: new Date(Date.now() + 3600e3) })));
    ok(db.exec("SELECT session_reminders_enabled FROM users WHERE id=?", [clId])[0].values[0][0] === null, 'GET opt-out link does not change the reminder preference');
    db.run("UPDATE users SET session_reminders_enabled = 1 WHERE id = ?", [clId]);

    const postTok = async (t) => { const rr = await fetch(u(''), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'token=' + encodeURIComponent(t) }); return { status: rr.status, body: await rr.text() }; };
    let pr = await postTok(tok('reschedule'));
    ok(pr.status === 200 && status() === 'reschedule_requested', 'POST applies reschedule');
    pr = await postTok(tok('confirm'));
    ok(pr.status === 200 && status() === 'confirmed', 'reschedule_requested -> confirmed allowed');
    pr = await postTok(tok('confirm'));
    ok(pr.status === 200 && status() === 'confirmed', 'repeat confirm is idempotent');
    pr = await postTok(tok('release'));
    ok(pr.status === 409 && status() === 'confirmed', 'confirmed cannot be moved by an email link (release blocked)');
    pr = await postTok(tok('reschedule'));
    ok(pr.status === 409 && status() === 'confirmed', 'confirmed cannot be moved by an email link (reschedule blocked)');
    const gr = await fetch(u(tok('release')));
    ok(gr.status === 409, 'GET on a blocked transition shows the already-recorded page, no button');
    db.run("UPDATE sessions SET attendance_status = 'cancelled_by_therapist' WHERE id = ?", [aId]);
    pr = await postTok(tok('confirm'));
    ok(pr.status === 409 && status() === 'cancelled_by_therapist', 'cancelled_* cannot be revived by an email link');
    db.run("UPDATE sessions SET attendance_status = NULL WHERE id = ?", [aId]);
    pr = await postTok(tok('release'));
    ok(pr.status === 200 && status() === 'cancelled_by_client', 'release from unanswered works');
    ok((await postTok('forged.token')).status === 400, 'POST invalid token -> 400');
    const rrNoTok = await fetch(u(''), { method: 'POST' });
    ok(rrNoTok.status === 400, 'POST without token -> 400');
    s3.close();
  }

});
