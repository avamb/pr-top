var http = require('http');

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

  // Step 1: Create therapist A
  var regA = await request('POST', '/api/auth/register', {
    email: 'therapist_a_29@test.com', password: 'Test123!', name: 'TherapistA'
  });
  console.log('1. Register Therapist A:', regA.status, '- id:', regA.body.user ? regA.body.user.id : 'exists');
  var tokenA = regA.body.token;

  // If already exists, login
  if (!tokenA) {
    var loginA = await request('POST', '/api/auth/login', {
      email: 'therapist_a_29@test.com', password: 'Test123!'
    });
    tokenA = loginA.body.token;
    console.log('   Logged in Therapist A instead');
  }

  // Step 2: Create therapist B
  var regB = await request('POST', '/api/auth/register', {
    email: 'therapist_b_29@test.com', password: 'Test123!', name: 'TherapistB'
  });
  console.log('2. Register Therapist B:', regB.status, '- id:', regB.body.user ? regB.body.user.id : 'exists');
  var tokenB = regB.body.token;

  if (!tokenB) {
    var loginB = await request('POST', '/api/auth/login', {
      email: 'therapist_b_29@test.com', password: 'Test123!'
    });
    tokenB = loginB.body.token;
    console.log('   Logged in Therapist B instead');
  }

  // Step 3: Get Therapist A's invite code
  var invA = await request('GET', '/api/invite-code', null, {
    'Authorization': 'Bearer ' + tokenA
  });
  console.log('3. Therapist A invite code:', invA.body.invite_code);

  // Step 4: Register client and link to therapist A
  var botHeaders = { 'Content-Type': 'application/json', 'X-Bot-Api-Key': 'dev-bot-api-key' };
  var clientReg = await request('POST', '/api/bot/register', {
    telegram_id: 'unauth_test_client_29', role: 'client', username: 'unauthclient29'
  }, botHeaders);
  var clientId = clientReg.body.user ? clientReg.body.user.id : null;
  console.log('4. Register client:', clientReg.status, '- id:', clientId);

  // Connect and consent
  await request('POST', '/api/bot/connect', {
    telegram_id: 'unauth_test_client_29', invite_code: invA.body.invite_code
  }, botHeaders);

  var meA = await request('GET', '/api/auth/me', null, { 'Authorization': 'Bearer ' + tokenA });
  var therapistAId = meA.body.id;

  await request('POST', '/api/bot/consent', {
    telegram_id: 'unauth_test_client_29', therapist_id: therapistAId, action: 'accept'
  }, botHeaders);
  console.log('   Client linked to Therapist A with consent');

  // Step 5: Client creates diary entry
  var diary = await request('POST', '/api/bot/diary', {
    telegram_id: 'unauth_test_client_29', content: 'PRIVATE_DIARY_29 This is confidential', entry_type: 'text'
  }, botHeaders);
  console.log('5. Diary entry created:', diary.status, '- id:', diary.body.entry ? diary.body.entry.id : 'err');

  // Step 6: Therapist A CAN access diary (sanity check)
  var diaryA = await request('GET', '/api/clients/' + clientId + '/diary', null, {
    'Authorization': 'Bearer ' + tokenA
  });
  console.log('6. Therapist A accesses diary:', diaryA.status, '- entries:', diaryA.body.entries ? diaryA.body.entries.length : 0);

  // Step 7: Therapist B attempts to access diary -> should get 403
  var diaryB = await request('GET', '/api/clients/' + clientId + '/diary', null, {
    'Authorization': 'Bearer ' + tokenB
  });
  console.log('7. Therapist B accesses diary:', diaryB.status, '- error:', diaryB.body.error || 'none');
  console.log('   Status is 403:', diaryB.status === 403);

  // Step 8: Verify no diary data returned to B
  var hasEntries = diaryB.body.entries && diaryB.body.entries.length > 0;
  console.log('8. No diary data returned to B:', !hasEntries);

  // Step 9: Verify audit log records access denial
  var adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@psylink.app', password: 'Admin123!'
  });
  var adminToken = adminLogin.body.token;

  var audit = await request('GET', '/api/admin/logs/audit?limit=10', null, {
    'Authorization': 'Bearer ' + adminToken
  });
  var denialLog = null;
  if (audit.body.logs) {
    denialLog = audit.body.logs.find(function(l) {
      return l.action === 'access_denied' && l.target_type === 'diary' && l.target_id === String(clientId);
    });
  }
  console.log('9. Audit log has access_denied entry:', !!denialLog);
  if (denialLog) {
    console.log('   Reason:', denialLog.details ? JSON.parse(denialLog.details).reason : 'unknown');
  }

  console.log('\n=== ALL CHECKS ===');
  console.log('403 for unauthorized:', diaryB.status === 403);
  console.log('No data leaked:', !hasEntries);
  console.log('Audit logged:', !!denialLog);
  console.log('Overall PASS:', diaryB.status === 403 && !hasEntries && !!denialLog);
}

main().catch(function(e) { console.error(e); process.exit(1); });
