var http = require('http');
var req = http.request({hostname:'localhost',port:3001,path:'/api/exercises',headers:{Authorization:'Bearer test'}}, function(res) {
  var d='';
  res.on('data', function(c){d+=c});
  res.on('end', function(){console.log(res.statusCode, d.substring(0,200))});
});
req.on('error', function(e){console.log('err',e.message)});
req.end();
