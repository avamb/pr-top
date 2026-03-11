var http = require('http');
var fs = require('fs');
var path = require('path');

function req(method, p, data, token, extra) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: p, method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, extra || {})
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    var r = http.request(opts, function(res) {
      var body = '';
      res.on('data', function(d) { body += d; });
      res.on('end', function() {
        try { resolve({ s: res.statusCode, d: JSON.parse(body) }); }
        catch (e) { resolve({ s: res.statusCode, d: body }); }
      });
    });
    r.on('error', reject);
    r.setTimeout(30000, function() { r.destroy(); reject(new Error('timeout on ' + p)); });
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

function upload(p, filePath, fields, token) {
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
    r.setTimeout(30000, function() { r.destroy(); reject(new Error('upload timeout')); });
    r.write(buf);
    r.end();
  });
}

var BH = { 'x-bot-api-key': 'dev-bot-api-key' };

async function main() {
  console.log('=== Vector DB Test ===');
  var ts = Date.now();

  var r1 = await req('POST', '/api/auth/register', {
    email: 'vt' + ts + '@t.com', password: 'TestPass123', confirm_password: 'TestPass123'
  });
  console.log('1 register:', r1.s);
  if (r1.s !== 201) { console.log(JSON.stringify(r1.d)); process.exit(1); }
  var token = r1.d.token;

  var tid = 'vc' + ts;
  var r2 = await req('POST', '/api/bot/register', { telegram_id: tid, role: 'client' }, null, BH);
  console.log('2 bot reg:', r2.s);

  var r3 = await req('GET', '/api/invite-code', null, token);
  console.log('3 invite:', r3.d.invite_code);

  var r4 = await req('POST', '/api/bot/connect', { telegram_id: tid, invite_code: r3.d.invite_code }, null, BH);
  console.log('4 connect:', r4.s, JSON.stringify(r4.d));
  var therapistId = r4.d.therapist_id;

  var r5 = await req('POST', '/api/bot/consent', { telegram_id: tid, therapist_id: therapistId, consent: true }, null, BH);
  console.log('5 consent:', r5.s);

  var r6 = await req('GET', '/api/clients', null, token);
  if (!r6.d.clients || r6.d.clients.length === 0) { console.log('NO CLIENTS'); process.exit(1); }
  var clientId = r6.d.clients[0].id;
  console.log('6 clientId:', clientId);

  var sb = await req('GET', '/api/search/stats', null, token);
  console.log('7 stats before:', JSON.stringify(sb.d));

  var ap = path.join(__dirname, 'test_audio_vec.mp3');
  fs.writeFileSync(ap, Buffer.alloc(1024, 'A'));
  var r7 = await upload('/api/sessions', ap, { client_id: String(clientId) }, token);
  console.log('8 upload:', r7.s, 'id:', r7.d.id);
  var sid = r7.d.id;

  console.log('9 waiting 5s for transcription...');
  await new Promise(function(r) { setTimeout(r, 5000); });

  var r8 = await req('GET', '/api/sessions/' + sid, null, token);
  console.log('10 session:', r8.d.status, 'transcript:', r8.d.has_transcript, 'summary:', r8.d.has_summary);

  var r9 = await req('GET', '/api/search/embedding/session_transcript/' + sid, null, token);
  console.log('11 transcript emb:', r9.s === 200 ? 'EXISTS' : 'MISSING(' + r9.s + ')');
  if (r9.s === 200) console.log('   tokens:', r9.d.embedding.token_count);

  var r9b = await req('GET', '/api/search/embedding/session_summary/' + sid, null, token);
  console.log('12 summary emb:', r9b.s === 200 ? 'EXISTS' : 'MISSING(' + r9b.s + ')');

  var r10 = await req('POST', '/api/search', { query: 'anxiety breathing exercises', client_id: clientId }, token);
  console.log('13 search:', r10.s, 'total:', r10.d.total);
  if (r10.d.results) r10.d.results.forEach(function(x) { console.log('   -', x.source_type, x.similarity); });

  var r11 = await req('GET', '/api/sessions/' + sid + '/transcript', null, token);
  var trOk = r11.s === 200 && r11.d.transcript && r11.d.transcript.length > 0;
  console.log('14 transcript retrievable:', trOk);

  try { fs.unlinkSync(ap); } catch (e) {}

  console.log('\n=== RESULT ===');
  var pass = r9.s === 200 && r10.d.total > 0 && trOk;
  console.log('PASS:', pass);
  process.exit(pass ? 0 : 1);
}

main().catch(function(e) { console.error('ERR:', e.message); process.exit(1); });
