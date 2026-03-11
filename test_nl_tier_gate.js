const http = require('http');

function req(method, urlPath, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path: urlPath, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) Object.assign(opts.headers, extraHeaders);
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  const ts = Date.now();
  const BOT_HEADERS = { 'X-Bot-API-Key': 'dev-bot-api-key' };

  // Get CSRF
  const csrfRes = await req('GET', '/api/csrf-token');
  const csrf = csrfRes.body.csrfToken;

  // Register therapist (trial)
  const email = 'nltier_' + ts + '@test.com';
  const regRes = await req('POST', '/api/auth/register', { email, password: 'Test123!', role: 'therapist' }, null, { 'X-CSRF-Token': csrf });
  const token = regRes.body.token;
  const therapistId = regRes.body.user.id;
  console.log('1. Registered therapist (trial):', regRes.status, 'ID:', therapistId);

  // Link client
  const tgId = 'tg_nltier_' + ts;
  await req('POST', '/api/bot/register', { telegram_id: tgId, role: 'client' }, null, BOT_HEADERS);
  const invRes = await req('GET', '/api/invite-code', null, token);
  await req('POST', '/api/bot/connect', { telegram_id: tgId, invite_code: invRes.body.invite_code }, null, BOT_HEADERS);
  await req('POST', '/api/bot/consent', { telegram_id: tgId, therapist_id: therapistId, consent: true }, null, BOT_HEADERS);
  const clientsRes = await req('GET', '/api/clients', null, token);
  const clientId = clientsRes.body.clients[0].id;
  console.log('2. Client linked, ID:', clientId);

  // Trial - should be blocked (403)
  const q1 = await req('POST', '/api/query', { client_id: clientId, query: 'how is the client feeling' }, token);
  console.log('3. Trial attempt:', q1.status, q1.body.error, '| plan:', q1.body.current_plan);

  // Login as admin and upgrade to basic
  const csrf2 = (await req('GET', '/api/csrf-token')).body.csrfToken;
  const adminLogin = await req('POST', '/api/auth/login', { email: 'admin@psylink.app', password: 'Admin123!' }, null, { 'X-CSRF-Token': csrf2 });
  const adminToken = adminLogin.body.token;
  console.log('4. Admin login:', adminLogin.status);

  // Use subscription change endpoint to upgrade to basic
  const changeBasic = await req('POST', '/api/subscription/change-plan', { plan: 'basic' }, token);
  console.log('5. Change to basic:', changeBasic.status, changeBasic.body.message || changeBasic.body.error);

  // Basic - should still be blocked
  const q2 = await req('POST', '/api/query', { client_id: clientId, query: 'how is the client feeling' }, token);
  console.log('6. Basic attempt:', q2.status, q2.body.error, '| plan:', q2.body.current_plan);

  // Upgrade to pro
  const changePro = await req('POST', '/api/subscription/change-plan', { plan: 'pro' }, token);
  console.log('7. Change to pro:', changePro.status, changePro.body.message || changePro.body.error);

  // Pro - should succeed
  const q3 = await req('POST', '/api/query', { client_id: clientId, query: 'how is the client feeling' }, token);
  console.log('8. Pro attempt:', q3.status, q3.body.success || q3.body.error);

  // Summary
  const pass = q1.status === 403 && q2.status === 403 && q3.status === 200;
  console.log('\n' + (pass ? '=== PASS ===' : '=== FAIL ==='));
}

main().catch(e => console.error('Error:', e.message));
