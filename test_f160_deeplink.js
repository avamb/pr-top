var http = require('http');

function request(method, p, b, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: '127.0.0.1', port: 3001, path: p, method: method,
      headers: headers || {}
    };
    var d = null;
    if (b) {
      d = JSON.stringify(b);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(d);
    }
    var q = http.request(opts, function(s) {
      var cookies = s.headers['set-cookie'] || [];
      var x = '';
      s.on('data', function(c) { x += c; });
      s.on('end', function() {
        var body;
        try { body = JSON.parse(x); } catch(e) { body = x; }
        resolve({ status: s.statusCode, body: body, cookies: cookies });
      });
    });
    q.on('error', reject);
    if (d) q.write(d);
    q.end();
  });
}

var csrfToken = '';
var csrfCookie = '';

async function getCSRF() {
  var res = await request('GET', '/api/csrf-token');
  csrfToken = res.body.csrfToken;
  if (res.cookies.length > 0) {
    csrfCookie = res.cookies.map(function(c) { return c.split(';')[0]; }).join('; ');
  }
}

async function postWithCSRF(p, b, authToken) {
  await getCSRF();
  var hdrs = { 'x-csrf-token': csrfToken, 'Cookie': csrfCookie };
  if (authToken) hdrs['Authorization'] = 'Bearer ' + authToken;
  return request('POST', p, b, hdrs);
}

async function postBot(p, b) {
  await getCSRF();
  var hdrs = { 'x-bot-api-key': 'dev-bot-api-key', 'x-csrf-token': csrfToken, 'Cookie': csrfCookie };
  return request('POST', p, b, hdrs);
}

async function getAuth(p, t) {
  return request('GET', p, null, { 'Authorization': 'Bearer ' + t });
}

async function main() {
  // Register therapist
  var reg = await postWithCSRF('/api/auth/register', { email: 'f160_test_v5@test.com', password: 'TestPass1' });
  if (reg.status !== 201 && reg.status !== 200) {
    reg = await postWithCSRF('/api/auth/login', { email: 'f160_test_v5@test.com', password: 'TestPass1' });
  }
  console.log('Auth:', reg.status);
  var token = reg.body.token;

  // Get invite code
  var inv = await getAuth('/api/invite-code', token);
  console.log('Invite code:', inv.body.invite_code);

  // Register client via bot
  var br = await postBot('/api/bot/register', { telegram_id: 'f160_bot_v5', role: 'client' });
  console.log('Bot reg:', br.status, JSON.stringify(br.body));

  // Connect client to therapist
  var cn = await postBot('/api/bot/connect', { telegram_id: 'f160_bot_v5', invite_code: inv.body.invite_code });
  console.log('Connect:', cn.status, JSON.stringify(cn.body));

  // Accept consent (need therapist_id from connect response)
  var therapistId = cn.body.therapist.id;
  var cs = await postBot('/api/bot/consent', { telegram_id: 'f160_bot_v5', therapist_id: therapistId, consent: true });
  console.log('Consent:', cs.status, JSON.stringify(cs.body));

  // Get client list to find client ID
  var cl = await getAuth('/api/clients', token);
  console.log('Clients:', cl.status, 'count:', cl.body.clients ? cl.body.clients.length : 0);

  if (!cl.body.clients || cl.body.clients.length === 0) {
    console.log('No clients found. Aborting.');
    return;
  }

  var cid = cl.body.clients[0].id;
  console.log('ClientID:', cid);

  // Verify we can access client detail before revoke
  var d1 = await getAuth('/api/clients/' + cid, token);
  console.log('Before revoke:', d1.status, '(expect 200)');

  // Revoke consent
  var rv = await postBot('/api/bot/revoke-consent', { telegram_id: 'f160_bot_v5' });
  console.log('Revoke:', rv.status, JSON.stringify(rv.body));

  // Try to access client detail after revoke - should be 404
  var d2 = await getAuth('/api/clients/' + cid, token);
  console.log('After revoke:', d2.status, JSON.stringify(d2.body), '(expect 404)');

  console.log('\nBROWSER TEST:');
  console.log('URL: /clients/' + cid);
  console.log('TOKEN: ' + token);

  // Summary
  console.log('\nRESULTS:');
  console.log('Pre-revoke access: ' + (d1.status === 200 ? 'PASS' : 'FAIL'));
  console.log('Post-revoke blocked: ' + (d2.status === 404 ? 'PASS' : 'FAIL'));
}

main().catch(function(e) { console.error(e); });
