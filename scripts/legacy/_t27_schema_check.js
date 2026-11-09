/**
 * Feature #398 — T-27 Schema Migration Verification
 *
 * Boots the backend, runs initDatabase(), and verifies via PRAGMA table_info
 * that all session-reminder columns exist on `sessions` and `users`, and that
 * the `session_reminder_dispatches` table + its 3 indexes exist.
 *
 * Also runs the migration TWICE on the same DB to confirm idempotency
 * (no ALTER TABLE errors thrown, no duplicate index errors).
 *
 * Usage:
 *   node _t27_schema_check.js
 *
 * Exit codes:
 *   0  — all assertions passed
 *   1  — one or more assertions failed
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Use a fresh, isolated temporary database file so we exercise the
// "create new database" code path on the first run and the "load existing
// database" code path on the second run — proving idempotency.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't27-schema-check-'));
const tmpDbAbs = path.join(tmpDir, 'prtop.db');

// connection.js resolves DATABASE_URL relative to src/backend, so compute a
// path that comes out absolute regardless of who runs us from where.
process.env.DATABASE_URL = 'sqlite:' + tmpDbAbs;

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

function getColumns(db, table) {
  const res = db.exec(`PRAGMA table_info(${table})`);
  if (!res || res.length === 0) return [];
  // sql.js exec returns [{ columns, values }]
  const nameIdx = res[0].columns.indexOf('name');
  return res[0].values.map((row) => row[nameIdx]);
}

function getIndexes(db, table) {
  const res = db.exec(`PRAGMA index_list(${table})`);
  if (!res || res.length === 0) return [];
  const nameIdx = res[0].columns.indexOf('name');
  return res[0].values.map((row) => row[nameIdx]);
}

function tableExists(db, table) {
  const res = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [table]
  );
  return res && res.length > 0 && res[0].values.length > 0;
}

(async () => {
  // Resolve connection.js relative to this script (project root).
  const conn = require(path.join(__dirname, 'src', 'backend', 'src', 'db', 'connection.js'));

  console.log('▶ Pass 1: fresh DB');
  await conn.initDatabase();
  const db1 = conn.getDatabase();

  const sessionsCols1 = getColumns(db1, 'sessions');
  const usersCols1 = getColumns(db1, 'users');

  assert(sessionsCols1.includes('attendance_status'),         'sessions.attendance_status exists');
  assert(sessionsCols1.includes('attendance_updated_at'),     'sessions.attendance_updated_at exists');
  assert(sessionsCols1.includes('attendance_updated_by'),     'sessions.attendance_updated_by exists');
  assert(sessionsCols1.includes('duration_minutes'),          'sessions.duration_minutes exists');
  assert(sessionsCols1.includes('client_timezone_snapshot'),  'sessions.client_timezone_snapshot exists');

  assert(usersCols1.includes('reminder_policy_json'),         'users.reminder_policy_json exists');
  assert(usersCols1.includes('session_reminders_enabled'),    'users.session_reminders_enabled exists');
  assert(usersCols1.includes('session_reminders_asked_at'),   'users.session_reminders_asked_at exists');

  assert(tableExists(db1, 'session_reminder_dispatches'),     'session_reminder_dispatches table exists');

  const srdCols = getColumns(db1, 'session_reminder_dispatches');
  const expectedSrdCols = [
    'id', 'session_id', 'therapist_id', 'client_id', 'offset_minutes',
    'scheduled_send_at', 'channel', 'status', 'sent_at', 'error',
    'message_ref', 'retry_count', 'created_at',
  ];
  for (const col of expectedSrdCols) {
    assert(srdCols.includes(col), `session_reminder_dispatches.${col} column exists`);
  }

  const srdIndexes = getIndexes(db1, 'session_reminder_dispatches');
  assert(srdIndexes.includes('idx_srd_due'),                    'idx_srd_due index exists');
  assert(srdIndexes.includes('idx_srd_session'),                'idx_srd_session index exists');
  assert(srdIndexes.includes('uq_srd_session_offset_channel'),  'uq_srd_session_offset_channel unique index exists');

  // Verify uq_srd_session_offset_channel is actually unique.
  const idxInfo = db1.exec("PRAGMA index_list(session_reminder_dispatches)");
  if (idxInfo && idxInfo.length > 0) {
    const cols = idxInfo[0].columns;
    const nameI = cols.indexOf('name');
    const uniqueI = cols.indexOf('unique');
    const uqRow = idxInfo[0].values.find((r) => r[nameI] === 'uq_srd_session_offset_channel');
    assert(uqRow && uqRow[uniqueI] === 1, 'uq_srd_session_offset_channel is UNIQUE (unique=1)');
  } else {
    assert(false, 'uq_srd_session_offset_channel is UNIQUE (PRAGMA index_list returned no rows)');
  }

  // Save the DB to disk and re-init to exercise the "load existing DB" path.
  conn.saveDatabaseAfterWrite();

  // Pass 2: idempotency check. Re-running initDatabase() on a DB that already
  // has T-27 applied must not throw and must not duplicate anything.
  console.log('\n▶ Pass 2: idempotent re-run on the same DB');

  // Force re-init by reloading the module. require cache makes the singleton
  // sticky, so we need to bust the cache for connection.js.
  const connPath = require.resolve(path.join(__dirname, 'src', 'backend', 'src', 'db', 'connection.js'));
  delete require.cache[connPath];
  const conn2 = require(connPath);

  let secondInitError = null;
  try {
    await conn2.initDatabase();
  } catch (err) {
    secondInitError = err;
  }
  assert(secondInitError === null, 'Second initDatabase() call did not throw');

  const db2 = conn2.getDatabase();

  // All columns should still be present (no double-add disaster).
  const sessionsCols2 = getColumns(db2, 'sessions');
  const usersCols2 = getColumns(db2, 'users');

  assert(sessionsCols2.filter(c => c === 'attendance_status').length === 1,
    'sessions.attendance_status appears exactly once (no duplicate column)');
  assert(sessionsCols2.filter(c => c === 'duration_minutes').length === 1,
    'sessions.duration_minutes appears exactly once');
  assert(usersCols2.filter(c => c === 'reminder_policy_json').length === 1,
    'users.reminder_policy_json appears exactly once');
  assert(usersCols2.filter(c => c === 'session_reminders_enabled').length === 1,
    'users.session_reminders_enabled appears exactly once');

  // Table + indexes still exist after re-run.
  assert(tableExists(db2, 'session_reminder_dispatches'),
    'session_reminder_dispatches table still present after re-run');
  const srdIndexes2 = getIndexes(db2, 'session_reminder_dispatches');
  assert(srdIndexes2.includes('idx_srd_due'),                   'idx_srd_due still present');
  assert(srdIndexes2.includes('idx_srd_session'),               'idx_srd_session still present');
  assert(srdIndexes2.includes('uq_srd_session_offset_channel'), 'uq_srd_session_offset_channel still present');

  // Spot-check default behavior: a brand-new sessions row should have
  // duration_minutes defaulted to 60, and the new attendance_* columns NULL.
  // We do this without seeding therapist/client rows by using INSERT INTO ... DEFAULT VALUES
  // on the schema's nullable columns is not possible (therapist_id NOT NULL),
  // so we just verify the column DEFAULT via the PRAGMA result instead.
  const sessionsInfo = db2.exec("PRAGMA table_info(sessions)");
  const sessionsRows = sessionsInfo[0].values;
  const colsIdx = sessionsInfo[0].columns;
  const colName = colsIdx.indexOf('name');
  const colDflt = colsIdx.indexOf('dflt_value');
  const durRow = sessionsRows.find((r) => r[colName] === 'duration_minutes');
  assert(durRow && String(durRow[colDflt]) === '60', 'sessions.duration_minutes default is 60');

  // Verify the unique index actually rejects duplicates structurally.
  // We need two valid therapist + client rows in users first so the FK
  // constraints pass. We use 'PRAGMA foreign_keys = OFF' to skip seeding —
  // SQLite unique index enforcement runs regardless of FK state.
  db2.run('PRAGMA foreign_keys = OFF');
  // Insert a fake session row to satisfy session_id FK lookups by id.
  // Use a high ID to avoid colliding with any seed data.
  try { db2.run("INSERT OR REPLACE INTO sessions (id, therapist_id, client_id, scheduled_at) VALUES (999001, 1, 2, '2030-01-01 12:00:00')"); } catch (e) { /* ignore if blocked */ }
  let firstInsertOk = false;
  try {
    db2.run("INSERT INTO session_reminder_dispatches (session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel) VALUES (999001, 1, 2, 1440, '2030-01-01 09:00:00', 'telegram')");
    firstInsertOk = true;
  } catch (e) {
    // ignore
  }
  assert(firstInsertOk, 'First dispatch row inserts successfully');

  let dupRejected = false;
  try {
    db2.run("INSERT INTO session_reminder_dispatches (session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel) VALUES (999001, 1, 2, 1440, '2030-01-01 09:00:00', 'telegram')");
  } catch (e) {
    dupRejected = true;
  }
  assert(dupRejected, 'Duplicate (session_id, offset_minutes, channel) is rejected by unique index');

  // Different channel for same session+offset should be allowed.
  let differentChannelOk = false;
  try {
    db2.run("INSERT INTO session_reminder_dispatches (session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel) VALUES (999001, 1, 2, 1440, '2030-01-01 09:00:00', 'email')");
    differentChannelOk = true;
  } catch (e) {
    // ignore
  }
  assert(differentChannelOk, 'Different channel for same (session_id, offset_minutes) IS allowed');

  // Cleanup test rows (best-effort).
  try { db2.run("DELETE FROM session_reminder_dispatches WHERE session_id = 999001"); } catch (e) { /* ignore */ }
  try { db2.run("DELETE FROM sessions WHERE id = 999001"); } catch (e) { /* ignore */ }
  db2.run('PRAGMA foreign_keys = ON');

  // Cleanup tmp dir
  try {
    fs.unlinkSync(tmpDbAbs);
    fs.rmdirSync(tmpDir);
  } catch (e) { /* ignore */ }

  console.log(`\n────────────────────────────────────────`);
  console.log(`T-27 schema check: ${passed} passed, ${failed} failed`);
  console.log(`────────────────────────────────────────`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
