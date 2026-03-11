var BASE = 'http://localhost:3001/api';
var BOT = {'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key'};

async function getCSRF() {
  var r = await fetch(BASE + '/csrf-token');
  var d = await r.json();
  return d.csrfToken;
}

async function main() {
  try {
    // Step 1: Register therapist
    var csrf = await getCSRF();
    var r = await fetch(BASE + '/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-csrf-token': csrf},
      body: JSON.stringify({email: 'f39testv4@psylink.app', password: 'Test1234!', name: 'F39 Tester'})
    });
    var token;
    if (r.status === 201) {
      var d = await r.json();
      token = d.token;
      console.log('Registered new therapist');
    } else {
      // Already exists, consume body then login
      await r.text();
      csrf = await getCSRF();
      r = await fetch(BASE + '/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'x-csrf-token': csrf},
        body: JSON.stringify({email: 'f39testv4@psylink.app', password: 'Test1234!'})
      });
      var d2 = await r.json();
      token = d2.token;
      console.log('Logged in existing therapist');
    }

    if (!token) { console.log('FAIL: no token'); return; }

    // Step 2: Get invite code
    r = await fetch(BASE + '/invite-code', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    var inv = await r.json();
    console.log('Invite:', inv.invite_code);

    // Step 3: Register client via bot
    r = await fetch(BASE + '/bot/register', {
      method: 'POST', headers: BOT,
      body: JSON.stringify({telegram_id: 'f39cli_v4', role: 'client', name: 'F39 Client'})
    });
    console.log('Client reg:', r.status);

    // Step 4: Connect + consent
    r = await fetch(BASE + '/bot/connect', {
      method: 'POST', headers: BOT,
      body: JSON.stringify({telegram_id: 'f39cli_v4', invite_code: inv.invite_code})
    });
    var connectData = await r.json();
    console.log('Connect:', r.status, 'therapist_id:', connectData.therapist?.id);
    var therapistIdForConsent = connectData.therapist?.id;

    r = await fetch(BASE + '/bot/consent', {
      method: 'POST', headers: BOT,
      body: JSON.stringify({telegram_id: 'f39cli_v4', therapist_id: therapistIdForConsent, consent: true})
    });
    var consentBody = await r.json();
    console.log('Consent:', r.status, consentBody.message || consentBody.error || '');

    // Step 5: Get client ID
    r = await fetch(BASE + '/clients', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    var cdata = await r.json();
    var clients = cdata.clients || [];
    console.log('Client list response:', JSON.stringify(cdata).substring(0, 200));
    if (clients.length === 0) { console.log('FAIL: no clients'); return; }
    var cid = clients[0].id;
    console.log('Client ID:', cid);

    // Step 6: Create test data - diary
    r = await fetch(BASE + '/bot/diary', {
      method: 'POST', headers: BOT,
      body: JSON.stringify({telegram_id: 'f39cli_v4', content: 'F39_DIARY_ENTRY', entry_type: 'text'})
    });
    console.log('Diary:', r.status);

    // Create note
    csrf = await getCSRF();
    r = await fetch(BASE + '/clients/' + cid + '/notes', {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'x-csrf-token': csrf},
      body: JSON.stringify({content: 'F39_NOTE_ENTRY', session_date: '2026-03-11'})
    });
    console.log('Note:', r.status);

    // Create session via multipart
    csrf = await getCSRF();
    var bound = '----F39Bound';
    var mbody = '--' + bound + '\r\nContent-Disposition: form-data; name="audio"; filename="f39.mp3"\r\nContent-Type: audio/mpeg\r\n\r\nfake\r\n--' + bound + '\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n' + cid + '\r\n--' + bound + '--\r\n';
    r = await fetch(BASE + '/sessions', {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'multipart/form-data; boundary=' + bound, 'x-csrf-token': csrf},
      body: mbody
    });
    console.log('Session:', r.status);

    // Wait a moment for async processing
    await new Promise(function(ok) { setTimeout(ok, 2000); });

    // Step 7: TEST FILTERS
    console.log('\n=== TIMELINE TYPE FILTER TESTS ===');

    // All items
    r = await fetch(BASE + '/clients/' + cid + '/timeline', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    var all = await r.json();
    console.log('All items:', all.total);
    var tc = {};
    all.timeline.forEach(function(i) { tc[i.type] = (tc[i.type] || 0) + 1; });
    console.log('Types:', JSON.stringify(tc));

    // Filter: diary
    r = await fetch(BASE + '/clients/' + cid + '/timeline?type=diary', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    var diary = await r.json();
    var diaryOk = diary.timeline.length > 0 && diary.timeline.every(function(i) { return i.type === 'diary'; });
    console.log('DIARY: count=' + diary.total + ' correct=' + diaryOk + ' filter=' + diary.filters.type);

    // Filter: note
    r = await fetch(BASE + '/clients/' + cid + '/timeline?type=note', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    var note = await r.json();
    var noteOk = note.timeline.length > 0 && note.timeline.every(function(i) { return i.type === 'note'; });
    console.log('NOTE: count=' + note.total + ' correct=' + noteOk + ' filter=' + note.filters.type);

    // Filter: session
    r = await fetch(BASE + '/clients/' + cid + '/timeline?type=session', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    var sess = await r.json();
    var sessOk = sess.timeline.length > 0 && sess.timeline.every(function(i) { return i.type === 'session'; });
    console.log('SESSION: count=' + sess.total + ' correct=' + sessOk + ' filter=' + sess.filters.type);

    // Sum check
    var sum = diary.total + note.total + sess.total;
    console.log('Sum=' + sum + ' Total=' + all.total + ' Match=' + (sum === all.total));

    var pass = diaryOk && noteOk && sessOk && (sum === all.total);
    console.log('\nRESULT: ' + (pass ? 'PASS' : 'FAIL'));
  } catch(e) {
    console.log('ERROR:', e.message);
    console.log('STACK:', e.stack);
  }
}

main();
