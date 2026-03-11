var http = require('http');
function req(m,p,t,b,h){return new Promise((ok,no)=>{var hd={'Content-Type':'application/json'};if(t)hd.Authorization='Bearer '+t;if(h)for(var k in h)if(h[k])hd[k]=h[k];var d=b?JSON.stringify(b):null;if(d)hd['Content-Length']=Buffer.byteLength(d);var r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:hd},function(rs){var x='';rs.on('data',function(c){x+=c});rs.on('end',function(){try{ok(JSON.parse(x))}catch(e){ok(x)}});});r.on('error',no);if(d)r.write(d);r.end();})}
async function main(){
  var c=await req('GET','/api/csrf-token');
  var csrf = c.csrfToken;
  // Login as admin
  var l=await req('POST','/api/auth/login',null,{email:'admin@psylink.app',password:'Admin123!'},{['X-CSRF-Token']:csrf});
  var token = l.token;
  // Get therapist list
  var therapists = await req('GET','/api/admin/therapists',token);
  console.log('Therapists:', JSON.stringify(therapists).substring(0, 500));
}
main().catch(function(e){console.log('ERR:'+e.message)});
