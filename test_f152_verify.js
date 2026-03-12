var http = require('http');

function req(method, path, headers) {
  return new Promise(function(resolve) {
    var opts = {hostname:'localhost',port:3001,path:path,method:method,headers:headers||{}};
    var r = http.request(opts, function(res) {
      var b='';
      res.on('data',function(c){b+=c});
      res.on('end',function(){
        try { resolve({status:res.statusCode,data:JSON.parse(b)}); }
        catch(e) { resolve({status:res.statusCode,data:b}); }
      });
    });
    r.end();
  });
}

async function main() {
  var csrf = await req('GET', '/api/csrf-token', {});
  var csrfToken = csrf.data.csrfToken;
  var cookie = csrf.cookies ? csrf.cookies[0].split(';')[0] : '';

  var login = await req('POST', '/api/auth/login', {
    'Content-Type':'application/json',
    'X-CSRF-Token': csrfToken
  });
  // Use existing JWT
  var jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjU2NywiZW1haWwiOiJ0ZXN0X2YxNTFAZXhhbXBsZS5jb20iLCJyb2xlIjoidGhlcmFwaXN0IiwiaWF0IjoxNzczMzA1MDcwLCJleHAiOjE3NzMzOTE0NzB9.G0OVf74clfhU17dFxMDKDBbjk-OIgL629925-FOEnls';

  var notes = await req('GET', '/api/clients/568/notes', {
    'Authorization': 'Bearer ' + jwt
  });
  console.log('Notes total:', notes.data.total);
  console.log('Notes count:', notes.data.notes ? notes.data.notes.length : 0);
  if (notes.data.notes) {
    notes.data.notes.forEach(function(n, i) {
      console.log('Note ' + i + ':', n.content.substring(0, 60));
    });
  }
}

main().catch(function(e){console.error(e)});
