var http = require('http');

var TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMzMCwiZW1haWwiOiJpbnZpdGVfdGVzdF8xOEB0ZXN0LmNvbSIsInJvbGUiOiJ0aGVyYXBpc3QiLCJpYXQiOjE3NzMyNDYwOTUsImV4cCI6MTc3MzMzMjQ5NX0.mQefKUF4pmCWCiokfNBScCrn61p-4R3vs7FSiNpnz5Y';

function makeRequest(method, path, headers) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: headers || {}
    };
    var req = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  var authHeaders = { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

  var diary = await makeRequest('GET', '/api/clients/341/diary', authHeaders);
  console.log('Status:', diary.status);
  console.log('Diary entries count:', diary.body.entries ? diary.body.entries.length : 0);

  if (diary.body.entries && diary.body.entries.length > 0) {
    var entry = diary.body.entries.find(function(e) { return e.entry_type === 'voice'; });
    if (entry) {
      console.log('\n=== Voice Entry ===');
      console.log('Entry ID:', entry.id);
      console.log('Entry type:', entry.entry_type);
      console.log('Has content:', !!entry.content);
      console.log('Content preview:', entry.content ? entry.content.substring(0, 80) : 'NONE');
      console.log('Has transcript:', !!entry.transcript);
      console.log('Transcript preview:', entry.transcript ? entry.transcript.substring(0, 120) : 'NONE');
      console.log('Embedding ref:', entry.embedding_ref || 'NOT SET');
    } else {
      console.log('No voice entry found!');
    }
  }

  console.log('\nDone!');
}

main().catch(function(e) { console.error(e); process.exit(1); });
