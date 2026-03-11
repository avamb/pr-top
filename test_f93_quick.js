const http = require('http');

function req(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path, method, headers: headers || {} };
    const r = http.request(opts, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { resolve(b); } });
    });
    r.on('error', reject);
    if (body) { r.write(JSON.stringify(body)); }
    r.end();
  });
}

async function main() {
  // Get CSRF
  const csrf = await req('GET', '/api/csrf-token');

  // Register + login
  const email = 'th_f93q_' + Date.now() + '@test.com';
  await req('POST', '/api/auth/register', { email, password: 'Test123!', role: 'therapist' }, { 'Content-Type': 'application/json', 'x-csrf-token': csrf.csrfToken });
  const login = await req('POST', '/api/auth/login', { email, password: 'Test123!' }, { 'Content-Type': 'application/json', 'x-csrf-token': csrf.csrfToken });
  const token = login.token;
  const auth = { 'Authorization': 'Bearer ' + token };
  const botH = { 'x-bot-api-key': 'dev-bot-api-key', 'Content-Type': 'application/json' };

  // Create client + link
  const tid = 'qc_' + Date.now();
  await req('POST', '/api/bot/register', { telegram_id: tid, role: 'client', language: 'en' }, botH);
  const inv = await req('GET', '/api/invite-code', null, auth);
  const conn = await req('POST', '/api/bot/connect', { telegram_id: tid, invite_code: inv.invite_code || inv.code }, botH);
  await req('POST', '/api/bot/consent', { telegram_id: tid, therapist_id: conn.therapist.id, consent: true }, botH);

  // Get client
  const cl = await req('GET', '/api/clients', null, auth);
  const clientId = cl.clients[0].id;

  // Upload session
  const boundary = '----FB' + Date.now();
  const audio = Buffer.from('test audio about anxiety breathing sleep family mood stress');
  const body = Buffer.concat([
    Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'),
    audio,
    Buffer.from('\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n' + clientId + '\r\n--' + boundary + '--\r\n')
  ]);

  const upload = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path: '/api/sessions', method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length, 'Authorization': 'Bearer ' + token }
    };
    const r = http.request(opts, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { resolve(b); } });
    });
    r.on('error', reject);
    r.write(body); r.end();
  });

  const sid = upload.session ? upload.session.id : upload.id;
  console.log('Session created:', sid);

  // Wait and trigger pipeline
  await new Promise(r => setTimeout(r, 3000));
  await req('POST', '/api/sessions/' + sid + '/transcribe', {}, Object.assign({ 'Content-Type': 'application/json' }, auth));
  await new Promise(r => setTimeout(r, 2000));
  await req('POST', '/api/sessions/' + sid + '/summarize', {}, Object.assign({ 'Content-Type': 'application/json' }, auth));
  await new Promise(r => setTimeout(r, 2000));

  // Get session detail - check both possible shapes
  const detail = await req('GET', '/api/sessions/' + sid, null, auth);
  console.log('Session detail keys:', Object.keys(detail));
  console.log('Session detail:', JSON.stringify(detail).substring(0, 1000));

  // Extract summary
  const session = detail.session || detail;
  if (session.summary) {
    console.log('\n=== SUMMARY ===');
    console.log(session.summary);
  } else {
    console.log('No summary. Status:', session.status);
  }
}

main().catch(console.error);
