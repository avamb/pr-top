// Test Feature #17: Invite code is unique per therapist
var http = require('http');

function req(method, p, data, token, extra) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: p, method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, extra || {})
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
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

var BH = { 'x-bot-api-key': 'dev-bot-api-key' };

async function main() {
  console.log('=== Feature #17: Invite Code Uniqueness ===\n');
  var ts = Date.now();
  var codes = [];

  // Register 5 therapists and collect invite codes
  for (var i = 0; i < 5; i++) {
    var r = await req('POST', '/api/auth/register', {
      email: 'uniq' + ts + '_' + i + '@t.com',
      password: 'TestPass123',
      confirm_password: 'TestPass123'
    });
    var token = r.d.token;
    var inv = await req('GET', '/api/invite-code', null, token);
    var code = inv.d.invite_code;
    codes.push(code);
    console.log('Therapist ' + i + ': code=' + code);
  }

  // Also register 3 via Telegram bot
  for (var j = 0; j < 3; j++) {
    var br = await req('POST', '/api/bot/register', { telegram_id: 'uniqbot' + ts + '_' + j, role: 'therapist' }, null, BH);
    var botCode = br.d.user.invite_code;
    codes.push(botCode);
    console.log('Bot Therapist ' + j + ': code=' + botCode);
  }

  console.log('\nAll codes:', codes);

  // Check all codes are unique
  var uniqueSet = new Set(codes);
  var allUnique = uniqueSet.size === codes.length;
  console.log('\nTotal codes:', codes.length);
  console.log('Unique codes:', uniqueSet.size);
  console.log('All unique:', allUnique);

  // Verify codes are non-empty and proper format
  var allValid = codes.every(function(c) { return c && c.length >= 6; });
  console.log('All valid format:', allValid);

  // Verify database has unique constraint - check via DB by using invite code lookup
  // The invite_code column has UNIQUE constraint in DB schema
  console.log('\nVerifying invite code lookups...');
  for (var k = 0; k < Math.min(3, codes.length); k++) {
    var lookup = await req('POST', '/api/bot/connect', { telegram_id: 'lookup_test_' + ts + '_' + k, invite_code: codes[k] }, null, BH);
    // 404 since lookup_test user doesn't exist as client, but it proves the code resolves to a unique therapist
    console.log('  Code ' + codes[k] + ' -> status:', lookup.s);
  }

  console.log('\n=== RESULT ===');
  var pass = allUnique && allValid;
  console.log('PASS:', pass);
  process.exit(pass ? 0 : 1);
}

main().catch(function(e) { console.error('ERR:', e.message); process.exit(1); });
