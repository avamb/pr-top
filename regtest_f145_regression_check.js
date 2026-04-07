const http = require('http');

function makeRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, cookies }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testFeature5() {
  console.log('=== Feature 5: Backend API queries real database ===\n');

  // Step 1: Health check
  console.log('1. GET /api/health');
  const health = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  console.log('   Status:', health.status);
  const healthData = JSON.parse(health.data);
  console.log('   Database:', healthData.database);
  console.log('   Table count:', healthData.tableCount);
  console.log('   PASS:', healthData.database === 'connected' && healthData.tableCount > 0 ? 'YES' : 'NO');

  // Step 2: Get CSRF token
  console.log('\n2. GET /api/csrf-token');
  const csrfResp = await makeRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrfResp.data).csrfToken;
  const cookieStr = csrfResp.cookies.map(c => c.split(';')[0]).join('; ');
  console.log('   CSRF token obtained:', csrfToken ? 'YES' : 'NO');

  // Step 3: Register a user (tests INSERT)
  const email = 'regtest_f5_' + Date.now() + '@test.com';
  const regBody = JSON.stringify({ email, password: 'TestPass123!', name: 'RegTest F5' });
  console.log('\n3. POST /api/auth/register with email:', email);
  const regResp = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': cookieStr, 'Content-Length': Buffer.byteLength(regBody) }
  }, regBody);
  console.log('   Status:', regResp.status);
  const regData = JSON.parse(regResp.data);
  console.log('   Response:', JSON.stringify(regData).substring(0, 200));
  const regPass = regResp.status === 200 || regResp.status === 201;
  console.log('   PASS:', regPass ? 'YES' : 'NO');

  // Step 4: Get auth cookies and test /api/auth/me (tests SELECT)
  const authCookies = regResp.cookies.map(c => c.split(';')[0]).join('; ');
  console.log('\n4. GET /api/auth/me (authenticated)');
  const meResp = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
    headers: { 'Cookie': authCookies }
  });
  console.log('   Status:', meResp.status);
  if (meResp.status === 200) {
    const meData = JSON.parse(meResp.data);
    console.log('   User email:', meData.user ? meData.user.email : 'N/A');
    console.log('   Has user ID:', meData.user && meData.user.id ? 'YES' : 'NO');
    console.log('   PASS: YES');
  } else {
    console.log('   Response:', meResp.data.substring(0, 200));
    console.log('   PASS: NO');
  }

  // Step 5: Verify database file exists and has real data
  const fs = require('fs');
  const path = require('path');
  const dbPaths = [
    path.join(__dirname, 'src', 'backend', 'data', 'database.sqlite'),
    path.join(__dirname, 'src', 'backend', 'database.sqlite'),
    path.join(__dirname, 'data', 'database.sqlite')
  ];
  console.log('\n5. Checking database file exists');
  let dbFound = false;
  for (const dbPath of dbPaths) {
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log('   Found:', dbPath);
      console.log('   Size:', stats.size, 'bytes');
      console.log('   Modified:', stats.mtime.toISOString());
      dbFound = true;
      break;
    }
  }
  if (!dbFound) {
    // Search more broadly
    const glob = require('path');
    console.log('   Searching for .sqlite files...');
    const { execSync } = require('child_process');
    try {
      const found = execSync('dir /s /b "' + path.join(__dirname, 'src') + '\\*.sqlite" 2>nul', { encoding: 'utf8' });
      console.log('   Found:', found.trim());
      dbFound = found.trim().length > 0;
    } catch (e) {
      console.log('   No .sqlite files found');
    }
  }
  console.log('   DB file exists PASS:', dbFound ? 'YES' : 'NO');

  // Summary
  console.log('\n=== SUMMARY ===');
  const allPass = healthData.database === 'connected' && healthData.tableCount > 0 && regPass && dbFound;
  console.log('Feature 5 overall:', allPass ? 'PASS' : 'FAIL');
  return allPass;
}

testFeature5().catch(e => { console.error('Error:', e.message); process.exit(1); });
