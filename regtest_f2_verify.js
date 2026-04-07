// Feature 2: Verify database schema via sql.js
var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

async function main() {
  var SQL = await initSqlJs();
  var dbPath = path.resolve(__dirname, 'src/backend/data/prtop.db');

  if (!fs.existsSync(dbPath)) {
    console.log('FAIL: Database file does not exist at', dbPath);
    process.exit(1);
  }

  var fileBuffer = fs.readFileSync(dbPath);
  var db = new SQL.Database(fileBuffer);

  // List all tables
  var tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  var tableNames = tables[0].values.map(function(r) { return r[0]; });
  console.log('Tables found (' + tableNames.length + '):', tableNames.join(', '));

  var expectedTables = [
    'users', 'diary_entries', 'therapist_notes', 'sessions', 'client_context',
    'exercises', 'exercise_deliveries', 'sos_events', 'subscriptions', 'payments',
    'audit_logs', 'encryption_keys', 'platform_settings'
  ];

  var allPass = true;

  for (var i = 0; i < expectedTables.length; i++) {
    var tbl = expectedTables[i];
    if (tableNames.indexOf(tbl) === -1) {
      console.log('MISSING TABLE:', tbl);
      allPass = false;
    }
  }

  // Check columns for key tables
  function checkColumns(tableName, expectedCols) {
    var result = db.exec("PRAGMA table_info(" + tableName + ")");
    if (!result.length) {
      console.log('TABLE ' + tableName + ': NO COLUMNS FOUND');
      allPass = false;
      return;
    }
    var colNames = result[0].values.map(function(r) { return r[1]; });
    var missing = [];
    for (var j = 0; j < expectedCols.length; j++) {
      if (colNames.indexOf(expectedCols[j]) === -1) missing.push(expectedCols[j]);
    }
    if (missing.length > 0) {
      console.log('TABLE ' + tableName + ' MISSING COLUMNS:', missing.join(', '));
      allPass = false;
    } else {
      console.log('TABLE ' + tableName + ': OK (' + colNames.length + ' columns)');
    }
  }

  checkColumns('users', ['id', 'telegram_id', 'email', 'password_hash', 'role', 'therapist_id', 'consent_therapist_access', 'invite_code', 'language', 'timezone', 'created_at', 'updated_at', 'blocked_at', 'utm_source', 'utm_medium', 'utm_campaign']);
  checkColumns('diary_entries', ['id', 'client_id', 'entry_type', 'content_encrypted', 'transcript_encrypted', 'encryption_key_id', 'payload_version', 'file_ref', 'embedding_ref', 'created_at', 'updated_at']);
  checkColumns('therapist_notes', ['id', 'therapist_id', 'client_id', 'note_encrypted', 'encryption_key_id', 'payload_version', 'session_date', 'created_at', 'updated_at']);
  checkColumns('sessions', ['id', 'therapist_id', 'client_id', 'audio_ref', 'transcript_encrypted', 'summary_encrypted', 'encryption_key_id', 'payload_version', 'status', 'scheduled_at', 'created_at', 'updated_at']);
  checkColumns('client_context', ['id']);
  checkColumns('exercises', ['id']);
  checkColumns('exercise_deliveries', ['id']);
  checkColumns('sos_events', ['id']);
  checkColumns('subscriptions', ['id']);
  checkColumns('payments', ['id']);
  checkColumns('audit_logs', ['id']);
  checkColumns('encryption_keys', ['id']);
  checkColumns('platform_settings', ['id']);

  console.log('\n=== FEATURE 2 RESULT:', allPass ? 'PASS' : 'FAIL', '===');

  db.close();
}

main().catch(function(err) { console.error('Error:', err); process.exit(1); });
