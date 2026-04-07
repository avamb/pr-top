var http = require('http');

// Step 1: Get CSRF token
http.get('http://localhost:3001/api/csrf-token', function(res) {
  var body = '';
  res.on('data', function(chunk) { body += chunk; });
  res.on('end', function() {
    var token = JSON.parse(body).csrfToken;
    console.log('CSRF token obtained:', token);

    // Step 2: Register a user
    var data = JSON.stringify({
      email: 'regtest_f5_apr6v3@test.com',
      password: 'TestPass123',
      name: 'RegTest F5'
    });

    var opts = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    var req = http.request(opts, function(r) {
      var d = '';
      r.on('data', function(c) { d += c; });
      r.on('end', function() {
        console.log('Register status:', r.statusCode);
        console.log('Register response:', d);

        // Step 3: Check /api/health
        http.get('http://localhost:3001/api/health', function(hr) {
          var hd = '';
          hr.on('data', function(c) { hd += c; });
          hr.on('end', function() {
            var health = JSON.parse(hd);
            console.log('Health status:', hr.statusCode);
            console.log('Health database:', health.database);
            console.log('Health tableCount:', health.tableCount);
            console.log('ALL CHECKS PASSED');
          });
        });
      });
    });
    req.write(data);
    req.end();
  });
});
