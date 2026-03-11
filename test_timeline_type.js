const http = require('http');

function httpReq(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: { ...headers } };
    if (body) opts.headers['Content-Type'] = 'application/json';
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const base = 'http://localhost:3001';

  // Get CSRF token
  const csrfRes = await httpReq('GET', base + '/api/csrf-token', null, {});
  const csrf = csrfRes.data.csrfToken;
  console.log('CSRF token obtained');

  const hdrs = { 'X-CSRF-Token': csrf };

  // Register a therapist for timeline testing
  const regEmail = 'timeline_test_' + Date.now() + '@test.com';
  const regRes = await httpReq('POST', base + '/api/auth/register', { email: regEmail, password: 'Test123!', role: 'therapist' }, hdrs);
  console.log('Register:', regRes.status, regRes.data.token ? 'got token' : JSON.stringify(regRes.data));

  const token = regRes.data.token;
  const therapistId = regRes.data.user ? regRes.data.user.id : null;
  if (!token) { console.log('FAIL: No token'); return; }

  const authHdrs = { 'X-CSRF-Token': csrf, Authorization: 'Bearer ' + token };

  // Register a bot client and link them
  const botKey = process.env.BOT_API_KEY || 'bot-secret-key';
  const botHdrs = { 'X-Bot-Key': botKey, 'X-CSRF-Token': csrf };
  const clientTgId = 'tl_client_' + Date.now();
  await httpReq('POST', base + '/api/bot/register', { telegram_id: clientTgId, role: 'client', first_name: 'TLClient' }, botHdrs);

  // Get therapist invite code
  const invRes = await httpReq('GET', base + '/api/invite-code', null, authHdrs);
  const inviteCode = invRes.data.invite_code;
  console.log('Invite code:', inviteCode);

  // Connect and consent
  await httpReq('POST', base + '/api/bot/connect', { telegram_id: clientTgId, invite_code: inviteCode }, botHdrs);
  await httpReq('POST', base + '/api/bot/consent', { telegram_id: clientTgId, accepted: true }, botHdrs);

  // Get client ID
  const clientsRes = await httpReq('GET', base + '/api/clients', null, authHdrs);
  const clients = clientsRes.data.clients || [];
  const client = clients.find(c => c.telegram_id === clientTgId);
  if (!client) { console.log('FAIL: Client not found in list'); return; }
  const clientId = client.id;
  console.log('Client ID:', clientId);

  // Create diary entry
  await httpReq('POST', base + '/api/bot/diary', { telegram_id: clientTgId, content: 'TIMELINE_DIARY_' + Date.now(), entry_type: 'text' }, botHdrs);
  console.log('Diary entry created');

  // Create note
  await httpReq('POST', base + '/api/clients/' + clientId + '/notes', { content: 'TIMELINE_NOTE_' + Date.now() }, authHdrs);
  console.log('Note created');

  // Create session (upload)
  const FormData = require('form-data') || null;
  // Simpler: just create session via direct API if available
  // Let's use multipart for session upload
  const boundary = '----boundary' + Date.now();
  const audioContent = Buffer.from('fake audio content for testing');
  const sessionBody = [
    '--' + boundary,
    'Content-Disposition: form-data; name="client_id"',
    '',
    String(clientId),
    '--' + boundary,
    'Content-Disposition: form-data; name="audio"; filename="test.wav"',
    'Content-Type: audio/wav',
    '',
    audioContent.toString(),
    '--' + boundary + '--'
  ].join('\r\n');

  const sessionRes = await new Promise((resolve, reject) => {
    const u = new URL(base + '/api/sessions');
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'X-CSRF-Token': csrf,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': Buffer.byteLength(sessionBody)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.write(sessionBody);
    req.end();
  });
  console.log('Session create:', sessionRes.status, sessionRes.data.session ? 'OK' : JSON.stringify(sessionRes.data).substring(0, 100));

  // Now test timeline filters
  console.log('\n--- Testing Timeline Type Filters ---');

  // All items
  const tlAll = await httpReq('GET', base + '/api/clients/' + clientId + '/timeline', null, authHdrs);
  console.log('All items:', tlAll.data.total, '| Types:', [...new Set(tlAll.data.timeline.map(i => i.type))].join(', '));

  // Diary only
  const tlDiary = await httpReq('GET', base + '/api/clients/' + clientId + '/timeline?type=diary', null, authHdrs);
  const diaryTypes = [...new Set(tlDiary.data.timeline.map(i => i.type))];
  const diaryOK = diaryTypes.length === 0 || (diaryTypes.length === 1 && diaryTypes[0] === 'diary');
  console.log('Diary filter:', tlDiary.data.total, 'items | Only diary?', diaryOK, '| Types:', diaryTypes.join(', '));

  // Note only
  const tlNote = await httpReq('GET', base + '/api/clients/' + clientId + '/timeline?type=note', null, authHdrs);
  const noteTypes = [...new Set(tlNote.data.timeline.map(i => i.type))];
  const noteOK = noteTypes.length === 0 || (noteTypes.length === 1 && noteTypes[0] === 'note');
  console.log('Note filter:', tlNote.data.total, 'items | Only notes?', noteOK, '| Types:', noteTypes.join(', '));

  // Session only
  const tlSession = await httpReq('GET', base + '/api/clients/' + clientId + '/timeline?type=session', null, authHdrs);
  const sessionTypes = [...new Set(tlSession.data.timeline.map(i => i.type))];
  const sessionOK = sessionTypes.length === 0 || (sessionTypes.length === 1 && sessionTypes[0] === 'session');
  console.log('Session filter:', tlSession.data.total, 'items | Only sessions?', sessionOK, '| Types:', sessionTypes.join(', '));

  // Verify totals
  const sumFiltered = tlDiary.data.total + tlNote.data.total + tlSession.data.total;
  console.log('\nTotal (all):', tlAll.data.total, '| Sum of filtered:', sumFiltered, '| Match:', tlAll.data.total === sumFiltered);

  // Verify response includes filter info
  console.log('Filter in response:', tlDiary.data.filters ? JSON.stringify(tlDiary.data.filters) : 'no filters field');

  const allOK = diaryOK && noteOK && sessionOK && tlAll.data.total === sumFiltered && tlAll.data.total >= 2;
  console.log('\n' + (allOK ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED!'));
}

main().catch(e => console.error('Error:', e.message));
