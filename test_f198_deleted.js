// Test feature #198: Viewing/interacting with deleted records shows appropriate messages
const http = require('http');
const BASE = 'http://localhost:3001';

function request(method, path, body, token, extraHeaders) {
  return new Promise(function(resolve, reject) {
    var url = new URL(path, BASE);
    var options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function(k) {
        options.headers[k] = extraHeaders[k];
      });
    }
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  var passed = 0;
  var failed = 0;
  var botHeaders = { 'X-Bot-API-Key': 'dev-bot-api-key' };
  var csrfRes = await request('GET', '/api/csrf-token');
  var csrfToken = csrfRes.body.csrfToken;
  var ts = Date.now();

  // Register therapist
  var email = 'f198_test_' + ts + '@test.com';
  var regRes = await request('POST', '/api/auth/register', {
    email: email, password: 'StrongPwd1', role: 'therapist'
  }, null, { 'X-CSRF-Token': csrfToken });
  var token = regRes.body.token;

  // Register and link client
  var telegramId = 'f198_client_' + ts;
  await request('POST', '/api/bot/register', {
    telegram_id: telegramId, first_name: 'DeleteTestClient', role: 'client'
  }, null, botHeaders);
  var inviteRes = await request('GET', '/api/invite-code', null, token);
  var connectRes = await request('POST', '/api/bot/connect', {
    telegram_id: telegramId, invite_code: inviteRes.body.invite_code
  }, null, botHeaders);
  await request('POST', '/api/bot/consent', {
    telegram_id: telegramId, therapist_id: connectRes.body.therapist.id, consent: true
  }, null, botHeaders);

  var clientsRes = await request('GET', '/api/clients', null, token);
  var clientId = clientsRes.body.clients[0].id;
  console.log('Client ID:', clientId);

  // Create a diary entry
  var diaryRes = await request('POST', '/api/bot/diary', {
    telegram_id: telegramId,
    content: 'DELETE_TEST_ENTRY_198'
  }, null, botHeaders);
  console.log('Created diary:', diaryRes.status);

  // Get diary entries to find the ID
  var diaryList = await request('GET', '/api/clients/' + clientId + '/diary', null, token);
  console.log('Diary list keys:', Object.keys(diaryList.body));
  var entries = diaryList.body.diary_entries || diaryList.body.entries || [];
  if (entries.length === 0) { console.log('No diary entries found!', JSON.stringify(diaryList.body)); process.exit(1); }
  var entryId = entries[0].id;
  console.log('Diary entry ID:', entryId);

  // Delete the entry via API
  var delRes = await request('DELETE', '/api/clients/' + clientId + '/diary/' + entryId, null, token);
  console.log('\nTest 1: Delete diary entry');
  if (delRes.status === 200) {
    console.log('  PASS - Entry deleted (200)');
    passed++;
  } else {
    console.log('  FAIL - Expected 200, got', delRes.status);
    failed++;
  }

  // Try to delete again (already deleted)
  var delRes2 = await request('DELETE', '/api/clients/' + clientId + '/diary/' + entryId, null, token);
  console.log('\nTest 2: Delete already-deleted entry returns 404');
  if (delRes2.status === 404) {
    console.log('  PASS - Returns 404 for already-deleted entry');
    passed++;
  } else {
    console.log('  FAIL - Expected 404, got', delRes2.status);
    failed++;
  }

  // Test 3: GET non-existent session returns 404
  var sessionRes = await request('GET', '/api/sessions/99999', null, token);
  console.log('\nTest 3: GET non-existent session returns 404');
  if (sessionRes.status === 404) {
    console.log('  PASS - Returns 404');
    passed++;
  } else {
    console.log('  FAIL - Expected 404, got', sessionRes.status);
    failed++;
  }

  // Test 4: Diary list after deletion shows empty
  var diaryList2 = await request('GET', '/api/clients/' + clientId + '/diary', null, token);
  console.log('\nTest 4: Diary list after deletion shows 0 entries');
  var entries2 = diaryList2.body.entries || diaryList2.body.diary_entries || [];
  if (entries2.length === 0) {
    console.log('  PASS - 0 entries in diary');
    passed++;
  } else {
    console.log('  FAIL - Expected 0, got', entries2.length);
    failed++;
  }

  console.log('\n=== Results: ' + passed + '/' + (passed + failed) + ' passed ===');
  console.log('\nBrowser test data:');
  console.log('Email:', email);
  console.log('Password: StrongPwd1');
  console.log('Client ID:', clientId);
  console.log('Deleted entry ID:', entryId);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
