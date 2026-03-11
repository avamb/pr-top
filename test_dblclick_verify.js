var http = require('http');

function req(method, path, body, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: headers || {}, timeout: 10000
    };
    if (body) opts.headers['Content-Type'] = 'application/json';
    var r = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  var login = await req('POST', '/api/auth/login', { email: 'dblclickfinal@test.com', password: 'Test123!' });
  console.log('Login status:', login.message ? 'OK' : login.error);
  console.log('User ID:', login.user ? login.user.id : 'N/A');

  var login2 = await req('POST', '/api/auth/register', { email: 'dblclickfinal@test.com', password: 'Test123!' });
  console.log('Duplicate register attempt:', login2.error || 'unexpected success');

  if (login2.error && login2.error.includes('already exists')) {
    console.log('PASS: Backend correctly rejects duplicate email');
  }

  console.log('\nVerification complete');
}

main().catch(function(e) { console.error('Error:', e.message); });
