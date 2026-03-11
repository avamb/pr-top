const http = require('http');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // 1. Get CSRF token
  const csrfRes = await httpGet('http://localhost:3001/api/csrf-token');
  const csrf = JSON.parse(csrfRes.body).csrfToken;
  console.log('CSRF token obtained');

  // 2. Register with UTM params
  const regBody = JSON.stringify({
    email: 'utm_test_f94@test.com',
    password: 'Test123!',
    role: 'therapist',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'launch'
  });

  const regRes = await httpPost('http://localhost:3001/api/auth/register', regBody, {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf
  });
  console.log('Register status:', regRes.status);
  const regData = JSON.parse(regRes.body);
  console.log('Register response:', JSON.stringify(regData, null, 2));

  if (regRes.status === 409) {
    console.log('User already exists - checking DB directly');
  }

  // 3. Login to get token if user exists
  let token = regData.token;
  if (!token) {
    const loginRes = await httpPost('http://localhost:3001/api/auth/login', JSON.stringify({
      email: 'utm_test_f94@test.com',
      password: 'Test123!'
    }), {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf
    });
    const loginData = JSON.parse(loginRes.body);
    token = loginData.token;
  }

  // 4. Check user record via /me endpoint
  const meRes = await httpGet('http://localhost:3001/api/auth/me');
  console.log('Me endpoint (no auth):', meRes.status);

  // 5. Check DB directly for UTM fields
  // We'll use the admin endpoint or query DB
  console.log('\n--- Checking UTM in database ---');
  // Use admin API to check
  const adminLoginRes = await httpPost('http://localhost:3001/api/auth/login', JSON.stringify({
    email: 'admin@psylink.app',
    password: 'Admin123!'
  }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf
  });
  const adminData = JSON.parse(adminLoginRes.body);
  console.log('Admin login:', adminLoginRes.status);

  if (adminData.token) {
    // Check therapists list for UTM data
    const therapistsRes = await new Promise((resolve, reject) => {
      http.get('http://localhost:3001/api/admin/therapists', {
        headers: { 'Authorization': 'Bearer ' + adminData.token }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }).on('error', reject);
    });

    const therapists = JSON.parse(therapistsRes.body);
    const utmUser = (therapists.therapists || therapists).find(t => t.email === 'utm_test_f94@test.com');
    if (utmUser) {
      console.log('Found UTM user in DB:');
      console.log('  utm_source:', utmUser.utm_source);
      console.log('  utm_medium:', utmUser.utm_medium);
      console.log('  utm_campaign:', utmUser.utm_campaign);

      const pass = utmUser.utm_source === 'google' && utmUser.utm_medium === 'cpc' && utmUser.utm_campaign === 'launch';
      console.log('\nUTM VERIFICATION:', pass ? 'PASS' : 'FAIL');
    } else {
      console.log('UTM user not found in therapists list');
    }
  }
}

main().catch(console.error);
