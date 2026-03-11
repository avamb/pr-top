const http = require('http');

function req(method, urlPath, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path: urlPath, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) Object.assign(opts.headers, extraHeaders);
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  const ts = Date.now();

  // Get CSRF token
  const csrfRes = await req('GET', '/api/csrf-token');
  const csrf = csrfRes.body.csrfToken;

  // Register therapist (trial)
  const email = 'expired_trial_' + ts + '@test.com';
  const regRes = await req('POST', '/api/auth/register', { email, password: 'Test123!', role: 'therapist' }, null, { 'X-CSRF-Token': csrf });
  console.log('1. Register:', regRes.status);
  const token = regRes.body.token;
  const therapistId = regRes.body.user.id;

  // Step 1: Verify dashboard works with active trial
  const dashRes1 = await req('GET', '/api/dashboard/stats', null, token);
  console.log('2. Dashboard with active trial:', dashRes1.status);

  // Step 2: Expire the trial via API (set trial_ends_at to past)
  // Use the admin to update it or the dev endpoint
  const csrf2 = (await req('GET', '/api/csrf-token')).body.csrfToken;
  const adminLogin = await req('POST', '/api/auth/login', { email: 'admin@psylink.app', password: 'Admin123!' }, null, { 'X-CSRF-Token': csrf2 });
  const adminToken = adminLogin.body.token;

  // Directly update trial expiry via a dev endpoint
  // We'll need to create one or use direct DB manipulation via an existing endpoint
  // Let's use a POST to a dev endpoint
  const expireRes = await req('POST', '/api/dev/expire-trial', { therapist_id: therapistId }, adminToken);
  console.log('3. Expire trial via dev endpoint:', expireRes.status, expireRes.body);

  // If no dev endpoint, we'll need another approach
  if (expireRes.status === 404) {
    console.log('3b. No dev endpoint, using admin settings workaround...');
    // Use superadmin to run a direct query? Not possible via API
    // Let's test by setting trial duration to 0 and re-registering
    // Actually, let me just test what the middleware returns for an expired sub
    // We can't modify DB directly from test... let me add a dev endpoint

    console.log('NEED TO ADD DEV ENDPOINT - checking if we can test via subscription API');

    // Try setting subscription status to expired
    const subCurrentRes = await req('GET', '/api/subscription/current', null, token);
    console.log('Current sub:', JSON.stringify(subCurrentRes.body));
  }

  // Step 3: Attempt dashboard access with expired trial
  const dashRes2 = await req('GET', '/api/dashboard/stats', null, token);
  console.log('4. Dashboard with expired trial:', dashRes2.status, JSON.stringify(dashRes2.body));

  // Step 4: Verify subscription page still accessible
  const subRes = await req('GET', '/api/subscription/current', null, token);
  console.log('5. Subscription page access:', subRes.status);

  // Step 5: Upgrade plan and verify access restored
  const upgradeRes = await req('POST', '/api/subscription/change-plan', { plan: 'basic' }, token);
  console.log('6. Upgrade to basic:', upgradeRes.status, upgradeRes.body.message || upgradeRes.body.error);

  const dashRes3 = await req('GET', '/api/dashboard/stats', null, token);
  console.log('7. Dashboard after upgrade:', dashRes3.status);

  // Summary
  const step2pass = dashRes1.status === 200;
  const step4pass = dashRes2.status === 402;
  const step5pass = subRes.status === 200;
  const step7pass = dashRes3.status === 200;

  console.log('\n--- Results ---');
  console.log('Active trial -> dashboard 200:', step2pass);
  console.log('Expired trial -> dashboard 402:', step4pass);
  console.log('Subscription page accessible:', step5pass);
  console.log('After upgrade -> dashboard 200:', step7pass);

  if (step2pass && step4pass && step5pass && step7pass) {
    console.log('\n=== PASS ===');
  } else {
    console.log('\n=== FAIL ===');
  }
}

main().catch(e => console.error('Error:', e.message));
