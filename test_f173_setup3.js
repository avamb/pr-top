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
    if (path.startsWith('/api/bot')) headers['X-Bot-API-Key'] = 'dev-bot-api-key';
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
  const csrf = await request('GET', '/api/csrf-token');
  csrfToken = csrf.data.csrfToken;

  // Register therapist
  const ts = Date.now();
  const email = 'f173_therapist_' + ts + '@test.com';
  const reg = await request('POST', '/api/auth/register', {
    email, password: 'TestPass123', role: 'therapist'
  });
  const token = reg.data.token;
  const therapistId = reg.data.user.id;
  process.stdout.write('Therapist ID: ' + therapistId + '\n');

  // Get invite code
  const invite = await request('GET', '/api/invite-code', null, token);
  const inviteCode = invite.data.invite_code;
  process.stdout.write('Invite: ' + inviteCode + '\n');

  // Register client via bot
  const telegramId = 'f173c_' + ts;
  const botReg = await request('POST', '/api/bot/register', {
    telegram_id: telegramId, first_name: 'DateTest', last_name: 'Client', role: 'client'
  });
  process.stdout.write('Client: ' + botReg.status + '\n');

  // Connect
  const connect = await request('POST', '/api/bot/connect', {
    telegram_id: telegramId, invite_code: inviteCode
  });
  process.stdout.write('Connect: ' + connect.status + '\n');

  // Consent (need therapist_id)
  const consent = await request('POST', '/api/bot/consent', {
    telegram_id: telegramId, therapist_id: therapistId, consent: true
  });
  process.stdout.write('Consent: ' + consent.status + ' ' + JSON.stringify(consent.data) + '\n');

  // Create diary entry
  const diary = await request('POST', '/api/bot/diary', {
    telegram_id: telegramId, entry_type: 'text', content: 'F173 date picker test entry'
  });
  process.stdout.write('Diary: ' + diary.status + '\n');

  // Get clients
  const clients = await request('GET', '/api/clients', null, token);
  process.stdout.write('Clients count: ' + (clients.data.clients ? clients.data.clients.length : 0) + '\n');
  if (clients.data.clients && clients.data.clients.length > 0) {
    process.stdout.write('Client ID: ' + clients.data.clients[0].id + '\n');
    process.stdout.write('LOGIN_EMAIL=' + email + '\n');
  }
}

main().catch(e => { process.stdout.write('ERROR: ' + e.message + '\n'); process.exit(1); });
