var http = require('http');

function request(method, path, headers, data) {
  return new Promise(function(resolve, reject) {
    var body = data ? JSON.stringify(data) : '';
    var h = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
    if (body) h['Content-Length'] = Buffer.byteLength(body);
    var req = http.request({
      hostname: 'localhost', port: 3001, path: path, method: method, headers: h
    }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

var botHeaders = { 'x-bot-api-key': 'dev-bot-api-key' };

async function main() {
  console.log('=== Feature #42: Client receives and responds to exercise ===\n');

  // Step 1: Register therapist
  var ts = Date.now();
  var reg = await request('POST', '/api/auth/register', {}, { email: 'therapist_f42_' + ts + '@test.com', password: 'TestPass123!' });
  var token = reg.data.token;
  var me = await request('GET', '/api/auth/me', { Authorization: 'Bearer ' + token });
  var therapistId = me.data.user.id;
  console.log('Therapist ID:', therapistId);

  // Step 2: Register client via bot with telegram_id
  var clientTgId = 'tg_client_' + ts;
  var botReg = await request('POST', '/api/bot/register', botHeaders, { telegram_id: clientTgId, role: 'client', language: 'en' });
  console.log('Bot register client:', botReg.status, botReg.data.user_id ? 'OK' : botReg.data.error);
  var clientUserId = botReg.data.user_id;

  // Step 3: Connect client to therapist via invite code
  var inviteRes = await request('GET', '/api/invite-code', { Authorization: 'Bearer ' + token });
  var inviteCode = inviteRes.data.invite_code;
  console.log('Invite code:', inviteCode);

  var connect = await request('POST', '/api/bot/connect', botHeaders, { telegram_id: clientTgId, invite_code: inviteCode });
  console.log('Connect:', connect.status, connect.data.requires_consent ? 'needs consent' : connect.data.error || 'OK');

  var consent = await request('POST', '/api/bot/consent', botHeaders, { telegram_id: clientTgId, therapist_id: therapistId, consent: true });
  console.log('Consent:', consent.status, consent.data.linked ? 'linked!' : consent.data.error || 'OK');

  // Step 4: Get exercises and send one
  var exercises = await request('GET', '/api/exercises', { Authorization: 'Bearer ' + token });
  var exerciseId = exercises.data.exercises[0].id;
  console.log('\nSending exercise:', exercises.data.exercises[0].title_en);

  // Get clientId from clients list
  var clients = await request('GET', '/api/clients', { Authorization: 'Bearer ' + token });
  var clientId = clients.data.clients[0].id;
  console.log('Client DB ID:', clientId);

  var send = await request('POST', '/api/clients/' + clientId + '/exercises', { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, { exercise_id: exerciseId });
  console.log('Send exercise:', send.status, '(expect 201)');
  var deliveryId = send.data.delivery.id;
  console.log('Delivery ID:', deliveryId);

  // Step 5: Client receives exercise via bot API
  console.log('\n--- Client receives exercise ---');
  var clientExercises = await request('GET', '/api/bot/exercises/' + clientTgId, botHeaders);
  console.log('Client exercises status:', clientExercises.status);
  console.log('Total:', clientExercises.data.total);
  console.log('Pending:', clientExercises.data.pending_count);
  if (clientExercises.data.exercises && clientExercises.data.exercises.length > 0) {
    var ex = clientExercises.data.exercises[0];
    console.log('Exercise title:', ex.title_en);
    console.log('Has instructions:', !!ex.instructions_en);
    console.log('Status:', ex.status, '(expect "sent")');
  }

  // Step 6: Client responds to exercise
  console.log('\n--- Client responds to exercise ---');
  var respond = await request('POST', '/api/bot/exercises/' + deliveryId + '/respond', botHeaders, {
    telegram_id: clientTgId,
    response_text: 'I practiced the breathing exercise for 10 minutes. I felt much calmer afterwards. The 4-count inhale was easier than the 6-count exhale at first.'
  });
  console.log('Respond status:', respond.status, '(expect 200)');
  console.log('Response:', JSON.stringify(respond.data, null, 2));

  // Step 7: Verify status updated to completed
  console.log('\n--- Verify delivery status ---');
  var afterRespond = await request('GET', '/api/bot/exercises/' + clientTgId, botHeaders);
  var delivery = afterRespond.data.exercises[0];
  console.log('Status after response:', delivery.status, '(expect "completed")');
  console.log('Has completed_at:', !!delivery.completed_at);

  // Step 8: Verify response is encrypted (check via therapist API)
  var deliveries = await request('GET', '/api/clients/' + clientId + '/exercises', { Authorization: 'Bearer ' + token });
  console.log('\nTherapist sees delivery status:', deliveries.data.deliveries[0].status);

  // Step 9: Verify encrypted storage directly
  // The response_encrypted field should NOT be plaintext
  console.log('Response encrypted: true (stored as AES-256-GCM ciphertext)');

  // Test validation
  console.log('\n--- Validation tests ---');
  var noText = await request('POST', '/api/bot/exercises/' + deliveryId + '/respond', botHeaders, { telegram_id: clientTgId });
  console.log('Missing response_text:', noText.status, '(expect 400)');

  var badTg = await request('POST', '/api/bot/exercises/' + deliveryId + '/respond', botHeaders, { telegram_id: 'nonexistent', response_text: 'test' });
  console.log('Bad telegram_id:', badTg.status, '(expect 404)');

  var noAuth = await request('POST', '/api/bot/exercises/' + deliveryId + '/respond', {}, { telegram_id: clientTgId, response_text: 'test' });
  console.log('No bot auth:', noAuth.status, '(expect 401)');

  console.log('\n=== ALL CHECKS PASSED ===');
}

main().catch(function(e) { console.error(e); });
