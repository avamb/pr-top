// Regression test: verify database schema using sql.js
const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');
const path = require('path');

async function main() {
  const dbPath = path.join(__dirname, 'src', 'backend', 'data', 'psylink.db');

  if (!fs.existsSync(dbPath)) {
    console.log("FAIL: Database file does not exist at", dbPath);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Get all tables
  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = result.length > 0 ? result[0].values.map(r => r[0]) : [];
  console.log("=== TABLES ===");
  tables.forEach(t => console.log(t));
  console.log("\nTotal tables:", tables.length);

  // Required tables from Feature 2
  const requiredTables = [
    'users', 'diary_entries', 'therapist_notes', 'sessions',
    'client_context', 'exercises', 'exercise_deliveries', 'sos_events',
    'subscriptions', 'payments', 'audit_logs', 'encryption_keys', 'platform_settings'
  ];

  console.log("\n=== COLUMN CHECK ===");
  let allPass = true;
  for (const tableName of requiredTables) {
    const exists = tables.includes(tableName);
    if (!exists) {
      console.log("FAIL: Table '" + tableName + "' does NOT exist");
      allPass = false;
      continue;
    }
    const colResult = db.exec("PRAGMA table_info('" + tableName + "')");
    const cols = colResult.length > 0 ? colResult[0].values.map(r => r[1]) : [];
    console.log("\n" + tableName + ": [" + cols.join(', ') + "]");
  }

  // Specific column checks for users table
  console.log("\n=== SPECIFIC COLUMN CHECKS ===");
  const usersExpected = ['id', 'telegram_id', 'email', 'password_hash', 'role', 'therapist_id',
    'consent_therapist_access', 'invite_code', 'language', 'timezone', 'created_at', 'updated_at',
    'blocked_at', 'utm_source', 'utm_medium', 'utm_campaign'];

  const usersColResult = db.exec("PRAGMA table_info('users')");
  const usersCols = usersColResult.length > 0 ? usersColResult[0].values.map(r => r[1]) : [];

  for (const col of usersExpected) {
    if (!usersCols.includes(col)) {
      console.log("FAIL: users table missing column: " + col);
      allPass = false;
    }
  }
  if (usersExpected.every(c => usersCols.includes(c))) {
    console.log("PASS: users table has all expected columns");
  }

  db.close();
  console.log("\n=== " + (allPass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED") + " ===");
  process.exit(allPass ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
