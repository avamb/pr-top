var http = require('http');
var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

var testEmail = 'persist_regtest_f3_' + Date.now() + '@test.com';
var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');

// Step 1: Get CSRF token
function getCSRF(cb) {
  http.get('http://localhost:3000/api/csrf-token', function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      var token = JSON.parse(data).csrfToken;
      cb(token);
    });
  });
}

// Step 2: Register user
function registerUser(csrf, cb) {
  var body = JSON.stringify({ email: testEmail, password: 'TestPass123!', role: 'therapist' });
  var opts = {
    hostname: 'localhost', port: 3000, path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
  };
  var req = http.request(opts, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      console.log('Register response status:', res.statusCode);
      console.log('Register response:', data);
      cb(JSON.parse(data));
    });
  });
  req.write(body);
  req.end();
}

// Step 3: Check DB file on disk
function checkDBFile() {
  return initSqlJs().then(function(SQL) {
    var buf = fs.readFileSync(dbPath);
    var db = new SQL.Database(buf);
    var res = db.exec("SELECT id, email, created_at FROM users WHERE email = '" + testEmail + "'");
    if (res.length > 0 && res[0].values.length > 0) {
      console.log('\nDB FILE CHECK: User FOUND on disk!');
      console.log('  id:', res[0].values[0][0]);
      console.log('  email:', res[0].values[0][1]);
      console.log('  created_at:', res[0].values[0][2]);
      return true;
    } else {
      console.log('\nDB FILE CHECK: User NOT FOUND on disk!');
      var latest = db.exec("SELECT id, email FROM users ORDER BY id DESC LIMIT 3");
      if (latest.length > 0) {
        console.log('Latest users in file:');
        latest[0].values.forEach(function(r) { console.log('  id=' + r[0] + ' email=' + r[1]); });
      }
      return false;
    }
  });
}

// Run test
getCSRF(function(csrf) {
  console.log('CSRF token obtained');
  console.log('Test email:', testEmail);
  registerUser(csrf, function(regResult) {
    if (regResult.error) {
      console.log('Registration failed:', regResult.error);
      process.exit(1);
    }
    console.log('\nRegistered user id:', regResult.user.id);

    // Wait 2 seconds to ensure save interval fires
    console.log('\nWaiting 2 seconds for DB save...');
    setTimeout(function() {
      checkDBFile().then(function(found) {
        if (found) {
          console.log('\nRESULT: PASS - Data persisted to disk immediately');
        } else {
          console.log('\nRESULT: FAIL - Data NOT persisted to disk');
        }
      });
    }, 2000);
  });
});
