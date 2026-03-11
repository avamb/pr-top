const http = require('http');

function makeRequest(method, path, body, headers) {
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
  console.log('=== Feature #81: Payment history visible to therapist ===\n');

  // Step 1: Get CSRF token
  var csrf = await makeRequest('GET', '/api/csrf-token');
  var csrfToken = csrf.data.csrfToken;
  console.log('1. CSRF token:', csrfToken ? 'OK' : 'FAIL');

  // Step 2: Register therapist
  var email = 'pay81_' + Date.now() + '@test.com';
  var reg = await makeRequest('POST', '/api/auth/register',
    { email: email, password: 'Test1234!' },
    { 'x-csrf-token': csrfToken }
  );
  console.log('2. Register:', reg.status, reg.data.token ? 'got token' : reg.data.error);
  var token = reg.data.token;
  if (!token) { console.log('ABORT: no token'); process.exit(1); }

  var auth = { 'Authorization': 'Bearer ' + token };

  // Step 3: Check initial payments (should be empty)
  var p0 = await makeRequest('GET', '/api/subscription/payments', null, auth);
  console.log('3. Initial payments:', p0.data.payments ? p0.data.payments.length : 'ERROR');

  // Step 4: Upgrade to Pro (creates payment in dev mode)
  var up1 = await makeRequest('POST', '/api/subscription/checkout', { plan: 'pro' }, auth);
  console.log('4. Upgrade to Pro:', up1.status, up1.data.auto_completed ? 'auto-completed' : up1.data.error);

  // Step 5: Check payments after Pro upgrade
  var p1 = await makeRequest('GET', '/api/subscription/payments', null, auth);
  console.log('5. Payments after Pro:', p1.data.payments ? p1.data.payments.length : 'ERROR');

  if (p1.data.payments && p1.data.payments.length > 0) {
    var pay = p1.data.payments[0];
    console.log('   Amount:', pay.amount, '(expected 4900)');
    console.log('   Currency:', pay.currency);
    console.log('   Status:', pay.status);
    console.log('   Date:', pay.created_at);
    console.log('   Payment ID:', pay.stripe_payment_intent_id);

    var amountOk = pay.amount === 4900;
    var dateOk = !!pay.created_at;
    var statusOk = pay.status === 'succeeded';

    console.log('\n--- Verification ---');
    console.log('Amount correct (4900):', amountOk ? 'PASS' : 'FAIL');
    console.log('Has date:', dateOk ? 'PASS' : 'FAIL');
    console.log('Status succeeded:', statusOk ? 'PASS' : 'FAIL');

    if (amountOk && dateOk && statusOk) {
      console.log('\nAll API checks PASSED');
    } else {
      console.log('\nSome API checks FAILED');
      process.exit(1);
    }
  } else {
    console.log('\nFAILED: No payments found');
    process.exit(1);
  }

  // Step 6: Upgrade to Premium (second payment)
  var up2 = await makeRequest('POST', '/api/subscription/checkout', { plan: 'premium' }, auth);
  console.log('\n6. Upgrade to Premium:', up2.status, up2.data.auto_completed ? 'auto-completed' : up2.data.error);

  var p2 = await makeRequest('GET', '/api/subscription/payments', null, auth);
  console.log('7. Payments after Premium:', p2.data.payments ? p2.data.payments.length : 'ERROR');
  if (p2.data.payments) {
    p2.data.payments.forEach(function(p, i) {
      console.log('   [' + (i+1) + '] $' + (p.amount/100).toFixed(2) + ' ' + p.status + ' ' + p.created_at);
    });
  }

  // Step 7: Test 401 without auth
  var noAuth = await makeRequest('GET', '/api/subscription/payments');
  console.log('\n8. Without auth:', noAuth.status === 401 ? 'PASS (401)' : 'FAIL (' + noAuth.status + ')');

  console.log('\n=== Login credentials for browser test ===');
  console.log('Email:', email);
  console.log('Password: Test1234!');
  console.log('Token:', token);
}

run().catch(function(e) { console.error('Error:', e); process.exit(1); });
