async function setup() {
  const API = 'http://localhost:3001/api';
  const BOT_KEY = 'dev-bot-api-key';
  const h = { 'Content-Type': 'application/json', 'X-Bot-API-Key': BOT_KEY };

  // Register a new client
  let res = await fetch(`${API}/bot/register`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_LINKED', role: 'client' })
  });
  console.log('Register:', (await res.json()).message || 'ok');

  // Connect with breadcrumb_test therapist invite code c9bc6e7e
  res = await fetch(`${API}/bot/connect`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_LINKED', invite_code: 'c9bc6e7e' })
  });
  let connectData = await res.json();
  console.log('Connect:', JSON.stringify(connectData));

  // Consent - need therapist_id from connect response
  let therapistId = connectData.therapist?.id;
  console.log('Therapist ID:', therapistId);

  res = await fetch(`${API}/bot/consent`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_LINKED', therapist_id: therapistId, action: 'accept' })
  });
  console.log('Consent:', JSON.stringify(await res.json()));
}
setup().catch(e => console.error(e));
