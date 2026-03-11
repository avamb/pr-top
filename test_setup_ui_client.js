// Setup: create linked client with diary entry for UI verification of feature #49
var http = require('http');

var BOT_KEY = 'dev-bot-api-key';
var TGID = 'ui_client_decrypt_' + Date.now();

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

async function setup() {
  // Login as the UI therapist we just registered
  var loginRes = await request('POST', '/api/auth/login', {
    email: 'ui_decrypt_test@test.com', password: 'TestPass123!'
  });
  var token = loginRes.body.token;
  var meRes = await request('GET', '/api/auth/me', null, { 'Authorization': 'Bearer ' + token });
  var therapistId = meRes.body.id;
  console.log('Therapist ID:', therapistId);

  // Get invite code
  var inviteRes = await request('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  var inviteCode = inviteRes.body.invite_code;
  console.log('Invite code:', inviteCode);

  // Register client
  var clientRes = await request('POST', '/api/bot/register', {
    telegram_id: TGID, role: 'client', display_name: 'UIDecryptClient'
  }, { 'x-bot-api-key': BOT_KEY });
  var clientId = clientRes.body.user.id;
  console.log('Client ID:', clientId);

  // Connect
  await request('POST', '/api/bot/connect', {
    telegram_id: TGID, invite_code: inviteCode
  }, { 'x-bot-api-key': BOT_KEY });

  // Consent
  var consentRes = await request('POST', '/api/bot/consent', {
    telegram_id: TGID, therapist_id: therapistId, consent: true
  }, { 'x-bot-api-key': BOT_KEY });
  console.log('Consent:', consentRes.body.message);

  // Create diary entry with known content
  var diaryRes = await request('POST', '/api/bot/diary', {
    telegram_id: TGID, content: 'DECRYPT_BROWSER_VERIFY_49', type: 'text'
  }, { 'x-bot-api-key': BOT_KEY });
  console.log('Diary entry ID:', diaryRes.body.entry.id);

  // Verify via API that decryption works
  var readRes = await request('GET', '/api/clients/' + clientId + '/diary', null, {
    'Authorization': 'Bearer ' + token
  });
  var entries = readRes.body.entries;
  var found = entries && entries.some(function(e) { return e.content === 'DECRYPT_BROWSER_VERIFY_49'; });
  console.log('API decryption verified:', found);
  console.log('Navigate to: /clients/' + clientId);
}

setup().catch(function(e) { console.error(e); });
