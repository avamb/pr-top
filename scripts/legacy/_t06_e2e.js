// T-06 Solo mode e2e against the live backend on port 3001.
// Pattern matches _t20_e2e.js for cookie-jar + CSRF.
//
// Verifies:
//   1. Therapist registers + logs in.
//   2. POST /api/clients/solo with name + note succeeds (201).
//   3. Returned client: mode='solo', telegram_id=null, consent=true.
//   4. GET /api/clients lists the solo client with mode='solo'.
//   5. GET /api/clients/:id returns mode='solo'.
//   6. Validation: empty body -> 400.
//   7. Validation: bad email -> 400.
//   8. Validation: long note -> 400.
//   9. POST /:id/exercises -> 403 (solo can't receive exercises).
//  10. GET /:id/diary -> 200 empty (no entries).
//  11. GET /:id/notes -> 200, contains the encrypted initial note.
//  12. Bot endpoint /api/bot/user/<bogus> -> 404 (solo has no telegram_id).
//
// Cleans up at end via DELETE-style soft cleanup is not exposed, so we just
// note the IDs and the next session can purge them through admin tools.

const API = 'http://localhost:3001/api';
let cookieJar = '';

function captureCookies(headers) {
  const setCookies = headers.getSetCookie ? headers.getSetCookie() : (headers.raw && headers.raw()['set-cookie']) || [];
  for (const c of setCookies) {
    const semi = c.indexOf(';');
    const kv = semi === -1 ? c : c.slice(0, semi);
    const eq = kv.indexOf('=');
    if (eq === -1) continue;
    const name = kv.slice(0, eq);
    const val = kv.slice(eq + 1);
    cookieJar = cookieJar
      .split('; ')
      .filter(piece => piece && !piece.startsWith(name + '='))
      .concat([`${name}=${val}`])
      .join('; ');
  }
}

async function jfetch(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (cookieJar) headers.cookie = cookieJar;
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  captureCookies(res.headers);
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body, headers: res.headers };
}

let passed = 0;
let failed = 0;
function expect(cond, msg) {
  if (cond) {
    passed++;
    console.log('PASS: ' + msg);
  } else {
    failed++;
    console.log('FAIL: ' + msg);
  }
}

(async () => {
  const ts = Date.now();
  const email = `t06_${ts}@test.local`;
  const password = 'TestPassword123!';
  console.log(`Testing with ${email}`);

  // 1. CSRF
  const csrfRes = await jfetch(`${API}/csrf-token`);
  const csrfToken = csrfRes.body && csrfRes.body.csrfToken;
  if (!csrfToken) { console.log('FAIL: no csrfToken'); process.exit(1); }

  // 2. Register
  const reg = await jfetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ email, password, first_name: 'T06', last_name: 'Tester', csrfToken })
  });
  expect(reg.status === 201 || reg.status === 200, `Register: status=${reg.status}`);
  const token = reg.body && reg.body.token;
  const therapistId = reg.body && reg.body.user && reg.body.user.id;
  if (!token) { console.log('FAIL: no token after register, body=' + JSON.stringify(reg.body)); process.exit(1); }
  console.log(`therapistId=${therapistId}`);

  const auth = { 'authorization': `Bearer ${token}`, 'x-csrf-token': csrfToken };

  // 3. Create solo client
  const create = await jfetch(`${API}/clients/solo`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Alice',
      last_name: 'Solo',
      language: 'en',
      note: 'TEST_T06_INTAKE_' + ts + ': paranoid traits, prefers no bot.'
    })
  });
  expect(create.status === 201, `Create solo: status=${create.status} body=${JSON.stringify(create.body)}`);
  const soloClient = create.body && create.body.client;
  expect(!!soloClient, `Solo client returned`);
  expect(soloClient && soloClient.mode === 'solo', `mode=solo (got ${soloClient && soloClient.mode})`);
  expect(soloClient && soloClient.consent_therapist_access === true, `consent auto-granted`);
  expect(soloClient && soloClient.telegram_id === null, `telegram_id=null`);
  expect(soloClient && soloClient.first_name === 'Alice' && soloClient.last_name === 'Solo', `name persisted`);
  const soloId = soloClient && soloClient.id;
  console.log(`soloId=${soloId}`);

  // 4. List clients
  const list = await jfetch(`${API}/clients`, { headers: auth });
  expect(list.status === 200, `List status=${list.status}`);
  const found = (list.body.clients || []).find(c => c.id === soloId);
  expect(!!found, `Solo client appears in list`);
  expect(found && found.mode === 'solo', `List returns mode=solo`);
  expect(found && found.telegram_id === null, `List telegram_id=null`);
  expect(found && found.consent_therapist_access === true, `List consent=true`);

  // 5. Get detail
  const detail = await jfetch(`${API}/clients/${soloId}`, { headers: auth });
  expect(detail.status === 200, `Detail status=${detail.status}`);
  expect(detail.body.client && detail.body.client.mode === 'solo', `Detail mode=solo`);

  // 6. Empty body
  const bad1 = await jfetch(`${API}/clients/solo`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({})
  });
  expect(bad1.status === 400, `Empty body -> 400 (got ${bad1.status})`);

  // 7. Bad email
  const bad2 = await jfetch(`${API}/clients/solo`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'X', email: 'not-an-email' })
  });
  expect(bad2.status === 400, `Bad email -> 400 (got ${bad2.status})`);

  // 8. Long note
  const longNote = 'x'.repeat(2001);
  const bad3 = await jfetch(`${API}/clients/solo`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'X', note: longNote })
  });
  expect(bad3.status === 400, `Long note -> 400 (got ${bad3.status})`);

  // 9. Exercises POST denied for solo
  const exer = await jfetch(`${API}/clients/${soloId}/exercises`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ exercise_id: 1 })
  });
  expect(exer.status === 403, `Exercises POST -> 403 for solo (got ${exer.status})`);
  expect(exer.body && /solo/i.test(exer.body.error || ''), `Exercises 403 message mentions solo`);

  // 10. Diary list works (empty)
  const diary = await jfetch(`${API}/clients/${soloId}/diary`, { headers: auth });
  expect(diary.status === 200, `Diary list status=${diary.status}`);
  expect(Array.isArray(diary.body.entries) && diary.body.entries.length === 0, `Diary is empty`);

  // 11. Notes contains initial note
  const notes = await jfetch(`${API}/clients/${soloId}/notes`, { headers: auth });
  expect(notes.status === 200, `Notes status=${notes.status}`);
  const hasIntake = (notes.body.notes || []).some(n => /TEST_T06_INTAKE_/i.test(n.content || ''));
  expect(hasIntake, `Initial encrypted note saved + decryptable`);

  // 12. Bot user lookup with bogus telegram_id
  const botKey = process.env.BOT_API_KEY || 'dev-bot-api-key';
  const bot404 = await fetch(`${API}/bot/user/0`, {
    headers: { 'x-bot-api-key': botKey }
  });
  expect(bot404.status === 404, `Bot lookup nonexistent telegram_id -> 404 (got ${bot404.status})`);

  // 12b. Sanity: bot lookup with the solo client's id-as-telegram-id ALSO 404s.
  // The solo client has telegram_id=NULL; the bot endpoint queries by
  // telegram_id, so even passing the numeric internal id should miss.
  const bot404b = await fetch(`${API}/bot/user/${soloId}`, {
    headers: { 'x-bot-api-key': botKey }
  });
  expect(bot404b.status === 404, `Bot lookup with soloId-as-telegram_id -> 404 (got ${bot404b.status})`);

  // 13. Verify only ONE solo client created from the empty/bad-validation calls
  // (i.e., bad-input requests must NOT create rows).
  const list2 = await jfetch(`${API}/clients`, { headers: auth });
  const myClients = (list2.body.clients || []);
  const soloOnes = myClients.filter(c => c.mode === 'solo');
  expect(soloOnes.length === 1, `Exactly 1 solo client (got ${soloOnes.length}; bad validations did not leak rows)`);

  console.log('---');
  console.log(`Therapist=${therapistId}, soloClient=${soloId}, passed=${passed}, failed=${failed}`);
  console.log(failed === 0 ? 'ALL T-06 E2E TESTS PASSED' : 'SOME TESTS FAILED');
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('Fatal: ' + e.message); console.error(e.stack); process.exit(2); });
