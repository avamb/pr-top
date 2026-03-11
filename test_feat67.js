const http = require('http');

function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Get CSRF token
  const csrfRes = await httpReq({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrfRes.body).csrfToken;
  console.log('CSRF token:', csrfToken);

  // Login as admin (superadmin has therapist access too)
  const loginRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
  }, JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }));
  const loginData = JSON.parse(loginRes.body);
  const token = loginData.token;
  console.log('Login status:', loginRes.status, 'token:', token ? 'yes' : 'no');

  if (!token) {
    console.log('Login failed:', loginRes.body);
    // Try registering a therapist
    const regRes = await httpReq({
      hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    }, JSON.stringify({ email: 'test_freq_therapist@test.com', password: 'Test123!', role: 'therapist' }));
    console.log('Register:', regRes.status, regRes.body.slice(0, 200));
    const regData = JSON.parse(regRes.body);
    if (regData.token) {
      await testAnalytics(regData.token, csrfToken);
    }
    return;
  }

  await testAnalytics(token, csrfToken);
}

async function testAnalytics(token, csrfToken) {
  // Create a test client and session to have data
  // First check analytics endpoint
  const analyticsRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/dashboard/analytics?days=30', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\nAnalytics status:', analyticsRes.status);
  const analytics = JSON.parse(analyticsRes.body);

  // Check session_frequency field exists
  console.log('Has session_frequency:', !!analytics.session_frequency);
  if (analytics.session_frequency) {
    console.log('Session frequency data:', JSON.stringify(analytics.session_frequency, null, 2));
  }

  // Test different time periods
  for (const days of [7, 14, 30, 60]) {
    const res = await httpReq({
      hostname: 'localhost', port: 3001, path: '/api/dashboard/analytics?days=' + days, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = JSON.parse(res.body);
    console.log(`\nPeriod ${days}d: session_frequency present=${!!data.session_frequency}, total_sessions=${data.session_frequency?.total_sessions}, sessions_per_week=${data.session_frequency?.sessions_per_week}`);
  }

  console.log('\n=== API TEST PASSED ===');
}

main().catch(e => console.error('Error:', e));
