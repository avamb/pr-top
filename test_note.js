// Test: verify note is encrypted, check last_insert_rowid behavior
const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('src/backend/data/psylink.db');
  const db = new SQL.Database(buf);

  // Insert a test row
  db.run("INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted, encryption_key_id, payload_version, created_at, updated_at) VALUES (1, 1, 'test', 1, 1, datetime('now'), datetime('now'))");

  // Check last_insert_rowid
  var r = db.exec('SELECT last_insert_rowid()');
  console.log('last_insert_rowid result:', JSON.stringify(r));

  // Verify encrypted data is not plaintext
  var notes = db.exec('SELECT id, note_encrypted FROM therapist_notes WHERE therapist_id = 201');
  console.log('Encrypted notes:', JSON.stringify(notes));

  // Verify NOTE_TEST_12345 is NOT in note_encrypted as plaintext
  var plainCheck = db.exec("SELECT id FROM therapist_notes WHERE note_encrypted LIKE '%NOTE_TEST_12345%'");
  console.log('Plaintext check (should be empty):', JSON.stringify(plainCheck));
}

main();
