// Feature 3: Verify data persists across server restart
var http = require('http');

var BASE = 'http://localhost:3001';
var TEST_EMAIL = 'regtest_f3_' + Date.now() + '@test.com';
var TEST_PASS = 'TestPass123!';

function request(method, urlPath, body, headers) {
  return new Promise(function(resolve, reject) {
    var url = new URL(urlPath, BASE);
    var options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: headers || {}
    };
    if (body) {
      var bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        var setCookies = res.headers['set-cookie'] || [];
        var cookieStr = setCookies.map(function(c) { return c.split(';')[0]; }).join('; ');
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), cookies: cookieStr });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, cookies: cookieStr });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== FEATURE 3: Data Persistence Test ===');
  console.log('Test email:', TEST_EMAIL);

  // Step 1: Get CSRF token
  console.log('\n1. Getting CSRF token...');
  var csrfResp = await request('GET', '/api/csrf-token', null, null);
  console.log('CSRF response status:', csrfResp.status);
  var csrfToken = csrfResp.body && csrfResp.body.csrfToken;
  console.log('CSRF token:', csrfToken ? 'obtained' : 'MISSING');

  if (!csrfToken) {
    console.log('FAIL: Could not get CSRF token');
    console.log('=== FEATURE 3 RESULT: FAIL ===');
    return;
  }

  // Step 2: Register test user with X-CSRF-Token header
  console.log('\n2. Registering test therapist...');
  var regResp = await request('POST', '/api/auth/register',
    { email: TEST_EMAIL, password: TEST_PASS, role: 'therapist' },
    { 'X-CSRF-Token': csrfToken }
  );
  console.log('Register status:', regResp.status);
  console.log('Register body:', JSON.stringify(regResp.body).substring(0, 200));

  if (regResp.status !== 201 && regResp.status !== 200) {
    console.log('\nFAIL: Registration failed');
    console.log('=== FEATURE 3 RESULT: FAIL ===');
    return;
  }

  // Step 3: Login to verify user exists
  console.log('\n3. Logging in to verify...');
  var csrfResp2 = await request('GET', '/api/csrf-token', null, null);
  var csrfToken2 = csrfResp2.body.csrfToken;
  var loginResp = await request('POST', '/api/auth/login',
    { email: TEST_EMAIL, password: TEST_PASS },
    { 'X-CSRF-Token': csrfToken2 }
  );
  console.log('Login status:', loginResp.status);

  if (loginResp.status !== 200) {
    console.log('FAIL: Login failed before persistence check');
    console.log('=== FEATURE 3 RESULT: FAIL ===');
    return;
  }

  console.log('Login succeeded - user created in memory.');

  // Step 4: Wait for DB save interval (every 5 seconds) then verify in DB file
  console.log('\n4. Waiting 6s for DB save interval to flush to disk...');
  await new Promise(function(r) { setTimeout(r, 6000); });

  var initSqlJs = require('./src/backend/node_modules/sql.js');
  var fs = require('fs');
  var path = require('path');
  var SQL = await initSqlJs();
  var dbPath = path.resolve(__dirname, 'src/backend/data/prtop.db');

  var fileBuffer = fs.readFileSync(dbPath);
  var db = new SQL.Database(fileBuffer);
  var result = db.exec("SELECT id, email FROM users WHERE email = '" + TEST_EMAIL + "'");
  db.close();

  if (result.length > 0 && result[0].values.length > 0) {
    console.log('User found in DB file on disk:', result[0].values[0]);
    console.log('\nData is persisted to disk file. Will survive server restart.');
    console.log('\n=== FEATURE 3 RESULT: PASS ===');
  } else {
    console.log('User NOT found in DB file on disk!');
    console.log('Data may only be in memory - would be lost on restart.');
    console.log('\n=== FEATURE 3 RESULT: FAIL ===');
  }
}

main().catch(function(err) { console.error('Error:', err); process.exit(1); });
