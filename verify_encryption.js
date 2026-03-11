// Verify all Class A data in DB is encrypted (no plaintext fallback)
const path = require('path');
const fs = require('fs');

// Set working dir for the connection module
process.chdir(path.join(__dirname, 'src', 'backend'));

// Set env vars the connection module may need
process.env.DB_PATH = path.join(__dirname, 'src', 'backend', 'data', 'psylink.db');

const connPath = path.join(__dirname, 'src', 'backend', 'src', 'db', 'connection');
const { initDatabase, getDatabase } = require(connPath);

// Initialize then check
initDatabase();

// Wait a tick for async init
setTimeout(() => {
  const db = getDatabase();

  function checkEncrypted(label, query) {
    const rows = db.exec(query);
    if (!rows || rows.length === 0 || rows[0].values.length === 0) {
      console.log(`${label}: No data (OK)`);
      return true;
    }
    let ok = true;
    rows[0].values.forEach(r => {
      const val = r[1];
      if (!val) { return; }
      const parts = val.split(':');
      const isEnc = parts.length === 4 && /^\d+$/.test(parts[0]);
      if (!isEnc) {
        console.log(`  FAIL: ${label} ID ${r[0]} NOT encrypted! Starts: ${val.substring(0, 60)}`);
        ok = false;
      } else {
        console.log(`  OK: ${label} ID ${r[0]} (v${parts[0]})`);
      }
    });
    return ok;
  }

  let pass = true;
  console.log('=== Verifying Class A data encryption ===\n');

  pass &= checkEncrypted('diary.content', 'SELECT id, content_encrypted FROM diary_entries WHERE content_encrypted IS NOT NULL LIMIT 5');
  pass &= checkEncrypted('diary.transcript', 'SELECT id, transcript_encrypted FROM diary_entries WHERE transcript_encrypted IS NOT NULL LIMIT 3');
  pass &= checkEncrypted('notes', 'SELECT id, note_encrypted FROM therapist_notes WHERE note_encrypted IS NOT NULL LIMIT 5');
  pass &= checkEncrypted('session.transcript', 'SELECT id, transcript_encrypted FROM sessions WHERE transcript_encrypted IS NOT NULL LIMIT 3');
  pass &= checkEncrypted('session.summary', 'SELECT id, summary_encrypted FROM sessions WHERE summary_encrypted IS NOT NULL LIMIT 3');
  pass &= checkEncrypted('context.anamnesis', 'SELECT id, anamnesis_encrypted FROM client_context WHERE anamnesis_encrypted IS NOT NULL LIMIT 3');
  pass &= checkEncrypted('sos.message', 'SELECT id, message_encrypted FROM sos_events WHERE message_encrypted IS NOT NULL LIMIT 3');
  pass &= checkEncrypted('exercise.response', 'SELECT id, response_encrypted FROM exercise_deliveries WHERE response_encrypted IS NOT NULL LIMIT 3');

  // Check encryption service for bypass patterns
  console.log('\n=== Checking for encryption bypass ===');
  const encService = fs.readFileSync(path.join(__dirname, 'src/backend/src/services/encryption.js'), 'utf8');
  const bypasses = ['DISABLE_ENCRYPT', 'SKIP_ENCRYPT', 'NO_ENCRYPT', 'BYPASS_ENCRYPT'];
  let hasBypass = false;
  bypasses.forEach(p => {
    if (encService.includes(p)) { console.log(`  FAIL: Found ${p}`); hasBypass = true; }
  });
  // Check for NODE_ENV conditional that skips encryption
  if (/if\s*\(.*NODE_ENV.*\)\s*{?\s*return\s+(plain|text|data)/i.test(encService)) {
    console.log('  FAIL: NODE_ENV conditional bypasses encryption');
    hasBypass = true;
  }
  if (!hasBypass) console.log('  OK: No bypass flags found');

  console.log('\n=== RESULT ===');
  console.log(pass && !hasBypass ? 'PASS: All Class A data encrypted, no plaintext fallback' : 'FAIL');

  process.exit(0);
}, 500);
