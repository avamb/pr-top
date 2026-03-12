var http = require('http');

function getCSRF(cb) {
  http.get('http://localhost:3001/api/csrf-token', function(res) {
    var d = '';
    res.on('data', function(c) { d += c; });
    res.on('end', function() { cb(JSON.parse(d).csrfToken); });
  });
}

function register(csrf, email, password, cb) {
  var data = JSON.stringify({ email: email, password: password });
  var opts = {
    hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
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

function registerBot(therapistToken, telegramId, role, cb) {
  var data = JSON.stringify({ telegram_id: telegramId, role: role, first_name: 'TestClient' });
  var opts = {
    hostname: 'localhost', port: 3001, path: '/api/bot/register', method: 'POST',
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

function connectClient(inviteCode, telegramId, cb) {
  var data = JSON.stringify({ telegram_id: telegramId, invite_code: inviteCode });
  var opts = {
    hostname: 'localhost', port: 3001, path: '/api/bot/connect', method: 'POST',
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

function acceptConsent(telegramId, cb) {
  var data = JSON.stringify({ telegram_id: telegramId, action: 'accept' });
  var opts = {
    hostname: 'localhost', port: 3001, path: '/api/bot/consent', method: 'POST',
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

// Main flow
getCSRF(function(csrf) {
  register(csrf, 'f155test@example.com', 'TestPass1', function(regResult) {
    console.log('Register:', regResult.token ? 'OK' : regResult.error || 'FAIL');
    var token = regResult.token;

    // Get invite code
    var opts = {
      hostname: 'localhost', port: 3001, path: '/api/invite-code',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    http.get(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        var inviteData = JSON.parse(d);
        var inviteCode = inviteData.invite_code;
        console.log('Invite code:', inviteCode);

        // Register client bot
        var tid = 'f155_' + Date.now();
        registerBot(token, tid, 'client', function(botResult) {
          console.log('Bot register:', botResult.status || botResult.error);

          connectClient(inviteCode, tid, function(connResult) {
            console.log('Connect:', connResult.status || connResult.error);

            acceptConsent(tid, function(consentResult) {
              console.log('Consent:', consentResult.status || consentResult.error);
              console.log('SETUP COMPLETE - email: f155test@example.com, password: TestPass1');
            });
          });
        });
      });
    });
  });
});
