/**
 * Feature #393 — Regression sweep: search (vector + NL query expansion)
 *
 * Spec steps:
 *  1. Re-index a small test corpus and run baseline vector queries
 *  2. Run NL queries from Pro/Premium accounts; confirm Basic is gated
 *  3. Verify results never include data from clients without active consent
 *  4. Check query latency is within previous baseline
 *
 * Bug found & fixed: search.js did not filter revoked-consent data from
 * global results — embeddings persisted after revocation and appeared in
 * therapist-scoped searches. Post-search consent filter added in search.js.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

const BASE = 'http://localhost:3001';
let passed = 0;
let failed = 0;
const failures = [];

// ─── helpers ─────────────────────────────────────────────────────────────────

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
        ...headers
      }
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ': ' + detail : ''}`);
    process.stdout.write(`  ✗ ${label}${detail ? ' [' + detail + ']' : ''}\n`);
  }
}

const BOT_KEY = 'dev-bot-api-key';
const BOT_HEADERS = { 'X-Bot-Api-Key': BOT_KEY };

async function getCsrf(token) {
  const r = await req('GET', '/api/csrf-token', null,
    token ? { Authorization: `Bearer ${token}` } : {});
  return r.body.csrfToken;
}

async function registerTherapist(tag) {
  const ts = Date.now() + Math.floor(Math.random() * 1000);
  const email = `t393_${tag}_${ts}@test.com`;
  const csrf = await getCsrf();
  const r = await req('POST', '/api/auth/register', {
    email,
    password: 'Test12345!',
    role: 'therapist'
  }, { 'X-CSRF-Token': csrf });
  if (r.status !== 201) throw new Error(`Register failed (${tag}): ${JSON.stringify(r.body)}`);
  return { email, token: r.body.token, userId: r.body.user?.id };
}

async function setSubscription(therapistId, fields) {
  const r = await req('POST', '/api/dev/set-subscription', { therapist_id: therapistId, ...fields });
  if (r.status !== 200) throw new Error(`setSubscription failed: ${JSON.stringify(r.body)}`);
}

async function setPlan(therapistId, plan) {
  return setSubscription(therapistId, { plan, status: 'active' });
}

/** Register a client via bot and connect them to a therapist via invite code */
async function connectClient(therapistToken, telegramId) {
  // 1. Get invite code
  const csrf = await getCsrf(therapistToken);
  const invR = await req('GET', '/api/invite-code', null,
    { Authorization: `Bearer ${therapistToken}`, 'X-CSRF-Token': csrf });
  if (invR.status !== 200) throw new Error(`Get invite code failed: ${JSON.stringify(invR.body)}`);
  const inviteCode = invR.body.invite_code;

  // 2. Register client in bot
  const regR = await req('POST', '/api/bot/register', {
    telegram_id: String(telegramId),
    role: 'client',
    first_name: 'TestClient',
    language: 'en'
  }, BOT_HEADERS);
  if (![200, 201].includes(regR.status)) throw new Error(`Bot register failed: ${JSON.stringify(regR.body)}`);

  // 3. Connect via invite code
  const connR = await req('POST', '/api/bot/connect', {
    telegram_id: String(telegramId),
    invite_code: inviteCode
  }, BOT_HEADERS);
  if (connR.status !== 200) throw new Error(`Bot connect failed: ${JSON.stringify(connR.body)}`);

  // Extract therapist_id from connect response
  const foundTherapistId = connR.body.therapist?.id;
  if (!foundTherapistId) throw new Error(`Connect response missing therapist.id: ${JSON.stringify(connR.body)}`);

  // 4. Grant consent
  const consentHash = crypto.createHash('sha256').update('consent-text-v1').digest('hex');
  const consentR = await req('POST', '/api/bot/consent', {
    telegram_id: String(telegramId),
    therapist_id: foundTherapistId,
    consent: true,
    consent_version: 1,
    consent_text_hash: consentHash,
    mode: 'connect'
  }, BOT_HEADERS);
  if (consentR.status !== 200) throw new Error(`Bot consent failed: ${JSON.stringify(consentR.body)}`);

  return { inviteCode, clientId: consentR.body.client_id, therapistId: foundTherapistId };
}

/** Post a text diary entry via bot API and return entry id */
async function postDiaryEntry(telegramId, content) {
  const r = await req('POST', '/api/bot/diary', {
    telegram_id: String(telegramId),
    entry_type: 'text',
    content
  }, BOT_HEADERS);
  if (r.status !== 201) throw new Error(`Diary post failed: ${JSON.stringify(r.body)}`);
  return r.body.entry?.id || r.body.id;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Feature #393: Search regression sweep ===\n');

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Re-index a small test corpus; run baseline vector queries
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n── Step 1: Re-index test corpus and run baseline vector queries ──');

  const { token: proToken, userId: proId } = await registerTherapist('pro_step1');
  await setPlan(proId, 'pro');

  // Compound unique keywords for VECTOR search (search is done with same compound key)
  const KEY1 = 'acrophobia_393_A';
  const KEY2 = 'acrophobia_393_B';
  const KEY3 = 'nightmares_393_C';

  // Real-language content for NL QUERY (plain words that tokenize correctly)
  const NL_CONTENT1 = 'Today I experienced severe anxiety and panic during the session. The client reported intense fear and depression symptoms.';
  const NL_CONTENT2 = 'Client is making good progress overcoming depression and stress. Sleep patterns improving but nightmares persist.';
  const NL_CONTENT3 = 'Session discussed trauma related anxiety and coping strategies. Client reports feeling more hopeful about progress.';

  const tgBase = Math.floor(Date.now() / 1000) % 1000000;
  const tgId1 = 9390000000 + tgBase * 10 + 1;
  const { clientId: cid1 } = await connectClient(proToken, tgId1);

  // Post vector-search-specific diary entries (compound-key indexed)
  await postDiaryEntry(tgId1, `Today I felt extreme ${KEY1} during the bridge crossing exercise`);
  await postDiaryEntry(tgId1, `Session recap: client showed signs of ${KEY2} and complete avoidance`);
  await postDiaryEntry(tgId1, `Client reported ${KEY3} related to childhood trauma responses`);

  // Post NL-query-specific diary entries (real therapy language)
  await postDiaryEntry(tgId1, NL_CONTENT1);
  await postDiaryEntry(tgId1, NL_CONTENT2);
  await postDiaryEntry(tgId1, NL_CONTENT3);

  // Also add a therapist note (NL query searches notes too)
  const csrf1 = await getCsrf(proToken);
  const noteR = await req('POST', `/api/clients/${cid1}/notes`, {
    content: `Therapist note: patient shows strong anxiety and fear responses confirmed in today session`
  }, { Authorization: `Bearer ${proToken}`, 'X-CSRF-Token': csrf1 });
  assert('POST note → 201', noteR.status === 201, JSON.stringify(noteR.body));

  // Short delay for embeddings to be written
  await sleep(300);

  // Check stats endpoint shows embeddings exist
  const statsR = await req('GET', '/api/search/stats', null,
    { Authorization: `Bearer ${proToken}` });
  assert('GET /api/search/stats → 200', statsR.status === 200, JSON.stringify(statsR.body));
  assert('Stats has total > 0', statsR.body.total > 0, `total=${statsR.body.total}`);
  assert('Stats shows diary_entry type', typeof statsR.body.by_type?.diary_entry === 'object',
    JSON.stringify(statsR.body.by_type));

  // Run vector search without client_id filter (global search for therapist)
  const t0 = Date.now();
  const searchR1 = await req('POST', '/api/search', {
    query: KEY1,
    limit: 10
  }, { Authorization: `Bearer ${proToken}` });
  const searchLatency1 = Date.now() - t0;

  assert('POST /api/search → 200', searchR1.status === 200, JSON.stringify(searchR1.body));
  assert('Search has results array', Array.isArray(searchR1.body.results),
    JSON.stringify(searchR1.body));
  assert(`Search for compound key "${KEY1}" returns >= 1 result`,
    searchR1.body.results && searchR1.body.results.length >= 1,
    `got ${searchR1.body.results?.length} results`);
  assert('Search result has similarity score',
    searchR1.body.results?.[0]?.similarity > 0,
    `similarity=${searchR1.body.results?.[0]?.similarity}`);
  assert('Search result has source_type field',
    !!searchR1.body.results?.[0]?.source_type,
    JSON.stringify(searchR1.body.results?.[0]));
  assert(`Step 1 vector search latency < 500ms`, searchLatency1 < 500,
    `${searchLatency1}ms`);

  // Search with client_id filter
  const searchR2 = await req('POST', '/api/search', {
    query: KEY2,
    client_id: cid1,
    limit: 10
  }, { Authorization: `Bearer ${proToken}` });
  assert('POST /api/search with client_id → 200', searchR2.status === 200,
    JSON.stringify(searchR2.body));
  assert('Search with client_id returns results',
    searchR2.body.results?.length >= 1,
    `got ${searchR2.body.results?.length}`);

  // Search with source_type filter
  const searchR3 = await req('POST', '/api/search', {
    query: KEY1,
    source_type: 'diary_entry',
    limit: 10
  }, { Authorization: `Bearer ${proToken}` });
  assert('POST /api/search with source_type=diary_entry → 200', searchR3.status === 200);
  assert('All results are diary_entry type',
    (searchR3.body.results || []).every(r => r.source_type === 'diary_entry'),
    JSON.stringify((searchR3.body.results || []).map(r => r.source_type)));

  // Search with invalid source_type → 400
  const searchR4 = await req('POST', '/api/search', {
    query: KEY1,
    source_type: 'invalid_type'
  }, { Authorization: `Bearer ${proToken}` });
  assert('Search with invalid source_type → 400', searchR4.status === 400);

  // Search without auth - CSRF check runs before auth for POST; expect 403 (CSRF missing)
  const searchR5 = await req('POST', '/api/search', { query: KEY1 });
  assert('Search without auth is blocked (CSRF/auth error, non-2xx)',
    searchR5.status >= 400, `got ${searchR5.status}`);

  // GET /api/search/stats without auth → 401 (GET, no CSRF needed)
  const statsNoAuthR = await req('GET', '/api/search/stats');
  assert('GET /api/search/stats without auth → 401', statsNoAuthR.status === 401,
    `got ${statsNoAuthR.status}`);

  // Search with empty query → 400
  const searchR6 = await req('POST', '/api/search', { query: '' },
    { Authorization: `Bearer ${proToken}` });
  assert('Search with empty query → 400', searchR6.status === 400);

  // Search with overlong query → 400
  const longQuery = 'x'.repeat(1001);
  const searchR7 = await req('POST', '/api/search', { query: longQuery },
    { Authorization: `Bearer ${proToken}` });
  assert('Search with >1000 char query → 400', searchR7.status === 400);

  // Verify therapist data isolation
  const { token: proToken2, userId: proId2 } = await registerTherapist('pro_iso');
  await setPlan(proId2, 'pro');
  const KEYX = 'isolationtest_393_XYZ';
  const tgId2 = 9390000000 + tgBase * 10 + 2;
  const { clientId: cidX } = await connectClient(proToken2, tgId2);
  await postDiaryEntry(tgId2, `This is a ${KEYX} specific term for therapist2 isolation`);
  await sleep(300);

  // Therapist1 searches for therapist2's key → should get 0 results
  const isoR = await req('POST', '/api/search', { query: KEYX, limit: 10 },
    { Authorization: `Bearer ${proToken}` });
  assert('Therapist A does not see Therapist B\'s data in search',
    isoR.body.results?.length === 0,
    `got ${isoR.body.results?.length} results for ${KEYX}`);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: NL queries from Pro/Premium; confirm Basic/Trial is gated
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n── Step 2: NL query tier gating ──');

  // --- Basic plan → 403 ---
  const { token: basicToken, userId: basicId } = await registerTherapist('basic');
  await setPlan(basicId, 'basic');

  const basicNL = await req('POST', '/api/query', {
    client_id: 999999,
    query: 'test query'
  }, { Authorization: `Bearer ${basicToken}` });
  assert('Basic plan: POST /api/query → 403', basicNL.status === 403,
    `got ${basicNL.status}: ${JSON.stringify(basicNL.body)}`);
  assert('Basic plan 403 body has current_plan field',
    basicNL.body.current_plan === 'basic',
    JSON.stringify(basicNL.body));
  assert('Basic plan 403 body has required_plans field',
    Array.isArray(basicNL.body.required_plans),
    JSON.stringify(basicNL.body));
  assert('Basic plan required_plans includes pro and premium',
    basicNL.body.required_plans?.includes('pro') && basicNL.body.required_plans?.includes('premium'),
    JSON.stringify(basicNL.body.required_plans));

  // --- Trial plan → 403 (default after registration) ---
  const { token: trialToken } = await registerTherapist('trial');
  const trialNL = await req('POST', '/api/query', {
    client_id: 999999,
    query: 'test query'
  }, { Authorization: `Bearer ${trialToken}` });
  assert('Trial plan: POST /api/query → 403', trialNL.status === 403,
    `got ${trialNL.status}: ${JSON.stringify(trialNL.body)}`);

  // --- Pro plan → passes tier gate (404 for nonexistent client, not 403) ---
  const proNL = await req('POST', '/api/query', {
    client_id: 999999,
    query: 'test query'
  }, { Authorization: `Bearer ${proToken}` });
  assert('Pro plan: POST /api/query passes tier gate (not 403)',
    proNL.status !== 403,
    `got ${proNL.status}: ${JSON.stringify(proNL.body)}`);
  assert('Pro plan: response is 404 for nonexistent client',
    proNL.status === 404,
    `got ${proNL.status}`);

  // --- Premium plan → passes tier gate ---
  const { token: premToken, userId: premId } = await registerTherapist('prem');
  await setPlan(premId, 'premium');
  const premNL = await req('POST', '/api/query', {
    client_id: 999999,
    query: 'test query'
  }, { Authorization: `Bearer ${premToken}` });
  assert('Premium plan: POST /api/query passes tier gate (not 403)',
    premNL.status !== 403,
    `got ${premNL.status}: ${JSON.stringify(premNL.body)}`);

  // --- Pro plan with real client and real therapy-language data ---
  // Query: "anxiety depression sleep" — matches NL_CONTENT1/2/3 above directly
  const t1 = Date.now();
  const nlRealR = await req('POST', '/api/query', {
    client_id: cid1,
    query: 'anxiety depression sleep',
    limit: 10
  }, { Authorization: `Bearer ${proToken}` });
  const nlLatency = Date.now() - t1;

  assert('Pro NL query with real client → 200', nlRealR.status === 200,
    JSON.stringify(nlRealR.body));
  assert('NL query returns results array', Array.isArray(nlRealR.body.results),
    JSON.stringify(nlRealR.body));
  assert('NL query returns total_searched > 0',
    nlRealR.body.total_searched > 0,
    `total_searched=${nlRealR.body.total_searched}`);
  assert('NL query returns expanded_terms array',
    Array.isArray(nlRealR.body.expanded_terms),
    JSON.stringify(nlRealR.body.expanded_terms));
  assert('NL query expands "anxiety" to related terms',
    nlRealR.body.expanded_terms?.some(t =>
      ['anxious', 'worried', 'worry', 'nervous', 'panic', 'fear', 'scared', 'stress',
       'stressed', 'tense'].includes(t)
    ),
    JSON.stringify(nlRealR.body.expanded_terms));
  assert('NL query expands "sleep" to related terms',
    nlRealR.body.expanded_terms?.some(t =>
      ['insomnia', 'sleeping', 'nightmare', 'nightmares', 'rest', 'tired', 'fatigue'].includes(t)
    ),
    JSON.stringify(nlRealR.body.expanded_terms));
  assert('NL query returns search_time_ms', typeof nlRealR.body.search_time_ms === 'number');
  assert(`NL query finds anxiety/depression/sleep content (total_matches > 0)`,
    nlRealR.body.total_matches > 0,
    `total_matches=${nlRealR.body.total_matches}, total_searched=${nlRealR.body.total_searched}`);

  // Result types: should include diary and/or note entries
  const resultTypes = (nlRealR.body.results || []).map(r => r.type);
  assert('NL query results include diary or note entries',
    resultTypes.includes('diary') || resultTypes.includes('note'),
    `types: ${JSON.stringify(resultTypes)}`);

  // Results have similarity_score (0-1 normalized)
  const topResult = nlRealR.body.results?.[0];
  assert('NL top result has similarity_score in [0,1]',
    topResult && topResult.similarity_score >= 0 && topResult.similarity_score <= 1,
    `similarity_score=${topResult?.similarity_score}`);

  // --- NL query with query_tokens in response ---
  assert('NL query returns query_tokens array',
    Array.isArray(nlRealR.body.query_tokens),
    JSON.stringify(nlRealR.body.query_tokens));
  assert('query_tokens includes "anxiety"',
    nlRealR.body.query_tokens?.includes('anxiety'),
    JSON.stringify(nlRealR.body.query_tokens));

  // --- NL query missing client_id → 400 ---
  const nlMissingR = await req('POST', '/api/query', { query: 'test' },
    { Authorization: `Bearer ${proToken}` });
  assert('NL query missing client_id → 400', nlMissingR.status === 400);

  // --- NL query missing query → 400 ---
  const nlMissingQR = await req('POST', '/api/query', { client_id: cid1 },
    { Authorization: `Bearer ${proToken}` });
  assert('NL query missing query → 400', nlMissingQR.status === 400);

  // --- NL query without auth — blocked (CSRF or auth error) ---
  const nlNoAuth = await req('POST', '/api/query', { client_id: cid1, query: 'test' });
  assert('NL query without auth is blocked (non-2xx)', nlNoAuth.status >= 400,
    `got ${nlNoAuth.status}`);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Consent filtering — results must never include non-consented data
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n── Step 3: Consent filtering in search results ──');

  // 3a. Search by client_id when consent is active → should work
  const consentedSearchR = await req('POST', '/api/search', {
    query: KEY1,
    client_id: cid1
  }, { Authorization: `Bearer ${proToken}` });
  assert('Search with consented client_id → 200',
    consentedSearchR.status === 200,
    JSON.stringify(consentedSearchR.body));

  // 3b. Search by client_id that belongs to another therapist → 403
  const crossClientR = await req('POST', '/api/search', {
    query: KEYX,
    client_id: cidX
  }, { Authorization: `Bearer ${proToken}` });
  assert('Search for other therapist\'s client by client_id → 403',
    crossClientR.status === 403,
    `got ${crossClientR.status}: ${JSON.stringify(crossClientR.body)}`);

  // 3c. Create a client, embed their data, revoke consent; then global search
  //     should NOT return that client's data (regression fix for consent filter bug)
  console.log('  [consent revocation test]');
  // Use timestamp to ensure this key is unique across test runs (avoids DB state collisions)
  const KEY_REVOKE = `revokedterm_393_GHOST_${Date.now()}`;
  const tgId3 = 9390000000 + tgBase * 10 + 3;
  const { clientId: cidRevoke } = await connectClient(proToken, tgId3);
  await postDiaryEntry(tgId3, `The client mentions ${KEY_REVOKE} many times in the session notes`);
  await sleep(300);

  // Verify data IS findable BEFORE revocation
  const beforeRevokeR = await req('POST', '/api/search', {
    query: KEY_REVOKE,
    limit: 10
  }, { Authorization: `Bearer ${proToken}` });
  assert('Search finds revoke-test data BEFORE consent revocation',
    beforeRevokeR.body.results?.length >= 1,
    `got ${beforeRevokeR.body.results?.length} results`);

  // Revoke consent
  const revokeR = await req('POST', '/api/bot/revoke-consent', {
    telegram_id: String(tgId3)
  }, BOT_HEADERS);
  assert('Consent revocation → 200', revokeR.status === 200,
    JSON.stringify(revokeR.body));

  // After revocation: global search MUST NOT return revoked client's data
  // (This tests the bug fix in search.js: post-search consent filter)
  const afterRevokeR = await req('POST', '/api/search', {
    query: KEY_REVOKE,
    limit: 10
  }, { Authorization: `Bearer ${proToken}` });
  assert('Search MUST NOT return revoked-consent data in global search (consent filter bug fixed)',
    afterRevokeR.body.results?.length === 0,
    `CONSENT BUG still present: got ${afterRevokeR.body.results?.length} result(s) for revoked client`);

  // After revocation: explicit client_id filter → 403 (consent_therapist_access = 0)
  const afterRevokeClientR = await req('POST', '/api/search', {
    query: KEY_REVOKE,
    client_id: cidRevoke
  }, { Authorization: `Bearer ${proToken}` });
  assert('Search with revoked client_id → 403',
    afterRevokeClientR.status === 403,
    `got ${afterRevokeClientR.status}: ${JSON.stringify(afterRevokeClientR.body)}`);

  // 3d. NL query after consent revocation — client is unlinked (therapist_id=NULL)
  //     → 403 or 404 both acceptable (data is not returned either way)
  const afterRevokeNLR = await req('POST', '/api/query', {
    client_id: cidRevoke,
    query: 'test'
  }, { Authorization: `Bearer ${proToken}` });
  assert('NL query for revoked-consent client is blocked (403 or 404)',
    afterRevokeNLR.status === 403 || afterRevokeNLR.status === 404,
    `got ${afterRevokeNLR.status}: ${JSON.stringify(afterRevokeNLR.body)}`);

  // 3e. Cross-therapist NL query isolation
  const crossNLR = await req('POST', '/api/query', {
    client_id: cidX,
    query: KEYX
  }, { Authorization: `Bearer ${proToken}` });
  assert('NL query for other therapist\'s client → 404',
    crossNLR.status === 404,
    `got ${crossNLR.status}: ${JSON.stringify(crossNLR.body)}`);

  // 3f. Audit log: verify semantic_search and nl_query entries were recorded
  const auditR = await req('POST', '/api/dev/audit-query', {
    actor_id: proId,
    action: 'semantic_search',
    limit: 5
  });
  assert('Audit log records semantic_search events',
    auditR.status === 200 && auditR.body.rows?.length >= 1,
    JSON.stringify(auditR.body));

  const auditNLR = await req('POST', '/api/dev/audit-query', {
    actor_id: proId,
    action: 'nl_query',
    limit: 5
  });
  assert('Audit log records nl_query events',
    auditNLR.status === 200 && auditNLR.body.rows?.length >= 1,
    JSON.stringify(auditNLR.body));

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4: Query latency within baseline
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n── Step 4: Query latency baseline ──');

  // Vector search (broad query, max results)
  const t2 = Date.now();
  await req('POST', '/api/search', { query: 'anxiety depression trauma', limit: 50 },
    { Authorization: `Bearer ${proToken}` });
  const vLatency = Date.now() - t2;
  assert(`Vector search latency < 500ms (got ${vLatency}ms)`, vLatency < 500);

  // NL query (full pipeline: tokenize, expand, search 3 data sources)
  const t3 = Date.now();
  await req('POST', '/api/query', { client_id: cid1, query: 'anxiety trauma sleep', limit: 50 },
    { Authorization: `Bearer ${proToken}` });
  const nLatency = Date.now() - t3;
  assert(`NL query latency < 500ms (got ${nLatency}ms)`, nLatency < 500);

  // Stats endpoint
  const t4 = Date.now();
  await req('GET', '/api/search/stats', null, { Authorization: `Bearer ${proToken}` });
  const sLatency = Date.now() - t4;
  assert(`Stats endpoint latency < 200ms (got ${sLatency}ms)`, sLatency < 200);

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
