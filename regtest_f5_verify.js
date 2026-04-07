// Feature 5: Verify API queries real database (not mock/static data)
var http = require('http');

var BASE = 'http://localhost:3001';
var TEST_EMAIL = 'regtest_f5_' + Date.now() + '@test.com';
var TEST_PASS = 'TestPass123!';

function request(method, urlPath, body, headers) {
  return new Promise(function(resolve, reject) {
    var url = new URL(urlPath, BASE);
    var options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: headers || {}
    };
    if (body) {
      var bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== FEATURE 5: Backend API Queries Real Database ===');
  var allPass = true;

  // Test 1: Health endpoint reports real database connection
  console.log('\n1. GET /api/health...');
  var healthResp = await request('GET', '/api/health');
  console.log('Status:', healthResp.status);
  console.log('DB status:', healthResp.body.database);
  console.log('Table count:', healthResp.body.tableCount);
  if (healthResp.body.database !== 'connected' || healthResp.body.tableCount < 10) {
    console.log('FAIL: Health check does not show real DB connection');
    allPass = false;
  } else {
    console.log('PASS: Health shows real database with', healthResp.body.tableCount, 'tables');
  }

  // Test 2: Register a unique user and verify it's stored
  console.log('\n2. POST /api/auth/register (unique user)...');
  var csrfResp = await request('GET', '/api/csrf-token');
  var csrfToken = csrfResp.body.csrfToken;

  var regResp = await request('POST', '/api/auth/register',
    { email: TEST_EMAIL, password: TEST_PASS, role: 'therapist' },
    { 'X-CSRF-Token': csrfToken }
  );
  console.log('Register status:', regResp.status);

  if (regResp.status !== 201) {
    console.log('FAIL: Registration failed');
    allPass = false;
  } else {
    console.log('PASS: Registration created user id:', regResp.body.user.id);

    // Test 3: Login with the registered user (proves SELECT query works)
    console.log('\n3. POST /api/auth/login (login with new user)...');
    var csrfResp2 = await request('GET', '/api/csrf-token');
    var loginResp = await request('POST', '/api/auth/login',
      { email: TEST_EMAIL, password: TEST_PASS },
      { 'X-CSRF-Token': csrfResp2.body.csrfToken }
    );
    console.log('Login status:', loginResp.status);

    if (loginResp.status !== 200) {
      console.log('FAIL: Login with just-registered user failed - data not in DB');
      allPass = false;
    } else {
      console.log('PASS: Login succeeded, user data retrieved from DB');
      var token = loginResp.body.token;

      // Test 4: GET /api/auth/me returns the correct user
      console.log('\n4. GET /api/auth/me (authenticated)...');
      var meResp = await request('GET', '/api/auth/me', null, { 'Authorization': 'Bearer ' + token });
      console.log('Me status:', meResp.status);

      if (meResp.status !== 200 || meResp.body.user.email !== TEST_EMAIL) {
        console.log('FAIL: /me did not return correct user');
        allPass = false;
      } else {
        console.log('PASS: /me returned correct user:', meResp.body.user.email);
      }

      // Test 5: Try to register same email again (proves uniqueness constraint from real DB)
      console.log('\n5. POST /api/auth/register (duplicate email)...');
      var csrfResp3 = await request('GET', '/api/csrf-token');
      var dupResp = await request('POST', '/api/auth/register',
        { email: TEST_EMAIL, password: TEST_PASS, role: 'therapist' },
        { 'X-CSRF-Token': csrfResp3.body.csrfToken }
      );
      console.log('Duplicate register status:', dupResp.status);

      if (dupResp.status === 201 || dupResp.status === 200) {
        console.log('FAIL: Duplicate registration succeeded - DB constraints not working');
        allPass = false;
      } else {
        console.log('PASS: Duplicate registration rejected (real DB uniqueness constraint)');
      }
    }
  }

  console.log('\n=== FEATURE 5 RESULT:', allPass ? 'PASS' : 'FAIL', '===');
}

main().catch(function(err) { console.error('Error:', err); process.exit(1); });
