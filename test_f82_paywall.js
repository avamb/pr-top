const http = require('http');

function apiCall(method, path, body, token, csrfToken) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    if (!token && !csrfToken) headers['x-bot-api-key'] = 'dev-bot-api-key';
    const opts = { hostname: 'localhost', port: 3001, path, method, headers };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const TS = Date.now();

async function run() {
  // Get CSRF token first
  const csrf = await apiCall('GET', '/api/csrf-token');
  const csrfToken = csrf.body.csrfToken;
  console.log('CSRF token:', csrfToken ? 'obtained' : 'MISSING');

  // 1. Register a Trial therapist via web (needs CSRF token)
  const reg = await apiCall('POST', '/api/auth/register', {
    email: 'paywall_test_' + TS + '@test.com',
    password: 'Test1234!',
    role: 'therapist'
  }, null, csrfToken);
  console.log('Register therapist:', reg.status, 'id=' + reg.body.user?.id);
  const token = reg.body.token;
  const therapistId = reg.body.user?.id;

  if (!token || !therapistId) {
    console.log('FAIL: Could not register therapist');
    process.exit(1);
  }

  // 2. Register 4 clients via bot
  const clients = [];
  for (let i = 1; i <= 4; i++) {
    const c = await apiCall('POST', '/api/bot/register', {
      telegram_id: 'paywall_client_' + TS + '_' + i,
      role: 'client',
      language: 'en'
    });
    console.log('Register client ' + i + ':', c.status, 'id=' + c.body.user_id);
    clients.push({ telegram_id: 'paywall_client_' + TS + '_' + i, id: c.body.user_id });
  }

  // 3. Link first 3 clients (should succeed - trial limit = 3)
  for (let i = 0; i < 3; i++) {
    const consent = await apiCall('POST', '/api/bot/consent', {
      telegram_id: clients[i].telegram_id,
      therapist_id: therapistId,
      consent: true
    });
    console.log('Link client ' + (i + 1) + ':', consent.status, consent.body.linked ? 'SUCCESS' : consent.body.error);
    if (!consent.body.linked) {
      console.log('FAIL: Client ' + (i + 1) + ' should link successfully');
      process.exit(1);
    }
  }

  // 4. Attempt 4th client (should fail with 403)
  const blocked = await apiCall('POST', '/api/bot/consent', {
    telegram_id: clients[3].telegram_id,
    therapist_id: therapistId,
    consent: true
  });
  console.log('Link client 4 (should fail):', blocked.status, blocked.body.error || 'NO ERROR');

  if (blocked.status !== 403) {
    console.log('FAIL: Expected 403 but got ' + blocked.status);
    process.exit(1);
  }
  console.log('CHECK 1 PASSED: 4th client blocked at trial limit');

  // 5. Upgrade to Basic plan
  const upgrade = await apiCall('POST', '/api/subscription/change-plan', { plan: 'basic' }, token);
  console.log('Upgrade to basic:', upgrade.status, upgrade.body.message);

  if (upgrade.status !== 200) {
    console.log('FAIL: Could not upgrade to basic plan');
    process.exit(1);
  }

  // 6. Retry 4th client (should succeed now - basic limit = 10)
  const retry = await apiCall('POST', '/api/bot/consent', {
    telegram_id: clients[3].telegram_id,
    therapist_id: therapistId,
    consent: true
  });
  console.log('Link client 4 after upgrade:', retry.status, retry.body.linked ? 'SUCCESS' : retry.body.error);

  if (!retry.body.linked) {
    console.log('FAIL: 4th client should be linkable after upgrade');
    process.exit(1);
  }
  console.log('CHECK 2 PASSED: 4th client links after upgrade to basic');

  console.log('\nALL CHECKS PASSED - Feature #82 verified');
}

run().catch(e => { console.error(e); process.exit(1); });
