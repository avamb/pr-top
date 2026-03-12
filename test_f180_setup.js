// Setup test user for browser testing
async function run() {
  var base = 'http://localhost:3001';
  var csrfRes = await fetch(base + '/api/csrf-token');
  var csrfData = await csrfRes.json();
  var csrfToken = csrfData.csrfToken;
  var cookies = csrfRes.headers.get('set-cookie') || '';

  // Register therapist
  var regRes = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': cookies.split(';')[0]
    },
    body: JSON.stringify({email:'f180_browser@test.com', password:'StrongPwd1', role:'therapist'})
  });
  var regData = await regRes.json();
  console.log('Register:', regRes.status);
  console.log('Email: f180_browser@test.com');
  console.log('Password: StrongPwd1');
}
run().catch(e=>console.error(e));
