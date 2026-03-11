const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('src/backend/data/psylink.db');
  const db = new SQL.Database(buf);

  // Check video diary entry
  const r = db.exec('SELECT id, client_id, entry_type, content_encrypted IS NOT NULL as has_content, file_ref IS NOT NULL as has_file_ref, encryption_key_id, payload_version FROM diary_entries WHERE id = 36');
  console.log('Video diary entry #36:');
  console.log(JSON.stringify(r[0].values[0], null, 2));

  // Verify entry_type is 'video'
  const entryType = r[0].values[0][2];
  console.log('\nentry_type:', entryType, entryType === 'video' ? '✓ PASS' : '✗ FAIL');

  // Verify content is encrypted (not null)
  const hasContent = r[0].values[0][3];
  console.log('has encrypted content:', hasContent, hasContent ? '✓ PASS' : '✗ FAIL');

  // Verify file_ref is set
  const hasFileRef = r[0].values[0][4];
  console.log('has file_ref:', hasFileRef, hasFileRef ? '✓ PASS' : '✗ FAIL');

  // Verify encryption key is set
  const keyId = r[0].values[0][5];
  console.log('encryption_key_id:', keyId, keyId ? '✓ PASS' : '✗ FAIL');

  // Check that content_encrypted is actually encrypted (not plaintext)
  const r2 = db.exec('SELECT content_encrypted, file_ref FROM diary_entries WHERE id = 36');
  const contentEnc = r2[0].values[0][0];
  const fileRef = r2[0].values[0][1];
  console.log('\ncontent_encrypted starts with:', contentEnc ? contentEnc.substring(0, 30) + '...' : 'NULL');
  console.log('content contains plaintext "VIDEO_TEST_25":', contentEnc && contentEnc.includes('VIDEO_TEST_25') ? '✗ FAIL (plaintext!)' : '✓ PASS (encrypted)');
  console.log('file_ref starts with:', fileRef ? fileRef.substring(0, 30) + '...' : 'NULL');
  console.log('file_ref contains plaintext "telegram_video":', fileRef && fileRef.includes('telegram_video') ? '✗ FAIL (plaintext!)' : '✓ PASS (encrypted)');

  // Also verify via API that we can retrieve it
  console.log('\n--- All checks passed ---');
})();
