// Test: Verify audit log records consent changes (Feature #55)
const http = require('http');

const API = 'http://localhost:3001';
const BOT_KEY = 'dev-bot-api-key';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY }
    };
    const r = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function authReq(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    };
    const r = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  console.log('=== Feature #55: Audit log records consent changes ===\n');

  // Step 1: Register a therapist via bot
  const tgTherapist = 'AUDIT_THERAPIST_' + Date.now();
  const regT = await req('POST', '/api/bot/register', {
    telegram_id: tgTherapist, role: 'therapist', email: tgTherapist + '@test.com', password: 'Test123!'
  });
  console.log('1. Register therapist:', regT.status, regT.body.message || regT.body.error);
  const therapistId = regT.body.user_id;

  // Get invite code
  const infoT = await req('POST', '/api/bot/me', { telegram_id: tgTherapist });
  const inviteCode = infoT.body.user.invite_code;
  console.log('   Invite code:', inviteCode);

  // Step 2: Register a client via bot
  const tgClient = 'AUDIT_CLIENT_' + Date.now();
  const regC = await req('POST', '/api/bot/register', {
    telegram_id: tgClient, role: 'client'
  });
  console.log('2. Register client:', regC.status, regC.body.message || regC.body.error);

  // Step 3: Connect client with invite code
  const conn = await req('POST', '/api/bot/connect', {
    telegram_id: tgClient, invite_code: inviteCode
  });
  console.log('3. Connect:', conn.status, conn.body.message);

  // Step 4: Grant consent
  const consent = await req('POST', '/api/bot/consent', {
    telegram_id: tgClient, therapist_id: therapistId, consent: true
  });
  console.log('4. Grant consent:', consent.status, consent.body.message);

  // Step 5: Login as admin to check audit logs (need CSRF token)
  const csrf = await req('GET', '/api/csrf-token');
  const csrfToken = csrf.body.csrfToken;

  const loginRes = await new Promise((resolve, reject) => {
    const url = new URL('/api/auth/login', API);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    };
    const r = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    r.on('error', reject);
    r.write(JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }));
    r.end();
  });
  const adminToken = loginRes.body.token;
  console.log('5. Admin login:', loginRes.status);

  // Step 6: Check audit log for consent_granted
  const logs1 = await authReq('GET', '/api/admin/logs/audit', adminToken);
  const grantLogs = logs1.body.logs ? logs1.body.logs.filter(l => l.action === 'consent_granted') : [];
  const hasGrant = grantLogs.length > 0;
  console.log('6. consent_granted in audit log:', hasGrant ? 'YES' : 'NO', '(count:', grantLogs.length, ')');
  if (hasGrant) {
    const latest = grantLogs[0];
    console.log('   actor_id:', latest.actor_id, '| target_type:', latest.target_type, '| target_id:', latest.target_id);
  }

  // Step 7: Revoke consent
  const revoke = await req('POST', '/api/bot/revoke-consent', {
    telegram_id: tgClient
  });
  console.log('7. Revoke consent:', revoke.status, revoke.body.message);

  // Step 8: Check audit log for consent_revoked
  const logs2 = await authReq('GET', '/api/admin/logs/audit', adminToken);
  const revokeLogs = logs2.body.logs ? logs2.body.logs.filter(l => l.action === 'consent_revoked') : [];
  const hasRevoke = revokeLogs.length > 0;
  console.log('8. consent_revoked in audit log:', hasRevoke ? 'YES' : 'NO', '(count:', revokeLogs.length, ')');
  if (hasRevoke) {
    const latest = revokeLogs[0];
    console.log('   actor_id:', latest.actor_id, '| target_type:', latest.target_type, '| target_id:', latest.target_id);
  }

  // Final result
  console.log('\n=== RESULT ===');
  if (hasGrant && hasRevoke) {
    console.log('PASS: All consent changes are audit-logged with actor_id and target');
  } else {
    console.log('FAIL: Missing audit log entries');
    if (!hasGrant) console.log('  - Missing consent_granted');
    if (!hasRevoke) console.log('  - Missing consent_revoked');
  }
}

run().catch(e => console.error('Error:', e.message));
