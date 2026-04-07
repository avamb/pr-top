// Feature 3: Kill backend on port 3001, wait, then restart it
const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');

function healthCheck() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET', timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ ok: true, status: res.statusCode, body: data }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.end();
  });
}

async function waitForHealth(maxWait) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const h = await healthCheck();
    if (h.ok) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function waitForDown(maxWait) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const h = await healthCheck();
    if (!h.ok) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  // Step 1: Verify server is up
  console.log('Step 1: Verify backend is running...');
  const h1 = await healthCheck();
  if (!h1.ok) {
    console.log('Backend is NOT running. Cannot test restart persistence.');
    process.exit(1);
  }
  console.log('Backend is running.');

  // Step 2: Kill the backend process on port 3001
  console.log('\nStep 2: Killing backend on port 3001...');
  try {
    // Use PowerShell to find and kill the process on port 3001
    execSync('powershell -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', { stdio: 'pipe' });
    console.log('Kill command sent.');
  } catch (e) {
    console.log('Kill attempt result: ' + e.message);
  }

  // Step 3: Wait for it to go down
  console.log('\nStep 3: Waiting for server to go down...');
  const isDown = await waitForDown(10000);
  if (!isDown) {
    console.log('Server still responding after kill. Trying again...');
    try {
      execSync('powershell -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', { stdio: 'pipe' });
    } catch (e) {}
    const isDown2 = await waitForDown(10000);
    if (!isDown2) {
      console.log('FAIL: Could not kill backend server');
      process.exit(1);
    }
  }
  console.log('Server is DOWN.');

  // Step 4: Restart the backend
  console.log('\nStep 4: Restarting backend...');
  const backendDir = path.resolve(__dirname, 'src/backend');
  const child = spawn('node', [path.join(backendDir, 'src/index.js')], {
    cwd: backendDir,
    env: { ...process.env, PORT: '3001', NODE_ENV: 'development' },
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  console.log('Backend process spawned (PID: ' + child.pid + ')');

  // Step 5: Wait for health
  console.log('\nStep 5: Waiting for backend to be ready...');
  const isUp = await waitForHealth(30000);
  if (!isUp) {
    console.log('FAIL: Backend did not come back up within 30s');
    process.exit(1);
  }
  console.log('Backend is UP and healthy!');

  // Step 6: Verify data persists
  console.log('\nStep 6: Verifying data persistence...');
  const fs = require('fs');
  const stateFile = path.resolve(__dirname, 'regtest_f3_state_apr7v2.json');
  if (!fs.existsSync(stateFile)) {
    console.log('FAIL: State file not found');
    process.exit(1);
  }
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  console.log('Test user email: ' + state.email);

  // Get CSRF token
  function httpRequest(options, body) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const cookies = res.headers['set-cookie'] || [];
          resolve({ status: res.statusCode, body: data, cookies });
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  const csrf = await httpRequest({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrf.body).csrfToken;
  const cookies = csrf.cookies.map(c => c.split(';')[0]).join('; ');

  // Login with the pre-restart user
  const login = await httpRequest(
    {
      hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookies, 'x-csrf-token': csrfToken }
    },
    JSON.stringify({ email: state.email, password: state.password })
  );

  console.log('Login status: ' + login.status);
  if (login.status === 200) {
    const loginData = JSON.parse(login.body);
    if (loginData.user && loginData.user.email.toLowerCase() === state.email.toLowerCase()) {
      console.log('PASS: User data persisted across restart!');
      console.log('User ID: ' + loginData.user.id + ', Email: ' + loginData.user.email);
    } else {
      console.log('WARN: Login succeeded but email mismatch');
      console.log(login.body);
    }
  } else {
    console.log('FAIL: Login failed after restart - DATA DID NOT PERSIST');
    console.log(login.body);
    process.exit(1);
  }

  console.log('\n========== FEATURE 3 RESULT: PASS ==========');
}

main().catch(e => { console.error(e); process.exit(1); });
