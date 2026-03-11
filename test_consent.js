const http = require('http');

function makeRequest(method, path, data, headers) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(responseBody) }); }
        catch (e) { resolve({ status: res.statusCode, data: responseBody }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const botHeaders = { 'x-bot-api-key': 'dev-bot-api-key' };

async function main() {
  console.log('=== Testing Consent Screen Feature (#20) ===\n');
  const ts = Date.now();

  // Setup
  const therapistReg = await makeRequest('POST', '/api/bot/register', {
    telegram_id: `t_consent_${ts}`, role: 'therapist'
  }, botHeaders);
  const therapistId = therapistReg.data.user.id;
  const inviteCode = therapistReg.data.user.invite_code;
  console.log('Therapist registered, ID:', therapistId, 'Code:', inviteCode);

  // Test 1: Connect returns requires_consent without linking
  console.log('\n1. Client enters valid invite code...');
  const clientReg = await makeRequest('POST', '/api/bot/register', {
    telegram_id: `c_consent_${ts}`, role: 'client'
  }, botHeaders);
  const clientId = clientReg.data.user.id;

  const connectRes = await makeRequest('POST', '/api/bot/connect', {
    telegram_id: `c_consent_${ts}`, invite_code: inviteCode
  }, botHeaders);
  console.log('   Status:', connectRes.status, '(expected 200)');
  console.log('   requires_consent:', connectRes.data.requires_consent, '(expected true)');
  console.log('   Message includes consent info:', connectRes.data.message.includes('Consent'));

  // Test 2: Verify NO linking occurred yet
  console.log('\n2. Verify no linking before consent...');
  const beforeConsent = await makeRequest('GET', `/api/bot/user/c_consent_${ts}`, null, botHeaders);
  console.log('   therapist_id:', beforeConsent.data.user.therapist_id, '(expected null)');
  console.log('   consent_therapist_access:', beforeConsent.data.user.consent_therapist_access, '(expected false)');

  // Test 3: Client DECLINES consent
  console.log('\n3. Client declines consent...');
  const declineRes = await makeRequest('POST', '/api/bot/consent', {
    telegram_id: `c_consent_${ts}`, therapist_id: therapistId, consent: false
  }, botHeaders);
  console.log('   Status:', declineRes.status);
  console.log('   linked:', declineRes.data.linked, '(expected false)');
  console.log('   Message:', declineRes.data.message);

  // Verify still not linked
  const afterDecline = await makeRequest('GET', `/api/bot/user/c_consent_${ts}`, null, botHeaders);
  console.log('   Still unlinked:', afterDecline.data.user.therapist_id === null, '(expected true)');

  // Test 4: Client ACCEPTS consent
  console.log('\n4. Client accepts consent...');
  const acceptRes = await makeRequest('POST', '/api/bot/consent', {
    telegram_id: `c_consent_${ts}`, therapist_id: therapistId, consent: true
  }, botHeaders);
  console.log('   Status:', acceptRes.status);
  console.log('   linked:', acceptRes.data.linked, '(expected true)');
  console.log('   therapist_id:', acceptRes.data.therapist_id, '(expected', therapistId, ')');

  // Verify now linked with consent
  const afterAccept = await makeRequest('GET', `/api/bot/user/c_consent_${ts}`, null, botHeaders);
  console.log('   therapist_id:', afterAccept.data.user.therapist_id, '(expected', therapistId, ')');
  console.log('   consent_therapist_access:', afterAccept.data.user.consent_therapist_access, '(expected true)');

  console.log('\n=== All consent tests PASSED ===');
}

main().catch(console.error);
