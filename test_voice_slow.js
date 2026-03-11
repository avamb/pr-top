// Slow test with delays between requests to avoid DB contention
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

function delay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  var bk = 'dev-bot-api-key';
  var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwOCwiZW1haWwiOiJ2b2ljZXRlc3QxQHRlc3QuY29tIiwicm9sZSI6InRoZXJhcGlzdCIsImlhdCI6MTc3MzI0NTQ3NSwiZXhwIjoxNzczMzMxODc1fQ.SM3B3Xdt_z7LFqBNsnrQmSc-XEruKiA7C1MhyL4PKFA';
  var therapistId = 308;
  var clientTgId = 'vclient1';
  var clientId = 311;

  // Get invite code
  await delay(500);
  var inv = await request('GET', '/api/invite-code', null, token);
  process.stdout.write('Invite: ' + inv.status + ' code=' + (inv.body.invite_code || '') + '\n');

  // Connect
  await delay(500);
  var conn = await request('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inv.body.invite_code }, null, bk);
  process.stdout.write('Connect: ' + conn.status + ' ' + (conn.body.message || '') + '\n');

  // Consent
  await delay(500);
  var cons = await request('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: therapistId, consent: true }, null, bk);
  process.stdout.write('Consent: ' + cons.status + ' ' + (cons.body.message || '') + '\n');

  // Create diary entries with delays
  var entries = [
    'I have been feeling very anxious about work. The stress is overwhelming and I cannot sleep.',
    'Today I practiced the breathing exercises. They helped me feel calmer during a meeting.',
    'Had a nightmare again. Woke up at 3am and could not go back to sleep. Relationship problems.'
  ];
  for (var i = 0; i < entries.length; i++) {
    await delay(500);
    var dr = await request('POST', '/api/bot/diary', { telegram_id: clientTgId, content: entries[i], entry_type: 'text' }, null, bk);
    process.stdout.write('Diary ' + (i+1) + ': ' + dr.status + '\n');
  }

  // Create a note
  await delay(500);
  var n1 = await request('POST', '/api/clients/' + clientId + '/notes', {
    content: 'Client shows signs of generalized anxiety. CBT techniques recommended. Sleep hygiene needs attention.'
  }, token);
  process.stdout.write('Note: ' + n1.status + '\n');

  // Now test NL query (simulating voice-transcribed text)
  process.stdout.write('\n=== NL Query Tests (simulating voice input) ===\n\n');

  await delay(500);
  process.stdout.write('TEST 1: Voice query about anxiety/stress\n');
  var q1 = await request('POST', '/api/query', { client_id: clientId, query: 'How is the client doing with anxiety and stress' }, token);
  process.stdout.write('   Status: ' + q1.status + ' Matches: ' + (q1.body.total_matches || 0) + '\n');
  if (q1.body.results && q1.body.results[0]) {
    process.stdout.write('   Top: ' + (q1.body.results[0].content || '').substring(0, 100) + '\n');
  }

  await delay(500);
  process.stdout.write('\nTEST 2: Voice query about sleep\n');
  var q2 = await request('POST', '/api/query', { client_id: clientId, query: 'Tell me about sleep problems' }, token);
  process.stdout.write('   Status: ' + q2.status + ' Matches: ' + (q2.body.total_matches || 0) + '\n');
  if (q2.body.results && q2.body.results[0]) {
    process.stdout.write('   Top: ' + (q2.body.results[0].content || '').substring(0, 100) + '\n');
  }

  await delay(500);
  process.stdout.write('\nTEST 3: Semantic voice query about coping strategies\n');
  var q3 = await request('POST', '/api/query', { client_id: clientId, query: 'What coping strategies is the client using' }, token);
  process.stdout.write('   Status: ' + q3.status + ' Matches: ' + (q3.body.total_matches || 0) + '\n');
  if (q3.body.results && q3.body.results[0]) {
    process.stdout.write('   Top: ' + (q3.body.results[0].content || '').substring(0, 100) + '\n');
  }

  // Test tier gating with a trial therapist
  await delay(500);
  process.stdout.write('\nTEST 4: Trial therapist gets 403\n');
  var trialReg = await request('POST', '/api/auth/register', { email: 'trialtestv@t.com', password: 'TestPass123' });
  await delay(300);
  var q4 = await request('POST', '/api/query', { client_id: clientId, query: 'test' }, trialReg.body.token);
  process.stdout.write('   Status: ' + q4.status + ' (expect 403) Error: ' + (q4.body.error || '') + '\n');

  // Summary
  process.stdout.write('\n=== SUMMARY ===\n');
  process.stdout.write('T1 (anxiety query): ' + (q1.status === 200 && q1.body.total_matches > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('T2 (sleep query): ' + (q2.status === 200 && q2.body.total_matches > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('T3 (coping semantic): ' + (q3.status === 200 && q3.body.total_matches > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('T4 (tier gating): ' + (q4.status === 403 ? 'PASS' : 'FAIL') + '\n');
}

main().catch(function(e) { process.stdout.write('ERR: ' + e.message + '\n'); });
