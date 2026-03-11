var http = require('http');
function req(m,p,t,b,h){return new Promise(function(ok,no){var hd={'Content-Type':'application/json'};if(t)hd.Authorization='Bearer '+t;if(h)for(var k in h)if(h[k])hd[k]=h[k];var d=b?JSON.stringify(b):null;if(d)hd['Content-Length']=Buffer.byteLength(d);var r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:hd},function(rs){var x='';rs.on('data',function(c){x+=c});rs.on('end',function(){try{ok(JSON.parse(x))}catch(e){ok(x)}});});r.on('error',no);if(d)r.write(d);r.end();})}
async function main(){
  var c=await req('GET','/api/csrf-token');
  var l=await req('POST','/api/auth/login',null,{email:'sess_test_115@test.com',password:'Test1234'},{['X-CSRF-Token']:c.csrfToken});
  var token = l.token;

  // Get invite code via dedicated endpoint
  var inv = await req('GET','/api/invite-code',token);
  console.log('Invite code:', inv.invite_code);

  // Connect bot client
  var botHeaders = {'X-Bot-Api-Key':'dev-bot-api-key'};
  var connect = await req('POST','/api/bot/connect',null,{telegram_id:'SESS_TEST_CL115',invite_code:inv.invite_code},botHeaders);
  console.log('Connect:', JSON.stringify(connect));

  if (connect.requires_consent) {
    var consent = await req('POST','/api/bot/consent',null,{telegram_id:'SESS_TEST_CL115',action:'accept'},botHeaders);
    console.log('Consent:', JSON.stringify(consent));
  }

  var cl = await req('GET','/api/clients',token);
  console.log('Clients:', cl.total);
  if (cl.clients && cl.clients.length > 0) {
    console.log('Client ID:', cl.clients[0].id, 'tg:', cl.clients[0].telegram_id);
  }
}
main().catch(function(e){console.log('ERR:'+e.message)});
