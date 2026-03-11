const http = require('http');
const { execSync, spawn } = require('child_process');

function killBackend() {
  var result;
  try { result = execSync('netstat -ano | findstr :3001 | findstr LISTENING').toString().trim(); } catch(e) { console.log('No backend running'); return; }
  var pid = result.split(/\s+/).pop();
  try { execSync('taskkill /F /PID ' + pid); console.log('Killed PID', pid); } catch(e) {}
}

function startBackend() {
  return new Promise(function(resolve) {
    var child = spawn('node', ['src/backend/src/index.js'], {
      stdio: 'ignore',
      detached: true
    });
    child.unref();
    console.log('Started backend');
    setTimeout(resolve, 4000);
  });
}

function makeRequest(method, path, body, headers) {
  return new Promise(function(resolve) {
    var url = new URL('http://localhost:3001' + path);
    var options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: headers || {}
    };
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        var parsed = null;
        try { parsed = JSON.parse(data); } catch(e) {}
        resolve({ status: res.statusCode, body: parsed, raw: data, headers: res.headers });
      });
    });
    req.on('error', function(e) { resolve({ status: 0, error: e.message }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('=== CSRF Protection Test ===\n');

  killBackend();
  await startBackend();

  // Test 1: GET /api/csrf-token returns a token
  console.log('Test 1: GET /api/csrf-token returns a token');
  var tokenRes = await makeRequest('GET', '/api/csrf-token', null, {});
  console.log('  Status:', tokenRes.status);
  console.log('  Token:', tokenRes.body ? tokenRes.body.csrfToken.substring(0, 16) + '...' : 'none');
  var csrfToken = tokenRes.body ? tokenRes.body.csrfToken : '';
  console.log('  PASS:', tokenRes.status === 200 && csrfToken.length > 0);

  // Test 2: POST /api/auth/login WITHOUT CSRF token - should be rejected
  console.log('\nTest 2: POST /api/auth/login WITHOUT CSRF token');
  var noTokenRes = await makeRequest('POST', '/api/auth/login',
    { email: 'test@test.com', password: 'test123' },
    { 'Content-Type': 'application/json' }
  );
  console.log('  Status:', noTokenRes.status);
  console.log('  Error:', noTokenRes.body ? noTokenRes.body.error : 'none');
  console.log('  PASS:', noTokenRes.status === 403 && noTokenRes.body && noTokenRes.body.error.includes('CSRF'));

  // Test 3: POST /api/auth/login WITH valid CSRF token - should work (auth may fail but not 403 CSRF)
  console.log('\nTest 3: POST /api/auth/login WITH valid CSRF token');
  var withTokenRes = await makeRequest('POST', '/api/auth/login',
    { email: 'admin@psylink.app', password: 'Admin123!' },
    { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
  );
  console.log('  Status:', withTokenRes.status);
  console.log('  Response:', withTokenRes.body ? withTokenRes.body.error || 'Login success' : 'error');
  console.log('  PASS:', withTokenRes.status !== 403);

  // Test 4: POST with invalid CSRF token
  console.log('\nTest 4: POST /api/auth/login WITH invalid CSRF token');
  var badTokenRes = await makeRequest('POST', '/api/auth/login',
    { email: 'test@test.com', password: 'test123' },
    { 'Content-Type': 'application/json', 'X-CSRF-Token': 'invalid-token-xyz' }
  );
  console.log('  Status:', badTokenRes.status);
  console.log('  Error:', badTokenRes.body ? badTokenRes.body.error : 'none');
  console.log('  PASS:', badTokenRes.status === 403 && badTokenRes.body && badTokenRes.body.error.includes('CSRF'));

  // Test 5: POST with Authorization header (JWT) - should bypass CSRF
  console.log('\nTest 5: POST with Authorization header bypasses CSRF');
  var jwtRes = await makeRequest('POST', '/api/auth/login',
    { email: 'admin@psylink.app', password: 'Admin123!' },
    { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
  );
  var token = jwtRes.body ? jwtRes.body.token : '';
  if (token) {
    // Now make an authenticated POST without CSRF token - should work
    var authedRes = await makeRequest('POST', '/api/clients/999/notes',
      { content: 'test' },
      { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    );
    console.log('  Status:', authedRes.status);
    console.log('  Not 403 CSRF:', authedRes.status !== 403 || (authedRes.body && !authedRes.body.error.includes('CSRF')));
    console.log('  PASS:', authedRes.status !== 403);
  } else {
    console.log('  Could not get JWT token for test');
  }

  var allPass = tokenRes.status === 200
    && noTokenRes.status === 403
    && withTokenRes.status !== 403
    && badTokenRes.status === 403;

  console.log('\n=== ALL TESTS ' + (allPass ? 'PASSED' : 'FAILED') + ' ===');
}

runTest();
