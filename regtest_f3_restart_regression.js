const http = require('http');
const { execSync } = require('child_process');

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

function waitForHealth(maxAttempts, delay) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function check() {
      attempts++;
      const req = http.request({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET', timeout: 3000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else if (attempts < maxAttempts) {
            setTimeout(check, delay);
          } else {
            reject(new Error('Health check failed after ' + maxAttempts + ' attempts'));
          }
        });
      });
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, delay);
        } else {
          reject(new Error('Server not reachable after ' + maxAttempts + ' attempts'));
        }
      });
      req.end();
    }
    check();
  });
}

async function testPostRestart() {
  console.log('=== POST-RESTART: Testing data persistence ===');

  // Wait for server to be ready
  console.log('Waiting for server health...');
  const healthData = await waitForHealth(30, 2000);
  console.log('Server is healthy:', healthData.substring(0, 100));

  // Get CSRF token
  const csrfRes = await request({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrfRes.data).csrfToken;
  const csrfCookie = csrfRes.cookies.find(c => c.startsWith('csrf_token='));
  const csrfCookieVal = csrfCookie ? csrfCookie.split(';')[0] : '';

  // Login with the pre-restart user
  const loginRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': csrfCookieVal }
  }, { email: 'RESTART_TEST_REGR_345@test.com', password: 'TestPass123!' });

  console.log('Login status:', loginRes.status);
  console.log('Login response:', loginRes.data.substring(0, 300));

  if (loginRes.status !== 200) {
    console.log('CRITICAL FAILURE: User not found after restart - in-memory storage detected!');
    process.exit(1);
  }

  const loginData = JSON.parse(loginRes.data);
  const token = loginData.token;

  // Verify user data via /me
  const meRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });

  console.log('Me status:', meRes.status);
  const meData = JSON.parse(meRes.data);
  console.log('Me data:', JSON.stringify(meData).substring(0, 300));

  if (meRes.status === 200 && meData.user && meData.user.email === 'restart_test_regr_345@test.com') {
    console.log('\n=== FEATURE 3 PASS: Data persisted across server restart ===');
  } else {
    console.log('\nCRITICAL FAILURE: User data lost after restart');
    process.exit(1);
  }
}

testPostRestart().catch(e => { console.error('Error:', e.message); process.exit(1); });
