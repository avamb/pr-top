const http = require('http');

function get(path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: 3001, path, method: 'GET', headers };
    const req = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(d)})); });
    req.on('error', reject);
    req.end();
  });
}

function post(path, data, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: 3001, path, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(d)})); });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function getCSRF() {
  const r = await get('/api/csrf-token', {});
  return r.data.csrfToken;
}

async function main() {
  // Login to get therapist user id
  let csrf = await getCSRF();
  const login = await post('/api/auth/login', {email:'dash_resp_185@test.com',password:'TestPass123'}, {'X-CSRF-Token': csrf});
  const token = login.data.token;
  const me = await get('/api/auth/me', {Authorization: 'Bearer '+token});
  console.log('Me:', JSON.stringify(me.data));
  const therapistId = me.data.id || me.data.user?.id;
  console.log('Therapist ID:', therapistId);

  // Now consent with therapist_id
  csrf = await getCSRF();
  const consent = await post('/api/bot/consent', {telegram_id:'mobile_test_187', therapist_id: therapistId, consent: true}, {'X-Bot-API-Key': 'dev-bot-api-key', 'X-CSRF-Token': csrf});
  console.log('Consent:', consent.status, JSON.stringify(consent.data));

  // Check clients
  const clients = await get('/api/clients', {Authorization: 'Bearer '+token});
  console.log('Total:', clients.data.total);
  if (clients.data.clients && clients.data.clients.length > 0) {
    console.log('Client ID:', clients.data.clients[0].id);
  }
}

main().catch(e=>console.error(e));
