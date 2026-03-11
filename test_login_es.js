const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3001, path }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function post(path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, ...headers }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Get CSRF token
  const csrfResp = await get('/api/csrf-token');
  const csrfToken = JSON.parse(csrfResp).csrfToken;
  console.log('CSRF:', csrfToken.substring(0, 16) + '...');

  // Login
  const loginResp = await post('/api/auth/login',
    { email: 'admin@psylink.app', password: 'Admin123!' },
    { 'X-CSRF-Token': csrfToken }
  );
  console.log('Login:', loginResp);
}

main().catch(console.error);
