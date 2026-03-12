var http = require('http');

function request(method, path, body, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: '127.0.0.1',
      port: 3001,
      path: path,
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
    };
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

var BOT_HDR = { 'x-bot-api-key': 'dev-bot-api-key' };

async function main() {
  // 1. Get CSRF
  var csrfRes = await request('GET', '/api/csrf-token');
  var csrf = JSON.parse(csrfRes.body).csrfToken;

  // 2. Register therapist
  var regRes = await request('POST', '/api/auth/register',
    { email: 'export_201c@example.com', password: 'TestPass1', role: 'therapist' },
    { 'x-csrf-token': csrf }
  );
  var regData = JSON.parse(regRes.body);
  var therapistToken = regData.token;
  var therapistId = regData.user.id;
  console.log('Therapist id:', therapistId);

  // 3. Get invite code
  var invRes = await request('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + therapistToken });
  var inviteCode = JSON.parse(invRes.body).invite_code;

  // 4. Register client
  var botRegRes = await request('POST', '/api/bot/register',
    { telegram_id: 'exp_client_201c', role: 'client' }, BOT_HDR);
  var clientData = JSON.parse(botRegRes.body);
  var clientId = clientData.user.id;
  console.log('Client id:', clientId);

  // 5. Connect
  var connectRes = await request('POST', '/api/bot/connect',
    { telegram_id: 'exp_client_201c', invite_code: inviteCode }, BOT_HDR);
  var connectData = JSON.parse(connectRes.body);
  console.log('Connect:', connectData.message);

  // 6. Consent (needs therapist_id, consent: true)
  var consentRes = await request('POST', '/api/bot/consent',
    { telegram_id: 'exp_client_201c', therapist_id: therapistId, consent: true }, BOT_HDR);
  var consentData = JSON.parse(consentRes.body);
  console.log('Consent:', consentData.message);

  // 7. Create diary entries
  for (var i = 1; i <= 3; i++) {
    await request('POST', '/api/bot/diary',
      { telegram_id: 'exp_client_201c', entry_type: 'text', content: 'EXPORT_TEST_ENTRY_' + i + ': This is diary entry ' + i },
      BOT_HDR);
  }
  console.log('Created 3 diary entries');

  // 8. Test export
  var exportRes = await request('GET', '/api/clients/' + clientId + '/diary/export', null,
    { 'Authorization': 'Bearer ' + therapistToken });
  console.log('\nExport status:', exportRes.status);
  console.log('Content-Disposition:', exportRes.headers['content-disposition']);

  var exportData = JSON.parse(exportRes.body);
  console.log('Total entries:', exportData.total_entries);
  console.log('Client ID:', exportData.client_id);

  var allDecrypted = exportData.entries.every(function(e) {
    return e.content && e.content.indexOf('EXPORT_TEST_ENTRY_') >= 0;
  });
  console.log('All decrypted:', allDecrypted ? 'PASS' : 'FAIL');
  console.log('Has filename:', (exportRes.headers['content-disposition'] || '').indexOf('diary_export') >= 0 ? 'PASS' : 'FAIL');

  // 9. No auth
  var noAuth = await request('GET', '/api/clients/' + clientId + '/diary/export');
  console.log('No-auth 401:', noAuth.status === 401 ? 'PASS' : 'FAIL');

  console.log('\nAll tests done!');
}

main().catch(function(e) { console.error('Error:', e.message); });
