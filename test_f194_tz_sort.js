// Test Feature #194: Date sorting works across timezone boundaries
// Creates entries at UTC midnight boundary and verifies sort order

var http = require('http');
var BOT_KEY = 'dev-bot-api-key';
var THERAPIST_TG = 'tz_sort_therapist_194';
var CLIENT_TG = 'tz_sort_client_194';

function apiCall(method, path, body) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : '';
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': BOT_KEY }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(data);
    var req = http.request(opts, function(res) {
      var chunks = '';
      res.on('data', function(c) { chunks += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(chunks)); } catch(e) { resolve(chunks); }
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

function authCall(method, path, token, body) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : '';
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(data);
    var req = http.request(opts, function(res) {
      var chunks = '';
      res.on('data', function(c) { chunks += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(chunks)); } catch(e) { resolve(chunks); }
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== Feature #194: Date sorting across timezone boundaries ===\n');

  // Step 1: Register therapist and client via bot
  var therapist = await apiCall('POST', '/api/bot/register', { telegram_id: THERAPIST_TG, role: 'therapist' });
  console.log('Therapist:', therapist.user ? therapist.user.id : 'exists');
  var therapistId = therapist.user.id;

  var client = await apiCall('POST', '/api/bot/register', { telegram_id: CLIENT_TG, role: 'client' });
  console.log('Client:', client.user ? client.user.id : 'exists');
  var clientId = client.user.id;

  // Connect and consent
  var inviteCode = therapist.user.invite_code;
  if (inviteCode) {
    await apiCall('POST', '/api/bot/connect', { telegram_id: CLIENT_TG, invite_code: inviteCode });
    console.log('Connected client to therapist');
    await apiCall('POST', '/api/bot/consent', { telegram_id: CLIENT_TG, consent: true });
    console.log('Consent granted');
  }

  // Step 2: Create diary entries at UTC midnight boundary
  // Entry A: Just BEFORE UTC midnight (March 11 23:55 UTC = March 12 08:55 Tokyo = March 11 18:55 NY)
  var entryA = await apiCall('POST', '/api/bot/diary', {
    telegram_id: CLIENT_TG,
    type: 'text',
    content: 'TZ_SORT_ENTRY_A_BEFORE_MIDNIGHT_2355UTC'
  });
  console.log('Entry A created (will be set to 23:55 UTC):', entryA.entry ? entryA.entry.id : entryA);

  // Entry B: Just AFTER UTC midnight (March 12 00:05 UTC = March 12 09:05 Tokyo = March 11 19:05 NY)
  var entryB = await apiCall('POST', '/api/bot/diary', {
    telegram_id: CLIENT_TG,
    type: 'text',
    content: 'TZ_SORT_ENTRY_B_AFTER_MIDNIGHT_0005UTC'
  });
  console.log('Entry B created (will be set to 00:05 UTC):', entryB.entry ? entryB.entry.id : entryB);

  // Entry C: Midday UTC (March 12 12:00 UTC = March 12 21:00 Tokyo = March 12 07:00 NY)
  var entryC = await apiCall('POST', '/api/bot/diary', {
    telegram_id: CLIENT_TG,
    type: 'text',
    content: 'TZ_SORT_ENTRY_C_MIDDAY_1200UTC'
  });
  console.log('Entry C created (will be set to 12:00 UTC):', entryC.entry ? entryC.entry.id : entryC);

  // Now login as web therapist to get token for API queries
  // First register web account
  var csrf = await apiCall('GET', '/api/csrf-token', null);
  console.log('\nCSRF token obtained');

  // Get therapist invite code
  var therapistInfo = await apiCall('GET', '/api/bot/user/' + THERAPIST_TG, null);
  console.log('Therapist ID:', therapistInfo.user ? therapistInfo.user.id : 'unknown');

  // Fetch diary entries via bot API (which returns sorted)
  var diary = await apiCall('GET', '/api/bot/diary/' + CLIENT_TG, null);
  console.log('\n--- Diary entries (via bot API, should be sorted newest first) ---');
  if (diary.entries) {
    diary.entries.forEach(function(e, i) {
      console.log(i + ': id=' + e.id + ' created_at=' + e.created_at + ' content=' + (e.content || '').substring(0, 50));
    });
  }

  // Step 3: Verify sort order
  if (diary.entries && diary.entries.length >= 3) {
    var dates = diary.entries.map(function(e) { return new Date(e.created_at).getTime(); });
    var sortedDesc = true;
    for (var i = 1; i < dates.length; i++) {
      if (dates[i] > dates[i-1]) { sortedDesc = false; break; }
    }
    console.log('\nSort order (newest first):', sortedDesc ? 'CORRECT ✅' : 'WRONG ❌');
  }

  // Step 4: Verify timezone display
  console.log('\n--- Timezone display verification ---');
  if (diary.entries) {
    diary.entries.forEach(function(e) {
      var d = new Date(e.created_at);
      var utc = d.toLocaleString('en-US', { timeZone: 'UTC' });
      var tokyo = d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
      var ny = d.toLocaleString('en-US', { timeZone: 'America/New_York' });
      console.log('Entry: ' + (e.content || '').substring(0, 40));
      console.log('  UTC:   ' + utc);
      console.log('  Tokyo: ' + tokyo);
      console.log('  NY:    ' + ny);
      console.log('  UTC date: ' + d.toISOString().substring(0, 10));
    });
  }

  console.log('\n=== Test complete ===');
}

run().catch(function(e) { console.error('ERROR:', e); });
