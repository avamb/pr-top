var http = require('http');

function request(method, path, token, data) {
  return new Promise(function(resolve, reject) {
    var body = data ? JSON.stringify(data) : '';
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    var req = http.request({
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: headers
    }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  var login = await request('POST', '/api/auth/login', null, { email: 'browser_test@psylink.app', password: 'TestPass123!' });
  console.log('Login:', login.status);
  var token = login.data.token;
  var me = await request('GET', '/api/auth/me', token);
  var therapistId = me.data.user.id;
  console.log('Therapist ID:', therapistId);
  var seed = await request('POST', '/api/dev/seed-clients', null, { therapist_id: therapistId, count: 2 });
  console.log('Seeded:', seed.data);
  var clients = await request('GET', '/api/clients', token);
  console.log('Clients:', clients.data.total);
  if (clients.data.clients) {
    clients.data.clients.forEach(function(c) { console.log('  Client:', c.id, c.email); });
  }
}

main().catch(console.error);
