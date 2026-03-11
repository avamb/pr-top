const http = require('http');
const fs = require('fs');
const path = require('path');

function req(method, urlPath, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path: urlPath, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) Object.assign(opts.headers, extraHeaders);
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function multipartUpload(urlPath, token, filePath, clientId) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const fileData = fs.readFileSync(filePath);
    const preamble = Buffer.from(
      '--' + boundary + '\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n' + clientId + '\r\n' +
      '--' + boundary + '\r\nContent-Disposition: form-data; name="audio"; filename="test.mp3"\r\nContent-Type: audio/mp3\r\n\r\n'
    );
    const epilogue = Buffer.from('\r\n--' + boundary + '--\r\n');
    const body = Buffer.concat([preamble, fileData, epilogue]);
    const opts = {
      hostname: 'localhost', port: 3001, path: urlPath, method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length,
        'Authorization': 'Bearer ' + token
      }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

async function main() {
  const ts = Date.now();
  const BOT_HEADERS = { 'X-Bot-API-Key': 'dev-bot-api-key' };

  // Get CSRF token
  const csrfRes = await req('GET', '/api/csrf-token');
  const csrf = csrfRes.body.csrfToken;
  console.log('0. CSRF token obtained');

  // Register therapist
  const email = 'slt_' + ts + '@test.com';
  const regRes = await req('POST', '/api/auth/register', { email, password: 'Test123!', role: 'therapist' }, null, { 'X-CSRF-Token': csrf });
  console.log('1. Register therapist:', regRes.status);
  const token = regRes.body.token;
  const therapistId = regRes.body.user.id;

  // Get invite code
  const invRes = await req('GET', '/api/invite-code', null, token);
  const inviteCode = invRes.body.invite_code;
  console.log('2. Invite code:', inviteCode);

  // Register client via bot
  const tgId = 'tg_slt_' + ts;
  const botRegRes = await req('POST', '/api/bot/register', { telegram_id: tgId, role: 'client' }, null, BOT_HEADERS);
  console.log('3. Bot register:', botRegRes.status, JSON.stringify(botRegRes.body));

  // Connect
  const connectRes = await req('POST', '/api/bot/connect', { telegram_id: tgId, invite_code: inviteCode }, null, BOT_HEADERS);
  console.log('4. Connect:', connectRes.status);
  const connTherapistId = connectRes.body.therapist ? connectRes.body.therapist.id : therapistId;

  // Consent - needs therapist_id and consent=true
  const consentRes = await req('POST', '/api/bot/consent', { telegram_id: tgId, therapist_id: connTherapistId, consent: true }, null, BOT_HEADERS);
  console.log('5. Consent:', consentRes.status, consentRes.body.status || consentRes.body.error);

  // Get linked client
  const clientsRes = await req('GET', '/api/clients', null, token);
  const clients = clientsRes.body.clients || [];
  console.log('6. Clients count:', clients.length);

  if (clients.length === 0) {
    console.log('ERROR: No linked client. Trying alternative approach...');
    // Check if we can find the client ID from the bot user
    const botUser = await req('GET', '/api/bot/user/' + tgId, null, null, BOT_HEADERS);
    console.log('Bot user:', JSON.stringify(botUser.body));
    return;
  }
  const linkedClientId = clients[0].id;
  console.log('7. Client ID:', linkedClientId);

  // Create dummy audio file
  const tmpFile = path.join(__dirname, 'test_audio_limit.mp3');
  fs.writeFileSync(tmpFile, Buffer.alloc(512));

  // Upload 5 sessions then try 6th
  for (let i = 1; i <= 5; i++) {
    const up = await multipartUpload('/api/sessions', token, tmpFile, linkedClientId);
    console.log('Upload ' + i + ':', up.status);
  }

  // 6th should be blocked
  const up6 = await multipartUpload('/api/sessions', token, tmpFile, linkedClientId);
  console.log('Upload 6 (should be 403):', up6.status, JSON.stringify(up6.body));

  if (up6.status === 403 && up6.body.error && up6.body.error.includes('Session limit')) {
    console.log('\n=== PASS ===');
  } else {
    console.log('\n=== FAIL ===');
  }

  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
}

main().catch(e => console.error('Error:', e.message));
