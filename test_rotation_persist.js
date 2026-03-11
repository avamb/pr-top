var http = require('http');
function fetch(url, opts) {
  opts = opts || {};
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var options = { hostname: u.hostname, port: u.port, path: u.pathname, method: opts.method || 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}) };
    var req = http.request(options, function(res) { var data = ''; res.on('data', function(c) { data += c; }); res.on('end', function() { resolve({ status: res.statusCode, body: data }); }); });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// After restart, verify keys are still there
fetch('http://localhost:3001/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }) })
.then(function(r) {
  var token = JSON.parse(r.body).token;
  return fetch('http://localhost:3001/api/encryption/keys', { headers: { Authorization: 'Bearer ' + token } })
  .then(function(r2) {
    var d = JSON.parse(r2.body);
    console.log('Keys after restart:');
    d.keys.forEach(function(k) { console.log('  v' + k.key_version + ': ' + k.status); });
    console.log('Active version:', d.active_version);

    // Try decrypting old data with old key
    return fetch('http://localhost:3001/api/encryption/encrypt', { method: 'POST', body: JSON.stringify({ plaintext: 'PERSIST_CHECK_' + Date.now() }), headers: { Authorization: 'Bearer ' + token } });
  })
  .then(function(r3) {
    var d = JSON.parse(r3.body);
    console.log('New encrypt uses version:', d.key_version);
    console.log(d.key_version === 3 ? 'PASS: uses latest key' : 'FAIL');
  });
})
.catch(function(e) { console.error(e); });
