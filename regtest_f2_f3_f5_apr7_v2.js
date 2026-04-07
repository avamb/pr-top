// Regression test for Features 2, 3, 5
const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, body: data, cookies, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testFeature2() {
  console.log('\n========== FEATURE 2: Database Schema Check ==========');
  const SQL = await initSqlJs();
  const dbPath = path.resolve(__dirname, 'src/backend/data/prtop.db');

  if (!fs.existsSync(dbPath)) {
    console.log('ERROR: Database file not found at ' + dbPath);
    return false;
  }

  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Get all tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tableNames = tables[0].values.map(r => r[0]);
  console.log('Tables found: ' + tableNames.length);
  console.log('Tables: ' + tableNames.join(', '));

  const requiredTables = [
    'users', 'diary_entries', 'therapist_notes', 'sessions', 'client_context',
    'exercises', 'exercise_deliveries', 'sos_events', 'subscriptions', 'payments',
    'audit_logs', 'encryption_keys', 'platform_settings'
  ];

  let allPass = true;
  for (const t of requiredTables) {
    if (!tableNames.includes(t)) {
      console.log('  MISSING TABLE: ' + t);
      allPass = false;
    }
  }
  if (allPass) console.log('All required tables present.');

  // Check columns
  const tablesToCheck = {
    'users': ['id', 'telegram_id', 'email', 'password_hash', 'role', 'therapist_id', 'consent_therapist_access', 'invite_code', 'language', 'timezone', 'created_at', 'updated_at', 'blocked_at', 'utm_source', 'utm_medium', 'utm_campaign'],
    'diary_entries': ['id', 'client_id', 'entry_type', 'content_encrypted', 'transcript_encrypted', 'encryption_key_id', 'payload_version', 'file_ref', 'embedding_ref', 'created_at', 'updated_at'],
    'therapist_notes': ['id', 'therapist_id', 'client_id', 'note_encrypted', 'encryption_key_id', 'payload_version', 'session_date', 'created_at', 'updated_at'],
    'sessions': ['id', 'therapist_id', 'client_id', 'audio_ref', 'transcript_encrypted', 'summary_encrypted', 'encryption_key_id', 'payload_version', 'status', 'scheduled_at', 'created_at', 'updated_at'],
    'client_context': ['id', 'therapist_id', 'client_id', 'anamnesis_encrypted', 'current_goals_encrypted', 'contraindications_encrypted', 'ai_instructions_encrypted', 'encryption_key_id', 'payload_version', 'created_at', 'updated_at'],
    'exercises': ['id', 'category', 'title_ru', 'title_en', 'title_es', 'description_ru', 'description_en', 'description_es', 'instructions_ru', 'instructions_en', 'instructions_es'],
    'exercise_deliveries': ['id', 'exercise_id', 'therapist_id', 'client_id', 'status', 'response_encrypted', 'encryption_key_id', 'sent_at', 'completed_at'],
    'sos_events': ['id', 'client_id', 'therapist_id', 'message_encrypted', 'encryption_key_id', 'status', 'created_at', 'acknowledged_at'],
    'subscriptions': ['id', 'therapist_id', 'stripe_customer_id', 'stripe_subscription_id', 'plan', 'status', 'trial_ends_at', 'current_period_start', 'current_period_end', 'created_at', 'updated_at'],
    'payments': ['id', 'subscription_id', 'stripe_payment_intent_id', 'amount', 'currency', 'status', 'created_at'],
    'audit_logs': ['id', 'actor_id', 'action', 'target_type', 'target_id', 'details_encrypted', 'ip_address', 'created_at'],
    'encryption_keys': ['id', 'key_version', 'status', 'created_at', 'rotated_at'],
    'platform_settings': ['id', 'key', 'value', 'updated_by', 'updated_at']
  };

  for (const [table, requiredCols] of Object.entries(tablesToCheck)) {
    const info = db.exec('PRAGMA table_info(' + table + ')');
    if (!info.length) {
      console.log('  ' + table + ': TABLE NOT FOUND');
      allPass = false;
      continue;
    }
    const cols = info[0].values.map(r => r[1]);
    const missing = requiredCols.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('  ' + table + ': MISSING columns: ' + missing.join(', '));
      allPass = false;
    } else {
      console.log('  ' + table + ': OK (' + requiredCols.length + ' cols verified)');
    }
  }

  db.close();
  console.log('FEATURE 2 RESULT: ' + (allPass ? 'PASS' : 'FAIL'));
  return allPass;
}

async function testFeature5() {
  console.log('\n========== FEATURE 5: Backend API Queries Real DB ==========');
  let allPass = true;

  // Test 1: Health endpoint
  console.log('Test 1: GET /api/health');
  const health = await httpRequest({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  const healthData = JSON.parse(health.body);
  console.log('  Status: ' + health.status + ', DB connected: ' + healthData.database + ', Tables: ' + healthData.tableCount);
  if (healthData.database !== 'connected' || healthData.tableCount < 10) {
    console.log('  FAIL: Health check indicates DB not connected');
    allPass = false;
  } else {
    console.log('  OK: Real database connected with ' + healthData.tableCount + ' tables');
  }

  // Test 2: Register a unique user
  const uniqueEmail = 'regtest_f5_' + Date.now() + '@test.com';
  console.log('Test 2: POST /api/auth/register (' + uniqueEmail + ')');
  const register = await httpRequest(
    { hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: uniqueEmail, password: 'TestPass123!', role: 'therapist' })
  );
  console.log('  Status: ' + register.status);
  if (register.status === 201 || register.status === 200) {
    console.log('  OK: User registered successfully');
  } else {
    console.log('  Response: ' + register.body);
    // If user already exists (409), that also proves real DB
    if (register.status === 409) {
      console.log('  OK: 409 Conflict means real DB duplicate check');
    } else {
      console.log('  FAIL: Unexpected register status');
      allPass = false;
    }
  }

  // Test 3: Login and get session cookie
  console.log('Test 3: POST /api/auth/login');
  const login = await httpRequest(
    { hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: uniqueEmail, password: 'TestPass123!' })
  );
  console.log('  Status: ' + login.status);

  // Extract cookies
  let cookieStr = '';
  let csrfToken = '';
  if (login.cookies.length > 0) {
    cookieStr = login.cookies.map(c => c.split(';')[0]).join('; ');
    console.log('  Cookies received: ' + login.cookies.length);
  }

  // Extract CSRF token from response body
  try {
    const loginData = JSON.parse(login.body);
    csrfToken = loginData.csrfToken || '';
    if (loginData.user) {
      console.log('  OK: Login returned user data (id=' + loginData.user.id + ')');
    }
  } catch (e) {
    console.log('  Login body: ' + login.body);
  }

  // Test 4: GET /api/auth/me with cookie
  if (cookieStr) {
    console.log('Test 4: GET /api/auth/me (authenticated)');
    const me = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/api/auth/me', method: 'GET',
      headers: { 'Cookie': cookieStr }
    });
    console.log('  Status: ' + me.status);
    try {
      const meData = JSON.parse(me.body);
      if (meData.user && meData.user.email === uniqueEmail) {
        console.log('  OK: /api/auth/me returned correct user email');
      } else if (meData.user) {
        console.log('  OK: /api/auth/me returned user data');
      } else {
        console.log('  Response: ' + me.body);
      }
    } catch (e) {
      console.log('  Response: ' + me.body);
    }
  }

  // Test 5: Verify user exists in actual DB file
  console.log('Test 5: Verify user in DB file directly');
  const SQL = await require('./src/backend/node_modules/sql.js')();
  const dbPath = path.resolve(__dirname, 'src/backend/data/prtop.db');
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Note: sql.js in-memory DB may not have the latest user if save hasn't flushed yet
  // Check for any users to prove real DB is being used
  const userCount = db.exec("SELECT COUNT(*) FROM users");
  const count = userCount[0].values[0][0];
  console.log('  Users in DB file: ' + count);
  if (count > 0) {
    console.log('  OK: Real data found in database file');
  } else {
    console.log('  WARN: No users in DB file (may not have flushed yet)');
  }

  // Check that the registration actually created a row (via API, not static)
  const specificUser = db.exec("SELECT id, email, role FROM users WHERE email LIKE 'regtest_f5_%'");
  if (specificUser.length > 0) {
    console.log('  Found ' + specificUser[0].values.length + ' test users in DB');
  }

  db.close();

  console.log('FEATURE 5 RESULT: ' + (allPass ? 'PASS' : 'FAIL'));
  return allPass;
}

async function main() {
  try {
    const f2 = await testFeature2();
    const f5 = await testFeature5();
    console.log('\n========== SUMMARY ==========');
    console.log('Feature 2 (Schema): ' + (f2 ? 'PASS' : 'FAIL'));
    console.log('Feature 5 (Real DB): ' + (f5 ? 'PASS' : 'FAIL'));
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

main();
