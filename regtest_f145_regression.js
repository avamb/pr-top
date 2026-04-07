const http = require('http');

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, cookies, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  const BASE = 'localhost';
  const PORT = 3001;

  // Step 1: Health check
  console.log('=== FEATURE 1: Health Check ===');
  const healthStart = Date.now();
  const health = await makeRequest({ hostname: BASE, port: PORT, path: '/api/health', method: 'GET' });
  const healthTime = Date.now() - healthStart;
  const healthData = JSON.parse(health.data);
  console.log('Status:', health.status);
  console.log('Database:', healthData.database);
  console.log('Table count:', healthData.tableCount);
  console.log('Response time:', healthTime, 'ms');
  console.log('F1 PASS:', health.status === 200 && healthData.database === 'connected' && healthTime < 2000);

  // Step 2: Get CSRF token
  console.log('\n=== FEATURE 5: Real Database Queries ===');
  const csrfResp = await makeRequest({ hostname: BASE, port: PORT, path: '/api/csrf-token', method: 'GET' });
  const csrfData = JSON.parse(csrfResp.data);
  const token = csrfData.csrfToken;
  console.log('Got CSRF token:', token ? 'yes' : 'no');

  // Step 3: Register a test user
  const email = 'regtest_f5_' + Date.now() + '@test.com';
  const registerBody = JSON.stringify({
    email: email,
    password: 'TestPass123!',
    name: 'RegTest User F5',
    language: 'en'
  });

  const registerResp = await makeRequest({
    hostname: BASE, port: PORT,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
      'Content-Length': Buffer.byteLength(registerBody)
    }
  }, registerBody);

  console.log('Register status:', registerResp.status);
  const regData = JSON.parse(registerResp.data);
  console.log('Register response has user:', !!regData.user);
  console.log('Register response has token:', !!regData.token);

  if (regData.user) {
    console.log('User ID:', regData.user.id);
    console.log('User email:', regData.user.email);
  }

  // Step 4: Check /api/auth/me with the token
  if (regData.token) {
    // Extract session cookie if any
    const sessionCookie = registerResp.cookies.find(c => c.includes('session') || c.includes('token'));
    const cookieHeader = registerResp.cookies.map(c => c.split(';')[0]).join('; ');

    const meResp = await makeRequest({
      hostname: BASE, port: PORT,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + regData.token,
        'Cookie': cookieHeader
      }
    });

    console.log('\nAuth/me status:', meResp.status);
    const meData = JSON.parse(meResp.data);
    console.log('Auth/me returns user:', !!meData.user);
    if (meData.user) {
      console.log('Auth/me user email:', meData.user.email);
      console.log('Auth/me user matches registered:', meData.user.email === email);
    }

    const f5pass = registerResp.status === 201 || registerResp.status === 200;
    const mePass = meResp.status === 200 && meData.user && meData.user.email === email;
    console.log('\nF5 Register PASS:', f5pass);
    console.log('F5 Auth/me PASS:', mePass);
    console.log('F5 OVERALL PASS:', f5pass && mePass);
  } else {
    console.log('No token returned - checking if registration failed');
    console.log('Register full response:', JSON.stringify(regData));
    console.log('F5 PASS: false');
  }
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
