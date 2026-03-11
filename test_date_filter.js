const http = require('http');

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: Object.assign({}, headers),
      timeout: 15000
    };
    if (body) opts.headers['Content-Type'] = 'application/json';

    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  var ts = Date.now();

  console.log('Step 1: Register therapist');
  var r = await request('POST', '/api/auth/register', { email: 'dt' + ts + '@t.com', password: 'Test123!' });
  var token = r.body.token;
  var therapistId = r.body.user.id;
  console.log('  Therapist ID:', therapistId);

  console.log('Step 2: Get invite code');
  r = await request('GET', '/api/invite-code', null, { Authorization: 'Bearer ' + token });
  var inviteCode = r.body.invite_code;
  console.log('  Invite:', inviteCode);
  await sleep(300);

  console.log('Step 3: Register client via bot');
  var telegramId = 'DT' + ts;
  r = await request('POST', '/api/bot/register', { telegram_id: telegramId, role: 'client' }, { 'X-Bot-Api-Key': 'dev-bot-api-key' });
  console.log('  Client reg:', r.status);
  await sleep(300);

  console.log('Step 4: Connect and consent');
  r = await request('POST', '/api/bot/connect', { telegram_id: telegramId, invite_code: inviteCode }, { 'X-Bot-Api-Key': 'dev-bot-api-key' });
  console.log('  Connect:', r.status);
  await sleep(300);
  r = await request('POST', '/api/bot/consent', { telegram_id: telegramId, therapist_id: therapistId, consent: true }, { 'X-Bot-Api-Key': 'dev-bot-api-key' });
  console.log('  Consent:', r.status);
  await sleep(300);

  console.log('Step 5: Get client ID');
  r = await request('GET', '/api/bot/user/' + telegramId, null, { 'X-Bot-Api-Key': 'dev-bot-api-key' });
  var clientId = r.body.user.id;
  console.log('  Client ID:', clientId);

  console.log('Step 6: Create 4 diary entries');
  var entryIds = [];
  var entries = [
    { content: 'DATETEST_JAN feeling hopeful', date: '2026-01-15 12:00:00' },
    { content: 'DATETEST_FEB some anxiety', date: '2026-02-10 12:00:00' },
    { content: 'DATETEST_MAR_EARLY progress', date: '2026-03-05 12:00:00' },
    { content: 'DATETEST_MAR_LATE plans', date: '2026-03-10 12:00:00' }
  ];

  for (var i = 0; i < entries.length; i++) {
    r = await request('POST', '/api/bot/diary', {
      telegram_id: telegramId,
      content: entries[i].content,
      entry_type: 'text'
    }, { 'X-Bot-Api-Key': 'dev-bot-api-key' });
    console.log('  Entry:', r.status, 'id:', r.body.entry ? r.body.entry.id : 'unknown');
    if (r.body.entry) entryIds.push({ id: r.body.entry.id, date: entries[i].date });
    await sleep(300);
  }

  console.log('Step 6b: Update created_at timestamps via admin-like endpoint');
  for (var j = 0; j < entryIds.length; j++) {
    r = await request('POST', '/api/dev/update-diary-date', {
      entry_id: entryIds[j].id,
      created_at: entryIds[j].date
    });
    console.log('  Update entry', entryIds[j].id, 'to', entryIds[j].date, ':', r.status);
  }

  await sleep(500);

  console.log('\nStep 7: Test date filters');

  r = await request('GET', '/api/clients/' + clientId + '/diary', null, { Authorization: 'Bearer ' + token });
  console.log('All entries:', r.body.total);
  if (r.body.entries) r.body.entries.forEach(function(e) { console.log('  -', e.created_at, (e.content || '').substring(0, 40)); });

  r = await request('GET', '/api/clients/' + clientId + '/diary?date_from=2026-02-01&date_to=2026-02-28', null, { Authorization: 'Bearer ' + token });
  console.log('\nFeb only:', r.body.total, '(expect 1)');
  if (r.body.entries) r.body.entries.forEach(function(e) { console.log('  -', e.created_at, (e.content || '').substring(0, 40)); });

  r = await request('GET', '/api/clients/' + clientId + '/diary?date_from=2026-03-01', null, { Authorization: 'Bearer ' + token });
  console.log('\nMar+:', r.body.total, '(expect 2)');
  if (r.body.entries) r.body.entries.forEach(function(e) { console.log('  -', e.created_at, (e.content || '').substring(0, 40)); });

  r = await request('GET', '/api/clients/' + clientId + '/diary?date_to=2026-01-31', null, { Authorization: 'Bearer ' + token });
  console.log('\nUp to Jan:', r.body.total, '(expect 1)');
  if (r.body.entries) r.body.entries.forEach(function(e) { console.log('  -', e.created_at, (e.content || '').substring(0, 40)); });

  r = await request('GET', '/api/clients/' + clientId + '/diary?date_from=2025-01-01&date_to=2025-12-31', null, { Authorization: 'Bearer ' + token });
  console.log('\n2025 (expect 0):', r.body.total);

  console.log('\nPASS/FAIL SUMMARY:');
  console.log('Need to create dev endpoint to update dates - OR directly modify DB');
  console.log('Done. ClientID:', clientId, 'TherapistID:', therapistId);
}

main().catch(function(e) { console.error('ERROR:', e.message); });
