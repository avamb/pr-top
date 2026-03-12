const http = require('http');
const BOT_KEY = 'dev-bot-api-key';

const req = (method, path, body, headers2) => new Promise((resolve, reject) => {
  const headers = {...(headers2||{})};
  let data;
  if (body) {
    data = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(data);
  }
  const r = http.request({ hostname:'localhost', port:3001, path, method, headers }, (res) => {
    let b=''; res.on('data',c=>b+=c); res.on('end',()=>{
      try { resolve({status:res.statusCode,body:JSON.parse(b)}); }
      catch(e) { resolve({status:res.statusCode,body:b}); }
    });
  });
  r.on('error',reject);
  if (data) r.write(data);
  r.end();
});

const run = async () => {
  // Use fixed credentials for browser login
  const email = 'browser167@test.com';
  const password = 'TestPass1';
  const telegramId = 'browser167client';

  // Get CSRF token
  const csrf = await req('GET', '/api/csrf-token');
  const csrfToken = csrf.body.csrfToken;

  // Register therapist
  const t = await req('POST', '/api/auth/register',
    {email, password, role:'therapist'},
    {'X-CSRF-Token': csrfToken});
  console.log('Therapist registered:', t.status);
  const token = t.body.token;

  // Register client via bot
  await req('POST', '/api/bot/register',
    {telegram_id: telegramId, role:'client', language:'en'},
    {'x-bot-api-key':BOT_KEY});

  // Get invite code
  const inviteRes = await req('GET', '/api/invite-code', null, {'Authorization':'Bearer '+token});
  const inviteCode = inviteRes.body.invite_code;

  // Connect & consent
  const conn = await req('POST', '/api/bot/connect',
    {telegram_id: telegramId, invite_code: inviteCode},
    {'x-bot-api-key':BOT_KEY});
  const therapistId = conn.body.therapist?.id;

  await req('POST', '/api/bot/consent',
    {telegram_id: telegramId, therapist_id: therapistId, consent: true},
    {'x-bot-api-key':BOT_KEY});

  // Create diary entry
  await req('POST', '/api/bot/diary',
    {telegram_id: telegramId, content:'CASCADE_DEL_55555 browser test entry', entry_type:'text'},
    {'x-bot-api-key':BOT_KEY});

  // Get client list
  const clients = await req('GET', '/api/clients', null, {'Authorization':'Bearer '+token});
  const clientId = clients.body.clients?.[0]?.id;

  console.log('Setup complete!');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('Client ID:', clientId);
  console.log('Token:', token);
};

run().catch(console.error);
