var http = require('http');
var r = http.request({hostname:'localhost',port:3001,path:'/api/dev/seed-clients',method:'POST',headers:{'Content-Type':'application/json'}},function(s){var d='';s.on('data',function(c){d+=c});s.on('end',function(){console.log(d)})});
r.write(JSON.stringify({therapist_id:50,count:70}));
r.end();
