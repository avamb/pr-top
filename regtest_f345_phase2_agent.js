const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function waitForHealth(maxWait) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      req({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' })
        .then(r => {
          if (r.status === 200) resolve(r);
          else if (Date.now() - start > maxWait) reject(new Error('Health timeout'));
          else setTimeout(check, 1000);
        })
        .catch(() => {
          if (Date.now() - start > maxWait) reject(new Error('Health timeout'));
          else setTimeout(check, 1000);
        });
    };
    check();
  });
}

async function run() {
  // Load state from phase 1
  const state = JSON.parse(fs.readFileSync('regtest_f345_agent_state.json', 'utf8'));
  console.log('Testing persistence for:', state.testEmail);

  // Step 1: Kill backend
  console.log('Killing backend on port 3001...');
  try {
    // Find and kill the process on port 3001
    const result = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      console.log('Killing PID:', pid);
      try { execSync('taskkill /F /PID ' + pid); } catch(e) { console.log('Kill warning:', e.message); }
    }
  } catch(e) {
    console.log('No process found on 3001 or kill failed:', e.message);
  }

  // Step 2: Verify server is down
  console.log('Verifying server is stopped...');
  try {
    await req({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
    // Wait a moment and retry
    await new Promise(r => setTimeout(r, 2000));
    try {
      await req({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
      console.log('WARNING: Server still responding after kill');
    } catch(e) {
      console.log('Server confirmed stopped');
    }
  } catch(e) {
    console.log('Server confirmed stopped');
  }

  // Step 3: Restart backend using init.sh
  console.log('Restarting backend...');
  try {
    // Start backend in background
    const { spawn } = require('child_process');
    const child = spawn('node', ['src/backend/src/index.js'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PORT: '3001' }
    });
    child.unref();
    console.log('Backend spawn initiated');
  } catch(e) {
    console.log('Spawn error:', e.message);
  }

  // Step 4: Wait for health
  console.log('Waiting for server to be ready...');
  try {
    const health = await waitForHealth(30000);
    console.log('Server is back up:', health.body);
  } catch(e) {
    console.log('CRITICAL: Server did not come back up:', e.message);
    process.exit(1);
  }

  // Step 5: Login with the same credentials
  console.log('Attempting login with persisted user...');
  const csrf = await req({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrf.body).csrfToken;
  const cookies = (csrf.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

  const login = await req({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies, 'x-csrf-token': csrfToken }
  }, { email: state.testEmail, password: state.password });

  console.log('Login status:', login.status);
  console.log('Login body:', login.body);

  if (login.status === 200) {
    const loginData = JSON.parse(login.body);
    console.log('FEATURE3_PASS: Data persisted across server restart. User:', loginData.user?.email);
  } else {
    console.log('FEATURE3_FAIL: Login failed after restart - data did NOT persist!');
  }

  // Step 6: Feature 5 - Check that real DB queries happen
  // Verify health endpoint shows database connected with real table count
  const health2 = await req({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  const healthData = JSON.parse(health2.body);
  console.log('\n--- Feature 5: Real Database Check ---');
  console.log('Health response:', JSON.stringify(healthData, null, 2));

  if (healthData.database === 'connected' && healthData.tableCount > 0) {
    console.log('FEATURE5_PASS: Database is connected with', healthData.tableCount, 'tables');
  } else {
    console.log('FEATURE5_FAIL: Database not properly connected');
  }

  // Additional Feature 5 check: verify the register created a real DB record
  const loginCookies = (login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  const allCookies = cookies + '; ' + loginCookies;

  const me = await req({
    hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
    headers: { 'Cookie': allCookies, 'x-csrf-token': csrfToken }
  });
  console.log('Me after restart status:', me.status);
  console.log('Me after restart body:', me.body);

  if (me.status === 200) {
    console.log('FEATURE5_PASS: API returns real DB data after restart');
  } else {
    console.log('FEATURE5_FAIL: API failed to return user data');
  }
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
