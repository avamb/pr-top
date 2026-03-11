const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const step = process.argv[2] || 'register';

  if (step === 'register') {
    // Step 1: Register user
    console.log('Registering test user...');
    const reg = await request('POST', '/api/auth/register', {
      email: 'RESTART_TEST_12345@test.com',
      password: 'TestPassword123',
      role: 'therapist'
    });
    console.log('Register status:', reg.status);
    console.log('Register response:', reg.body);

    if (reg.status === 201 || reg.status === 200) {
      console.log('REGISTER: SUCCESS');
    } else if (reg.status === 409 || reg.body.includes('exists')) {
      console.log('REGISTER: USER ALREADY EXISTS (OK for re-test)');
    } else {
      console.log('REGISTER: UNEXPECTED STATUS');
    }

    // Step 2: Login to verify
    console.log('\nLogging in...');
    const login = await request('POST', '/api/auth/login', {
      email: 'RESTART_TEST_12345@test.com',
      password: 'TestPassword123'
    });
    console.log('Login status:', login.status);
    console.log('Login response:', login.body);
  } else if (step === 'verify') {
    // Step 3: After restart, verify login still works
    console.log('Verifying persistence after restart...');
    const login = await request('POST', '/api/auth/login', {
      email: 'RESTART_TEST_12345@test.com',
      password: 'TestPassword123'
    });
    console.log('Login status:', login.status);
    console.log('Login response:', login.body);

    if (login.status === 200) {
      console.log('\nPERSISTENCE TEST: PASSED - Data survived restart!');
    } else {
      console.log('\nPERSISTENCE TEST: FAILED - Data lost after restart!');
    }
  } else if (step === 'health') {
    const health = await request('GET', '/api/health');
    console.log('Health status:', health.status);
    console.log('Health response:', health.body);
  }
}

main().catch(e => console.error('Error:', e.message));
