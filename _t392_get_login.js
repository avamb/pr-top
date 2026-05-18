var http = require('http');

function req(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var contentLen = data ? {'Content-Length': Buffer.byteLength(data)} : {};
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: Object.assign({'Content-Type': 'application/json'}, contentLen, headers)
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
  var csrfRes = await req('GET', '/api/csrf-token');
  var csrfToken = csrfRes.body.csrfToken;
  var email = 'browser_ws_test_' + Date.now() + '@example.com';
  var regRes = await req('POST', '/api/auth/register', {
    email: email, password: 'TestPass123!', name: 'Browser WS Test', role: 'therapist'
  }, {'X-CSRF-Token': csrfToken});
  console.log('email:', email);
  console.log('password: TestPass123!');
  console.log('status:', regRes.status);
}

main().catch(function(e) { console.error(e.message); });
