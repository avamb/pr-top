const http = require('http');

let csrfToken = null;
let cookies = '';

function fetch(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path, method,
      headers: { 'Content-Type': 'application/json', 'Connection': 'close' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (csrfToken) opts.headers['x-csrf-token'] = csrfToken;
    if (cookies) opts.headers['Cookie'] = cookies;
    const req = http.request(opts, res => {
      let data = '';
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        const parts = setCookies.map(c => c.split(';')[0]);
        cookies = parts.join('; ');
      }
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); }
        catch(e) { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Get CSRF token first
  let r = await fetch('GET', '/api/csrf-token');
  csrfToken = r.body.csrfToken || r.body.token;
  console.log('CSRF token obtained:', !!csrfToken);

  // Login as superadmin
  r = await fetch('POST', '/api/auth/login', { email: 'admin@psylink.app', password: 'Admin123!' });
  console.log('Admin login:', r.status, 'role:', r.body.user && r.body.user.role);
  if (r.status !== 200) { console.log('Login failed:', JSON.stringify(r.body)); process.exit(1); }
  const adminToken = r.body.token;

  // Step 1: Check current keys - debug full response
  r = await fetch('GET', '/api/encryption/keys', null, adminToken);
  console.log('Keys GET status:', r.status, 'body:', JSON.stringify(r.body).substring(0, 200));

  // Step 1b: Encrypt data with current key
  r = await fetch('POST', '/api/encryption/encrypt', { plaintext: 'ROTATION_TEST_OLD_DATA_12345' }, adminToken);
  console.log('Encrypt status:', r.status, 'body:', JSON.stringify(r.body).substring(0, 200));

  if (r.status !== 200) {
    console.log('Encrypt failed! Full body:', JSON.stringify(r.body));
    // Try getting active version first
    const av = await fetch('GET', '/api/encryption/active-version', null, adminToken);
    console.log('Active version:', JSON.stringify(av.body));
  }

  const oldEncrypted = r.body.encrypted;
  const oldKeyVersion = r.body.key_version;
  console.log('Old data encrypted with key version:', oldKeyVersion);

  // Step 2: Rotate encryption key
  r = await fetch('POST', '/api/encryption/rotate', null, adminToken);
  console.log('Rotation:', r.status, JSON.stringify(r.body).substring(0, 300));
  const newVersion = r.body.new_version;

  // Step 3: Encrypt new data
  r = await fetch('POST', '/api/encryption/encrypt', { plaintext: 'ROTATION_TEST_NEW_DATA_67890' }, adminToken);
  console.log('New encrypt:', r.status, JSON.stringify(r.body).substring(0, 200));
  const newEncrypted = r.body.encrypted;
  const newKeyVersion = r.body.key_version;

  // Step 4: Verify old data still decryptable
  if (oldEncrypted) {
    r = await fetch('POST', '/api/encryption/decrypt', { encrypted: oldEncrypted }, adminToken);
    console.log('Decrypt old:', r.status, JSON.stringify(r.body));
    var oldDecrypted = r.body.plaintext;
  } else {
    console.log('SKIP decrypt old - no encrypted data');
    var oldDecrypted = null;
  }

  // Decrypt new data
  if (newEncrypted) {
    r = await fetch('POST', '/api/encryption/decrypt', { encrypted: newEncrypted }, adminToken);
    console.log('Decrypt new:', r.status, JSON.stringify(r.body));
    var newDecrypted = r.body.plaintext;
  } else {
    console.log('SKIP decrypt new - no encrypted data');
    var newDecrypted = null;
  }

  // Step 5: Verify key statuses
  r = await fetch('GET', '/api/encryption/keys', null, adminToken);
  console.log('Keys after:', r.status, JSON.stringify(r.body).substring(0, 500));
  const keysAfter = r.body.keys || [];

  // === VERIFICATION ===
  console.log('\n=== VERIFICATION RESULTS ===');
  const checks = [];

  const c1 = newKeyVersion === newVersion;
  checks.push(c1);
  console.log('CHECK 1 - New data uses new key:', c1 ? 'PASS' : 'FAIL', '(expected', newVersion, 'got', newKeyVersion, ')');

  const c2 = newKeyVersion > oldKeyVersion;
  checks.push(c2);
  console.log('CHECK 2 - Version incremented:', c2 ? 'PASS' : 'FAIL', '(', oldKeyVersion, '->', newKeyVersion, ')');

  const c3 = oldDecrypted === 'ROTATION_TEST_OLD_DATA_12345';
  checks.push(c3);
  console.log('CHECK 3 - Old data decrypts:', c3 ? 'PASS' : 'FAIL', '(got:', oldDecrypted, ')');

  const c4 = newDecrypted === 'ROTATION_TEST_NEW_DATA_67890';
  checks.push(c4);
  console.log('CHECK 4 - New data decrypts:', c4 ? 'PASS' : 'FAIL', '(got:', newDecrypted, ')');

  const oldKeyRec = keysAfter.find(k => k.key_version === oldKeyVersion);
  const c5 = oldKeyRec && oldKeyRec.status === 'rotated';
  checks.push(c5);
  console.log('CHECK 5 - Old key rotated:', c5 ? 'PASS' : 'FAIL');

  const newKeyRec = keysAfter.find(k => k.key_version === newKeyVersion);
  const c6 = newKeyRec && newKeyRec.status === 'active';
  checks.push(c6);
  console.log('CHECK 6 - New key active:', c6 ? 'PASS' : 'FAIL');

  const c7 = oldKeyRec && oldKeyRec.rotated_at !== null;
  checks.push(c7);
  console.log('CHECK 7 - Old key has rotated_at:', c7 ? 'PASS' : 'FAIL');

  const c8 = oldEncrypted && newEncrypted && oldEncrypted.split(':')[0] === String(oldKeyVersion) && newEncrypted.split(':')[0] === String(newKeyVersion);
  checks.push(c8);
  console.log('CHECK 8 - Version prefix correct:', c8 ? 'PASS' : 'FAIL');

  const allPassed = checks.every(c => c);
  console.log('\n' + (allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
  process.exit(allPassed ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
