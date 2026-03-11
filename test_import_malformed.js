// Test: Feature #203 - Import data with malformed file shows error
var http = require('http');
var fs = require('fs');
var path = require('path');

var BOT_KEY = 'dev-bot-api-key';
var TIMESTAMP = Date.now();

function request(method, urlPath, body, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001,
      path: urlPath, method: method,
      headers: Object.assign({}, headers || {})
    };
    if (body && !(body instanceof Buffer)) {
      opts.headers['Content-Type'] = 'application/json';
    }
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) {
      if (body instanceof Buffer) req.write(body);
      else if (typeof body === 'string') req.write(body);
      else req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function multipartUpload(urlPath, filename, content, headers) {
  return new Promise(function(resolve, reject) {
    var boundary = '----FormBoundary' + Date.now();
    var bodyParts = [];
    bodyParts.push('--' + boundary + '\r\n');
    bodyParts.push('Content-Disposition: form-data; name="file"; filename="' + filename + '"\r\n');
    bodyParts.push('Content-Type: application/json\r\n\r\n');
    bodyParts.push(content);
    bodyParts.push('\r\n--' + boundary + '--\r\n');
    var bodyStr = bodyParts.join('');

    var opts = {
      hostname: 'localhost', port: 3001,
      path: urlPath, method: 'POST',
      headers: Object.assign({
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': Buffer.byteLength(bodyStr)
      }, headers || {})
    };

    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function test() {
  console.log('=== Feature #203: Import data with malformed file shows error ===\n');

  // Setup: register therapist and linked client
  var regRes = await request('POST', '/api/auth/register', {
    email: 'import_test_' + TIMESTAMP + '@test.com',
    password: 'TestPass123!',
    confirm_password: 'TestPass123!'
  });
  var token = regRes.body.token;
  var therapistId = regRes.body.user && regRes.body.user.id;
  if (!therapistId) {
    console.log('Register failed, trying login...');
    console.log('Register response:', JSON.stringify(regRes.body));
    var loginRes = await request('POST', '/api/auth/login', {
      email: 'import_test_' + TIMESTAMP + '@test.com', password: 'TestPass123!'
    });
    token = loginRes.body.token;
    var meRes = await request('GET', '/api/auth/me', null, { 'Authorization': 'Bearer ' + token });
    therapistId = meRes.body.id;
  }

  var inviteRes = await request('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  var inviteCode = inviteRes.body.invite_code;

  var clientTg = 'import_client_' + TIMESTAMP;
  var clientRes = await request('POST', '/api/bot/register', {
    telegram_id: clientTg, role: 'client', display_name: 'ImportTestClient'
  }, { 'x-bot-api-key': BOT_KEY });
  var clientId = clientRes.body.user.id;

  await request('POST', '/api/bot/connect', {
    telegram_id: clientTg, invite_code: inviteCode
  }, { 'x-bot-api-key': BOT_KEY });

  await request('POST', '/api/bot/consent', {
    telegram_id: clientTg, therapist_id: therapistId, consent: true
  }, { 'x-bot-api-key': BOT_KEY });

  console.log('Setup: Therapist ID=' + therapistId + ', Client ID=' + clientId);

  var authHeader = { 'Authorization': 'Bearer ' + token };
  var importUrl = '/api/clients/' + clientId + '/import';

  // Get note count before tests
  var notesBefore = await request('GET', '/api/clients/' + clientId + '/notes', null, authHeader);
  var noteCountBefore = (notesBefore.body.notes || []).length;
  console.log('Notes before import tests:', noteCountBefore);

  var results = [];

  // Test 1: Malformed JSON (corrupted file)
  console.log('\nTest 1: Malformed JSON...');
  var r1 = await multipartUpload(importUrl, 'bad.json', '{this is not valid json!!!', authHeader);
  console.log('  Status:', r1.status, '| Error:', r1.body.error);
  results.push({ name: 'Malformed JSON', pass: r1.status === 400 && r1.body.error && r1.body.error.includes('Malformed') });

  // Test 2: Valid JSON but wrong structure (no type field)
  console.log('\nTest 2: Missing type field...');
  var r2 = await multipartUpload(importUrl, 'noType.json', JSON.stringify({ entries: [{ content: 'test' }] }), authHeader);
  console.log('  Status:', r2.status, '| Error:', r2.body.error);
  results.push({ name: 'Missing type', pass: r2.status === 400 && r2.body.error && r2.body.error.includes('type') });

  // Test 3: Valid JSON but entries not array
  console.log('\nTest 3: Entries not array...');
  var r3 = await multipartUpload(importUrl, 'badEntries.json', JSON.stringify({ type: 'notes', entries: 'not-array' }), authHeader);
  console.log('  Status:', r3.status, '| Error:', r3.body.error);
  results.push({ name: 'Entries not array', pass: r3.status === 400 && r3.body.error && r3.body.error.includes('array') });

  // Test 4: Empty entries array
  console.log('\nTest 4: Empty entries...');
  var r4 = await multipartUpload(importUrl, 'empty.json', JSON.stringify({ type: 'notes', entries: [] }), authHeader);
  console.log('  Status:', r4.status, '| Error:', r4.body.error);
  results.push({ name: 'Empty entries', pass: r4.status === 400 && r4.body.error && (r4.body.error.includes('empty') || r4.body.error.includes('No entries')) });

  // Test 5: Entries with missing content
  console.log('\nTest 5: Missing content in entries...');
  var r5 = await multipartUpload(importUrl, 'noContent.json', JSON.stringify({ type: 'notes', entries: [{ title: 'no content' }, { content: '' }] }), authHeader);
  console.log('  Status:', r5.status, '| Error:', r5.body.error);
  results.push({ name: 'Missing content', pass: r5.status === 400 && r5.body.error && r5.body.error.includes('validation') });

  // Test 6: Verify no partial data imported after failures
  console.log('\nTest 6: Verify no partial data imported...');
  var notesAfter = await request('GET', '/api/clients/' + clientId + '/notes', null, authHeader);
  var noteCountAfter = (notesAfter.body.notes || []).length;
  console.log('  Notes after tests:', noteCountAfter, '(before:', noteCountBefore, ')');
  results.push({ name: 'No partial import', pass: noteCountAfter === noteCountBefore });

  // Test 7: Valid import works (to verify the endpoint functions correctly)
  console.log('\nTest 7: Valid import (control)...');
  var r7 = await multipartUpload(importUrl, 'valid.json', JSON.stringify({
    type: 'notes',
    entries: [{ content: 'IMPORT_VALID_NOTE_203' }]
  }), authHeader);
  console.log('  Status:', r7.status, '| Imported:', r7.body.imported);
  results.push({ name: 'Valid import works', pass: r7.status === 200 && r7.body.imported === 1 });

  // Print summary
  console.log('\n=== RESULTS ===');
  var allPass = true;
  results.forEach(function(r) {
    console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name);
    if (!r.pass) allPass = false;
  });
  console.log('\n=== OVERALL:', allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED', '===');

  // Cleanup: remove the valid import note
  if (r7.status === 200) {
    var cleanNotes = await request('GET', '/api/clients/' + clientId + '/notes', null, authHeader);
    // cleanup not strictly necessary
  }
}

test().catch(function(e) { console.error('Error:', e); });
