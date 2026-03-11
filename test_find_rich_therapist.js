var http = require('http');

function makeRequest(opts, data) {
  return new Promise(function(resolve, reject) {
    var req = http.request(opts, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: JSON.parse(body) }); });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // Try therapists known to have data
  var emails = ['timeline_test@test.com', 'session_test@test.com', 'filter_test@test.com', 'dateui@test.com', 'browser_test@psylink.app', 'ui_decrypt_test@test.com', 'ctx_test2@test.com'];

  for (var i = 0; i < emails.length; i++) {
    var email = emails[i];
    var loginData = JSON.stringify({ email: email, password: 'Test123!' });
    var loginRes = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
    }, loginData);

    if (loginRes.status !== 200) continue;

    var token = loginRes.body.token;
    var clientsRes = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/clients',
      method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!clientsRes.body.clients || clientsRes.body.clients.length === 0) continue;

    for (var j = 0; j < clientsRes.body.clients.length; j++) {
      var clientId = clientsRes.body.clients[j].id;
      var tlRes = await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/clients/' + clientId + '/timeline',
        method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
      });

      var types = {};
      if (tlRes.body.timeline) {
        tlRes.body.timeline.forEach(function(item) {
          types[item.type] = (types[item.type] || 0) + 1;
        });
      }

      var typeCount = Object.keys(types).length;
      if (typeCount >= 2) {
        console.log('FOUND:', email, 'clientId:', clientId, 'total:', tlRes.body.total, 'types:', JSON.stringify(types));
      }
    }
  }
}

run().catch(function(e) { console.error('Error:', e.message); });
