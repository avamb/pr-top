// Setup test data and verify timeline type filtering
var BASE = 'http://localhost:3001/api';

async function test() {
  // Register a therapist
  var res = await fetch(BASE + '/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'tl_type_test@psylink.app', password: 'Test1234!', name: 'Timeline Type Tester'})
  });
  var regData = await res.json();
  var token = regData.token;
  console.log('Therapist registered/login, token:', !!token);

  if (!token) {
    // Try login
    res = await fetch(BASE + '/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'tl_type_test@psylink.app', password: 'Test1234!'})
    });
    regData = await res.json();
    token = regData.token;
    console.log('Login fallback, token:', !!token);
  }

  // Get therapist info
  res = await fetch(BASE + '/auth/me', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var me = await res.json();
  console.log('Therapist:', me.user?.id, me.user?.role);
  var therapistId = me.user?.id;

  // Get invite code
  res = await fetch(BASE + '/invite-code', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var inviteData = await res.json();
  console.log('Invite code:', inviteData.invite_code);

  // Register a client via bot API
  res = await fetch(BASE + '/bot/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({telegram_id: 'tl_type_client_991', role: 'client', name: 'TL Type Client'})
  });
  var clientReg = await res.json();
  console.log('Client registered:', clientReg.user_id || clientReg.id);

  // Connect client
  res = await fetch(BASE + '/bot/connect', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({telegram_id: 'tl_type_client_991', invite_code: inviteData.invite_code})
  });
  var connectData = await res.json();
  console.log('Connect:', connectData.status || connectData.message || JSON.stringify(connectData).substring(0,100));

  // Give consent
  res = await fetch(BASE + '/bot/consent', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({telegram_id: 'tl_type_client_991', action: 'accept'})
  });
  var consentData = await res.json();
  console.log('Consent:', consentData.status || consentData.message);

  // Get client list to get client ID
  res = await fetch(BASE + '/clients', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var clientsData = await res.json();
  var clients = clientsData.clients || [];
  console.log('Clients:', clients.length);

  if (clients.length === 0) {
    console.log('FAIL: No clients after setup');
    return;
  }

  var clientId = clients[0].id;
  console.log('Client ID:', clientId);

  // Create diary entries
  res = await fetch(BASE + '/bot/diary', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({telegram_id: 'tl_type_client_991', content: 'TL_TYPE_DIARY_1', entry_type: 'text'})
  });
  console.log('Diary 1:', (await res.json()).id ? 'OK' : 'FAIL');

  res = await fetch(BASE + '/bot/diary', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({telegram_id: 'tl_type_client_991', content: 'TL_TYPE_DIARY_2', entry_type: 'voice', file_ref: 'voice_ref_test'})
  });
  console.log('Diary 2:', (await res.json()).id ? 'OK' : 'FAIL');

  // Create note
  res = await fetch(BASE + '/clients/' + clientId + '/notes', {
    method: 'POST',
    headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: JSON.stringify({content: 'TL_TYPE_NOTE_1', session_date: '2026-03-11'})
  });
  console.log('Note:', (await res.json()).id ? 'OK' : 'FAIL');

  // Create session (audio upload)
  var FormData = (await import('node:buffer')).Buffer;
  var boundary = '----TestBoundary123';
  var audioContent = 'fake audio content for testing';
  var body = '--' + boundary + '\r\nContent-Disposition: form-data; name="audio"; filename="test.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n' + audioContent + '\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n' + clientId + '\r\n--' + boundary + '--\r\n';

  res = await fetch(BASE + '/sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    },
    body: body
  });
  var sessionRes = await res.json();
  console.log('Session:', sessionRes.id ? 'OK' : JSON.stringify(sessionRes).substring(0,100));

  // Now test timeline type filters
  console.log('\n--- Testing Timeline Type Filters ---');

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
  console.log('Type breakdown:', JSON.stringify(typeCounts));

  // Diary only
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=diary', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var diaryData = await res.json();
  var allDiary = diaryData.timeline.every(function(i) { return i.type === 'diary'; });
  console.log('Diary filter: count=' + diaryData.total + ', allDiary=' + allDiary + ', expected=' + (typeCounts.diary || 0));

  // Note only
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=note', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var noteData = await res.json();
  var allNotes = noteData.timeline.every(function(i) { return i.type === 'note'; });
  console.log('Note filter: count=' + noteData.total + ', allNotes=' + allNotes + ', expected=' + (typeCounts.note || 0));

  // Session only
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=session', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var sessionData = await res.json();
  var allSessions = sessionData.timeline.every(function(i) { return i.type === 'session'; });
  console.log('Session filter: count=' + sessionData.total + ', allSessions=' + allSessions + ', expected=' + (typeCounts.session || 0));

  // Sum check
  var sum = diaryData.total + noteData.total + sessionData.total;
  console.log('\nSum check: ' + sum + ' == ' + allData.total + ' ? ' + (sum === allData.total));

  // All pass?
  var pass = allDiary && allNotes && allSessions && (sum === allData.total) && allData.total >= 3;
  console.log('\nOVERALL: ' + (pass ? 'PASS' : 'FAIL'));
}

test().catch(function(e) { console.error('ERROR:', e.message); });
