const http = require('http');

function check() {
  return new Promise(function(resolve) {
    var req = http.get('http://localhost:3001/api/health', function(res) {
      resolve(res.statusCode === 200);
    });
    req.on('error', function() { resolve(false); });
    req.setTimeout(2000, function() { req.destroy(); resolve(false); });
  });
}

async function main() {
  for (var i = 0; i < 20; i++) {
    var ok = await check();
    if (ok) { console.log('Backend ready'); return; }
    await new Promise(function(r) { setTimeout(r, 1000); });
  }
  console.log('Backend not ready after 20s');
  process.exit(1);
}
main();
