var http = require('http');

function makeRequest(options, postData) {
  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(res) {
      var body = '';
      var cookies = res.headers['set-cookie'] || [];
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: body, cookies: cookies });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  // Step 1: Get CSRF token
  var csrfRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  console.log('CSRF response:', csrfRes.body);
  var csrfData = JSON.parse(csrfRes.body);
  var csrfToken = csrfData.csrfToken;
  var sessionCookie = '';
  csrfRes.cookies.forEach(function(c) {
    if (c.indexOf('session_id') >= 0) sessionCookie = c.split(';')[0];
  });
  console.log('CSRF token:', csrfToken);
  console.log('Session cookie:', sessionCookie);

  // Step 2: Login with the user created BEFORE restart
  var loginData = JSON.stringify({ email: 'REGTEST_F345_20260405@test.com', password: 'TestPass123!' });
  var loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': sessionCookie
    }
  }, loginData);
  console.log('\nLogin response status:', loginRes.status);
  console.log('Login response body:', loginRes.body);

  var loginBody = JSON.parse(loginRes.body);
  if (loginRes.status === 200 && loginBody.user && loginBody.user.email) {
    console.log('\n=== FEATURE 3 PASS: User data persisted across restart ===');
    console.log('User ID:', loginBody.user.id);
    console.log('User email:', loginBody.user.email);

    // Step 3: Verify with GET /api/auth/me
    var token = loginBody.token;
    var meRes = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('\n/api/auth/me status:', meRes.status);
    console.log('/api/auth/me body:', meRes.body);
  } else {
    console.log('\n=== FEATURE 3 FAIL: User data NOT found after restart ===');
    process.exit(1);
  }

  // Also test RESTART_TEST_12345@test.com (the original F3 test user)
  var login2Data = JSON.stringify({ email: 'RESTART_TEST_12345@test.com', password: 'TestPass123!' });
  var login2Res = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': sessionCookie
    }
  }, login2Data);
  console.log('\nOriginal F3 test user login status:', login2Res.status);
  console.log('Original F3 test user login body:', login2Res.body);
}

run().catch(function(e) { console.error('Error:', e.message); process.exit(1); });
