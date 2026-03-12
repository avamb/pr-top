const http = require('http');
const BOT_KEY = 'dev-bot-api-key';
const TS = Date.now();

function req(method, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    var headers = Object.assign({}, extraHeaders || {});
    var data;
    if (body) {
      data = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    var r = http.request({ hostname: '127.0.0.1', port: 3001, path: path, method: method, headers: headers }, function(res) {
      var b = '';
      res.on('data', function(c) { b += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  var csrf = await req('GET', '/api/csrf-token');
  var csrfToken = csrf.body.csrfToken;

  var login = await req('POST', '/api/auth/login',
    { email: 'browser168b@test.com', password: 'TestPass1' },
    { 'X-CSRF-Token': csrfToken });
  var token = login.body.token;
  console.log('Login:', login.status);

  var me = await req('GET', '/api/auth/me', null, { 'Authorization': 'Bearer ' + token });
  var therapistId = me.body.user.id;
  console.log('Therapist ID:', therapistId);

  var invite = await req('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  var code = invite.body.invite_code;
  console.log('Invite code:', code);

  var tgId = 'br168b_' + TS;
  var botReg = await req('POST', '/api/bot/register',
    { telegram_id: tgId, first_name: 'TestClient168b', role: 'client' },
    { 'x-bot-api-key': BOT_KEY });
  var clientId = botReg.body.user.id;
  console.log('Client ID:', clientId);

  await req('POST', '/api/bot/connect', { telegram_id: tgId, invite_code: code }, { 'x-bot-api-key': BOT_KEY });
  await req('POST', '/api/bot/consent', { telegram_id: tgId, therapist_id: therapistId, consent: true }, { 'x-bot-api-key': BOT_KEY });
  console.log('Connected and consented');

  await req('POST', '/api/bot/diary', { telegram_id: tgId, content: 'BROWSER_DIARY_168b', entry_type: 'text' }, { 'x-bot-api-key': BOT_KEY });
  console.log('Diary created');

  await req('POST', '/api/clients/' + clientId + '/notes', { content: 'BROWSER_NOTE_168b' }, { 'Authorization': 'Bearer ' + token, 'X-CSRF-Token': csrfToken });
  console.log('Note created');

  // Output for browser test
  console.log('TELEGRAM_ID=' + tgId);
  console.log('CLIENT_ID=' + clientId);
}

run().catch(function(e) { console.error(e); process.exit(1); });
