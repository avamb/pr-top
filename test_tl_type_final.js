var BASE = 'http://localhost:3001/api';
var BOT_HEADERS = {'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key'};

async function getCSRF() {
  var res = await fetch(BASE + '/csrf-token');
  var data = await res.json();
  return data.csrfToken || data.token;
}

async function test() {
  var csrf = await getCSRF();
  console.log('CSRF:', csrf ? 'obtained' : 'FAIL');

  // Register a therapist
  var res = await fetch(BASE + '/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-csrf-token': csrf},
    body: JSON.stringify({email: 'tl_type_f39b@psylink.app', password: 'Test1234!', name: 'TL Type Tester'})
  });
  var regData = await res.json();
  var token = regData.token;
  console.log('Register status:', res.status, 'token:', !!token);

  if (!token) {
    // Try login
    csrf = await getCSRF();
    res = await fetch(BASE + '/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-csrf-token': csrf},
      body: JSON.stringify({email: 'tl_type_f39b@psylink.app', password: 'Test1234!'})
    });
    regData = await res.json();
    token = regData.token;
    console.log('Login fallback:', !!token);
  }

  // Get invite code
  res = await fetch(BASE + '/invite-code', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var inviteData = await res.json();
  console.log('Invite code:', inviteData.invite_code);

  // Register client via bot
  res = await fetch(BASE + '/bot/register', {
    method: 'POST',
    headers: BOT_HEADERS,
    body: JSON.stringify({telegram_id: 'tl_type_cli_f39b', role: 'client', name: 'TL Client'})
  });
  console.log('Client reg:', res.status);

  // Connect
  res = await fetch(BASE + '/bot/connect', {
    method: 'POST',
    headers: BOT_HEADERS,
    body: JSON.stringify({telegram_id: 'tl_type_cli_f39b', invite_code: inviteData.invite_code})
  });
  console.log('Connect:', res.status);

  // Consent
  res = await fetch(BASE + '/bot/consent', {
    method: 'POST',
    headers: BOT_HEADERS,
    body: JSON.stringify({telegram_id: 'tl_type_cli_f39b', action: 'accept'})
  });
  console.log('Consent:', res.status);

  // Get client ID
  res = await fetch(BASE + '/clients', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var clientsData = await res.json();
  var clients = clientsData.clients || [];
  console.log('Clients:', clients.length);
  if (clients.length === 0) { console.log('FAIL: no clients'); return; }
  var clientId = clients[0].id;
  console.log('Client ID:', clientId);

  // Create diary entry
  res = await fetch(BASE + '/bot/diary', {
    method: 'POST',
    headers: BOT_HEADERS,
    body: JSON.stringify({telegram_id: 'tl_type_cli_f39b', content: 'TIMELINE_TYPE_DIARY', entry_type: 'text'})
  });
  var d1 = await res.json();
  console.log('Diary created:', d1.id ? 'OK' : JSON.stringify(d1).substring(0,80));

  // Create note
  csrf = await getCSRF();
  res = await fetch(BASE + '/clients/' + clientId + '/notes', {
    method: 'POST',
    headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'x-csrf-token': csrf},
    body: JSON.stringify({content: 'TIMELINE_TYPE_NOTE', session_date: '2026-03-11'})
  });
  var n1 = await res.json();
  console.log('Note created:', n1.id ? 'OK' : JSON.stringify(n1).substring(0,80));

  // Create session
  csrf = await getCSRF();
  var boundary = '----Bound39';
  var body = '--' + boundary + '\r\nContent-Disposition: form-data; name="audio"; filename="test.mp3"\r\nContent-Type: audio/mpeg\r\n\r\nfake audio\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n' + clientId + '\r\n--' + boundary + '--\r\n';
  res = await fetch(BASE + '/sessions', {
    method: 'POST',
    headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'x-csrf-token': csrf},
    body: body
  });
  var s1 = await res.json();
  console.log('Session created:', s1.id ? 'OK' : JSON.stringify(s1).substring(0,80));

  // ===== TEST TIMELINE TYPE FILTERS =====
  console.log('\n--- Timeline Type Filter Tests ---');

  // All items
  res = await fetch(BASE + '/clients/' + clientId + '/timeline', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var allData = await res.json();
  console.log('All items:', allData.total);
  var typeCounts = {};
  for (var item of allData.timeline) {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  }
  console.log('Breakdown:', JSON.stringify(typeCounts));

  // Diary filter
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=diary', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var diaryData = await res.json();
  var allDiary = diaryData.total === 0 || diaryData.timeline.every(function(i) { return i.type === 'diary'; });
  console.log('DIARY: count=' + diaryData.total + ' allCorrectType=' + allDiary);

  // Note filter
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=note', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var noteData = await res.json();
  var allNotes = noteData.total === 0 || noteData.timeline.every(function(i) { return i.type === 'note'; });
  console.log('NOTE: count=' + noteData.total + ' allCorrectType=' + allNotes);

  // Session filter
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=session', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var sessionData = await res.json();
  var allSessions = sessionData.total === 0 || sessionData.timeline.every(function(i) { return i.type === 'session'; });
  console.log('SESSION: count=' + sessionData.total + ' allCorrectType=' + allSessions);

  // Sum check
  var sum = diaryData.total + noteData.total + sessionData.total;
  console.log('Sum=' + sum + ' All=' + allData.total + ' Match=' + (sum === allData.total));

  var hasAll3 = (typeCounts.diary || 0) >= 1 && (typeCounts.note || 0) >= 1 && (typeCounts.session || 0) >= 1;
  var pass = allDiary && allNotes && allSessions && (sum === allData.total) && hasAll3;
  console.log('\nOVERALL: ' + (pass ? 'PASS' : 'FAIL'));
}

test().catch(function(e) { console.error('ERROR:', e.message); });
