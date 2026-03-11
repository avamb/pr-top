var http = require('http');

function request(method, path, body, token, botKey) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (botKey) opts.headers['x-bot-api-key'] = botKey;
    var r = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function delay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  var bk = 'dev-bot-api-key';
  var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwOCwiZW1haWwiOiJ2b2ljZXRlc3QxQHRlc3QuY29tIiwicm9sZSI6InRoZXJhcGlzdCIsImlhdCI6MTc3MzI0NTk1NCwiZXhwIjoxNzczMzMyMzU0fQ.VEfYLHA4mzX8cWEOdshsDvUS48eLJK6EPIH7bAzw-V8';
  var clientId = 311;

  // Test 1: Create diary entry and check embedding_ref
  process.stdout.write('TEST 1: Create diary with distinctive content\n');
  await delay(500);
  var d1 = await request('POST', '/api/bot/diary', {
    telegram_id: 'vclient1',
    content: 'UNIQUE_EMBED_TEST I am struggling with severe insomnia and recurring nightmares about work failure. The lack of sleep is affecting my concentration and relationships.',
    entry_type: 'text'
  }, null, bk);
  process.stdout.write('   Status: ' + d1.status + '\n');
  var entry = d1.body.entry || {};
  process.stdout.write('   Entry ID: ' + entry.id + '\n');
  process.stdout.write('   embedding_ref: ' + entry.embedding_ref + '\n');
  var hasRef = !!(entry.embedding_ref && entry.embedding_ref.length > 0);
  process.stdout.write('   Has embedding_ref: ' + hasRef + '\n');

  // Test 2: Verify semantic search finds the entry
  await delay(500);
  process.stdout.write('\nTEST 2: Semantic search for insomnia/sleep\n');
  var q1 = await request('POST', '/api/query', {
    client_id: clientId, query: 'Does the client have sleep problems or insomnia'
  }, token);
  process.stdout.write('   Status: ' + q1.status + '\n');
  process.stdout.write('   Matches: ' + (q1.body.total_matches || 0) + '\n');
  var foundEmbed = false;
  if (q1.body.results) {
    for (var i = 0; i < q1.body.results.length; i++) {
      var r = q1.body.results[i];
      if (r.content && r.content.indexOf('UNIQUE_EMBED_TEST') >= 0) {
        foundEmbed = true;
        process.stdout.write('   Found entry: type=' + r.type + ' relevance=' + r.relevance + '\n');
      }
    }
  }
  process.stdout.write('   Found embedded entry: ' + foundEmbed + '\n');

  // Test 3: Semantic search with related but different terms
  await delay(500);
  process.stdout.write('\nTEST 3: Semantic search with related terms (nightmare/fatigue)\n');
  var q2 = await request('POST', '/api/query', {
    client_id: clientId, query: 'nightmares and fatigue affecting daily life'
  }, token);
  process.stdout.write('   Status: ' + q2.status + '\n');
  process.stdout.write('   Matches: ' + (q2.body.total_matches || 0) + '\n');
  var foundSemantic = false;
  if (q2.body.results) {
    for (var j = 0; j < q2.body.results.length; j++) {
      if (q2.body.results[j].content && q2.body.results[j].content.indexOf('UNIQUE_EMBED_TEST') >= 0) {
        foundSemantic = true;
        process.stdout.write('   Found via semantic: relevance=' + q2.body.results[j].relevance + '\n');
      }
    }
  }
  process.stdout.write('   Found via semantic match: ' + foundSemantic + '\n');

  // Test 4: Verify another entry also gets embedding_ref
  await delay(500);
  process.stdout.write('\nTEST 4: Second diary entry gets embedding_ref\n');
  var d2 = await request('POST', '/api/bot/diary', {
    telegram_id: 'vclient1',
    content: 'SECOND_EMBED_TEST Today I practiced progressive muscle relaxation. It helped reduce the physical tension I carry in my shoulders.',
    entry_type: 'text'
  }, null, bk);
  process.stdout.write('   Status: ' + d2.status + '\n');
  var entry2 = d2.body.entry || {};
  process.stdout.write('   embedding_ref: ' + entry2.embedding_ref + '\n');
  var hasRef2 = !!(entry2.embedding_ref && entry2.embedding_ref.length > 0);
  process.stdout.write('   Has embedding_ref: ' + hasRef2 + '\n');

  // Cleanup: delete test entries
  // (leaving them is fine for dev)

  process.stdout.write('\n=== SUMMARY ===\n');
  process.stdout.write('T1 (embedding_ref set): ' + (hasRef ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('T2 (semantic search): ' + (q1.status === 200 && foundEmbed ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('T3 (semantic related): ' + (q2.status === 200 && foundSemantic ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('T4 (second entry embeds): ' + (hasRef2 ? 'PASS' : 'FAIL') + '\n');
}

main().catch(function(e) { process.stdout.write('ERR: ' + e.message + '\n'); });
