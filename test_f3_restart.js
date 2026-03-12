const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ body: d, headers: res.headers }));
    }).on('error', reject);
  });
}

function post(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const step = process.argv[2];

  if (step === 'register') {
    const csrf = await get('http://localhost:3001/api/csrf-token');
    const token = JSON.parse(csrf.body).csrfToken;
    const reg = await post('http://localhost:3001/api/auth/register',
      { email: 'RESTART_TEST_F3_99887@test.com', password: 'TestPass123', name: 'Restart Test', role: 'therapist' },
      { 'X-CSRF-Token': token });
    console.log('Register status:', reg.status);
    console.log('Register body:', reg.body);
  } else if (step === 'login') {
    const csrf = await get('http://localhost:3001/api/csrf-token');
    const token = JSON.parse(csrf.body).csrfToken;
    const login = await post('http://localhost:3001/api/auth/login',
      { email: 'RESTART_TEST_F3_99887@test.com', password: 'TestPass123' },
      { 'X-CSRF-Token': token });
    console.log('Login status:', login.status);
    console.log('Login body:', login.body);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
