var http = require('http');

function req(method, path, body, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {hostname:'localhost',port:3001,path:path,method:method,headers:headers||{}};
    var r = http.request(opts, function(res) {
      var b='';
      var cookies = res.headers['set-cookie'] || [];
      res.on('data',function(c){b+=c});
      res.on('end',function(){
        try { resolve({status:res.statusCode,data:JSON.parse(b),cookies:cookies}); }
        catch(e) { resolve({status:res.statusCode,data:b,cookies:cookies}); }
      });
    });
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

async function main() {
  var csrf = await req('GET', '/api/csrf-token', null, {});
  var csrfToken = csrf.data.csrfToken;
  var cookie = csrf.cookies.map(function(c){return c.split(';')[0]}).join('; ');

  var login = await req('POST', '/api/auth/login', JSON.stringify({email:'test_f151@example.com',password:'Test1234'}), {
    'Content-Type':'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': cookie
  });
  var jwt = login.data.token;

  var tid = 'f151_cl_' + Date.now();
  var botReg = await req('POST', '/api/bot/register', JSON.stringify({
    telegram_id: tid, first_name: 'TestClient151', role: 'client'
  }), {
    'Content-Type':'application/json', 'X-Bot-API-Key': 'dev-bot-api-key', 'X-CSRF-Token': csrfToken, 'Cookie': cookie
  });
  console.log('Bot register:', botReg.status);
  var clientToken = botReg.data.token;

  var invite = await req('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + jwt });

  var connect = await req('POST', '/api/bot/connect', JSON.stringify({
    invite_code: invite.data.invite_code, telegram_id: tid
  }), {
    'Content-Type':'application/json', 'X-Bot-API-Key': 'dev-bot-api-key', 'X-CSRF-Token': csrfToken, 'Cookie': cookie
  });
  console.log('Connect:', connect.status, connect.data);

  var consent = await req('POST', '/api/bot/consent', JSON.stringify({
    consent_given: true, telegram_id: tid, therapist_id: 567
  }), {
    'Content-Type':'application/json', 'X-Bot-API-Key': 'dev-bot-api-key', 'X-CSRF-Token': csrfToken, 'Cookie': cookie
  });
  console.log('Consent:', consent.status, consent.data);

  var clients = await req('GET', '/api/clients', null, { 'Authorization': 'Bearer ' + jwt });
  console.log('Clients:', clients.data.clients ? clients.data.clients.length : 0);
  if (clients.data.clients && clients.data.clients.length > 0) {
    console.log('CLIENT_ID=' + clients.data.clients[0].id);
  }
  console.log('JWT=' + jwt);
}

main().catch(function(e){console.error(e)});
