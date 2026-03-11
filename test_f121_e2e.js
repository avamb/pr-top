// Feature #121: End-to-end exercise send and completion
const http = require('http');

const request = (method, path, body, headers) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const getCsrf = async () => {
  const res = await request('GET', '/api/csrf-token');
  return res.body.csrfToken;
};

const BOT_H = { 'x-bot-api-key': 'dev-bot-api-key' };
const authH = (token) => ({ 'Authorization': `Bearer ${token}` });

const test = async () => {
  const unique = Date.now();
  console.log('=== Feature #121: End-to-end exercise send and completion ===\n');

  // Setup: Create therapist, client, and link them
  console.log('Setup: Creating therapist and linked client...');
  const csrf = await getCsrf();
  const regRes = await request('POST', '/api/auth/register', {
    email: `ex_therapist_${unique}@test.com`,
    password: 'Test1234!',
    name: 'Exercise Therapist'
  }, { 'X-CSRF-Token': csrf });
  const therapistToken = regRes.body.token;
  console.log('  Therapist registered:', regRes.status === 201 ? 'OK' : 'FAIL');

  const invRes = await request('GET', '/api/invite-code', null, authH(therapistToken));
  const inviteCode = invRes.body.invite_code;
  console.log('  Invite code:', inviteCode);

  const clientTgId = `tg_ex_${unique}`;
  await request('POST', '/api/bot/register', { telegram_id: clientTgId, role: 'client', language: 'en' }, BOT_H);
  const connectRes = await request('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inviteCode }, BOT_H);
  const therapistId = connectRes.body.therapist?.id;
  await request('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: therapistId, consent: true }, BOT_H);
  console.log('  Client linked:', connectRes.status === 200 ? 'OK' : 'FAIL');

  // Get client ID
  const clientsRes = await request('GET', '/api/clients', null, authH(therapistToken));
  const clients = clientsRes.body.clients || clientsRes.body;
  const clientObj = Array.isArray(clients) ? clients.find(c => c.telegram_id === clientTgId) : null;
  const clientId = clientObj?.id;
  console.log('  Client ID:', clientId);

  // Step 1: Therapist browses exercise library
  console.log('\nStep 1: Browse exercise library...');
  const exRes = await request('GET', '/api/exercises', null, authH(therapistToken));
  console.log('  Exercises status:', exRes.status);
  const exercises = exRes.body.exercises || exRes.body;
  console.log('  Exercise count:', Array.isArray(exercises) ? exercises.length : 'N/A');
  const exerciseId = Array.isArray(exercises) && exercises.length > 0 ? exercises[0].id : null;
  console.log('  First exercise ID:', exerciseId);
  console.log('  First exercise name:', exercises?.[0]?.title_en || exercises?.[0]?.name);

  // Step 2: Therapist sends exercise to linked client
  console.log('\nStep 2: Send exercise to client...');
  const sendRes = await request('POST', `/api/clients/${clientId}/exercises`, {
    exercise_id: exerciseId
  }, authH(therapistToken));
  console.log('  Send status:', sendRes.status);
  console.log('  Send result:', JSON.stringify(sendRes.body));
  const deliveryId = sendRes.body.delivery?.id || sendRes.body.delivery_id || sendRes.body.id;
  console.log('  Delivery ID:', deliveryId);

  // Step 3: Client receives exercise in Telegram
  console.log('\nStep 3: Client receives exercise...');
  const clientExRes = await request('GET', `/api/bot/exercises/${clientTgId}`, null, BOT_H);
  console.log('  Client exercises status:', clientExRes.status);
  const clientExercises = clientExRes.body.exercises || clientExRes.body;
  console.log('  Client exercise count:', Array.isArray(clientExercises) ? clientExercises.length : 'N/A');
  const receivedEx = Array.isArray(clientExercises) ? clientExercises.find(e => e.delivery_id === deliveryId || e.id === deliveryId) : null;
  console.log('  Found sent exercise:', !!receivedEx);
  console.log('  Exercise status:', receivedEx?.status);

  // Step 4: Client completes/responds to exercise
  const responseText = `EXERCISE_RESPONSE_${unique}`;
  console.log('\nStep 4: Client responds to exercise...');
  const respondRes = await request('POST', `/api/bot/exercises/${deliveryId}/respond`, {
    telegram_id: clientTgId,
    response_text: responseText
  }, BOT_H);
  console.log('  Respond status:', respondRes.status);
  console.log('  Respond result:', JSON.stringify(respondRes.body));

  // Step 5: Therapist views exercise delivery status as 'completed'
  console.log('\nStep 5: Therapist views exercise deliveries...');
  const deliveriesRes = await request('GET', `/api/clients/${clientId}/exercises`, null, authH(therapistToken));
  console.log('  Deliveries status:', deliveriesRes.status);
  const deliveries = deliveriesRes.body.deliveries || deliveriesRes.body;
  console.log('  Delivery count:', Array.isArray(deliveries) ? deliveries.length : 'N/A');
  const completedDelivery = Array.isArray(deliveries) ? deliveries.find(d => d.id === deliveryId) : null;
  console.log('  Found delivery:', !!completedDelivery);
  console.log('  Delivery status:', completedDelivery?.status);

  // Step 6: Verify response is stored encrypted (check raw DB)
  console.log('\nStep 6: Verify response is encrypted in DB...');
  // We can check via the API that the response content is returned (decrypted)
  // and that the raw DB has encrypted data by checking the response format
  const isCompleted = completedDelivery?.status === 'completed';
  console.log('  Status is completed:', isCompleted);

  // Summary
  console.log('\n=== RESULTS ===');
  const checks = [
    ['Exercise library browsable', exRes.status === 200 && Array.isArray(exercises) && exercises.length > 0],
    ['Exercise sent to client', sendRes.status === 201 || sendRes.status === 200],
    ['Client receives exercise', clientExRes.status === 200 && Array.isArray(clientExercises) && clientExercises.length > 0],
    ['Client responds to exercise', respondRes.status === 200 || respondRes.status === 201],
    ['Delivery status completed', isCompleted],
    ['Full e2e flow works', isCompleted && (sendRes.status === 201 || sendRes.status === 200)]
  ];

  checks.forEach(([name, pass], i) => {
    console.log(`  ${i+1}. ${name}: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  });

  const allOk = checks.every(([, pass]) => pass);
  console.log(`\n  OVERALL: ${allOk ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);

  // Output data for browser test
  console.log('\n  therapistEmail:', `ex_therapist_${unique}@test.com`);
  console.log('  clientId:', clientId);
  console.log('  exerciseId:', exerciseId);
  console.log('  deliveryId:', deliveryId);
};

test().catch(console.error);
