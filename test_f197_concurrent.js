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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  var passed = 0;
  var failed = 0;

  // Get CSRF token
  var csrfRes = await request('GET', '/api/csrf-token');
  var csrfToken = csrfRes.body.csrfToken;

  // Register therapist
  var ts = Date.now();
  var email = 'concurrent_test_' + ts + '@test.com';
  var regRes = await request('POST', '/api/auth/register', {
    email: email,
    password: 'StrongPwd1',
    role: 'therapist'
  }, null, { 'X-CSRF-Token': csrfToken });
  var token = regRes.body.token;
  console.log('Registered therapist:', regRes.status);

  // Register client via bot
  var botHeaders = { 'X-Bot-API-Key': 'dev-bot-api-key' };
  var telegramId = 'concurrent_client_' + ts;
  var clientRes = await request('POST', '/api/bot/register', {
    telegram_id: telegramId,
    first_name: 'ConcurrentClient',
    role: 'client'
  }, null, botHeaders);
  console.log('Register client:', clientRes.status, JSON.stringify(clientRes.body));

  // Get invite code
  var inviteRes = await request('GET', '/api/invite-code', null, token);
  var inviteCode = inviteRes.body.invite_code;
  console.log('Invite code:', inviteCode);

  // Connect client
  var connectRes = await request('POST', '/api/bot/connect', {
    telegram_id: telegramId,
    invite_code: inviteCode
  }, null, botHeaders);
  console.log('Connect:', connectRes.status, JSON.stringify(connectRes.body));
  var therapistIdForConsent = connectRes.body.therapist ? connectRes.body.therapist.id : connectRes.body.therapist_id;

  // Accept consent
  var consentRes = await request('POST', '/api/bot/consent', {
    telegram_id: telegramId,
    therapist_id: therapistIdForConsent,
    consent: true
  }, null, botHeaders);
  console.log('Consent:', consentRes.status);

  // Get linked client ID
  var clientsRes = await request('GET', '/api/clients', null, token);
  console.log('Clients count:', clientsRes.body.clients ? clientsRes.body.clients.length : 0);
  if (!clientsRes.body.clients || clientsRes.body.clients.length === 0) {
    console.log('ERROR: No clients found');
    process.exit(1);
  }
  var linkedClientId = clientsRes.body.clients[0].id;
  console.log('Linked client ID:', linkedClientId);

  // === TEST 1: First save (no conflict - creating context) ===
  var save1 = await request('PUT', '/api/clients/' + linkedClientId + '/context', {
    anamnesis: 'Initial anamnesis from tab 1',
    current_goals: 'Initial goals from tab 1'
  }, token);

  console.log('\nTest 1: First save creates context');
  if (save1.status === 201) {
    console.log('  PASS - Created context (201)');
    passed++;
  } else {
    console.log('  FAIL - Expected 201, got', save1.status, JSON.stringify(save1.body));
    failed++;
  }

  var updatedAt1 = save1.body.context.updated_at;
  console.log('  updated_at after first save:', updatedAt1);

  // === TEST 2: "Tab 1" saves with correct expected_updated_at ===
  var save2 = await request('PUT', '/api/clients/' + linkedClientId + '/context', {
    anamnesis: 'Tab 1 edited anamnesis',
    expected_updated_at: updatedAt1
  }, token);

  console.log('\nTest 2: Tab 1 saves with correct expected_updated_at');
  if (save2.status === 200) {
    console.log('  PASS - Save succeeded (200)');
    passed++;
  } else {
    console.log('  FAIL - Expected 200, got', save2.status, JSON.stringify(save2.body));
    failed++;
  }

  var updatedAt2 = save2.body.context.updated_at;
  console.log('  updated_at after tab 1 save:', updatedAt2);

  // === TEST 3: "Tab 2" tries to save with OLD expected_updated_at (conflict!) ===
  var save3 = await request('PUT', '/api/clients/' + linkedClientId + '/context', {
    current_goals: 'Tab 2 edited goals',
    expected_updated_at: updatedAt1  // stale! should conflict
  }, token);

  console.log('\nTest 3: Tab 2 saves with stale expected_updated_at (should conflict)');
  if (save3.status === 409) {
    console.log('  PASS - Conflict detected (409)');
    passed++;
  } else {
    console.log('  FAIL - Expected 409, got', save3.status, JSON.stringify(save3.body));
    failed++;
  }

  // === TEST 4: Conflict response includes latest_context ===
  console.log('\nTest 4: Conflict response includes latest_context with updated data');
  if (save3.body && save3.body.conflict === true && save3.body.latest_context) {
    console.log('  PASS - conflict=true and latest_context present');
    passed++;
  } else {
    console.log('  FAIL - Missing conflict flag or latest_context', JSON.stringify(save3.body));
    failed++;
  }

  // === TEST 5: Latest context has tab 1's anamnesis (not overwritten) ===
  console.log('\nTest 5: Latest context preserves tab 1 anamnesis');
  if (save3.body && save3.body.latest_context && save3.body.latest_context.anamnesis === 'Tab 1 edited anamnesis') {
    console.log('  PASS - Anamnesis preserved: "Tab 1 edited anamnesis"');
    passed++;
  } else {
    console.log('  FAIL - Expected "Tab 1 edited anamnesis", got:', save3.body && save3.body.latest_context && save3.body.latest_context.anamnesis);
    failed++;
  }

  // === TEST 6: Tab 2 retries with correct updated_at (should succeed) ===
  var correctUpdatedAt = (save3.body && save3.body.latest_context) ? save3.body.latest_context.updated_at : updatedAt2;
  var save4 = await request('PUT', '/api/clients/' + linkedClientId + '/context', {
    current_goals: 'Tab 2 edited goals (retry)',
    expected_updated_at: correctUpdatedAt
  }, token);

  console.log('\nTest 6: Tab 2 retries with correct updated_at');
  if (save4.status === 200) {
    console.log('  PASS - Retry succeeded (200)');
    passed++;
  } else {
    console.log('  FAIL - Expected 200, got', save4.status, JSON.stringify(save4.body));
    failed++;
  }

  // === TEST 7: Both edits are preserved ===
  console.log('\nTest 7: Both tab 1 anamnesis and tab 2 goals preserved');
  if (save4.body && save4.body.context) {
    var finalAnamnesis = save4.body.context.anamnesis;
    var finalGoals = save4.body.context.current_goals;
    if (finalAnamnesis === 'Tab 1 edited anamnesis' && finalGoals === 'Tab 2 edited goals (retry)') {
      console.log('  PASS - Both edits preserved');
      console.log('    anamnesis:', finalAnamnesis);
      console.log('    current_goals:', finalGoals);
      passed++;
    } else {
      console.log('  FAIL - Data mismatch');
      console.log('    anamnesis:', finalAnamnesis);
      console.log('    current_goals:', finalGoals);
      failed++;
    }
  } else {
    console.log('  FAIL - No context in response');
    failed++;
  }

  console.log('\n=== Results: ' + passed + '/' + (passed + failed) + ' passed ===');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function(e) { console.error(e); process.exit(1); });
