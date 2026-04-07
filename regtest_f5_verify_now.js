const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      var data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== Feature 5: Backend API queries real database ===\n');

  // Step 1: GET /api/health
  console.log('Step 1: GET /api/health');
  var res = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  console.log('  Status:', res.status);
  var healthData = JSON.parse(res.body);
  console.log('  Database:', healthData.database);
  console.log('  Table count:', healthData.tableCount);
  if (healthData.database !== 'connected' || healthData.tableCount < 1) {
    console.log('  FAIL: Database not connected or no tables');
    process.exit(1);
  }
  console.log('  PASS: Database connected with', healthData.tableCount, 'tables\n');

  // Step 2: Get CSRF token
  console.log('Step 2: Get CSRF token');
  res = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  var csrfData = JSON.parse(res.body);
  var csrfToken = csrfData.csrfToken;
  console.log('  CSRF token obtained:', csrfToken ? 'yes' : 'no');
  var cookies = res.headers['set-cookie'] || [];
  var cookieStr = cookies.map(function(c) { return c.split(';')[0]; }).join('; ');
  console.log('  Cookies:', cookieStr ? 'yes' : 'none\n');

  // Step 3: POST /api/auth/register with test data
  var uniqueEmail = 'regtest_f5_' + Date.now() + '@test.com';
  console.log('Step 3: POST /api/auth/register');
  console.log('  Email:', uniqueEmail);
  var registerData = JSON.stringify({
    email: uniqueEmail,
    password: 'TestPass123!',
    name: 'Regression Test F5',
    language: 'en'
  });
  res = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': cookieStr
    }
  }, registerData);
  console.log('  Status:', res.status);
  console.log('  Body:', res.body.substring(0, 200));
  if (res.status !== 201 && res.status !== 200) {
    console.log('  WARN: Register returned', res.status, '(may already exist)\n');
  } else {
    console.log('  PASS: Registration successful\n');
  }

  // Step 4: POST /api/auth/login
  console.log('Step 4: POST /api/auth/login');
  var loginData = JSON.stringify({ email: uniqueEmail, password: 'TestPass123!' });
  res = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': cookieStr
    }
  }, loginData);
  console.log('  Status:', res.status);
  var loginBody = JSON.parse(res.body);
  var token = loginBody.token;
  console.log('  Token received:', token ? 'yes' : 'no');
  cookies = res.headers['set-cookie'] || [];
  var authCookies = cookies.map(function(c) { return c.split(';')[0]; }).join('; ');
  if (authCookies) cookieStr = authCookies;
  console.log('');

  // Step 5: GET /api/auth/me (authenticated)
  console.log('Step 5: GET /api/auth/me (authenticated)');
  res = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Cookie': cookieStr
    }
  });
  console.log('  Status:', res.status);
  if (res.status === 200) {
    var meData = JSON.parse(res.body);
    console.log('  User email:', meData.user ? meData.user.email : 'N/A');
    console.log('  User name:', meData.user ? meData.user.name : 'N/A');
    console.log('  PASS: Authenticated user data returned from database\n');
  } else {
    console.log('  Body:', res.body.substring(0, 200));
    console.log('  FAIL: Could not get authenticated user\n');
    process.exit(1);
  }

  console.log('=== Feature 5: ALL CHECKS PASSED ===');
}

main().catch(function(err) {
  console.error('Error:', err.message);
  process.exit(1);
});
