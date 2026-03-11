var http = require('http');

function makeRequest(opts, data) {
  return new Promise(function(resolve, reject) {
    var req = http.request(opts, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: JSON.parse(body) }); });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // Step 1: Login as therapist
  var loginData = JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' });
  var loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, loginData);
  console.log('Login:', loginRes.status, loginRes.body.user ? loginRes.body.user.role : 'failed');

  // Try therapist login
  var therapistData = JSON.stringify({ email: 'therapist@test.com', password: 'Test123!' });
  var therapistRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': therapistData.length }
  }, therapistData);
  console.log('Therapist login:', therapistRes.status);

  // Get client list for the logged in user
  var token = loginRes.body.token || therapistRes.body.token;
  var user = loginRes.body.user || therapistRes.body.user;
  if (!token) {
    console.log('No token, trying to register a therapist');
    var regData = JSON.stringify({ email: 'timeline_test@test.com', password: 'Test123!', name: 'Timeline Tester' });
    var regRes = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/auth/register',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': regData.length }
    }, regData);
    console.log('Register:', regRes.status, JSON.stringify(regRes.body).substring(0, 200));
    token = regRes.body.token;
  }

  if (!token) {
    console.log('ERROR: Could not get auth token');
    process.exit(1);
  }

  console.log('Got token, user role:', user ? user.role : 'unknown');

  // Get clients
  var clientsRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Clients:', clientsRes.status, 'count:', clientsRes.body.clients ? clientsRes.body.clients.length : 0);

  if (!clientsRes.body.clients || clientsRes.body.clients.length === 0) {
    console.log('No clients found. Need to use a therapist with linked clients.');
    process.exit(1);
  }

  var clientId = clientsRes.body.clients[0].id;
  console.log('Using client ID:', clientId);

  // Test 1: Get ALL timeline items (no filter)
  var allRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/' + clientId + '/timeline',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== TEST 1: All timeline items ===');
  console.log('Status:', allRes.status, 'Total:', allRes.body.total);
  var types = {};
  if (allRes.body.timeline) {
    allRes.body.timeline.forEach(function(item) {
      types[item.type] = (types[item.type] || 0) + 1;
    });
  }
  console.log('Types breakdown:', JSON.stringify(types));
  console.log('Filters returned:', JSON.stringify(allRes.body.filters));

  // Test 2: Filter by diary only
  var diaryRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/' + clientId + '/timeline?type=diary',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== TEST 2: Diary filter ===');
  console.log('Status:', diaryRes.status, 'Total:', diaryRes.body.total);
  var allDiary = true;
  if (diaryRes.body.timeline) {
    diaryRes.body.timeline.forEach(function(item) {
      if (item.type !== 'diary') allDiary = false;
    });
  }
  console.log('All items are diary:', allDiary);
  console.log('Filter returned:', JSON.stringify(diaryRes.body.filters));

  // Test 3: Filter by note only
  var noteRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/' + clientId + '/timeline?type=note',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== TEST 3: Note filter ===');
  console.log('Status:', noteRes.status, 'Total:', noteRes.body.total);
  var allNote = true;
  if (noteRes.body.timeline) {
    noteRes.body.timeline.forEach(function(item) {
      if (item.type !== 'note') allNote = false;
    });
  }
  console.log('All items are notes:', allNote);
  console.log('Filter returned:', JSON.stringify(noteRes.body.filters));

  // Test 4: Filter by session only
  var sessionRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/' + clientId + '/timeline?type=session',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== TEST 4: Session filter ===');
  console.log('Status:', sessionRes.status, 'Total:', sessionRes.body.total);
  var allSession = true;
  if (sessionRes.body.timeline) {
    sessionRes.body.timeline.forEach(function(item) {
      if (item.type !== 'session') allSession = false;
    });
  }
  console.log('All items are sessions:', allSession);
  console.log('Filter returned:', JSON.stringify(sessionRes.body.filters));

  // Test 5: Invalid type filter should return all items
  var invalidRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/clients/' + clientId + '/timeline?type=invalid',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== TEST 5: Invalid type filter ===');
  console.log('Status:', invalidRes.status, 'Total:', invalidRes.body.total);
  console.log('Same as all?', invalidRes.body.total === allRes.body.total);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('All items:', allRes.body.total, '(types:', JSON.stringify(types), ')');
  console.log('Diary filter:', diaryRes.body.total, 'items, all diary:', allDiary);
  console.log('Note filter:', noteRes.body.total, 'items, all notes:', allNote);
  console.log('Session filter:', sessionRes.body.total, 'items, all sessions:', allSession);
  console.log('Invalid filter returns all:', invalidRes.body.total === allRes.body.total);

  var diaryCount = types['diary'] || 0;
  var noteCount = types['note'] || 0;
  var sessionCount = types['session'] || 0;
  var filterSumMatch = (diaryRes.body.total === diaryCount) && (noteRes.body.total === noteCount) && (sessionRes.body.total === sessionCount);
  console.log('Filter counts match breakdown:', filterSumMatch, '(diary:', diaryRes.body.total, '==', diaryCount, ', note:', noteRes.body.total, '==', noteCount, ', session:', sessionRes.body.total, '==', sessionCount, ')');

  if (allDiary && allNote && allSession && filterSumMatch) {
    console.log('\n✅ ALL TESTS PASSED - Timeline type filtering works correctly');
  } else {
    console.log('\n❌ SOME TESTS FAILED');
  }
}

run().catch(function(e) { console.error('Error:', e.message); process.exit(1); });
