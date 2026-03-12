const http = require('http');

function req(method, urlPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    var headers = Object.assign({}, extraHeaders || {});
    var data;
    if (body) {
      data = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    var r = http.request({ hostname: '127.0.0.1', port: 3001, path: urlPath, method: method, headers: headers }, function(res) {
      var b = '';
      res.on('data', function(c) { b += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  var csrf = await req('GET', '/api/csrf-token');
  var csrfToken = csrf.body.csrfToken;

  var login = await req('POST', '/api/auth/login',
    { email: 'browser170@test.com', password: 'TestPass1' },
    { 'X-CSRF-Token': csrfToken });
  var token = login.body.token;

  // Get sessions for client
  var sessions = await req('GET', '/api/clients/624/sessions', null, { 'Authorization': 'Bearer ' + token });
  console.log('Sessions:', JSON.stringify(sessions.body).substring(0, 300));

  // Get stats before delete
  var stats1 = await req('GET', '/api/dashboard/stats', null, { 'Authorization': 'Bearer ' + token });
  console.log('Stats before:', JSON.stringify(stats1.body));

  // Find session ID
  var sessionId = null;
  if (sessions.body.sessions && sessions.body.sessions.length > 0) {
    sessionId = sessions.body.sessions[0].id;
  }
  console.log('Session ID to delete:', sessionId);

  if (sessionId) {
    // Delete the session
    var del = await req('DELETE', '/api/sessions/' + sessionId, null,
      { 'Authorization': 'Bearer ' + token, 'X-CSRF-Token': csrfToken });
    console.log('Delete result:', del.status, JSON.stringify(del.body));

    // Stats after delete
    var stats2 = await req('GET', '/api/dashboard/stats', null, { 'Authorization': 'Bearer ' + token });
    console.log('Stats after:', JSON.stringify(stats2.body));
    console.log('Session count changed:', stats1.body.sessions, '->', stats2.body.sessions);
  }
}

run().catch(function(e) { console.error(e); process.exit(1); });
