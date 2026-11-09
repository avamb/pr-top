const http = require('http');
function req(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(res, rej) {
    const opts = { hostname: 'localhost', port: 3001, path: path, method: method, headers: Object.assign({'Content-Type':'application/json'}, headers) };
    const r = http.request(opts, function(resp) {
      let d = '';
      resp.on('data', function(c) { d += c; });
      resp.on('end', function() {
        try { res({s: resp.statusCode, b: JSON.parse(d)}); }
        catch(e) { res({s: resp.statusCode, b: d}); }
      });
    });
    r.on('error', rej);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const tid = 'tg_debug_' + Date.now();
const BOT = {'X-Bot-API-Key': 'dev-bot-api-key'};

req('POST', '/api/bot/register', {telegram_id: tid, role: 'client', first_name: 'Debug', language: 'en'}, BOT)
.then(function(reg) {
  console.log('register:', reg.s, JSON.stringify(reg.b).slice(0, 150));
  return req('GET', '/api/csrf-token');
})
.then(function(csrf) {
  const csrfToken = csrf.b.csrfToken;
  return req('POST', '/api/auth/login', {email: 'admin@pr-top.com', password: 'Admin123!'}, {'X-CSRF-Token': csrfToken})
  .then(function(loginR) {
    console.log('admin login:', loginR.s);
    const therapistToken = loginR.b.token;
    return req('GET', '/api/invite-code', null, {'Authorization': 'Bearer ' + therapistToken});
  })
  .then(function(inviteR) {
    console.log('invite:', inviteR.s, inviteR.b.invite_code);
    const inviteCode = inviteR.b.invite_code;
    return req('POST', '/api/bot/connect', {telegram_id: tid, invite_code: inviteCode}, BOT);
  })
  .then(function(conn) {
    console.log('connect:', conn.s, JSON.stringify(conn.b).slice(0, 200));
    return req('POST', '/api/bot/consent', {telegram_id: tid, consent: true}, BOT);
  })
  .then(function(con) {
    console.log('consent:', con.s, JSON.stringify(con.b).slice(0, 300));
  });
})
.catch(function(e) { console.error(e); });
