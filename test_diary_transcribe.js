// Test diary transcription service directly
const { processDiaryTranscription } = require('./src/backend/src/services/diaryTranscription');
const { getDatabase, saveDatabase } = require('./src/backend/src/db/connection');

async function main() {
  // Initialize the database
  const { initDatabase } = require('./src/backend/src/db/connection');
  await initDatabase();

  const db = getDatabase();

  // Find a video diary entry to transcribe
  const entries = db.exec("SELECT id, entry_type, transcript_encrypted IS NOT NULL as has_transcript FROM diary_entries WHERE entry_type = 'video' ORDER BY id DESC LIMIT 5");

  if (entries.length === 0 || entries[0].values.length === 0) {
    console.log('No video diary entries found');
    return;
  }

  console.log('Video diary entries:');
  entries[0].values.forEach(function(row) {
    console.log('  Entry #' + row[0] + ': type=' + row[1] + ', has_transcript=' + (row[2] ? 'YES' : 'NO'));
  });

  // Find one without a transcript
  const untranscribed = entries[0].values.find(function(row) { return !row[2]; });
  if (!untranscribed) {
    console.log('\nAll entries already transcribed');
    return;
  }

  const entryId = untranscribed[0];
  console.log('\nTranscribing entry #' + entryId + '...');

  const result = await processDiaryTranscription(entryId);
  console.log('Result:', JSON.stringify(result, null, 2));

  // Verify
  const check = db.exec('SELECT id, transcript_encrypted IS NOT NULL as has_transcript FROM diary_entries WHERE id = ?', [entryId]);
  if (check.length > 0 && check[0].values.length > 0) {
    console.log('\nAfter transcription:');
    console.log('  has_transcript:', check[0].values[0][1] ? 'YES ✓ PASS' : 'NO ✗ FAIL');

    // Verify it's encrypted
    const raw = db.exec('SELECT transcript_encrypted FROM diary_entries WHERE id = ?', [entryId]);
    if (raw.length > 0 && raw[0].values[0][0]) {
      const enc = raw[0].values[0][0];
      console.log('  transcript_encrypted starts with:', enc.substring(0, 40) + '...');
      console.log('  is encrypted (not plaintext):', !enc.includes('diary') && !enc.includes('Transcript') ? '✓ PASS' : 'checking format...');
      // Check for encryption format (version:iv:authTag:ciphertext)
      console.log('  has encryption format:', enc.split(':').length >= 4 ? '✓ PASS' : '✗ FAIL');
    }
  }

  saveDatabase();
  console.log('\nDatabase saved.');
}

main().catch(function(err) {
  console.error('Error:', err.message);
  console.error(err.stack);
});
