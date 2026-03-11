const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = {'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({hostname:'localhost',port:3001,path,method:'POST',headers}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try { resolve({status:res.statusCode,body:JSON.parse(d)}); }
        catch(e) { resolve({status:res.statusCode,body:{raw:d}}); }
      });
    });
    req.on('error',reject);
    req.write(data); req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = token ? {'Authorization':'Bearer '+token} : {};
    const req = http.request({hostname:'localhost',port:3001,path,method:'GET',headers}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try { resolve({status:res.statusCode,body:JSON.parse(d)}); }
        catch(e) { resolve({status:res.statusCode,body:{raw:d}}); }
      });
    });
    req.on('error',reject);
    req.end();
  });
}

async function main() {
  // Login or register therapist
  let loginRes = await post('/api/auth/login', {email:'feat64@test.com',password:'Test1234!'});
  let token;
  if (loginRes.status !== 200) {
    const regRes = await post('/api/auth/register', {email:'feat64@test.com',password:'Test1234!',name:'Feat64 Therapist'});
    console.log('Register:', regRes.status);
    token = regRes.body.token;
  } else {
    token = loginRes.body.token;
    console.log('Login OK');
  }

  // Register client via bot
  const botClient = await post('/api/bot/register', {telegram_id:'feat64client999',role:'client',name:'Session Test Client'});
  console.log('Bot client:', botClient.status);

  // Get invite code
  const inviteRes = await get('/api/invite-code', token);
  console.log('Invite code:', inviteRes.body.invite_code);

  // Connect + consent
  await post('/api/bot/connect', {telegram_id:'feat64client999', invite_code: inviteRes.body.invite_code});
  await post('/api/bot/consent', {telegram_id:'feat64client999', action:'accept'});

  // Get client list to find client ID
  const clientsRes = await get('/api/clients', token);
  const clients = clientsRes.body.clients || [];
  console.log('Clients count:', clients.length);

  // Find our client
  let clientId = null;
  for (const c of clients) {
    if (c.telegram_id === 'feat64client999' || c.name === 'Session Test Client') {
      clientId = c.id;
      break;
    }
  }
  if (!clientId && clients.length > 0) clientId = clients[0].id;
  console.log('Using client ID:', clientId);

  // Check if there's already a session
  const sessionsRes = await get('/api/clients/' + clientId + '/sessions', token);
  console.log('Existing sessions:', sessionsRes.status, JSON.stringify(sessionsRes.body).substring(0, 200));

  // Create a session directly in the DB via a simple upload simulation
  // We'll use the FormData approach with a dummy audio file
  const fs = require('fs');
  const path = require('path');

  // Create a dummy audio file
  const dummyAudio = Buffer.from('RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00');
  const tmpFile = path.join(__dirname, 'test_audio_feat64.wav');
  fs.writeFileSync(tmpFile, dummyAudio);

  // Upload via multipart
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const fileContent = fs.readFileSync(tmpFile);

  let bodyParts = [];
  // client_id field
  bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n${clientId}`);
  // audio file
  bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="test_session.wav"\r\nContent-Type: audio/wav\r\n\r\n`);

  const bodyStart = Buffer.from(bodyParts.join('\r\n') + '\r\n');
  const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
  const fullBody = Buffer.concat([bodyStart, fileContent, bodyEnd]);

  const uploadRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001,
      path: '/api/sessions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': fullBody.length
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({status: res.statusCode, body: JSON.parse(d)}); }
        catch(e) { resolve({status: res.statusCode, body: {raw: d}}); }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });

  console.log('Upload session:', uploadRes.status, JSON.stringify(uploadRes.body));

  // Wait for auto-transcription
  await new Promise(r => setTimeout(r, 3000));

  // Check the session
  if (uploadRes.body.id) {
    const sessionRes = await get('/api/sessions/' + uploadRes.body.id, token);
    console.log('Session detail:', sessionRes.status);
    console.log('  has_transcript:', sessionRes.body.has_transcript);
    console.log('  has_summary:', sessionRes.body.has_summary);
    console.log('  status:', sessionRes.body.status);
    console.log('  audio_ref:', sessionRes.body.audio_ref);
    if (sessionRes.body.transcript) console.log('  transcript preview:', sessionRes.body.transcript.substring(0, 100));
    if (sessionRes.body.summary) console.log('  summary preview:', sessionRes.body.summary.substring(0, 100));
    console.log('SESSION_ID=' + uploadRes.body.id);
  }

  // Clean up
  fs.unlinkSync(tmpFile);

  console.log('TOKEN=' + token);
  console.log('CLIENT_ID=' + clientId);
}

main().catch(e => console.error('Error:', e.message));
