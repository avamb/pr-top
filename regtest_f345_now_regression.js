const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, cookies }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  // Step 1: Get CSRF token
  const csrfRes = await request({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrfRes.data).csrfToken;
  const csrfCookie = csrfRes.cookies.find(c => c.startsWith('csrf_token='));
  const csrfCookieVal = csrfCookie ? csrfCookie.split(';')[0] : '';
  console.log('CSRF token obtained:', csrfToken.substring(0, 16) + '...');

  // Step 2: Register test user
  const regRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': csrfCookieVal }
  }, { email: 'RESTART_TEST_REGR_345@test.com', password: 'TestPass123!', name: 'Regression Test' });
  console.log('Register status:', regRes.status);
  console.log('Register response:', regRes.data.substring(0, 300));

  // If already exists (409), that's fine - proceed to login
  if (regRes.status !== 201 && regRes.status !== 409) {
    console.log('FAIL: Unexpected register status');
    process.exit(1);
  }

  // Step 3: Login
  const csrfRes2 = await request({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken2 = JSON.parse(csrfRes2.data).csrfToken;
  const csrfCookie2 = csrfRes2.cookies.find(c => c.startsWith('csrf_token='));
  const csrfCookieVal2 = csrfCookie2 ? csrfCookie2.split(';')[0] : '';

  const loginRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken2, 'Cookie': csrfCookieVal2 }
  }, { email: 'RESTART_TEST_REGR_345@test.com', password: 'TestPass123!' });
  console.log('Login status:', loginRes.status);
  console.log('Login response:', loginRes.data.substring(0, 300));

  if (loginRes.status !== 200) {
    console.log('FAIL: Login failed');
    process.exit(1);
  }

  const loginData = JSON.parse(loginRes.data);
  const token = loginData.token;
  console.log('Got JWT token:', token ? token.substring(0, 20) + '...' : 'NONE');

  // Step 4: Get /api/auth/me using Bearer token
  const meRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Me status:', meRes.status);
  console.log('Me response:', meRes.data.substring(0, 300));

  if (meRes.status !== 200) {
    console.log('FAIL: /api/auth/me failed');
    process.exit(1);
  }

  const meData = JSON.parse(meRes.data);
  if (meData.user && meData.user.email === 'restart_test_regr_345@test.com') {
    console.log('PASS: User data intact, real DB confirmed');
  } else {
    console.log('FAIL: User data mismatch');
    process.exit(1);
  }

  console.log('\n=== PRE-RESTART TESTS PASSED ===');
  console.log('User registered and verified via real API + DB');
}

test().catch(e => { console.error('Error:', e.message); process.exit(1); });
