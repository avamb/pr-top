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

  // Register therapist A (will have a linked client)
  console.log('=== Setup: Register therapist A with linked client ===');
  const csrf1 = await getCsrf();
  await doReq('POST', '/api/auth/register', {
    email: 'therA' + TS + '@t.com', password: 'Test1234!', role: 'therapist'
  }, { 'x-csrf-token': csrf1 });
  const csrf2 = await getCsrf();
  const loginA = await doReq('POST', '/api/auth/login', {
    email: 'therA' + TS + '@t.com', password: 'Test1234!'
  }, { 'x-csrf-token': csrf2 });
  const tokenA = loginA.data.token;
  const invA = await authReq('GET', '/api/invite-code', null, tokenA);
  const inviteCodeA = invA.data.invite_code;

  // Register client and link to therapist A
  const clientTg = 'DENY_CLI_' + TS;
  await botReq('POST', '/api/bot/register', { telegram_id: clientTg, role: 'client' });
  const conn = await botReq('POST', '/api/bot/connect', { telegram_id: clientTg, invite_code: inviteCodeA });
  const therAId = conn.data.therapist.id;
  await botReq('POST', '/api/bot/consent', { telegram_id: clientTg, therapist_id: therAId, consent: true });

  // Get client ID
  const clientsA = await authReq('GET', '/api/clients', null, tokenA);
  const clients = clientsA.data.clients || clientsA.data || [];
  const theClient = clients.find(function(c) { return c.telegram_id === clientTg; });
  const clientId = theClient ? theClient.id : null;
  console.log('Client ID:', clientId, 'Therapist A linked');

  // Register therapist B (NOT linked to client)
  console.log('\n=== Setup: Register therapist B (unlinked) ===');
  const csrf3 = await getCsrf();
  await doReq('POST', '/api/auth/register', {
    email: 'therB' + TS + '@t.com', password: 'Test1234!', role: 'therapist'
  }, { 'x-csrf-token': csrf3 });
  const csrf4 = await getCsrf();
  const loginB = await doReq('POST', '/api/auth/login', {
    email: 'therB' + TS + '@t.com', password: 'Test1234!'
  }, { 'x-csrf-token': csrf4 });
  const tokenB = loginB.data.token;
  console.log('Therapist B logged in');

  // Therapist B attempts to access client diary (should be denied)
  console.log('\n=== Test: Unlinked therapist attempts diary access ===');
  const diaryResp = await authReq('GET', '/api/clients/' + clientId + '/diary', null, tokenB);
  console.log('Diary access status:', diaryResp.status);
  console.log('Response:', JSON.stringify(diaryResp.data));

  // Check audit log for access_denied
  console.log('\n=== Verify: Check audit log for access_denied ===');
  const csrf5 = await getCsrf();
  const adminLogin = await doReq('POST', '/api/auth/login', {
    email: 'admin@psylink.app', password: 'Admin123!'
  }, { 'x-csrf-token': csrf5 });
  const adminToken = adminLogin.data.token;

  const logs = await authReq('GET', '/api/admin/logs/audit', null, adminToken);
  const allLogs = logs.data.logs || logs.data || [];

  const deniedLogs = allLogs.filter(function(l) { return l.action === 'access_denied'; });
  console.log('access_denied entries:', deniedLogs.length);
  if (deniedLogs.length > 0) {
    const d = deniedLogs[deniedLogs.length - 1];
    console.log('  Latest: actor_id=' + d.actor_id + ', target_type=' + d.target_type + ', target_id=' + d.target_id);
    console.log('  details:', d.details);
  }

  // Verification
  console.log('\n=== VERIFICATION ===');
  const denied403 = diaryResp.status === 403;
  const hasAccessDenied = deniedLogs.length > 0;
  const lastDenied = hasAccessDenied ? deniedLogs[deniedLogs.length - 1] : {};
  const hasActor = lastDenied.actor_id != null;
  const hasTarget = lastDenied.target_id != null || lastDenied.target_type != null;

  console.log('1. 403 response:', denied403);
  console.log('2. access_denied logged:', hasAccessDenied);
  console.log('3. actor_id present:', hasActor);
  console.log('4. target details present:', hasTarget);

  const pass = denied403 && hasAccessDenied && hasActor && hasTarget;
  console.log('\n' + (pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
}

main().catch(function(e) { console.error('ERROR:', e); });
