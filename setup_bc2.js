async function setup() {
  const API = 'http://localhost:3001/api';
  const BOT_KEY = 'dev-bot-api-key';
  const botHeaders = { 'Content-Type': 'application/json', 'X-Bot-API-Key': BOT_KEY };

  // The breadcrumb_test@test.com therapist was registered via web (id from registration)
  // but doesn't have telegram_id. Let's use the therapist BC_THERAPIST_107 (id=479) which has invite_code 3700c324

  // Register a client
  let res = await fetch(`${API}/bot/register`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_200', role: 'client' })
  });
  let data = await res.json();
  console.log('Client:', JSON.stringify(data));

  // Connect to the therapist with invite code 3700c324
  res = await fetch(`${API}/bot/connect`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_200', invite_code: '3700c324' })
  });
  data = await res.json();
  console.log('Connect:', JSON.stringify(data));

  // Consent
  res = await fetch(`${API}/bot/consent`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_200', action: 'accept' })
  });
  data = await res.json();
  console.log('Consent:', JSON.stringify(data));
}
setup().catch(e => console.error(e));
