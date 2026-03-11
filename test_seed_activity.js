const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'POST', headers
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Login as therapist
  const login = await post('/api/auth/login', { email: 'therapist_test62@test.com', password: 'Test1234' });
  const token = login.token;
  console.log('Logged in');

  // Get client IDs
  const clientsRes = await get('/api/clients', token);
  const clients = clientsRes.clients;
  console.log('Clients:', clients.map(c => c.id));

  // Create a note for client 229 (so it has recent activity)
  const note1 = await post('/api/clients/229/notes', { content: 'TEST_ACTIVITY_NOTE_62 for client 229' }, token);
  console.log('Created note for client 229:', note1.id);

  // Create a note for client 231
  const note2 = await post('/api/clients/231/notes', { content: 'TEST_ACTIVITY_NOTE_62 for client 231' }, token);
  console.log('Created note for client 231:', note2.id);

  // Now fetch clients again and check last_activity
  const clientsRes2 = await get('/api/clients', token);
  for (const c of clientsRes2.clients) {
    console.log(`Client ${c.id} (${c.email}): last_activity=${c.last_activity}`);
  }
}

main().catch(e => console.error(e));
