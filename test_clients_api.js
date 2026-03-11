const http = require('http');

function request(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 3001, path, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Login
  const loginRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ email: 'therapist_test62@test.com', password: 'Test1234' }));
    req.end();
  });

  console.log('Login:', loginRes.message);
  const token = loginRes.token;

  // Get clients
  const clients = await request('/api/clients', token);
  console.log('Total clients:', clients.total);
  if (clients.clients.length > 0) {
    const c = clients.clients[0];
    console.log('First client keys:', Object.keys(c));
    console.log('First client last_activity:', c.last_activity);
  }
}

main().catch(e => console.error(e));
