var http = require('http');

function makeRequest(opts, data) {
  return new Promise(function(resolve, reject) {
    var req = http.request(opts, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: body }); });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function json(body) { return JSON.parse(body); }

async function post(path, data, token, isBot) {
  var d = JSON.stringify(data);
  var headers = { 'Content-Type': 'application/json', 'Content-Length': d.length };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (isBot) headers['x-bot-api-key'] = 'dev-bot-api-key';
  var res = await makeRequest({ hostname: 'localhost', port: 3001, path: path, method: 'POST', headers: headers }, d);
  return { status: res.status, body: json(res.body) };
}

async function get(path, token) {
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var res = await makeRequest({ hostname: 'localhost', port: 3001, path: path, method: 'GET', headers: headers });
  return { status: res.status, body: json(res.body) };
}

async function put(path, data, token) {
  var d = JSON.stringify(data);
  var headers = { 'Content-Type': 'application/json', 'Content-Length': d.length };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var res = await makeRequest({ hostname: 'localhost', port: 3001, path: path, method: 'PUT', headers: headers }, d);
  return { status: res.status, body: json(res.body) };
}

async function run() {
  var ts = Date.now();
  var therapistEmail = 'tl_filter_' + ts + '@test.com';

  // 0. Get CSRF token
  var csrfRes = await get('/api/csrf-token');
  var csrfToken = csrfRes.body.csrfToken;
  console.log('CSRF token obtained:', !!csrfToken);

  // 1. Register therapist (need CSRF for non-auth requests)
  var regData = JSON.stringify({ email: therapistEmail, password: 'Test123!' });
  var regRes2 = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': regData.length, 'X-CSRF-Token': csrfToken }
  }, regData);
  var regRes = { status: regRes2.status, body: json(regRes2.body) };
  console.log('Register therapist:', regRes.status);
  var token = regRes.body.token;
  var therapistId = regRes.body.user.id;

  // 2. Get invite code
  var inviteRes = await get('/api/invite-code', token);
  console.log('Invite code:', inviteRes.body.invite_code);
  var inviteCode = inviteRes.body.invite_code;

  // 3. Register client via bot
  var botRegRes = await post('/api/bot/register', { telegram_id: 'tlclient_' + ts, role: 'client' }, null, true);
  console.log('Register client:', botRegRes.status);
  var clientTelegramId = 'tlclient_' + ts;

  // 4. Connect client to therapist
  var connectRes = await post('/api/bot/connect', { telegram_id: clientTelegramId, invite_code: inviteCode }, null, true);
  console.log('Connect:', connectRes.status, JSON.stringify(connectRes.body).substring(0, 200));
  var foundTherapistId = connectRes.body.therapist ? connectRes.body.therapist.id : therapistId;

  // 5. Grant consent
  var consentRes = await post('/api/bot/consent', { telegram_id: clientTelegramId, therapist_id: foundTherapistId, consent: true }, null, true);
  console.log('Consent:', consentRes.status);

  // 6. Get client ID from therapist's client list
  var clientsRes = await get('/api/clients', token);
  console.log('Clients:', clientsRes.body.clients ? clientsRes.body.clients.length : 0);
  var clientId = clientsRes.body.clients[0].id;
  console.log('Client ID:', clientId);

  // 7. Create diary entries (text, voice, video)
  var diaryRes1 = await post('/api/bot/diary', { telegram_id: clientTelegramId, content: 'Text diary entry for timeline filter test', entry_type: 'text' }, null, true);
  console.log('Text diary:', diaryRes1.status);

  var diaryRes2 = await post('/api/bot/diary', { telegram_id: clientTelegramId, content: 'Voice diary entry for test', entry_type: 'voice', file_ref: 'voice_file_123' }, null, true);
  console.log('Voice diary:', diaryRes2.status);

  var diaryRes3 = await post('/api/bot/diary', { telegram_id: clientTelegramId, content: 'Video diary entry for test', entry_type: 'video', file_ref: 'video_file_456' }, null, true);
  console.log('Video diary:', diaryRes3.status);

  // 8. Create therapist notes
  var noteRes1 = await post('/api/clients/' + clientId + '/notes', { content: 'First therapist note for timeline filter' }, token);
  console.log('Note 1:', noteRes1.status);

  var noteRes2 = await post('/api/clients/' + clientId + '/notes', { content: 'Second therapist note for filter test' }, token);
  console.log('Note 2:', noteRes2.status);

  // 9. Create a session (upload)
  var fs = require('fs');
  var path = require('path');

  // Create a fake audio file for upload
  var boundary = 'boundary' + ts;
  var audioContent = Buffer.from('fake audio content for testing');
  var bodyParts = [];
  bodyParts.push('--' + boundary + '\r\n');
  bodyParts.push('Content-Disposition: form-data; name="client_id"\r\n\r\n');
  bodyParts.push(clientId + '\r\n');
  bodyParts.push('--' + boundary + '\r\n');
  bodyParts.push('Content-Disposition: form-data; name="audio"; filename="test.mp3"\r\n');
  bodyParts.push('Content-Type: audio/mpeg\r\n\r\n');
  var bodyStart = Buffer.from(bodyParts.join(''));
  var bodyEnd = Buffer.from('\r\n--' + boundary + '--\r\n');
  var fullBody = Buffer.concat([bodyStart, audioContent, bodyEnd]);

  var sessionRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/sessions',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': fullBody.length
    }
  }, fullBody);
  console.log('Session upload:', sessionRes.status, sessionRes.body.substring(0, 200));

  // 10. Now test timeline with type filters
  console.log('\n=== TESTING TIMELINE TYPE FILTERS ===\n');

  // All items
  var allRes = await get('/api/clients/' + clientId + '/timeline', token);
  var types = {};
  allRes.body.timeline.forEach(function(item) { types[item.type] = (types[item.type] || 0) + 1; });
  console.log('All items:', allRes.body.total, 'Types:', JSON.stringify(types));

  // Diary filter
  var diaryOnly = await get('/api/clients/' + clientId + '/timeline?type=diary', token);
  var allDiary = diaryOnly.body.timeline.every(function(item) { return item.type === 'diary'; });
  console.log('Diary filter:', diaryOnly.body.total, 'items, all diary:', allDiary, 'filter:', JSON.stringify(diaryOnly.body.filters));

  // Note filter
  var noteOnly = await get('/api/clients/' + clientId + '/timeline?type=note', token);
  var allNote = noteOnly.body.timeline.every(function(item) { return item.type === 'note'; });
  console.log('Note filter:', noteOnly.body.total, 'items, all notes:', allNote, 'filter:', JSON.stringify(noteOnly.body.filters));

  // Session filter
  var sessionOnly = await get('/api/clients/' + clientId + '/timeline?type=session', token);
  var allSession = sessionOnly.body.timeline.every(function(item) { return item.type === 'session'; });
  console.log('Session filter:', sessionOnly.body.total, 'items, all sessions:', allSession, 'filter:', JSON.stringify(sessionOnly.body.filters));

  // Invalid type returns all
  var invalidRes = await get('/api/clients/' + clientId + '/timeline?type=invalid', token);
  console.log('Invalid filter:', invalidRes.body.total, 'Same as all:', invalidRes.body.total === allRes.body.total);

  // Verify counts match
  var diaryCount = types['diary'] || 0;
  var noteCount = types['note'] || 0;
  var sessionCount = types['session'] || 0;
  var countsMatch = diaryOnly.body.total === diaryCount && noteOnly.body.total === noteCount && sessionOnly.body.total === sessionCount;
  console.log('\nCounts match:', countsMatch);
  console.log('  diary:', diaryOnly.body.total, '==', diaryCount);
  console.log('  note:', noteOnly.body.total, '==', noteCount);
  console.log('  session:', sessionOnly.body.total, '==', sessionCount);

  // Output credentials for browser testing
  console.log('\n=== CREDENTIALS FOR BROWSER TEST ===');
  console.log('Email:', therapistEmail);
  console.log('Password: Test123!');
  console.log('Client ID:', clientId);

  if (allDiary && allNote && allSession && countsMatch && invalidRes.body.total === allRes.body.total) {
    console.log('\n✅ ALL API TESTS PASSED');
  } else {
    console.log('\n❌ SOME TESTS FAILED');
  }
}

run().catch(function(e) { console.error('Error:', e.message); });
