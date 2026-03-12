const http = require('http');

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    var opts = { hostname: 'localhost', port: 3001, path: path, method: method, headers: headers || {} };
    var req = http.request(opts, (res) => {
      var chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        var parsed = null;
        try { parsed = JSON.parse(chunks); } catch(e) { parsed = chunks; }
        // Extract cookies
        var cookies = {};
        var setCookies = res.headers['set-cookie'] || [];
        setCookies.forEach((c) => {
          var parts = c.split(';')[0].split('=');
          cookies[parts[0]] = parts.slice(1).join('=');
        });
        resolve({ status: res.statusCode, body: parsed, cookies: cookies });
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
  var csrfToken = csrfResp.body.csrfToken;
  var csrfCookie = csrfResp.cookies['_csrf'] || '';
  console.log('CSRF token:', csrfToken ? 'obtained' : 'MISSING');

  // Step 2: Register therapist
  var regHeaders = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    'Cookie': '_csrf=' + csrfCookie
  };
  var reg = await request('POST', '/api/auth/register', regHeaders, { email: 'test_f140_t3@test.com', password: 'TestPass1' });
  if (reg.status === 409) {
    reg = await request('POST', '/api/auth/login', regHeaders, { email: 'test_f140_t3@test.com', password: 'TestPass1' });
  }
  console.log('Auth status:', reg.status, 'role:', reg.body.user ? reg.body.user.role : 'unknown');
  var token = reg.body.token;

  if (!token) {
    console.log('ERROR: No token obtained');
    return;
  }

  // Step 3: Test admin endpoints with therapist token
  var authHeaders = { 'Authorization': 'Bearer ' + token };

  var r1 = await request('GET', '/api/admin/therapists', authHeaders);
  console.log('GET /api/admin/therapists:', r1.status, r1.status === 403 ? 'PASS' : 'FAIL');

  var r2 = await request('PUT', '/api/admin/settings', Object.assign({}, authHeaders, { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': '_csrf=' + csrfCookie }), { trial_duration_days: 30 });
  console.log('PUT /api/admin/settings:', r2.status, r2.status === 403 ? 'PASS' : 'FAIL');

  var r3 = await request('GET', '/api/admin/logs/audit', authHeaders);
  console.log('GET /api/admin/logs/audit:', r3.status, r3.status === 403 ? 'PASS' : 'FAIL');

  var r4 = await request('GET', '/api/admin/stats/users', authHeaders);
  console.log('GET /api/admin/stats/users:', r4.status, r4.status === 403 ? 'PASS' : 'FAIL');

  var r5 = await request('GET', '/api/admin/logs/system', authHeaders);
  console.log('GET /api/admin/logs/system:', r5.status, r5.status === 403 ? 'PASS' : 'FAIL');

  var r6 = await request('GET', '/api/admin/stats/subscriptions', authHeaders);
  console.log('GET /api/admin/stats/subscriptions:', r6.status, r6.status === 403 ? 'PASS' : 'FAIL');

  var r7 = await request('GET', '/api/admin/stats/utm', authHeaders);
  console.log('GET /api/admin/stats/utm:', r7.status, r7.status === 403 ? 'PASS' : 'FAIL');

  // Verify error message
  console.log('Error message:', r1.body.error);

  var allPass = [r1,r2,r3,r4,r5,r6,r7].every((r) => { return r.status === 403; });
  console.log('\nAll admin endpoints return 403 for therapist:', allPass ? 'PASS' : 'FAIL');
}
main().catch((e) => { console.error(e); });
