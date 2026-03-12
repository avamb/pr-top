const http = require('http');

const BOT_KEY = 'dev-bot-api-key';
const TS = Date.now();

function req(method, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({}, extraHeaders || {});
    let data;
    if (body) {
      data = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const r = http.request({ hostname: '127.0.0.1', port: 3001, path: path, method: method, headers: headers }, function(res) {
      let b = '';
      res.on('data', function(c) { b += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0, failed = 0;
function check(name, ok) {
  if (ok) { console.log('  PASS: ' + name); passed++; }
  else { console.log('  FAIL: ' + name); failed++; }
}

async function run() {
  console.log('=== Feature #168: Consent revocation cascades ===\n');

  // Get CSRF token
  const csrf = await req('GET', '/api/csrf-token');
  const csrfToken = csrf.body.csrfToken;
  check('Got CSRF token', !!csrfToken);

  // 1. Register therapist
  const email = 'consent168_' + TS + '@test.com';
  const reg = await req('POST', '/api/auth/register',
    { email: email, password: 'TestPass1', role: 'therapist' },
    { 'X-CSRF-Token': csrfToken });
  check('Register therapist', reg.status === 201);
  const token = reg.body.token;

  // 2. Register client via bot
  const tgId = '168' + TS;
  const botReg = await req('POST', '/api/bot/register',
    { telegram_id: tgId, first_name: 'Client168', role: 'client' },
    { 'x-bot-api-key': BOT_KEY });
  check('Register client', botReg.status === 201 || botReg.status === 200);
  const clientId = botReg.body.user ? botReg.body.user.id : botReg.body.user_id;

  // 3. Get invite code
  const invite = await req('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  const code = invite.body.invite_code;
  check('Got invite code', !!code);

  // 4. Connect client to therapist
  const connect = await req('POST', '/api/bot/connect',
    { telegram_id: tgId, invite_code: code },
    { 'x-bot-api-key': BOT_KEY });
  check('Client connected', connect.status === 200);

  // 5. Accept consent - need therapist_id from registration
  const therapistId = reg.body.user ? reg.body.user.id : reg.body.id;
  console.log('  DEBUG: therapistId=' + therapistId + ' clientId=' + clientId + ' tgId=' + tgId);
  const consent = await req('POST', '/api/bot/consent',
    { telegram_id: tgId, therapist_id: therapistId, consent: true },
    { 'x-bot-api-key': BOT_KEY });
  check('Consent accepted (' + consent.status + ')', consent.status === 200);
  console.log('  consent resp:', JSON.stringify(consent.body));

  // 6. Submit diary entry
  const diary = await req('POST', '/api/bot/diary',
    { telegram_id: tgId, content: 'CONSENT168_DIARY_' + TS, entry_type: 'text' },
    { 'x-bot-api-key': BOT_KEY });
  check('Diary submitted', diary.status === 201);

  // 7. Create therapist note
  const note = await req('POST', '/api/clients/' + clientId + '/notes',
    { content: 'CONSENT168_NOTE_' + TS },
    { 'Authorization': 'Bearer ' + token, 'X-CSRF-Token': csrfToken });
  check('Note created (' + note.status + ')', note.status === 201);
  if (note.status !== 201) console.log('    note err:', JSON.stringify(note.body));

  // Debug: check client state
  const clientCheck = await req('GET', '/api/clients/' + clientId, null,
    { 'Authorization': 'Bearer ' + token });
  console.log('  DEBUG client check:', clientCheck.status, JSON.stringify(clientCheck.body).substring(0, 200));

  console.log('\n--- Pre-revocation: verify access ---');

  // 8. Verify diary access
  const diaryGet = await req('GET', '/api/clients/' + clientId + '/diary', null,
    { 'Authorization': 'Bearer ' + token });
  check('Diary accessible pre-revoke', diaryGet.status === 200 && diaryGet.body.entries && diaryGet.body.entries.length > 0);

  // 9. Verify notes access
  const notesGet = await req('GET', '/api/clients/' + clientId + '/notes', null,
    { 'Authorization': 'Bearer ' + token });
  check('Notes accessible pre-revoke', notesGet.status === 200 && notesGet.body.notes && notesGet.body.notes.length > 0);

  // 10. Verify timeline access
  const tlGet = await req('GET', '/api/clients/' + clientId + '/timeline', null,
    { 'Authorization': 'Bearer ' + token });
  check('Timeline accessible pre-revoke', tlGet.status === 200);

  // 11. Verify client in list
  const clientsList = await req('GET', '/api/clients', null,
    { 'Authorization': 'Bearer ' + token });
  var inList = clientsList.body.clients && clientsList.body.clients.some(function(c) { return c.id === clientId; });
  check('Client in list pre-revoke', inList);

  console.log('\n--- Revoking consent ---');

  // 12. Revoke consent
  const revoke = await req('POST', '/api/bot/revoke-consent',
    { telegram_id: tgId },
    { 'x-bot-api-key': BOT_KEY });
  check('Consent revoked', revoke.status === 200 && revoke.body.revoked === true);

  console.log('\n--- Post-revocation: verify cascade ---');

  // 13. Diary access denied
  const diaryPost = await req('GET', '/api/clients/' + clientId + '/diary', null,
    { 'Authorization': 'Bearer ' + token });
  check('Diary access denied (403 or 404)', diaryPost.status === 403 || diaryPost.status === 404);
  console.log('    diary status:', diaryPost.status);

  // 14. Timeline access denied
  const tlPost = await req('GET', '/api/clients/' + clientId + '/timeline', null,
    { 'Authorization': 'Bearer ' + token });
  check('Timeline access denied (403 or 404)', tlPost.status === 403 || tlPost.status === 404);
  console.log('    timeline status:', tlPost.status);

  // 15. Client no longer in client list
  const clients2 = await req('GET', '/api/clients', null,
    { 'Authorization': 'Bearer ' + token });
  var stillIn = clients2.body.clients && clients2.body.clients.some(function(c) { return c.id === clientId; });
  check('Client NOT in list post-revoke', !stillIn);

  // 16. Therapist own notes STILL accessible
  const notesPost = await req('GET', '/api/clients/' + clientId + '/notes', null,
    { 'Authorization': 'Bearer ' + token });
  check('Notes STILL accessible post-revoke (200)', notesPost.status === 200);
  console.log('    notes status:', notesPost.status);
  if (notesPost.body.notes) {
    var noteFound = notesPost.body.notes.some(function(n) { return n.content && n.content.indexOf('CONSENT168_NOTE_' + TS) >= 0; });
    check('Note content preserved post-revoke', noteFound);
  } else {
    check('Note content preserved post-revoke', false);
    console.log('    notes body:', JSON.stringify(notesPost.body).substring(0, 200));
  }

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function(e) { console.error(e); process.exit(1); });
