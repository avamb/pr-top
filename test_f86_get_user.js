// Get user ID for expired_ui_f86@test.com and expire trial
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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Login as the test user
  const csrfRes = await request('GET', '/api/csrf-token');
  const csrf = csrfRes.body.csrfToken;

  const loginRes = await request('POST', '/api/auth/login', {
    email: 'expired_ui_f86@test.com', password: 'TestPass123'
  }, { 'X-CSRF-Token': csrf });

  const token = loginRes.body.token;
  const meRes = await request('GET', '/api/auth/me', null, {
    'Authorization': 'Bearer ' + token
  });
  const userId = meRes.body.user?.id || meRes.body.id;
  console.log('User ID:', userId);

  // Expire the trial
  const csrf2Res = await request('GET', '/api/csrf-token');
  const csrf2 = csrf2Res.body.csrfToken;
  const expireRes = await request('POST', '/api/dev/expire-trial', {
    therapist_id: userId
  }, { 'X-CSRF-Token': csrf2 });
  console.log('Expire result:', JSON.stringify(expireRes.body));
}

run().catch(console.error);
