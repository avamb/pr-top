const http = require('http');

function makeRequest(method, path, data, headers) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

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

const botHeaders = { 'x-bot-api-key': 'dev-bot-api-key' };

async function main() {
  console.log('=== Testing Client Connect via Invite Code ===\n');

  const ts = Date.now();

  // Step 1: Register a therapist via bot
  console.log('1. Registering therapist via bot...');
  const therapistReg = await makeRequest('POST', '/api/bot/register', {
    telegram_id: `therapist_${ts}`,
    role: 'therapist'
  }, botHeaders);
  console.log('   Status:', therapistReg.status);
  const therapistInviteCode = therapistReg.data.user.invite_code;
  const therapistId = therapistReg.data.user.id;
  console.log('   Therapist ID:', therapistId);
  console.log('   Invite code:', therapistInviteCode, '\n');

  // Step 2: Register a client via bot
  console.log('2. Registering client via bot...');
  const clientReg = await makeRequest('POST', '/api/bot/register', {
    telegram_id: `client_${ts}`,
    role: 'client'
  }, botHeaders);
  console.log('   Status:', clientReg.status);
  const clientId = clientReg.data.user.id;
  console.log('   Client ID:', clientId, '\n');

  // Step 3: Client enters invite code
  console.log('3. Client enters invite code to connect...');
  const connectResult = await makeRequest('POST', '/api/bot/connect', {
    telegram_id: `client_${ts}`,
    invite_code: therapistInviteCode
  }, botHeaders);
  console.log('   Status:', connectResult.status);
  console.log('   Data:', JSON.stringify(connectResult.data));
  console.log('   Found therapist:', connectResult.data.therapist?.id === therapistId);
  console.log('   Requires consent:', connectResult.data.requires_consent, '\n');

  // Step 4: Test invalid invite code
  console.log('4. Testing invalid invite code...');
  const invalidResult = await makeRequest('POST', '/api/bot/connect', {
    telegram_id: `client_${ts}`,
    invite_code: 'INVALID99'
  }, botHeaders);
  console.log('   Status:', invalidResult.status, '(expected 404)');
  console.log('   Error:', invalidResult.data.error, '\n');

  // Step 5: Client gives consent
  console.log('5. Client gives consent...');
  const consentResult = await makeRequest('POST', '/api/bot/consent', {
    telegram_id: `client_${ts}`,
    therapist_id: therapistId,
    consent: true
  }, botHeaders);
  console.log('   Status:', consentResult.status);
  console.log('   Data:', JSON.stringify(consentResult.data));
  console.log('   Linked:', consentResult.data.linked, '\n');

  // Step 6: Verify client is linked (fetch user)
  console.log('6. Verifying client is linked...');
  const verifyResult = await makeRequest('GET', `/api/bot/user/client_${ts}`, null, botHeaders);
  console.log('   Status:', verifyResult.status);
  console.log('   Therapist ID:', verifyResult.data.user.therapist_id, '(expected', therapistId, ')');
  console.log('   Consent:', verifyResult.data.user.consent_therapist_access, '\n');

  // Step 7: Try connecting again (already connected)
  console.log('7. Testing double connect (should fail)...');
  const doubleResult = await makeRequest('POST', '/api/bot/connect', {
    telegram_id: `client_${ts}`,
    invite_code: therapistInviteCode
  }, botHeaders);
  console.log('   Status:', doubleResult.status, '(expected 400)');
  console.log('   Error:', doubleResult.data.error, '\n');

  // Step 8: Test case-insensitive code lookup
  console.log('8. Testing case-insensitive code lookup...');
  const clientReg2 = await makeRequest('POST', '/api/bot/register', {
    telegram_id: `client2_${ts}`,
    role: 'client'
  }, botHeaders);
  const caseResult = await makeRequest('POST', '/api/bot/connect', {
    telegram_id: `client2_${ts}`,
    invite_code: therapistInviteCode.toUpperCase()
  }, botHeaders);
  console.log('   Status:', caseResult.status, '(expected 200)');
  console.log('   Found therapist:', caseResult.data.therapist?.id === therapistId, '\n');

  // Step 9: Therapist cannot use connect
  console.log('9. Therapist tries to use connect (should fail)...');
  const therapistConnect = await makeRequest('POST', '/api/bot/connect', {
    telegram_id: `therapist_${ts}`,
    invite_code: therapistInviteCode
  }, botHeaders);
  console.log('   Status:', therapistConnect.status, '(expected 400)');
  console.log('   Error:', therapistConnect.data.error);

  console.log('\n=== All connect tests completed ===');
}

main().catch(console.error);
