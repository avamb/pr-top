// Setup linked client for UI import testing
var http = require('http');
var BOT_KEY = 'dev-bot-api-key';
var TGID = 'import_ui_' + Date.now();

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
  // Login as UI therapist
  var loginRes = await request('POST', '/api/auth/login', {
    email: 'import_ui_test@test.com', password: 'TestPass123!'
  });
  if (loginRes.status !== 200) {
    console.log('Login failed:', JSON.stringify(loginRes.body));
    return;
  }
  var token = loginRes.body.token;
  var meRes = await request('GET', '/api/auth/me', null, { 'Authorization': 'Bearer ' + token });
  var therapistId = meRes.body.user ? meRes.body.user.id : meRes.body.id;
  console.log('Therapist ID:', therapistId);

  // Get invite code
  var inviteRes = await request('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  var inviteCode = inviteRes.body.invite_code;
  console.log('Invite code:', inviteCode);

  // Register client
  var clientRes = await request('POST', '/api/bot/register', {
    telegram_id: TGID, role: 'client', display_name: 'ImportUIClient'
  }, { 'x-bot-api-key': BOT_KEY });
  var clientId = clientRes.body.user.id;
  console.log('Client ID:', clientId);

  // Connect and consent
  await request('POST', '/api/bot/connect', {
    telegram_id: TGID, invite_code: inviteCode
  }, { 'x-bot-api-key': BOT_KEY });

  var consentRes = await request('POST', '/api/bot/consent', {
    telegram_id: TGID, therapist_id: therapistId, consent: true
  }, { 'x-bot-api-key': BOT_KEY });
  console.log('Consent:', consentRes.body.message);

  console.log('\nNavigate to: http://localhost:3000/clients/' + clientId);
}

setup().catch(function(e) { console.error(e); });
