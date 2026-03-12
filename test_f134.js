const http = require('http');

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookies: res.headers['set-cookie'] }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get CSRF
  const csrfRes = await request('GET', '/api/csrf-token');
  const csrf = csrfRes.body.csrfToken;
  const cookieHeader = csrfRes.cookies ? csrfRes.cookies.map(c => c.split(';')[0]).join('; ') : '';
  const hdrs = { 'X-CSRF-Token': csrf, 'Cookie': cookieHeader };

  // Test 1: Empty body - both fields missing
  const t1 = await request('POST', '/api/auth/register', {}, hdrs);
  console.log('Test 1 - Empty body:');
  console.log('  Status:', t1.status);
  console.log('  Response:', JSON.stringify(t1.body));
  console.log('  Has missing_fields:', !!t1.body.missing_fields);
  console.log('  Missing fields:', t1.body.missing_fields);

  // Test 2: Only email - password missing
  const t2 = await request('POST', '/api/auth/register', { email: 'test@test.com' }, hdrs);
  console.log('\nTest 2 - Only email:');
  console.log('  Status:', t2.status);
  console.log('  Response:', JSON.stringify(t2.body));
  console.log('  Missing fields:', t2.body.missing_fields);

  // Test 3: Only password - email missing
  const t3 = await request('POST', '/api/auth/register', { password: 'TestPass1' }, hdrs);
  console.log('\nTest 3 - Only password:');
  console.log('  Status:', t3.status);
  console.log('  Response:', JSON.stringify(t3.body));
  console.log('  Missing fields:', t3.body.missing_fields);

  // Test 4: Login with empty body
  const t4 = await request('POST', '/api/auth/login', {}, hdrs);
  console.log('\nTest 4 - Login empty body:');
  console.log('  Status:', t4.status);
  console.log('  Response:', JSON.stringify(t4.body));
  console.log('  Missing fields:', t4.body.missing_fields);

  // Summary
  const pass1 = t1.status === 400 && t1.body.missing_fields && t1.body.missing_fields.includes('email') && t1.body.missing_fields.includes('password');
  const pass2 = t2.status === 400 && t2.body.missing_fields && t2.body.missing_fields.includes('password') && !t2.body.missing_fields.includes('email');
  const pass3 = t3.status === 400 && t3.body.missing_fields && t3.body.missing_fields.includes('email') && !t3.body.missing_fields.includes('password');
  const pass4 = t4.status === 400 && t4.body.missing_fields;

  console.log('\n=== RESULTS ===');
  console.log('Test 1 (both missing):', pass1 ? 'PASS' : 'FAIL');
  console.log('Test 2 (password missing):', pass2 ? 'PASS' : 'FAIL');
  console.log('Test 3 (email missing):', pass3 ? 'PASS' : 'FAIL');
  console.log('Test 4 (login empty):', pass4 ? 'PASS' : 'FAIL');
  console.log('ALL PASS:', pass1 && pass2 && pass3 && pass4);
}

main().catch(e => console.error('Error:', e));
