const http = require('http');
const options = { hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' };
const r = http.request(options, function(res) {
  let d = '';
  res.on('data', function(c) { d += c; });
  res.on('end', function() {
    console.log('status:', res.statusCode);
    console.log('raw:', d);
    console.log('parsed:', JSON.parse(d));
  });
});
r.on('error', function(e) { console.error('error:', e.message); });
r.end();
