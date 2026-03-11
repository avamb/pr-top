const http = require('http');

const req_ = (method, path, body, token) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    else opts.headers['x-bot-api-key'] = 'dev-bot-api-key';
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch(e) { resolve({ status: res.statusCode, data: chunks }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
};

(async () => {
  const TID_T = '55561001';
  const TID_C = '55561002';

  console.log('=== Feature #55: Audit log records consent changes ===\n');

  // Register therapist
  let r = await req_('POST', '/api/bot/register', { telegram_id: TID_T, role: 'therapist' });
  console.log('1. Register therapist:', r.status);
  let code = null;
  if (r.data.user) code = r.data.user.invite_code;
  if (!code && r.data.already_existed) {
    // Fetch via bot user endpoint
    r = await req_('GET', '/api/bot/user/' + TID_T);
    if (r.data && r.data.user) code = r.data.user.invite_code;
  }
  console.log('   invite_code:', code);

  // Register client
  r = await req_('POST', '/api/bot/register', { telegram_id: TID_C, role: 'client' });
  console.log('2. Register client:', r.status);

  // Connect client
  r = await req_('POST', '/api/bot/connect', { telegram_id: TID_C, invite_code: code });
  console.log('3. Connect:', r.status, (r.data.message || '').slice(0, 60));
  const therapistId = r.data.therapist ? r.data.therapist.id : null;
  console.log('   therapist_id:', therapistId);

  // Grant consent
  r = await req_('POST', '/api/bot/consent', { telegram_id: TID_C, therapist_id: therapistId, consent: true });
  console.log('4. Grant consent:', r.status, (r.data.message || '').slice(0, 60));

  // Login as admin
  r = await req_('POST', '/api/auth/login', { email: 'admin@psylink.app', password: 'Admin123!' });
  const adminToken = r.data.token;
  console.log('5. Admin login:', adminToken ? 'OK' : 'FAIL');

  // Check audit for consent_granted
  r = await req_('GET', '/api/admin/logs/audit?limit=200', null, adminToken);
  let logs = Array.isArray(r.data) ? r.data : (r.data.logs || []);

  const grantEntry = logs.find(l => l.action === 'consent_granted');
  console.log('\n6. consent_granted in audit:', grantEntry ? 'YES' : 'NO');
  if (grantEntry) {
    console.log('   actor_id:', grantEntry.actor_id);
    console.log('   target_type:', grantEntry.target_type);
    console.log('   target_id:', grantEntry.target_id);
    console.log('   details:', grantEntry.details_encrypted);
  }

  // Revoke consent
  r = await req_('POST', '/api/bot/revoke-consent', { telegram_id: TID_C });
  console.log('\n7. Revoke consent:', r.status, (r.data.message || '').slice(0, 60));

  // Check audit for consent_revoked
  r = await req_('GET', '/api/admin/logs/audit?limit=200', null, adminToken);
  logs = Array.isArray(r.data) ? r.data : (r.data.logs || []);

  const revokeEntry = logs.find(l => l.action === 'consent_revoked');
  console.log('8. consent_revoked in audit:', revokeEntry ? 'YES' : 'NO');
  if (revokeEntry) {
    console.log('   actor_id:', revokeEntry.actor_id);
    console.log('   target_type:', revokeEntry.target_type);
    console.log('   target_id:', revokeEntry.target_id);
    console.log('   details:', revokeEntry.details_encrypted);
  }

  // Summary
  console.log('\n=== RESULTS ===');
  const p1 = !!grantEntry;
  const p2 = !!revokeEntry;
  const p3 = !!(grantEntry && grantEntry.actor_id != null);
  const p4 = !!(revokeEntry && revokeEntry.actor_id != null);
  const p5 = !!(grantEntry && grantEntry.target_id != null);
  const p6 = !!(revokeEntry && revokeEntry.target_id != null);
  console.log('consent_granted logged:', p1 ? 'PASS' : 'FAIL');
  console.log('consent_revoked logged:', p2 ? 'PASS' : 'FAIL');
  console.log('actor_id on grant:', p3 ? 'PASS' : 'FAIL');
  console.log('actor_id on revoke:', p4 ? 'PASS' : 'FAIL');
  console.log('target on grant:', p5 ? 'PASS' : 'FAIL');
  console.log('target on revoke:', p6 ? 'PASS' : 'FAIL');
  console.log('ALL PASS:', (p1 && p2 && p3 && p4 && p5 && p6) ? 'YES' : 'NO');
})();
