// Setup for browser test of feature #197
// Creates therapist, client, and initial context
const http = require('http');
const BASE = 'http://localhost:3001';

function request(method, path, body, token, extraHeaders) {
  return new Promise(function(resolve, reject) {
    var url = new URL(path, BASE);
    var options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function(k) {
        options.headers[k] = extraHeaders[k];
      });
    }
    var req = http.request(options, function(res) {
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

async function main() {
  var botHeaders = { 'X-Bot-API-Key': 'dev-bot-api-key' };
  var csrfRes = await request('GET', '/api/csrf-token');
  var csrfToken = csrfRes.body.csrfToken;

  var email = 'f197_browser@test.com';
  var password = 'StrongPwd1';

  var regRes = await request('POST', '/api/auth/register', {
    email: email, password: password, role: 'therapist'
  }, null, { 'X-CSRF-Token': csrfToken });
  var token = regRes.body.token;
  console.log('Therapist registered:', regRes.status);

  var telegramId = 'f197_browser_client';
  await request('POST', '/api/bot/register', {
    telegram_id: telegramId, first_name: 'BrowserTestClient', role: 'client'
  }, null, botHeaders);

  var inviteRes = await request('GET', '/api/invite-code', null, token);
  var inviteCode = inviteRes.body.invite_code;

  var connectRes = await request('POST', '/api/bot/connect', {
    telegram_id: telegramId, invite_code: inviteCode
  }, null, botHeaders);
  var therapistId = connectRes.body.therapist.id;

  await request('POST', '/api/bot/consent', {
    telegram_id: telegramId, therapist_id: therapistId, consent: true
  }, null, botHeaders);

  // Create initial context
  var clientsRes = await request('GET', '/api/clients', null, token);
  var clientId = clientsRes.body.clients[0].id;

  var ctxRes = await request('PUT', '/api/clients/' + clientId + '/context', {
    anamnesis: 'INITIAL_ANAMNESIS_197',
    current_goals: 'INITIAL_GOALS_197'
  }, token);
  console.log('Context created:', ctxRes.status, 'updated_at:', ctxRes.body.context.updated_at);

  // Now simulate "tab 1" editing anamnesis
  var tab1Save = await request('PUT', '/api/clients/' + clientId + '/context', {
    anamnesis: 'TAB1_EDITED_ANAMNESIS',
    expected_updated_at: ctxRes.body.context.updated_at
  }, token);
  console.log('Tab 1 save:', tab1Save.status, 'new updated_at:', tab1Save.body.context.updated_at);

  console.log('\nSetup complete!');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('Client ID:', clientId);
  console.log('Stale updated_at (for conflict test):', ctxRes.body.context.updated_at);
  console.log('Current updated_at:', tab1Save.body.context.updated_at);
}

main().catch(function(e) { console.error(e); process.exit(1); });
