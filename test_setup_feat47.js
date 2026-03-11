var http = require('http');

function fetch(url, opts) {
  opts = opts || {};
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
    };
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function json(r) { return JSON.parse(r.body); }

var BASE = 'http://localhost:3001/api';
var BOT = { 'x-bot-api-key': 'dev-bot-api-key' };
var tid = 'F47_CLIENT_' + Date.now();

// Login as feat47test therapist
fetch(BASE + '/auth/login', { method: 'POST', body: JSON.stringify({ email: 'feat47test@test.com', password: 'Test1234!' }) })
.then(function(r) {
  var d = json(r);
  var token = d.token;
  var therapistId = d.user.id;
  console.log('Login:', therapistId);

  // Register client + connect + consent
  return fetch(BASE + '/bot/register', { method: 'POST', body: JSON.stringify({ telegram_id: tid, role: 'client', display_name: 'Feature47 Test Client' }), headers: BOT })
  .then(function() {
    return fetch(BASE + '/invite-code', { headers: { Authorization: 'Bearer ' + token } });
  })
  .then(function(r2) {
    var code = json(r2).invite_code;
    return fetch(BASE + '/bot/connect', { method: 'POST', body: JSON.stringify({ telegram_id: tid, invite_code: code }), headers: BOT });
  })
  .then(function() {
    return fetch(BASE + '/bot/consent', { method: 'POST', body: JSON.stringify({ telegram_id: tid, therapist_id: therapistId, accept: true }), headers: BOT });
  })
  .then(function() {
    return fetch(BASE + '/clients', { headers: { Authorization: 'Bearer ' + token } });
  })
  .then(function(r3) {
    var clients = json(r3).clients;
    var client = clients.find(function(c) { return c.telegram_id === tid; });
    console.log('Client ID:', client.id);
    console.log('Use this URL: http://localhost:3000/clients/' + client.id);
  });
})
.catch(function(e) { console.error('ERROR:', e.message); });
