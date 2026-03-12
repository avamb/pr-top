const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d))); }).on('error', reject);
  });
}

function post(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({hostname:u.hostname,port:u.port,path:u.pathname,method:'POST',headers:{...headers,'Content-Type':'application/json'}}, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

const BOT_KEY = 'dev-bot-api-key';

async function main() {
  const csrf = await get('http://localhost:3001/api/csrf-token');
  const reg = await post('http://localhost:3001/api/auth/register', {email:'filter182b@test.com',password:'TestPass1',role:'therapist'}, {'X-CSRF-Token':csrf.csrfToken});
  console.log('Register:', JSON.stringify(reg));
  const jwt = reg.token;
  const inviteCode = reg.invite_code;

  const csrf2 = await get('http://localhost:3001/api/csrf-token');
  const botReg = await post('http://localhost:3001/api/bot/register', {telegram_id:'filter182botB',name:'FilterTestClient',role:'client'}, {'X-CSRF-Token':csrf2.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Bot register:', JSON.stringify(botReg));

  const csrf3 = await get('http://localhost:3001/api/csrf-token');
  const connect = await post('http://localhost:3001/api/bot/connect', {telegram_id:'filter182botB',invite_code:inviteCode}, {'X-CSRF-Token':csrf3.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Connect:', JSON.stringify(connect));

  const csrf4 = await get('http://localhost:3001/api/csrf-token');
  const consent = await post('http://localhost:3001/api/bot/consent', {telegram_id:'filter182botB',action:'accept'}, {'X-CSRF-Token':csrf4.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Consent:', JSON.stringify(consent));

  const csrf5 = await get('http://localhost:3001/api/csrf-token');
  const diary1 = await post('http://localhost:3001/api/bot/diary', {telegram_id:'filter182botB',entry_type:'text',content:'FILTER_TEXT_ENTRY_182 feeling anxious today'}, {'X-CSRF-Token':csrf5.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Diary text:', JSON.stringify(diary1));

  const csrf6 = await get('http://localhost:3001/api/csrf-token');
  const diary2 = await post('http://localhost:3001/api/bot/diary', {telegram_id:'filter182botB',entry_type:'voice',content:'FILTER_VOICE_ENTRY_182 had a good session',voice_file_id:'test_voice_182b'}, {'X-CSRF-Token':csrf6.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Diary voice:', JSON.stringify(diary2));

  const clientsRes = await new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/clients', {headers:{Authorization:'Bearer '+jwt}}, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d)));
    }).on('error', reject);
  });
  console.log('Client ID:', clientsRes[0] && clientsRes[0].id);
  console.log('JWT:', jwt);
}

main().catch(e=>console.error(e));
