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
  process.stdout.write('CSRF: ' + (csrfToken ? 'ok' : 'MISSING') + '\n');

  const regT = await makeReq('POST', '/api/auth/register', {
    email: 'dbg_revoke_' + TS + '@test.com', password: 'Test1234!', name: 'DBG'
  });
  process.stdout.write('Register: ' + regT.status + '\n');
  const token = regT.body.token;

  const invRes = await makeReq('GET', '/api/invite-code', null, token);
  process.stdout.write('Invite: ' + JSON.stringify(invRes.body) + '\n');

  const clientTgId = 'dbg_client_' + TS;
  const regC = await makeReq('POST', '/api/bot/register', { telegram_id: clientTgId, role: 'client' });
  process.stdout.write('RegClient: ' + regC.status + ' ' + JSON.stringify(regC.body) + '\n');

  const conn = await makeReq('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: invRes.body.invite_code });
  process.stdout.write('Connect: ' + conn.status + ' ' + JSON.stringify(conn.body) + '\n');

  const cons = await makeReq('POST', '/api/bot/consent', { telegram_id: clientTgId, consent: true });
  process.stdout.write('Consent: ' + cons.status + ' ' + JSON.stringify(cons.body) + '\n');

  const clients = await makeReq('GET', '/api/clients', null, token);
  process.stdout.write('Clients: ' + clients.status + ' count=' + (clients.body.clients ? clients.body.clients.length : 'N/A') + '\n');
  if (clients.body.clients && clients.body.clients.length > 0) {
    process.stdout.write('First client: ' + JSON.stringify(clients.body.clients[0]) + '\n');
  }
}

run().catch(e => process.stderr.write(e.toString() + '\n'));
