// Regression test for features 2, 3, 5
const Database = require('./src/backend/node_modules/better-sqlite3');
const db = new Database('./src/backend/data/prtop.db', { readonly: true });

// Feature 2: Check all tables and their columns
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== FEATURE 2: Database Schema Check ===');
console.log('Tables found:', tables.map(t => t.name).join(', '));
console.log('Table count:', tables.length);

const expectedTables = [
  'users', 'diary_entries', 'therapist_notes', 'sessions', 'client_context',
  'exercises', 'exercise_deliveries', 'sos_events', 'subscriptions', 'payments',
  'audit_logs', 'encryption_keys', 'platform_settings'
];

let allFound = true;
for (const tbl of expectedTables) {
  const found = tables.some(t => t.name === tbl);
  if (!found) {
    console.log('MISSING TABLE:', tbl);
    allFound = false;
  }
}

// Check column details for key tables
const checkColumns = (tableName, expectedCols) => {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const colNames = cols.map(c => c.name);
  let missing = [];
  for (const col of expectedCols) {
    if (!colNames.includes(col)) missing.push(col);
  }
  if (missing.length > 0) {
    console.log(`TABLE ${tableName} MISSING COLUMNS:`, missing.join(', '));
    allFound = false;
  } else {
    console.log(`TABLE ${tableName}: OK (${colNames.length} columns)`);
  }
  return colNames;
};

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

console.log('\nFEATURE 2 RESULT:', allFound ? 'PASS' : 'FAIL');

db.close();
