// Debug: check invite code response format and bot route paths
const http = require('http');

function req(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: Object.assign({'Content-Type': 'application/json'}, data ? {'Content-Length': Buffer.byteLength(data)} : {}, headers)
    };
    var r = http.request(opts, function(res) {
      var raw = '';
      res.on('data', function(c) { raw += c; });
      res.on('end', function() {
        try { resolve({status: res.statusCode, body: JSON.parse(raw)}); }
        catch(e) { resolve({status: res.statusCode, body: raw}); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // Step 1: Get CSRF
  var csrfRes = await req('GET', '/api/csrf-token');
  var csrfToken = csrfRes.body.csrfToken;
  console.log('CSRF:', csrfToken ? 'ok' : 'MISSING');

  // Step 2: Register therapist
  var email = 'debug_invite_' + Date.now() + '@example.com';
  var regRes = await req('POST', '/api/auth/register', {
    email: email, password: 'TestPass123!', name: 'Debug User', role: 'therapist'
  }, {'X-CSRF-Token': csrfToken});
  console.log('Register status:', regRes.status);
  console.log('Register body keys:', Object.keys(regRes.body || {}));
  var token = regRes.body.token;
  var therapistId = regRes.body.user && regRes.body.user.id;
  console.log('Token present:', !!token, 'therapistId:', therapistId);

  // Step 3: Get invite code
  var invRes = await req('GET', '/api/invite-code', null, {'Authorization': 'Bearer ' + token});
  console.log('Invite status:', invRes.status);
  console.log('Invite body:', JSON.stringify(invRes.body));

  // Step 4: Test bot register
  var botHeaders = {'X-Bot-API-Key': 'dev-bot-api-key'};
  var tgId = 'debug_' + Date.now();
  var botReg = await req('POST', '/api/bot/register', {
    telegram_id: tgId, name: 'Debug Client', language: 'en'
  }, botHeaders);
  console.log('Bot register status:', botReg.status, JSON.stringify(botReg.body).substring(0, 100));

  // Step 5: Test bot connect with invite code
  var inviteCode = invRes.body.code || invRes.body.invite_code || invRes.body.inviteCode;
  console.log('Invite code value:', inviteCode);
  if (inviteCode) {
    var connectRes = await req('POST', '/api/bot/connect', {
      telegram_id: tgId, invite_code: inviteCode
    }, botHeaders);
    console.log('Bot connect status:', connectRes.status, JSON.stringify(connectRes.body).substring(0, 150));
  }

  // Step 6: Check clients endpoint
  var clientsRes = await req('GET', '/api/clients', null, {'Authorization': 'Bearer ' + token});
  console.log('Clients status:', clientsRes.status);
  console.log('Clients count:', clientsRes.body.clients && clientsRes.body.clients.length);

  // Step 7: Test SOS without linking (should fail - check error)
  var sosRes = await req('POST', '/api/bot/sos', {
    telegram_id: tgId, message: 'debug sos'
  }, botHeaders);
  console.log('SOS status:', sosRes.status, JSON.stringify(sosRes.body).substring(0, 100));

  // Step 8: Check diary route
  var diaryRes = await req('POST', '/api/bot/diary', {
    telegram_id: tgId, entry_type: 'text', content: 'debug diary'
  }, botHeaders);
  console.log('Diary status:', diaryRes.status, JSON.stringify(diaryRes.body).substring(0, 100));

  // Step 9: Check WS stats
  var health = await req('GET', '/api/health');
  console.log('WS stats:', JSON.stringify(health.body.websocket));
}

main().catch(function(e) { console.error('Error:', e.message); });
