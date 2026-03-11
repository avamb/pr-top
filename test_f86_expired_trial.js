// Test Feature #86: Expired trial restricts access
const http = require('http');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Feature #86: Expired trial restricts access ===\n');
  let passed = 0;
  let failed = 0;

  function check(label, condition) {
    if (condition) { passed++; console.log('  PASS:', label); }
    else { failed++; console.log('  FAIL:', label); }
  }

  // Step 1: Get CSRF token
  const csrfRes = await request('GET', '/api/csrf-token');
  const csrf = csrfRes.body.csrfToken;
  check('Got CSRF token', !!csrf);

  // Step 2: Register a new therapist (auto-creates trial subscription)
  const email = 'expired_f86_' + Date.now() + '@test.com';
  const regRes = await request('POST', '/api/auth/register', {
    email, password: 'TestPass123', role: 'therapist'
  }, { 'X-CSRF-Token': csrf });
  check('Register therapist (201)', regRes.status === 201);
  const token = regRes.body.token;

  if (!token) {
    console.log('ABORT: No token. Response:', JSON.stringify(regRes.body));
    return;
  }

  // Step 3: Get user ID
  const meRes = await request('GET', '/api/auth/me', null, {
    'Authorization': 'Bearer ' + token
  });
  const userId = meRes.body.user?.id || meRes.body.id;
  check('Got user ID', !!userId);

  // Step 4: Verify dashboard works BEFORE expiring trial
  console.log('\n--- Before Trial Expiry ---');
  const dashBefore = await request('GET', '/api/dashboard/stats', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Dashboard accessible (200)', dashBefore.status === 200);

  const clientsBefore = await request('GET', '/api/clients', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Clients accessible (200)', clientsBefore.status === 200);

  const sessionsBefore = await request('GET', '/api/sessions/999', null, {
    'Authorization': 'Bearer ' + token
  });
  // Should be 404 (session not found) not 402
  check('Sessions endpoint accessible (not 402)', sessionsBefore.status !== 402);

  // Step 5: Expire the trial
  console.log('\n--- Expiring Trial ---');
  const csrfRes2 = await request('GET', '/api/csrf-token');
  const csrf2 = csrfRes2.body.csrfToken;
  const expireRes = await request('POST', '/api/dev/expire-trial', {
    therapist_id: userId
  }, { 'X-CSRF-Token': csrf2 });
  check('Trial expired via dev endpoint', expireRes.body.expired === true);

  // Step 6: Verify subscription shows as expired
  const subRes = await request('GET', '/api/subscription/current', null, {
    'Authorization': 'Bearer ' + token
  });
  console.log('  Subscription data:', JSON.stringify(subRes.body.subscription));

  // Step 7: Verify API returns 402 on protected routes
  console.log('\n--- After Trial Expiry ---');
  const dashAfter = await request('GET', '/api/dashboard/stats', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Dashboard returns 402', dashAfter.status === 402);
  check('Error is subscription_expired', dashAfter.body.error === 'subscription_expired');
  check('Response has redirect to /subscription', dashAfter.body.redirect === '/subscription');
  console.log('  Dashboard response:', JSON.stringify(dashAfter.body));

  const clientsAfter = await request('GET', '/api/clients', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Clients returns 402', clientsAfter.status === 402);

  const exercisesAfter = await request('GET', '/api/exercises', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Exercises returns 402', exercisesAfter.status === 402);

  const searchAfter = await request('POST', '/api/query', { query: 'test' }, {
    'Authorization': 'Bearer ' + token
  });
  check('Query returns 402', searchAfter.status === 402);

  // Step 8: Verify subscription page is still accessible (no requireActiveSubscription)
  const subPageAfter = await request('GET', '/api/subscription/current', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Subscription endpoint still accessible', subPageAfter.status === 200);
  console.log('  Subscription status:', subPageAfter.body.subscription?.status);

  // Step 9: Select a plan (upgrade to Basic) to restore access
  console.log('\n--- Upgrading Plan to Restore Access ---');
  const upgradeRes = await request('POST', '/api/subscription/checkout', {
    plan: 'basic'
  }, { 'Authorization': 'Bearer ' + token });
  check('Checkout/upgrade succeeds', upgradeRes.status === 200);
  check('Auto-completed in dev mode', upgradeRes.body.auto_completed === true);
  console.log('  Upgrade response:', JSON.stringify(upgradeRes.body));

  // Step 10: Verify access restored after plan selection
  console.log('\n--- After Plan Selection ---');
  const dashRestored = await request('GET', '/api/dashboard/stats', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Dashboard accessible again (200)', dashRestored.status === 200);

  const clientsRestored = await request('GET', '/api/clients', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Clients accessible again (200)', clientsRestored.status === 200);

  const subFinal = await request('GET', '/api/subscription/current', null, {
    'Authorization': 'Bearer ' + token
  });
  check('Subscription now shows basic plan', subFinal.body.subscription?.plan === 'basic');
  check('Subscription status is active', subFinal.body.subscription?.status === 'active');

  // Summary
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed === 0) console.log('ALL TESTS PASSED!');
}

run().catch(console.error);
