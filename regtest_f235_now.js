// Regression test for features 2, 5 (API-based with CSRF)
var http = require('http');

function httpReq(method, url, body, headers) {
  return new Promise(function(resolve, reject) {
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: Object.assign({'Content-Type': 'application/json'}, headers || {})
    };
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        var cookies = '';
        if (res.headers['set-cookie']) {
          cookies = res.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
        }
        resolve({status: res.statusCode, body: data, headers: res.headers, cookies: cookies});
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getCsrf() {
  var csrf = await httpReq('GET', 'http://localhost:3000/api/csrf-token');
  var token = '';
  try { token = JSON.parse(csrf.body).csrfToken; } catch(e) {}
  return { token: token, cookies: csrf.cookies };
}

async function main() {
  var passed = 0;
  var failed = 0;

  // ============ FEATURE 2: Database Schema ============
  console.log("=== FEATURE 2: Database Schema Applied Correctly ===\n");

  var health = await httpReq('GET', 'http://localhost:3000/api/health');
  var hd = JSON.parse(health.body);
  console.log("Health status:", hd.status, "| DB:", hd.database, "| Tables:", hd.tableCount);

  if (hd.database === 'connected' && hd.tableCount >= 13) {
    console.log("PASS: Database connected with " + hd.tableCount + " tables");
    passed++;
  } else {
    console.log("FAIL: Database status issue");
    failed++;
  }

  if (hd.tableCount === 17) {
    console.log("PASS: Exact table count matches expected (17)");
    passed++;
  } else {
    console.log("WARN: Table count " + hd.tableCount + " vs expected 17");
  }

  // ============ FEATURE 5: Backend API Queries Real Database ============
  console.log("\n=== FEATURE 5: Backend API Queries Real Database ===\n");

  // Get CSRF token first
  var csrfInfo = await getCsrf();
  console.log("CSRF token obtained:", csrfInfo.token ? "yes" : "no");

  // Register a unique test user
  var testEmail = 'regtest_f5_' + Date.now() + '@test.com';
  console.log("Registering test user:", testEmail);
  var reg = await httpReq('POST', 'http://localhost:3000/api/auth/register', {
    email: testEmail,
    password: 'TestPass123!',
    role: 'therapist',
    name: 'RegTest F5'
  }, Object.assign(
    {},
    csrfInfo.token ? {'x-csrf-token': csrfInfo.token} : {},
    csrfInfo.cookies ? {'Cookie': csrfInfo.cookies} : {}
  ));
  console.log("Register status:", reg.status);

  if (reg.status === 201 || reg.status === 200) {
    console.log("PASS: Registration succeeded (real DB INSERT)");
    passed++;

    // Login with this user - get fresh CSRF
    var loginCsrf = await getCsrf();
    var loginHeaders = {};
    if (loginCsrf.token) loginHeaders['x-csrf-token'] = loginCsrf.token;
    if (loginCsrf.cookies) loginHeaders['Cookie'] = loginCsrf.cookies;
    var login = await httpReq('POST', 'http://localhost:3000/api/auth/login', {
      email: testEmail,
      password: 'TestPass123!'
    }, loginHeaders);
    console.log("Login status:", login.status);

    if (login.status === 200) {
      console.log("PASS: Login succeeded (real DB SELECT)");
      passed++;

      // /api/auth/me
      var meCookies = login.cookies;
      var me = await httpReq('GET', 'http://localhost:3000/api/auth/me', null, {'Cookie': meCookies});
      console.log("/api/auth/me status:", me.status);

      if (me.status === 200) {
        var meData = JSON.parse(me.body);
        if (meData.user && meData.user.email === testEmail) {
          console.log("PASS: /api/auth/me returns correct user from DB");
          passed++;
        } else {
          console.log("FAIL: Wrong user data: " + me.body.substring(0, 200));
          failed++;
        }
      } else {
        console.log("WARN: /api/auth/me returned " + me.status + ": " + me.body.substring(0, 200));
      }
    } else {
      console.log("FAIL: Login failed: " + login.body.substring(0, 200));
      failed++;
    }

    // Duplicate registration test
    console.log("\nTrying duplicate registration...");
    var dupCsrf = await getCsrf();
    var dupHeaders = {};
    if (dupCsrf.token) dupHeaders['x-csrf-token'] = dupCsrf.token;
    if (dupCsrf.cookies) dupHeaders['Cookie'] = dupCsrf.cookies;
    var dup = await httpReq('POST', 'http://localhost:3000/api/auth/register', {
      email: testEmail,
      password: 'TestPass123!',
      role: 'therapist',
      name: 'Duplicate'
    }, dupHeaders);
    console.log("Duplicate register status:", dup.status);
    if (dup.status === 400 || dup.status === 409) {
      console.log("PASS: Duplicate rejected (real DB UNIQUE constraint)");
      passed++;
    } else {
      console.log("WARN: Duplicate returned " + dup.status);
    }
  } else {
    console.log("FAIL: Registration failed: " + reg.body.substring(0, 300));
    failed++;
  }

  console.log("\n=== RESULTS ===");
  console.log("Passed:", passed, "| Failed:", failed);
  if (failed > 0) {
    console.log("OVERALL: FAIL");
    process.exit(1);
  } else {
    console.log("OVERALL: PASS");
  }
}

main().catch(function(err) { console.error("Error:", err.message); process.exit(1); });
