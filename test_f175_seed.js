var API = 'http://localhost:3001/api';

async function getCSRF() {
  var res = await fetch(API + '/csrf-token');
  var data = await res.json();
  return data.csrfToken;
}

async function seed() {
  var csrf = await getCSRF();
  var headers = {'Content-Type': 'application/json', 'x-csrf-token': csrf, 'x-bot-api-key': 'dev-bot-api-key'};

  // Create 30 text entries and 10 voice entries for clientA to test pagination (per_page=25)
  console.log('Creating 30 text entries...');
  for (var i = 0; i < 30; i++) {
    await fetch(API + '/bot/diary', {
      method: 'POST', headers: headers,
      body: JSON.stringify({telegram_id: 'filt_clientA_174', entry_type: 'text', content: 'PAGE_TEST_TEXT_' + i})
    });
  }
  console.log('Creating 10 voice entries...');
  for (var j = 0; j < 10; j++) {
    await fetch(API + '/bot/diary', {
      method: 'POST', headers: headers,
      body: JSON.stringify({telegram_id: 'filt_clientA_174', entry_type: 'voice', content: 'PAGE_TEST_VOICE_' + j, voice_file_id: 'vf_' + j})
    });
  }
  console.log('Done seeding. Total should be ~46 entries for clientA.');
}
seed().catch(function(e) { console.error(e); });
