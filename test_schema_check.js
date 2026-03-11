var db = require('better-sqlite3')('C:/Projects/dev-psy-bot/src/backend/data/psylink.db');
var tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("=== TABLES ===");
tables.forEach(function(t) { console.log(t.name); });

var expected = [
  'users', 'diary_entries', 'therapist_notes', 'sessions',
  'client_context', 'exercises', 'exercise_deliveries',
  'sos_events', 'subscriptions', 'payments', 'audit_logs',
  'encryption_keys', 'platform_settings'
];

console.log("\n=== COLUMN CHECK ===");
expected.forEach(function(tbl) {
  var cols = db.prepare("PRAGMA table_info(" + tbl + ")").all();
  if (cols.length === 0) {
    console.log("MISSING TABLE: " + tbl);
  } else {
    console.log(tbl + ": " + cols.map(function(c) { return c.name; }).join(", "));
  }
});

db.close();
console.log("\nDone.");
