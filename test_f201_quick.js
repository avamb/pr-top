// Quick test: check if export endpoint returns proper response with a known token
var http = require('http');

// Read therapist token from previous test
// First register a fresh therapist and test export

function req(method, path, body, hdrs) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: '127.0.0.1', port: 3001, path: path, method: method,
      headers: Object.assign({'Content-Type':'application/json'}, hdrs || {})
    };
    var r = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { resolve({status: res.statusCode, headers: res.headers, body: d}); });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  // Login as our test therapist from before
  var csrfR = await req('GET', '/api/csrf-token');
  var csrf = JSON.parse(csrfR.body).csrfToken;

  var loginR = await req('POST', '/api/auth/login',
    { email: 'export_201c@example.com', password: 'TestPass1' },
    { 'x-csrf-token': csrf }
  );
  var loginData = JSON.parse(loginR.body);
  console.log('Login status:', loginR.status);

  if (!loginData.token) {
    console.log('No token, body:', loginR.body);
    return;
  }

  var token = loginData.token;

  // Try export for client 720
  var expR = await req('GET', '/api/clients/720/diary/export', null,
    { 'Authorization': 'Bearer ' + token }
  );
  console.log('Export status:', expR.status);
  console.log('Export headers:', JSON.stringify(expR.headers['content-disposition']));
  console.log('Export body (first 500):', expR.body.substring(0, 500));
}

main().catch(function(e) { console.error(e); });
