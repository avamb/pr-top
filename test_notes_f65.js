const http = require('http');

let csrfToken = null;
let cookies = '';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const BOT_KEY = 'dev-bot-api-key';

function fetch(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path, method,
      headers: { 'Content-Type': 'application/json', 'Connection': 'close' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (path.startsWith('/api/bot/')) opts.headers['x-bot-api-key'] = BOT_KEY;
    if (csrfToken) opts.headers['x-csrf-token'] = csrfToken;
    if (cookies) opts.headers['Cookie'] = cookies;
    const req = http.request(opts, res => {
      let data = '';
      const sc = res.headers['set-cookie'];
      if (sc) { cookies = sc.map(c => c.split(';')[0]).join('; '); }
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); }
        catch(e) { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Get CSRF
  let r = await fetch('GET', '/api/csrf-token');
  csrfToken = r.body.csrfToken || r.body.token;
  console.log('CSRF obtained');
  await delay(200);

  // Create fresh therapist
  const ts = Date.now();
  const email = 'tn65_' + ts + '@test.com';
  r = await fetch('POST', '/api/auth/register', { email, password: 'Test123!', role: 'therapist' });
  console.log('Register therapist:', r.status);
  const therapistToken = r.body.token;
  await delay(200);

  // Create client via bot API
  r = await fetch('POST', '/api/bot/register', { telegram_id: 'tgn65_' + ts, role: 'client', name: 'NotesClient65' });
  console.log('Register client:', r.status);
  await delay(200);

  // Get invite code
  r = await fetch('GET', '/api/invite-code', null, therapistToken);
  const code = r.body.invite_code;
  console.log('Invite code:', code);
  await delay(200);

  // Connect client
  r = await fetch('POST', '/api/bot/connect', { telegram_id: 'tgn65_' + ts, invite_code: code });
  console.log('Connect:', r.status, JSON.stringify(r.body).substring(0, 100));
  const therapistId = r.body.therapist_id || r.body.therapist?.id;
  await delay(200);

  // Consent
  r = await fetch('POST', '/api/bot/consent', { telegram_id: 'tgn65_' + ts, therapist_id: therapistId, consent: true });
  console.log('Consent:', r.status, JSON.stringify(r.body).substring(0, 100));
  await delay(200);

  // Get client ID
  r = await fetch('GET', '/api/clients', null, therapistToken);
  console.log('Clients:', r.status, 'count:', (r.body.clients || []).length);
  if (!r.body.clients || r.body.clients.length === 0) {
    console.log('No clients! Body:', JSON.stringify(r.body).substring(0, 300));
    process.exit(1);
  }
  const clientId = r.body.clients[0].id;
  console.log('Client ID:', clientId);
  await delay(200);

  // Create notes
  r = await fetch('POST', '/api/clients/' + clientId + '/notes', { content: 'NOTES_F65_UNIQUE_TEST_12345 initial assessment' }, therapistToken);
  console.log('Create note 1:', r.status);
  await delay(200);

  r = await fetch('POST', '/api/clients/' + clientId + '/notes', { content: 'Patient reported anxiety during morning routine, recommended breathing' }, therapistToken);
  console.log('Create note 2:', r.status);
  await delay(200);

  r = await fetch('POST', '/api/clients/' + clientId + '/notes', { content: 'Follow-up session went well, good progress on CBT exercises' }, therapistToken);
  console.log('Create note 3:', r.status);
  await delay(200);

  // Fetch notes
  r = await fetch('GET', '/api/clients/' + clientId + '/notes', null, therapistToken);
  console.log('Fetch notes:', r.status, 'total:', r.body.total);
  const notes = r.body.notes || [];
  const foundNote = notes.some(n => n.content && n.content.includes('NOTES_F65_UNIQUE_TEST_12345'));
  await delay(200);

  // Search by keyword
  r = await fetch('GET', '/api/clients/' + clientId + '/notes?search=anxiety', null, therapistToken);
  console.log('Search "anxiety":', r.status, 'results:', r.body.total);
  const anxietyFound = (r.body.notes || []).some(n => n.content && n.content.includes('anxiety'));
  await delay(200);

  // Search specific keyword
  r = await fetch('GET', '/api/clients/' + clientId + '/notes?search=NOTES_F65_UNIQUE', null, therapistToken);
  console.log('Search unique keyword:', r.status, 'results:', r.body.total);
  const uniqueFound = r.body.total >= 1;
  await delay(200);

  // Non-matching search
  r = await fetch('GET', '/api/clients/' + clientId + '/notes?search=XYZNONEXISTENT999', null, therapistToken);
  console.log('Non-matching search:', r.status, 'results:', r.body.total);
  const noResults = r.body.total === 0;

  // Verification
  console.log('\n=== VERIFICATION ===');
  const checks = [foundNote, notes.length >= 3, anxietyFound, uniqueFound, noResults];
  const labels = ['Note in list', 'Multiple notes', 'Keyword search works', 'Unique search works', 'Non-match returns 0'];
  checks.forEach((c, i) => console.log('CHECK', i+1, '-', labels[i] + ':', c ? 'PASS' : 'FAIL'));
  const all = checks.every(c => c);
  console.log('\n' + (all ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
  console.log('Therapist email:', email, '| Client ID:', clientId);
  process.exit(all ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
