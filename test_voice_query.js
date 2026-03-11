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
  var bk = 'dev-bot-api-key';

  process.stdout.write('=== Setup ===\n');

  // Register web therapist with Pro subscription
  var email = 'vqweb_' + ts + '@test.com';
  var reg = await request('POST', '/api/auth/register', { email: email, password: 'TestPass123' });
  process.stdout.write('Register: ' + reg.status + '\n');
  var token = reg.body.token;
  var webTherapistId = reg.body.user ? reg.body.user.id : undefined;

  var upgrade = await request('POST', '/api/subscription/change-plan', { plan: 'pro' }, token);
  process.stdout.write('Upgrade: ' + upgrade.status + '\n');

  // Create and link client
  var clientTgId = 'vqcl_' + ts;
  var cReg = await request('POST', '/api/bot/register', { telegram_id: clientTgId, role: 'client' }, null, bk);
  process.stdout.write('Client: ' + cReg.status + '\n');
  var clientId = cReg.body.user ? cReg.body.user.id : undefined;

  var inv = await request('GET', '/api/invite-code', null, token);
  await request('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inv.body.invite_code }, null, bk);
  var cons = await request('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: webTherapistId, consent: true }, null, bk);
  process.stdout.write('Consent: ' + cons.status + '\n');

  // Diary entries
  var entries = [
    'I have been feeling very stressed about work. My boss keeps piling on tasks.',
    'Today was good. Mindfulness meditation really helped me feel calmer.',
    'Terrible nightmare about failing. Woke up sweating, could not sleep again.'
  ];
  for (var i = 0; i < entries.length; i++) {
    await request('POST', '/api/bot/diary', { telegram_id: clientTgId, content: entries[i], entry_type: 'text' }, null, bk);
  }
  process.stdout.write('Created 3 diary entries\n');

  // Bot therapist without subscription (for tier gating)
  var botTgId = 'vqbot_' + ts;
  await request('POST', '/api/bot/register', { telegram_id: botTgId, role: 'therapist' }, null, bk);
  process.stdout.write('Bot therapist registered (no sub)\n');

  process.stdout.write('\n=== Tests ===\n\n');

  // TEST 1: Voice-transcribed text query works via /api/query (Pro therapist)
  process.stdout.write('TEST 1: Voice text NL query about stress\n');
  var q1 = await request('POST', '/api/query', {
    client_id: clientId, query: 'Tell me about client stress at work'
  }, token);
  process.stdout.write('   Status: ' + q1.status + '\n');
  process.stdout.write('   Matches: ' + (q1.body.total_matches || 0) + '\n');
  if (q1.body.results && q1.body.results.length > 0) {
    process.stdout.write('   Top: ' + (q1.body.results[0].content || '').substring(0, 100) + '\n');
  }

  // TEST 2: Bot voice-query tier gating (no sub = 403)
  process.stdout.write('\nTEST 2: Tier gating (no sub = 403)\n');
  var v2 = await request('POST', '/api/bot/voice-query', {
    telegram_id: botTgId, client_id: clientId, voice_text: 'test'
  }, null, bk);
  process.stdout.write('   Status: ' + v2.status + ' (expect 403)\n');
  process.stdout.write('   Error: ' + (v2.body.error || '') + '\n');

  // TEST 3: Missing voice data (400)
  process.stdout.write('\nTEST 3: Missing voice data (400)\n');
  var v3 = await request('POST', '/api/bot/voice-query', {
    telegram_id: botTgId, client_id: clientId
  }, null, bk);
  process.stdout.write('   Status: ' + v3.status + ' (expect 400)\n');

  // TEST 4: No bot auth (401)
  process.stdout.write('\nTEST 4: No bot auth (401)\n');
  var v4 = await request('POST', '/api/bot/voice-query', {
    telegram_id: botTgId, client_id: clientId, voice_text: 'test'
  });
  process.stdout.write('   Status: ' + v4.status + ' (expect 401)\n');

  // TEST 5: Missing telegram_id (400)
  process.stdout.write('\nTEST 5: Missing telegram_id (400)\n');
  var v5 = await request('POST', '/api/bot/voice-query', {
    client_id: clientId, voice_text: 'test'
  }, null, bk);
  process.stdout.write('   Status: ' + v5.status + ' (expect 400)\n');

  // TEST 6: Semantic match - nightmare/sleep
  process.stdout.write('\nTEST 6: Semantic sleep/nightmare query\n');
  var q6 = await request('POST', '/api/query', {
    client_id: clientId, query: 'Does the client have sleep problems or nightmares'
  }, token);
  process.stdout.write('   Status: ' + q6.status + '\n');
  process.stdout.write('   Matches: ' + (q6.body.total_matches || 0) + '\n');
  if (q6.body.results && q6.body.results.length > 0) {
    process.stdout.write('   Top: ' + (q6.body.results[0].content || '').substring(0, 100) + '\n');
  }

  // Summary
  process.stdout.write('\n=== SUMMARY ===\n');
  process.stdout.write('Test 1 (voice text query): ' + (q1.status === 200 && q1.body.total_matches > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 2 (tier gating): ' + (v2.status === 403 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 3 (missing voice): ' + (v3.status === 400 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 4 (no auth): ' + (v4.status === 401 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 5 (missing tg_id): ' + (v5.status === 400 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Test 6 (semantic query): ' + (q6.status === 200 && q6.body.total_matches > 0 ? 'PASS' : 'FAIL') + '\n');
}

main().catch(function(e) { process.stdout.write('ERR: ' + e.message + '\n'); });
