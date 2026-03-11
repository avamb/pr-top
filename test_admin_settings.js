const http = require('http');

function request(method, path, token, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) Object.assign(headers, extraHeaders);
    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Get CSRF token first
  const csrfRes = await request('GET', '/api/csrf-token');
  const csrfToken = csrfRes.body.csrfToken;
  console.log('CSRF token:', csrfToken ? 'OK' : 'FAIL');

  // Login as superadmin
  const login = await request('POST', '/api/auth/login', null,
    { email: 'admin@psylink.app', password: 'Admin123!' },
    { 'X-CSRF-Token': csrfToken }
  );
  console.log('Login:', login.status === 200 ? 'OK' : 'FAIL', login.status);
  const token = login.body.token;

  if (!token) {
    console.log('Login failed:', JSON.stringify(login.body));
    return;
  }

  // GET settings
  const getRes = await request('GET', '/api/admin/settings', token);
  console.log('\nGET /api/admin/settings:', getRes.status);
  console.log('Settings keys:', Object.keys(getRes.body.settings || {}));
  console.log('trial_duration_days:', getRes.body.settings?.trial_duration_days);

  // PUT settings - update trial duration
  const putRes = await request('PUT', '/api/admin/settings', token, {
    settings: { trial_duration_days: '21', trial_client_limit: '5' }
  });
  console.log('\nPUT /api/admin/settings:', putRes.status);
  console.log('Message:', putRes.body.message);
  console.log('Updated:', JSON.stringify(putRes.body.updated));

  // GET again to verify persistence
  const getRes2 = await request('GET', '/api/admin/settings', token);
  console.log('\nVerify after update:');
  console.log('trial_duration_days:', getRes2.body.settings?.trial_duration_days?.value);
  console.log('trial_client_limit:', getRes2.body.settings?.trial_client_limit?.value);

  // Test validation - invalid value
  const badRes = await request('PUT', '/api/admin/settings', token, {
    settings: { trial_duration_days: '0' }
  });
  console.log('\nBad value test (0 days):', badRes.status);
  console.log('Errors:', JSON.stringify(badRes.body.errors));

  // Test without auth
  const noAuthRes = await request('GET', '/api/admin/settings', null);
  console.log('\nNo auth test:', noAuthRes.status, '(should be 401)');

  // Test with 21-day trial on new registration
  const csrfRes2 = await request('GET', '/api/csrf-token');
  const csrfToken2 = csrfRes2.body.csrfToken;
  const regRes = await request('POST', '/api/auth/register', null, {
    email: 'settings_test_' + Date.now() + '@test.com',
    password: 'Test123!',
    role: 'therapist'
  }, { 'X-CSRF-Token': csrfToken2 });
  console.log('\nRegistration with 21-day trial:', regRes.status);

  if (regRes.body.token) {
    const subRes = await request('GET', '/api/subscription', regRes.body.token);
    console.log('Subscription plan:', subRes.body.subscription?.plan);
    console.log('Trial ends at:', subRes.body.subscription?.trial_ends_at);

    // Check trial is about 21 days from now
    if (subRes.body.subscription?.trial_ends_at) {
      const trialEnd = new Date(subRes.body.subscription.trial_ends_at);
      const now = new Date();
      const daysDiff = Math.round((trialEnd - now) / (1000 * 60 * 60 * 24));
      console.log('Days until trial end:', daysDiff, '(should be ~21)');
    }
  }

  // Restore original values
  await request('PUT', '/api/admin/settings', token, {
    settings: { trial_duration_days: '14', trial_client_limit: '3' }
  });
  console.log('\nRestored original values');

  // Verify audit log was created
  const auditRes = await request('GET', '/api/admin/logs/audit?action=update_platform_settings', token);
  console.log('\nAudit log entries for settings updates:', auditRes.body.total);

  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch(console.error);
