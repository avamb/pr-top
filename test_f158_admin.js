const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const data = body ? JSON.stringify(body) : '';
    if (body) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ hostname: '127.0.0.1', port: 3001, path, method, headers }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

async function getCSRF() {
  const r = await request('GET', '/api/csrf-token');
  return r.body.csrfToken;
}

async function register(email, password) {
  const csrf = await getCSRF();
  const headers = { 'Content-Type': 'application/json', 'x-csrf-token': csrf };
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/api/auth/register', method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function login(email, password) {
  const csrf = await getCSRF();
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, 'Content-Length': Buffer.byteLength(data) } }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function main() {
  // Register therapist (may already exist)
  const reg = await register('therapist_f158b@test.com', 'StrongPwd1');
  console.log('Therapist register:', reg.status, reg.body.user?.role || reg.body.error);
  let therapistToken = reg.body.token;
  if (!therapistToken) {
    const tLogin = await login('therapist_f158b@test.com', 'StrongPwd1');
    therapistToken = tLogin.body.token;
    console.log('Therapist login:', tLogin.status, tLogin.body.user?.role);
  }

  // Test therapist access to admin endpoints
  const adminEndpoints = [
    '/api/admin/therapists',
    '/api/admin/settings',
    '/api/admin/logs/audit',
    '/api/admin/stats/users',
  ];

  for (const ep of adminEndpoints) {
    const r = await request('GET', ep, null, therapistToken);
    console.log('Therapist GET ' + ep + ':', r.status, r.status === 403 ? 'BLOCKED (PASS)' : 'FAIL');
  }

  // Try superadmin login
  const saLogin = await login('admin@psylink.app', 'Admin123!');
  console.log('Superadmin login:', saLogin.status, saLogin.body.user?.role || saLogin.body.error);

  if (saLogin.status === 200) {
    const saToken = saLogin.body.token;
    for (const ep of adminEndpoints) {
      const r = await request('GET', ep, null, saToken);
      console.log('Superadmin GET ' + ep + ':', r.status, r.status === 200 ? 'ALLOWED (PASS)' : 'CHECK');
    }
  } else {
    console.log('Need to find superadmin credentials - checking DB...');
  }
}

main().catch(console.error);
