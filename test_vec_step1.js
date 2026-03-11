// Step 1: Setup therapist + client, get them linked
var http = require('http');
var fs = require('fs');
var path = require('path');

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
  var ts = Date.now();

  // Register therapist
  var r1 = await req('POST', '/api/auth/register', {
    email: 'vt' + ts + '@t.com', password: 'TestPass123', confirm_password: 'TestPass123'
  });
  console.log('register:', r1.s);
  var token = r1.d.token;
  var therapistUserId = r1.d.user ? r1.d.user.id : 'unknown';
  console.log('therapist user:', JSON.stringify(r1.d.user || r1.d));

  // Register client
  var tid = 'vc' + ts;
  var r2 = await req('POST', '/api/bot/register', { telegram_id: tid, role: 'client' }, null, BH);
  console.log('bot reg:', r2.s, JSON.stringify(r2.d));

  // Get invite
  var r3 = await req('GET', '/api/invite-code', null, token);
  console.log('invite:', JSON.stringify(r3.d));

  // Connect
  var r4 = await req('POST', '/api/bot/connect', { telegram_id: tid, invite_code: r3.d.invite_code }, null, BH);
  console.log('connect:', r4.s, JSON.stringify(r4.d));

  // Consent - use therapist_id from connect response
  var thId = r4.d.therapist_id || (r4.d.therapist && r4.d.therapist.id) || therapistUserId;
  console.log('using therapist_id for consent:', thId);
  var r5 = await req('POST', '/api/bot/consent', { telegram_id: tid, therapist_id: thId, consent: true }, null, BH);
  console.log('consent:', r5.s, JSON.stringify(r5.d));

  // Get clients
  var r6 = await req('GET', '/api/clients', null, token);
  console.log('clients:', r6.s, JSON.stringify(r6.d));

  // Write state to file for step 2
  if (r6.d.clients && r6.d.clients.length > 0) {
    var state = { token: token, clientId: r6.d.clients[0].id };
    fs.writeFileSync('test_vec_state.json', JSON.stringify(state));
    console.log('STATE SAVED:', JSON.stringify(state));
  }
}

main().catch(function(e) { console.error('ERR:', e.message); process.exit(1); });
