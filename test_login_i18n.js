async function main() {
  // Get CSRF token through Vite proxy
  var csrfRes = await fetch('http://localhost:3002/api/csrf-token');
  var csrfData = await csrfRes.json();
  var csrfToken = csrfData.csrfToken;
  console.log('CSRF token:', csrfToken);

  // Login through Vite proxy
  var loginRes = await fetch('http://localhost:3002/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' })
  });
  var loginData = await loginRes.json();
  console.log('Login response:', JSON.stringify(loginData));

  if (loginData.token) {
    console.log('TOKEN=' + loginData.token);
  }
}
main().catch(e => console.error(e));
