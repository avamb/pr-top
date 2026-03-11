var http = require('http');

function fetch(url, opts) {
  opts = opts || {};
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
    };
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function json(r) { return JSON.parse(r.body); }

var BASE = 'http://localhost:3001/api';
var BOT = { 'x-bot-api-key': 'dev-bot-api-key' };
var tid = 'REPEAT_START_' + Date.now();
var passed = true;

// Step 1: Initial registration as client
fetch(BASE + '/bot/register', { method: 'POST', body: JSON.stringify({ telegram_id: tid, role: 'client', display_name: 'Repeat Start Test' }), headers: BOT })
.then(function(r) {
  var d = json(r);
  console.log('1. Initial register:', r.status);
  console.log('   already_existed:', d.already_existed);
  console.log('   user role:', d.user.role);
  console.log('   user id:', d.user.id);
  if (d.already_existed !== false) { console.log('   FAIL: should be new user'); passed = false; }
  if (d.user.role !== 'client') { console.log('   FAIL: role should be client'); passed = false; }
  var firstId = d.user.id;

  // Step 2: Send /start again (re-register same telegram_id as client)
  return fetch(BASE + '/bot/register', { method: 'POST', body: JSON.stringify({ telegram_id: tid, role: 'client', display_name: 'Repeat Start Test' }), headers: BOT })
  .then(function(r2) {
    var d2 = json(r2);
    console.log('\n2. Repeat register (same role):', r2.status);
    console.log('   already_existed:', d2.already_existed);
    console.log('   user role:', d2.user.role);
    console.log('   user id:', d2.user.id);
    if (d2.already_existed !== true) { console.log('   FAIL: should already exist'); passed = false; }
    if (d2.user.id !== firstId) { console.log('   FAIL: should be same user ID'); passed = false; }
    if (d2.user.role !== 'client') { console.log('   FAIL: role should still be client'); passed = false; }

    // Step 3: Try to register same telegram_id as therapist
    return fetch(BASE + '/bot/register', { method: 'POST', body: JSON.stringify({ telegram_id: tid, role: 'therapist', display_name: 'Repeat Start Test' }), headers: BOT });
  })
  .then(function(r3) {
    var d3 = json(r3);
    console.log('\n3. Repeat register (different role):', r3.status);
    console.log('   already_existed:', d3.already_existed);
    console.log('   user role:', d3.user.role);
    console.log('   user id:', d3.user.id);
    if (d3.already_existed !== true) { console.log('   FAIL: should already exist'); passed = false; }
    if (d3.user.id !== firstId) { console.log('   FAIL: should be same user ID, no duplicate'); passed = false; }
    if (d3.user.role !== 'client') { console.log('   FAIL: original role should be preserved'); passed = false; }

    // Step 4: Test therapist repeated /start
    var therapistTid = 'REPEAT_THERAPIST_' + Date.now();
    return fetch(BASE + '/bot/register', { method: 'POST', body: JSON.stringify({ telegram_id: therapistTid, role: 'therapist', display_name: 'Repeat Therapist' }), headers: BOT })
    .then(function(r4) {
      var d4 = json(r4);
      console.log('\n4. Register therapist:', r4.status);
      console.log('   invite_code:', d4.user.invite_code);
      var therapistId = d4.user.id;
      var inviteCode = d4.user.invite_code;

      return fetch(BASE + '/bot/register', { method: 'POST', body: JSON.stringify({ telegram_id: therapistTid, role: 'therapist', display_name: 'Repeat Therapist' }), headers: BOT });
    })
    .then(function(r5) {
      var d5 = json(r5);
      console.log('\n5. Repeat therapist /start:', r5.status);
      console.log('   already_existed:', d5.already_existed);
      console.log('   user role:', d5.user.role);
      if (d5.already_existed !== true) { console.log('   FAIL: should already exist'); passed = false; }
      if (d5.user.role !== 'therapist') { console.log('   FAIL: role should be therapist'); passed = false; }

      // Step 5: Verify user profile endpoint also works
      return fetch(BASE + '/bot/user/' + tid, { headers: BOT });
    })
    .then(function(r6) {
      var d6 = json(r6);
      console.log('\n6. User profile check:', r6.status);
      console.log('   role:', d6.user && d6.user.role);
      console.log('   id:', d6.user && d6.user.id);
      if (d6.user && d6.user.id !== firstId) { console.log('   FAIL: should still be same user'); passed = false; }

      if (passed) {
        console.log('\n=== ALL FEATURE #50 TESTS PASSED ===');
      } else {
        console.log('\n=== SOME TESTS FAILED ===');
      }
    });
  });
})
.catch(function(e) { console.error('ERROR:', e.message); });
