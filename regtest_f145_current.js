// Regression test for features 1, 4, 5
async function main() {
  // Feature 1: Health endpoint
  console.log('=== Feature 1: Health Endpoint ===');
  var r1 = await fetch('http://localhost:3000/api/health');
  var h = await r1.json();
  console.log('Status:', r1.status);
  console.log('Database:', h.database);
  console.log('Table count:', h.tableCount);
  console.log('Feature 1 PASS:', r1.status === 200 && h.database === 'connected' && h.tableCount > 0);

  // Feature 5: Real database queries - get CSRF then register
  console.log('\n=== Feature 5: Real Database Queries ===');
  var r2 = await fetch('http://localhost:3000/api/csrf-token');
  var csrf = await r2.json();
  console.log('CSRF token obtained:', !!csrf.csrfToken);

  var r3 = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf.csrfToken
    },
    body: JSON.stringify({
      email: 'regtest_f145_apr5_' + Date.now() + '@test.com',
      password: 'TestPass123!',
      name: 'RegTest User',
      language: 'en'
    })
  });
  var reg = await r3.json();
  console.log('Register status:', r3.status);
  console.log('Register response:', JSON.stringify(reg).substring(0, 200));
  console.log('Has token:', !!(reg.token || (r3.headers.get('set-cookie') && r3.headers.get('set-cookie').includes('session'))));

  // Test /api/auth/me with token
  if (reg.token) {
    var r4 = await fetch('http://localhost:3000/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + reg.token }
    });
    var me = await r4.json();
    console.log('Auth/me status:', r4.status);
    console.log('Auth/me has user:', !!me.user || !!me.email || !!me.id);
    console.log('Feature 5 PASS:', r3.status === 201 || r3.status === 200);
  } else {
    // Try cookie-based auth
    var cookies = r3.headers.get('set-cookie');
    console.log('Cookies set:', !!cookies);
    console.log('Feature 5 PASS:', (r3.status === 201 || r3.status === 200) && !!reg.user);
  }
}
main().catch(e => console.error('ERROR:', e.message));
