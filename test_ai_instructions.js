var http = require('http');

function fetch(url, opts) {
  opts = opts || {};
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
    };
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function json(r) { return JSON.parse(r.body); }

var BASE = 'http://localhost:3001/api';
var BOT_HEADERS = { 'x-bot-api-key': 'dev-bot-api-key' };
var token, clientId, telegramId, therapistDbId;

telegramId = 'AI_INST_' + Date.now();

fetch(BASE + '/auth/register', { method: 'POST', body: JSON.stringify({ email: 'ai_inst_' + Date.now() + '@test.com', password: 'Test1234!', name: 'AI Inst Therapist' }) })
.then(function(r) {
  var d = json(r);
  console.log('1. Register therapist:', r.status, d.user.id);
  token = d.token;
  therapistDbId = d.user.id;
  return fetch(BASE + '/bot/register', { method: 'POST', body: JSON.stringify({ telegram_id: telegramId, role: 'client', display_name: 'AI Inst Client' }), headers: BOT_HEADERS });
})
.then(function(r) {
  var d = json(r);
  console.log('2. Register client:', r.status, d.user.id);
  return fetch(BASE + '/invite-code', { headers: { Authorization: 'Bearer ' + token } });
})
.then(function(r) {
  var d = json(r);
  console.log('3. Invite code:', d.invite_code);
  return fetch(BASE + '/bot/connect', { method: 'POST', body: JSON.stringify({ telegram_id: telegramId, invite_code: d.invite_code }), headers: BOT_HEADERS });
})
.then(function(r) {
  var d = json(r);
  console.log('4. Connect:', r.status, JSON.stringify(d).substring(0, 100));
  // Consent needs therapist_id
  return fetch(BASE + '/bot/consent', { method: 'POST', body: JSON.stringify({ telegram_id: telegramId, therapist_id: therapistDbId, accept: true }), headers: BOT_HEADERS });
})
.then(function(r) {
  var d = json(r);
  console.log('5. Consent:', r.status, d.message);
  return fetch(BASE + '/clients', { headers: { Authorization: 'Bearer ' + token } });
})
.then(function(r) {
  var d = json(r);
  var client = d.clients.find(function(c) { return c.telegram_id === telegramId; });
  clientId = client && client.id;
  console.log('6. Client ID:', clientId);
  return fetch(BASE + '/clients/' + clientId + '/context', {
    method: 'PUT',
    body: JSON.stringify({
      ai_instructions: 'Focus on CBT techniques. Avoid discussing family trauma directly. Use solution-focused language.',
      contraindications: 'Do not recommend medication. Avoid exposure therapy for this client.',
      anamnesis: 'Client has history of anxiety and mild depression.',
      current_goals: 'Reduce anxiety episodes, improve sleep quality.'
    }),
    headers: { Authorization: 'Bearer ' + token }
  });
})
.then(function(r) {
  var d = json(r);
  console.log('7. Set context:', r.status);
  console.log('   AI instructions stored:', d.context && d.context.ai_instructions ? 'YES' : 'NO');
  console.log('   Contraindications stored:', d.context && d.context.contraindications ? 'YES' : 'NO');
  return fetch(BASE + '/clients/' + clientId + '/context', { headers: { Authorization: 'Bearer ' + token } });
})
.then(function(r) {
  var d = json(r);
  console.log('8. Read context back:', r.status);
  var aiMatch = d.context && d.context.ai_instructions === 'Focus on CBT techniques. Avoid discussing family trauma directly. Use solution-focused language.';
  var contraMatch = d.context && d.context.contraindications === 'Do not recommend medication. Avoid exposure therapy for this client.';
  console.log('   AI instructions match:', aiMatch ? 'PASS' : 'FAIL');
  console.log('   Contraindications match:', contraMatch ? 'PASS' : 'FAIL');

  // Step 9: Test that summarization service incorporates AI instructions
  // We can test generateDevSummary directly via the module
  var summarization = require('./src/backend/src/services/summarization');
  var testTranscript = 'Client discussed anxiety about work deadlines. Breathing exercises helped with sleep.';
  var testOptions = {
    ai_instructions: 'Focus on CBT techniques. Avoid family trauma.',
    contraindications: 'Do not recommend medication.',
    goals: 'Reduce anxiety, improve sleep.'
  };
  var summary = summarization.generateSummary(testTranscript, testOptions);
  // generateSummary might return a promise
  return Promise.resolve(summary);
})
.then(function(summary) {
  console.log('\n9. Summary generation test:');
  var hasAiInstructions = summary.indexOf('AI Instructions Applied') !== -1;
  var hasContraindications = summary.indexOf('Contraindications Noted') !== -1;
  var hasCBT = summary.indexOf('CBT') !== -1;
  var hasMedication = summary.indexOf('medication') !== -1;
  console.log('   Contains AI Instructions section:', hasAiInstructions ? 'PASS' : 'FAIL');
  console.log('   Contains Contraindications section:', hasContraindications ? 'PASS' : 'FAIL');
  console.log('   Contains CBT reference:', hasCBT ? 'PASS' : 'FAIL');
  console.log('   Contains medication contraindication:', hasMedication ? 'PASS' : 'FAIL');

  if (hasAiInstructions && hasContraindications && hasCBT && hasMedication) {
    console.log('\n=== ALL FEATURE #47 TESTS PASSED ===');
  } else {
    console.log('\n=== SOME TESTS FAILED ===');
    console.log('Summary output:\n' + summary);
  }
})
.catch(function(e) { console.error('ERROR:', e.message, e.stack); });
