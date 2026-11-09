/**
 * Feature #400 — end-to-end dispatchDue smoke test.
 *
 * Creates a dispatch row whose scheduled_send_at is in the past, runs
 * dispatchDue(), and asserts the row transitions pending → sent (telegram dev
 * mode counts as sent because there's no BOT_TOKEN). Also exercises the
 * superseded path: a dispatch whose session has attendance_status='confirmed'
 * is marked superseded instead of sent.
 *
 * Uses a fresh temp DB so it never touches dev/prod data.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't400-dispatch-'));
const tmpDbAbs = path.join(tmpDir, 'prtop.db');
process.env.DATABASE_URL = 'sqlite:' + tmpDbAbs;
process.env.TELEGRAM_BOT_TOKEN = ''; // force dev mode

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else      { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

(async () => {
  const conn = require(path.join(__dirname, 'src', 'backend', 'src', 'db', 'connection.js'));
  await conn.initDatabase();
  const db = conn.getDatabase();
  const reminderService = require(path.join(__dirname, 'src', 'backend', 'src', 'services', 'reminderService.js'));

  // Seed therapist + opted-in client with telegram.
  db.run(
    `INSERT INTO users (email, password_hash, role, language, timezone,
                        reminder_policy_json, consent_therapist_access, first_name)
     VALUES ('th@test', 'x', 'therapist', 'en', 'Europe/Moscow', ?, 1, 'Maria')`,
    [JSON.stringify({ enabled: true })]
  );
  const therapistId = db.exec(`SELECT id FROM users WHERE email='th@test'`)[0].values[0][0];

  db.run(
    `INSERT INTO users (email, password_hash, role, language, timezone,
                        therapist_id, telegram_id, consent_therapist_access,
                        session_reminders_enabled, first_name)
     VALUES ('cl@test', 'x', 'client', 'en', 'Europe/Moscow', ?, '700001', 1, 1, 'Anna')`,
    [therapistId]
  );
  const clientId = db.exec(`SELECT id FROM users WHERE email='cl@test'`)[0].values[0][0];

  // ── Case 1: a pending dispatch whose scheduled_send_at is in the past
  //           and whose session is future + not confirmed → must transition sent.
  const futureSessionAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  db.run(
    `INSERT INTO sessions (therapist_id, client_id, scheduled_at, duration_minutes, client_timezone_snapshot)
     VALUES (?, ?, ?, 60, 'Europe/Moscow')`,
    [therapistId, clientId, futureSessionAt]
  );
  const sessionId = db.exec(`SELECT id FROM sessions WHERE client_id=?`, [clientId])[0].values[0][0];

  const pastSendAt = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  db.run(
    `INSERT INTO session_reminder_dispatches
       (session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel, status)
     VALUES (?, ?, ?, 1440, ?, 'telegram', 'pending')`,
    [sessionId, therapistId, clientId, pastSendAt]
  );
  const dispatchId = db.exec(
    `SELECT id FROM session_reminder_dispatches WHERE session_id=? AND channel='telegram'`,
    [sessionId]
  )[0].values[0][0];

  const r1 = await reminderService.dispatchDue();
  assert(r1.sent >= 1, `dispatchDue sent at least 1 reminder (got sent=${r1.sent})`);
  const status1 = db.exec(`SELECT status, sent_at FROM session_reminder_dispatches WHERE id=?`, [dispatchId])[0].values[0];
  assert(status1[0] === 'sent', `dispatch row #1 transitioned to status='sent' (got ${status1[0]})`);
  assert(status1[1] !== null,    `dispatch row #1 has sent_at populated`);

  // Audit log entry must exist.
  const auditRes = db.exec(
    `SELECT COUNT(*) FROM audit_logs WHERE action='session_reminder_sent' AND target_id=?`,
    [sessionId]
  );
  assert(auditRes[0].values[0][0] >= 1, `audit_logs entry created for session_reminder_sent`);

  // ── Case 2: dispatch whose session is already 'confirmed' → superseded.
  db.run(`UPDATE sessions SET attendance_status='confirmed' WHERE id=?`, [sessionId]);
  db.run(
    `INSERT INTO session_reminder_dispatches
       (session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel, status)
     VALUES (?, ?, ?, -1, ?, 'telegram', 'pending')`,
    [sessionId, therapistId, clientId, pastSendAt]
  );
  const r2 = await reminderService.dispatchDue();
  assert(r2.superseded >= 1, `dispatchDue marked confirmed-session row as superseded (got superseded=${r2.superseded})`);
  const status2 = db.exec(
    `SELECT status, error FROM session_reminder_dispatches WHERE session_id=? AND offset_minutes=-1`,
    [sessionId]
  )[0].values[0];
  assert(status2[0] === 'superseded', `confirmed-session dispatch is now status='superseded'`);
  assert(/attendance_confirmed/.test(String(status2[1])), `superseded reason mentions attendance_confirmed`);

  // ── Case 3: dispatch whose client is no longer opted in → skipped.
  // Create a second client to avoid disturbing case 1's session.
  db.run(
    `INSERT INTO users (email, password_hash, role, language, timezone,
                        therapist_id, telegram_id, consent_therapist_access,
                        session_reminders_enabled, first_name)
     VALUES ('cl2@test', 'x', 'client', 'en', 'Europe/Moscow', ?, '700002', 1, 0, 'Boris')`,
    [therapistId]
  );
  const clientId2 = db.exec(`SELECT id FROM users WHERE email='cl2@test'`)[0].values[0][0];
  db.run(
    `INSERT INTO sessions (therapist_id, client_id, scheduled_at, duration_minutes, client_timezone_snapshot)
     VALUES (?, ?, ?, 60, 'Europe/Moscow')`,
    [therapistId, clientId2, futureSessionAt]
  );
  const sessionId2 = db.exec(`SELECT MAX(id) FROM sessions WHERE client_id=?`, [clientId2])[0].values[0][0];
  db.run(
    `INSERT INTO session_reminder_dispatches
       (session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel, status)
     VALUES (?, ?, ?, 1440, ?, 'telegram', 'pending')`,
    [sessionId2, therapistId, clientId2, pastSendAt]
  );
  const r3 = await reminderService.dispatchDue();
  assert(r3.skipped >= 1, `dispatchDue skipped a row for a not-opted-in client (got skipped=${r3.skipped})`);

  // Cleanup
  try { fs.unlinkSync(tmpDbAbs); fs.rmdirSync(tmpDir); } catch (e) { /* ignore */ }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch((err) => { console.error('FATAL:', err); process.exit(2); });
