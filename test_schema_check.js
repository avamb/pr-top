// Test Feature 2: Database schema applied correctly
// We'll query the backend API and also check the DB file directly via sql.js

const initSqlJs = require('C:/Projects/dev-psy-bot/src/backend/node_modules/sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync('C:/Projects/dev-psy-bot/src/backend/data/psylink.db');
  const db = new SQL.Database(dbBuffer);

  // List all tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log("=== TABLES ===");
  const tableNames = tables[0].values.map(r => r[0]);
  console.log(tableNames.join('\n'));

  // Check columns for each required table
  const requiredTables = [
    'users', 'diary_entries', 'therapist_notes', 'sessions',
    'client_context', 'exercises', 'exercise_deliveries', 'sos_events',
    'subscriptions', 'payments', 'audit_logs', 'encryption_keys', 'platform_settings'
  ];

  console.log("\n=== COLUMN CHECK ===");
  let allPass = true;
  for (const table of requiredTables) {
    try {
      const cols = db.exec(`PRAGMA table_info(${table})`);
      if (!cols.length || cols[0].values.length === 0) {
        console.log(`MISSING TABLE: ${table}`);
        allPass = false;
      } else {
        const colNames = cols[0].values.map(c => c[1]);
        console.log(`${table}: ${colNames.join(', ')}`);
      }
    } catch (e) {
      console.log(`ERROR on ${table}: ${e.message}`);
      allPass = false;
    }
  }

  console.log("\n=== RESULT ===");
  console.log(allPass ? "ALL TABLES PRESENT" : "SOME TABLES MISSING");

  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
