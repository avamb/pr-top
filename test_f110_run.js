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
  const botH = { 'x-bot-api-key': 'dev-bot-api-key' };

  // Login
  const login = await apiCall('POST', '/api/auth/login', {
    email: 'f109test@test.com',
    password: 'TestPass123'
  }, { 'x-csrf-token': csrf });
  const token = login.token;
  const therapistId = login.user.id;
  const authH = { 'Authorization': 'Bearer ' + token };
  console.log('Logged in as therapist', therapistId);

  // Create a new client for testing
  const telegramId = 'f110_del_' + Date.now();
  await apiCall('POST', '/api/bot/register', {
    telegram_id: telegramId,
    username: 'f110delclient',
    first_name: 'Delete',
    last_name: 'TestClient',
    role: 'client'
  }, botH);

  await apiCall('POST', '/api/bot/consent', {
    telegram_id: telegramId,
    therapist_id: therapistId,
    consent: true
  }, botH);

  // Create diary entry DELETE_TEST_22222
  const diaryRes = await apiCall('POST', '/api/bot/diary', {
    telegram_id: telegramId,
    content: 'DELETE_TEST_22222',
    entry_type: 'text'
  }, botH);
  console.log('Created diary entry:', JSON.stringify(diaryRes));

  // Get clients
  const clients = await apiCall('GET', '/api/clients', null, authH);
  const clientList = clients.clients || clients;
  const myClient = clientList.find(c => c.telegram_id === telegramId);
  console.log('Client ID:', myClient ? myClient.id : 'NOT FOUND');

  if (myClient) {
    // Verify diary entry exists
    const diary = await apiCall('GET', '/api/clients/' + myClient.id + '/diary', null, authH);
    const entries = diary.entries || [];
    const found = entries.find(e => (e.content || '').includes('DELETE_TEST_22222'));
    console.log('Entry found before delete:', found ? 'YES (id=' + found.id + ')' : 'NO');

    if (found) {
      // Test delete
      const delRes = await apiCall('DELETE', '/api/clients/' + myClient.id + '/diary/' + found.id, null, authH);
      console.log('Delete result:', JSON.stringify(delRes));

      // Verify gone from diary
      const diary2 = await apiCall('GET', '/api/clients/' + myClient.id + '/diary', null, authH);
      const entries2 = diary2.entries || [];
      const found2 = entries2.find(e => (e.content || '').includes('DELETE_TEST_22222'));
      console.log('Entry found after delete in diary:', found2 ? 'YES - FAIL' : 'NO - PASS');

      // Verify gone from timeline
      const timeline = await apiCall('GET', '/api/clients/' + myClient.id + '/timeline', null, authH);
      const tlItems = timeline.items || timeline;
      let foundInTimeline = false;
      if (Array.isArray(tlItems)) {
        foundInTimeline = tlItems.some(item => (item.content || '').includes('DELETE_TEST_22222'));
      }
      console.log('Entry found after delete in timeline:', foundInTimeline ? 'YES - FAIL' : 'NO - PASS');
    }
  }

  console.log('TOKEN=' + token);
}

main().catch(e => console.error(e));
