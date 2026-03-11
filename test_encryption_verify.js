// Test: Verify encryption service encrypts text payloads before DB write
const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');
const path = require('path');

async function verify() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'src', 'backend', 'data', 'psylink.db');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  // Check entry ID 29 (created with known content ENCRYPT_TEST_PAYLOAD_1773242369)
  const result = db.exec('SELECT id, content_encrypted, encryption_key_id, payload_version FROM diary_entries WHERE id = 29');

  if (result.length === 0 || result[0].values.length === 0) {
    console.log('FAIL: Entry not found');
    process.exit(1);
  }

  const row = result[0].values[0];
  const entryId = row[0];
  const contentEncrypted = String(row[1]);
  const encryptionKeyId = row[2];
  const payloadVersion = row[3];

  console.log('Entry ID:', entryId);
  console.log('content_encrypted:', contentEncrypted.substring(0, 80) + '...');
  console.log('encryption_key_id:', encryptionKeyId);
  console.log('payload_version:', payloadVersion);

  // Test 1: content_encrypted must NOT contain plaintext
  const plaintext = 'ENCRYPT_TEST_PAYLOAD_1773242369';
  const containsPlaintext = contentEncrypted.includes(plaintext);
  console.log('\nTest 1 - No plaintext in DB:', !containsPlaintext ? 'PASS' : 'FAIL');

  // Test 2: encryption_key_id must be set
  const hasKeyId = encryptionKeyId !== null && encryptionKeyId > 0;
  console.log('Test 2 - encryption_key_id set:', hasKeyId ? 'PASS' : 'FAIL');

  // Test 3: Encrypted content has valid format (version:iv:authTag:ciphertext)
  const parts = contentEncrypted.split(':');
  const validFormat = parts.length === 4;
  console.log('Test 3 - Valid encrypted format (4 parts):', validFormat ? 'PASS' : 'FAIL');

  // Test 4: Key version is a number
  const keyVersion = parseInt(parts[0], 10);
  const validVersion = !isNaN(keyVersion) && keyVersion >= 1;
  console.log('Test 4 - Valid key version:', validVersion ? 'PASS (' + keyVersion + ')' : 'FAIL');

  // Test 5: IV is valid base64
  try {
    const iv = Buffer.from(parts[1], 'base64');
    console.log('Test 5 - IV is valid base64 (' + iv.length + ' bytes):', iv.length === 12 ? 'PASS' : 'FAIL');
  } catch (e) {
    console.log('Test 5 - IV is valid base64: FAIL');
  }

  // Test 6: Auth tag is valid base64
  try {
    const authTag = Buffer.from(parts[2], 'base64');
    console.log('Test 6 - Auth tag is valid base64 (' + authTag.length + ' bytes):', authTag.length === 16 ? 'PASS' : 'FAIL');
  } catch (e) {
    console.log('Test 6 - Auth tag is valid base64: FAIL');
  }

  // Test 7: Ciphertext is non-empty base64
  const ciphertext = parts[3];
  const hasCiphertext = ciphertext && ciphertext.length > 0;
  console.log('Test 7 - Ciphertext non-empty:', hasCiphertext ? 'PASS' : 'FAIL');

  // Also check other encrypted fields - notes, sessions, client context
  console.log('\n--- Checking other encrypted fields ---');

  const notes = db.exec('SELECT id, note_encrypted, encryption_key_id FROM therapist_notes LIMIT 3');
  if (notes.length > 0 && notes[0].values.length > 0) {
    notes[0].values.forEach(function(r) {
      var enc = String(r[1]);
      var noteParts = enc.split(':');
      console.log('Note #' + r[0] + ': encrypted=' + (noteParts.length === 4) + ', key_id=' + r[2]);
    });
  } else {
    console.log('No notes found (ok - just checking diary for this feature)');
  }

  var allPassed = !containsPlaintext && hasKeyId && validFormat && validVersion && hasCiphertext;
  console.log('\n=== OVERALL: ' + (allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED') + ' ===');

  db.close();
}

verify().catch(function(e) { console.error('Error:', e.message); process.exit(1); });
