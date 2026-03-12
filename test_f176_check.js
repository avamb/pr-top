var http = require('http');

function request(method, path, body, token, extraHeaders) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : '';
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) headers['Content-Length'] = Buffer.byteLength(data);
    if (extraHeaders) Object.assign(headers, extraHeaders);
    var opts = { hostname: '127.0.0.1', port: 3001, path: path, method: method, headers: headers };
    var req = http.request(opts, function(r) {
      var b = '';
      r.on('data', function(c) { b += c; });
      r.on('end', function() {
        try { resolve({ status: r.statusCode, data: JSON.parse(b) }); }
        catch(e) { resolve({ status: r.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

async function main() {
  var botH = { 'x-bot-api-key': 'dev-bot-api-key' };

  // Get CSRF and login
  var csrf = await request('GET', '/api/csrf-token');
  var csrfH = { 'x-csrf-token': csrf.data.csrfToken };
  var login = await request('POST', '/api/auth/login', {
    email: 'filter176@test.com', password: 'Test1234!'
  }, null, csrfH);
  var token = login.data.token;

  // Get therapist user info
  var me = await request('GET', '/api/auth/me', null, token);
  console.log('Me:', JSON.stringify(me.data).substring(0, 200));
  var therapistId = me.data.user ? me.data.user.id : me.data.id;
  console.log('Therapist ID:', therapistId);

  // Grant consent with therapist_id
  var consent = await request('POST', '/api/bot/consent', {
    telegram_id: 'filter176client', therapist_id: therapistId, consent: true
  }, null, botH);
  console.log('Consent:', consent.status, JSON.stringify(consent.data));

  // Check clients
  var clients = await request('GET', '/api/clients', null, token);
  console.log('Clients:', clients.data.total, 'first:', clients.data.clients && clients.data.clients[0] ? clients.data.clients[0].id : 'none');
}

main().catch(console.error);
