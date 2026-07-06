#!/usr/bin/env node
// Feature #440 (S7) — Acceptance tests for seeded canned FAQ + cache scoping.

const fs = require('fs');
const path = require('path');

const TEST_DB_PATH = path.join(__dirname, '.faq_seed_s7_test.sqlite');
try { fs.unlinkSync(TEST_DB_PATH); } catch (_) {}
process.env.DB_PATH = TEST_DB_PATH;
process.env.SQLITE_PATH = TEST_DB_PATH;
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.DATABASE_URL = 'sqlite:' + TEST_DB_PATH;
process.env.NODE_ENV = 'test';

let passed = 0;
let failed = 0;
const failures = [];
function pass(m) { console.log('  PASS ', m); passed++; }
function fail(m) { console.log('  FAIL ', m); failed++; failures.push(m); }
function section(t) { console.log('\n=== ' + t + ' ==='); }

async function main() {
  section('1. faq-seed.json parses and has >=30 valid entries');
  const seedPath = path.join(__dirname, 'docs', 'assistant-kb', 'faq-seed.json');
  let seed;
  try {
    seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    pass('faq-seed.json parsed');
  } catch (e) {
    fail('faq-seed.json parse failed: ' + e.message);
    return finish();
  }
  if (!Array.isArray(seed)) return fail('seed is not an array');
  if (seed.length >= 30) pass(`>=30 entries (${seed.length})`);
  else fail(`only ${seed.length} entries (need >=30)`);
  let missingField = 0;
  for (const e of seed) {
    if (!e.id || !e.audience || !e.locale || !e.question || !e.answer) missingField++;
  }
  if (missingField === 0) pass('every entry has id/audience/locale/question/answer');
  else fail(`${missingField} entries missing required fields`);

  section('2. Init test DB + seedCannedFaq()');
  const dbConn = require('./src/backend/src/db/connection');
  await dbConn.initDatabase();
  const cache = require('./src/backend/src/services/assistantCache');

  // Inject a synthetic 'user'-only seed so we can prove audience scoping.
  const injectedSeedPath = path.join(__dirname, '.faq_seed_s7_test.json');
  const augmented = seed.slice();
  augmented.push({
    id: 'user-only-secret-workflow',
    audience: 'user',
    locale: 'en',
    question: 'How do I open the internal supervisor audit tool?',
    answer: 'That page lives under /dashboard/supervision/audit for signed-in therapists.',
    tags: ['supervision', 'internal']
  });
  fs.writeFileSync(injectedSeedPath, JSON.stringify(augmented));
  const seedStats = cache.seedCannedFaq(injectedSeedPath);
  if (seedStats.inserted >= 30) pass(`seeder inserted ${seedStats.inserted}`);
  else fail(`seeder inserted only ${seedStats.inserted}`);

  section('3. Idempotency: re-run seeder does not duplicate');
  const before = seedStats.inserted;
  const stats2 = cache.seedCannedFaq(injectedSeedPath);
  if (stats2.inserted === 0 && stats2.updated >= before) pass(`re-run inserted=0 updated=${stats2.updated}`);
  else fail(`re-run inserted=${stats2.inserted} updated=${stats2.updated}`);

  section('4. Cache hit on standard question WITHOUT AI provider call');
  // Track any accidental AI call by mocking aiProviders.chat.
  const aiProviders = require('./src/backend/src/services/aiProviders');
  let aiCalled = 0;
  const origChat = aiProviders.chat;
  aiProviders.chat = async () => { aiCalled++; return { text: 'MOCK' }; };
  const hit = cache.findCachedAnswer('How much does PR-TOP cost?', 'public', 'en');
  if (hit.hit && hit.is_seed) pass(`cache hit (id=${hit.cached_id}, seed=true, sim=${hit.similarity.toFixed(3)})`);
  else fail('cache MISS for standard pricing question — expected seed hit');
  if (aiCalled === 0) pass('no AI provider call during cache lookup');
  else fail(`AI provider called ${aiCalled} times during cache lookup`);
  aiProviders.chat = origChat;

  section('5. Audience scoping: user-only seed NEVER served to public bot');
  const publicHit = cache.findCachedAnswer('How do I open the internal supervisor audit tool?', 'public', 'en');
  if (!publicHit.hit) pass('public request → no hit on user-audience seed');
  else fail(`SECURITY: public request hit user-audience seed (id=${publicHit.cached_id})`);
  const userHit = cache.findCachedAnswer('How do I open the internal supervisor audit tool?', 'user', 'en');
  if (userHit.hit && userHit.is_seed) pass('user request → hit on user-audience seed');
  else fail('user request → no hit on its own user-audience seed');

  section('6. Locale gate: mismatched locale falls through');
  const wrongLocaleHit = cache.findCachedAnswer('How much does PR-TOP cost?', 'public', 'ru');
  if (!wrongLocaleHit.hit) pass('non-English request → no hit on English seed (falls through to LLM)');
  else fail(`locale gate failed: EN seed served for RU request (id=${wrongLocaleHit.cached_id})`);

  section('7. Route source: messageCount===0 guard removed');
  const publicRouteSrc = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/publicAssistant.js'), 'utf8');
  const userRouteSrc = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/assistant.js'), 'utf8');
  // We removed both cache-guarding conditions. Assert findCachedAnswer is
  // called unconditionally (block scope only), i.e. NOT immediately
  // preceded by a messageCount===0 or messages.filter(...) guard.
  // Only comment mentions of `messageCount === 0` should remain. A real guard
  // would look like `if (session.messageCount === 0) {` right before the cache
  // lookup — assert no such control-flow guard is present.
  if (!/if\s*\(\s*session\.messageCount\s*===\s*0\s*\)/.test(publicRouteSrc)) pass('publicAssistant.js: session.messageCount===0 guard removed');
  else fail('publicAssistant.js still guards cache on session.messageCount===0');
  if (!/if\s*\([^)]*messages\.filter\(m\s*=>\s*m\.role\s*===\s*['"]user['"]\)\.length\s*<=\s*1[^)]*\)\s*\{[\s\S]{0,200}findCachedAnswer/.test(userRouteSrc)) {
    pass('assistant.js: cache lookup no longer guarded by "<=1 user msg" check');
  } else {
    fail('assistant.js still guards cache on <=1 user-message count');
  }

  section('8. Route source: findCachedAnswer called with audience arg');
  if (/findCachedAnswer\([^)]+,\s*['"]public['"]/.test(publicRouteSrc)) pass('publicAssistant.js calls findCachedAnswer(_, "public", ...)');
  else fail('publicAssistant.js does not pass "public" audience');
  if (/findCachedAnswer\([^)]+,\s*['"]user['"]/.test(userRouteSrc)) pass('assistant.js calls findCachedAnswer(_, "user", ...)');
  else fail('assistant.js does not pass "user" audience');

  section('9. Seeded public answers pass sanitizeOutput (no secret-shaped strings)');
  const { sanitizeOutput } = require('./src/backend/src/services/assistantSanitizer');
  const leakPatterns = [
    /sk-[A-Za-z0-9]/,
    /Bearer\s+\S/,
    /_API_KEY=(?!\[REDACTED\])\S/,
    /eyJ[A-Za-z0-9_-]+\./,
  ];
  const dbConn2 = require('./src/backend/src/db/connection');
  const db = dbConn2.getDatabase();
  const rows = db.exec("SELECT answer_text FROM assistant_cached_answers WHERE is_seed = 1 AND audience = 'public'");
  let publicSeeds = 0, leaks = 0;
  if (rows.length > 0) {
    for (const r of rows[0].values) {
      publicSeeds++;
      const stored = sanitizeOutput(r[0]);
      if (leakPatterns.some(p => p.test(stored))) leaks++;
    }
  }
  if (publicSeeds > 0 && leaks === 0) pass(`${publicSeeds} public seeds all pass sanitizeOutput`);
  else fail(`${leaks}/${publicSeeds} public seeds contain secret-shaped strings`);

  try { fs.unlinkSync(injectedSeedPath); } catch (_) {}
  finish();
}

function finish() {
  console.log('\n' + '='.repeat(60));
  console.log(`FAQ SEED S7: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  - ' + f);
    try { fs.unlinkSync(TEST_DB_PATH); } catch (_) {}
    process.exit(1);
  } else {
    try { fs.unlinkSync(TEST_DB_PATH); } catch (_) {}
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(2); });
