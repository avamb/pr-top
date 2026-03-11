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
  // Login as admin to get therapist list
  var loginData = JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' });
  var loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, loginData);
  var token = loginRes.body.token;

  // Get therapists
  var therapistsRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/admin/therapists',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Therapists:', therapistsRes.status);
  if (therapistsRes.body.therapists) {
    therapistsRes.body.therapists.forEach(function(t) {
      console.log('  ID:', t.id, 'Email:', t.email, 'Name:', t.name);
    });
  }

  // Try logging in as each therapist
  var therapists = therapistsRes.body.therapists || [];
  for (var i = 0; i < Math.min(therapists.length, 5); i++) {
    var t = therapists[i];
    var tData = JSON.stringify({ email: t.email, password: 'Test123!' });
    var tRes = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': tData.length }
    }, tData);
    if (tRes.status === 200) {
      console.log('Logged in as:', t.email);
      // Check clients
      var cRes = await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/clients',
        method: 'GET', headers: { 'Authorization': 'Bearer ' + tRes.body.token }
      });
      var clientCount = cRes.body.clients ? cRes.body.clients.length : 0;
      console.log('  Clients:', clientCount);
      if (clientCount > 0) {
        console.log('  First client ID:', cRes.body.clients[0].id);
        // Check timeline
        var tlRes = await makeRequest({
          hostname: 'localhost', port: 3001, path: '/api/clients/' + cRes.body.clients[0].id + '/timeline',
          method: 'GET', headers: { 'Authorization': 'Bearer ' + tRes.body.token }
        });
        console.log('  Timeline items:', tlRes.body.total);
        var types = {};
        if (tlRes.body.timeline) {
          tlRes.body.timeline.forEach(function(item) {
            types[item.type] = (types[item.type] || 0) + 1;
          });
        }
        console.log('  Types:', JSON.stringify(types));
      }
    }
  }
}

run().catch(function(e) { console.error('Error:', e.message); });
