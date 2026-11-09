var http = require('http');
http.get('http://localhost:3001/api/health', function(res) {
  var raw = '';
  res.on('data', function(c) { raw += c; });
  res.on('end', function() {
    var b = JSON.parse(raw);
    console.log('WS stats:', JSON.stringify(b.websocket));
  });
});
