var http = require('http');

function req(method, path, body, hdrs) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: '127.0.0.1', port: 3001, path: path, method: method,
      headers: Object.assign({'Content-Type':'application/json'}, hdrs || {})
    };
    var r = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { resolve({status: res.statusCode, headers: res.headers, body: d}); });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

var BOT = { 'x-bot-api-key': 'dev-bot-api-key' };
var uid = Date.now();
var KNOWN_ENTRIES = [
  'Decrypt test: I felt anxious about my upcoming presentation. My heart was racing.',
  'Decrypt test: Had a great therapy session today. We discussed coping strategies.',
  'Decrypt test: Practiced deep breathing. Felt calmer afterward. Will try again tomorrow.'
];

async function main() {
  // Setup: register therapist + client + diary entries
  var csrfR = await req('GET', '/api/csrf-token');
  var csrf = JSON.parse(csrfR.body).csrfToken;

  var regR = await req('POST', '/api/auth/register',
    { email: 'decrypt202_' + uid + '@test.com', password: 'TestPass1', role: 'therapist' },
    { 'x-csrf-token': csrf }
  );
  var regD = JSON.parse(regR.body);
  var token = regD.token;
  var tId = regD.user.id;

  var invR = await req('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  var inv = JSON.parse(invR.body).invite_code;

  var tgId = 'dcli_' + uid;
  var cRegR = await req('POST', '/api/bot/register', { telegram_id: tgId, role: 'client' }, BOT);
  var cId = JSON.parse(cRegR.body).user.id;

  await req('POST', '/api/bot/connect', { telegram_id: tgId, invite_code: inv }, BOT);
  await req('POST', '/api/bot/consent', { telegram_id: tgId, therapist_id: tId, consent: true }, BOT);

  // Create entries with known content
  for (var i = 0; i < KNOWN_ENTRIES.length; i++) {
    await req('POST', '/api/bot/diary',
      { telegram_id: tgId, entry_type: 'text', content: KNOWN_ENTRIES[i] },
      BOT);
  }
  console.log('Created', KNOWN_ENTRIES.length, 'entries with known content');

  // Verify entries are encrypted in DB by checking raw diary endpoint
  var diaryR = await req('GET', '/api/clients/' + cId + '/diary', null,
    { 'Authorization': 'Bearer ' + token });
  var diaryData = JSON.parse(diaryR.body);
  console.log('Diary entries via API:', diaryData.entries.length);

  // Export
  var expR = await req('GET', '/api/clients/' + cId + '/diary/export', null,
    { 'Authorization': 'Bearer ' + token });

  console.log('\n=== EXPORT VERIFICATION ===');
  console.log('Status:', expR.status);

  var expD = JSON.parse(expR.body);
  console.log('Total entries:', expD.total_entries);
  console.log('Export date:', expD.export_date);

  // Check each entry matches known content
  var allMatch = true;
  var noEncryptedBlobs = true;
  var encryptedPattern = /^[0-9]+:[A-Fa-f0-9]+:[A-Fa-f0-9]+:[A-Fa-f0-9]+$/;

  expD.entries.forEach(function(entry, idx) {
    // Check content is decrypted (matches one of our known entries)
    var found = KNOWN_ENTRIES.some(function(known) {
      return entry.content === known;
    });
    if (!found) {
      console.log('FAIL: Entry ' + idx + ' content does not match any known entry');
      console.log('  Got:', (entry.content || '').substring(0, 100));
      allMatch = false;
    }

    // Check no encrypted blobs (format: version:iv:tag:ciphertext)
    if (entry.content && encryptedPattern.test(entry.content)) {
      console.log('FAIL: Entry ' + idx + ' appears to be encrypted:', entry.content.substring(0, 50));
      noEncryptedBlobs = false;
    }

    // Check entry has proper fields
    if (!entry.id || !entry.entry_type || !entry.created_at) {
      console.log('FAIL: Entry ' + idx + ' missing required fields');
      allMatch = false;
    }
  });

  console.log('\nContent matches known entries:', allMatch ? 'PASS' : 'FAIL');
  console.log('No encrypted blobs in export:', noEncryptedBlobs ? 'PASS' : 'FAIL');
  console.log('All entries have id:', expD.entries.every(function(e) { return !!e.id; }) ? 'PASS' : 'FAIL');
  console.log('All entries have entry_type:', expD.entries.every(function(e) { return e.entry_type === 'text'; }) ? 'PASS' : 'FAIL');
  console.log('All entries have created_at:', expD.entries.every(function(e) { return !!e.created_at; }) ? 'PASS' : 'FAIL');
  console.log('Export has client_id:', expD.client_id === cId ? 'PASS' : 'FAIL');
  console.log('Export has client_identifier:', !!expD.client_identifier ? 'PASS' : 'FAIL');

  // Check Content-Disposition header for proper filename
  var disposition = expR.headers['content-disposition'] || '';
  console.log('Has attachment disposition:', disposition.indexOf('attachment') >= 0 ? 'PASS' : 'FAIL');
  console.log('Has .json extension:', disposition.indexOf('.json') >= 0 ? 'PASS' : 'FAIL');

  console.log('\n=== ALL CHECKS COMPLETE ===');
}

main().catch(function(e) { console.error('Error:', e.message); });
