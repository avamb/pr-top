async function test() {
  const API = 'http://localhost:3001/api';
  const BOT_KEY = 'dev-bot-api-key';
  const h = { 'Content-Type': 'application/json', 'X-Bot-API-Key': BOT_KEY };

  // Step 1: Create diary entry with specific content
  let res = await fetch(`${API}/bot/diary`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      telegram_id: 'BC_CLIENT_LINKED',
      content: 'VERIFY_DATA_TEST_67890',
      entry_type: 'text'
    })
  });
  let data = await res.json();
  console.log('Create diary:', JSON.stringify(data));

  // Step 2: Get therapist token to read diary
  // Get CSRF
  res = await fetch(`${API}/csrf-token`);
  let csrfData = await res.json();
  let csrfToken = csrfData.token;
  let setCookieHeader = res.headers.get('set-cookie');
  // Extract just the cookie name=value
  let cookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';

  res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Cookie': cookie
    },
    body: JSON.stringify({ email: 'breadcrumb_test@test.com', password: 'Test123!' })
  });
  let loginData = await res.json();
  console.log('Login:', loginData.token ? 'OK' : JSON.stringify(loginData));
  let token = loginData.token;

  // Step 3: GET /api/clients/483/diary and verify
  res = await fetch(`${API}/clients/483/diary`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  data = await res.json();
  console.log('Diary entries count:', data.entries?.length);
  let found = data.entries?.find(e => e.content === 'VERIFY_DATA_TEST_67890');
  console.log('Found VERIFY_DATA_TEST_67890:', found ? 'YES' : 'NO');
  if (found) {
    console.log('Entry details:', JSON.stringify({ id: found.id, content: found.content, entry_type: found.entry_type }));
  }
}
test().catch(e => console.error(e));
