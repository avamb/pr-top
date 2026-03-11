const http = require('http');
var tries = 0;
function check() {
  tries++;
  if (tries > 20) { console.log('timeout'); process.exit(1); }
  http.get('http://localhost:3001/api/health', function(r) {
    console.log('Backend ready');
    process.exit(0);
  }).on('error', function() { setTimeout(check, 1000); });
}
check();
