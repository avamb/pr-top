// Resolve sql.js from backend node_modules
const path = require('path');
const initSqlJs = require(path.join(__dirname, 'src/backend/node_modules/sql.js'));
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'src/backend/data/psylink.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = tablesResult[0] ? tablesResult[0].values.map(function(r) { return r[0]; }) : [];
  console.log("=== TABLES ===");
  console.log(JSON.stringify(tables));

  var requiredTables = [
    'users', 'diary_entries', 'therapist_notes', 'sessions',
    'client_context', 'exercises', 'exercise_deliveries', 'sos_events',
    'subscriptions', 'payments', 'audit_logs', 'encryption_keys', 'platform_settings'
  ];

  console.log("\n=== TABLE COLUMNS ===");
  for (var i = 0; i < requiredTables.length; i++) {
    var table = requiredTables[i];
    try {
      var cols = db.exec("PRAGMA table_info(" + table + ")");
      if (!cols[0] || cols[0].values.length === 0) {
        console.log("MISSING TABLE: " + table);
      } else {
        var colNames = cols[0].values.map(function(c) { return c[1]; });
        console.log(table + ": " + colNames.join(", "));
      }
    } catch (e) {
      console.log("ERROR checking " + table + ": " + e.message);
    }
  }

  db.close();
}

main().catch(function(e) { console.error(e); process.exit(1); });
