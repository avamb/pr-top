const http = require('http');

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

  // Login as the browser-registered therapist
  const login = await makeReq('POST', '/api/auth/login', {
    email: 'browser_revoke_test@test.com', password: 'Test1234!'
  });
  const token = login.body.token;
  process.stdout.write('Login: ' + login.status + '\n');

  // Get invite code
  const inv = await makeReq('GET', '/api/invite-code', null, token);
  const inviteCode = inv.body.invite_code;
  process.stdout.write('Invite code: ' + inviteCode + '\n');

  // Register client
  const clientTgId = 'browser_revoke_client_122';
  const regC = await makeReq('POST', '/api/bot/register', { telegram_id: clientTgId, role: 'client' });
  process.stdout.write('Register client: ' + regC.status + '\n');

  // Connect
  const conn = await makeReq('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inviteCode });
  const therapistId = conn.body.therapist ? conn.body.therapist.id : null;
  process.stdout.write('Connect: ' + conn.status + ' therapistId=' + therapistId + '\n');

  // Consent
  const cons = await makeReq('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: therapistId, consent: true });
  process.stdout.write('Consent: ' + cons.status + '\n');

  // Submit diary entry
  const diary = await makeReq('POST', '/api/bot/diary', { telegram_id: clientTgId, content: 'BROWSER_REVOKE_TEST_DIARY', entry_type: 'text' });
  process.stdout.write('Diary: ' + diary.status + '\n');

  // Check clients list
  const clients = await makeReq('GET', '/api/clients', null, token);
  process.stdout.write('Clients: ' + clients.body.clients.length + '\n');
  if (clients.body.clients.length > 0) {
    process.stdout.write('Client ID: ' + clients.body.clients[0].id + ' tg: ' + clients.body.clients[0].telegram_id + '\n');
  }
}

run().catch(e => process.stderr.write(e.toString() + '\n'));
