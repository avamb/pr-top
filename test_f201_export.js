var http = require('http');

function req(method, path, body, hdrs) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: '127.0.0.1', port: 3001, path: path, method: method,
      headers: Object.assign({'Content-Type':'application/json'}, hdrs || {})
    };
    var r = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { resolve({status: res.statusCode, headers: res.headers, body: d}); });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

var BOT = { 'x-bot-api-key': 'dev-bot-api-key' };
var uid = Date.now();

async function main() {
  // 1. CSRF
  var csrfR = await req('GET', '/api/csrf-token');
  var csrf = JSON.parse(csrfR.body).csrfToken;

  // 2. Register or login therapist
  var regR = await req('POST', '/api/auth/register',
    { email: 'exp201_' + uid + '@test.com', password: 'TestPass1', role: 'therapist' },
    { 'x-csrf-token': csrf }
  );
  var regD = JSON.parse(regR.body);
  if (regR.status !== 200 && regR.status !== 201) {
    console.log('Register failed:', regR.status, regD.error || regD.message);
    return;
  }
  var token = regD.token;
  var tId = regD.user.id;
  console.log('Therapist:', tId);

  // 3. Invite code
  var invR = await req('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + token });
  var inv = JSON.parse(invR.body).invite_code;

  // 4. Register client
  var tgId = 'exp_cli_' + uid;
  var cRegR = await req('POST', '/api/bot/register', { telegram_id: tgId, role: 'client' }, BOT);
  var cRegD = JSON.parse(cRegR.body);
  var cId = cRegD.user.id;
  console.log('Client:', cId);

  // 5. Connect + consent
  await req('POST', '/api/bot/connect', { telegram_id: tgId, invite_code: inv }, BOT);
  await req('POST', '/api/bot/consent', { telegram_id: tgId, therapist_id: tId, consent: true }, BOT);
  console.log('Linked + consented');

  // 6. Create entries
  for (var i = 1; i <= 3; i++) {
    await req('POST', '/api/bot/diary',
      { telegram_id: tgId, entry_type: 'text', content: 'EXPORT_TEST_ENTRY_' + i + ': diary ' + i },
      BOT);
  }
  console.log('Created 3 entries');

  // 7. Export
  var expR = await req('GET', '/api/clients/' + cId + '/diary/export', null,
    { 'Authorization': 'Bearer ' + token });
  console.log('\nExport status:', expR.status);
  console.log('Content-Disposition:', expR.headers['content-disposition']);

  if (expR.status === 200) {
    var expD = JSON.parse(expR.body);
    console.log('Total entries:', expD.total_entries);
    console.log('Client ID match:', expD.client_id === cId ? 'PASS' : 'FAIL');
    console.log('Has export_date:', !!expD.export_date ? 'PASS' : 'FAIL');

    var ok = expD.entries.every(function(e) {
      return e.content && e.content.indexOf('EXPORT_TEST_ENTRY_') >= 0;
    });
    console.log('All decrypted:', ok ? 'PASS' : 'FAIL');
    console.log('Filename ok:', (expR.headers['content-disposition'] || '').indexOf('diary_export') >= 0 ? 'PASS' : 'FAIL');
  } else {
    console.log('FAIL - body:', expR.body.substring(0, 300));
  }

  // 8. No-auth
  var noAuth = await req('GET', '/api/clients/' + cId + '/diary/export');
  console.log('No-auth 401:', noAuth.status === 401 ? 'PASS' : 'FAIL');

  console.log('\nDone!');
}

main().catch(function(e) { console.error('Error:', e.message); });
