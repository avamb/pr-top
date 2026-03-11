const http = require('http');

function doReq(method, path, body, headers) {
  return new Promise(function(resolve, reject) {
    const opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: headers || {}
    };
    if (body) opts.headers['Content-Type'] = 'application/json';
    const r = http.request(opts, function(res) {
      let d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function getCsrf() {
  return doReq('GET', '/api/csrf-token', null, {}).then(function(r) { return r.data.csrfToken; });
}

function botReq(method, path, body) {
  return doReq(method, path, body, { 'x-bot-api-key': 'dev-bot-api-key' });
}

function authReq(method, path, body, token) {
  return doReq(method, path, body, { 'Authorization': 'Bearer ' + token });
}

async function main() {
  const TS = Date.now();

  // Register therapist via web
  console.log('=== Step 1: Register therapist ===');
  const csrf1 = await getCsrf();
  const regT = await doReq('POST', '/api/auth/register', {
    email: 'aud' + TS + '@t.com', password: 'Test1234!', role: 'therapist'
  }, { 'x-csrf-token': csrf1 });
  console.log('Register:', regT.status);

  // Login therapist
  const csrf2 = await getCsrf();
  const loginT = await doReq('POST', '/api/auth/login', {
    email: 'aud' + TS + '@t.com', password: 'Test1234!'
  }, { 'x-csrf-token': csrf2 });
  const token = loginT.data.token;
  console.log('Login:', loginT.status, token ? 'OK' : 'FAIL');

  // Get invite code
  const inv = await authReq('GET', '/api/invite-code', null, token);
  const inviteCode = inv.data.invite_code;
  console.log('Invite code:', inviteCode);

  // Register client via bot
  console.log('\n=== Step 2: Register + connect client ===');
  const clientTg = 'AUD_C_' + TS;
  await botReq('POST', '/api/bot/register', {
    telegram_id: clientTg, role: 'client', first_name: 'AudClient'
  });

  // Connect - get therapist_id from response
  const conn = await botReq('POST', '/api/bot/connect', {
    telegram_id: clientTg, invite_code: inviteCode
  });
  console.log('Connect:', conn.status, 'therapist_id:', conn.data.therapist && conn.data.therapist.id);
  const therapistId = conn.data.therapist.id;

  // Grant consent with correct params: telegram_id + therapist_id
  console.log('\n=== Step 3: Grant consent ===');
  const grant = await botReq('POST', '/api/bot/consent', {
    telegram_id: clientTg, therapist_id: therapistId, consent: true
  });
  console.log('Consent grant:', grant.status, 'linked:', grant.data.linked);

  // Check audit logs as admin
  console.log('\n=== Step 4: Check audit logs ===');
  const csrf3 = await getCsrf();
  const adminLogin = await doReq('POST', '/api/auth/login', {
    email: 'admin@psylink.app', password: 'Admin123!'
  }, { 'x-csrf-token': csrf3 });
  const adminToken = adminLogin.data.token;

  const logs1 = await authReq('GET', '/api/admin/logs/audit', null, adminToken);
  const allLogs = logs1.data.logs || logs1.data || [];
  console.log('Total audit entries:', allLogs.length);

  const granted = allLogs.filter(function(l) { return l.action === 'consent_granted'; });
  console.log('consent_granted entries:', granted.length);
  if (granted.length > 0) {
    const g = granted[granted.length - 1];
    console.log('  actor_id:', g.actor_id, 'target_type:', g.target_type, 'target_id:', g.target_id);
    console.log('  details:', g.details);
  }

  // Revoke consent
  console.log('\n=== Step 5: Revoke consent ===');
  const revoke = await botReq('POST', '/api/bot/revoke-consent', {
    telegram_id: clientTg
  });
  console.log('Revoke:', revoke.status, 'revoked:', revoke.data.revoked);

  // Check revoke audit
  console.log('\n=== Step 6: Check revoke audit ===');
  const logs2 = await authReq('GET', '/api/admin/logs/audit', null, adminToken);
  const allLogs2 = logs2.data.logs || logs2.data || [];
  const revoked = allLogs2.filter(function(l) { return l.action === 'consent_revoked'; });
  console.log('consent_revoked entries:', revoked.length);
  if (revoked.length > 0) {
    const rv = revoked[revoked.length - 1];
    console.log('  actor_id:', rv.actor_id, 'target_type:', rv.target_type, 'target_id:', rv.target_id);
    console.log('  details:', rv.details);
  }

  // Final verification
  console.log('\n=== VERIFICATION ===');
  const gOk = granted.length > 0;
  const rOk = revoked.length > 0;
  const gE = gOk ? granted[granted.length - 1] : {};
  const rE = rOk ? revoked[revoked.length - 1] : {};

  console.log('1. consent_granted logged:', gOk);
  console.log('2. consent_granted actor_id present:', gE.actor_id != null);
  console.log('3. consent_granted target present:', gE.target_id != null || gE.target_type != null);
  console.log('4. consent_revoked logged:', rOk);
  console.log('5. consent_revoked actor_id present:', rE.actor_id != null);
  console.log('6. consent_revoked target present:', rE.target_id != null || rE.target_type != null);

  const pass = gOk && rOk && gE.actor_id != null && rE.actor_id != null &&
    (gE.target_id != null || gE.target_type != null) &&
    (rE.target_id != null || rE.target_type != null);
  console.log('\n' + (pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
}

main().catch(function(e) { console.error('ERROR:', e); });
