var http = require('http');
var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');

// Check the DB file size and modification time before and after registration
var statBefore = fs.statSync(dbPath);
console.log('DB file BEFORE registration:');
console.log('  Size:', statBefore.size, 'bytes');
console.log('  Modified:', statBefore.mtime.toISOString());

var testEmail = 'debug_save_' + Date.now() + '@test.com';

// Get CSRF + register
function run() {
  http.get('http://localhost:3001/api/csrf-token', function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      var csrf = JSON.parse(data).csrfToken;
      console.log('\nCSRF obtained, registering:', testEmail);

      var body = JSON.stringify({ email: testEmail, password: 'TestPass123!', role: 'therapist' });
      var opts = {
        hostname: 'localhost', port: 3001, path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
      };
      var req = http.request(opts, function(res2) {
        var rdata = '';
        res2.on('data', function(c) { rdata += c; });
        res2.on('end', function() {
          console.log('Register status:', res2.statusCode);
          console.log('Register response:', rdata.substring(0, 200));

          // Check file immediately
          var statAfterImmediate = fs.statSync(dbPath);
          console.log('\nDB file IMMEDIATELY after registration:');
          console.log('  Size:', statAfterImmediate.size, 'bytes');
          console.log('  Modified:', statAfterImmediate.mtime.toISOString());
          console.log('  Size changed:', statAfterImmediate.size !== statBefore.size);
          console.log('  Time changed:', statAfterImmediate.mtime.getTime() !== statBefore.mtime.getTime());

          // Check DB content immediately
          initSqlJs().then(function(SQL) {
            var buf = fs.readFileSync(dbPath);
            var db = new SQL.Database(buf);
            var found = db.exec("SELECT id, email FROM users WHERE email = '" + testEmail + "'");
            console.log('\nUser in DB file immediately:', found.length > 0 && found[0].values.length > 0 ? 'YES' : 'NO');

            // Wait 6 seconds for periodic save
            console.log('\nWaiting 6 seconds for periodic save...');
            setTimeout(function() {
              var statAfterWait = fs.statSync(dbPath);
              console.log('DB file AFTER 6s wait:');
              console.log('  Size:', statAfterWait.size, 'bytes');
              console.log('  Modified:', statAfterWait.mtime.toISOString());

              var buf2 = fs.readFileSync(dbPath);
              var db2 = new SQL.Database(buf2);
              var found2 = db2.exec("SELECT id, email FROM users WHERE email = '" + testEmail + "'");
              console.log('User in DB file after wait:', found2.length > 0 && found2[0].values.length > 0 ? 'YES' : 'NO');

              var latest = db2.exec("SELECT id, email FROM users ORDER BY id DESC LIMIT 3");
              console.log('Latest users:', JSON.stringify(latest[0].values));

              db.close();
              db2.close();
            }, 6000);
          });
        });
      });
      req.write(body);
      req.end();
    });
  });
}

run();
