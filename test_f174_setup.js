var API = 'http://localhost:3001/api';

async function getCSRF() {
  var res = await fetch(API + '/csrf-token');
  var data = await res.json();
  return data.csrfToken;
}

async function setup() {
  var csrf = await getCSRF();
  var headers = {'Content-Type': 'application/json', 'x-csrf-token': csrf, 'x-bot-api-key': 'dev-bot-api-key'};

  // Register therapist
  var reg = await fetch(API + '/auth/register', {
    method: 'POST', headers: headers,
    body: JSON.stringify({email: 'filter_test_174@test.com', password: 'StrongPwd1', name: 'FilterTest'})
  });
  var data;
  if (reg.ok) {
    data = await reg.json();
  } else {
    var login = await fetch(API + '/auth/login', {
      method: 'POST', headers: headers,
      body: JSON.stringify({email: 'filter_test_174@test.com', password: 'StrongPwd1'})
    });
    data = await login.json();
  }
  var token = data.token;
  console.log('Token:', token);

  var authHeaders = {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'x-csrf-token': csrf};

  // Get invite code
  var icRes = await fetch(API + '/invite-code', {headers: {'Authorization': 'Bearer ' + token}});
  var icData = await icRes.json();
  var inviteCode = icData.invite_code;
  console.log('InviteCode:', inviteCode);

  // Register 2 clients via bot
  var r1 = await fetch(API + '/bot/register', {
    method: 'POST', headers: headers,
    body: JSON.stringify({telegram_id: 'filt_clientA_174', role: 'client', name: 'ClientA_Filter'})
  });
  console.log('ClientA reg:', r1.status, await r1.json());
  var r2 = await fetch(API + '/bot/register', {
    method: 'POST', headers: headers,
    body: JSON.stringify({telegram_id: 'filt_clientB_174', role: 'client', name: 'ClientB_Filter'})
  });
  console.log('ClientB reg:', r2.status, await r2.json());

  // Connect and consent clients
  var tgIds = ['filt_clientA_174', 'filt_clientB_174'];
  for (var i = 0; i < tgIds.length; i++) {
    var cr = await fetch(API + '/bot/connect', {
      method: 'POST', headers: headers,
      body: JSON.stringify({telegram_id: tgIds[i], invite_code: inviteCode})
    });
    console.log('Connect ' + tgIds[i] + ':', cr.status, await cr.json());
    var cn = await fetch(API + '/bot/consent', {
      method: 'POST', headers: headers,
      body: JSON.stringify({telegram_id: tgIds[i], therapist_id: data.user.id, consent: true})
    });
    console.log('Consent ' + tgIds[i] + ':', cn.status, await cn.json());
  }

  // Add diary entries for clientA (text + voice)
  await fetch(API + '/bot/diary', {
    method: 'POST', headers: headers,
    body: JSON.stringify({telegram_id: 'filt_clientA_174', entry_type: 'text', content: 'FILTER_TEST_A_TEXT_111'})
  });
  await fetch(API + '/bot/diary', {
    method: 'POST', headers: headers,
    body: JSON.stringify({telegram_id: 'filt_clientA_174', entry_type: 'voice', content: 'FILTER_TEST_A_VOICE_222', voice_file_id: 'voice_fake_a'})
  });

  // Add diary entries for clientB (text only)
  await fetch(API + '/bot/diary', {
    method: 'POST', headers: headers,
    body: JSON.stringify({telegram_id: 'filt_clientB_174', entry_type: 'text', content: 'FILTER_TEST_B_TEXT_333'})
  });
  await fetch(API + '/bot/diary', {
    method: 'POST', headers: headers,
    body: JSON.stringify({telegram_id: 'filt_clientB_174', entry_type: 'text', content: 'FILTER_TEST_B_TEXT_444'})
  });

  // Get client list
  var clientsRes = await fetch(API + '/clients', {headers: {'Authorization': 'Bearer ' + token}});
  var clients = await clientsRes.json();
  console.log('Clients:', JSON.stringify(clients.clients.map(function(c) { return {id: c.id, name: c.name}; })));
  console.log('SETUP COMPLETE');
}
setup().catch(function(e) { console.error(e); });
