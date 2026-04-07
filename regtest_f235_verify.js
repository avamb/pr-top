const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'src/backend/data/prtop.db'), { readonly: true });

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(t.name));
console.log('Total:', tables.length);

// Check each required table and its columns
const requiredTables = {
  users: ['id','telegram_id','email','password_hash','role','therapist_id','consent_therapist_access','invite_code','language','timezone','created_at','updated_at','blocked_at','utm_source','utm_medium','utm_campaign'],
  diary_entries: ['id','client_id','entry_type','content_encrypted','transcript_encrypted','encryption_key_id','payload_version','file_ref','embedding_ref','created_at','updated_at'],
  therapist_notes: ['id','therapist_id','client_id','note_encrypted','encryption_key_id','payload_version','session_date','created_at','updated_at'],
  sessions: ['id','therapist_id','client_id','audio_ref','transcript_encrypted','summary_encrypted','encryption_key_id','payload_version','status','scheduled_at','created_at','updated_at'],
  client_context: [],
  exercises: [],
  exercise_deliveries: [],
  sos_events: [],
  subscriptions: [],
  payments: [],
  audit_logs: [],
  encryption_keys: [],
  platform_settings: []
};

console.log('\n=== COLUMN VERIFICATION ===');
let allOk = true;
for (const [table, expectedCols] of Object.entries(requiredTables)) {
  const exists = tables.some(t => t.name === table);
  if (!exists) {
    console.log('FAIL - MISSING TABLE:', table);
    allOk = false;
    continue;
  }
  const cols = db.prepare('PRAGMA table_info(' + table + ')').all().map(c => c.name);
  if (expectedCols.length > 0) {
    const missing = expectedCols.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('FAIL -', table + ': MISSING COLUMNS:', missing.join(', '));
      allOk = false;
    } else {
      console.log('PASS -', table + ': OK (' + cols.length + ' columns)');
    }
  } else {
    console.log('PASS -', table + ': EXISTS (' + cols.length + ' columns)');
  }
}

console.log('\n=== FEATURE 2 RESULT ===');
console.log(allOk ? 'FEATURE 2: PASS' : 'FEATURE 2: FAIL');
db.close();
