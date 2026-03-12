const http = require('http');

function request(method, path, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) headers['Content-Length'] = Buffer.byteLength(data);
    if (extraHeaders) Object.assign(headers, extraHeaders);
    const opts = { hostname: '127.0.0.1', port: 3001, path, method, headers };
    const req = http.request(opts, r => {
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => {
        try { resolve({ status: r.statusCode, data: JSON.parse(b) }); }
        catch(e) { resolve({ status: r.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

async function main() {
  // Get CSRF token
  var csrf = await request('GET', '/api/csrf-token');
  console.log('CSRF:', csrf.data.csrfToken ? 'OK' : csrf.data);
  var csrfH = { 'x-csrf-token': csrf.data.csrfToken };

  // Register therapist
  var reg = await request('POST', '/api/auth/register', {
    email: 'filter176@test.com', password: 'Test1234!', name: 'FilterTest', role: 'therapist'
  }, null, csrfH);
  console.log('Register:', reg.status);

  // Login
  var login = await request('POST', '/api/auth/login', {
    email: 'filter176@test.com', password: 'Test1234!'
  }, null, csrfH);
  console.log('Login:', login.status);
  var token = login.data.token;

  // Get invite code
  var invite = await request('GET', '/api/invite-code', null, token);
  console.log('Invite code:', invite.data.invite_code);

  var botH = { 'x-bot-api-key': 'dev-bot-api-key' };

  // Register client via bot API
  var clientReg = await request('POST', '/api/bot/register', {
    telegram_id: 'filter176client', name: 'FilterClient', role: 'client'
  }, null, botH);
  console.log('Client reg:', clientReg.status);

  // Connect client to therapist
  var connect = await request('POST', '/api/bot/connect', {
    telegram_id: 'filter176client', invite_code: invite.data.invite_code
  }, null, botH);
  console.log('Connect:', connect.status);

  // Grant consent
  var consent = await request('POST', '/api/bot/consent', {
    telegram_id: 'filter176client', action: 'grant'
  }, null, botH);
  console.log('Consent:', consent.status);

  // Create diary entries of different types
  var diary1 = await request('POST', '/api/bot/diary', {
    telegram_id: 'filter176client', content: 'FILTER_TEXT_ENTRY_176', entry_type: 'text'
  }, null, botH);
  console.log('Diary text:', diary1.status);

  var diary2 = await request('POST', '/api/bot/diary', {
    telegram_id: 'filter176client', content: 'FILTER_VOICE_ENTRY_176', entry_type: 'voice'
  }, null, botH);
  console.log('Diary voice:', diary2.status);

  // Get clients to find ID
  var clients = await request('GET', '/api/clients', null, token);
  console.log('Clients:', clients.data.clients ? clients.data.clients.length : 0);
  if (clients.data.clients && clients.data.clients.length > 0) {
    console.log('Client ID:', clients.data.clients[0].id);
  }
  console.log('Token:', token);
}

main().catch(console.error);
