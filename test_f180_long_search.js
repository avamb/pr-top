var base = 'http://localhost:3001';
var longQuery = 'a'.repeat(10000);
var email = 'search_long_f180_' + Date.now() + '@test.com';

async function test() {
  // Get CSRF token
  var csrfRes = await fetch(base + '/api/csrf-token');
  var csrfData = await csrfRes.json();
  var csrfToken = csrfData.csrfToken;
  var cookies = csrfRes.headers.get('set-cookie') || '';

  var headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
    'Cookie': cookies.split(';')[0]
  };

  // Register fresh
  var regRes = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({email: email, password:'StrongPwd1', role:'therapist'})
  });
  var regData = await regRes.json();
  var token = regData.token;
  if (!token) {
    console.log('No token:', JSON.stringify(regData).substring(0, 200));
    return;
  }
  console.log('Registered OK');

  var authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'x-csrf-token': csrfToken,
    'Cookie': cookies.split(';')[0]
  };
  var authGetHeaders = {
    'Authorization': 'Bearer ' + token
  };

  // Test 1: POST /api/search with 10K char query - should return 400
  var r1 = await fetch(base + '/api/search', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({query: longQuery})
  });
  var d1 = await r1.json();
  console.log('1. POST /api/search 10K:', r1.status, d1.error);
  console.log('   PASS:', r1.status === 400 ? 'YES' : 'NO');

  // Test 2: GET /api/clients?search=10K chars - should return 400
  var r2 = await fetch(base + '/api/clients?search=' + encodeURIComponent(longQuery), {
    headers: authGetHeaders
  });
  var d2 = await r2.json();
  console.log('2. GET /api/clients 10K:', r2.status, d2.error || 'no error');
  console.log('   PASS:', r2.status === 400 ? 'YES' : 'NO');

  // Test 3: GET diary search 10K - should return 400 (or 404 if no client)
  var r3 = await fetch(base + '/api/clients/1/diary?search=' + encodeURIComponent(longQuery), {
    headers: authGetHeaders
  });
  var d3 = await r3.json();
  console.log('3. GET diary 10K:', r3.status, d3.error || 'no error');
  console.log('   PASS:', r3.status === 400 ? 'YES (400 bad request)' : 'HANDLED (' + r3.status + ')');

  // Test 4: GET notes search 10K - should return 400
  var r4 = await fetch(base + '/api/clients/1/notes?search=' + encodeURIComponent(longQuery), {
    headers: authGetHeaders
  });
  var d4 = await r4.json();
  console.log('4. GET notes 10K:', r4.status, d4.error || 'no error');
  console.log('   PASS:', r4.status === 400 ? 'YES (400 bad request)' : 'HANDLED (' + r4.status + ')');

  // Test 5: Normal search still works (short query)
  var r5 = await fetch(base + '/api/search', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({query: 'test query'})
  });
  var d5 = await r5.json();
  console.log('5. POST /api/search normal:', r5.status, d5.success);
  console.log('   PASS:', r5.status === 200 ? 'YES' : 'NO');

  // Test 6: 501 chars should also be rejected
  var r6 = await fetch(base + '/api/clients?search=' + encodeURIComponent('b'.repeat(501)), {
    headers: authGetHeaders
  });
  var d6 = await r6.json();
  console.log('6. GET /api/clients 501 chars:', r6.status, d6.error || 'no error');
  console.log('   PASS:', r6.status === 400 ? 'YES' : 'NO');

  // Test 7: 500 chars should still work
  var r7 = await fetch(base + '/api/clients?search=' + encodeURIComponent('c'.repeat(500)), {
    headers: authGetHeaders
  });
  console.log('7. GET /api/clients 500 chars:', r7.status);
  console.log('   PASS:', r7.status === 200 ? 'YES' : 'NO (but not 400)');

  // Verify server still alive
  var healthRes = await fetch(base + '/api/health');
  var healthData = await healthRes.json();
  console.log('\nServer health after all tests:', healthData.status);
  console.log('SERVER DID NOT CRASH: YES');
}
test().catch(e => console.error('FATAL:', e));
