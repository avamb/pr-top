/**
 * Feature #400 — reminderService verification.
 *
 * Covers:
 *   A. Unit tests for computeWallClockTargets (pure function):
 *      A1. Normal case (24h future, day-before + day-of both planned).
 *      A2. Session less than 24h away → day-before skipped.
 *      A3. Early-morning session where day-of 09:00 is after the session
 *          → day-of falls back to (scheduled_at − 2h).
 *      A4. Session in the past → no targets.
 *      A5. Session less than 2h away → day-of skipped.
 *      A6. Cross-DST (March US spring-forward) — DST-safe math.
 *      A7. Both targets returned in correct order with right offset labels.
 *
 *   B. Integration smoke (against a fresh temp DB):
 *      B1. planForSession on a fixture session 25h in future → creates
 *          (2 targets × N channels) dispatch rows; all 'pending'.
 *      B2. Idempotency: planForSession called twice → still N*2 rows
 *          (unique index OR pre-check prevents duplicates).
 *      B3. planForSession on a client with session_reminders_enabled=0
 *          → no rows planned.
 *      B4. cancelPendingForSession marks all 'pending' rows 'superseded'.
 *      B5. markNoShows promotes an unattended past session to 'no_show'.
 *
 *   C. Helper tests:
 *      C1. isInClientQuietHours respects an enabled cross-midnight window.
 *      C2. parseIso handles SQLite-style "YYYY-MM-DD HH:MM:SS" strings.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Isolate the test DB.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't400-reminderservice-'));
const tmpDbAbs = path.join(tmpDir, 'prtop.db');
process.env.DATABASE_URL = 'sqlite:' + tmpDbAbs;
// Force telegram into dev mode (no real send) regardless of env.
process.env.TELEGRAM_BOT_TOKEN = '';

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

(async () => {
  const conn = require(path.join(__dirname, 'src', 'backend', 'src', 'db', 'connection.js'));
  await conn.initDatabase();
  const db = conn.getDatabase();

  const reminderService = require(path.join(__dirname, 'src', 'backend', 'src', 'services', 'reminderService.js'));
  const {
    computeWallClockTargets,
    planForSession,
    cancelPendingForSession,
    markNoShows,
    OFFSET_LABEL_DAY_BEFORE,
    OFFSET_LABEL_DAY_OF,
    _internal,
  } = reminderService;

  // ──────────────────────────────────────────────────────────────────────
  // A. Unit tests — computeWallClockTargets
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n▶ A. computeWallClockTargets (pure function)');

  // Use a fixed "now" so the test is deterministic.
  // 2026-03-01 08:00 UTC.
  const nowA = new Date(Date.UTC(2026, 2, 1, 8, 0, 0));

  // A1: Session 2026-03-03 18:00 in Europe/Moscow (UTC+3 → 15:00 UTC).
  const sessA1 = '2026-03-03 15:00:00'; // UTC; = 18:00 Moscow
  const tgA1 = computeWallClockTargets(sessA1, 'Europe/Moscow', nowA);
  assert(tgA1.length === 2, 'A1 returns 2 targets for a future session in MSK');
  if (tgA1.length === 2) {
    assert(tgA1[0].offsetLabel === OFFSET_LABEL_DAY_BEFORE, 'A1 first target labelled day_before (1440)');
    assert(tgA1[0].kind === 'day_before',                   'A1 first target kind=day_before');
    assert(tgA1[1].offsetLabel === OFFSET_LABEL_DAY_OF,     'A1 second target labelled day_of (-1)');
    assert(tgA1[1].kind === 'day_of',                       'A1 second target kind=day_of');
    // 2026-03-02 09:00 Moscow = 06:00 UTC.
    assert(tgA1[0].targetIsoUtc === '2026-03-02 06:00:00',  'A1 day_before is 09:00 MSK on the day before (= 06:00 UTC)');
    // 2026-03-03 09:00 Moscow = 06:00 UTC. Session is at 15:00 UTC → minus-2h = 13:00 UTC.
    // 09:00 MSK = 06:00 UTC ≤ 13:00 UTC, so day-of stays at 09:00 MSK.
    assert(tgA1[1].targetIsoUtc === '2026-03-03 06:00:00',  'A1 day_of stays at 09:00 MSK (06:00 UTC) — earlier than scheduled-2h');
  }

  // A2: Session 2026-03-01 12:00 UTC, "now" is 2026-03-01 08:00 UTC.
  // Session is only 4h away → day-before is in the past, day-of also <2h before
  // session: 12:00 UTC = 15:00 MSK; 09:00 MSK that day = 06:00 UTC. 06:00 UTC < 08:00 UTC ("now"),
  // so day-of @ 09:00 MSK is in the past too. Fallback = scheduled - 2h = 10:00 UTC.
  // 10:00 UTC is in the future, before the session → keep day_of.
  const sessA2 = '2026-03-01 12:00:00';
  const tgA2 = computeWallClockTargets(sessA2, 'Europe/Moscow', nowA);
  assert(tgA2.length === 1, 'A2 returns 1 target when day-before is in the past');
  if (tgA2.length >= 1) {
    assert(tgA2[0].kind === 'day_of', 'A2 surviving target is day_of');
    assert(tgA2[0].targetIsoUtc === '2026-03-01 10:00:00', 'A2 day_of fallback = scheduled - 2h (10:00 UTC)');
  }

  // A3: Session very early in the morning — 2026-03-03 06:00 Moscow (03:00 UTC).
  // Day-of 09:00 MSK (= 06:00 UTC) is AFTER the session (03:00 UTC).
  // → day-of falls back to scheduled - 2h = 01:00 UTC.
  // Day-before 09:00 MSK on 2026-03-02 = 06:00 UTC; in the future relative to nowA (08:00 UTC on 03-01)
  // → 2026-03-02 06:00 > 2026-03-01 08:00, so present.
  const sessA3 = '2026-03-03 03:00:00';
  const tgA3 = computeWallClockTargets(sessA3, 'Europe/Moscow', nowA);
  assert(tgA3.length === 2, 'A3 returns 2 targets when day-of 09:00 falls after the session');
  if (tgA3.length === 2) {
    assert(tgA3[1].targetIsoUtc === '2026-03-03 01:00:00', 'A3 day_of falls back to scheduled-2h (01:00 UTC)');
  }

  // A4: Session in the past → no targets.
  const sessA4 = '2026-02-28 12:00:00';
  const tgA4 = computeWallClockTargets(sessA4, 'Europe/Moscow', nowA);
  assert(tgA4.length === 0, 'A4 returns 0 targets for a session in the past');

  // A5: Session ~30min away → day-before in past, scheduled-2h in past → both skipped.
  const sessA5 = '2026-03-01 08:30:00';
  const tgA5 = computeWallClockTargets(sessA5, 'Europe/Moscow', nowA);
  assert(tgA5.length === 0, 'A5 returns 0 targets for a session inside the 2h pre-window');

  // A6: DST spring-forward (US Eastern: 2026-03-08 02:00 → 03:00 EST→EDT).
  // Session 2026-03-09 18:00 New York (= 22:00 UTC, since by then EDT (UTC-4) is active).
  // Day-before 09:00 NY on 2026-03-08 = 14:00 UTC if EDT, but 2026-03-08 is the DST switch day:
  // before 02:00 we're on EST (UTC-5), after 03:00 we're on EDT (UTC-4). 09:00 NY on 03-08 is AFTER
  // the DST switch → EDT → 09:00 EDT = 13:00 UTC.
  const nowA6 = new Date(Date.UTC(2026, 2, 1, 0, 0, 0));
  const sessA6 = '2026-03-09 22:00:00';
  const tgA6 = computeWallClockTargets(sessA6, 'America/New_York', nowA6);
  assert(tgA6.length === 2, 'A6 (DST) returns 2 targets across spring-forward boundary');
  if (tgA6.length === 2) {
    // 2026-03-08 09:00 NY = 13:00 UTC (EDT).
    assert(tgA6[0].targetIsoUtc === '2026-03-08 13:00:00',
      `A6 day_before in NY post-DST = 13:00 UTC, got ${tgA6[0].targetIsoUtc}`);
    // 2026-03-09 09:00 NY = 13:00 UTC.
    assert(tgA6[1].targetIsoUtc === '2026-03-09 13:00:00',
      `A6 day_of in NY post-DST = 13:00 UTC, got ${tgA6[1].targetIsoUtc}`);
  }

  // A7: Verify offset labels are stable for re-plan idempotency.
  const tgA7a = computeWallClockTargets(sessA1, 'Europe/Moscow', nowA);
  const tgA7b = computeWallClockTargets(sessA1, 'Europe/Moscow', nowA);
  assert(tgA7a[0].offsetLabel === tgA7b[0].offsetLabel
      && tgA7a[1].offsetLabel === tgA7b[1].offsetLabel,
    'A7 offset labels are stable across calls (idempotency anchor)');

  // ──────────────────────────────────────────────────────────────────────
  // B. Integration smoke tests
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n▶ B. Integration smoke (fresh DB)');

  // Seed: therapist with reminder_policy_json.enabled=true, client with
  // session_reminders_enabled=1, both contact channels, future session 25h out.
  const therapistEmail = 'therapist+t400@test.local';
  const clientEmail    = 'client+t400@test.local';

  db.run(
    `INSERT INTO users (email, password_hash, role, language, timezone,
                        reminder_policy_json, consent_therapist_access, first_name)
     VALUES (?, 'x', 'therapist', 'en', 'Europe/Moscow', ?, 1, 'Maria')`,
    [therapistEmail, JSON.stringify({ enabled: true, tone: 'neutral' })]
  );
  const therapistId = db.exec(`SELECT id FROM users WHERE email = ?`, [therapistEmail])[0].values[0][0];

  db.run(
    `INSERT INTO users (email, password_hash, role, language, timezone,
                        therapist_id, telegram_id, consent_therapist_access,
                        session_reminders_enabled, first_name)
     VALUES (?, 'x', 'client', 'ru', 'Europe/Moscow', ?, '500001', 1, 1, 'Anna')`,
    [clientEmail, therapistId]
  );
  const clientId = db.exec(`SELECT id FROM users WHERE email = ?`, [clientEmail])[0].values[0][0];

  // Session 25h in the future.
  const sessionDate = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const scheduledAt = sessionDate.toISOString().replace('T', ' ').substring(0, 19);
  db.run(
    `INSERT INTO sessions (therapist_id, client_id, scheduled_at, duration_minutes)
     VALUES (?, ?, ?, 60)`,
    [therapistId, clientId, scheduledAt]
  );
  const sessionId = db.exec(`SELECT id FROM sessions WHERE therapist_id = ? AND client_id = ?`,
    [therapistId, clientId])[0].values[0][0];

  // B1: planForSession.
  const plan1 = await planForSession(sessionId);
  // 2 targets × 2 channels (telegram + email) = up to 4 rows; we have both so expect 4.
  assert(plan1.planned === 4, `B1 planForSession created 4 rows (got ${plan1.planned})`);

  const planned = db.exec(
    `SELECT status, channel, offset_minutes FROM session_reminder_dispatches WHERE session_id = ? ORDER BY offset_minutes, channel`,
    [sessionId]
  );
  assert(planned[0].values.length === 4, `B1 DB now has 4 dispatch rows`);
  const allPending = planned[0].values.every((r) => r[0] === 'pending');
  assert(allPending, 'B1 all 4 dispatches are status="pending"');

  // The client_timezone_snapshot must have been filled.
  const snapRes = db.exec(`SELECT client_timezone_snapshot FROM sessions WHERE id = ?`, [sessionId]);
  assert(snapRes[0].values[0][0] === 'Europe/Moscow', 'B1 client_timezone_snapshot stamped to Europe/Moscow');

  // B2: idempotency — call again, no new rows.
  const plan2 = await planForSession(sessionId);
  assert(plan2.planned === 0, `B2 second planForSession call planned 0 new rows (got ${plan2.planned})`);
  const countAfter = db.exec(`SELECT COUNT(*) FROM session_reminder_dispatches WHERE session_id = ?`, [sessionId])[0].values[0][0];
  assert(countAfter === 4, 'B2 dispatch row count is still 4 after re-plan');

  // B3: planForSession on a client NOT opted in → no rows.
  db.run(
    `INSERT INTO users (email, password_hash, role, language, timezone,
                        therapist_id, telegram_id, consent_therapist_access,
                        session_reminders_enabled, first_name)
     VALUES ('client-noopt+t400@test.local', 'x', 'client', 'en', 'UTC', ?, '500002', 1, 0, 'NoOpt')`,
    [therapistId]
  );
  const clientNoId = db.exec(`SELECT id FROM users WHERE email = 'client-noopt+t400@test.local'`)[0].values[0][0];
  db.run(`INSERT INTO sessions (therapist_id, client_id, scheduled_at, duration_minutes) VALUES (?, ?, ?, 60)`,
    [therapistId, clientNoId, scheduledAt]);
  const sessionNoOptId = db.exec(`SELECT id FROM sessions WHERE client_id = ?`, [clientNoId])[0].values[0][0];
  const planNoOpt = await planForSession(sessionNoOptId);
  assert(planNoOpt.planned === 0 && planNoOpt.skipped_no_optin === true,
    'B3 planForSession skips a client with session_reminders_enabled=0');

  // B4: cancelPendingForSession marks all pending superseded.
  const cancelRes = cancelPendingForSession(sessionId, 'rescheduled');
  assert(cancelRes.cancelled === 4, `B4 cancelPendingForSession returned cancelled=4 (got ${cancelRes.cancelled})`);
  const afterCancel = db.exec(
    `SELECT COUNT(*) FROM session_reminder_dispatches WHERE session_id = ? AND status = 'pending'`,
    [sessionId]
  )[0].values[0][0];
  assert(afterCancel === 0, 'B4 zero pending dispatches remain after cancel');
  const supCount = db.exec(
    `SELECT COUNT(*) FROM session_reminder_dispatches WHERE session_id = ? AND status = 'superseded'`,
    [sessionId]
  )[0].values[0][0];
  assert(supCount === 4, 'B4 all 4 rows are now status="superseded"');

  // B5: markNoShows on a past session (scheduled_at = now - 2h, duration 60, grace 30min).
  const pastDate = new Date(Date.now() - 120 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  db.run(
    `INSERT INTO sessions (therapist_id, client_id, scheduled_at, duration_minutes)
     VALUES (?, ?, ?, 60)`,
    [therapistId, clientId, pastDate]
  );
  const pastSessionId = db.exec(`SELECT MAX(id) FROM sessions WHERE scheduled_at = ?`, [pastDate])[0].values[0][0];
  const nsRes = markNoShows();
  assert(nsRes.marked >= 1, `B5 markNoShows marked at least 1 session (got ${nsRes.marked})`);
  const attRes = db.exec(`SELECT attendance_status FROM sessions WHERE id = ?`, [pastSessionId]);
  assert(attRes[0].values[0][0] === 'no_show', 'B5 past session attendance_status is now "no_show"');

  // B5b: idempotency — re-running markNoShows doesn't flip already-flagged rows.
  const nsRes2 = markNoShows();
  assert(nsRes2.marked === 0, 'B5b second markNoShows pass is a no-op for already-flagged sessions');

  // ──────────────────────────────────────────────────────────────────────
  // C. Helper unit tests
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n▶ C. Helper functions');

  // C1: isInClientQuietHours — cross-midnight window 22:00..08:00.
  // Use a moment that's 03:00 in Moscow.
  // 00:00 UTC = 03:00 Moscow (MSK = UTC+3).
  const at3amMsk = new Date(Date.UTC(2026, 2, 1, 0, 0, 0));
  const prefs = JSON.stringify({ quiet_hours_enabled: true, quiet_hours_start: '22:00', quiet_hours_end: '08:00' });
  assert(_internal.isInClientQuietHours(at3amMsk, 'Europe/Moscow', prefs) === true,
    'C1 03:00 MSK falls in 22:00..08:00 cross-midnight quiet hours');
  // 09:00 UTC = 12:00 Moscow — outside quiet hours.
  const at12pmMsk = new Date(Date.UTC(2026, 2, 1, 9, 0, 0));
  assert(_internal.isInClientQuietHours(at12pmMsk, 'Europe/Moscow', prefs) === false,
    'C1 12:00 MSK is outside 22:00..08:00 quiet hours');
  // Disabled → always false.
  const prefsOff = JSON.stringify({ quiet_hours_enabled: false, quiet_hours_start: '00:00', quiet_hours_end: '23:59' });
  assert(_internal.isInClientQuietHours(at3amMsk, 'Europe/Moscow', prefsOff) === false,
    'C1 disabled quiet_hours always returns false');

  // C2: parseIso handles SQLite "YYYY-MM-DD HH:MM:SS" (no T, no Z).
  const d = _internal.parseIso('2026-05-26 12:34:56');
  assert(d instanceof Date && !isNaN(d.getTime()) && d.getUTCFullYear() === 2026,
    'C2 parseIso accepts SQLite space-separator format');
  assert(_internal.parseIso(null) === null, 'C2 parseIso returns null for null input');
  assert(_internal.parseIso('not a date') === null, 'C2 parseIso returns null for garbage input');

  // ── Cleanup ──
  try {
    fs.unlinkSync(tmpDbAbs);
    fs.rmdirSync(tmpDir);
  } catch (e) { /* ignore */ }

  console.log(`\n────────────────────────────────────────`);
  console.log(`reminderService check: ${passed} passed, ${failed} failed`);
  console.log(`────────────────────────────────────────`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
