var http = require('http');

function req(method, path, body, token) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    var r = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ s: res.statusCode, b: JSON.parse(data) }); }
        catch(e) { resolve({ s: res.statusCode, b: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  // Register
  var reg = await req('POST', '/api/auth/register', { email: 'diag_' + Date.now() + '@t.com', password: 'TestPass123' });
  process.stdout.write('Register: ' + reg.s + '\n');
  var tk = reg.b.token;

  // Try change-plan
  var cp = await req('POST', '/api/subscription/change-plan', { plan: 'pro' }, tk);
  process.stdout.write('Change-plan status: ' + cp.s + '\n');
  process.stdout.write('Change-plan body: ' + JSON.stringify(cp.b).substring(0, 300) + '\n');

  // Check subscription current
  var sc = await req('GET', '/api/subscription/current', null, tk);
  process.stdout.write('Sub current: ' + sc.s + ' ' + JSON.stringify(sc.b).substring(0, 200) + '\n');
}

run().catch(function(e) { process.stdout.write('ERR: ' + e.message + '\n'); });
