const http = require('http');

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  const testEmail = 'RESTART_TEST_REGR_AGENT_' + Date.now() + '@test.com';
  console.log('Test email:', testEmail);

  // Step 1: Get CSRF token
  const csrf = await req({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  console.log('CSRF status:', csrf.status);
  const csrfToken = JSON.parse(csrf.body).csrfToken;
  const cookies = (csrf.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

  // Step 2: Register test user
  const regBody = { email: testEmail, password: 'TestPass123!', name: 'Regression Test Agent' };
  const reg = await req({
    hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies, 'x-csrf-token': csrfToken }
  }, regBody);
  console.log('Register status:', reg.status);
  console.log('Register body:', reg.body);

  // Get auth cookies
  const regCookies = (reg.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  const allCookies = cookies + '; ' + regCookies;

  // Step 3: Get /api/auth/me to verify user exists
  const me = await req({
    hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
    headers: { 'Cookie': allCookies, 'x-csrf-token': csrfToken }
  });
  console.log('Me status:', me.status);
  console.log('Me body:', me.body);

  if (reg.status === 201 && me.status === 200) {
    console.log('PHASE1_PASS: Registration and auth working');
  } else {
    console.log('PHASE1_FAIL: Registration or auth failed');
  }

  // Save state for post-restart verification
  const state = { testEmail, password: 'TestPass123!', csrfToken };
  require('fs').writeFileSync('regtest_f345_agent_state.json', JSON.stringify(state));
  console.log('State saved for post-restart test');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
