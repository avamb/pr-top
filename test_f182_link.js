const http = require('http');

function get(url, headers) {
  return new Promise((resolve, reject) => {
    http.get(url, {headers}, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d))); }).on('error', reject);
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
  // Login as existing therapist
  const csrf = await get('http://localhost:3001/api/csrf-token', {});
  const login = await post('http://localhost:3001/api/auth/login', {email:'filter182test@test.com',password:'TestPass1'}, {'X-CSRF-Token':csrf.csrfToken});
  const jwt = login.token;
  console.log('JWT:', jwt);

  // Get invite code
  const invite = await get('http://localhost:3001/api/invite-code', {Authorization:'Bearer '+jwt});
  console.log('Invite:', JSON.stringify(invite));
  const inviteCode = invite.invite_code;

  // Register client via bot
  const csrf2 = await get('http://localhost:3001/api/csrf-token', {});
  const botReg = await post('http://localhost:3001/api/bot/register', {telegram_id:'filter182clientC',name:'FilterClient182',role:'client'}, {'X-CSRF-Token':csrf2.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Bot register:', JSON.stringify(botReg));

  // Connect client with invite code
  const csrf3 = await get('http://localhost:3001/api/csrf-token', {});
  const connect = await post('http://localhost:3001/api/bot/connect', {telegram_id:'filter182clientC',invite_code:inviteCode}, {'X-CSRF-Token':csrf3.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Connect:', JSON.stringify(connect));

  // Accept consent
  const csrf4 = await get('http://localhost:3001/api/csrf-token', {});
  const consent = await post('http://localhost:3001/api/bot/consent', {telegram_id:'filter182clientC',therapist_id:connect.therapist.id,action:'accept'}, {'X-CSRF-Token':csrf4.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Consent:', JSON.stringify(consent));

  // Create text diary entry
  const csrf5 = await get('http://localhost:3001/api/csrf-token', {});
  const diary1 = await post('http://localhost:3001/api/bot/diary', {telegram_id:'filter182clientC',entry_type:'text',content:'TEXT_PERSIST_182 feeling anxious today about work'}, {'X-CSRF-Token':csrf5.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Diary text:', JSON.stringify(diary1));

  // Create voice diary entry
  const csrf6 = await get('http://localhost:3001/api/csrf-token', {});
  const diary2 = await post('http://localhost:3001/api/bot/diary', {telegram_id:'filter182clientC',entry_type:'voice',content:'VOICE_PERSIST_182 had good therapy session',voice_file_id:'test_voice_182c'}, {'X-CSRF-Token':csrf6.csrfToken,'X-Bot-API-Key':BOT_KEY});
  console.log('Diary voice:', JSON.stringify(diary2));

  // Get clients to find client ID
  const clients = await get('http://localhost:3001/api/clients', {Authorization:'Bearer '+jwt});
  console.log('Client ID:', clients[0] && clients[0].id);
}

main().catch(e=>console.error(e));
