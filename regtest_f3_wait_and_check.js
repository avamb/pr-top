// Wait for server to be ready, then test persistence
var http = require('http');

function makeRequest(options, body) {
  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data, headers: res.headers }); });
    });
    req.on('error', function(e) { reject(e); });
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function waitForServer(maxAttempts) {
  for (var i = 0; i < maxAttempts; i++) {
    try {
      var res = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
      if (res.status === 200) {
        console.log('Server ready: ' + res.body);
        return true;
      }
    } catch(e) {
      console.log('Attempt ' + (i+1) + ': server not ready yet...');
    }
    await sleep(2000);
  }
  return false;
}

async function run() {
  console.log('=== Feature 3: Persistence Test (Post-Restart) ===');

  // Wait for server
  var ready = await waitForServer(15);
  if (!ready) {
    console.log('FAIL: Server did not start');
    process.exit(1);
  }

  // Step 1: Get CSRF token
  console.log('\n--- Getting CSRF token ---');
  var csrfRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  console.log('CSRF response: ' + csrfRes.body);
  var csrfToken = JSON.parse(csrfRes.body).csrfToken;

  // Extract session cookie
  var cookies = '';
  if (csrfRes.headers['set-cookie']) {
    cookies = csrfRes.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
  }
  console.log('Cookies: ' + cookies);

  // Step 2: Try to login with the pre-restart user
  console.log('\n--- Logging in with pre-restart user ---');
  var loginBody = JSON.stringify({ email: 'REGTEST_F345_APR7_RT_UNIQUE@test.com', password: 'TestPass123!' });
  var loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': cookies }
  }, loginBody);
  console.log('Login status: ' + loginRes.status);
  console.log('Login response: ' + loginRes.body);

  var loginData = JSON.parse(loginRes.body);
  if (loginRes.status === 200 && loginData.token) {
    console.log('\n=== PASS: User data persisted across server restart! ===');
    console.log('User ID: ' + loginData.user.id);
    console.log('Email: ' + loginData.user.email);

    // Step 3: Verify via /api/auth/me
    console.log('\n--- Verifying via GET /api/auth/me ---');
    var meRes = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
      headers: { 'Authorization': 'Bearer ' + loginData.token, 'Cookie': cookies }
    });
    console.log('Me status: ' + meRes.status);
    console.log('Me response: ' + meRes.body);

    if (meRes.status === 200) {
      console.log('\n=== FEATURE 3 PASSED: Data persists across restart ===');
    } else {
      console.log('\n=== FEATURE 3 FAILED: /api/auth/me failed after restart ===');
      process.exit(1);
    }
  } else {
    console.log('\n=== FEATURE 3 FAILED: Login failed after restart - data not persisted! ===');
    process.exit(1);
  }

  // Also test Feature 5: verify real DB queries
  console.log('\n\n=== Feature 5: Real Database Verification ===');
  console.log('Health endpoint reports real DB connection with tableCount');
  var healthRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  var healthData = JSON.parse(healthRes.body);
  console.log('Database status: ' + healthData.database);
  console.log('Table count: ' + healthData.tableCount);
  if (healthData.database === 'connected' && healthData.tableCount > 0) {
    console.log('=== FEATURE 5 PASSED: Real database confirmed ===');
  } else {
    console.log('=== FEATURE 5 FAILED: No real database ===');
    process.exit(1);
  }
}

run().catch(function(e) { console.error('Error:', e); process.exit(1); });
