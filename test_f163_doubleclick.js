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
  var reg = await postWithCSRF('/api/auth/register', { email: 'f163_test@test.com', password: 'TestPass1' });
  if (reg.status !== 201 && reg.status !== 200) {
    reg = await postWithCSRF('/api/auth/login', { email: 'f163_test@test.com', password: 'TestPass1' });
  }
  console.log('Auth:', reg.status);
  var token = reg.body.token;

  // Get invite code
  var inv = await getAuth('/api/invite-code', token);
  console.log('Invite code:', inv.body.invite_code);

  // Register and link client
  await postBot('/api/bot/register', { telegram_id: 'f163_client', role: 'client' });
  var cn = await postBot('/api/bot/connect', { telegram_id: 'f163_client', invite_code: inv.body.invite_code });
  var therapistId = cn.body.therapist.id;
  await postBot('/api/bot/consent', { telegram_id: 'f163_client', therapist_id: therapistId, consent: true });

  // Get client list
  var cl = await getAuth('/api/clients', token);
  var cid = cl.body.clients[0].id;
  console.log('ClientID:', cid);

  // Check initial notes count
  var notes = await getAuth('/api/clients/' + cid + '/notes', token);
  console.log('Initial notes count:', notes.body.notes ? notes.body.notes.length : 0);
  console.log('TOKEN:', token);
  console.log('CLIENT_ID:', cid);
}

main().catch(function(e) { console.error(e); });
