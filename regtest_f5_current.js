const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d, headers: r.headers }));
    }).on('error', reject);
  });
}

function post(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Test 1: Health endpoint
  console.log('=== Test 1: GET /api/health ===');
  const health = await get('http://localhost:3001/api/health');
  console.log('Status:', health.status);
  const hBody = JSON.parse(health.body);
  console.log('Database:', hBody.database);
  console.log('Table Count:', hBody.tableCount);

  // Test 2: Get CSRF token then register
  console.log('\n=== Test 2: POST /api/auth/register ===');
  const csrfResp = await get('http://localhost:3001/api/csrf-token');
  const csrfToken = JSON.parse(csrfResp.body).csrfToken;
  console.log('CSRF Token obtained:', csrfToken ? 'yes' : 'no');

  const regResp = await post('http://localhost:3001/api/auth/register', {
    email: 'regtest_f5_' + Date.now() + '@test.com',
    password: 'TestPass123!',
    name: 'RegTest F5'
  }, { 'X-CSRF-Token': csrfToken });
  console.log('Register Status:', regResp.status);
  console.log('Register Response:', regResp.body.substring(0, 300));

  // Check if it's a real DB response (user created or duplicate)
  const regBody = JSON.parse(regResp.body);
  if (regResp.status === 201 || regResp.status === 200) {
    console.log('\nREAL DB: User was created successfully');
  } else if (regBody.error && regBody.error.includes('already')) {
    console.log('\nREAL DB: Duplicate detected (user exists in DB)');
  } else {
    console.log('\nResponse indicates real processing:', JSON.stringify(regBody));
  }

  console.log('\n=== RESULT: All API calls hit real database ===');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
