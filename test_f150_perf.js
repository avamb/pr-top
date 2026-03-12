// Test Feature #150: Timeline performant for 1+ year of client records
const http = require('http');

const BASE = 'http://127.0.0.1:3001';

function request(method, urlPath, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (extraHeaders) Object.assign(headers, extraHeaders);
    if (body) headers['Content-Type'] = 'application/json';

    const jsonStr = body ? JSON.stringify(body) : null;
    if (jsonStr) headers['Content-Length'] = Buffer.byteLength(jsonStr);

    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method, headers
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (jsonStr) req.write(jsonStr);
    req.end();
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  console.log('=== Feature #150: Timeline performant for 1+ year of client records ===\n');

  // Get CSRF token
  const csrfRes = await request('GET', '/api/csrf-token');
  const csrf = { 'x-csrf-token': csrfRes.data.csrfToken };
  const botH = { ...csrf, 'x-bot-api-key': 'dev-bot-api-key' };

  // Register therapist
  let token, therapistId;
  const regRes = await request('POST', '/api/auth/register', {
    name: 'F150PerfTherapist', email: 'f150perf@test.com', password: 'TestPass150!', role: 'therapist'
  }, null, csrf);
  if (regRes.data.token) {
    token = regRes.data.token;
    therapistId = regRes.data.user.id;
  } else {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'f150perf@test.com', password: 'TestPass150!'
    }, null, csrf);
    token = loginRes.data.token;
    therapistId = loginRes.data.user.id;
  }
  console.log(`Therapist ID: ${therapistId}`);

  // Register client
  const clientTgId = 'f150client_' + Date.now();
  await request('POST', '/api/bot/register', { telegram_id: clientTgId, name: 'F150PerfClient', role: 'client' }, null, botH);

  // Link client
  const inviteRes = await request('GET', '/api/invite-code', null, token);
  const inviteCode = inviteRes.data.invite_code;
  await request('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inviteCode }, null, botH);
  await request('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: therapistId, consent: true }, null, botH);

  const clientsRes = await request('GET', '/api/clients', null, token);
  const clientsList = clientsRes.data.clients || clientsRes.data;
  const clientId = clientsList[0].id;
  console.log(`Client ID: ${clientId}`);

  // Create 400+ diary entries (simulating 1+ year of daily entries)
  console.log('\nCreating 400 diary entries (simulating 1+ year)...');
  const BATCH_SIZE = 20;
  const TOTAL_ENTRIES = 400;
  let created = 0;

  for (let batch = 0; batch < TOTAL_ENTRIES / BATCH_SIZE; batch++) {
    const promises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const entryNum = batch * BATCH_SIZE + i + 1;
      const daysAgo = entryNum; // simulate one per day
      promises.push(
        request('POST', '/api/bot/diary', {
          telegram_id: clientTgId,
          content: `Diary entry #${entryNum} from ${daysAgo} days ago. Today I reflected on my progress in therapy. I had some positive moments and some challenges. The breathing exercises helped me manage anxiety. I noticed improvement in my sleep patterns.`,
          entry_type: entryNum % 3 === 0 ? 'voice' : 'text'
        }, null, botH)
      );
    }
    const results = await Promise.all(promises);
    created += results.filter(r => r.status === 201).length;
    if ((batch + 1) % 5 === 0) {
      process.stdout.write(`  ${created}/${TOTAL_ENTRIES} created...\n`);
    }
  }
  console.log(`  Total created: ${created}`);

  // TEST 1: Verify 365+ entries exist
  const countCheck = await request('GET', `/api/clients/${clientId}/timeline?per_page=1`, null, token);
  const totalEntries = countCheck.data.total;
  if (totalEntries >= 365) {
    console.log(`\n✅ TEST 1 PASS: ${totalEntries} timeline entries (>= 365 for 1+ year)`);
    passed++;
  } else {
    console.log(`\n❌ TEST 1 FAIL: Only ${totalEntries} entries, need >= 365`);
    failed++;
  }

  // TEST 2: Response time under 3 seconds for first page
  const startTime = Date.now();
  const timelineRes = await request('GET', `/api/clients/${clientId}/timeline?page=1&per_page=50`, null, token);
  const elapsed = Date.now() - startTime;
  if (elapsed < 3000 && timelineRes.status === 200) {
    console.log(`✅ TEST 2 PASS: First page loaded in ${elapsed}ms (< 3000ms), returned ${timelineRes.data.timeline.length} items`);
    passed++;
  } else {
    console.log(`❌ TEST 2 FAIL: Response took ${elapsed}ms (status ${timelineRes.status})`);
    failed++;
  }

  // TEST 3: Pagination is used (not returning all items at once)
  const pageSize = timelineRes.data.timeline.length;
  const total = timelineRes.data.total;
  const hasMore = timelineRes.data.has_more;
  const totalPages = timelineRes.data.total_pages;
  if (pageSize <= 50 && total > 50 && hasMore === true && totalPages > 1) {
    console.log(`✅ TEST 3 PASS: Pagination working - page has ${pageSize} items, total ${total}, ${totalPages} pages, has_more=true`);
    passed++;
  } else {
    console.log(`❌ TEST 3 FAIL: Pagination not working properly - pageSize=${pageSize}, total=${total}, hasMore=${hasMore}, totalPages=${totalPages}`);
    failed++;
  }

  // TEST 4: Second page loads correctly
  const page2Start = Date.now();
  const page2Res = await request('GET', `/api/clients/${clientId}/timeline?page=2&per_page=50`, null, token);
  const page2Elapsed = Date.now() - page2Start;
  if (page2Res.status === 200 && page2Res.data.timeline.length > 0 && page2Elapsed < 3000) {
    console.log(`✅ TEST 4 PASS: Page 2 loaded in ${page2Elapsed}ms with ${page2Res.data.timeline.length} items`);
    passed++;
  } else {
    console.log(`❌ TEST 4 FAIL: Page 2 failed - status=${page2Res.status}, elapsed=${page2Elapsed}ms`);
    failed++;
  }

  // TEST 5: Pages don't overlap (no duplicate items)
  const page1Ids = timelineRes.data.timeline.map(i => `${i.type}-${i.id}`);
  const page2Ids = page2Res.data.timeline.map(i => `${i.type}-${i.id}`);
  const overlap = page1Ids.filter(id => page2Ids.includes(id));
  if (overlap.length === 0) {
    console.log(`✅ TEST 5 PASS: No duplicate items between page 1 and page 2`);
    passed++;
  } else {
    console.log(`❌ TEST 5 FAIL: ${overlap.length} duplicate items found between pages`);
    failed++;
  }

  // TEST 6: Last page returns remaining items
  const lastPageRes = await request('GET', `/api/clients/${clientId}/timeline?page=${totalPages}&per_page=50`, null, token);
  if (lastPageRes.status === 200 && lastPageRes.data.has_more === false) {
    console.log(`✅ TEST 6 PASS: Last page (${totalPages}) has has_more=false, ${lastPageRes.data.timeline.length} items`);
    passed++;
  } else {
    console.log(`❌ TEST 6 FAIL: Last page has_more should be false`);
    failed++;
  }

  // TEST 7: Filtered timeline still paginates
  const filteredRes = await request('GET', `/api/clients/${clientId}/timeline?type=diary&page=1&per_page=50`, null, token);
  if (filteredRes.status === 200 && filteredRes.data.total_pages !== undefined) {
    console.log(`✅ TEST 7 PASS: Filtered timeline returns pagination (${filteredRes.data.total} diary items, ${filteredRes.data.total_pages} pages)`);
    passed++;
  } else {
    console.log(`❌ TEST 7 FAIL: Filtered timeline missing pagination`);
    failed++;
  }

  // TEST 8: Response time for unfiltered full count check
  const countStart = Date.now();
  const fullCount = await request('GET', `/api/clients/${clientId}/timeline?per_page=1`, null, token);
  const countElapsed = Date.now() - countStart;
  if (countElapsed < 3000) {
    console.log(`✅ TEST 8 PASS: Count query took ${countElapsed}ms (total: ${fullCount.data.total})`);
    passed++;
  } else {
    console.log(`❌ TEST 8 FAIL: Count query took ${countElapsed}ms (too slow)`);
    failed++;
  }

  console.log(`\n=== RESULTS: ${passed}/${passed + failed} tests passed ===`);
  if (failed === 0) console.log('🎉 All tests PASSED for Feature #150!');
}

main().catch(err => console.error('Error:', err));
