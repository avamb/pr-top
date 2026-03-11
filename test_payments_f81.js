var http = require('http');

function req(method, path, body, token) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    var r = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve(d); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// Get CSRF first, then register with CSRF
var http2 = require('http');
var csrfReq = http2.get('http://localhost:3001/api/csrf-token', function(res) {
  var d = '';
  res.on('data', function(c) { d += c; });
  res.on('end', function() {
    var csrf = JSON.parse(d).csrfToken;
    console.log('CSRF:', csrf ? 'OK' : 'FAIL');

    var email = 'pay_f81_' + Date.now() + '@test.com';
    var regOpts = {
      hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }
    };
    var regReq = http2.request(regOpts, function(res2) {
      var rd = '';
      res2.on('data', function(c) { rd += c; });
      res2.on('end', function() {
        var regData = JSON.parse(rd);
        var token = regData.token;
        console.log('Register:', token ? 'OK (' + email + ')' : JSON.stringify(regData));
        if (!token) { process.exit(1); }

        // GET payments (empty initially)
        req('GET', '/api/subscription/payments', null, token).then(function(p) {
          console.log('Initial payments:', JSON.stringify(p));

          // Upgrade to pro (has Authorization header, so CSRF exempt)
          req('POST', '/api/subscription/checkout', {plan: 'pro'}, token).then(function(up) {
            console.log('Upgrade:', JSON.stringify(up));

            // Wait 1 second then check payments
            setTimeout(function() {
              req('GET', '/api/subscription/payments', null, token).then(function(p2) {
                console.log('Payments after upgrade:', JSON.stringify(p2));
                var payments = p2.payments || [];
                console.log('Count: ' + payments.length);
                payments.forEach(function(p) {
                  console.log('  $' + (p.amount/100).toFixed(2) + ' ' + p.status + ' at ' + p.created_at);
                });
                process.exit(0);
              });
            }, 1000);
          }).catch(function(e) { console.error('Upgrade error:', e); process.exit(1); });
        });
      });
    });
    regReq.write(JSON.stringify({email: email, password: 'Test1234!'}));
    regReq.end();
  });
});
