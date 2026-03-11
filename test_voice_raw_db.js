var http = require('http');

var TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMzMCwiZW1haWwiOiJpbnZpdGVfdGVzdF8xOEB0ZXN0LmNvbSIsInJvbGUiOiJ0aGVyYXBpc3QiLCJpYXQiOjE3NzMyNDYwOTUsImV4cCI6MTc3MzMzMjQ5NX0.mQefKUF4pmCWCiokfNBScCrn61p-4R3vs7FSiNpnz5Y';

function get(path) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    };
    var req = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  var diary = await get('/api/clients/341/diary');

  if (diary.entries && diary.entries.length > 0) {
    var voice = diary.entries.find(function(e) { return e.entry_type === 'voice'; });
    if (voice) {
      console.log('=== Voice Entry Verification ===');
      console.log('1. Entry type:', voice.entry_type);
      console.log('2. Has transcript:', !!voice.transcript);
      console.log('3. Transcript starts with [Voice:', voice.transcript ? voice.transcript.startsWith('[Voice') : false);
      console.log('4. Embedding ref:', voice.embedding_ref);
      console.log('5. Content decrypted OK:', voice.content && voice.content.includes('VOICE_TEST_26'));
      console.log('\nTranscript (first 200 chars):', voice.transcript ? voice.transcript.substring(0, 200) : 'NONE');
    }
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
