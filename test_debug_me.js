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
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function check() {
  var loginRes = await request('POST', '/api/auth/login', {
    email: 'import_ui_test@test.com', password: 'TestPass123!'
  });
  console.log('Login:', loginRes.body);
  var parsed = JSON.parse(loginRes.body);
  var token = parsed.token;

  var meRes = await request('GET', '/api/auth/me', null, { 'Authorization': 'Bearer ' + token });
  console.log('Me:', meRes.body);
}

check().catch(function(e) { console.error(e); });
