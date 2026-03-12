const http = require('http');
const BOT_KEY = 'dev-bot-api-key';

function makeRequest(method, path, body, token, csrfToken, cookie, botKey) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    if (cookie) headers['Cookie'] = cookie;
    if (botKey) headers['x-bot-api-key'] = botKey;
    const options = { hostname: '127.0.0.1', port: 3001, path, method, headers };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'] || [];
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookies: setCookie }); }
        catch(e) { resolve({ status: res.statusCode, body: data, cookies: setCookie }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getCsrf() {
  const r = await makeRequest('GET', '/api/csrf-token');
  const cookie = r.cookies.find(c => c.startsWith('_csrf')) || '';
  const csrfCookie = cookie.split(';')[0];
  return { csrfToken: r.body.csrfToken, csrfCookie };
}

async function test() {
  const ts = Date.now();
  const email = 'sos_test_' + ts + '@test.com';

  const { csrfToken, csrfCookie } = await getCsrf();
  console.log('0. Got CSRF token');

  // 1. Register therapist
  let r = await makeRequest('POST', '/api/auth/register',
    { email, password: 'StrongPwd1', role: 'therapist' }, null, csrfToken, csrfCookie);
  const token = r.body.token;
  console.log('1. Registered therapist:', r.status);

  // Get therapist user id
  r = await makeRequest('GET', '/api/auth/me', null, token);
  const therapistId = r.body.user ? r.body.user.id : r.body.id;
  console.log('   Therapist ID:', therapistId);

  // 2. Register client via bot
  const clientTelegramId = 'sos_client_' + ts;
  r = await makeRequest('POST', '/api/bot/register',
    { telegram_id: clientTelegramId, role: 'client', language: 'en' }, null, null, null, BOT_KEY);
  console.log('2. Registered client:', r.status);

  // 3. Get invite code
  r = await makeRequest('GET', '/api/invite-code', null, token);
  const inviteCode = r.body.invite_code;
  console.log('3. Got invite code:', inviteCode);

  // 4. Connect client
  r = await makeRequest('POST', '/api/bot/connect',
    { telegram_id: clientTelegramId, invite_code: inviteCode }, null, null, null, BOT_KEY);
  console.log('4. Client connected:', r.status, JSON.stringify(r.body).substring(0, 100));

  // 5. Grant consent (with therapist_id)
  r = await makeRequest('POST', '/api/bot/consent',
    { telegram_id: clientTelegramId, therapist_id: therapistId, consent: true }, null, null, null, BOT_KEY);
  console.log('5. Consent granted:', r.status, JSON.stringify(r.body).substring(0, 100));

  // 6. Rapid SOS clicks - 5 in quick succession
  console.log('\n--- Sending 5 rapid SOS clicks simultaneously ---');
  const sosPromises = [];
  for (let i = 0; i < 5; i++) {
    sosPromises.push(makeRequest('POST', '/api/bot/sos',
      { telegram_id: clientTelegramId, message: 'Help click ' + (i+1) }, null, null, null, BOT_KEY));
  }
  const sosResults = await Promise.all(sosPromises);

  let created = 0, deduped = 0;
  const sosIds = new Set();
  sosResults.forEach((sr, i) => {
    const eventId = sr.body.sos_event ? sr.body.sos_event.id : 'ERROR';
    const isDup = sr.body.deduplicated || false;
    console.log('  SOS click ' + (i+1) + ': status=' + sr.status + ' deduplicated=' + isDup + ' event_id=' + eventId);
    if (sr.body.sos_event) sosIds.add(sr.body.sos_event.id);
    if (sr.body.deduplicated) deduped++;
    else created++;
  });

  console.log('\n--- Results ---');
  console.log('Created events:', created);
  console.log('Deduplicated:', deduped);
  console.log('Unique SOS IDs:', sosIds.size);
  console.log('TEST 1 - Only 1 SOS event:', sosIds.size === 1 ? 'PASS' : 'FAIL (got ' + sosIds.size + ')');

  // 7. Verify therapist notifications
  r = await makeRequest('GET', '/api/dashboard/notifications', null, token);
  const sosNotifs = r.body.notifications ? r.body.notifications.filter(n => n.type === 'sos_alert') : [];
  console.log('\nTherapist SOS notifications:', sosNotifs.length);
  console.log('TEST 2 - 1 notification:', sosNotifs.length === 1 ? 'PASS' : 'FAIL (got ' + sosNotifs.length + ')');

  // 8. Dashboard active SOS
  r = await makeRequest('GET', '/api/dashboard/stats', null, token);
  const activeSos = r.body.stats ? r.body.stats.active_sos : 'unknown';
  console.log('Active SOS count:', activeSos);
  console.log('TEST 3 - 1 active SOS:', activeSos === 1 ? 'PASS' : 'FAIL (got ' + activeSos + ')');
}

test().catch(console.error);
