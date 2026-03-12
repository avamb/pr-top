// Delete diary entry 583 via API (simulating another session)
const http = require('http');
var csrfRes;

function request(method, path, body, token, extraHeaders) {
  return new Promise(function(resolve, reject) {
    var url = new URL(path, 'http://localhost:3001');
    var options = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: method, headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) Object.keys(extraHeaders).forEach(function(k) { options.headers[k] = extraHeaders[k]; });
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
  var csrfRes = await request('GET', '/api/csrf-token');
  var loginRes = await request('POST', '/api/auth/login', {
    email: 'f198_test_1773322933358@test.com',
    password: 'StrongPwd1'
  }, null, { 'X-CSRF-Token': csrfRes.body.csrfToken });
  var token = loginRes.body.token;

  var delRes = await request('DELETE', '/api/clients/701/diary/583', null, token);
  console.log('Delete result:', delRes.status, JSON.stringify(delRes.body));
}

main().catch(function(e) { console.error(e); process.exit(1); });
