const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('src/backend/data/psylink.db');
  const db = new SQL.Database(buf);

  // Check diary entry #39 for transcript
  const r = db.exec('SELECT id, entry_type, transcript_encrypted IS NOT NULL as has_transcript, content_encrypted IS NOT NULL as has_content, encryption_key_id FROM diary_entries WHERE id = 39');
  if (r.length === 0 || r[0].values.length === 0) {
    console.log('Entry #39 not found');
    return;
  }
  const row = r[0].values[0];
  console.log('Entry #39:');
  console.log('  entry_type:', row[1]);
  console.log('  has_transcript:', row[2], row[2] ? '✓ PASS' : '✗ FAIL');
  console.log('  has_content:', row[3]);
  console.log('  encryption_key_id:', row[4]);

  // Check that transcript is actually encrypted
  const r2 = db.exec('SELECT transcript_encrypted FROM diary_entries WHERE id = 39');
  if (r2.length > 0 && r2[0].values.length > 0) {
    const transcriptEnc = r2[0].values[0][0];
    if (transcriptEnc) {
      console.log('  transcript_encrypted starts with:', transcriptEnc.substring(0, 40) + '...');
      console.log('  contains plaintext "TRANSCRIPT_TEST":', transcriptEnc.includes('TRANSCRIPT_TEST') ? '✗ FAIL' : '✓ PASS (encrypted)');
      console.log('  contains plaintext "anxiety":', transcriptEnc.includes('anxiety') ? '✗ FAIL' : '✓ PASS (encrypted)');
    } else {
      console.log('  transcript_encrypted: NULL ✗ FAIL');
    }
  }

  // Also check all recent video entries
  const r3 = db.exec("SELECT id, entry_type, transcript_encrypted IS NOT NULL as has_transcript FROM diary_entries WHERE entry_type = 'video' ORDER BY id DESC LIMIT 5");
  console.log('\nAll recent video entries:');
  if (r3.length > 0) {
    r3[0].values.forEach(function(row) {
      console.log('  Entry #' + row[0] + ': type=' + row[1] + ', has_transcript=' + row[2]);
    });
  }
})();
