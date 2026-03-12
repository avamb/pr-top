var http = require('http');
http.get('http://localhost:3001/api/health', function(r) {
  var d = '';
  r.on('data', function(c) { d += c; });
  r.on('end', function() { console.log('backend:', d); });
}).on('error', function(e) { console.log('backend not ready:', e.message); });
