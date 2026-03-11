const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'src/backend/data/psylink.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // List all tables
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = tablesResult[0] ? tablesResult[0].values.map(r => r[0]) : [];
  console.log("=== TABLES ===");
  console.log(JSON.stringify(tables));

  // Check each required table and its columns
  const requiredTables = [
    'users', 'diary_entries', 'therapist_notes', 'sessions',
    'client_context', 'exercises', 'exercise_deliveries', 'sos_events',
    'subscriptions', 'payments', 'audit_logs', 'encryption_keys', 'platform_settings'
  ];

  console.log("\n=== TABLE COLUMNS ===");
  for (const table of requiredTables) {
    try {
      const cols = db.exec(`PRAGMA table_info(${table})`);
      if (!cols[0] || cols[0].values.length === 0) {
        console.log(`MISSING TABLE: ${table}`);
      } else {
        const colNames = cols[0].values.map(c => c[1]);
        console.log(`${table}: ${colNames.join(', ')}`);
      }
    } catch (e) {
      console.log(`ERROR checking ${table}: ${e.message}`);
    }
  }

  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
