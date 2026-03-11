// Test: Verify decryption on authorized read (Feature #49)
// Round-trip: create encrypted diary entry -> read via authorized therapist API -> verify plaintext returned
var http = require('http');

var BOT_KEY = 'dev-bot-api-key';
var KNOWN_CONTENT = 'DECRYPT_TEST_12345';
var TIMESTAMP = Date.now();
var THERAPIST_EMAIL = 'decrypt_test_' + TIMESTAMP + '@test.com';
var THERAPIST_PASS = 'TestPass123!';
var CLIENT_TG = 'decrypt_client_' + TIMESTAMP;

function request(method, path, body, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001,
      path: path, method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
    };
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('=== Feature #49: Encryption service decrypts on authorized read ===\n');

  // 1. Register therapist
  console.log('1. Register therapist...');
  var regRes = await request('POST', '/api/auth/register', {
    email: THERAPIST_EMAIL, password: THERAPIST_PASS, confirm_password: THERAPIST_PASS
  });
  console.log('   Status:', regRes.status);
  var token = regRes.body.token;
  var therapistId = regRes.body.user && regRes.body.user.id;
  console.log('   Therapist ID:', therapistId);

  // 2. Get therapist's invite code
  console.log('2. Get invite code...');
  var inviteRes = await request('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  var inviteCode = inviteRes.body.invite_code;
  console.log('   Invite code:', inviteCode);

  // 3. Register client via bot
  console.log('3. Register client via bot...');
  var clientRes = await request('POST', '/api/bot/register', {
    telegram_id: CLIENT_TG, role: 'client', display_name: 'DecryptTestClient'
  }, { 'x-bot-api-key': BOT_KEY });
  var clientUserId = clientRes.body.user && clientRes.body.user.id;
  console.log('   Client user ID:', clientUserId);

  // 4. Connect client to therapist
  console.log('4. Connect client...');
  var connectRes = await request('POST', '/api/bot/connect', {
    telegram_id: CLIENT_TG, invite_code: inviteCode
  }, { 'x-bot-api-key': BOT_KEY });
  console.log('   Connect status:', connectRes.status, connectRes.body.message || '');

  // 5. Grant consent
  console.log('5. Grant consent...');
  var consentRes = await request('POST', '/api/bot/consent', {
    telegram_id: CLIENT_TG, therapist_id: therapistId, consent: true
  }, { 'x-bot-api-key': BOT_KEY });
  console.log('   Consent status:', consentRes.status, consentRes.body.message || consentRes.body.error || '');

  // 6. Submit diary entry with known content
  console.log('6. Submit diary entry with content: "' + KNOWN_CONTENT + '"...');
  var diaryRes = await request('POST', '/api/bot/diary', {
    telegram_id: CLIENT_TG, content: KNOWN_CONTENT, type: 'text'
  }, { 'x-bot-api-key': BOT_KEY });
  var entryId = diaryRes.body.entry && diaryRes.body.entry.id;
  console.log('   Entry ID:', entryId);

  // 7. Read diary via authorized therapist API
  console.log('7. Read diary via GET /api/clients/' + clientUserId + '/diary...');
  var readRes = await request('GET', '/api/clients/' + clientUserId + '/diary', null, {
    'Authorization': 'Bearer ' + token
  });
  console.log('   Status:', readRes.status);

  if (readRes.status !== 200) {
    console.log('   FAIL: Could not read diary. Response:', JSON.stringify(readRes.body));
    process.exit(1);
  }

  var entries = readRes.body.entries || readRes.body;
  var found = false;

  if (Array.isArray(entries)) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (entry.content === KNOWN_CONTENT || entry.content_decrypted === KNOWN_CONTENT) {
        found = true;
        console.log('   Found matching entry!');
        console.log('   Returned content:', entry.content || entry.content_decrypted);
        break;
      }
    }
  }

  console.log('\n=== RESULTS ===');
  console.log('Test 1 - Diary entry created:', entryId ? 'PASS' : 'FAIL');
  console.log('Test 2 - Authorized read returns 200:', readRes.status === 200 ? 'PASS' : 'FAIL');
  console.log('Test 3 - Decrypted content matches original:', found ? 'PASS' : 'FAIL');
  console.log('Test 4 - Decryption transparent to API consumer:', found ? 'PASS' : 'FAIL');

  if (!found) {
    console.log('\nDEBUG: Returned entries:');
    console.log(JSON.stringify(entries, null, 2));
  }

  console.log('\n=== OVERALL:', (found && readRes.status === 200) ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED', '===');
}

test().catch(function(e) { console.error('Error:', e); process.exit(1); });
