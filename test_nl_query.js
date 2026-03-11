var http = require('http');

function request(method, path, body, token, botKey) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (botKey) opts.headers['x-bot-api-key'] = botKey;
    var r = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  var ts = Date.now();
  var email = 'nltest3_' + ts + '@test.com';
  var bk = 'dev-bot-api-key';

  // 1. Register therapist
  process.stdout.write('1. Registering therapist...\n');
  var reg = await request('POST', '/api/auth/register', { email: email, password: 'TestPass123' });
  process.stdout.write('   Status: ' + reg.status + '\n');
  var token = reg.body.token;
  var therapistId = reg.body.user ? reg.body.user.id : undefined;
  process.stdout.write('   Therapist ID: ' + therapistId + '\n');

  // 2. Upgrade to Pro
  process.stdout.write('2. Upgrading to Pro...\n');
  var upgrade = await request('POST', '/api/subscription/change-plan', { plan: 'pro' }, token);
  process.stdout.write('   Status: ' + upgrade.status + '\n');

  // 3. Create client via bot
  process.stdout.write('3. Creating client...\n');
  var clientTgId = 'nlclient3_' + ts;
  var clientReg = await request('POST', '/api/bot/register', {
    telegram_id: clientTgId, role: 'client'
  }, null, bk);
  process.stdout.write('   Client: ' + clientReg.status + '\n');
  var clientUserId = clientReg.body.user ? clientReg.body.user.id : undefined;
  process.stdout.write('   Client ID: ' + clientUserId + '\n');

  // 4. Connect and consent
  process.stdout.write('4. Connecting...\n');
  var invRes = await request('GET', '/api/invite-code', null, token);
  var inviteCode = invRes.body.invite_code;
  process.stdout.write('   Invite code: ' + inviteCode + '\n');
  var connRes = await request('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inviteCode }, null, bk);
  process.stdout.write('   Connect: ' + connRes.status + ' ' + (connRes.body.message || '') + '\n');
  var consRes = await request('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: therapistId, consent: true }, null, bk);
  process.stdout.write('   Consent: ' + consRes.status + ' ' + (consRes.body.message || JSON.stringify(consRes.body)) + '\n');

  // 5. Create diary entries
  process.stdout.write('5. Creating diary entries...\n');
  var diaryEntries = [
    { content: 'Today I felt very anxious about my upcoming job interview. My heart was racing and I could not sleep well last night. The anxiety is getting worse each day.', entry_type: 'text' },
    { content: 'Had a wonderful day at the park with my family. Feeling happy and grateful. The fresh air really helped my mood improve.', entry_type: 'text' },
    { content: 'I have been experiencing panic attacks at work. My boss has been very demanding and the stress is overwhelming. I feel like I cannot cope anymore.', entry_type: 'text' },
    { content: 'Tried the breathing exercise my therapist recommended. It helped me calm down during a stressful meeting. I think the coping strategies are starting to work.', entry_type: 'text' },
    { content: 'Sleep has been terrible this week. Insomnia is back. I keep waking up at 3am with racing thoughts about my relationship problems.', entry_type: 'text' }
  ];
  for (var i = 0; i < diaryEntries.length; i++) {
    var de = diaryEntries[i];
    var dr = await request('POST', '/api/bot/diary', { telegram_id: clientTgId, content: de.content, entry_type: de.entry_type }, null, bk);
    process.stdout.write('   Diary: ' + dr.status + '\n');
  }

  // 6. Create notes
  process.stdout.write('6. Creating notes...\n');
  var n1 = await request('POST', '/api/clients/' + clientUserId + '/notes', {
    content: 'Client shows signs of generalized anxiety disorder. Recommended CBT techniques and breathing exercises. Follow up on sleep hygiene.'
  }, token);
  process.stdout.write('   Note1: ' + n1.status + '\n');
  var n2 = await request('POST', '/api/clients/' + clientUserId + '/notes', {
    content: 'Good progress this session. Client reports reduced panic attacks after practicing grounding techniques. Workplace stress remains a trigger.'
  }, token);
  process.stdout.write('   Note2: ' + n2.status + '\n');

  // === NL Query Tests ===
  process.stdout.write('\n=== NL Query Tests ===\n\n');

  // Test 1: Query about anxiety
  process.stdout.write('TEST 1: Query about anxiety\n');
  var q1 = await request('POST', '/api/query', { client_id: clientUserId, query: 'How is the client feeling about anxiety?' }, token);
  process.stdout.write('   Status: ' + q1.status + '\n');
  process.stdout.write('   Matches: ' + (q1.body.total_matches || 0) + '\n');
  if (q1.body.expanded_terms) process.stdout.write('   Expanded: ' + q1.body.expanded_terms.slice(0, 5).join(', ') + '\n');
  if (q1.body.results && q1.body.results.length > 0) {
    process.stdout.write('   Top type: ' + q1.body.results[0].type + '\n');
    process.stdout.write('   Top relevance: ' + q1.body.results[0].relevance + '\n');
    process.stdout.write('   Top snippet: ' + (q1.body.results[0].content || '').substring(0, 120) + '\n');
  }
  if (q1.body.error) process.stdout.write('   ERROR: ' + q1.body.error + '\n');

  // Test 2: Sleep
  process.stdout.write('\nTEST 2: Query about sleep problems\n');
  var q2 = await request('POST', '/api/query', { client_id: clientUserId, query: 'Tell me about sleep issues' }, token);
  process.stdout.write('   Status: ' + q2.status + '\n');
  process.stdout.write('   Matches: ' + (q2.body.total_matches || 0) + '\n');
  if (q2.body.results && q2.body.results.length > 0) {
    process.stdout.write('   Top snippet: ' + (q2.body.results[0].content || '').substring(0, 120) + '\n');
  }

  // Test 3: Semantic search
  process.stdout.write('\nTEST 3: Semantic search - workplace pressure\n');
  var q3 = await request('POST', '/api/query', { client_id: clientUserId, query: 'workplace pressure and coping' }, token);
  process.stdout.write('   Status: ' + q3.status + '\n');
  process.stdout.write('   Matches: ' + (q3.body.total_matches || 0) + '\n');
  if (q3.body.expanded_terms) {
    process.stdout.write('   Expanded terms: ' + q3.body.expanded_terms.join(', ') + '\n');
  }
  if (q3.body.results && q3.body.results.length > 0) {
    process.stdout.write('   Top snippet: ' + (q3.body.results[0].content || '').substring(0, 120) + '\n');
  }

  // Test 4: Tier gating
  process.stdout.write('\nTEST 4: Trial therapist gets 403\n');
  var trialEmail = 'nltrial3_' + ts + '@test.com';
  var trialReg = await request('POST', '/api/auth/register', { email: trialEmail, password: 'TestPass123' });
  var trialToken = trialReg.body.token;
  var q4 = await request('POST', '/api/query', { client_id: clientUserId, query: 'anything' }, trialToken);
  process.stdout.write('   Status: ' + q4.status + ' (expected 403)\n');
  process.stdout.write('   Error: ' + (q4.body.error || '') + '\n');

  // Test 5: No auth
  process.stdout.write('\nTEST 5: No auth gets 401\n');
  var q5 = await request('POST', '/api/query', { client_id: clientUserId, query: 'test' });
  process.stdout.write('   Status: ' + q5.status + ' (expected 401)\n');

  // Test 6: Empty query
  process.stdout.write('\nTEST 6: Empty query gets 400\n');
  var q6 = await request('POST', '/api/query', { client_id: clientUserId, query: '' }, token);
  process.stdout.write('   Status: ' + q6.status + ' (expected 400)\n');

  // Summary
  process.stdout.write('\n=== SUMMARY ===\n');
  process.stdout.write('Test 1 (anxiety query): ' + (q1.status === 200 && q1.body.total_matches > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 2 (sleep query): ' + (q2.status === 200 && q2.body.total_matches > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 3 (semantic search): ' + (q3.status === 200 && q3.body.total_matches > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 4 (tier gating): ' + (q4.status === 403 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 5 (no auth): ' + (q5.status === 401 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 6 (empty query): ' + (q6.status === 400 ? 'PASS' : 'FAIL') + '\n');
}

main().catch(function(e) { process.stdout.write('ERR: ' + e.message + '\n'); });
