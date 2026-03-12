var http = require('http');

function getCSRF(cb) {
  http.get('http://localhost:3001/api/csrf-token', function(res) {
    var d = '';
    res.on('data', function(c) { d += c; });
    res.on('end', function() { cb(JSON.parse(d).csrfToken); });
  });
}

function login(csrf, cb) {
  var data = JSON.stringify({ email: 'f155test@example.com', password: 'TestPass1' });
  var opts = {
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Content-Length': data.length }
  };
  var req = http.request(opts, function(r) {
    var b = '';
    r.on('data', function(c) { b += c; });
    r.on('end', function() { cb(JSON.parse(b)); });
  });
  req.write(data);
  req.end();
}

function botPost(path, body, cb) {
  var data = JSON.stringify(body);
  var opts = {
    hostname: 'localhost', port: 3001, path: path, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-API-Key': 'dev-bot-api-key', 'Content-Length': Buffer.byteLength(data) }
  };
  var req = http.request(opts, function(r) {
    var b = '';
    r.on('data', function(c) { b += c; });
    r.on('end', function() { cb(JSON.parse(b)); });
  });
  req.write(data);
  req.end();
}

function apiGet(path, token, cb) {
  var opts = {
    hostname: 'localhost', port: 3001, path: path,
    headers: { 'Authorization': 'Bearer ' + token }
  };
  http.get(opts, function(res) {
    var d = '';
    res.on('data', function(c) { d += c; });
    res.on('end', function() { cb(JSON.parse(d)); });
  });
}

getCSRF(function(csrf) {
  login(csrf, function(result) {
    if (!result.token) { console.log('Login failed:', result.error); return; }
    var token = result.token;
    var therapistId = result.user.id;
    console.log('Logged in, therapist ID:', therapistId);

    apiGet('/api/invite-code', token, function(inv) {
      var inviteCode = inv.invite_code;
      console.log('Invite code:', inviteCode);

      var tid = 'f155cli_' + Date.now();
      botPost('/api/bot/register', { telegram_id: tid, role: 'client', first_name: 'Client155' }, function(reg) {
        console.log('Register client:', reg.message || reg.error);
        var clientId = reg.user ? reg.user.id : null;

        botPost('/api/bot/connect', { telegram_id: tid, invite_code: inviteCode }, function(conn) {
          console.log('Connect:', conn.message || conn.error);

          botPost('/api/bot/consent', { telegram_id: tid, therapist_id: therapistId, consent: true }, function(cons) {
            console.log('Consent:', cons.message || cons.status || cons.error);

            // Verify client appears in client list
            apiGet('/api/clients', token, function(clients) {
              console.log('Clients count:', clients.clients ? clients.clients.length : 0);
              if (clients.clients && clients.clients.length > 0) {
                console.log('First client ID:', clients.clients[0].id);
              }
              console.log('DONE');
            });
          });
        });
      });
    });
  });
});
