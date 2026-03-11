var http = require('http');

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

async function check() {
  // Login
  var loginRes = await request('POST', '/api/auth/login', {
    email: 'ui_decrypt_test@test.com', password: 'TestPass123!'
  });
  console.log('Login status:', loginRes.status);
  var token = loginRes.body.token;

  // Try import endpoint with no file
  var r = await request('POST', '/api/clients/1/import', null, {
    'Authorization': 'Bearer ' + token
  });
  console.log('Import endpoint response:', r.status, JSON.stringify(r.body));
}

check().catch(function(e) { console.error(e); });
