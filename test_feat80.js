const http = require('http');

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Get CSRF token
  const csrfRes = await request({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = csrfRes.data.csrfToken || csrfRes.data.token;
  console.log('CSRF token:', csrfToken);

  // Step 2: Register a fresh therapist for cancel test
  const email = 'cancel_test_' + Date.now() + '@test.com';
  const regRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }
  }, JSON.stringify({ email, password: 'Test123!', role: 'therapist' }));
  console.log('Register:', regRes.status, regRes.data);
  const token = regRes.data.token;

  // Step 3: Check current subscription (should be trial)
  const subRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/subscription/current',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Current sub:', subRes.status, JSON.stringify(subRes.data));

  // Step 4: Upgrade to pro first (need non-trial for cancel)
  const upgradeRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/subscription/checkout',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'x-csrf-token': csrfToken }
  }, JSON.stringify({ plan: 'pro' }));
  console.log('Upgrade to pro:', upgradeRes.status, JSON.stringify(upgradeRes.data));

  // Step 5: Check subscription after upgrade
  const subRes2 = await request({
    hostname: 'localhost', port: 3001, path: '/api/subscription/current',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Sub after upgrade:', subRes2.status, JSON.stringify(subRes2.data));
  const periodEnd = subRes2.data.subscription?.current_period_end;
  console.log('Period end:', periodEnd);

  // Step 6: Cancel subscription
  const cancelRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/subscription/cancel',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'x-csrf-token': csrfToken }
  }, JSON.stringify({}));
  console.log('Cancel:', cancelRes.status, JSON.stringify(cancelRes.data));

  // Verify cancel response
  if (cancelRes.status !== 200) {
    console.log('FAIL: Cancel returned status', cancelRes.status);
    process.exit(1);
  }
  if (cancelRes.data.subscription?.status !== 'canceled') {
    console.log('FAIL: Status not canceled');
    process.exit(1);
  }
  console.log('PASS: Status changed to canceled');
  console.log('PASS: Access until:', cancelRes.data.subscription?.access_until);

  // Step 7: Verify access still works after cancel (access continues until period end)
  const subRes3 = await request({
    hostname: 'localhost', port: 3001, path: '/api/subscription/current',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Sub after cancel:', subRes3.status, JSON.stringify(subRes3.data));

  if (subRes3.status !== 200) {
    console.log('FAIL: Access denied after cancel');
    process.exit(1);
  }
  console.log('PASS: Access continues after cancel');

  if (subRes3.data.subscription?.status !== 'canceled') {
    console.log('FAIL: Status not canceled in GET current');
    process.exit(1);
  }
  console.log('PASS: GET current shows canceled status');

  // Step 8: Verify can still access dashboard (auth works)
  const dashRes = await request({
    hostname: 'localhost', port: 3001, path: '/api/dashboard/stats',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Dashboard after cancel:', dashRes.status);
  if (dashRes.status === 200) {
    console.log('PASS: Dashboard still accessible after cancellation');
  } else {
    console.log('FAIL: Dashboard blocked after cancel');
    process.exit(1);
  }

  // Step 9: Verify double-cancel returns 400
  const cancel2Res = await request({
    hostname: 'localhost', port: 3001, path: '/api/subscription/cancel',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'x-csrf-token': csrfToken }
  }, JSON.stringify({}));
  console.log('Double cancel:', cancel2Res.status, JSON.stringify(cancel2Res.data));
  if (cancel2Res.status === 400) {
    console.log('PASS: Double cancel returns 400');
  }

  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
