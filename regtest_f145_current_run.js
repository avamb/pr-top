async function main() {
  // Feature 5: Test that API queries real database
  console.log('=== Feature 5: Backend API queries real database ===');

  // Step 1: Health check
  console.log('\n--- Step 1: GET /api/health ---');
  const healthRes = await fetch('http://localhost:3001/api/health');
  const healthData = await healthRes.json();
  console.log('Status:', healthRes.status);
  console.log('Database:', healthData.database);
  console.log('Table count:', healthData.tableCount);

  // Step 2: Get CSRF token
  console.log('\n--- Step 2: Get CSRF token ---');
  const csrfRes = await fetch('http://localhost:3001/api/csrf-token');
  const csrfData = await csrfRes.json();
  console.log('CSRF token obtained:', csrfData.csrfToken ? 'yes' : 'no');

  // Step 3: Register test user
  console.log('\n--- Step 3: POST /api/auth/register ---');
  const regRes = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfData.csrfToken
    },
    body: JSON.stringify({
      email: 'regtest_f5_apr5_run@test.com',
      password: 'TestPass123!',
      name: 'RegTest F5 Run'
    })
  });
  const regText = await regRes.text();
  console.log('Status:', regRes.status);
  console.log('Result:', regText);

  // Step 4: If registered, try login and /api/auth/me
  if (regRes.status === 201 || regRes.status === 200) {
    const regData = JSON.parse(regText);
    const token = regData.token;

    console.log('\n--- Step 4: GET /api/auth/me (authenticated) ---');
    const meRes = await fetch('http://localhost:3001/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-csrf-token': csrfData.csrfToken
      }
    });
    const meData = await meRes.json();
    console.log('Status:', meRes.status);
    console.log('User:', JSON.stringify(meData).substring(0, 200));
  } else if (regRes.status === 409) {
    // User already exists, try login
    console.log('\n--- Step 4: POST /api/auth/login (existing user) ---');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfData.csrfToken
      },
      body: JSON.stringify({
        email: 'regtest_f5_apr5_run@test.com',
        password: 'TestPass123!'
      })
    });
    const loginText = await loginRes.text();
    console.log('Login Status:', loginRes.status);
    console.log('Login Result:', loginText.substring(0, 200));

    if (loginRes.status === 200) {
      const loginData = JSON.parse(loginText);
      const token = loginData.token;

      console.log('\n--- Step 5: GET /api/auth/me (authenticated) ---');
      const meRes = await fetch('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-csrf-token': csrfData.csrfToken
        }
      });
      const meData = await meRes.json();
      console.log('Status:', meRes.status);
      console.log('User:', JSON.stringify(meData).substring(0, 200));
    }
  }

  console.log('\n=== Feature 5 test complete ===');
}

main().catch(e => console.error('Error:', e));
