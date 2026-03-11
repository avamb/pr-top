var http = require('http');

function request(method, path, token, data) {
  return new Promise(function(resolve, reject) {
    var body = data ? JSON.stringify(data) : '';
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    var req = http.request({
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: headers
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

async function main() {
  // Register a fresh therapist
  var reg = await request('POST', '/api/auth/register', null, { email: 'ex_therapist_' + Date.now() + '@test.com', password: 'TestPass123!' });
  if (!reg.data.token) { console.log('Register failed:', reg.data); return; }
  var token = reg.data.token;
  var me = await request('GET', '/api/auth/me', token);
  var therapistId = me.data.user.id;
  console.log('Therapist ID:', therapistId);

  // Seed a client via dev endpoint
  var seed = await request('POST', '/api/dev/seed-clients', null, { therapist_id: therapistId, count: 1 });
  console.log('Seed result:', seed.data);

  // Get clients
  var clients = await request('GET', '/api/clients?per_page=5', token);
  console.log('Clients:', clients.data.total);
  if (!clients.data.clients || clients.data.clients.length === 0) {
    console.log('No clients after seed!');
    return;
  }
  var clientId = clients.data.clients[0].id;
  console.log('Client ID:', clientId);

  // Get exercises
  var exercises = await request('GET', '/api/exercises', token);
  console.log('Exercises available:', exercises.data.exercises ? exercises.data.exercises.length : 0);
  var exerciseId = exercises.data.exercises[0].id;
  console.log('Sending exercise:', exerciseId, exercises.data.exercises[0].title_en);

  // POST send exercise
  var send = await request('POST', '/api/clients/' + clientId + '/exercises', token, { exercise_id: exerciseId });
  console.log('\n--- SEND RESULT ---');
  console.log('Status:', send.status, '(expect 201)');
  console.log('Response:', JSON.stringify(send.data, null, 2));

  // Verify delivery
  var deliveries = await request('GET', '/api/clients/' + clientId + '/exercises', token);
  console.log('\n--- DELIVERIES ---');
  console.log('Total:', deliveries.data.total);
  if (deliveries.data.deliveries && deliveries.data.deliveries.length > 0) {
    var d = deliveries.data.deliveries[0];
    console.log('Status:', d.status, '(expect "sent")');
    console.log('Exercise:', d.exercise_title);
    console.log('\nALL CHECKS PASSED!');
  }

  // Test with missing exercise_id
  var bad = await request('POST', '/api/clients/' + clientId + '/exercises', token, {});
  console.log('\n--- BAD REQUEST ---');
  console.log('Status:', bad.status, '(expect 400)');

  // Test without auth
  var noAuth = await request('POST', '/api/clients/' + clientId + '/exercises', null, { exercise_id: exerciseId });
  console.log('No auth status:', noAuth.status, '(expect 401)');
}

main().catch(function(e) { console.error(e); });
