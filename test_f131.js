// Test feature #131: API returns 404 for non-existent client
var http = require('http');

function makeRequest(options, body) {
  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  // Step 1: Get CSRF token
  var csrfRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/csrf-token',
    method: 'GET', headers: {}
  });
  console.log('CSRF response:', csrfRes.status, csrfRes.body.substring(0, 100));
  var csrfToken = '';
  try { csrfToken = JSON.parse(csrfRes.body).csrfToken; } catch(e) {}
  console.log('CSRF token:', csrfToken ? csrfToken.substring(0, 20) + '...' : 'FAILED');

  // Step 2: Register a fresh user
  var email = 'test_f131_' + Date.now() + '@example.com';
  var regBody = JSON.stringify({ email: email, password: 'StrongPwd1', role: 'therapist' });
  var regRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/register',
    method: 'POST', headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(regBody),
      'X-CSRF-Token': csrfToken
    }
  }, regBody);
  console.log('Register response:', regRes.status, regRes.body.substring(0, 200));

  var token = '';
  try { token = JSON.parse(regRes.body).token; } catch(e) {}

  if (!token) {
    console.log('Registration failed, exiting.');
    process.exit(1);
  }
  console.log('Got token:', token.substring(0, 20) + '...');

  // Test 1: GET /api/clients/99999 (non-existent)
  var res1 = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/99999',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\nTest 1 - GET /api/clients/99999:', 'Status:', res1.status, 'Body:', res1.body);

  // Test 2: GET /api/clients/0
  var res2 = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/0',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Test 2 - GET /api/clients/0:', 'Status:', res2.status, 'Body:', res2.body);

  // Test 3: GET /api/clients/abc (non-numeric)
  var res3 = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/abc',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Test 3 - GET /api/clients/abc:', 'Status:', res3.status, 'Body:', res3.body);

  // Test 4: No auth - should get 401
  var res4 = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/99999',
    method: 'GET', headers: {}
  });
  console.log('Test 4 - No auth:', 'Status:', res4.status);

  // Summary
  console.log('\n=== SUMMARY ===');
  var body1 = '';
  try { body1 = JSON.parse(res1.body); } catch(e) {}
  console.log('Non-existent (99999): Status=' + res1.status + ' HasError=' + (body1.error ? 'yes' : 'no') + ' Msg="' + (body1.error || '') + '"');
  console.log('  Expected: 404 with helpful message -', res1.status === 404 ? 'PASS' : 'FAIL');

  var body2 = '';
  try { body2 = JSON.parse(res2.body); } catch(e) {}
  console.log('Non-existent (0): Status=' + res2.status + ' -', res2.status === 404 ? 'PASS' : 'FAIL');

  var body3 = '';
  try { body3 = JSON.parse(res3.body); } catch(e) {}
  console.log('Non-numeric (abc): Status=' + res3.status + ' -', (res3.status === 400 || res3.status === 404) ? 'PASS' : 'FAIL');

  console.log('No auth: Status=' + res4.status + ' -', res4.status === 401 ? 'PASS' : 'FAIL');
  console.log('No server crash: PASS (all responses received)');
}

run().catch(function(e) { console.error(e); });
