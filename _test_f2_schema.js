const path = require('path');
const fs = require('fs');
const initSqlJs = require(path.join(__dirname, 'src', 'backend', 'node_modules', 'sql.js'));

const dbPath = path.join(__dirname, 'src', 'backend', 'data', 'psylink.db');

async function main() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // List all tables
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = tablesResult.length > 0 ? tablesResult[0].values.map(r => r[0]) : [];
  console.log('=== TABLES ===');
  tables.forEach(t => console.log(t));

  const requiredTables = {
    users: ['id','telegram_id','email','password_hash','role','therapist_id','consent_therapist_access','invite_code','language','timezone','created_at','updated_at','blocked_at','utm_source','utm_medium','utm_campaign'],
    diary_entries: ['id','client_id','entry_type','content_encrypted','transcript_encrypted','encryption_key_id','payload_version','file_ref','embedding_ref','created_at','updated_at'],
    therapist_notes: ['id','therapist_id','client_id','note_encrypted','encryption_key_id','payload_version','session_date','created_at','updated_at'],
    sessions: ['id','therapist_id','client_id','audio_ref','transcript_encrypted','summary_encrypted','encryption_key_id','payload_version','status','scheduled_at','created_at','updated_at'],
    client_context: null,
    exercises: null,
    exercise_deliveries: null,
    sos_events: null,
    subscriptions: null,
    payments: null,
    audit_logs: null,
    encryption_keys: null,
    platform_settings: null
  };

  let allPass = true;
  console.log('\n=== COLUMN CHECKS ===');
  for (const [table, expectedCols] of Object.entries(requiredTables)) {
    const exists = tables.includes(table);
    if (!exists) {
      console.log('FAIL: Table "' + table + '" does not exist');
      allPass = false;
      continue;
    }

    if (expectedCols) {
      const colsResult = db.exec("PRAGMA table_info('" + table + "')");
      const colNames = colsResult.length > 0 ? colsResult[0].values.map(r => r[1]) : [];
      for (const expected of expectedCols) {
        if (!colNames.includes(expected)) {
          console.log('FAIL: Table "' + table + '" missing column "' + expected + '". Has: ' + colNames.join(', '));
          allPass = false;
        }
      }
    }
    console.log('OK: Table "' + table + '" exists' + (expectedCols ? ' with required columns' : ''));
  }

  console.log('\n=== RESULT ===');
  console.log(allPass ? 'PASS' : 'FAIL');
  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
