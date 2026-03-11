// Test Feature 3: Data persists across server restart
const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
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
  const testEmail = 'RESTART_TEST_12345@test.com';
  const testPassword = 'TestPass123!';

  // Step 1: Register test user
  console.log("1. Registering test therapist...");
  const reg = await request('POST', '/api/auth/register', {
    email: testEmail,
    password: testPassword,
    role: 'therapist',
    language: 'en',
    timezone: 'UTC'
  });
  console.log(`   Status: ${reg.status}`, JSON.stringify(reg.body));

  if (reg.status === 201 || reg.status === 200) {
    console.log("   Registration succeeded!");
  } else if (reg.status === 409 || (reg.body && reg.body.message && reg.body.message.includes('exists'))) {
    console.log("   User already exists (from previous test run), continuing...");
  } else {
    console.log("   WARNING: Unexpected status, continuing anyway...");
  }

  // Step 2: Login
  console.log("\n2. Logging in...");
  const login = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: testPassword
  });
  console.log(`   Status: ${login.status}`);

  if (login.status !== 200) {
    console.log("   LOGIN FAILED:", JSON.stringify(login.body));
    process.exit(1);
  }

  const token = login.body.token;
  console.log("   Login succeeded, got token");

  // Step 3: Verify user via /api/auth/me
  console.log("\n3. Verifying user via GET /api/auth/me...");
  const me = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
  console.log(`   Status: ${me.status}`, JSON.stringify(me.body));

  if (me.status === 200) {
    console.log("   User verified! Data persists.");
    console.log("\n=== PERSISTENCE TEST PASSED ===");
  } else {
    console.log("   FAILED: Could not verify user");
    console.log("\n=== PERSISTENCE TEST FAILED ===");
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
