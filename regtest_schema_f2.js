var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

async function main() {
  var SQL = await initSqlJs();
  var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');
  if (!fs.existsSync(dbPath)) {
    console.log('ERROR: Database file not found at ' + dbPath);
    process.exit(1);
  }
  var buf = fs.readFileSync(dbPath);
  var db = new SQL.Database(buf);

  // List all tables
  var tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  var tableNames = tables.length > 0 ? tables[0].values.map(function(r){return r[0]}) : [];
  console.log('=== ALL TABLES (' + tableNames.length + ') ===');
  console.log(tableNames.join(', '));

  // Required tables and their required columns
  var required = {
    'users': ['id','telegram_id','email','password_hash','role','therapist_id','consent_therapist_access','invite_code','language','timezone','created_at','updated_at','blocked_at','utm_source','utm_medium','utm_campaign'],
    'diary_entries': ['id','client_id','entry_type','content_encrypted','transcript_encrypted','encryption_key_id','payload_version','file_ref','embedding_ref','created_at','updated_at'],
    'therapist_notes': ['id','therapist_id','client_id','note_encrypted','encryption_key_id','payload_version','session_date','created_at','updated_at'],
    'sessions': ['id','therapist_id','client_id','audio_ref','transcript_encrypted','summary_encrypted','encryption_key_id','payload_version','status','scheduled_at','created_at','updated_at'],
    'client_context': [],
    'exercises': [],
    'exercise_deliveries': [],
    'sos_events': [],
    'subscriptions': [],
    'payments': [],
    'audit_logs': [],
    'encryption_keys': [],
    'platform_settings': []
  };

  var allPass = true;
  console.log('\n=== SCHEMA CHECK ===');
  var tableKeys = Object.keys(required);
  for (var i = 0; i < tableKeys.length; i++) {
    var table = tableKeys[i];
    if (tableNames.indexOf(table) === -1) {
      console.log('FAIL: Table "' + table + '" is MISSING');
      allPass = false;
      continue;
    }
    var cols = db.exec('PRAGMA table_info(' + table + ')');
    var colNames = cols.length > 0 ? cols[0].values.map(function(r){return r[1]}) : [];
    console.log(table + ': ' + colNames.join(', '));

    var reqCols = required[table];
    for (var j = 0; j < reqCols.length; j++) {
      if (colNames.indexOf(reqCols[j]) === -1) {
        console.log('  FAIL: Missing column "' + reqCols[j] + '" in ' + table);
        allPass = false;
      }
    }
  }

  console.log('\n=== RESULT ===');
  if (allPass) {
    console.log('ALL SCHEMA CHECKS PASSED');
  } else {
    console.log('SOME SCHEMA CHECKS FAILED');
  }

  db.close();
}

main().catch(function(e){console.error('Error:', e.message)});
