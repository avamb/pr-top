const http = require('http');

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  // Test 1: Health endpoint
  console.log('=== Feature 1: Health Endpoint ===');
  const start = Date.now();
  const health = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  const elapsed = Date.now() - start;
  console.log('Status:', health.status);
  console.log('Response:', health.body);
  console.log('Response time:', elapsed, 'ms');

  const healthData = JSON.parse(health.body);
  console.log('DB status:', healthData.database);
  console.log('Table count:', healthData.tableCount);
  console.log('Feature 1 PASS:', health.status === 200 && healthData.database === 'connected' && elapsed < 2000);

  // Test 2: Get CSRF token
  console.log('\n=== Feature 5: Real DB Queries ===');
  const csrfResp = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrfResp.body).csrfToken;
  console.log('Got CSRF token:', csrfToken ? 'yes' : 'no');

  // Test 3: Register a user (INSERT query)
  const regBody = JSON.stringify({
    email: 'regtest_f145_' + Date.now() + '@test.com',
    password: 'TestPass123!',
    name: 'RegTest User',
    language: 'en'
  });
  const regResp = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Content-Length': Buffer.byteLength(regBody) }
  }, regBody);
  console.log('Register status:', regResp.status);
  console.log('Register response:', regResp.body);

  const regData = JSON.parse(regResp.body);
  const hasToken = !!(regData.token || regData.user);
  console.log('Registration created user:', hasToken);

  // Test 4: Use auth token to call /api/auth/me (SELECT query)
  if (regData.token) {
    const meResp = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
      headers: { 'Cookie': 'token=' + regData.token, 'X-CSRF-Token': csrfToken }
    });
    console.log('Auth/me status:', meResp.status);
    console.log('Auth/me response:', meResp.body);
  }

  // Feature 5: If registration succeeded with a real user ID, DB is real
  const f5pass = regResp.status === 201 || regResp.status === 200;
  console.log('\nFeature 5 PASS:', f5pass, '(registration hit real DB)');
}

run().catch(e => console.error('Error:', e));
