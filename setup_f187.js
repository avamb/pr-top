const http = require('http');

function post(path, data, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: 3001, path, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(d)})); });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

function get(path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: 3001, path, method: 'GET', headers };
    const req = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(d)})); });
    req.on('error', reject);
    req.end();
  });
}

async function getCSRF() {
  const r = await get('/api/csrf-token', {});
  return r.data.csrfToken;
}

const BOT_HEADERS = { 'X-Bot-API-Key': 'dev-bot-api-key' };

async function main() {
  let csrf = await getCSRF();
  const login = await post('/api/auth/login', {email:'dash_resp_185@test.com',password:'TestPass123'}, {'X-CSRF-Token': csrf});
  const token = login.data.token;
  console.log('Login:', login.status);

  const inv = await get('/api/invite-code', {Authorization: 'Bearer '+token});
  const code = inv.data.invite_code;
  console.log('Invite code:', code);

  csrf = await getCSRF();
  const reg = await post('/api/bot/register', {telegram_id:'mobile_test_187',role:'client'}, {...BOT_HEADERS, 'X-CSRF-Token': csrf});
  console.log('Client reg:', reg.status);

  csrf = await getCSRF();
  const conn = await post('/api/bot/connect', {telegram_id:'mobile_test_187',invite_code:code}, {...BOT_HEADERS, 'X-CSRF-Token': csrf});
  console.log('Connect:', conn.status);

  csrf = await getCSRF();
  const consent = await post('/api/bot/consent', {telegram_id:'mobile_test_187',action:'accept'}, {...BOT_HEADERS, 'X-CSRF-Token': csrf});
  console.log('Consent:', consent.status);

  csrf = await getCSRF();
  const diary = await post('/api/bot/diary', {telegram_id:'mobile_test_187',content:'Mobile test diary entry for feature 187 verification'}, {...BOT_HEADERS, 'X-CSRF-Token': csrf});
  console.log('Diary:', diary.status);

  const clients = await get('/api/clients', {Authorization: 'Bearer '+token});
  console.log('Clients:', JSON.stringify(clients.data.clients?.map(c=>({id:c.id, tg:c.telegram_id}))));
}

main().catch(e=>console.error(e));
