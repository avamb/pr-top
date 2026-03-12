const http = require('http');

const TS = Date.now();
let csrfToken = '';
let cookies = '';

const makeReq = (method, path, body, token) => new Promise((resolve, reject) => {
  const opts = {
    hostname: 'localhost', port: 3001,
    path, method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (csrfToken) opts.headers['X-CSRF-Token'] = csrfToken;
  if (cookies) opts.headers['Cookie'] = cookies;
  opts.headers['X-Bot-API-Key'] = 'dev-bot-api-key';
  const r = http.request(opts, res => {
    let d = '';
    const sc = res.headers['set-cookie'];
    if (sc) {
      const parts = sc.map(c => c.split(';')[0]);
      cookies = parts.join('; ');
    }
    res.on('data', c => d += c);
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }));
  });
  r.on('error', reject);
  if (body) r.write(JSON.stringify(body));
  r.end();
});

async function run() {
  const csrf = await makeReq('GET', '/api/csrf-token');
  csrfToken = csrf.body.csrfToken;

  // 1. Register therapist
  const regT = await makeReq('POST', '/api/auth/register', {
    email: 'revoke_test_' + TS + '@test.com', password: 'Test1234!', name: 'Revoke Therapist'
  });
  const token = regT.body.token;

  // 2. Get invite code
  const invRes = await makeReq('GET', '/api/invite-code', null, token);
  const inviteCode = invRes.body.invite_code;

  // 3. Register client via bot
  const clientTgId = 'revoke_client_' + TS;
  await makeReq('POST', '/api/bot/register', { telegram_id: clientTgId, role: 'client' });

  // 4. Connect with invite code
  const conn = await makeReq('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inviteCode });
  const therapistId = conn.body.therapist ? conn.body.therapist.id : null;

  // 5. Accept consent (with therapist_id)
  const cons = await makeReq('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: therapistId, consent: true });

  // 6. Client submits diary entry
  await makeReq('POST', '/api/bot/diary', { telegram_id: clientTgId, content: 'REVOKE_TEST_DIARY_' + TS, entry_type: 'text' });

  // 7. Therapist verifies client in list
  const clients1 = await makeReq('GET', '/api/clients', null, token);
  const foundClient = clients1.body.clients.find(c => c.telegram_id === clientTgId);
  const clientId = foundClient ? foundClient.id : null;

  // 8. Therapist can access diary
  const diaryAccess1 = await makeReq('GET', '/api/clients/' + clientId + '/diary', null, token);

  // 9. Client revokes consent
  const revoke = await makeReq('POST', '/api/bot/revoke-consent', { telegram_id: clientTgId });

  // 10. Therapist tries diary access - should get 403
  const diaryAccess2 = await makeReq('GET', '/api/clients/' + clientId + '/diary', null, token);

  // 11. Therapist tries client list - client should not appear
  const clients2 = await makeReq('GET', '/api/clients', null, token);
  const stillFound = clients2.body.clients.find(c => c.telegram_id === clientTgId);

  // 12. Therapist tries notes
  const notesAccess = await makeReq('GET', '/api/clients/' + clientId + '/notes', null, token);

  // 13. Therapist tries timeline
  const timelineAccess = await makeReq('GET', '/api/clients/' + clientId + '/timeline', null, token);

  // 14. Check audit log
  const adminLogin = await makeReq('POST', '/api/auth/login', { email: 'admin@psylink.app', password: 'Admin123!' });
  const adminToken = adminLogin.body.token;
  const auditLogs = await makeReq('GET', '/api/admin/logs/audit?limit=50', null, adminToken);
  const revokeLog = auditLogs.body.logs && auditLogs.body.logs.find(l => l.action === 'consent_revoked');

  // Results
  const results = [
    ['Register therapist (201)', regT.status === 201],
    ['Invite code obtained', !!inviteCode],
    ['Connect succeeded', conn.status === 200],
    ['Consent accepted', cons.status === 200],
    ['Client found pre-revoke', !!foundClient],
    ['Diary accessible pre-revoke (200)', diaryAccess1.status === 200],
    ['Diary entries exist', diaryAccess1.body.entries && diaryAccess1.body.entries.length > 0],
    ['Revoke succeeded (200)', revoke.status === 200],
    ['Diary blocked post-revoke (403)', diaryAccess2.status === 403],
    ['Client gone from list', !stillFound],
    ['Notes blocked post-revoke', notesAccess.status === 403 || notesAccess.status === 404],
    ['Timeline blocked post-revoke', timelineAccess.status === 403 || timelineAccess.status === 404],
    ['Audit log records revocation', !!revokeLog],
  ];

  results.forEach(r => process.stdout.write((r[1] ? 'PASS' : 'FAIL') + ': ' + r[0] + '\n'));
  const allPass = results.every(r => r[1]);
  process.stdout.write('\nAll checks: ' + (allPass ? 'PASS' : 'FAIL') + '\n');
}

run().catch(e => process.stderr.write(e.toString() + '\n'));
