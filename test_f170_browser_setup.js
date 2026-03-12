const http = require('http');
const BOT_KEY = 'dev-bot-api-key';
const TS = Date.now();

function req(method, urlPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    var headers = Object.assign({}, extraHeaders || {});
    var data;
    if (body) {
      data = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    var r = http.request({ hostname: '127.0.0.1', port: 3001, path: urlPath, method: method, headers: headers }, function(res) {
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

function uploadSession(token, clientId) {
  return new Promise((resolve, reject) => {
    var boundary = '----FormBoundary' + TS;
    var audioContent = Buffer.alloc(1024, 0);
    var bodyParts = [];
    bodyParts.push('--' + boundary + '\r\n');
    bodyParts.push('Content-Disposition: form-data; name="client_id"\r\n\r\n');
    bodyParts.push(clientId + '\r\n');
    bodyParts.push('--' + boundary + '\r\n');
    bodyParts.push('Content-Disposition: form-data; name="audio"; filename="test.mp3"\r\n');
    bodyParts.push('Content-Type: audio/mpeg\r\n\r\n');
    var headerBuf = Buffer.from(bodyParts.join(''));
    var footerBuf = Buffer.from('\r\n--' + boundary + '--\r\n');
    var fullBody = Buffer.concat([headerBuf, audioContent, footerBuf]);

    var r = http.request({
      hostname: '127.0.0.1', port: 3001, path: '/api/sessions', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': fullBody.length
      }
    }, function(res) {
      var b = '';
      res.on('data', function(c) { b += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    r.write(fullBody);
    r.end();
  });
}

async function run() {
  var csrf = await req('GET', '/api/csrf-token');
  var csrfToken = csrf.body.csrfToken;

  var login = await req('POST', '/api/auth/login',
    { email: 'browser170@test.com', password: 'TestPass1' },
    { 'X-CSRF-Token': csrfToken });
  var token = login.body.token;
  var me = await req('GET', '/api/auth/me', null, { 'Authorization': 'Bearer ' + token });
  var therapistId = me.body.user.id;
  console.log('Therapist ID:', therapistId);

  var invite = await req('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  var code = invite.body.invite_code;

  var tgId = 'br170_' + TS;
  var clientReg = await req('POST', '/api/bot/register',
    { telegram_id: tgId, first_name: 'BrClient170', role: 'client' },
    { 'x-bot-api-key': BOT_KEY });
  var clientId = clientReg.body.user.id;
  console.log('Client ID:', clientId);

  await req('POST', '/api/bot/connect', { telegram_id: tgId, invite_code: code }, { 'x-bot-api-key': BOT_KEY });
  await req('POST', '/api/bot/consent', { telegram_id: tgId, therapist_id: therapistId, consent: true }, { 'x-bot-api-key': BOT_KEY });

  // Create data
  await req('POST', '/api/bot/diary', { telegram_id: tgId, content: 'BROWSER170_DIARY', entry_type: 'text' }, { 'x-bot-api-key': BOT_KEY });
  await req('POST', '/api/clients/' + clientId + '/notes', { content: 'BROWSER170_NOTE' }, { 'Authorization': 'Bearer ' + token, 'X-CSRF-Token': csrfToken });
  var sess = await uploadSession(token, clientId);
  console.log('Session created:', sess.status, 'ID:', sess.body.session ? sess.body.session.id : 'N/A');

  // Print stats
  var stats = await req('GET', '/api/dashboard/stats', null, { 'Authorization': 'Bearer ' + token });
  console.log('Stats:', JSON.stringify(stats.body));
  console.log('SESSION_ID=' + (sess.body.session ? sess.body.session.id : ''));
  console.log('CLIENT_ID=' + clientId);
}

run().catch(function(e) { console.error(e); process.exit(1); });
