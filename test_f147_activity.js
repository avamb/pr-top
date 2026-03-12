const BASE = 'http://localhost:3001';
const BOT_KEY = 'dev-bot-api-key';

async function getCSRF() {
  const res = await fetch(`${BASE}/api/csrf-token`, { credentials: 'include' });
  const data = await res.json();
  const cookies = res.headers.get('set-cookie') || '';
  return { token: data.csrfToken, cookies };
}

async function run() {
  const ts = Date.now();

  // Get CSRF token
  const csrf = await getCSRF();
  console.log('CSRF token obtained');

  // 1. Register therapist via web
  console.log('1. Register therapist...');
  let res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf.token,
      'Cookie': csrf.cookies.split(';')[0]
    },
    body: JSON.stringify({email: `therapist_f147_${ts}@test.com`, password: 'StrongPwd1', role: 'therapist'})
  });
  const therapist = await res.json();
  console.log('Therapist:', therapist.user?.id, 'token:', therapist.token ? 'YES' : 'NO');
  const token = therapist.token;

  // 2. Register client via bot
  console.log('2. Register client...');
  res = await fetch(`${BASE}/api/bot/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: `client_f147_${ts}`, role: 'client'})
  });
  const client = await res.json();
  console.log('Client:', client.user?.id);

  // 3. Get invite code
  res = await fetch(`${BASE}/api/invite-code`, {
    headers: {'Authorization': `Bearer ${token}`}
  });
  const invite = await res.json();
  console.log('Invite code:', invite.invite_code);

  // 4. Connect client to therapist
  res = await fetch(`${BASE}/api/bot/connect`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: `client_f147_${ts}`, invite_code: invite.invite_code})
  });
  const connect = await res.json();
  console.log('Connect:', connect.message);

  // 5. Give consent
  res = await fetch(`${BASE}/api/bot/consent`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: `client_f147_${ts}`, therapist_id: connect.therapist?.id, consent: true})
  });
  const consent = await res.json();
  console.log('Consent:', consent.message);

  // 6. Check client list - initial last_activity should be null
  res = await fetch(`${BASE}/api/clients`, {
    headers: {'Authorization': `Bearer ${token}`}
  });
  const clientList1 = await res.json();
  const ourClient1 = clientList1.clients.find(c => c.telegram_id === `client_f147_${ts}`);
  console.log('Initial last_activity:', ourClient1?.last_activity);

  // 7. Wait a moment, then submit diary entry
  console.log('7. Submitting diary entry...');
  await new Promise(r => setTimeout(r, 1500));
  res = await fetch(`${BASE}/api/bot/diary`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: `client_f147_${ts}`, content: 'TEST_F147_DIARY_ENTRY activity timestamp test'})
  });
  const diary = await res.json();
  console.log('Diary entry created:', diary.entry?.id);

  // 8. Check client list again - last_activity should be updated
  res = await fetch(`${BASE}/api/clients`, {
    headers: {'Authorization': `Bearer ${token}`}
  });
  const clientList2 = await res.json();
  const ourClient2 = clientList2.clients.find(c => c.telegram_id === `client_f147_${ts}`);
  console.log('Updated last_activity:', ourClient2?.last_activity);

  // 9. Verify
  const initialNull = ourClient1?.last_activity === null;
  const updatedNotNull = ourClient2?.last_activity !== null;
  const updatedRecent = updatedNotNull && (new Date() - new Date(ourClient2.last_activity)) < 30000;

  console.log('\n=== RESULTS ===');
  console.log('Initial last_activity was null:', initialNull ? 'PASS' : 'FAIL');
  console.log('Updated last_activity is not null:', updatedNotNull ? 'PASS' : 'FAIL');
  console.log('Updated last_activity is recent (<30s):', updatedRecent ? 'PASS' : 'FAIL');
  console.log('ALL CHECKS:', (initialNull && updatedNotNull && updatedRecent) ? 'PASS' : 'FAIL');
}

run().catch(e => console.error(e));
