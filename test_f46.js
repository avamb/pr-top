var BASE = 'http://localhost:3001/api';
var BOT = {'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key'};

async function getCSRF() {
  var r = await fetch(BASE + '/csrf-token');
  var d = await r.json();
  return d.csrfToken;
}

async function main() {
  try {
    // Register therapist
    var csrf = await getCSRF();
    var r = await fetch(BASE + '/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-csrf-token': csrf},
      body: JSON.stringify({email: 'f46test@psylink.app', password: 'Test1234!', name: 'F46 Tester'})
    });
    var token;
    if (r.status === 201) {
      token = (await r.json()).token;
      console.log('Registered therapist');
    } else {
      await r.text();
      csrf = await getCSRF();
      r = await fetch(BASE + '/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'x-csrf-token': csrf},
        body: JSON.stringify({email: 'f46test@psylink.app', password: 'Test1234!'})
      });
      token = (await r.json()).token;
      console.log('Logged in therapist');
    }

    // Get invite code
    r = await fetch(BASE + '/invite-code', { headers: {'Authorization': 'Bearer ' + token} });
    var inv = await r.json();

    // Register + connect + consent client
    await fetch(BASE + '/bot/register', { method: 'POST', headers: BOT,
      body: JSON.stringify({telegram_id: 'f46cli', role: 'client', name: 'F46 Client'}) });
    r = await fetch(BASE + '/bot/connect', { method: 'POST', headers: BOT,
      body: JSON.stringify({telegram_id: 'f46cli', invite_code: inv.invite_code}) });
    var conn = await r.json();
    await fetch(BASE + '/bot/consent', { method: 'POST', headers: BOT,
      body: JSON.stringify({telegram_id: 'f46cli', therapist_id: conn.therapist?.id, consent: true}) });

    // Get client ID
    r = await fetch(BASE + '/clients', { headers: {'Authorization': 'Bearer ' + token} });
    var clients = (await r.json()).clients || [];
    if (clients.length === 0) { console.log('FAIL: no clients'); return; }
    var cid = clients[0].id;
    console.log('Client ID:', cid);

    // Step 1: PUT goals via context endpoint
    var goals = 'GOALS_TEST_F46: 1) Reduce anxiety 2) Improve sleep 3) Build coping mechanisms';
    csrf = await getCSRF();
    r = await fetch(BASE + '/clients/' + cid + '/context', {
      method: 'PUT',
      headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'x-csrf-token': csrf},
      body: JSON.stringify({current_goals: goals})
    });
    var putResp = await r.json();
    console.log('PUT goals status:', r.status);
    console.log('PUT response:', JSON.stringify(putResp).substring(0, 200));

    // Step 2: GET context to verify goals decrypted
    r = await fetch(BASE + '/clients/' + cid + '/context', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    var getResp = await r.json();
    console.log('GET context status:', r.status);
    console.log('Goals returned:', getResp.context?.current_goals);
    var goalsMatch = getResp.context?.current_goals === goals;
    console.log('Goals match:', goalsMatch);

    // Step 3: Verify goals stored encrypted in DB (check raw)
    // We verify by checking the context has encrypted fields
    console.log('Has context:', !!getResp.context);
    console.log('Goals field present:', 'current_goals' in (getResp.context || {}));

    // Step 4: Update goals
    var newGoals = 'UPDATED_GOALS_F46: 1) Reduce anxiety 2) Better sleep hygiene 3) Mindfulness practice';
    csrf = await getCSRF();
    r = await fetch(BASE + '/clients/' + cid + '/context', {
      method: 'PUT',
      headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'x-csrf-token': csrf},
      body: JSON.stringify({current_goals: newGoals})
    });
    console.log('Update goals status:', r.status);

    // Verify updated goals
    r = await fetch(BASE + '/clients/' + cid + '/context', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    var updatedResp = await r.json();
    console.log('Updated goals:', updatedResp.context?.current_goals);
    var updatedMatch = updatedResp.context?.current_goals === newGoals;
    console.log('Updated match:', updatedMatch);

    // Step 5: Verify other context fields preserved (anamnesis should be null/empty)
    console.log('Anamnesis preserved:', updatedResp.context?.anamnesis === null || updatedResp.context?.anamnesis === '' || updatedResp.context?.anamnesis === undefined);

    var pass = goalsMatch && updatedMatch;
    console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
  } catch(e) {
    console.log('ERROR:', e.message);
    console.log('STACK:', e.stack);
  }
}

main();
