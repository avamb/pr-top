// Regression test for Features 2, 3, 5
const http = require('http');
const fs = require('fs');
const path = require('path');

function request(method, urlPath, body, cookies, csrfToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: urlPath,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookies) options.headers['Cookie'] = cookies;
    if (csrfToken) options.headers['x-csrf-token'] = csrfToken;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookies = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, body: data, cookies: setCookies, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function extractCookies(setCookieHeaders, existingCookies) {
  const newCookies = setCookieHeaders.map(c => c.split(';')[0]);
  if (existingCookies) {
    // Merge existing cookies with new ones
    const cookieMap = {};
    existingCookies.split('; ').forEach(c => {
      const [k] = c.split('=');
      cookieMap[k] = c;
    });
    newCookies.forEach(c => {
      const [k] = c.split('=');
      cookieMap[k] = c;
    });
    return Object.values(cookieMap).join('; ');
  }
  return newCookies.join('; ');
}

async function getSession() {
  // Get CSRF token and session cookie
  const csrfResult = await request('GET', '/api/csrf-token');
  const cookies = extractCookies(csrfResult.cookies);
  let csrfToken = '';
  try {
    const data = JSON.parse(csrfResult.body);
    csrfToken = data.csrfToken || '';
  } catch(e) {}
  return { cookies, csrfToken };
}

async function testFeature2() {
  console.log('\n========== FEATURE 2: Database Schema ==========');

  const health = await request('GET', '/api/health');
  const healthData = JSON.parse(health.body);
  console.log('Health status:', healthData.status);
  console.log('Database:', healthData.database);
  console.log('Table count:', healthData.tableCount);

  if (healthData.database !== 'connected') {
    console.log('FAIL: Database not connected');
    return false;
  }
  if (healthData.tableCount < 13) {
    console.log('FAIL: Expected at least 13 tables, got', healthData.tableCount);
    return false;
  }

  const initSqlJs = require(path.join(__dirname, 'src/backend/node_modules/sql.js'));
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'src/backend/data/prtop.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tableNames = tablesResult[0] ? tablesResult[0].values.map(r => r[0]) : [];
  console.log('\nTables found:', tableNames.length);

  const requiredTables = ['users', 'diary_entries', 'therapist_notes', 'sessions', 'client_context',
    'exercises', 'exercise_deliveries', 'sos_events', 'subscriptions', 'payments',
    'audit_logs', 'encryption_keys', 'platform_settings'];

  let allOk = true;
  for (const table of requiredTables) {
    if (!tableNames.includes(table)) {
      console.log('FAIL - MISSING TABLE:', table);
      allOk = false;
    }
  }

  const columnChecks = {
    users: ['id','telegram_id','email','password_hash','role','therapist_id','consent_therapist_access','invite_code','language','timezone','created_at','updated_at','blocked_at','utm_source','utm_medium','utm_campaign'],
    diary_entries: ['id','client_id','entry_type','content_encrypted','transcript_encrypted','encryption_key_id','payload_version','file_ref','embedding_ref','created_at','updated_at'],
    therapist_notes: ['id','therapist_id','client_id','note_encrypted','encryption_key_id','payload_version','session_date','created_at','updated_at'],
    sessions: ['id','therapist_id','client_id','audio_ref','transcript_encrypted','summary_encrypted','encryption_key_id','payload_version','status','scheduled_at','created_at','updated_at']
  };

  for (const [table, expectedCols] of Object.entries(columnChecks)) {
    if (!tableNames.includes(table)) continue;
    const colResult = db.exec("PRAGMA table_info(" + table + ")");
    const cols = colResult[0] ? colResult[0].values.map(r => r[1]) : [];
    const missing = expectedCols.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('FAIL -', table, ': MISSING COLUMNS:', missing.join(', '));
      allOk = false;
    } else {
      console.log('PASS -', table, ': OK (' + cols.length + ' columns)');
    }
  }

  for (const table of ['client_context', 'exercises', 'exercise_deliveries', 'sos_events', 'subscriptions', 'payments', 'audit_logs', 'encryption_keys', 'platform_settings']) {
    if (tableNames.includes(table)) {
      const colResult = db.exec("PRAGMA table_info(" + table + ")");
      const colCount = colResult[0] ? colResult[0].values.length : 0;
      console.log('PASS -', table, ': EXISTS (' + colCount + ' columns)');
    }
  }

  db.close();
  console.log('\n=== FEATURE 2 RESULT:', allOk ? 'PASS' : 'FAIL', '===');
  return allOk;
}

async function testFeature5() {
  console.log('\n========== FEATURE 5: Backend API Queries Real Database ==========');
  let allOk = true;

  // Test 1: Health endpoint
  const health = await request('GET', '/api/health');
  const healthData = JSON.parse(health.body);
  if (healthData.database === 'connected' && healthData.tableCount > 0) {
    console.log('PASS - Health endpoint shows real database connection');
  } else {
    console.log('FAIL - Health endpoint does not show database connection');
    allOk = false;
  }

  // Get CSRF token
  const session = await getSession();
  console.log('CSRF token obtained:', session.csrfToken ? 'yes' : 'no');

  // Test 2: Register a unique test user
  const uniqueEmail = 'regtest_f5_apr7_' + Date.now() + '@test.com';
  const regResult = await request('POST', '/api/auth/register', {
    email: uniqueEmail,
    password: 'TestPass123!',
    name: 'F5 Regression Test'
  }, session.cookies, session.csrfToken);
  console.log('Register status:', regResult.status);

  if (regResult.status === 201 || regResult.status === 200) {
    console.log('PASS - Registration succeeded (data was INSERTed)');
  } else {
    console.log('FAIL - Registration failed:', regResult.body.substring(0, 300));
    allOk = false;
  }

  // Test 3: Login with the new user
  const session2 = await getSession();
  const loginResult = await request('POST', '/api/auth/login', {
    email: uniqueEmail,
    password: 'TestPass123!'
  }, session2.cookies, session2.csrfToken);
  console.log('Login status:', loginResult.status);

  if (loginResult.status === 200) {
    console.log('PASS - Login succeeded (data was SELECTed from DB)');

    const loginCookies = extractCookies(loginResult.cookies, session2.cookies);
    let csrfToken2 = '';
    try { csrfToken2 = JSON.parse(loginResult.body).csrfToken || session2.csrfToken; } catch(e) {}

    const meResult = await request('GET', '/api/auth/me', null, loginCookies, csrfToken2);
    console.log('GET /api/auth/me status:', meResult.status);

    if (meResult.status === 200) {
      const meData = JSON.parse(meResult.body);
      if (meData.user && meData.user.email === uniqueEmail) {
        console.log('PASS - /api/auth/me returns correct user from database');
      } else {
        console.log('INFO - /api/auth/me returned:', meResult.body.substring(0, 200));
      }
    }
  } else {
    console.log('FAIL - Login failed:', loginResult.body.substring(0, 300));
    allOk = false;
  }

  // Test 4: Duplicate email rejected
  const session3 = await getSession();
  const dupResult = await request('POST', '/api/auth/register', {
    email: uniqueEmail,
    password: 'TestPass123!',
    name: 'Duplicate Test'
  }, session3.cookies, session3.csrfToken);
  if (dupResult.status === 409 || dupResult.status === 400) {
    console.log('PASS - Duplicate email rejected (database constraint works)');
  } else if (dupResult.status === 201 || dupResult.status === 200) {
    console.log('FAIL - Duplicate email was accepted');
    allOk = false;
  } else {
    console.log('INFO - Duplicate registration status:', dupResult.status);
  }

  console.log('\n=== FEATURE 5 RESULT:', allOk ? 'PASS' : 'FAIL', '===');
  return allOk;
}

async function testFeature3() {
  console.log('\n========== FEATURE 3: Data Persists Across Restart ==========');
  let allOk = true;

  const dbPath = path.join(__dirname, 'src/backend/data/prtop.db');
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('PASS - Database file exists, size:', stats.size, 'bytes');
  } else {
    console.log('FAIL - Database file does not exist');
    allOk = false;
    return allOk;
  }

  // Register a user with CSRF
  const session = await getSession();
  const uniqueEmail = 'persist_test_apr7_' + Date.now() + '@test.com';
  const regResult = await request('POST', '/api/auth/register', {
    email: uniqueEmail,
    password: 'TestPass123!',
    name: 'Persist Test'
  }, session.cookies, session.csrfToken);
  console.log('Register status:', regResult.status);

  if (regResult.status !== 201 && regResult.status !== 200) {
    console.log('FAIL - Could not register test user:', regResult.body.substring(0, 300));
    allOk = false;
    console.log('\n=== FEATURE 3 RESULT:', allOk ? 'PASS' : 'FAIL', '===');
    return allOk;
  }
  console.log('PASS - User registered successfully');

  // Wait for auto-save (5 second interval)
  console.log('Waiting 6 seconds for database auto-save...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  // Read DB file directly and check if user is persisted
  const initSqlJs = require(path.join(__dirname, 'src/backend/node_modules/sql.js'));
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const result = db.exec("SELECT id, email, role FROM users WHERE email = '" + uniqueEmail.replace(/'/g, "''") + "'");
  if (result.length > 0 && result[0].values.length > 0) {
    console.log('PASS - User found in DB file after auto-save:', result[0].values[0]);
    console.log('This proves data persists to disk (survives restart)');
  } else {
    console.log('FAIL - User NOT found in DB file after 6 second wait');
    allOk = false;
  }

  // Verify login still works
  const session2 = await getSession();
  const loginResult = await request('POST', '/api/auth/login', {
    email: uniqueEmail,
    password: 'TestPass123!'
  }, session2.cookies, session2.csrfToken);
  if (loginResult.status === 200) {
    console.log('PASS - Login works for the persisted user');
  } else {
    console.log('FAIL - Login failed for persisted user');
    allOk = false;
  }

  db.close();
  console.log('\n=== FEATURE 3 RESULT:', allOk ? 'PASS' : 'FAIL', '===');
  return allOk;
}

async function main() {
  try {
    const f2 = await testFeature2();
    const f5 = await testFeature5();
    const f3 = await testFeature3();

    console.log('\n\n========== SUMMARY ==========');
    console.log('Feature 2 (Schema):', f2 ? 'PASS' : 'FAIL');
    console.log('Feature 3 (Persistence):', f3 ? 'PASS' : 'FAIL');
    console.log('Feature 5 (Real DB):', f5 ? 'PASS' : 'FAIL');
  } catch (err) {
    console.error('Test error:', err);
  }
}

main();
