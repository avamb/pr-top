const http = require('http');
const fs = require('fs');
const path = require('path');
const BOT_KEY = 'dev-bot-api-key';
const TS = Date.now();

function req(method, urlPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    var headers = Object.assign({}, extraHeaders || {});
    var data;
    if (body && typeof body === 'string') {
      // For multipart form data
      data = body;
    } else if (body) {
      data = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    var r = http.request({ hostname: '127.0.0.1', port: 3001, path: urlPath, method: method, headers: headers }, function(res) {
      var b = '';
      res.on('data', function(c) { b += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function uploadSession(token, clientId) {
  return new Promise((resolve, reject) => {
    var boundary = '----FormBoundary' + TS;
    var audioContent = Buffer.alloc(1024, 0); // fake audio data
    var bodyParts = [];
    bodyParts.push('--' + boundary + '\r\n');
    bodyParts.push('Content-Disposition: form-data; name="client_id"\r\n\r\n');
    bodyParts.push(clientId + '\r\n');
    bodyParts.push('--' + boundary + '\r\n');
    bodyParts.push('Content-Disposition: form-data; name="audio"; filename="test.mp3"\r\n');
    bodyParts.push('Content-Type: audio/mpeg\r\n\r\n');
    var headerBuf = Buffer.from(bodyParts.join(''));
    var footerBuf = Buffer.from('\r\n--' + boundary + '--\r\n');
    var fullBody = Buffer.concat([headerBuf, audioContent, footerBuf]);

    var r = http.request({
      hostname: '127.0.0.1', port: 3001, path: '/api/sessions', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': fullBody.length
      }
    }, function(res) {
      var b = '';
      res.on('data', function(c) { b += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    r.write(fullBody);
    r.end();
  });
}

var passed = 0, failed = 0;
function check(name, ok) {
  if (ok) { console.log('  PASS: ' + name); passed++; }
  else { console.log('  FAIL: ' + name); failed++; }
}

async function run() {
  console.log('=== Feature #170: Statistics update after data deletion ===\n');

  // Setup: Register therapist + client + link + consent
  var csrf = await req('GET', '/api/csrf-token');
  var csrfToken = csrf.body.csrfToken;

  var regResp = await req('POST', '/api/auth/register',
    { email: 'stats170_' + TS + '@test.com', password: 'TestPass1', role: 'therapist' },
    { 'X-CSRF-Token': csrfToken });
  var token = regResp.body.token;
  var therapistId = regResp.body.user.id;
  check('Register therapist', regResp.status === 201);

  var tgId = '170_' + TS;
  var clientReg = await req('POST', '/api/bot/register',
    { telegram_id: tgId, first_name: 'StatsClient', role: 'client' },
    { 'x-bot-api-key': BOT_KEY });
  var clientId = clientReg.body.user.id;
  check('Register client', clientReg.status === 201);

  var invite = await req('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  await req('POST', '/api/bot/connect', { telegram_id: tgId, invite_code: invite.body.invite_code }, { 'x-bot-api-key': BOT_KEY });
  await req('POST', '/api/bot/consent', { telegram_id: tgId, therapist_id: therapistId, consent: true }, { 'x-bot-api-key': BOT_KEY });
  console.log('  Client linked and consented');

  // Create test data: 2 diary entries, 1 note, 1 session
  var diary1 = await req('POST', '/api/bot/diary',
    { telegram_id: tgId, content: 'STATS_DIARY_1_' + TS, entry_type: 'text' },
    { 'x-bot-api-key': BOT_KEY });
  check('Diary 1 created', diary1.status === 201);
  var diary1Id = diary1.body.entry ? diary1.body.entry.id : diary1.body.id;

  var diary2 = await req('POST', '/api/bot/diary',
    { telegram_id: tgId, content: 'STATS_DIARY_2_' + TS, entry_type: 'text' },
    { 'x-bot-api-key': BOT_KEY });
  check('Diary 2 created', diary2.status === 201);

  var note1 = await req('POST', '/api/clients/' + clientId + '/notes',
    { content: 'STATS_NOTE_1_' + TS },
    { 'Authorization': 'Bearer ' + token, 'X-CSRF-Token': csrfToken });
  check('Note created', note1.status === 201);

  // Upload a session
  var sessionResp = await uploadSession(token, clientId);
  check('Session uploaded (' + sessionResp.status + ')', sessionResp.status === 201);
  var sessionId = sessionResp.body.session ? sessionResp.body.session.id : (sessionResp.body.id || null);
  console.log('  Session ID:', sessionId);
  if (sessionResp.status !== 201) console.log('  Session resp:', JSON.stringify(sessionResp.body).substring(0, 200));

  console.log('\n--- Step 1: Note initial dashboard stats ---');
  var stats1 = await req('GET', '/api/dashboard/stats', null, { 'Authorization': 'Bearer ' + token });
  check('Got dashboard stats', stats1.status === 200);
  console.log('  Initial stats:', JSON.stringify(stats1.body));
  var initialSessions = stats1.body.sessions;
  var initialNotes = stats1.body.notes;
  var initialClients = stats1.body.clients;

  console.log('\n--- Step 2: Delete session ---');
  if (sessionId) {
    var delSession = await req('DELETE', '/api/sessions/' + sessionId, null,
      { 'Authorization': 'Bearer ' + token, 'X-CSRF-Token': csrfToken });
    check('Session deleted (' + delSession.status + ')', delSession.status === 200);
  } else {
    console.log('  SKIP: No session ID available, testing with diary deletion instead');
  }

  console.log('\n--- Step 3: Refresh dashboard stats ---');
  var stats2 = await req('GET', '/api/dashboard/stats', null, { 'Authorization': 'Bearer ' + token });
  check('Got updated stats', stats2.status === 200);
  console.log('  Updated stats:', JSON.stringify(stats2.body));

  console.log('\n--- Step 4: Verify session count decreased ---');
  if (sessionId) {
    check('Session count decreased by 1', stats2.body.sessions === initialSessions - 1);
  } else {
    console.log('  SKIP: Testing diary deletion count instead');
  }

  console.log('\n--- Step 5: Verify other stats unchanged ---');
  check('Notes count unchanged', stats2.body.notes === initialNotes);
  check('Clients count unchanged', stats2.body.clients === initialClients);

  // Also test diary deletion affects stats
  console.log('\n--- Bonus: Delete diary entry and verify count ---');
  // Get diary entries to find the id
  var diaryList = await req('GET', '/api/clients/' + clientId + '/diary', null,
    { 'Authorization': 'Bearer ' + token });
  var diaryCount = diaryList.body.entries ? diaryList.body.entries.length : 0;
  console.log('  Diary entries before delete:', diaryCount);

  if (diaryCount > 0) {
    var entryToDelete = diaryList.body.entries[0].id;
    var delDiary = await req('DELETE', '/api/clients/' + clientId + '/diary/' + entryToDelete, null,
      { 'Authorization': 'Bearer ' + token, 'X-CSRF-Token': csrfToken });
    check('Diary entry deleted', delDiary.status === 200);

    // Check diary count decreased
    var diaryList2 = await req('GET', '/api/clients/' + clientId + '/diary', null,
      { 'Authorization': 'Bearer ' + token });
    var diaryCount2 = diaryList2.body.entries ? diaryList2.body.entries.length : 0;
    check('Diary count decreased after deletion', diaryCount2 === diaryCount - 1);
  }

  // Final stats check
  var stats3 = await req('GET', '/api/dashboard/stats', null, { 'Authorization': 'Bearer ' + token });
  console.log('  Final stats:', JSON.stringify(stats3.body));

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function(e) { console.error(e); process.exit(1); });
