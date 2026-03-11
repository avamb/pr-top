// Test Feature #15: Therapist onboarding flow via Telegram bot
var http = require('http');

function req(method, p, data, extra) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: p, method: method,
      headers: Object.assign({ 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' }, extra || {})
    };
    var r = http.request(opts, function(res) {
      var body = '';
      res.on('data', function(d) { body += d; });
      res.on('end', function() {
        try { resolve({ s: res.statusCode, d: JSON.parse(body) }); }
        catch (e) { resolve({ s: res.statusCode, d: body }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

async function main() {
  console.log('=== Feature #15: Therapist Onboarding via Telegram ===\n');
  var ts = Date.now();
  var telegramId = 'therapist_onboard_' + ts;

  // Step 1: Send /start and select therapist role (simulated by calling bot/register)
  console.log('Step 1: Register as therapist via /start...');
  var r1 = await req('POST', '/api/bot/register', { telegram_id: telegramId, role: 'therapist' });
  console.log('  Status:', r1.s);
  console.log('  Response:', JSON.stringify(r1.d));

  var check1 = r1.s === 201 || r1.s === 200;
  console.log('  PASS: Registration successful:', check1);

  // Step 2: Verify welcome message components (invite code generated)
  var hasInviteCode = r1.d.user && r1.d.user.invite_code && r1.d.user.invite_code.length > 0;
  console.log('\nStep 2: Invite code generated automatically:', hasInviteCode);
  if (hasInviteCode) console.log('  Invite code:', r1.d.user.invite_code);

  // Step 3: Verify therapist record in database via lookup
  console.log('\nStep 3: Verify therapist record in database...');
  var r2 = await req('GET', '/api/bot/user/' + telegramId);
  console.log('  Lookup status:', r2.s);
  console.log('  User data:', JSON.stringify(r2.d));
  var userInDb = r2.s === 200 && r2.d.user && r2.d.user.role === 'therapist';
  console.log('  PASS: Therapist in DB:', userInDb);

  // Step 4: Verify invite code is present
  var inviteInDb = r2.d.user && r2.d.user.invite_code && r2.d.user.invite_code.length > 0;
  console.log('  PASS: Invite code in DB:', inviteInDb);

  // Step 5: Verify repeated /start returns already-exists
  console.log('\nStep 4: Repeated /start (already registered)...');
  var r3 = await req('POST', '/api/bot/register', { telegram_id: telegramId, role: 'therapist' });
  console.log('  Status:', r3.s);
  var alreadyExisted = r3.d.already_existed === true;
  console.log('  PASS: Already existed flag:', alreadyExisted);

  // Step 6: Verify therapist data is correct
  var correctRole = r2.d.user.role === 'therapist';
  var hasTelegramId = r2.d.user.telegram_id === telegramId;
  var hasCreatedAt = r2.d.user.created_at && r2.d.user.created_at.length > 0;
  console.log('\nVerification:');
  console.log('  Role correct (therapist):', correctRole);
  console.log('  Telegram ID matches:', hasTelegramId);
  console.log('  Created timestamp:', hasCreatedAt);

  console.log('\n=== RESULT ===');
  var pass = check1 && hasInviteCode && userInDb && inviteInDb && alreadyExisted && correctRole && hasTelegramId;
  console.log('ALL PASSED:', pass);
  process.exit(pass ? 0 : 1);
}

main().catch(function(e) { console.error('ERR:', e.message); process.exit(1); });
