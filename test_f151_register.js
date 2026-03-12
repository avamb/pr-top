var http = require('http');
var d = JSON.stringify({email:'test_f151@example.com',password:'Test1234',name:'Test F151'});
var r = http.request({hostname:'localhost',port:3001,path:'/api/auth/register',method:'POST',headers:{'Content-Type':'application/json','Content-Length':d.length}},function(res){var b='';res.on('data',function(c){b+=c});res.on('end',function(){console.log(b)})});
r.write(d);
r.end();
