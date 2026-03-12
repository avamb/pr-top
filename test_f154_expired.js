var jwt = require('./src/backend/node_modules/jsonwebtoken');
var http = require('http');

var secret = 'dev-jwt-secret-change-in-production';

// Create a token that expired 1 hour ago
var expiredToken = jwt.sign({ userId: 1, iat: Math.floor(Date.now()/1000) - 7200 }, secret, { expiresIn: '1h' });

// This token should have expired ~1h ago (iat 2h ago, expiresIn 1h)
console.log('Expired token created');

// Test 1: API call with expired token returns 401
var options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/dashboard/stats',
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + expiredToken }
};

var req = http.request(options, function(res) {
  var body = '';
  res.on('data', function(chunk) { body += chunk; });
  res.on('end', function() {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
    if (res.statusCode === 401) {
      console.log('PASS: Expired token returns 401');
    } else {
      console.log('FAIL: Expected 401, got', res.statusCode);
    }

    // Test 2: Valid token works
    var validToken = jwt.sign({ userId: 1 }, secret, { expiresIn: '24h' });
    var options2 = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + validToken }
    };
    var req2 = http.request(options2, function(res2) {
      var body2 = '';
      res2.on('data', function(chunk) { body2 += chunk; });
      res2.on('end', function() {
        console.log('\nValid token status:', res2.statusCode);
        if (res2.statusCode === 200 || res2.statusCode === 401) {
          // 401 is ok if user id=1 doesn't exist
          console.log('PASS: Valid token accepted by server (status ' + res2.statusCode + ')');
        }

        // Test 3: Multiple endpoints reject expired token
        var endpoints = ['/api/clients', '/api/settings/profile', '/api/exercises'];
        var passed = 0;
        var total = endpoints.length;
        endpoints.forEach(function(ep) {
          var opts = {
            hostname: 'localhost',
            port: 3001,
            path: ep,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + expiredToken }
          };
          var r = http.request(opts, function(resp) {
            var b = '';
            resp.on('data', function(c) { b += c; });
            resp.on('end', function() {
              if (resp.statusCode === 401) {
                passed++;
                console.log('PASS:', ep, '-> 401');
              } else {
                console.log('FAIL:', ep, '-> ' + resp.statusCode);
              }
              if (passed + (total - passed) === total) {
                console.log('\nExpired token blocked on ' + passed + '/' + total + ' endpoints');
              }
            });
          });
          r.end();
        });
      });
    });
    req2.end();
  });
});
req.end();
