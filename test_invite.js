const http = require('http');

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    if (data && data._token) {
      options.headers['Authorization'] = 'Bearer ' + data._token;
      delete data._token;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function makeAuthRequest(method, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Testing Invite Code Feature ===\n');

  // Step 1: Register a therapist
  console.log('1. Registering test therapist...');
  const regResult = await makeRequest('POST', '/api/auth/register', {
    email: 'invite_test_' + Date.now() + '@example.com',
    password: 'TestPass123',
    role: 'therapist'
  });
  console.log('   Status:', regResult.status);
  console.log('   Data:', JSON.stringify(regResult.data));

  if (regResult.status !== 201) {
    console.log('Registration failed, trying login...');
    return;
  }

  const token = regResult.data.token;
  console.log('   Token obtained: YES\n');

  // Step 2: Get invite code
  console.log('2. Getting invite code...');
  const getResult = await makeAuthRequest('GET', '/api/invite-code', token);
  console.log('   Status:', getResult.status);
  console.log('   Data:', JSON.stringify(getResult.data));
  const originalCode = getResult.data.invite_code;
  console.log('   Invite code:', originalCode);
  console.log('   Is alphanumeric:', /^[a-zA-Z0-9-]+$/.test(originalCode));
  console.log('   Length:', originalCode ? originalCode.length : 0, '\n');

  // Step 3: Regenerate invite code
  console.log('3. Regenerating invite code...');
  const regenResult = await makeAuthRequest('POST', '/api/invite-code/regenerate', token);
  console.log('   Status:', regenResult.status);
  console.log('   Data:', JSON.stringify(regenResult.data));
  const newCode = regenResult.data.invite_code;
  console.log('   New code:', newCode);
  console.log('   Different from original:', originalCode !== newCode);
  console.log('   Is alphanumeric:', /^[a-zA-Z0-9-]+$/.test(newCode));
  console.log('   Length:', newCode ? newCode.length : 0, '\n');

  // Step 4: Verify new code persists on re-fetch
  console.log('4. Verifying code persists...');
  const verifyResult = await makeAuthRequest('GET', '/api/invite-code', token);
  console.log('   Status:', verifyResult.status);
  console.log('   Code matches regenerated:', verifyResult.data.invite_code === newCode);

  // Step 5: Verify unauthenticated access denied
  console.log('\n5. Testing unauthenticated access...');
  const unauthResult = await makeAuthRequest('GET', '/api/invite-code', 'invalid-token');
  console.log('   Status:', unauthResult.status, '(expected 401)');

  console.log('\n=== All tests completed ===');
}

main().catch(console.error);
