async function test() {
  var base = 'http://localhost:3001';
  var csrfRes = await fetch(base + '/api/csrf-token');
  var csrfData = await csrfRes.json();
  var csrfToken = csrfData.csrfToken;
  var cookies = csrfRes.headers.get('set-cookie') || '';
  var email = 'f180v2_' + Date.now() + '@test.com';

  var regRes = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': cookies.split(';')[0]
    },
    body: JSON.stringify({email: email, password:'StrongPwd1', role:'therapist'})
  });
  var regData = await regRes.json();
  var token = regData.token;
  console.log('Token:', !!token);

  // Test with 501 chars directly
  var query501 = 'x'.repeat(501);
  console.log('Query length:', query501.length);

  var url = base + '/api/clients?search=' + query501;
  console.log('URL length:', url.length);

  var r = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  var body = await r.text();
  console.log('Status:', r.status);
  console.log('Body:', body.substring(0, 200));
}
test().catch(e => console.error(e));
