async function run() {
  var base = 'http://localhost:3001';
  var csrfRes = await fetch(base + '/api/csrf-token');
  var csrfData = await csrfRes.json();
  var csrfToken = csrfData.csrfToken;
  var cookies = csrfRes.headers.get('set-cookie') || '';
  var h = {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
    'Cookie': cookies.split(';')[0]
  };
  var botH = {
    'Content-Type': 'application/json',
    'x-bot-api-key': 'dev-bot-api-key'
  };

  // Register therapist
  var regRes = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: h,
    body: JSON.stringify({email:'f181_therapist@test.com', password:'StrongPwd1', role:'therapist'})
  });
  var regData = await regRes.json();
  var token = regData.token;
  if (!token) {
    var loginRes = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: h,
      body: JSON.stringify({email:'f181_therapist@test.com', password:'StrongPwd1'})
    });
    token = (await loginRes.json()).token;
  }
  console.log('Token:', !!token);

  var invRes = await fetch(base + '/api/invite-code', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var invData = await invRes.json();
  console.log('Invite code:', invData.invite_code);

  var botRes = await fetch(base + '/api/bot/register', {
    method: 'POST', headers: botH,
    body: JSON.stringify({telegram_id: 'f181_client_tg', role: 'client', language: 'en'})
  });
  console.log('Client register:', botRes.status);

  var connRes = await fetch(base + '/api/bot/connect', {
    method: 'POST', headers: botH,
    body: JSON.stringify({telegram_id: 'f181_client_tg', invite_code: invData.invite_code})
  });
  console.log('Connect:', connRes.status);

  var consentRes = await fetch(base + '/api/bot/consent', {
    method: 'POST', headers: botH,
    body: JSON.stringify({telegram_id: 'f181_client_tg', consent: true})
  });
  console.log('Consent:', consentRes.status);

  var diaryRes = await fetch(base + '/api/bot/diary', {
    method: 'POST', headers: botH,
    body: JSON.stringify({telegram_id: 'f181_client_tg', entry_type: 'text', content: 'I felt happy today and enjoyed the sunshine'})
  });
  console.log('Diary:', diaryRes.status);

  var clientsRes = await fetch(base + '/api/clients', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var clientsData = await clientsRes.json();
  console.log('Client ID:', clientsData.clients[0]?.id);
  console.log('\nLogin: f181_therapist@test.com / StrongPwd1');
}
run().catch(e => console.error(e));
