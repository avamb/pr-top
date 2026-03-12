async function run() {
  var base = 'http://localhost:3001';
  var csrfRes = await fetch(base + '/api/csrf-token');
  var csrfData = await csrfRes.json();
  var csrfToken = csrfData.csrfToken;
  var cookies = csrfRes.headers.get('set-cookie') || '';
  var h = {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
    'Cookie': cookies.split(';')[0]
  };

  var loginRes = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: h,
    body: JSON.stringify({email:'f181_therapist@test.com', password:'StrongPwd1'})
  });
  var token = (await loginRes.json()).token;

  // Test POST /api/search with nonexistent term
  var r = await fetch(base + '/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'x-csrf-token': csrfToken,
      'Cookie': cookies.split(';')[0]
    },
    body: JSON.stringify({query: 'zzzzzz_nonexistent_term_xxxxxx'})
  });
  var data = await r.json();
  console.log('POST /api/search nonexistent:', r.status);
  console.log('Response:', JSON.stringify(data));
  console.log('Has results array:', Array.isArray(data.results));
  console.log('Results count:', data.results ? data.results.length : 'N/A');
  console.log('No crash:', r.status !== 500 ? 'YES' : 'NO');
}
run().catch(e => console.error(e));
