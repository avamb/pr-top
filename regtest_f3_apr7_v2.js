// Regression test for Feature 3: Data Persists Across Server Restart
// Phase 1: Register a test user and verify it exists
const http = require('http');

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, body: data, cookies, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function extractCookies(setCookieHeaders) {
  return setCookieHeaders.map(c => c.split(';')[0]).join('; ');
}

async function phase1() {
  console.log('========== FEATURE 3 - PHASE 1: Create Test User ==========');

  // Get CSRF token
  const csrf = await httpRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrf.body).csrfToken;
  const cookies = extractCookies(csrf.cookies);

  // Register test user
  const email = 'RESTART_TEST_F3_' + Date.now() + '@test.com';
  console.log('Registering: ' + email);

  const reg = await httpRequest(
    {
      hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookies, 'x-csrf-token': csrfToken }
    },
    JSON.stringify({ email: email, password: 'RestartTest123!', role: 'therapist' })
  );

  console.log('Register status: ' + reg.status);
  if (reg.status !== 201 && reg.status !== 200) {
    console.log('Register failed: ' + reg.body);
    process.exit(1);
  }
  console.log('PASS: User registered');

  // Login to verify
  const csrf2 = await httpRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken2 = JSON.parse(csrf2.body).csrfToken;
  const cookies2 = extractCookies(csrf2.cookies);

  const login = await httpRequest(
    {
      hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookies2, 'x-csrf-token': csrfToken2 }
    },
    JSON.stringify({ email: email, password: 'RestartTest123!' })
  );

  console.log('Login status: ' + login.status);
  if (login.status === 200) {
    const loginData = JSON.parse(login.body);
    console.log('PASS: User verified (id=' + loginData.user.id + ')');
  } else {
    console.log('Login failed: ' + login.body);
    process.exit(1);
  }

  // Save email for phase 2
  const fs = require('fs');
  fs.writeFileSync('C:/Projects/dev-psy-bot/regtest_f3_state_apr7v2.json', JSON.stringify({ email, password: 'RestartTest123!' }));
  console.log('State saved. Email: ' + email);
  console.log('\nPhase 1 complete. Now kill and restart the backend server.');
}

phase1().catch(e => { console.error(e); process.exit(1); });
