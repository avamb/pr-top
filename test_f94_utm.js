const http = require('http');

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path, method, headers: headers || {} };
    const req = http.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      req.setHeader('Content-Type', 'application/json');
      req.write(data);
    }
    req.end();
  });
}

async function main() {
  // Get CSRF token
  const csrf = await request('GET', '/api/csrf-token');
  const csrfToken = csrf.body.csrfToken;

  // Register with UTM params
  const email = 'utm_test_' + Date.now() + '@test.com';
  const reg = await request('POST', '/api/auth/register', {
    email,
    password: 'Test123!',
    role: 'therapist',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'launch'
  }, { 'x-csrf-token': csrfToken, 'Content-Type': 'application/json' });

  console.log('Register:', reg.status);
  if (reg.status !== 201) {
    console.log('Error:', JSON.stringify(reg.body));
    return;
  }

  const userId = reg.body.user.id;
  const token = reg.body.token;
  console.log('User ID:', userId);

  // Login as admin to check user record
  const csrf2 = await request('GET', '/api/csrf-token');
  const adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@psylink.app',
    password: 'Admin123!'
  }, { 'x-csrf-token': csrf2.body.csrfToken, 'Content-Type': 'application/json' });

  if (adminLogin.status !== 200) {
    console.log('Admin login failed:', adminLogin.status);
    // Try checking via direct DB query through an admin endpoint
    // Let's check if there's an endpoint that returns user details with UTM
  }

  const adminToken = adminLogin.body.token;

  // Check admin stats for UTM data
  const stats = await request('GET', '/api/admin/stats/users', null, {
    'Authorization': 'Bearer ' + adminToken
  });
  console.log('Admin stats (utm section):', JSON.stringify(stats.body).includes('utm') ? 'has UTM data' : 'no UTM data');

  // Check therapist list
  const therapists = await request('GET', '/api/admin/therapists', null, {
    'Authorization': 'Bearer ' + adminToken
  });

  if (therapists.body && Array.isArray(therapists.body)) {
    const user = therapists.body.find(t => t.email === email);
    if (user) {
      console.log('\n=== UTM VERIFICATION ===');
      console.log('User found:', user.email);
      console.log('utm_source:', user.utm_source);
      console.log('utm_medium:', user.utm_medium);
      console.log('utm_campaign:', user.utm_campaign);

      let allPass = true;
      if (user.utm_source === 'google') {
        console.log('PASS: utm_source = google');
      } else {
        console.log('FAIL: utm_source =', user.utm_source, '(expected google)');
        allPass = false;
      }
      if (user.utm_medium === 'cpc') {
        console.log('PASS: utm_medium = cpc');
      } else {
        console.log('FAIL: utm_medium =', user.utm_medium, '(expected cpc)');
        allPass = false;
      }
      if (user.utm_campaign === 'launch') {
        console.log('PASS: utm_campaign = launch');
      } else {
        console.log('FAIL: utm_campaign =', user.utm_campaign, '(expected launch)');
        allPass = false;
      }

      console.log('\n=== OVERALL: ' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED') + ' ===');
    } else {
      console.log('User not found in therapist list');
      console.log('Checking all therapists for UTM fields...');
      const sample = therapists.body[0];
      console.log('Sample therapist keys:', Object.keys(sample));
      // UTM fields might not be returned by the admin endpoint
      console.log('NOTE: Admin endpoint may not return UTM fields. Need to check directly.');
    }
  }
}

main().catch(console.error);
