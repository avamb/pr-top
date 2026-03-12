const BASE = 'http://localhost:3001';
const BOT_KEY = 'dev-bot-api-key';

async function run() {
  // Get therapist's invite code via login
  const csrfRes = await fetch(`${BASE}/api/csrf-token`);
  const csrfData = await csrfRes.json();
  const cookieHeader = csrfRes.headers.get('set-cookie');
  const cookies = cookieHeader ? cookieHeader.split(';')[0] : '';

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-csrf-token': csrfData.csrfToken, 'Cookie': cookies},
    body: JSON.stringify({email: 'f147_browser@test.com', password: 'StrongPwd1'})
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  // Get invite code
  const invRes = await fetch(`${BASE}/api/invite-code`, {headers: {'Authorization': `Bearer ${token}`}});
  const invData = await invRes.json();
  process.stdout.write('INVITE:' + invData.invite_code + '\n');

  // Register client via bot
  const regRes = await fetch(`${BASE}/api/bot/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: 'f147_browser_client', role: 'client'})
  });
  const regData = await regRes.json();
  process.stdout.write('CLIENT_ID:' + regData.user.id + '\n');

  // Connect
  const connRes = await fetch(`${BASE}/api/bot/connect`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: 'f147_browser_client', invite_code: invData.invite_code})
  });
  const connData = await connRes.json();
  process.stdout.write('THERAPIST_ID:' + connData.therapist.id + '\n');

  // Consent
  await fetch(`${BASE}/api/bot/consent`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY},
    body: JSON.stringify({telegram_id: 'f147_browser_client', therapist_id: connData.therapist.id, consent: true})
  });
  process.stdout.write('LINKED:true\n');
}

run().catch(e => process.stderr.write(e.message + '\n'));
