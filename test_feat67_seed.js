const http = require('http');

const BOT_KEY = 'dev-bot-api-key';

function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Get CSRF token
  const csrfRes = await httpReq({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrfRes.body).csrfToken;

  // Register a therapist
  const regRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
  }, JSON.stringify({ email: 'freq_therapist@test.com', password: 'Test123!', role: 'therapist' }));
  let regData = JSON.parse(regRes.body);
  let token = regData.token;

  if (!token) {
    const loginRes = await httpReq({
      hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    }, JSON.stringify({ email: 'freq_therapist@test.com', password: 'Test123!' }));
    token = JSON.parse(loginRes.body).token;
  }
  console.log('Token:', token ? 'yes' : 'no');

  // Register a client via bot API with bot auth key
  const clientRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/bot/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-API-Key': BOT_KEY }
  }, JSON.stringify({ telegram_id: 'freq_client_999', role: 'client' }));
  console.log('Client register:', clientRes.status, clientRes.body.slice(0, 100));

  // Get therapist's invite code
  const inviteRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/invite-code', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const inviteCode = JSON.parse(inviteRes.body).invite_code;
  console.log('Invite code:', inviteCode);

  // Connect and consent
  const connectRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/bot/connect', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-API-Key': BOT_KEY }
  }, JSON.stringify({ telegram_id: 'freq_client_999', invite_code: inviteCode }));
  const connectData = JSON.parse(connectRes.body);
  const therapistId = connectData.therapist ? connectData.therapist.id : null;
  console.log('Connect:', connectRes.status, 'therapist_id:', therapistId);

  const consentRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/bot/consent', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-API-Key': BOT_KEY }
  }, JSON.stringify({ telegram_id: 'freq_client_999', therapist_id: therapistId, consent: true }));
  console.log('Consent:', consentRes.status, consentRes.body.slice(0, 100));

  // Get client list to find client ID
  const clientsRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/clients', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const clientsData = JSON.parse(clientsRes.body);
  const client = clientsData.clients ? clientsData.clients.find(c => c.telegram_id === 'freq_client_999') : null;
  if (!client) {
    console.log('Client not found, trying all clients...');
    console.log('Clients:', JSON.stringify(clientsData).slice(0, 500));
    return;
  }
  console.log('Client ID:', client.id);

  // Create sessions via multipart upload
  const boundary = '----FormBoundary' + Date.now();
  for (let i = 0; i < 5; i++) {
    const audioContent = 'fake-audio-data-for-session-' + i;
    const body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="client_id"',
      '',
      String(client.id),
      '--' + boundary,
      'Content-Disposition: form-data; name="audio"; filename="session_' + i + '.webm"',
      'Content-Type: audio/webm',
      '',
      audioContent,
      '--' + boundary + '--'
    ].join('\r\n');

    const sessionRes = await httpReq({
      hostname: 'localhost', port: 3001, path: '/api/sessions', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'X-CSRF-Token': csrfToken
      }
    }, body);
    console.log('Session ' + i + ':', sessionRes.status, sessionRes.body.slice(0, 80));
  }

  // Check analytics
  const analyticsRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/dashboard/analytics?days=30', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const analytics = JSON.parse(analyticsRes.body);
  console.log('\nSession frequency:', JSON.stringify(analytics.session_frequency, null, 2));

  // Verify session_frequency has correct data
  const sf = analytics.session_frequency;
  if (sf.total_sessions >= 5) {
    console.log('\n=== SESSION FREQUENCY DATA CORRECT ===');
  } else {
    console.log('\nWARN: Expected >= 5 sessions, got', sf.total_sessions);
  }
}

main().catch(e => console.error('Error:', e));
