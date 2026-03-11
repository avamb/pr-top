const http = require('http');

function req(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const h = Object.assign({}, headers || {});
    let data = null;
    if (body) {
      data = JSON.stringify(body);
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = Buffer.byteLength(data);
    }
    const opts = { hostname: 'localhost', port: 3001, path, method, headers: h };
    const r = http.request(opts, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // 1. Get CSRF
  const csrf = await req('GET', '/api/csrf-token');
  const ct = csrf.body.csrfToken;

  // 2. Register with UTM
  const email = 'utm_' + Date.now() + '@test.com';
  const reg = await req('POST', '/api/auth/register', {
    email, password: 'Test123!', role: 'therapist',
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'launch'
  }, { 'x-csrf-token': ct });
  console.log('Register:', reg.status);
  if (reg.status !== 201) { console.log(JSON.stringify(reg.body)); return; }
  const token = reg.body.token;
  const userId = reg.body.user.id;

  // 3. Login as admin to query UTM
  const csrf2 = await req('GET', '/api/csrf-token');
  const admin = await req('POST', '/api/auth/login', {
    email: 'admin@psylink.app', password: 'Admin123!'
  }, { 'x-csrf-token': csrf2.body.csrfToken });
  console.log('Admin login:', admin.status);
  if (admin.status !== 200) { console.log(JSON.stringify(admin.body)); return; }
  const at = admin.body.token;

  // 4. Check therapist list for UTM fields
  const list = await req('GET', '/api/admin/therapists', null, { 'Authorization': 'Bearer ' + at });
  console.log('Therapists status:', list.status);
  console.log('Body type:', typeof list.body, Array.isArray(list.body));
  const therapists = list.body.therapists || list.body;
  console.log('Is array:', Array.isArray(therapists));
  if (Array.isArray(therapists) && therapists.length > 0) {
    console.log('Sample keys:', Object.keys(therapists[0]));
    const found = therapists.find(t => t.email === email);
    if (found) {
      console.log('utm_source:', found.utm_source);
      console.log('utm_medium:', found.utm_medium);
      console.log('utm_campaign:', found.utm_campaign);
    } else {
      console.log('User not in list. Checking first entry...');
      console.log(JSON.stringify(therapists[0]).substring(0, 300));
    }
  } else {
    console.log('Response:', JSON.stringify(list.body).substring(0, 500));
  }
}

main().catch(console.error);
