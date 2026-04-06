var http = require('http');

function getCSRFAndRegister(email, password, name, callback) {
  var opts = { hostname: 'localhost', port: 3001, path: '/api/csrf-token' };
  http.get(opts, function(r) {
    var d = '';
    r.on('data', function(c) { d += c; });
    r.on('end', function() {
      var cookies = r.headers['set-cookie'] || [];
      var csrf = JSON.parse(d).csrfToken;
      var cookieHeader = cookies.map(function(c) { return c.split(';')[0]; }).join('; ');
      var body = JSON.stringify({ email: email, password: password, name: name, role: 'therapist', language: 'en' });
      var reqOpts = {
        hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Cookie': cookieHeader, 'Content-Length': Buffer.byteLength(body) }
      };
      var req2 = http.request(reqOpts, function(r2) {
        var d2 = '';
        r2.on('data', function(c) { d2 += c; });
        r2.on('end', function() { callback(null, JSON.parse(d2), cookieHeader, csrf); });
      });
      req2.write(body);
      req2.end();
    });
  });
}

function loginWithCSRF(email, password, callback) {
  var opts = { hostname: 'localhost', port: 3001, path: '/api/csrf-token' };
  http.get(opts, function(r) {
    var d = '';
    r.on('data', function(c) { d += c; });
    r.on('end', function() {
      var cookies = r.headers['set-cookie'] || [];
      var csrf = JSON.parse(d).csrfToken;
      var cookieHeader = cookies.map(function(c) { return c.split(';')[0]; }).join('; ');
      var body = JSON.stringify({ email: email, password: password });
      var reqOpts = {
        hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Cookie': cookieHeader, 'Content-Length': Buffer.byteLength(body) }
      };
      var req2 = http.request(reqOpts, function(r2) {
        var d2 = '';
        r2.on('data', function(c) { d2 += c; });
        r2.on('end', function() { callback(null, JSON.parse(d2)); });
      });
      req2.write(body);
      req2.end();
    });
  });
}

var testEmail = 'F3_PERSIST_CTRL_0404C@test.com';
var testPassword = 'TestPass123';

var step = process.argv[2] || 'register';

if (step === 'register') {
  console.log('STEP 1: Registering user ' + testEmail);
  getCSRFAndRegister(testEmail, testPassword, 'Persist Ctrl Test', function(err, result) {
    console.log('Registration result:', JSON.stringify(result));
    if (result.user) {
      console.log('SUCCESS: User created with id=' + result.user.id);
      // Now try to login immediately to verify
      loginWithCSRF(testEmail, testPassword, function(err, loginResult) {
        console.log('Immediate login result:', JSON.stringify(loginResult));
        if (loginResult.token) {
          console.log('SUCCESS: Login works before restart');
        } else {
          console.log('FAIL: Cannot login even before restart');
        }
      });
    } else {
      console.log('Registration response:', JSON.stringify(result));
    }
  });
} else if (step === 'verify') {
  console.log('STEP 2: Verifying user ' + testEmail + ' after restart');
  loginWithCSRF(testEmail, testPassword, function(err, result) {
    console.log('Post-restart login result:', JSON.stringify(result));
    if (result.token) {
      console.log('SUCCESS: Data persisted across restart!');
    } else {
      console.log('FAIL: Data lost after restart - ' + JSON.stringify(result));
      // Try to register again to confirm data loss
      getCSRFAndRegister(testEmail, testPassword, 'Persist Ctrl Test', function(err, regResult) {
        if (regResult.user) {
          console.log('CONFIRMED FAILURE: User was re-created (data lost). New id=' + regResult.user.id);
        } else if (regResult.error && regResult.error.includes('already exists')) {
          console.log('WAIT: User exists but login failed - might be password issue');
        } else {
          console.log('Re-registration result:', JSON.stringify(regResult));
        }
      });
    }
  });
}
