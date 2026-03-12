var http = require('http');
http.get('http://127.0.0.1:3001/api/health', function(r) {
  var d = '';
  r.on('data', function(c) { d += c; });
  r.on('end', function() { console.log(r.statusCode, d.substring(0, 100)); });
}).on('error', function(e) { console.log('err:', e.message); });
