var http = require('http');
var TS = Date.now();

function request(method, path, body, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: headers || { 'Content-Type': 'application/json' }
    };
    var req = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Feature #29: Unauthorized therapist cannot access client diary ===\n');
  var botH = { 'Content-Type': 'application/json', 'X-Bot-Api-Key': 'dev-bot-api-key' };

  // Step 1: Create therapist A (unique)
  var regA = await request('POST', '/api/auth/register', {
    email: 'thA_' + TS + '@test.com', password: 'Test123!', name: 'TherapistA'
  });
  var tokenA = regA.body.token;
  var idA = regA.body.user.id;
  console.log('1. Therapist A: id=' + idA + ' (type=' + typeof idA + ')');

  // Step 2: Create therapist B (unique)
  var regB = await request('POST', '/api/auth/register', {
    email: 'thB_' + TS + '@test.com', password: 'Test123!', name: 'TherapistB'
  });
  var tokenB = regB.body.token;
  var idB = regB.body.user.id;
  console.log('2. Therapist B: id=' + idB);

  // Step 3: Get Therapist A's invite code
  var invA = await request('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + tokenA });
  console.log('3. Therapist A invite code:', invA.body.invite_code);

  // Step 4: Register client and link to therapist A
  var clientTgId = 'client_29_' + TS;
  var clientReg = await request('POST', '/api/bot/register', {
    telegram_id: clientTgId, role: 'client', username: 'c29_' + TS
  }, botH);
  var clientId = clientReg.body.user.id;
  console.log('4. Client: id=' + clientId);

  // Connect and consent
  await request('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: invA.body.invite_code }, botH);
  await request('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: idA, action: 'accept' }, botH);
  console.log('   Client linked to Therapist A with consent');

  // Step 5: Client creates diary entry
  var diary = await request('POST', '/api/bot/diary', {
    telegram_id: clientTgId, content: 'PRIVATE_DIARY_29_' + TS + ' confidential data', entry_type: 'text'
  }, botH);
  console.log('5. Diary entry created: id=' + (diary.body.entry ? diary.body.entry.id : 'err'));

  // Step 6: Therapist A CAN access diary (sanity check)
  var diaryA = await request('GET', '/api/clients/' + clientId + '/diary', null, {
    'Authorization': 'Bearer ' + tokenA
  });
  console.log('6. Therapist A diary access: status=' + diaryA.status + ' entries=' + (diaryA.body.entries ? diaryA.body.entries.length : 'none'));

  // Step 7: Therapist B attempts to access diary -> should get 403
  var diaryB = await request('GET', '/api/clients/' + clientId + '/diary', null, {
    'Authorization': 'Bearer ' + tokenB
  });
  console.log('7. Therapist B diary access: status=' + diaryB.status + ' error=' + (diaryB.body.error || 'none'));

  // Step 8: Verify no diary data returned to B
  var hasEntries = diaryB.body.entries && diaryB.body.entries.length > 0;
  console.log('8. No data leaked to B: ' + !hasEntries);

  // Step 9: Check audit log
  var adminLogin = await request('POST', '/api/auth/login', { email: 'admin@psylink.app', password: 'Admin123!' });
  var adminToken = adminLogin.body.token;
  var audit = await request('GET', '/api/admin/logs/audit?action=access_denied&per_page=100', null, {
    'Authorization': 'Bearer ' + adminToken
  });
  var denialLog = null;
  if (audit.body.logs) {
    denialLog = audit.body.logs.find(function(l) {
      return l.action === 'access_denied' && l.target_type === 'diary' &&
             (l.target_id == clientId || String(l.target_id) === String(clientId));
    });
  }
  console.log('9. Audit log has access_denied: ' + !!denialLog);
  if (denialLog) {
    console.log('   Details:', denialLog.details);
  }

  // Debug info
  if (!denialLog && audit.body.logs) {
    console.log('   Recent access_denied logs (last 5):');
    audit.body.logs.filter(function(l) { return l.action === 'access_denied'; }).slice(0, 5).forEach(function(l) {
      console.log('     target_type=' + l.target_type + ' target_id=' + l.target_id + ' (' + typeof l.target_id + ') actor=' + l.actor_id);
    });
    console.log('   Looking for client_id=' + clientId + ' (' + typeof clientId + ')');
  }

  console.log('\n=== RESULTS ===');
  console.log('Therapist A gets 200: ' + (diaryA.status === 200));
  console.log('Therapist B gets 403: ' + (diaryB.status === 403));
  console.log('No data leaked: ' + !hasEntries);
  console.log('Audit logged: ' + !!denialLog);
  var pass = diaryA.status === 200 && diaryB.status === 403 && !hasEntries && !!denialLog;
  console.log('Overall: ' + (pass ? 'PASS' : 'FAIL'));
}

main().catch(function(e) { console.error(e); process.exit(1); });
