// Setup test data for breadcrumb feature verification
async function setup() {
  const API = 'http://localhost:3001/api';
  const BOT_KEY = 'dev-bot-api-key';
  const botHeaders = { 'Content-Type': 'application/json', 'X-Bot-API-Key': BOT_KEY };

  // Register therapist via bot API (to get telegram_id for therapist)
  let res = await fetch(`${API}/bot/register`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify({ telegram_id: 'BC_THERAPIST_107', role: 'therapist', email: 'breadcrumb_test@test.com' })
  });
  let data = await res.json();
  console.log('Therapist bot register:', JSON.stringify(data));

  // Register test client via bot API
  res = await fetch(`${API}/bot/register`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_107', role: 'client' })
  });
  data = await res.json();
  console.log('Client register:', JSON.stringify(data));

  // Get invite code for the therapist - need web auth token
  // Use the browser token approach - get it from localStorage via script
  // Instead, let's use a workaround: register therapist via bot which auto-creates invite code
  // Then connect client

  // First check if therapist already has invite code by looking up via bot
  res = await fetch(`${API}/bot/connect`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_107', invite_code: 'DUMMY' })
  });
  data = await res.json();
  console.log('Connect attempt:', JSON.stringify(data));

  // We need to get the actual invite code. Let's query it differently.
  // The web login needs CSRF. Let's try a different approach:
  // Register therapist via bot which gives invite_code in response
  res = await fetch(`${API}/bot/register`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify({ telegram_id: 'BC_THER_NEW_107', role: 'therapist' })
  });
  data = await res.json();
  console.log('New therapist:', JSON.stringify(data));

  if (data.invite_code) {
    // Connect client with this therapist
    res = await fetch(`${API}/bot/connect`, {
      method: 'POST', headers: botHeaders,
      body: JSON.stringify({ telegram_id: 'BC_CLIENT_107', invite_code: data.invite_code })
    });
    let connectData = await res.json();
    console.log('Connect:', JSON.stringify(connectData));

    // Consent
    res = await fetch(`${API}/bot/consent`, {
      method: 'POST', headers: botHeaders,
      body: JSON.stringify({ telegram_id: 'BC_CLIENT_107', action: 'accept' })
    });
    let consentData = await res.json();
    console.log('Consent:', JSON.stringify(consentData));
  }
}
setup().catch(e => console.error(e));
