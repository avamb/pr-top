const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, cookies }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  // Step 1: Get CSRF token
  console.log('=== Step 1: Get CSRF token ===');
  const csrfRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  console.log('Status:', csrfRes.status);
  console.log('Response:', csrfRes.data);
  console.log('Cookies:', csrfRes.cookies);

  const csrfData = JSON.parse(csrfRes.data);
  const token = csrfData.csrfToken || csrfData.token;
  console.log('Token:', token);

  // Extract session cookie
  const sessionCookie = csrfRes.cookies.find(c => c.includes('session') || c.includes('sid') || c.includes('connect'));
  const cookieStr = csrfRes.cookies.map(c => c.split(';')[0]).join('; ');

  // Step 2: Test registration (Feature 5 - real DB INSERT)
  console.log('\n=== Step 2: Register test user ===');
  const regData = JSON.stringify({
    email: `regtest_f145_${Date.now()}@test.com`,
    password: 'TestPass123!',
    name: 'RegTest F145',
    language: 'en'
  });

  const regRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
      'Cookie': cookieStr
    }
  }, regData);

  console.log('Status:', regRes.status);
  console.log('Response:', regRes.data);

  // Step 3: Health check (Feature 1)
  console.log('\n=== Step 3: Health check ===');
  const healthRes = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  console.log('Status:', healthRes.status);
  const healthData = JSON.parse(healthRes.data);
  console.log('Database status:', healthData.database);
  console.log('Table count:', healthData.tableCount);
  console.log('Full response:', JSON.stringify(healthData, null, 2));

  // Verify Feature 1
  console.log('\n=== Feature 1 Verification ===');
  console.log('Health status 200:', healthRes.status === 200 ? 'PASS' : 'FAIL');
  console.log('Database connected:', healthData.database === 'connected' ? 'PASS' : 'FAIL');
  console.log('Has table count:', healthData.tableCount > 0 ? 'PASS' : 'FAIL');

  // Verify Feature 5
  console.log('\n=== Feature 5 Verification ===');
  const regSuccess = regRes.status === 200 || regRes.status === 201;
  const regDataParsed = JSON.parse(regRes.data);
  console.log('Registration succeeded:', regSuccess ? 'PASS' : 'FAIL (' + regRes.status + ')');
  console.log('Response has user data:', regDataParsed.user ? 'PASS' : 'FAIL');
  if (regDataParsed.user) {
    console.log('User has ID:', regDataParsed.user.id ? 'PASS' : 'FAIL');
  }
}

main().catch(e => console.error('Error:', e));
