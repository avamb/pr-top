var http = require('http');
function req(m,p,t,b,h){return new Promise(function(ok,no){var hd={'Content-Type':'application/json'};if(t)hd.Authorization='Bearer '+t;if(h)for(var k in h)if(h[k])hd[k]=h[k];var d=b?JSON.stringify(b):null;if(d)hd['Content-Length']=Buffer.byteLength(d);var r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:hd},function(rs){var x='';rs.on('data',function(c){x+=c});rs.on('end',function(){try{ok(JSON.parse(x))}catch(e){ok(x)}});});r.on('error',no);if(d)r.write(d);r.end();})}
async function main(){
  var c=await req('GET','/api/csrf-token');
  // Login as the first therapist to check
  var emails = ['therapist1@test.com','test_therapist@test.com','t1@test.com','therapist@test.com'];
  for (var i = 0; i < emails.length; i++) {
    var l=await req('POST','/api/auth/login',null,{email:emails[i],password:'Test1234'},{['X-CSRF-Token']:c.csrfToken});
    if (l.token) {
      var clients = await req('GET','/api/clients',l.token);
      console.log(emails[i], 'has', clients.total, 'clients');
    }
  }
  // Also try the register flow - register a fresh one and create a client for session test
  c=await req('GET','/api/csrf-token');
  var reg=await req('POST','/api/auth/register',null,{email:'sess_test_115@test.com',password:'Test1234'},{['X-CSRF-Token']:c.csrfToken});
  console.log('Registered:', reg.user ? reg.user.email : reg.error);
  if (reg.token) {
    // Create a client via bot API and link to this therapist
    var me = await req('GET','/api/auth/me',reg.token);
    console.log('New therapist id:', me.user.id, 'invite:', me.user.invite_code);
    // Register a bot client
    var botClient = await req('POST','/api/bot/register',null,{telegram_id:'SESS_TEST_CLIENT_115',role:'client'});
    console.log('Bot client:', JSON.stringify(botClient));
    // Connect
    var connect = await req('POST','/api/bot/connect',null,{telegram_id:'SESS_TEST_CLIENT_115',invite_code:me.user.invite_code});
    console.log('Connect:', JSON.stringify(connect));
    // Consent
    var consent = await req('POST','/api/bot/consent',null,{telegram_id:'SESS_TEST_CLIENT_115',action:'accept'});
    console.log('Consent:', JSON.stringify(consent));
    // Get clients
    var cl = await req('GET','/api/clients',reg.token);
    console.log('Clients:', cl.total, cl.clients ? cl.clients.map(function(c){return {id:c.id,tg:c.telegram_id}}) : []);
  }
}
main().catch(function(e){console.log('ERR:'+e.message)});
