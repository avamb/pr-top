// Regression test for Feature 5: Backend API queries real database
const http = require('http');

function fetch(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }); }
        catch(e) { resolve({ status: res.statusCode, data: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const BASE = 'localhost';
  const PORT = 3001;

  // Step 1: GET /api/health - check DB connection
  console.log('=== Step 1: GET /api/health ===');
  const health = await fetch({ hostname: BASE, port: PORT, path: '/api/health', method: 'GET' });
  console.log('Status:', health.status);
  console.log('Response:', JSON.stringify(health.data, null, 2));
  console.log('DB connected:', health.data.database === 'connected' ? 'YES' : 'NO');
  console.log('Table count:', health.data.tableCount);

  // Step 2: Get CSRF token
  console.log('\n=== Step 2: Get CSRF Token ===');
  const csrf = await fetch({ hostname: BASE, port: PORT, path: '/api/csrf-token', method: 'GET' });
  console.log('CSRF token obtained:', csrf.data.csrfToken ? 'YES' : 'NO');
  const csrfToken = csrf.data.csrfToken;

  // Step 3: POST /api/auth/register
  const email = 'regression_f5_' + Date.now() + '@test.com';
  console.log('\n=== Step 3: POST /api/auth/register ===');
  const reg = await fetch({
    hostname: BASE, port: PORT, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }
  }, { email: email, password: 'TestPass123!', role: 'therapist' });
  console.log('Status:', reg.status);
  console.log('Response:', JSON.stringify(reg.data, null, 2));
  console.log('Has token:', reg.data.token ? 'YES' : 'NO');

  // Step 4: GET /api/auth/me (authenticated)
  if (reg.data.token) {
    console.log('\n=== Step 4: GET /api/auth/me ===');
    const me = await fetch({
      hostname: BASE, port: PORT, path: '/api/auth/me', method: 'GET',
      headers: { 'Authorization': 'Bearer ' + reg.data.token }
    });
    console.log('Status:', me.status);
    console.log('Response:', JSON.stringify(me.data, null, 2));
    console.log('Has user data:', me.data.user ? 'YES' : 'NO');
    console.log('Email matches:', me.data.user && me.data.user.email === email ? 'YES' : 'NO');
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  const pass = health.data.database === 'connected'
    && health.data.tableCount >= 14
    && reg.data.token
    && reg.status < 400;
  console.log('Feature 5 Result:', pass ? 'PASS' : 'FAIL');
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
