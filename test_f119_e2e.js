// Feature #119: End-to-end client linking and diary flow
const http = require('http');

const request = (method, path, body, headers) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const getCsrf = async () => {
  const res = await request('GET', '/api/csrf-token');
  return res.body.csrfToken;
};

const BOT_H = { 'x-bot-api-key': 'dev-bot-api-key' };
const authH = (token) => ({ 'Authorization': `Bearer ${token}` });

const test = async () => {
  const unique = Date.now();
  console.log('=== Feature #119: End-to-end client linking and diary flow ===\n');

  // Step 1: Register therapist via web
  console.log('Step 1: Register therapist...');
  const csrf = await getCsrf();
  const regRes = await request('POST', '/api/auth/register', {
    email: `e2e_t_${unique}@test.com`,
    password: 'Test1234!',
    name: 'E2E Therapist'
  }, { 'X-CSRF-Token': csrf });
  console.log('  Register status:', regRes.status);
  const therapistToken = regRes.body.token;
  console.log('  Got token:', !!therapistToken);

  // Step 2: Therapist generates/gets invite code
  console.log('\nStep 2: Get invite code via /api/invite-code...');
  const invRes = await request('GET', '/api/invite-code', null, authH(therapistToken));
  console.log('  Invite code status:', invRes.status);
  const inviteCode = invRes.body.invite_code;
  console.log('  Invite code:', inviteCode);

  // Step 3: Client registers via bot (Telegram /start)
  console.log('\nStep 3: Register client via bot...');
  const clientTgId = `tg_client_${unique}`;
  const clientReg = await request('POST', '/api/bot/register', {
    telegram_id: clientTgId,
    role: 'client',
    language: 'en'
  }, BOT_H);
  console.log('  Client register status:', clientReg.status);
  console.log('  Client response:', JSON.stringify(clientReg.body));

  // Step 4: Client enters invite code to connect
  console.log('\nStep 4: Client connects with invite code...');
  const connectRes = await request('POST', '/api/bot/connect', {
    telegram_id: clientTgId,
    invite_code: inviteCode
  }, BOT_H);
  console.log('  Connect status:', connectRes.status);
  const therapistIdFromConnect = connectRes.body.therapist?.id;
  console.log('  Therapist ID from connect:', therapistIdFromConnect);
  console.log('  Requires consent:', connectRes.body.requires_consent);

  // Step 5: Client accepts consent (with therapist_id from connect)
  console.log('\nStep 5: Client accepts consent...');
  const consentRes = await request('POST', '/api/bot/consent', {
    telegram_id: clientTgId,
    therapist_id: therapistIdFromConnect,
    consent: true
  }, BOT_H);
  console.log('  Consent status:', consentRes.status);
  console.log('  Consent linked:', consentRes.body.linked);

  // Step 6: Client submits text diary entry
  const diaryContent = `E2E_DIARY_TEST_${unique}`;
  console.log('\nStep 6: Client submits diary entry...');
  const diaryRes = await request('POST', '/api/bot/diary', {
    telegram_id: clientTgId,
    entry_type: 'text',
    content: diaryContent
  }, BOT_H);
  console.log('  Diary status:', diaryRes.status);
  console.log('  Diary entry ID:', diaryRes.body.entry_id);

  // Step 7: Therapist views client list
  console.log('\nStep 7: Therapist views client list...');
  const clientsRes = await request('GET', '/api/clients', null, authH(therapistToken));
  console.log('  Clients status:', clientsRes.status);
  const clients = clientsRes.body.clients || clientsRes.body;
  console.log('  Client count:', Array.isArray(clients) ? clients.length : 'N/A');
  const linkedClient = Array.isArray(clients) ? clients.find(c => c.telegram_id === clientTgId) : null;
  console.log('  Found linked client:', !!linkedClient);
  const clientId = linkedClient?.id;
  console.log('  Client ID:', clientId);

  // Step 8: Therapist views client diary
  console.log('\nStep 8: Therapist views client diary...');
  const diaryViewRes = await request('GET', `/api/clients/${clientId}/diary`, null, authH(therapistToken));
  console.log('  Diary view status:', diaryViewRes.status);
  const entries = diaryViewRes.body.entries || diaryViewRes.body;
  console.log('  Entry count:', Array.isArray(entries) ? entries.length : 'N/A');

  // Step 9: Verify content is decrypted and readable
  console.log('\nStep 9: Verify diary content is decrypted...');
  const foundEntry = Array.isArray(entries) ? entries.find(e => e.content === diaryContent) : null;
  console.log('  Found entry with exact content:', !!foundEntry);
  console.log('  Entry type:', foundEntry?.entry_type);
  console.log('  Entry content:', foundEntry?.content);

  // Summary
  console.log('\n=== RESULTS ===');
  const checks = [
    ['Therapist registered', regRes.status === 201 || regRes.status === 200],
    ['Invite code generated', !!inviteCode && inviteCode.length > 0],
    ['Client registered via bot', clientReg.status === 201 || clientReg.status === 200],
    ['Client connected with invite code', connectRes.status === 200 && !!therapistIdFromConnect],
    ['Consent accepted, linked', consentRes.status === 200 && consentRes.body.linked === true],
    ['Diary entry created', diaryRes.status === 201 || diaryRes.status === 200],
    ['Client in therapist list', clientsRes.status === 200 && !!linkedClient],
    ['Diary entries visible', diaryViewRes.status === 200 && Array.isArray(entries) && entries.length > 0],
    ['Content decrypted readable', !!foundEntry && foundEntry.content === diaryContent]
  ];

  checks.forEach(([name, pass], i) => {
    console.log(`  ${i+1}. ${name}: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  });

  const allOk = checks.every(([, pass]) => pass);
  console.log(`\n  OVERALL: ${allOk ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);

  // Output data for browser verification
  console.log('\n  therapistEmail:', `e2e_t_${unique}@test.com`);
  console.log('  clientId:', clientId);
  console.log('  diaryContent:', diaryContent);
};

test().catch(console.error);
