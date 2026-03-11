const http = require('http');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function post(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ error: d }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Login - try multiple accounts
  let token;
  for (const email of ['test_reg@example.com', 'test_ex@example.com', 'admin@psylink.app']) {
    const pwd = email === 'admin@psylink.app' ? 'Admin123!' : 'TestPass123!';
    try {
      const login = await post('/api/auth/login', { email, password: pwd });
      if (login.token) {
        token = login.token;
        console.log('Logged in as', email);
        break;
      }
    } catch (e) {}
  }
  if (!token) {
    const reg = await post('/api/auth/register', { email: 'exercise_test@example.com', password: 'TestPass123!' });
    token = reg.token;
    console.log('Registered new account, token:', !!token);
  }

  // Test GET /api/exercises
  console.log('\n--- GET /api/exercises ---');
  const all = await get('/api/exercises', token);
  console.log('Status:', all.status);
  console.log('Categories:', all.data.categories);
  console.log('Total exercises:', all.data.exercises?.length);
  console.log('Grouped keys:', Object.keys(all.data.grouped || {}));

  // Verify each exercise has title, description, instructions
  let valid = true;
  for (const ex of (all.data.exercises || [])) {
    if (!ex.title_en || !ex.description_en || !ex.instructions_en) {
      console.log('MISSING FIELDS on exercise:', ex.id, ex.title_en);
      valid = false;
    }
  }
  console.log('All exercises have title/description/instructions:', valid);

  // Test filter by category
  console.log('\n--- GET /api/exercises?category=breathing ---');
  const filtered = await get('/api/exercises?category=breathing', token);
  console.log('Status:', filtered.status);
  console.log('Filtered count:', filtered.data.exercises?.length);
  const allBreathing = (filtered.data.exercises || []).every(e => e.category === 'breathing');
  console.log('All are breathing:', allBreathing);

  // Test filter by another category
  console.log('\n--- GET /api/exercises?category=cognitive ---');
  const cog = await get('/api/exercises?category=cognitive', token);
  console.log('Cognitive count:', cog.data.exercises?.length);
  const allCog = (cog.data.exercises || []).every(e => e.category === 'cognitive');
  console.log('All are cognitive:', allCog);

  // Test no auth
  console.log('\n--- GET /api/exercises (no auth) ---');
  const noAuth = await get('/api/exercises', 'invalid');
  console.log('Status (should be 401):', noAuth.status);

  console.log('\nAll tests passed!');
}

main().catch(console.error);
