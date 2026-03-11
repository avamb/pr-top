var http = require('http');

function fetch(url, opts) {
  opts = opts || {};
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
    };
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function json(r) { return JSON.parse(r.body); }

var BASE = 'http://localhost:3001/api';
var BOT = { 'x-bot-api-key': 'dev-bot-api-key' };
var passed = true;
var token;

// Login as superadmin
fetch(BASE + '/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }) })
.then(function(r) {
  var d = json(r);
  token = d.token;
  console.log('1. Login:', r.status);

  // Step 1: Check current keys
  return fetch(BASE + '/encryption/keys', { headers: { Authorization: 'Bearer ' + token } });
})
.then(function(r) {
  var d = json(r);
  console.log('2. Current keys:', r.status, JSON.stringify(d).substring(0, 200));
  var initialKeyCount = d.keys ? d.keys.length : 0;
  console.log('   Key count:', initialKeyCount);

  // Step 2: Encrypt data with current key
  return fetch(BASE + '/encryption/encrypt', { method: 'POST', body: JSON.stringify({ plaintext: 'ROTATION_TEST_BEFORE_' + Date.now() }), headers: { Authorization: 'Bearer ' + token } });
})
.then(function(r) {
  var d = json(r);
  console.log('3. Encrypt with old key:', r.status);
  console.log('   key_version:', d.key_version);
  console.log('   encrypted (first 60):', d.encrypted && d.encrypted.substring(0, 60));
  var oldEncrypted = d.encrypted;
  var oldKeyVersion = d.key_version;

  // Step 3: Rotate key
  return fetch(BASE + '/encryption/rotate', { method: 'POST', body: JSON.stringify({}), headers: { Authorization: 'Bearer ' + token } })
  .then(function(r2) {
    var d2 = json(r2);
    console.log('\n4. Rotate key:', r2.status);
    console.log('   message:', d2.message);
    console.log('   new_version:', d2.new_version);
    console.log('   old_version_status:', d2.old_version_status);
    if (d2.new_version <= oldKeyVersion) { console.log('   FAIL: new version should be > old'); passed = false; }
    var newKeyVersion = d2.new_version;

    // Step 4: Encrypt new data with new key
    return fetch(BASE + '/encryption/encrypt', { method: 'POST', body: JSON.stringify({ plaintext: 'ROTATION_TEST_AFTER_' + Date.now() }), headers: { Authorization: 'Bearer ' + token } })
    .then(function(r3) {
      var d3 = json(r3);
      console.log('\n5. Encrypt with new key:', r3.status);
      console.log('   key_version:', d3.key_version);
      if (d3.key_version !== newKeyVersion) { console.log('   FAIL: should use new key version'); passed = false; }
      else { console.log('   PASS: uses new key version'); }
      var newEncrypted = d3.encrypted;

      // Step 5: Decrypt OLD data (should still work)
      return fetch(BASE + '/encryption/decrypt', { method: 'POST', body: JSON.stringify({ encrypted: oldEncrypted }), headers: { Authorization: 'Bearer ' + token } });
    })
    .then(function(r4) {
      var d4 = json(r4);
      console.log('\n6. Decrypt OLD data:', r4.status);
      console.log('   decrypted:', d4.plaintext && d4.plaintext.substring(0, 40));
      var oldDecryptOk = d4.plaintext && d4.plaintext.startsWith('ROTATION_TEST_BEFORE_');
      console.log('   Old data still decryptable:', oldDecryptOk ? 'PASS' : 'FAIL');
      if (!oldDecryptOk) passed = false;

      // Step 6: Verify keys table shows rotation status
      return fetch(BASE + '/encryption/keys', { headers: { Authorization: 'Bearer ' + token } });
    })
    .then(function(r5) {
      var d5 = json(r5);
      console.log('\n7. Check keys after rotation:', r5.status);
      if (d5.keys) {
        d5.keys.forEach(function(k) {
          console.log('   Key v' + k.version + ': status=' + k.status);
        });
        var hasActive = d5.keys.some(function(k) { return k.status === 'active'; });
        var hasRotated = d5.keys.some(function(k) { return k.status === 'rotated'; });
        console.log('   Has active key:', hasActive ? 'PASS' : 'FAIL');
        console.log('   Has rotated key:', hasRotated ? 'PASS' : 'FAIL');
        if (!hasActive || !hasRotated) passed = false;
      } else {
        console.log('   FAIL: no keys returned');
        passed = false;
      }

      if (passed) {
        console.log('\n=== ALL FEATURE #52 TESTS PASSED ===');
      } else {
        console.log('\n=== SOME TESTS FAILED ===');
      }
    });
  });
})
.catch(function(e) { console.error('ERROR:', e.message); });
