const BASE = 'http://localhost:3001';
const BOT_KEY = 'dev-bot-api-key';

async function run() {
  // 1. Get CSRF token and register therapist
  const csrfRes = await fetch(`${BASE}/api/csrf-token`);
  const csrfData = await csrfRes.json();
  const cookieHeader = csrfRes.headers.get('set-cookie');
  const cookies = cookieHeader ? cookieHeader.split(';')[0] : '';

  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-csrf-token': csrfData.csrfToken, 'Cookie': cookies},
    body: JSON.stringify({email: 'f148_audio@test.com', password: 'StrongPwd1', role: 'therapist'})
  });
  const regData = await regRes.json();
  const token = regData.token;
  process.stdout.write('Therapist registered: ' + regData.user.id + '\n');

  // 2. Register and link client
  await fetch(`${BASE}/api/bot/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: 'f148_audio_client', role: 'client'})
  });

  const invRes = await fetch(`${BASE}/api/invite-code`, {headers: {'Authorization': `Bearer ${token}`}});
  const invData = await invRes.json();

  const connRes = await fetch(`${BASE}/api/bot/connect`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: 'f148_audio_client', invite_code: invData.invite_code})
  });
  const connData = await connRes.json();

  await fetch(`${BASE}/api/bot/consent`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: 'f148_audio_client', therapist_id: connData.therapist.id, consent: true})
  });

  // Get client ID
  const clientsRes = await fetch(`${BASE}/api/clients`, {headers: {'Authorization': `Bearer ${token}`}});
  const clientsData = await clientsRes.json();
  const clientId = clientsData.clients.find(c => c.telegram_id === 'f148_audio_client').id;
  process.stdout.write('Client ID: ' + clientId + '\n');

  // 3. Upload audio file (create a fake audio blob)
  const audioContent = Buffer.from('fake-audio-data-for-testing-f148');
  const formData = new FormData();
  formData.append('audio', new Blob([audioContent], {type: 'audio/mp3'}), 'test_session.mp3');
  formData.append('client_id', String(clientId));

  const uploadRes = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: {'Authorization': `Bearer ${token}`},
    body: formData
  });
  const uploadData = await uploadRes.json();
  process.stdout.write('Upload status: ' + uploadRes.status + '\n');
  process.stdout.write('Session ID: ' + uploadData.id + '\n');
  process.stdout.write('Audio ref: ' + uploadData.audio_ref + '\n');

  const audioRef = uploadData.audio_ref;

  // 4. Try to access audio via direct URLs (should all fail)
  const directUrls = [
    `${BASE}/data/sessions/${audioRef}`,
    `${BASE}/sessions/${audioRef}`,
    `${BASE}/${audioRef}`,
    `${BASE}/api/sessions/audio/${audioRef}`,
    `${BASE}/uploads/${audioRef}`,
    `${BASE}/static/${audioRef}`,
  ];

  process.stdout.write('\n=== DIRECT URL ACCESS TESTS ===\n');
  let allBlocked = true;
  for (const url of directUrls) {
    const res = await fetch(url);
    const blocked = res.status === 404 || res.status === 401 || res.status === 403;
    process.stdout.write(url.replace(BASE, '') + ' -> ' + res.status + ' ' + (blocked ? 'BLOCKED' : 'ACCESSIBLE!') + '\n');
    if (!blocked) allBlocked = false;
  }

  // 5. Verify session accessible through authenticated API
  const sessionRes = await fetch(`${BASE}/api/sessions/${uploadData.id}`, {
    headers: {'Authorization': `Bearer ${token}`}
  });
  const sessionData = await sessionRes.json();
  const apiAccessOk = sessionRes.status === 200 && sessionData.audio_ref === audioRef;
  process.stdout.write('\nAuthenticated API access: ' + sessionRes.status + ' ' + (apiAccessOk ? 'PASS' : 'FAIL') + '\n');

  // 6. Verify unauthenticated API access is blocked
  const unauthRes = await fetch(`${BASE}/api/sessions/${uploadData.id}`);
  const unauthBlocked = unauthRes.status === 401;
  process.stdout.write('Unauthenticated API access: ' + unauthRes.status + ' ' + (unauthBlocked ? 'BLOCKED' : 'ACCESSIBLE!') + '\n');

  process.stdout.write('\n=== RESULTS ===\n');
  process.stdout.write('All direct URLs blocked: ' + (allBlocked ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Authenticated API works: ' + (apiAccessOk ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Unauthenticated blocked: ' + (unauthBlocked ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('ALL CHECKS: ' + (allBlocked && apiAccessOk && unauthBlocked ? 'PASS' : 'FAIL') + '\n');
}

run().catch(e => process.stderr.write(e.stack + '\n'));
