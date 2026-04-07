// Temporary schema verification script for Feature 2
// Reads the existing prtop.db and checks all expected tables/columns

const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'src/backend/data/prtop.db');

// Expected schema definitions (based on connection.js CREATE TABLE + all migrations)
const EXPECTED = {
  users: [
    'id', 'telegram_id', 'email', 'password_hash', 'role', 'therapist_id',
    'consent_therapist_access', 'invite_code', 'language', 'timezone',
    'created_at', 'updated_at', 'blocked_at',
    'utm_source', 'utm_medium', 'utm_campaign',
    // migrations
    'escalation_preferences', 'first_name', 'last_name', 'phone',
    'telegram_username', 'other_info'
  ],
  diary_entries: [
    'id', 'client_id', 'entry_type', 'content_encrypted', 'transcript_encrypted',
    'encryption_key_id', 'payload_version', 'file_ref', 'embedding_ref',
    'created_at', 'updated_at',
    // migrations
    'audio_file_ref', 'transcription_status'
  ],
  therapist_notes: [
    'id', 'therapist_id', 'client_id', 'note_encrypted', 'encryption_key_id',
    'payload_version', 'session_date', 'created_at', 'updated_at'
  ],
  sessions: [
    'id', 'therapist_id', 'client_id', 'audio_ref', 'transcript_encrypted',
    'summary_encrypted', 'encryption_key_id', 'payload_version', 'status',
    'scheduled_at', 'created_at', 'updated_at'
  ],
  client_context: [
    'id', 'therapist_id', 'client_id', 'anamnesis_encrypted',
    'current_goals_encrypted', 'contraindications_encrypted',
    'ai_instructions_encrypted', 'encryption_key_id', 'payload_version',
    'created_at', 'updated_at'
  ],
  exercises: [
    'id', 'category', 'title_ru', 'title_en', 'title_es',
    'description_ru', 'description_en', 'description_es',
    'instructions_ru', 'instructions_en', 'instructions_es',
    'is_custom', 'therapist_id', 'created_at', 'updated_at',
    // migrations
    'title_uk', 'description_uk', 'instructions_uk'
  ],
  exercise_deliveries: [
    'id', 'exercise_id', 'therapist_id', 'client_id', 'status',
    'response_encrypted', 'encryption_key_id', 'sent_at', 'completed_at'
  ],
  sos_events: [
    'id', 'client_id', 'therapist_id', 'message_encrypted', 'encryption_key_id',
    'status', 'created_at', 'acknowledged_at'
  ],
  subscriptions: [
    'id', 'therapist_id', 'stripe_customer_id', 'stripe_subscription_id',
    'plan', 'status', 'trial_ends_at', 'current_period_start',
    'current_period_end', 'created_at', 'updated_at',
    // migrations
    'pending_plan', 'stripe_payment_method_id', 'canceled_at',
    'is_manual_override', 'override_reason', 'override_expires_at', 'override_set_by'
  ],
  payments: [
    'id', 'subscription_id', 'stripe_payment_intent_id', 'amount',
    'currency', 'status', 'created_at'
  ],
  audit_logs: [
    'id', 'actor_id', 'action', 'target_type', 'target_id',
    'details_encrypted', 'ip_address', 'created_at'
  ],
  encryption_keys: [
    'id', 'key_version', 'status', 'created_at', 'rotated_at'
  ],
  platform_settings: [
    'id', 'key', 'value', 'updated_by', 'updated_at'
  ]
};

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('ERROR: Database file not found at', DB_PATH);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Get all tables
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const allTables = tablesResult.length ? tablesResult[0].values.map(r => r[0]) : [];
  console.log('\n=== ALL TABLES IN DATABASE ===');
  console.log(allTables.join(', '));

  console.log('\n=== TABLE COLUMN VERIFICATION ===\n');

  let allPass = true;

  for (const [tableName, expectedCols] of Object.entries(EXPECTED)) {
    if (!allTables.includes(tableName)) {
      console.log('FAIL  [' + tableName + '] - TABLE DOES NOT EXIST');
      allPass = false;
      continue;
    }

    // Get actual columns via PRAGMA
    const pragmaResult = db.exec('PRAGMA table_info(' + tableName + ')');
    const actualCols = pragmaResult.length
      ? pragmaResult[0].values.map(r => r[1])  // column index 1 = name
      : [];

    const missing = expectedCols.filter(c => !actualCols.includes(c));
    const extra = actualCols.filter(c => !expectedCols.includes(c));

    if (missing.length === 0) {
      const extraNote = extra.length ? ' (+ ' + extra.length + ' extra cols: ' + extra.join(', ') + ')' : '';
      console.log('PASS  [' + tableName + ']' + extraNote);
    } else {
      console.log('FAIL  [' + tableName + ']');
      console.log('      Missing columns: ' + missing.join(', '));
      if (extra.length) console.log('      Extra columns: ' + extra.join(', '));
      allPass = false;
    }

    // Print all actual columns for reference
    console.log('      Actual cols (' + actualCols.length + '): ' + actualCols.join(', '));
    console.log('');
  }

  console.log('=== SUMMARY ===');
  console.log(allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
  console.log('');

  db.close();
}

main().catch(e => {
  console.error('Script error:', e);
  process.exit(1);
});
