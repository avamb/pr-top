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
fetch('http://localhost:3001/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }) })
.then(function(r) {
  var token = JSON.parse(r.body).token;
  return fetch('http://localhost:3001/api/encryption/keys', { headers: { Authorization: 'Bearer ' + token } });
})
.then(function(r) {
  console.log(r.body);
})
.catch(function(e) { console.error(e); });
