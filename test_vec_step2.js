var http = require('http');
var fs = require('fs');
var path = require('path');

var state = JSON.parse(fs.readFileSync('test_vec_state.json', 'utf8'));
var token = state.token;
var clientId = state.clientId;
console.log('Using token for client:', clientId);

function req(method, p, data) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: p, method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
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

function upload(p, filePath, fields) {
  return new Promise(function(resolve, reject) {
    var boundary = '----FB' + Date.now();
    var fileData = fs.readFileSync(filePath);
    var body = '';
    Object.keys(fields).forEach(function(k) {
      body += '--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + fields[k] + '\r\n';
    });
    body += '--' + boundary + '\r\nContent-Disposition: form-data; name="audio"; filename="test.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n';
    var buf = Buffer.concat([Buffer.from(body), fileData, Buffer.from('\r\n--' + boundary + '--\r\n')]);
    var opts = {
      hostname: 'localhost', port: 3001, path: p, method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': buf.length,
        'Authorization': 'Bearer ' + token
      }
    };
    var r = http.request(opts, function(res) {
      var b = '';
      res.on('data', function(d) { b += d; });
      res.on('end', function() {
        try { resolve({ s: res.statusCode, d: JSON.parse(b) }); }
        catch (e) { resolve({ s: res.statusCode, d: b }); }
      });
    });
    r.on('error', reject);
    r.write(buf);
    r.end();
  });
}

async function main() {
  console.log('=== Step 2: Upload + Embedding ===');

  // Stats before
  var sb = await req('GET', '/api/search/stats');
  console.log('1 stats before:', JSON.stringify(sb.d));

  // Upload session
  var ap = path.join(__dirname, 'test_audio_vec.mp3');
  fs.writeFileSync(ap, Buffer.alloc(2048, 'A'));
  var r7 = await upload('/api/sessions', ap, { client_id: String(clientId) });
  console.log('2 upload:', r7.s, 'id:', r7.d.id);
  var sid = r7.d.id;

  // Wait for async pipeline
  console.log('3 waiting 5s...');
  await new Promise(function(r) { setTimeout(r, 5000); });

  // Check session
  var r8 = await req('GET', '/api/sessions/' + sid);
  console.log('4 session:', r8.d.status, 'transcript:', r8.d.has_transcript, 'summary:', r8.d.has_summary);

  // Check transcript embedding
  var r9 = await req('GET', '/api/search/embedding/session_transcript/' + sid);
  console.log('5 transcript embedding:', r9.s === 200 ? 'EXISTS' : 'MISSING(' + r9.s + ')');
  if (r9.s === 200) console.log('  detail:', JSON.stringify(r9.d.embedding));

  // Check summary embedding
  var r9b = await req('GET', '/api/search/embedding/session_summary/' + sid);
  console.log('6 summary embedding:', r9b.s === 200 ? 'EXISTS' : 'MISSING(' + r9b.s + ')');

  // Stats after
  var sa = await req('GET', '/api/search/stats');
  console.log('7 stats after:', JSON.stringify(sa.d));

  // Semantic search
  var r10 = await req('POST', '/api/search', { query: 'anxiety breathing exercises morning', client_id: clientId });
  console.log('8 search "anxiety breathing":', r10.s, 'total:', r10.d.total);
  if (r10.d.results) r10.d.results.forEach(function(x) { console.log('  -', x.source_type, 'id:' + x.source_id, 'sim:' + x.similarity); });

  // Another search
  var r10b = await req('POST', '/api/search', { query: 'session therapy client progress', client_id: clientId });
  console.log('9 search "therapy progress":', r10b.s, 'total:', r10b.d.total);

  // Transcript retrievable
  var r11 = await req('GET', '/api/sessions/' + sid + '/transcript');
  var trOk = r11.s === 200 && r11.d.transcript && r11.d.transcript.length > 0;
  console.log('10 transcript retrievable:', trOk);

  try { fs.unlinkSync(ap); } catch (e) {}

  console.log('\n=== RESULT ===');
  var pass = r9.s === 200 && r10.d.total > 0 && trOk;
  console.log('embed:', r9.s === 200, 'search:', r10.d.total > 0, 'transcript:', trOk);
  console.log('PASS:', pass);
  process.exit(pass ? 0 : 1);
}

main().catch(function(e) { console.error('ERR:', e.message); process.exit(1); });
