var http = require('http');
var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

var testEmail = 'verify_fix_' + Date.now() + '@test.com';
var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');

var statBefore = fs.statSync(dbPath);
console.log('DB file BEFORE:');
console.log('  Size:', statBefore.size, 'bytes');
console.log('  Modified:', statBefore.mtime.toISOString());

function getCSRF(cb) {
  http.get('http://localhost:3001/api/csrf-token', function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() { cb(JSON.parse(data).csrfToken); });
  });
}

function registerUser(csrf, cb) {
  var body = JSON.stringify({ email: testEmail, password: 'TestPass123!', role: 'therapist' });
  var opts = {
    hostname: 'localhost', port: 3001, path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
  };
  var req = http.request(opts, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      console.log('\nRegister status:', res.statusCode);
      cb(JSON.parse(data));
    });
  });
  req.write(body);
  req.end();
}

function checkDB(label) {
  return initSqlJs().then(function(SQL) {
    var stat = fs.statSync(dbPath);
    var buf = fs.readFileSync(dbPath);
    var db = new SQL.Database(buf);
    var res = db.exec("SELECT id, email FROM users WHERE email = '" + testEmail + "'");
    var found = res.length > 0 && res[0].values.length > 0;
    console.log('\n' + label + ':');
    console.log('  File size:', stat.size, 'Modified:', stat.mtime.toISOString());
    console.log('  User in file:', found ? 'YES (id=' + res[0].values[0][0] + ')' : 'NO');
    if (!found) {
      var latest = db.exec("SELECT id, email FROM users ORDER BY id DESC LIMIT 1");
      if (latest.length > 0) console.log('  Latest user:', JSON.stringify(latest[0].values[0]));
    }
    db.close();
    return found;
  });
}

getCSRF(function(csrf) {
  registerUser(csrf, function(result) {
    if (result.error) { console.log('FAILED:', result.error); process.exit(1); }
    console.log('User registered: id=' + result.user.id + ' email=' + result.user.email);

    // Check immediately
    checkDB('IMMEDIATELY after register').then(function(found1) {
      // Check after 3 seconds
      setTimeout(function() {
        checkDB('AFTER 3 SECONDS').then(function(found2) {
          // Check after 8 seconds
          setTimeout(function() {
            checkDB('AFTER 8 SECONDS').then(function(found3) {
              console.log('\n=== RESULT ===');
              if (found1 && found2 && found3) {
                console.log('PASS: Data persists across all checks');
              } else {
                console.log('FAIL: Data lost at some point');
                console.log('  Immediately:', found1);
                console.log('  After 3s:', found2);
                console.log('  After 8s:', found3);
              }
            });
          }, 5000);
        });
      }, 3000);
    });
  });
});
