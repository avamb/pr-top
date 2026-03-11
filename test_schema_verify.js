const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');
const dbBuffer = fs.readFileSync('./src/backend/data/psylink.db');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(dbBuffer);

  // List all tables
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tableNames = tablesResult.length > 0 ? tablesResult[0].values.map(r => r[0]) : [];
  console.log("=== TABLES ===");
  tableNames.forEach(t => console.log(t));
  console.log("\nTotal tables:", tableNames.length);

  // Check each required table and its columns
  const requiredTables = [
    'users', 'diary_entries', 'therapist_notes', 'sessions',
    'client_context', 'exercises', 'exercise_deliveries', 'sos_events',
    'subscriptions', 'payments', 'audit_logs', 'encryption_keys', 'platform_settings'
  ];

  console.log("\n=== COLUMN CHECKS ===");
  for (const tableName of requiredTables) {
    const exists = tableNames.includes(tableName);
    if (!exists) {
      console.log("FAIL: Table '" + tableName + "' does NOT exist");
      continue;
    }
    const colResult = db.exec("PRAGMA table_info(" + tableName + ")");
    if (colResult.length > 0) {
      const colNames = colResult[0].values.map(r => r[1]);
      console.log("OK: " + tableName + " => [" + colNames.join(", ") + "]");
    } else {
      console.log("WARN: " + tableName + " exists but no columns found");
    }
  }

  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
