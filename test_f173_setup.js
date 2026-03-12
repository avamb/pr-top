const http = require('http');
const BACKEND = 'http://localhost:3001';

let csrfToken = null;
let cookies = '';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND);
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    if (cookies) headers['Cookie'] = cookies;

    const req = http.request(url, { method, headers }, (res) => {
      const setCookies = res.headers['set-cookie'];
      if (setCookies) cookies = setCookies.map(c => c.split(';')[0]).join('; ');
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch(e) { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Get CSRF
  const csrf = await request('GET', '/api/csrf-token');
  csrfToken = csrf.data.csrfToken;

  // Login as the test therapist
  const login = await request('POST', '/api/auth/login', {
    email: 'test_f173_date@example.com',
    password: 'TestPass123'
  });
  const token = login.data.token;
  process.stdout.write('Therapist token: ' + token.substring(0, 20) + '...\n');

  // Get invite code
  const me = await request('GET', '/api/auth/me', null, token);
  const inviteCode = me.data.user.invite_code;
  process.stdout.write('Invite code: ' + inviteCode + '\n');

  // Register a client via bot API
  const botReg = await request('POST', '/api/bot/register', {
    telegram_id: 'f173_client_' + Date.now(),
    first_name: 'DateTest',
    last_name: 'Client'
  });
  const clientToken = botReg.data.token;
  process.stdout.write('Client registered: ' + botReg.status + '\n');

  // Connect client to therapist
  const connect = await request('POST', '/api/bot/connect', {
    invite_code: inviteCode
  }, clientToken);
  process.stdout.write('Connected: ' + connect.status + '\n');

  // Give consent
  const consent = await request('POST', '/api/bot/consent', {
    consent: true
  }, clientToken);
  process.stdout.write('Consent: ' + consent.status + '\n');

  // Create diary entry
  const diary = await request('POST', '/api/bot/diary', {
    entry_type: 'text',
    content: 'Today I feel good about the date picker test F173'
  }, clientToken);
  process.stdout.write('Diary entry: ' + diary.status + '\n');

  // Get client list
  const clients = await request('GET', '/api/clients', null, token);
  if (clients.data.clients && clients.data.clients.length > 0) {
    process.stdout.write('Client ID: ' + clients.data.clients[0].id + '\n');
  }
}

main().catch(e => { process.stdout.write('ERROR: ' + e.message + '\n'); process.exit(1); });
