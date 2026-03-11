const http = require('http');

function makeReq(method, path, body, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
    };
    var req = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Feature #81: Payment history ===\n');

  // Get CSRF
  var csrfRes = await makeReq('GET', '/api/csrf-token');
  var csrfToken = csrfRes.data.csrfToken;
  console.log('CSRF:', csrfToken ? 'OK' : 'FAIL');

  // Register
  var email = 'pay81_' + Date.now() + '@test.com';
  var reg = await makeReq('POST', '/api/auth/register',
    { email: email, password: 'Test1234!' },
    { 'x-csrf-token': csrfToken }
  );
  console.log('Register:', reg.status, reg.data.token ? 'OK' : JSON.stringify(reg.data));
  var token = reg.data.token;
  if (!token) { process.exit(1); }
  var auth = { 'Authorization': 'Bearer ' + token };

  // Check subscription
  var sub = await makeReq('GET', '/api/subscription/current', null, auth);
  console.log('Subscription:', JSON.stringify(sub.data.subscription));

  // Check initial payments
  var p0 = await makeReq('GET', '/api/subscription/payments', null, auth);
  console.log('Initial payments count:', p0.data.payments ? p0.data.payments.length : JSON.stringify(p0.data));

  // Try checkout
  var checkout = await makeReq('POST', '/api/subscription/checkout', { plan: 'pro' }, auth);
  console.log('Checkout status:', checkout.status);
  console.log('Checkout response:', JSON.stringify(checkout.data));

  // Check payments after checkout
  var p1 = await makeReq('GET', '/api/subscription/payments', null, auth);
  console.log('Payments after checkout:', JSON.stringify(p1.data));

  console.log('\nEmail:', email);
  console.log('Token:', token);
}

run().catch(function(e) { console.error(e); process.exit(1); });
