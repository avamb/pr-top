const http = require('http');

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {hostname:'127.0.0.1',port:3001,path,method,headers: headers || {}};
    const req = http.request(opts, res => {
      let b=''; res.on('data',c=>b+=c); res.on('end',()=>{
        try { resolve({status:res.statusCode,body:JSON.parse(b),headers:res.headers}); }
        catch(e) { resolve({status:res.statusCode,body:b,headers:res.headers}); }
      });
    });
    req.on('error',reject);
    if (body) { const d=JSON.stringify(body); req.setHeader('Content-Type','application/json'); req.setHeader('Content-Length',Buffer.byteLength(d)); req.write(d); }
    req.end();
  });
}

const botHeaders = {'X-Bot-API-Key': 'dev-bot-api-key'};

async function getCsrf() {
  const r = await request('GET', '/api/csrf-token');
  return r.body.csrfToken;
}

async function main() {
  const ts = Date.now();
  const csrf = await getCsrf();

  // Register therapist via web
  const email = 'dash146_' + ts + '@test.com';
  const reg = await request('POST', '/api/auth/register', {email, password:'TestPass1', role:'therapist'}, {'X-CSRF-Token': csrf});
  console.log('Register therapist:', reg.status);
  const token = reg.body.token;

  // Get initial dashboard stats
  const stats1 = await request('GET', '/api/dashboard/stats', null, {'Authorization':'Bearer '+token});
  console.log('Initial stats:', JSON.stringify(stats1.body));
  const initialClients = stats1.body.clients;

  // Get invite code
  const invite = await request('GET', '/api/invite-code', null, {'Authorization':'Bearer '+token});
  console.log('Invite code:', invite.body.invite_code);

  // Register a client via bot API (telegram flow)
  const telegramId = 'tg_146_' + ts;
  const botReg = await request('POST', '/api/bot/register', {telegram_id: telegramId, role: 'client', language: 'en'}, botHeaders);
  console.log('Bot client register:', botReg.status);

  // Link client using invite code via bot API
  const link = await request('POST', '/api/bot/connect', {telegram_id: telegramId, invite_code: invite.body.invite_code}, botHeaders);
  console.log('Link client:', link.status, JSON.stringify(link.body));

  // Accept consent (need therapist_id from link response)
  const therapistId = link.body.therapist ? link.body.therapist.id : null;
  const consent = await request('POST', '/api/bot/consent', {telegram_id: telegramId, therapist_id: therapistId, action: 'accept'}, botHeaders);
  console.log('Consent:', consent.status, JSON.stringify(consent.body));

  // Get dashboard stats again
  const stats2 = await request('GET', '/api/dashboard/stats', null, {'Authorization':'Bearer '+token});
  console.log('Stats after client:', JSON.stringify(stats2.body));
  const newClients = stats2.body.clients;

  // Compare
  const increased = newClients > initialClients;
  console.log('Client count increased:', increased, '(' + initialClients + ' -> ' + newClients + ')');

  if (increased) {
    console.log('PASS: Dashboard stats are real, not hardcoded');
  } else {
    console.log('FAIL: Client count did not increase');
  }

  console.log('THERAPIST_EMAIL=' + email);
  console.log('THERAPIST_PASSWORD=TestPass1');
}

main().catch(e => console.error(e));
