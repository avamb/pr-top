/**
 * Feature #398 — T-27 Schema Migration Verification (against a COPY of the
 * existing prod-shaped DB).
 *
 * This proves T-27 is safe to run on an already-populated DB shape. We:
 *   1. Copy src/backend/data/prtop.db to a temp location.
 *   2. Run initDatabase() against the copy — this applies ALL migrations including T-27.
 *   3. Verify all new columns + the new table + 3 indexes exist.
 *   4. Re-run initDatabase() a SECOND time on the same copy → no errors,
 *      no duplicate columns.
 *
 * The original prod-shaped DB at src/backend/data/prtop.db is NOT touched.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const sourceDb = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');
if (!fs.existsSync(sourceDb)) {
  console.error('Source prod-shaped DB not found at', sourceDb);
  process.exit(2);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't27-prodcopy-'));
const tmpDbAbs = path.join(tmpDir, 'prtop.db');
fs.copyFileSync(sourceDb, tmpDbAbs);
console.log('Copied prod-shaped DB to', tmpDbAbs, `(${fs.statSync(tmpDbAbs).size} bytes)`);

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
  const connPath = require.resolve(path.join(__dirname, 'src', 'backend', 'src', 'db', 'connection.js'));

  console.log('\n▶ Pass 1 (on prod-shaped DB copy)');
  const conn = require(connPath);
  await conn.initDatabase();
  const db1 = conn.getDatabase();

  // Pre-existing row counts — useful sanity that we did not destroy data.
  const usersBefore = db1.exec('SELECT COUNT(*) FROM users');
  const sessionsBefore = db1.exec('SELECT COUNT(*) FROM sessions');
  const usersCount = usersBefore[0].values[0][0];
  const sessionsCount = sessionsBefore[0].values[0][0];
  console.log(`  Loaded users=${usersCount}, sessions=${sessionsCount}`);
  assert(usersCount > 0, 'users table preserves existing rows after migration');

  // New columns must exist.
  const sessionsCols = getColumns(db1, 'sessions');
  const usersCols = getColumns(db1, 'users');
  for (const c of ['attendance_status', 'attendance_updated_at', 'attendance_updated_by', 'duration_minutes', 'client_timezone_snapshot']) {
    assert(sessionsCols.includes(c), `sessions.${c} exists`);
  }
  for (const c of ['reminder_policy_json', 'session_reminders_enabled', 'session_reminders_asked_at']) {
    assert(usersCols.includes(c), `users.${c} exists`);
  }

  // New table + indexes exist.
  assert(tableExists(db1, 'session_reminder_dispatches'), 'session_reminder_dispatches table exists');
  const srdIndexes = getIndexes(db1, 'session_reminder_dispatches');
  assert(srdIndexes.includes('idx_srd_due'),                    'idx_srd_due index exists');
  assert(srdIndexes.includes('idx_srd_session'),                'idx_srd_session index exists');
  assert(srdIndexes.includes('uq_srd_session_offset_channel'),  'uq_srd_session_offset_channel unique index exists');

  // Existing sessions: new columns must be NULL or default (60 for duration).
  const existingDurations = db1.exec("SELECT COUNT(*) FROM sessions WHERE duration_minutes IS NULL OR duration_minutes = 60");
  const existingAttendance = db1.exec("SELECT COUNT(*) FROM sessions WHERE attendance_status IS NULL");
  if (sessionsCount > 0) {
    assert(existingDurations[0].values[0][0] === sessionsCount,
      `All ${sessionsCount} existing sessions have duration_minutes IS NULL or DEFAULT 60`);
    assert(existingAttendance[0].values[0][0] === sessionsCount,
      `All ${sessionsCount} existing sessions have attendance_status = NULL (no destructive backfill)`);
  } else {
    console.log('  (no pre-existing sessions to validate column defaults against)');
  }

  // Save (commits VACUUM + write).
  conn.saveDatabaseAfterWrite();

  // Pass 2: bust require cache, re-init.
  console.log('\n▶ Pass 2 (idempotent re-run on same prod-shaped DB copy)');
  delete require.cache[connPath];
  const conn2 = require(connPath);
  let err2 = null;
  try {
    await conn2.initDatabase();
  } catch (e) {
    err2 = e;
  }
  assert(err2 === null, 'Second initDatabase() against prod-shaped copy did not throw');

  const db2 = conn2.getDatabase();
  const sessionsCols2 = getColumns(db2, 'sessions');
  const usersCols2 = getColumns(db2, 'users');
  assert(sessionsCols2.filter((c) => c === 'attendance_status').length === 1, 'attendance_status not duplicated');
  assert(usersCols2.filter((c) => c === 'reminder_policy_json').length === 1, 'reminder_policy_json not duplicated');

  // Cleanup.
  try {
    fs.unlinkSync(tmpDbAbs);
    fs.rmdirSync(tmpDir);
  } catch (e) { /* ignore */ }

  console.log(`\n────────────────────────────────────────`);
  console.log(`T-27 prod-DB copy check: ${passed} passed, ${failed} failed`);
  console.log(`────────────────────────────────────────`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
