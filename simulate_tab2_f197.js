// Simulate another tab editing context behind the scenes
const http = require('http');
const BASE = 'http://localhost:3001';

function request(method, path, body, token) {
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
  // Login as same therapist
  var csrfRes = await request('GET', '/api/csrf-token');
  var loginRes = await request('POST', '/api/auth/login', {
    email: 'f197_browser@test.com',
    password: 'StrongPwd1'
  }, null);
  // Login with CSRF
  var csrfHeaders = { 'X-CSRF-Token': csrfRes.body.csrfToken };
  // Actually need to pass csrf for login
  var url2 = new URL('/api/auth/login', BASE);
  var loginRes2 = await new Promise(function(resolve, reject) {
    var options = {
      hostname: url2.hostname, port: url2.port, path: url2.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfRes.body.csrfToken }
    };
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ email: 'f197_browser@test.com', password: 'StrongPwd1' }));
    req.end();
  });

  var token = loginRes2.body.token;
  console.log('Login:', loginRes2.status);

  // Get current context to get the updated_at
  var ctxRes = await request('GET', '/api/clients/691/context', null, token);
  console.log('Current updated_at:', ctxRes.body.context.updated_at);

  // Save from "tab 2" with correct updated_at - this will change the updated_at in DB
  var saveRes = await request('PUT', '/api/clients/691/context', {
    contraindications: 'TAB2_ADDED_CONTRAINDICATIONS',
    expected_updated_at: ctxRes.body.context.updated_at
  }, token);
  console.log('Tab 2 save:', saveRes.status);
  console.log('New updated_at:', saveRes.body.context.updated_at);
  console.log('Now when the browser saves, it will have a stale updated_at and should get 409');
}

main().catch(function(e) { console.error(e); process.exit(1); });
