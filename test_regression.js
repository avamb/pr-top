const Database = require('better-sqlite3');
const db = new Database('C:/Projects/dev-psy-bot/src/backend/data/psylink.db');

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(t.name));

// Get columns for each required table
const requiredTables = ['users','diary_entries','therapist_notes','sessions','client_context','exercises','exercise_deliveries','sos_events','subscriptions','payments','audit_logs','encryption_keys','platform_settings'];
console.log('\n=== COLUMNS ===');
requiredTables.forEach(table => {
  try {
    const cols = db.prepare('PRAGMA table_info(' + table + ')').all();
    console.log('\n' + table + ': ' + cols.map(c => c.name).join(', '));
  } catch(e) {
    console.log('\n' + table + ': TABLE MISSING!');
  }
});
db.close();
