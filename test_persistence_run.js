const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const step = process.argv[2];

  if (step === 'register') {
    // Register test user
    const reg = await request('POST', '/api/auth/register', {
      email: 'RESTART_TEST_12345@test.com',
      password: 'TestPass123!',
      role: 'therapist'
    });
    console.log('Register:', reg.status, JSON.stringify(reg.body));

    // Login to verify
    const login = await request('POST', '/api/auth/login', {
      email: 'RESTART_TEST_12345@test.com',
      password: 'TestPass123!'
    });
    console.log('Login:', login.status, JSON.stringify(login.body));
  }

  if (step === 'verify') {
    // Login after restart
    const login = await request('POST', '/api/auth/login', {
      email: 'RESTART_TEST_12345@test.com',
      password: 'TestPass123!'
    });
    console.log('Login after restart:', login.status, JSON.stringify(login.body));
    if (login.status === 200 && login.body.token) {
      console.log('PERSISTENCE TEST PASSED: User data survived restart');
    } else {
      console.log('PERSISTENCE TEST FAILED: User not found after restart');
      process.exit(1);
    }
  }

  if (step === 'cleanup') {
    // Try to clean up - login first to get token
    const login = await request('POST', '/api/auth/login', {
      email: 'RESTART_TEST_12345@test.com',
      password: 'TestPass123!'
    });
    console.log('Cleanup login:', login.status);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
