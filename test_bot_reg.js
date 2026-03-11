var http = require('http');
var r = http.request({
  hostname: 'localhost', port: 3001, path: '/api/bot/register', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' }
}, function(res) {
  var b = '';
  res.on('data', function(d) { b += d; });
  res.on('end', function() { console.log(res.statusCode, b); process.exit(0); });
});
r.setTimeout(5000, function() { console.log('TIMEOUT'); r.destroy(); process.exit(1); });
r.write(JSON.stringify({ telegram_id: 'test_' + Date.now(), role: 'client' }));
r.end();
