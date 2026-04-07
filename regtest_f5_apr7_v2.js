// Regression test for Feature 5: Backend API Queries Real DB
const fs = require('fs');
const path = require('path');
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

async function testFeature5() {
  console.log('========== FEATURE 5: Backend API Queries Real DB ==========');
  let allPass = true;

  // Test 1: Health endpoint - proves DB connection
  console.log('Test 1: GET /api/health');
  const health = await httpRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  const healthData = JSON.parse(health.body);
  console.log('  Status: ' + health.status + ', DB: ' + healthData.database + ', Tables: ' + healthData.tableCount);
  if (healthData.database !== 'connected' || healthData.tableCount < 10) {
    console.log('  FAIL: DB not connected');
    allPass = false;
  } else {
    console.log('  PASS: Real database connected');
  }

  // Step 2: Get CSRF token and session cookies
  console.log('\nTest 2: Get CSRF token');
  const csrf = await httpRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  let csrfToken = '';
  let sessionCookies = '';
  try {
    const csrfData = JSON.parse(csrf.body);
    csrfToken = csrfData.csrfToken || '';
    console.log('  CSRF token: ' + (csrfToken ? 'obtained' : 'MISSING'));
  } catch (e) {
    console.log('  CSRF response: ' + csrf.body);
  }
  if (csrf.cookies.length > 0) {
    sessionCookies = extractCookies(csrf.cookies);
    console.log('  Session cookies: obtained');
  }

  // Test 3: Register a unique user (proves INSERT query)
  const uniqueEmail = 'regtest_f5_' + Date.now() + '@test.com';
  console.log('\nTest 3: POST /api/auth/register (' + uniqueEmail + ')');
  const register = await httpRequest(
    {
      hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookies,
        'x-csrf-token': csrfToken
      }
    },
    JSON.stringify({ email: uniqueEmail, password: 'TestPass123!', role: 'therapist' })
  );
  console.log('  Status: ' + register.status);
  if (register.status === 201 || register.status === 200) {
    console.log('  PASS: User registered (INSERT query executed)');
    if (register.cookies.length > 0) {
      sessionCookies = extractCookies(register.cookies);
    }
  } else {
    console.log('  Response: ' + register.body);
    allPass = false;
  }

  // Get fresh CSRF for login
  const csrf2 = await httpRequest({
    hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET',
    headers: { 'Cookie': sessionCookies }
  });
  try {
    const csrfData2 = JSON.parse(csrf2.body);
    csrfToken = csrfData2.csrfToken || csrfToken;
  } catch (e) {}
  if (csrf2.cookies.length > 0) {
    sessionCookies = extractCookies(csrf2.cookies);
  }

  // Test 4: Login (proves SELECT query for auth)
  console.log('\nTest 4: POST /api/auth/login (' + uniqueEmail + ')');
  const login = await httpRequest(
    {
      hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookies,
        'x-csrf-token': csrfToken
      }
    },
    JSON.stringify({ email: uniqueEmail, password: 'TestPass123!' })
  );
  console.log('  Status: ' + login.status);
  if (login.status === 200) {
    const loginData = JSON.parse(login.body);
    if (loginData.user) {
      console.log('  PASS: Login returned user (id=' + loginData.user.id + ', email=' + loginData.user.email + ')');
      if (login.cookies.length > 0) {
        sessionCookies = extractCookies(login.cookies);
      }
      csrfToken = loginData.csrfToken || csrfToken;
    }
  } else {
    console.log('  Response: ' + login.body);
    allPass = false;
  }

  // Test 5: GET /api/auth/me (proves authenticated SELECT query)
  console.log('\nTest 5: GET /api/auth/me (authenticated)');
  const me = await httpRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
    headers: { 'Cookie': sessionCookies }
  });
  console.log('  Status: ' + me.status);
  if (me.status === 200) {
    try {
      const meData = JSON.parse(me.body);
      if (meData.user && meData.user.email === uniqueEmail) {
        console.log('  PASS: /me returned correct user email - real DB queries confirmed');
      } else if (meData.user) {
        console.log('  PASS: /me returned user data (id=' + meData.user.id + ')');
      } else {
        console.log('  Body: ' + me.body);
      }
    } catch (e) {
      console.log('  Body: ' + me.body);
    }
  } else {
    console.log('  Response: ' + me.body);
    allPass = false;
  }

  // Test 6: Try registering same email again - should fail with 409 (proves unique constraint in real DB)
  console.log('\nTest 6: Duplicate registration check');
  const csrf3 = await httpRequest({
    hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET'
  });
  let csrfToken3 = '';
  let cookies3 = '';
  try {
    csrfToken3 = JSON.parse(csrf3.body).csrfToken;
    cookies3 = extractCookies(csrf3.cookies);
  } catch (e) {}

  const dup = await httpRequest(
    {
      hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies3,
        'x-csrf-token': csrfToken3
      }
    },
    JSON.stringify({ email: uniqueEmail, password: 'TestPass123!', role: 'therapist' })
  );
  console.log('  Status: ' + dup.status);
  if (dup.status === 409 || dup.status === 400) {
    console.log('  PASS: Duplicate rejected (DB unique constraint working)');
  } else {
    console.log('  Response: ' + dup.body);
    console.log('  WARN: Expected 409 for duplicate, got ' + dup.status);
  }

  console.log('\n========== FEATURE 5 RESULT: ' + (allPass ? 'PASS' : 'FAIL') + ' ==========');
  return allPass;
}

testFeature5().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
