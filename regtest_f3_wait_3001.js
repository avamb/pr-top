var http = require('http');
var attempts = 0;
var maxAttempts = 20;

function check() {
  attempts++;
  var req = http.get('http://localhost:3001/api/health', function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      console.log('Health check passed on attempt ' + attempts);
      console.log('Status: ' + res.statusCode);
      console.log(data);
    });
  });
  req.on('error', function() {
    if (attempts < maxAttempts) {
      setTimeout(check, 1000);
    } else {
      console.log('FAILED: Server not ready after ' + maxAttempts + ' attempts');
      process.exit(1);
    }
  });
}

check();
