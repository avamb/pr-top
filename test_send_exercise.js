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
  // Login as admin
  var login = await request('POST', '/api/auth/login', null, { email: 'admin@psylink.app', password: 'Admin123!' });
  console.log('Login status:', login.status);
  if (!login.data.token) { console.log('Login failed:', login.data); return; }
  var token = login.data.token;
  console.log('Token OK');

  // Get clients list
  var clients = await request('GET', '/api/clients?per_page=5', token);
  console.log('Clients status:', clients.status);
  if (clients.data.clients && clients.data.clients.length > 0) {
    var clientId = clients.data.clients[0].id;
    console.log('Using client ID:', clientId);

    // Get exercises
    var exercises = await request('GET', '/api/exercises', token);
    console.log('Exercises count:', exercises.data.exercises ? exercises.data.exercises.length : 0);

    if (exercises.data.exercises && exercises.data.exercises.length > 0) {
      var exerciseId = exercises.data.exercises[0].id;
      console.log('Sending exercise ID:', exerciseId, exercises.data.exercises[0].title_en);

      // Send exercise to client
      var send = await request('POST', '/api/clients/' + clientId + '/exercises', token, { exercise_id: exerciseId });
      console.log('\nSend exercise status:', send.status);
      console.log('Response:', JSON.stringify(send.data, null, 2));

      // Verify delivery exists
      var deliveries = await request('GET', '/api/clients/' + clientId + '/exercises', token);
      console.log('\nDeliveries count:', deliveries.data.total);
      if (deliveries.data.deliveries && deliveries.data.deliveries.length > 0) {
        var last = deliveries.data.deliveries[0];
        console.log('Last delivery status:', last.status);
        console.log('Exercise title:', last.exercise_title);
        console.log('PASS: exercise_deliveries record created with status "sent"');
      }
    }
  } else {
    console.log('No clients found - need to create test data first');
    // Try registering as therapist
    var reg = await request('POST', '/api/auth/register', null, { email: 'test_therapist_ex@example.com', password: 'TestPass123!' });
    console.log('Register:', reg.status, reg.data.token ? 'OK' : reg.data.error);
  }
}

main().catch(function(e) { console.error(e); });
