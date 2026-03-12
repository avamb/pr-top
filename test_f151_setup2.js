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
  // Get CSRF token
  var csrf = await req('GET', '/api/csrf-token', null, {});
  var csrfToken = csrf.data.csrfToken;
  var cookie = csrf.cookies.map(function(c){return c.split(';')[0]}).join('; ');

  // Login
  var login = await req('POST', '/api/auth/login', JSON.stringify({email:'test_f151@example.com',password:'Test1234'}), {
    'Content-Type':'application/json',
    'X-CSRF-Token': csrfToken,
    'Cookie': cookie
  });
  var jwt = login.data.token;
  console.log('JWT=' + jwt);

  // Bot register with API key
  var botReg = await req('POST', '/api/bot/register', JSON.stringify({
    telegram_id: 'f151_client_' + Date.now(),
    first_name: 'TestClient151'
  }), {
    'Content-Type':'application/json',
    'X-Bot-API-Key': 'dev-bot-api-key',
    'X-CSRF-Token': csrfToken,
    'Cookie': cookie
  });
  console.log('Bot register:', botReg.status, botReg.data);
  var clientToken = botReg.data.token;

  // Get invite code
  var invite = await req('GET', '/api/invite-code', null, {
    'Authorization': 'Bearer ' + jwt
  });
  console.log('Invite:', invite.data.invite_code);

  // Connect
  var connect = await req('POST', '/api/bot/connect', JSON.stringify({
    invite_code: invite.data.invite_code
  }), {
    'Content-Type':'application/json',
    'Authorization': 'Bearer ' + clientToken,
    'X-Bot-API-Key': 'dev-bot-api-key',
    'X-CSRF-Token': csrfToken,
    'Cookie': cookie
  });
  console.log('Connect:', connect.status, connect.data);

  // Consent
  var consent = await req('POST', '/api/bot/consent', JSON.stringify({
    consent_given: true
  }), {
    'Content-Type':'application/json',
    'Authorization': 'Bearer ' + clientToken,
    'X-Bot-API-Key': 'dev-bot-api-key',
    'X-CSRF-Token': csrfToken,
    'Cookie': cookie
  });
  console.log('Consent:', consent.status, consent.data);

  // Get clients
  var clients = await req('GET', '/api/clients', null, {
    'Authorization': 'Bearer ' + jwt
  });
  console.log('Clients:', clients.data.clients ? clients.data.clients.length : 0);
  if (clients.data.clients && clients.data.clients.length > 0) {
    console.log('CLIENT_ID=' + clients.data.clients[0].id);
  }
}

main().catch(function(e){console.error(e)});
