async function setup() {
  const API = 'http://localhost:3001/api';
  const BOT_KEY = 'dev-bot-api-key';
  const botHeaders = { 'Content-Type': 'application/json', 'X-Bot-API-Key': BOT_KEY };

  // Consent with therapist_id
  let res = await fetch(`${API}/bot/consent`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify({ telegram_id: 'BC_CLIENT_200', therapist_id: 479, action: 'accept' })
  });
  let data = await res.json();
  console.log('Consent:', JSON.stringify(data));

  // Now the breadcrumb_test@test.com (which was a web registration) is NOT the same as therapist 479
  // Therapist 479 is BC_THERAPIST_107 registered via bot.
  // breadcrumb_test@test.com was registered via web and is a different user.
  // Let me check if breadcrumb_test has an invite code by querying
  // Actually the simplest approach: log in as breadcrumb_test via browser, get invite code from dashboard, create client

  // Alternatively: let me just log in as a therapist that HAS clients
  // From the progress notes, other test therapists exist. Let me check clients for therapist 479.
  console.log('Done - client 482 should be linked to therapist 479 (BC_THERAPIST_107)');
  console.log('But breadcrumb_test@test.com is a different user without telegram_id');
  console.log('We need to test with a therapist that has clients in the web UI');
}
setup().catch(e => console.error(e));
