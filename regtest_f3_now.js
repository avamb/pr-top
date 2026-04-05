// Feature 3: Data Persists Across Server Restart
// Step 1: Register a user, then exit. Step 2 runs after restart.
var http = require('http');
var fs = require('fs');

var STATE_FILE = './regtest_f3_now_state.json';
var BASE = 'http://localhost:3000';

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
  var csrf = await httpReq('GET', BASE + '/api/csrf-token');
  var token = '';
  try { token = JSON.parse(csrf.body).csrfToken; } catch(e) {}
  return { token: token, cookies: csrf.cookies };
}

async function step1_register() {
  console.log("=== STEP 1: Register test user before restart ===\n");

  var testEmail = 'restart_test_' + Date.now() + '@test.com';
  var testPassword = 'TestPass123!';

  var csrfInfo = await getCsrf();
  var headers = {};
  if (csrfInfo.token) headers['x-csrf-token'] = csrfInfo.token;
  if (csrfInfo.cookies) headers['Cookie'] = csrfInfo.cookies;

  var reg = await httpReq('POST', BASE + '/api/auth/register', {
    email: testEmail,
    password: testPassword,
    role: 'therapist',
    name: 'Restart Test'
  }, headers);

  console.log("Register status:", reg.status);

  if (reg.status === 201 || reg.status === 200) {
    console.log("PASS: User registered:", testEmail);

    // Verify login works before restart
    var loginCsrf = await getCsrf();
    var loginHeaders = {};
    if (loginCsrf.token) loginHeaders['x-csrf-token'] = loginCsrf.token;
    if (loginCsrf.cookies) loginHeaders['Cookie'] = loginCsrf.cookies;

    var login = await httpReq('POST', BASE + '/api/auth/login', {
      email: testEmail,
      password: testPassword
    }, loginHeaders);

    console.log("Pre-restart login status:", login.status);

    if (login.status === 200) {
      console.log("PASS: Login works before restart");

      // Save state for step 2
      fs.writeFileSync(STATE_FILE, JSON.stringify({
        email: testEmail,
        password: testPassword,
        timestamp: Date.now()
      }));
      console.log("\nState saved. Now restart the server and run: node regtest_f3_now.js verify");
    } else {
      console.log("FAIL: Login failed before restart:", login.body.substring(0, 200));
      process.exit(1);
    }
  } else {
    console.log("FAIL: Registration failed:", reg.body.substring(0, 300));
    process.exit(1);
  }
}

async function step2_verify() {
  console.log("=== STEP 2: Verify data persists after restart ===\n");

  if (!fs.existsSync(STATE_FILE)) {
    console.log("FAIL: No state file found. Run step 1 first (without 'verify' argument)");
    process.exit(1);
  }

  var state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  console.log("Test email:", state.email);
  console.log("Registered at:", new Date(state.timestamp).toISOString());

  // Try to login with the user from before restart
  var csrfInfo = await getCsrf();
  var headers = {};
  if (csrfInfo.token) headers['x-csrf-token'] = csrfInfo.token;
  if (csrfInfo.cookies) headers['Cookie'] = csrfInfo.cookies;

  var login = await httpReq('POST', BASE + '/api/auth/login', {
    email: state.email,
    password: state.password
  }, headers);

  console.log("Post-restart login status:", login.status);

  if (login.status === 200) {
    var loginData = JSON.parse(login.body);
    console.log("PASS: Login succeeded after restart - data persisted!");

    // Verify user data integrity
    var meCookies = login.cookies;
    var me = await httpReq('GET', BASE + '/api/auth/me', null, {'Cookie': meCookies});
    if (me.status === 200) {
      var meData = JSON.parse(me.body);
      if (meData.user && meData.user.email === state.email) {
        console.log("PASS: User data intact after restart");
      }
    }

    // Cleanup state file
    fs.unlinkSync(STATE_FILE);
    console.log("\n=== FEATURE 3: PASS ===");
  } else {
    console.log("CRITICAL FAILURE: Login failed after restart!");
    console.log("Response:", login.body.substring(0, 300));
    console.log("\nThis means data was NOT persisted - in-memory storage detected!");
    console.log("\n=== FEATURE 3: FAIL ===");
    process.exit(1);
  }
}

var mode = process.argv[2];
if (mode === 'verify') {
  step2_verify().catch(function(err) { console.error("Error:", err.message); process.exit(1); });
} else {
  step1_register().catch(function(err) { console.error("Error:", err.message); process.exit(1); });
}
