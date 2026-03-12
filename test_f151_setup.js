var http = require('http');

function req(method, path, body, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {hostname:'localhost',port:3001,path:path,method:method,headers:headers||{}};
    var r = http.request(opts, function(res) {
      var b='';
      // Collect cookies
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
  console.log('CSRF:', csrf.data);
  var token = csrf.data.csrfToken;
  var cookie = csrf.cookies.map(function(c){return c.split(';')[0]}).join('; ');

  // Register
  var reg = await req('POST', '/api/auth/register', JSON.stringify({email:'test_f151@example.com',password:'Test1234',name:'Test F151'}), {
    'Content-Type':'application/json',
    'X-CSRF-Token': token,
    'Cookie': cookie
  });
  console.log('Register:', reg.status, reg.data);

  // Login if already registered
  if (reg.status !== 201 && reg.status !== 200) {
    var login = await req('POST', '/api/auth/login', JSON.stringify({email:'test_f151@example.com',password:'Test1234'}), {
      'Content-Type':'application/json',
      'X-CSRF-Token': token,
      'Cookie': cookie
    });
    console.log('Login:', login.status, login.data);
    var jwt = login.data.token;
  } else {
    var jwt = reg.data.token;
  }

  // Get clients
  var clients = await req('GET', '/api/clients', null, {
    'Authorization': 'Bearer ' + jwt
  });
  console.log('Clients:', clients.status, JSON.stringify(clients.data).substring(0,200));

  // If no clients, create one via invite flow
  if (!clients.data.clients || clients.data.clients.length === 0) {
    // Get invite code
    var invite = await req('GET', '/api/invite-code', null, {
      'Authorization': 'Bearer ' + jwt
    });
    console.log('Invite:', invite.data);

    // Register bot client
    var csrf2 = await req('GET', '/api/csrf-token', null, {});
    var token2 = csrf2.data.csrfToken;
    var cookie2 = csrf2.cookies.map(function(c){return c.split(';')[0]}).join('; ');

    var botReg = await req('POST', '/api/bot/register', JSON.stringify({
      telegram_id: 'f151_client_' + Date.now(),
      first_name: 'TestClient151'
    }), {
      'Content-Type':'application/json',
      'X-CSRF-Token': token2,
      'Cookie': cookie2
    });
    console.log('Bot register:', botReg.status, botReg.data);
    var clientToken = botReg.data.token;

    // Connect with invite code
    var connect = await req('POST', '/api/bot/connect', JSON.stringify({
      invite_code: invite.data.invite_code
    }), {
      'Content-Type':'application/json',
      'Authorization': 'Bearer ' + clientToken,
      'X-CSRF-Token': token2,
      'Cookie': cookie2
    });
    console.log('Connect:', connect.status, connect.data);

    // Give consent
    var consent = await req('POST', '/api/bot/consent', JSON.stringify({
      consent_given: true
    }), {
      'Content-Type':'application/json',
      'Authorization': 'Bearer ' + clientToken,
      'X-CSRF-Token': token2,
      'Cookie': cookie2
    });
    console.log('Consent:', consent.status, consent.data);

    // Re-fetch clients
    clients = await req('GET', '/api/clients', null, {
      'Authorization': 'Bearer ' + jwt
    });
    console.log('Clients after setup:', clients.data.clients ? clients.data.clients.length : 0);
  }

  if (clients.data.clients && clients.data.clients.length > 0) {
    console.log('CLIENT_ID=' + clients.data.clients[0].id);
  }
  console.log('JWT=' + jwt);
}

main().catch(function(e){console.error(e)});
