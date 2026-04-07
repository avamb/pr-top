const http = require('http');

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, cookies }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  // Feature 1: Health check
  console.log('=== FEATURE 1: Health Check ===');
  const start = Date.now();
  const health = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  const elapsed = Date.now() - start;
  console.log('Status:', health.status);
  console.log('Response:', health.data);
  console.log('Time (ms):', elapsed);
  console.log('PASS status 200:', health.status === 200);

  const healthJson = JSON.parse(health.data);
  console.log('PASS database connected:', healthJson.database === 'connected');
  console.log('PASS response < 2s:', elapsed < 2000);

  // Feature 5: Real DB queries
  console.log('\n=== FEATURE 5: Real DB Queries ===');

  // The health endpoint returns tableCount which requires a real SQL query
  console.log('tableCount:', healthJson.tableCount);
  console.log('PASS real DB (tableCount > 0):', healthJson.tableCount > 0);

  // Get CSRF token
  const csrfPath = '/api/csrf' + '-token';
  const csrfResp = await makeRequest({ hostname: 'localhost', port: 3001, path: csrfPath, method: 'GET' });
  console.log('\nCSRF response:', csrfResp.data);
  const csrfJson = JSON.parse(csrfResp.data);
  const csrfToken = csrfJson.csrfToken || csrfJson.token;
  const cookieHeader = csrfResp.cookies.map(c => c.split(';')[0]).join('; ');

  // Register a test user
  const testEmail = 'regtest_f5_' + Date.now() + '@test.com';
  const regBody = JSON.stringify({ email: testEmail, password: 'TestPass123!', name: 'Regression Test F5' });
  const regResp = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken, 'Cookie': cookieHeader },
    body: regBody
  });
  console.log('\nRegister status:', regResp.status);
  console.log('Register response:', regResp.data);
  console.log('PASS register succeeded:', regResp.status === 200 || regResp.status === 201);

  // Get auth cookies from registration
  const allCookies = [...csrfResp.cookies, ...regResp.cookies];
  const authCookieHeader = allCookies.map(c => c.split(';')[0]).join('; ');

  // Check /api/auth/me
  const meResp = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
    headers: { 'Cookie': authCookieHeader }
  });
  console.log('\nAuth/me status:', meResp.status);
  console.log('Auth/me response:', meResp.data);
  console.log('PASS auth/me returns user:', meResp.status === 200);

  if (meResp.status === 200) {
    const meJson = JSON.parse(meResp.data);
    console.log('PASS user has id:', !!meJson.id || !!meJson.user?.id);
    console.log('PASS user email matches:', (meJson.email || meJson.user?.email) === testEmail);
  }

  console.log('\n=== SUMMARY ===');
  console.log('Feature 1 (Health): PASS -', health.status === 200 && healthJson.database === 'connected' && elapsed < 2000 ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
  console.log('Feature 5 (Real DB):', healthJson.tableCount > 0 && (regResp.status === 200 || regResp.status === 201) ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
}

run().catch(err => console.error('Error:', err));
