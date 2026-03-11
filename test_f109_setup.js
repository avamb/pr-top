const http = require('http');

function apiCall(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch(e) { resolve(b); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getCsrfToken() {
  const res = await apiCall('GET', '/api/csrf-token');
  return res.csrfToken || res.token || '';
}

async function main() {
  const csrf = await getCsrfToken();
  const csrfH = { 'x-csrf-token': csrf };
  const botH = { 'x-bot-api-key': 'dev-bot-api-key' };

  // 1. Login as therapist
  const login = await apiCall('POST', '/api/auth/login', {
    email: 'f109test@test.com',
    password: 'TestPass123'
  }, csrfH);
  const token = login.token;
  const therapistId = login.user.id;
  console.log('Therapist ID:', therapistId);

  const authH = { 'Authorization': 'Bearer ' + token };

  // 2. Register client via bot API
  const telegramId = 'f109_diary_' + Date.now();
  const botClient = await apiCall('POST', '/api/bot/register', {
    telegram_id: telegramId,
    username: 'f109diaryclient2',
    first_name: 'DiaryTest',
    last_name: 'Client',
    role: 'client'
  }, botH);
  console.log('Bot client:', JSON.stringify(botClient));
  const clientId = botClient.user.id;

  // 3. Link client to therapist via consent
  const consent = await apiCall('POST', '/api/bot/consent', {
    telegram_id: telegramId,
    therapist_id: therapistId,
    consent: true
  }, botH);
  console.log('Consent:', JSON.stringify(consent));

  // 4. Submit diary entry
  const diaryRes = await apiCall('POST', '/api/bot/diary', {
    telegram_id: telegramId,
    content: 'REFRESH_TEST_11111',
    entry_type: 'text'
  }, botH);
  console.log('Diary entry:', JSON.stringify(diaryRes));

  // 5. Verify via therapist API
  const clients = await apiCall('GET', '/api/clients', null, authH);
  const clientList = clients.clients || clients;
  console.log('Clients:', Array.isArray(clientList) ? clientList.length : JSON.stringify(clientList).substring(0, 200));

  if (Array.isArray(clientList) && clientList.length > 0) {
    const myClient = clientList.find(c => c.telegram_id === telegramId) || clientList[0];
    console.log('Found client:', myClient.id, myClient.telegram_id);

    const diary = await apiCall('GET', '/api/clients/' + myClient.id + '/diary', null, authH);
    const entries = diary.entries || diary;
    console.log('Diary entries:', Array.isArray(entries) ? entries.length : 'check');
    if (Array.isArray(entries)) {
      const found = entries.find(e => (e.content || '').includes('REFRESH_TEST_11111'));
      console.log('Found REFRESH_TEST_11111:', found ? 'YES' : 'NO');
    }
  }

  console.log('--- SETUP COMPLETE ---');
  console.log('Email: f109test@test.com');
  console.log('Password: TestPass123');
}

main().catch(e => console.error(e));
