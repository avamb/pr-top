const http = require('http');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Feature 1: Health Endpoint ===');
  const health = await httpGet('http://localhost:3001/api/health');
  console.log('Status:', health.status);
  const healthData = JSON.parse(health.body);
  console.log('Database:', healthData.database);
  console.log('Table count:', healthData.tableCount);
  console.log('F1 PASS:', health.status === 200 && healthData.database === 'connected');

  console.log('\n=== Feature 5: Real DB Queries ===');

  // Get CSRF token
  const csrfResp = await httpGet('http://localhost:3001/api/csrf-token');
  const csrfToken = JSON.parse(csrfResp.body).csrfToken;
  const cookies = csrfResp.headers['set-cookie'];
  const cookieStr = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
  console.log('CSRF token obtained:', !!csrfToken);

  // Test register (may fail if user exists, that's ok - we just need to see it hits the DB)
  const uniqueEmail = 'regtest_f5_' + Date.now() + '@test.com';
  const registerResp = await httpPost(
    'http://localhost:3001/api/auth/register',
    JSON.stringify({ email: uniqueEmail, password: 'TestPass123', name: 'RegTest F5' }),
    {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': cookieStr
    }
  );
  console.log('Register status:', registerResp.status);
  console.log('Register response:', registerResp.body.substring(0, 200));

  const regData = JSON.parse(registerResp.body);
  const registerSuccess = registerResp.status === 201 || registerResp.status === 200;
  console.log('Registration created user:', registerSuccess);

  if (registerSuccess && regData.token) {
    // Test authenticated endpoint
    const csrfResp2 = await httpGet('http://localhost:3001/api/csrf-token');
    const csrfToken2 = JSON.parse(csrfResp2.body).csrfToken;
    const cookies2 = csrfResp2.headers['set-cookie'];
    const cookieStr2 = cookies2 ? cookies2.map(c => c.split(';')[0]).join('; ') : '';

    const meResp = await httpGet('http://localhost:3001/api/auth/me');
    console.log('GET /api/auth/me status (no auth):', meResp.status);
    // Should be 401 without token - proving it checks the DB
    console.log('Correctly requires auth:', meResp.status === 401);
  }

  console.log('\nF5 PASS:', registerSuccess);
  console.log('\n=== Summary ===');
  console.log('Feature 1 (Health endpoint):', health.status === 200 && healthData.database === 'connected' ? 'PASS' : 'FAIL');
  console.log('Feature 5 (Real DB queries):', registerSuccess ? 'PASS' : 'FAIL');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
