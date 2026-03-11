var http = require('http');

function request(method, path, headers) {
  return new Promise(function(resolve, reject) {
    var h = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
    var req = http.request({
      hostname: 'localhost', port: 3001, path: path, method: method, headers: h
    }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Check that exercises and deliveries persist after restart
  var botHeaders = { 'x-bot-api-key': 'dev-bot-api-key' };

  // Check exercises exist
  var login = await request('POST', '/api/auth/login', {});
  // just check health
  var health = await request('GET', '/api/health', {});
  console.log('Server up:', health.data.status);

  // Check if exercises table has data
  var adminLogin = await request('POST', '/api/auth/login', { 'Content-Type': 'application/json' });
  // We can check via the exercises endpoint with a valid token
  // Login as admin
  var http2 = require('http');
  var body = JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' });
  var loginReq = await new Promise(function(resolve, reject) {
    var req = http2.request({
      hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { resolve(JSON.parse(d)); });
    });
    req.write(body);
    req.end();
  });

  var token = loginReq.token;
  console.log('Admin logged in:', !!token);

  var exercises = await request('GET', '/api/exercises', { Authorization: 'Bearer ' + token });
  console.log('Exercises after restart:', exercises.data.exercises ? exercises.data.exercises.length : 0);
  console.log('Persistence check:', exercises.data.exercises && exercises.data.exercises.length > 0 ? 'PASSED' : 'FAILED');
}

main().catch(console.error);
