var http = require('http');
var spawn = require('child_process').spawn;

// Send a shutdown request to the running server, then start a new one
// First, try to crash the old server by making it exit
var req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/dev/shutdown', method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, function(res) {
  process.stdout.write('Shutdown response: ' + res.statusCode + '\n');
  startNew();
});
req.on('error', function(e) {
  process.stdout.write('Server not responding, starting new...\n');
  startNew();
});
req.end();

function startNew() {
  setTimeout(function() {
    process.stdout.write('Starting backend...\n');
    var child = spawn('node', ['src/backend/src/index.js'], {
      stdio: 'ignore', detached: true, shell: true
    });
    child.unref();
    process.stdout.write('Started with PID: ' + child.pid + '\n');
    process.stdout.write('Waiting 5s...\n');
    setTimeout(function() {
      // Verify
      var vreq = http.request({
        hostname: 'localhost', port: 3001, path: '/api/bot/voice-query', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' }
      }, function(res) {
        var data = '';
        res.on('data', function(c) { data += c; });
        res.on('end', function() {
          process.stdout.write('Voice-query endpoint: ' + res.statusCode + ' ' + data.substring(0, 100) + '\n');
        });
      });
      vreq.on('error', function(e) { process.stdout.write('Error: ' + e.message + '\n'); });
      vreq.write('{"telegram_id":"test","client_id":1,"voice_text":"test"}');
      vreq.end();
    }, 5000);
  }, 2000);
}
