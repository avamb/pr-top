const http = require('http');

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const allHeaders = { 'Content-Type': 'application/json', ...headers };
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: allHeaders
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(chunks) });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getCSRF() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/csrf-token', (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        const data = JSON.parse(chunks);
        resolve(data.csrfToken);
      });
    }).on('error', reject);
  });
}

async function main() {
  const csrf = await getCSRF();
  console.log('Got CSRF token');
  const csrfHeaders = { 'X-CSRF-Token': csrf };

  const email = 'test_f126_' + Date.now() + '@example.com';
  const password = 'StrongPwd1';

  // Register a user first
  const reg = await request('POST', '/api/auth/register', { email, password, role: 'therapist' }, csrfHeaders);
  console.log('Register status:', reg.status);

  // Feature #126: Login with wrong password
  const wrongPwd = await request('POST', '/api/auth/login', { email, password: 'WrongPassword99' }, csrfHeaders);
  console.log('--- Feature #126: Wrong password ---');
  console.log('Status:', wrongPwd.status);
  console.log('Error:', wrongPwd.body.error);
  console.log('No token:', wrongPwd.body.token === undefined);
  console.log('Status is 401:', wrongPwd.status === 401);

  // Feature #127: Login with non-existent email
  const noUser = await request('POST', '/api/auth/login', { email: 'nonexistent_f127_' + Date.now() + '@example.com', password: 'SomePass1' }, csrfHeaders);
  console.log('--- Feature #127: Non-existent email ---');
  console.log('Status:', noUser.status);
  console.log('Error:', noUser.body.error);
  console.log('No token:', noUser.body.token === undefined);
  console.log('Status is 401:', noUser.status === 401);
  console.log('Same error (security):', wrongPwd.body.error === noUser.body.error);

  // Verify correct login still works
  const goodLogin = await request('POST', '/api/auth/login', { email, password }, csrfHeaders);
  console.log('--- Correct login ---');
  console.log('Status:', goodLogin.status);
  console.log('Has token:', !!goodLogin.body.token);
}

main().catch(console.error);
