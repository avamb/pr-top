const http = require('http');

function req(method, path, body, token, csrfToken) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (csrfToken) opts.headers['X-CSRF-Token'] = csrfToken;
    if (path.startsWith('/api/bot/')) opts.headers['X-Bot-API-Key'] = 'dev-bot-api-key';
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function getCsrf() {
  const r = await req('GET', '/api/csrf-token');
  return r.body.csrfToken;
}

async function main() {
  const ts = Date.now();

  const csrf1 = await getCsrf();
  const csrf2 = await getCsrf();

  // Register therapist A
  const regA = await req('POST', '/api/auth/register', {
    email: 'isoA_' + ts + '@test.com',
    password: 'StrongPwd1',
    role: 'therapist'
  }, null, csrf1);
  console.log('Register A:', regA.status);
  const tokenA = regA.body.token;
  const therapistAId = regA.body.user.id;

  // Register therapist B
  const regB = await req('POST', '/api/auth/register', {
    email: 'isoB_' + ts + '@test.com',
    password: 'StrongPwd1',
    role: 'therapist'
  }, null, csrf2);
  console.log('Register B:', regB.status);
  const tokenB = regB.body.token;
  const therapistBId = regB.body.user.id;

  // Get invite codes
  const invA = await req('GET', '/api/invite-code', null, tokenA);
  const invB = await req('GET', '/api/invite-code', null, tokenB);
  const inviteA = invA.body.invite_code;
  const inviteB = invB.body.invite_code;
  console.log('Therapist A id:', therapistAId, 'invite:', inviteA);
  console.log('Therapist B id:', therapistBId, 'invite:', inviteB);

  // Register client X
  const clientX = await req('POST', '/api/bot/register', {
    telegram_id: 'isoX_' + ts,
    first_name: 'ClientX',
    role: 'client'
  });
  console.log('Register clientX:', clientX.status);
  const clientXUserId = clientX.body.user.id;

  // Client X connects to therapist A
  const connectX = await req('POST', '/api/bot/connect', {
    telegram_id: 'isoX_' + ts,
    invite_code: inviteA
  });
  console.log('ClientX connect:', connectX.status, JSON.stringify(connectX.body));

  // Client X gives consent (need therapist_id)
  const consentX = await req('POST', '/api/bot/consent', {
    telegram_id: 'isoX_' + ts,
    therapist_id: therapistAId,
    consent: true
  });
  console.log('ClientX consent:', consentX.status);

  // Register client Y
  const clientY = await req('POST', '/api/bot/register', {
    telegram_id: 'isoY_' + ts,
    first_name: 'ClientY',
    role: 'client'
  });
  console.log('Register clientY:', clientY.status);
  const clientYUserId = clientY.body.user.id;

  // Client Y connects to therapist B
  const connectY = await req('POST', '/api/bot/connect', {
    telegram_id: 'isoY_' + ts,
    invite_code: inviteB
  });
  console.log('ClientY connect:', connectY.status);

  // Client Y gives consent
  const consentY = await req('POST', '/api/bot/consent', {
    telegram_id: 'isoY_' + ts,
    therapist_id: therapistBId,
    consent: true
  });
  console.log('ClientY consent:', consentY.status);

  // Client X submits diary entry
  const diaryX = await req('POST', '/api/bot/diary', {
    telegram_id: 'isoX_' + ts,
    content: 'ISOLATION_A_' + ts
  });
  console.log('ClientX diary:', diaryX.status);

  // Client Y submits diary entry
  const diaryY = await req('POST', '/api/bot/diary', {
    telegram_id: 'isoY_' + ts,
    content: 'ISOLATION_B_' + ts
  });
  console.log('ClientY diary:', diaryY.status);

  console.log('\nclientXUserId:', clientXUserId, 'clientYUserId:', clientYUserId);

  // === ISOLATION TESTS ===
  let passes = 0;
  let total = 0;

  // 1. Therapist A client list - only clientX
  const clientsA = await req('GET', '/api/clients', null, tokenA);
  total++;
  console.log('\n=== TEST 1: Therapist A client list ===');
  const aClientIds = clientsA.body.clients.map(c => c.id);
  const aHasX = aClientIds.includes(clientXUserId);
  const aHasY = aClientIds.includes(clientYUserId);
  console.log('A clients:', aClientIds, 'expects only', clientXUserId);
  console.log('A sees X:', aHasX, '| A sees Y:', aHasY);
  if (aHasX && !aHasY) { passes++; console.log('PASS'); } else { console.log('FAIL'); }

  // 2. Therapist B client list - only clientY
  const clientsB = await req('GET', '/api/clients', null, tokenB);
  total++;
  console.log('\n=== TEST 2: Therapist B client list ===');
  const bClientIds = clientsB.body.clients.map(c => c.id);
  const bHasX = bClientIds.includes(clientXUserId);
  const bHasY = bClientIds.includes(clientYUserId);
  console.log('B clients:', bClientIds, 'expects only', clientYUserId);
  console.log('B sees X:', bHasX, '| B sees Y:', bHasY);
  if (!bHasX && bHasY) { passes++; console.log('PASS'); } else { console.log('FAIL'); }

  // 3. A tries to access B's client detail
  const crossDetail = await req('GET', '/api/clients/' + clientYUserId, null, tokenA);
  total++;
  console.log('\n=== TEST 3: A -> B client detail ===');
  console.log('Status:', crossDetail.status);
  if (crossDetail.status === 403 || crossDetail.status === 404) { passes++; console.log('PASS'); } else { console.log('FAIL'); }

  // 4. A tries to access B's client diary
  const crossDiary = await req('GET', '/api/clients/' + clientYUserId + '/diary', null, tokenA);
  total++;
  console.log('\n=== TEST 4: A -> B client diary ===');
  console.log('Status:', crossDiary.status);
  if (crossDiary.status === 403 || crossDiary.status === 404) { passes++; console.log('PASS'); } else { console.log('FAIL'); }

  // 5. A tries to access B's client notes
  const crossNotes = await req('GET', '/api/clients/' + clientYUserId + '/notes', null, tokenA);
  total++;
  console.log('\n=== TEST 5: A -> B client notes ===');
  console.log('Status:', crossNotes.status);
  if (crossNotes.status === 403 || crossNotes.status === 404) { passes++; console.log('PASS'); } else { console.log('FAIL'); }

  // 6. A tries to access B's client timeline
  const crossTimeline = await req('GET', '/api/clients/' + clientYUserId + '/timeline', null, tokenA);
  total++;
  console.log('\n=== TEST 6: A -> B client timeline ===');
  console.log('Status:', crossTimeline.status);
  if (crossTimeline.status === 403 || crossTimeline.status === 404) { passes++; console.log('PASS'); } else { console.log('FAIL'); }

  // 7. B tries to access A's client
  const crossDetailB = await req('GET', '/api/clients/' + clientXUserId, null, tokenB);
  total++;
  console.log('\n=== TEST 7: B -> A client detail ===');
  console.log('Status:', crossDetailB.status);
  if (crossDetailB.status === 403 || crossDetailB.status === 404) { passes++; console.log('PASS'); } else { console.log('FAIL'); }

  console.log('\n=== SUMMARY: ' + passes + '/' + total + ' tests passed ===');
  if (passes === total) {
    console.log('ALL ISOLATION TESTS PASS');
  } else {
    console.log('SOME TESTS FAILED');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
