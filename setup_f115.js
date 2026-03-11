var http = require('http');
function req(m,p,t,b,h){return new Promise(function(ok,no){var hd={'Content-Type':'application/json'};if(t)hd.Authorization='Bearer '+t;if(h)for(var k in h)if(h[k])hd[k]=h[k];var d=b?JSON.stringify(b):null;if(d)hd['Content-Length']=Buffer.byteLength(d);var r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:hd},function(rs){var x='';rs.on('data',function(c){x+=c});rs.on('end',function(){try{ok(JSON.parse(x))}catch(e){ok(x)}});});r.on('error',no);if(d)r.write(d);r.end();})}
async function main(){
  var c=await req('GET','/api/csrf-token');
  var csrf = c.csrfToken;
  // Login as sess_test_115 therapist
  var l=await req('POST','/api/auth/login',null,{email:'sess_test_115@test.com',password:'Test1234'},{['X-CSRF-Token']:csrf});
  if (!l.token) {
    console.log('Login failed, registering...');
    c=await req('GET','/api/csrf-token');
    l=await req('POST','/api/auth/register',null,{email:'sess_test_115@test.com',password:'Test1234'},{['X-CSRF-Token']:c.csrfToken});
  }
  var token = l.token;
  var me = await req('GET','/api/auth/me',token);
  console.log('Therapist:', me.user.id, me.user.email, 'invite:', me.user.invite_code);

  // Register a bot client with API key
  var botHeaders = {'X-Bot-Api-Key':'dev-bot-api-key'};
  var botClient = await req('POST','/api/bot/register',null,{telegram_id:'SESS_TEST_CL115',role:'client'},botHeaders);
  console.log('Bot client:', JSON.stringify(botClient));

  var connect = await req('POST','/api/bot/connect',null,{telegram_id:'SESS_TEST_CL115',invite_code:me.user.invite_code},botHeaders);
  console.log('Connect:', JSON.stringify(connect));

  var consent = await req('POST','/api/bot/consent',null,{telegram_id:'SESS_TEST_CL115',action:'accept'},botHeaders);
  console.log('Consent:', JSON.stringify(consent));

  var cl = await req('GET','/api/clients',token);
  console.log('Clients:', cl.total);
  if (cl.clients && cl.clients.length > 0) {
    console.log('Client ID:', cl.clients[0].id);
    // Check sessions for this client
    var sess = await req('GET','/api/clients/' + cl.clients[0].id + '/sessions',token);
    console.log('Sessions:', sess.total || 0);
  }
}
main().catch(function(e){console.log('ERR:'+e.message)});
