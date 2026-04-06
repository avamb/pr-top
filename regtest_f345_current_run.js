const http = require('http');
const fs = require('fs');

const req = (method, path, body, cookies) => {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path, method, headers: { 'Content-Type': 'application/json' } };
    if (cookies) opts.headers['Cookie'] = cookies;
    if (body && body.csrf) opts.headers['X-CSRF-Token'] = body.csrf;
    const r = http.request(opts, res => {
      let data = '';
      const sc = res.headers['set-cookie'] || [];
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}'), cookies: sc }));
    });
    r.on('error', reject);
    if (body && body.payload) r.write(JSON.stringify(body.payload));
    r.end();
  });
};

const main = async () => {
  console.log('=== Feature 3 & 5 Regression Test ===\n');

  // Step 1: Get CSRF token
  const csrf = await req('GET', '/api/csrf-token');
  console.log('1. CSRF token:', csrf.status === 200 ? 'OK' : 'FAIL', '(' + csrf.status + ')');
  const token = csrf.data.csrfToken;
  const cookieStr = csrf.cookies.map(c => c.split(';')[0]).join('; ');

  // Step 2: Register test user
  const email = 'RESTART_TEST_REGR_' + Date.now() + '@test.com';
  const password = 'TestPass123!';
  const reg = await req('POST', '/api/auth/register', {
    csrf: token,
    payload: { email, password, name: 'Restart Regression Test' }
  }, cookieStr);
  console.log('2. Register:', reg.status, reg.status === 201 ? 'OK' : 'UNEXPECTED');
  if (reg.status !== 201) {
    console.log('   Response:', JSON.stringify(reg.data));
  }
  const allCookies = [...csrf.cookies, ...(reg.cookies || [])].map(c => c.split(';')[0]).join('; ');

  // Step 3: Verify with /api/auth/me
  const me = await req('GET', '/api/auth/me', null, allCookies);
  console.log('3. Auth/me:', me.status, me.status === 200 ? 'OK' : 'FAIL');
  if (me.data && me.data.user) {
    console.log('   User email:', me.data.user.email);
    console.log('   User name:', me.data.user.name);
  }

  // Save state for restart test
  fs.writeFileSync('/tmp/f3_restart_state.json', JSON.stringify({ email, password, token }));
  console.log('\n4. State saved for restart test');
  console.log('   Test email:', email);

  // Step 4: Check health for Feature 5
  const health = await req('GET', '/api/health');
  console.log('\n=== Feature 5: DB Connection Check ===');
  console.log('5. Health:', health.status === 200 ? 'OK' : 'FAIL');
  console.log('   Database:', health.data.database);
  console.log('   Table count:', health.data.tableCount);

  if (health.data.database !== 'connected' || !health.data.tableCount || health.data.tableCount < 1) {
    console.log('   FAILURE: Database not properly connected!');
  } else {
    console.log('   Database is real and connected with', health.data.tableCount, 'tables');
  }

  console.log('\n=== Pre-restart checks complete ===');
};

main().catch(e => console.error('Error:', e.message));
