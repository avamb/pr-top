var http = require('http');
var fs = require('fs');
var state = JSON.parse(fs.readFileSync('test_vec_state.json', 'utf8'));

function req(method, p, data) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: p, method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token }
    };
    var r = http.request(opts, function(res) {
      var body = '';
      res.on('data', function(d) { body += d; });
      res.on('end', function() {
        try { resolve({ s: res.statusCode, d: JSON.parse(body) }); }
        catch (e) { resolve({ s: res.statusCode, d: body }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

async function main() {
  console.log('=== Persistence check after restart ===');
  var r1 = await req('GET', '/api/search/stats');
  console.log('stats:', JSON.stringify(r1.d));

  var r2 = await req('POST', '/api/search', { query: 'anxiety breathing exercises', client_id: state.clientId });
  console.log('search:', r2.s, 'total:', r2.d.total);

  var pass = r1.d.total > 0 && r2.d.total > 0;
  console.log('PERSISTENCE OK:', pass);
  process.exit(pass ? 0 : 1);
}

main().catch(function(e) { console.error('ERR:', e.message); process.exit(1); });
