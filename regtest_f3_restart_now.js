const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

const req = (method, path, body, cookies) => {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path, method, headers: { 'Content-Type': 'application/json' }, timeout: 5000 };
    if (cookies) opts.headers['Cookie'] = cookies;
    if (body && body.csrf) opts.headers['X-CSRF-Token'] = body.csrf;
    const r = http.request(opts, res => {
      let data = '';
      const sc = res.headers['set-cookie'] || [];
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data || '{}'), cookies: sc });
        } catch(e) {
          resolve({ status: res.statusCode, data: { raw: data }, cookies: sc });
        }
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (body && body.payload) r.write(JSON.stringify(body.payload));
    r.end();
  });
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const waitForServer = async (maxWait) => {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const h = await req('GET', '/api/health');
      if (h.status === 200) return true;
    } catch(e) { /* not ready */ }
    await sleep(1000);
  }
  return false;
};

const main = async () => {
  // Load saved state
  const state = JSON.parse(fs.readFileSync('/tmp/f3_restart_state.json', 'utf8'));
  console.log('=== Feature 3: Restart Persistence Test ===\n');
  console.log('Test email:', state.email);

  // Step 1: Kill all node processes on port 3001
  console.log('\n1. Killing backend server...');
  try {
    // Find and kill process on port 3001 (Windows compatible)
    const result = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const pids = new Set();
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    });
    pids.forEach(pid => {
      try {
        execSync('taskkill /F /PID ' + pid, { encoding: 'utf8' });
        console.log('   Killed PID:', pid);
      } catch(e) { console.log('   Could not kill PID:', pid); }
    });
  } catch(e) {
    console.log('   No process found on port 3001 or error:', e.message);
  }

  // Step 2: Verify server is stopped
  console.log('\n2. Verifying server is stopped...');
  await sleep(2000);
  try {
    await req('GET', '/api/health');
    console.log('   WARNING: Server still responding!');
  } catch(e) {
    console.log('   Server confirmed stopped');
  }

  // Step 3: Restart the server
  console.log('\n3. Restarting backend server...');
  const { spawn } = require('child_process');
  const child = spawn('node', ['src/index.js'], {
    cwd: 'C:/Projects/dev-psy-bot/src/backend',
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, NODE_ENV: 'development', PORT: '3001' }
  });
  child.unref();
  console.log('   Server process spawned');

  // Step 4: Wait for server to be ready
  console.log('\n4. Waiting for server to be ready...');
  const ready = await waitForServer(30000);
  if (!ready) {
    console.log('   CRITICAL FAILURE: Server did not start within 30s');
    process.exit(1);
  }
  console.log('   Server is ready!');

  // Step 5: Get new CSRF token
  const csrf = await req('GET', '/api/csrf-token');
  const token = csrf.data.csrfToken;
  const cookieStr = csrf.cookies.map(c => c.split(';')[0]).join('; ');

  // Step 6: Login with the test user
  console.log('\n5. Logging in with test user after restart...');
  const login = await req('POST', '/api/auth/login', {
    csrf: token,
    payload: { email: state.email, password: 'TestPass123!' }
  }, cookieStr);
  console.log('   Login status:', login.status);

  if (login.status === 200) {
    console.log('   LOGIN SUCCESS - Data persisted across restart!');
    const loginCookies = [...csrf.cookies, ...(login.cookies || [])].map(c => c.split(';')[0]).join('; ');

    // Verify user data
    const me = await req('GET', '/api/auth/me', null, loginCookies);
    console.log('   Auth/me status:', me.status);
    if (me.data && me.data.user) {
      console.log('   User email:', me.data.user.email);
    }
    console.log('\n=== FEATURE 3: PASS ===');
  } else {
    console.log('   LOGIN FAILED:', JSON.stringify(login.data));
    console.log('\n=== FEATURE 3: FAIL - Data did not persist! ===');
  }

  // Also verify Feature 5 - health check shows DB
  const health = await req('GET', '/api/health');
  console.log('\n=== Feature 5: Post-restart DB Check ===');
  console.log('   Database:', health.data.database);
  console.log('   Tables:', health.data.tableCount);
  if (health.data.database === 'connected' && health.data.tableCount >= 10) {
    console.log('=== FEATURE 5: PASS ===');
  } else {
    console.log('=== FEATURE 5: FAIL ===');
  }
};

main().catch(e => console.error('Error:', e.message));
