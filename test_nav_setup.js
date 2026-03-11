const http = require('http');

function fetch(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get CSRF token
  const csrf = await fetch('GET', '/api/csrf-token');
  console.log('CSRF:', csrf.csrfToken);

  // Register therapist
  const reg = await fetch('POST', '/api/auth/register', {
    email: 'nav_test_102@test.com',
    password: 'Test1234',
    name: 'Nav Tester 102'
  }, { 'x-csrf-token': csrf.csrfToken });
  console.log('Register:', JSON.stringify(reg));

  // Login therapist
  const login = await fetch('POST', '/api/auth/login', {
    email: 'nav_test_102@test.com',
    password: 'Test1234'
  }, { 'x-csrf-token': csrf.csrfToken });
  console.log('Login:', JSON.stringify(login));

  // Register superadmin
  const reg2 = await fetch('POST', '/api/auth/register', {
    email: 'nav_admin_103@test.com',
    password: 'Test1234',
    name: 'Admin Tester 103',
    role: 'superadmin'
  }, { 'x-csrf-token': csrf.csrfToken });
  console.log('Register admin:', JSON.stringify(reg2));

  // Login superadmin
  const login2 = await fetch('POST', '/api/auth/login', {
    email: 'nav_admin_103@test.com',
    password: 'Test1234'
  }, { 'x-csrf-token': csrf.csrfToken });
  console.log('Login admin:', JSON.stringify(login2));
}

main().catch(console.error);
