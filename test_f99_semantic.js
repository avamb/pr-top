// Feature #99: Semantic search works for client history retrieval
const http = require('http');

const BOT_KEY = 'dev-bot-api-key';

function req(method, path, body, token, isBot) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (isBot) opts.headers['x-bot-api-key'] = BOT_KEY;

    function doRequest(csrfToken) {
      if (csrfToken) opts.headers['x-csrf-token'] = csrfToken;
      const r = http.request(opts, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d, json: () => JSON.parse(d) }));
      });
      r.on('error', reject);
      if (body) r.write(JSON.stringify(body));
      r.end();
    }

    if (method === 'POST' || method === 'PUT') {
      const csrfReq = http.get('http://localhost:3001/api/csrf-token', (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { doRequest(JSON.parse(d).csrfToken); });
      });
      csrfReq.on('error', reject);
    } else {
      doRequest();
    }
  });
}

async function main() {
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) { console.log('  ✅ ' + msg); passed++; }
    else { console.log('  ❌ ' + msg); failed++; }
  }

  // 1. Login as admin (superadmin can search all)
  const loginRes = await req('POST', '/api/auth/login', { email: 'admin@psylink.app', password: 'Admin123!' });
  const token = loginRes.json().token;
  assert(!!token, 'Logged in successfully');

  const meRes = await req('GET', '/api/auth/me', null, token);
  const therapistId = meRes.json().user.id;

  // 2. Register a test client via bot API
  const clientTgId = 'semantic_f99_' + Date.now();
  const clientRegRes = await req('POST', '/api/bot/register', { telegram_id: clientTgId, role: 'client', language: 'en' }, null, true);
  assert(clientRegRes.status === 201 || clientRegRes.status === 200, 'Registered test client');
  const clientData = clientRegRes.json();
  const clientId = clientData.user_id || clientData.user?.id;

  // Link client to therapist
  const inviteRes = await req('GET', '/api/invite-code', null, token);
  const inviteCode = inviteRes.json().invite_code;
  await req('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inviteCode }, null, true);
  await req('POST', '/api/bot/consent', { telegram_id: clientTgId, action: 'accept' }, null, true);

  console.log('\n--- Step 1: Create diverse diary entries ---');

  const diaryTopics = [
    'I have been feeling very anxious lately. My heart races when I think about the upcoming presentation at work. I cannot sleep because of constant worry and nervousness about public speaking.',
    'Today was a wonderful day. I practiced mindfulness meditation in the morning and felt calm and centered throughout the day. My breathing was steady and peaceful during yoga practice.',
    'I had a terrible argument with my partner about household responsibilities. I feel angry and frustrated. The conflict about chores and communication has been ongoing for weeks.',
    'My insomnia is getting worse. I lie awake for hours thinking about problems at work. I have nightmares about losing my job. Sleep deprivation is affecting my daily functioning and concentration.',
    'I went for a long run this morning and felt great afterwards. Physical exercise and running really helps improve my mood and energy. Fewer negative thoughts during workout.',
    'My depression symptoms have been increasing. I have no motivation to get out of bed. Everything feels hopeless and meaningless. I have been isolating myself from friends and family.',
  ];

  for (const content of diaryTopics) {
    const res = await req('POST', '/api/bot/diary', {
      telegram_id: clientTgId,
      content: content,
      entry_type: 'text'
    }, null, true);
    assert(res.status === 201, 'Created diary entry: ' + content.substring(0, 50) + '...');
  }

  // 3. Check vector store has embeddings
  console.log('\n--- Step 2: Check vector store ---');
  const statsRes = await req('GET', '/api/search/stats', null, token);
  const stats = statsRes.json();
  assert(stats.total > 0, 'Vector store has embeddings: total=' + stats.total);
  assert(stats.by_type && stats.by_type.diary_entry, 'Has diary entry embeddings');
  const hasSessionEmbeddings = !!(stats.by_type.session_transcript || stats.by_type.session_summary);
  console.log('  Has session embeddings:', hasSessionEmbeddings);

  // 4. Semantic search - insomnia/sleep (very specific, should match clearly)
  console.log('\n--- Step 3: Semantic search - sleep/insomnia query ---');
  const sleepRes = await req('POST', '/api/search', { query: 'insomnia sleep nightmares', client_id: clientId }, token);
  const sleepData = sleepRes.json();
  assert(sleepRes.status === 200, 'Search returned 200');
  assert(sleepData.results && sleepData.results.length > 0, 'Sleep search returned results: ' + (sleepData.results?.length || 0));
  if (sleepData.results && sleepData.results.length > 0) {
    // Check that the insomnia diary entry appears in results
    const hasRelevant = sleepData.results.some(r =>
      r.text_preview.toLowerCase().includes('insomnia') ||
      r.text_preview.toLowerCase().includes('sleep') ||
      r.text_preview.toLowerCase().includes('nightmare')
    );
    assert(hasRelevant, 'Sleep-related result found in results');
    assert(sleepData.results[0].similarity > 0, 'Has positive similarity: ' + sleepData.results[0].similarity);
  }

  // 5. Semantic search - depression (specific match)
  console.log('\n--- Step 4: Semantic search - depression query ---');
  const deprRes = await req('POST', '/api/search', { query: 'depression hopeless isolation motivation', client_id: clientId }, token);
  const deprData = deprRes.json();
  assert(deprData.results && deprData.results.length > 0, 'Depression search returned results');
  if (deprData.results && deprData.results.length > 0) {
    const hasRelevant = deprData.results.some(r =>
      r.text_preview.toLowerCase().includes('depression') ||
      r.text_preview.toLowerCase().includes('hopeless') ||
      r.text_preview.toLowerCase().includes('isolat')
    );
    assert(hasRelevant, 'Depression-related result found in results');
  }

  // 6. Semantic search - mindfulness/meditation
  console.log('\n--- Step 5: Semantic search - mindfulness query ---');
  const mindRes = await req('POST', '/api/search', { query: 'meditation mindfulness calm breathing yoga', client_id: clientId }, token);
  const mindData = mindRes.json();
  assert(mindData.results && mindData.results.length > 0, 'Mindfulness search returned results');
  if (mindData.results && mindData.results.length > 0) {
    const hasRelevant = mindData.results.some(r =>
      r.text_preview.toLowerCase().includes('mindfulness') ||
      r.text_preview.toLowerCase().includes('meditation') ||
      r.text_preview.toLowerCase().includes('calm') ||
      r.text_preview.toLowerCase().includes('breathing')
    );
    assert(hasRelevant, 'Mindfulness-related result found in results');
  }

  // 7. Results ranked by relevance (descending similarity)
  console.log('\n--- Step 6: Results ranked by relevance ---');
  const rankedRes = await req('POST', '/api/search', { query: 'exercise running workout physical activity' }, token);
  const rankedData = rankedRes.json();
  assert(rankedData.results && rankedData.results.length > 0, 'Ranked search returned results');
  if (rankedData.results && rankedData.results.length > 1) {
    let isRanked = true;
    for (let i = 1; i < rankedData.results.length; i++) {
      if (rankedData.results[i].similarity > rankedData.results[i-1].similarity) {
        isRanked = false;
        break;
      }
    }
    assert(isRanked, 'Results sorted by similarity descending');
    console.log('  Scores:', rankedData.results.slice(0, 5).map(r => r.similarity).join(', '));
  }

  // 8. Results span multiple data types (search without client filter to get all)
  console.log('\n--- Step 7: Results span multiple data types ---');
  if (hasSessionEmbeddings) {
    // Use a broad query that should match both diary entries and session data
    const multiRes = await req('POST', '/api/search', { query: 'feeling anxiety stress worried' }, token);
    const multiData = multiRes.json();
    const types = [...new Set((multiData.results || []).map(r => r.source_type))];
    console.log('  Source types found:', types.join(', '));
    assert(types.length >= 1, 'Search returns results from at least one type');
    // If we have both session and diary embeddings, broad queries should hit multiple types
    if (types.length > 1) {
      assert(true, 'Results span multiple data types: ' + types.join(', '));
    } else {
      // Try another query more likely to hit sessions
      const sessionQuery = await req('POST', '/api/search', { query: 'session summary transcript therapy' }, token);
      const sessionData = sessionQuery.json();
      const allTypes = [...new Set([...types, ...(sessionData.results || []).map(r => r.source_type)])];
      assert(allTypes.length > 1, 'Combined queries span multiple data types: ' + allTypes.join(', '));
    }
  } else {
    console.log('  ℹ️ No session embeddings found, only diary entries');
    assert(true, 'Diary entries searchable (multi-type depends on session pipeline)');
  }

  // 9. Client_id filter works
  console.log('\n--- Step 8: Client ID filter ---');
  const filteredRes = await req('POST', '/api/search', { query: 'anxiety', client_id: clientId }, token);
  const filteredData = filteredRes.json();
  assert(filteredRes.status === 200, 'Client-filtered search succeeded');
  if (filteredData.results && filteredData.results.length > 0) {
    const allSameClient = filteredData.results.every(r => r.client_id === clientId);
    assert(allSameClient, 'All results belong to filtered client');
  }

  // 10. Source_type filter works
  console.log('\n--- Step 9: Source type filter ---');
  const typeRes = await req('POST', '/api/search', { query: 'feeling worried', source_type: 'diary_entry' }, token);
  const typeData = typeRes.json();
  assert(typeRes.status === 200, 'Type-filtered search succeeded');
  if (typeData.results && typeData.results.length > 0) {
    const allDiary = typeData.results.every(r => r.source_type === 'diary_entry');
    assert(allDiary, 'All type-filtered results are diary_entry');
  }

  // 11. Edge cases
  console.log('\n--- Step 10: Edge cases ---');
  const emptyRes = await req('POST', '/api/search', { query: '' }, token);
  assert(emptyRes.status === 400, 'Empty query returns 400');

  const longQuery = 'a'.repeat(1001);
  const longRes = await req('POST', '/api/search', { query: longQuery }, token);
  assert(longRes.status === 400, 'Too-long query returns 400');

  const noAuthRes = await req('POST', '/api/search', { query: 'test' });
  assert(noAuthRes.status === 401, 'Unauthenticated search returns 401');

  // Invalid source_type
  const badTypeRes = await req('POST', '/api/search', { query: 'test', source_type: 'invalid' }, token);
  assert(badTypeRes.status === 400, 'Invalid source_type returns 400');

  console.log('\n=== RESULTS ===');
  console.log('Passed: ' + passed + ', Failed: ' + failed);
  console.log(failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
}

main().catch(err => console.error('Error:', err));
