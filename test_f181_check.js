async function run() {
  var base = 'http://localhost:3001';
  var csrfRes = await fetch(base + '/api/csrf-token');
  var csrfData = await csrfRes.json();
  var csrfToken = csrfData.csrfToken;
  var cookies = csrfRes.headers.get('set-cookie') || '';

  var loginRes = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': cookies.split(';')[0]
    },
    body: JSON.stringify({email:'f181_therapist@test.com', password:'StrongPwd1'})
  });
  var loginData = await loginRes.json();
  var token = loginData.token;
  console.log('Token:', !!token);

  // List all clients (even without consent)
  var r = await fetch(base + '/api/clients', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var data = await r.json();
  console.log('Clients:', JSON.stringify(data).substring(0, 500));
}
run().catch(e => console.error(e));
