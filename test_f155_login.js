var http = require('http');

function getCSRF(cb) {
  http.get('http://localhost:3001/api/csrf-token', function(res) {
    var d = '';
    res.on('data', function(c) { d += c; });
    res.on('end', function() { cb(JSON.parse(d).csrfToken); });
  });
}

function login(csrf, email, password, cb) {
  var data = JSON.stringify({ email: email, password: password });
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

getCSRF(function(csrf) {
  login(csrf, 'f155test@example.com', 'TestPass1', function(result) {
    console.log('Login:', result.token ? 'OK' : result.error);
    if (!result.token) return;

    // Get invite code
    var opts = {
      hostname: 'localhost', port: 3001, path: '/api/invite-code',
      headers: { 'Authorization': 'Bearer ' + result.token }
    };
    http.get(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        var data = JSON.parse(d);
        console.log('Invite code:', data.invite_code);

        // Register client via bot
        var tid = 'f155_' + Date.now();
        var cdata = JSON.stringify({ telegram_id: tid, role: 'client', first_name: 'TestClient155' });
        var copts = {
          hostname: 'localhost', port: 3001, path: '/api/bot/register', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Bot-API-Key': 'dev-bot-api-key', 'Content-Length': Buffer.byteLength(cdata) }
        };
        var creq = http.request(copts, function(cr) {
          var cb2 = '';
          cr.on('data', function(c) { cb2 += c; });
          cr.on('end', function() {
            console.log('Bot register:', JSON.parse(cb2).status || cb2);

            // Connect
            var connData = JSON.stringify({ telegram_id: tid, invite_code: data.invite_code });
            var connOpts = {
              hostname: 'localhost', port: 3001, path: '/api/bot/connect', method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Bot-API-Key': 'dev-bot-api-key', 'Content-Length': Buffer.byteLength(connData) }
            };
            var connReq = http.request(connOpts, function(connRes) {
              var connBody = '';
              connRes.on('data', function(c) { connBody += c; });
              connRes.on('end', function() {
                console.log('Connect:', JSON.parse(connBody).status || connBody);

                // Consent
                var consData = JSON.stringify({ telegram_id: tid, action: 'accept' });
                var consOpts = {
                  hostname: 'localhost', port: 3001, path: '/api/bot/consent', method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Bot-API-Key': 'dev-bot-api-key', 'Content-Length': Buffer.byteLength(consData) }
                };
                var consReq = http.request(consOpts, function(consRes) {
                  var consBody = '';
                  consRes.on('data', function(c) { consBody += c; });
                  consRes.on('end', function() {
                    console.log('Consent:', JSON.parse(consBody).status || consBody);
                    console.log('DONE');
                  });
                });
                consReq.write(consData);
                consReq.end();
              });
            });
            connReq.write(connData);
            connReq.end();
          });
        });
        creq.write(cdata);
        creq.end();
      });
    });
  });
});
