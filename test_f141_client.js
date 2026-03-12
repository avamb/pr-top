const http = require('http');

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    var opts = { hostname: '127.0.0.1', port: 3001, path: path, method: method, headers: headers || {} };
    var req = http.request(opts, (res) => {
      var chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        var parsed = null;
        try { parsed = JSON.parse(chunks); } catch(e) { parsed = { raw: chunks }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Get CSRF token
  var csrfResp = await request('GET', '/api/csrf-token', {});
  console.log('CSRF resp status:', csrfResp.status);
  var csrfToken = csrfResp.body.csrfToken;
  console.log('CSRF token:', csrfToken ? 'obtained' : 'MISSING');

  // Step 2: Register a client-role user via web API
  var regHeaders = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  };
  var reg = await request('POST', '/api/auth/register', regHeaders, {
    email: 'test_f141_client@test.com',
    password: 'TestPass1',
    role: 'client'
  });
  if (reg.status === 409) {
    reg = await request('POST', '/api/auth/login', regHeaders, {
      email: 'test_f141_client@test.com',
      password: 'TestPass1'
    });
  }
  console.log('Auth status:', reg.status, 'role:', reg.body.user ? reg.body.user.role : 'unknown');
  var token = reg.body.token;

  if (!token) {
    console.log('ERROR: No token obtained');
    console.log('Response:', JSON.stringify(reg.body));
    return;
  }

  var authHeaders = { 'Authorization': 'Bearer ' + token };

  // Step 3: Test therapist API endpoints with client token
  console.log('\n--- Testing client access to therapist endpoints ---');

  var r1 = await request('GET', '/api/dashboard/stats', authHeaders);
  console.log('GET /api/dashboard/stats:', r1.status, r1.status === 403 ? 'PASS' : 'FAIL');

  var r2 = await request('GET', '/api/clients', authHeaders);
  console.log('GET /api/clients:', r2.status, r2.status === 403 ? 'PASS' : 'FAIL');

  var r3 = await request('GET', '/api/search/stats', authHeaders);
  console.log('GET /api/search/stats:', r3.status, r3.status === 403 ? 'PASS' : 'FAIL');

  var r4 = await request('GET', '/api/admin/therapists', authHeaders);
  console.log('GET /api/admin/therapists:', r4.status, r4.status === 403 ? 'PASS' : 'FAIL');

  var r5 = await request('GET', '/api/invite-code', authHeaders);
  console.log('GET /api/invite-code:', r5.status);

  var r6 = await request('GET', '/api/settings/profile', authHeaders);
  console.log('GET /api/settings/profile:', r6.status);

  var r7 = await request('GET', '/api/exercises', authHeaders);
  console.log('GET /api/exercises:', r7.status);

  var r8 = await request('GET', '/api/notifications', authHeaders);
  console.log('GET /api/notifications:', r8.status);

  // Verify error messages
  console.log('\nDashboard error:', JSON.stringify(r1.body));
  console.log('Clients error:', JSON.stringify(r2.body));

  // Core therapist endpoints that MUST block client
  var blocked = [r1, r2, r3, r4];
  var allBlocked = blocked.every((r) => { return r.status === 403; });
  console.log('\nCore therapist/admin endpoints block client:', allBlocked ? 'ALL PASS' : 'SOME FAIL');
}
main().catch((e) => { console.error(e); });
