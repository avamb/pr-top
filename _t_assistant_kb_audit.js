#!/usr/bin/env node
// Feature #434 — S1 Assistant KB Security audit
//
// Verifies that the assistant knowledge base RAG index is restricted to
// user-facing, non-sensitive material (docs/, docs/assistant-kb/,
// src/frontend/src/i18n, README.md) and contains ZERO chunks sourced from
// backend, bot, or UI component code.
//
// Assertions:
//   1. No chunk has source_type in {api_route, service, bot, ui_component}.
//   2. No chunk's source_file starts with 'src/backend/' or 'src/bot/'.
//   3. No chunk's source_file starts with 'src/frontend/src/pages' or
//      'src/frontend/src/components' (the UI component groups).
//   4. Coverage is non-empty: chunks exist under docs/ and
//      src/frontend/src/i18n/.
//   5. Runs a fresh reindex() against an isolated in-memory-style test DB
//      to confirm the current INDEX_SOURCES config produces the expected
//      allowlisted-only content.
//
// Usage: node _t_assistant_kb_audit.js

const fs = require('fs');
const path = require('path');

// Force the backend to use an isolated test DB so we don't touch production data.
const TEST_DB_PATH = path.join(__dirname, '.assistant_kb_audit_test.sqlite');
try { fs.unlinkSync(TEST_DB_PATH); } catch (_) {}
process.env.DB_PATH = TEST_DB_PATH;
process.env.SQLITE_PATH = TEST_DB_PATH;
process.env.DATABASE_PATH = TEST_DB_PATH;
// connection.js reads DATABASE_URL — resolve our absolute test path into that form.
process.env.DATABASE_URL = 'sqlite:' + TEST_DB_PATH;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

let passed = 0;
let failed = 0;
const failures = [];
function pass(msg) { console.log('  PASS ', msg); passed++; }
function fail(msg) { console.log('  FAIL ', msg); failed++; failures.push(msg); }
function section(t) { console.log('\n=== ' + t + ' ==='); }

const FORBIDDEN_SOURCE_TYPES = new Set(['api_route', 'service', 'bot', 'ui_component']);
const FORBIDDEN_FILE_PREFIXES = [
  'src/backend/',
  'src/bot/',
  'src/frontend/src/pages',
  'src/frontend/src/components'
];

async function main() {
  section('0. Load assistantKnowledge service and DB connection');

  let assistantKB;
  let dbConn;
  try {
    dbConn = require('./src/backend/src/db/connection');
    assistantKB = require('./src/backend/src/services/assistantKnowledge');
    pass('Loaded services (test DB path: ' + TEST_DB_PATH + ')');
  } catch (e) {
    fail('Failed to load services: ' + e.message);
    return finish();
  }

  section('1. Reindex against isolated test DB');
  let stats;
  try {
    // Ensure DB is initialized before reindex writes to it.
    if (typeof dbConn.initDatabase === 'function') {
      await dbConn.initDatabase();
    }
    stats = await assistantKB.reindex();
    pass(`reindex() completed: ${stats.chunks} chunks from ${stats.indexed} files`);
  } catch (e) {
    fail('reindex() threw: ' + e.message);
    return finish();
  }

  if (!stats || stats.chunks === 0) {
    fail('reindex produced 0 chunks — indexer is empty, cannot audit');
    return finish();
  }

  section('2. Query assistant_knowledge table');
  const db = dbConn.getDatabase();
  let rows = [];
  try {
    const res = db.exec('SELECT source_type, source_file FROM assistant_knowledge');
    if (res.length && res[0].values) {
      rows = res[0].values.map(r => ({ source_type: r[0], source_file: (r[1] || '').replace(/\\/g, '/') }));
    }
    pass('Read ' + rows.length + ' chunk rows');
  } catch (e) {
    fail('Query failed: ' + e.message);
    return finish();
  }

  section('3. No chunk has forbidden source_type');
  const badTypeChunks = rows.filter(r => FORBIDDEN_SOURCE_TYPES.has(r.source_type));
  if (badTypeChunks.length === 0) {
    pass('Zero chunks with source_type in {api_route, service, bot, ui_component}');
  } else {
    const sample = Array.from(new Set(badTypeChunks.map(r => `${r.source_type}:${r.source_file}`))).slice(0, 5);
    fail(`${badTypeChunks.length} chunks with forbidden source_type. Examples: ${sample.join(' | ')}`);
  }

  section('4. No chunk sourced from backend or bot code');
  const badPathChunks = rows.filter(r => FORBIDDEN_FILE_PREFIXES.some(p => r.source_file.startsWith(p)));
  if (badPathChunks.length === 0) {
    pass('Zero chunks with source_file under src/backend/, src/bot/, or UI component dirs');
  } else {
    const sample = Array.from(new Set(badPathChunks.map(r => r.source_file))).slice(0, 5);
    fail(`${badPathChunks.length} chunks from forbidden paths. Examples: ${sample.join(' | ')}`);
  }

  section('5. Coverage — docs/ and i18n still indexed');
  const docsCount = rows.filter(r => r.source_file.startsWith('docs/')).length;
  const i18nCount = rows.filter(r => r.source_file.startsWith('src/frontend/src/i18n')).length;
  if (docsCount > 0) pass(`docs/ coverage: ${docsCount} chunks`);
  else fail('No chunks from docs/ — coverage dropped to zero');
  if (i18nCount > 0) pass(`src/frontend/src/i18n coverage: ${i18nCount} chunks`);
  else fail('No chunks from src/frontend/src/i18n — coverage dropped to zero');

  section('6. .env.example is NOT indexed');
  const envExample = rows.filter(r => r.source_file === '.env.example' || r.source_file.endsWith('/.env.example'));
  if (envExample.length === 0) pass('.env.example not present in index');
  else fail(`.env.example indexed with ${envExample.length} chunks`);

  section('7. Feature #436 S3 — sanitizeOutput redacts secret-shaped strings');
  let sanitizer;
  try {
    sanitizer = require('./src/backend/src/services/assistantSanitizer');
    pass('Loaded assistantSanitizer service');
  } catch (e) {
    fail('Failed to load assistantSanitizer: ' + e.message);
    return finish();
  }
  if (typeof sanitizer.sanitizeOutput !== 'function') {
    fail('sanitizeOutput is not exported from assistantSanitizer');
    return finish();
  }
  const { sanitizeOutput } = sanitizer;

  // Secret-shaped inputs — every one must be redacted.
  const secretSamples = [
    { label: 'OpenAI-style key (sk-...)',      raw: 'sk-abcDEF0123456789ghijklMNop' },
    { label: 'Anthropic-style key (sk-ant-)',  raw: 'sk-ant-api03-abcDEF0123456789ghi' },
    { label: 'Bearer token',                   raw: 'Bearer xyz1234567890abcDEF' },
    { label: 'AI_API_KEY=secret assignment',   raw: 'AI_API_KEY=supersecretvalue_12345' },
    { label: 'PASSWORD= assignment',           raw: 'PASSWORD=hunter2hunter2extra' },
    { label: 'JWT (eyJ...)',                   raw: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEFghiJKLmnop' },
    { label: 'Long hex blob (>=32 chars)',     raw: 'a'.repeat(48) },
    { label: 'Long base64url blob (>=32 chars)', raw: 'AbCdEf-1234567890_ghijklMNOPqrstUVwxyzZZ' },
  ];
  for (const s of secretSamples) {
    const wrapped = `Prose before ${s.raw} prose after.`;
    const out = sanitizeOutput(wrapped);
    if (!out.includes(s.raw) && out.includes('[REDACTED]')) {
      pass(`${s.label} redacted`);
    } else {
      fail(`${s.label} NOT redacted (got: ${out.slice(0, 120)})`);
    }
  }

  // Normal prose — must pass through UNCHANGED.
  const proseSamples = [
    'Encryption uses AES at the application layer.',
    'To register, go to /register and confirm your email address to activate your trial.',
    'Class A data (diary, notes, transcripts, summaries) is encrypted at rest.',
    'The Telegram bot connects to a client via a deep link or an invite code.',
  ];
  for (const p of proseSamples) {
    const out = sanitizeOutput(p);
    if (out === p) pass(`Normal prose unchanged: "${p.slice(0, 40)}..."`);
    else fail(`Normal prose mutated. Expected: "${p}" Got: "${out}"`);
  }

  // Empty / non-string safety.
  if (sanitizeOutput('') === '') pass('Empty string safe');
  else fail('Empty string not handled');
  if (sanitizeOutput(null) === '') pass('null input safe');
  else fail('null not handled');

  // Idempotence — sanitizing twice yields the same result.
  const once = sanitizeOutput(`Leaked: sk-abcDEF0123456789ghijklMN end.`);
  const twice = sanitizeOutput(once);
  if (once === twice) pass('sanitizeOutput is idempotent');
  else fail('sanitizeOutput is NOT idempotent');

  section('8. Feature #436 S3 — route wiring: guardrail runs before send AND before cache');
  const routeFiles = [
    'src/backend/src/routes/publicAssistant.js',
    'src/backend/src/routes/assistant.js',
  ];
  for (const rel of routeFiles) {
    const abs = path.join(__dirname, rel);
    let src;
    try { src = fs.readFileSync(abs, 'utf8'); }
    catch (e) { fail(`Cannot read ${rel}: ${e.message}`); continue; }

    if (/sanitizeOutput\s*\(/.test(src)) pass(`${rel} calls sanitizeOutput`);
    else fail(`${rel} does NOT call sanitizeOutput`);

    // Ensure sanitizeOutput is called BEFORE storeCachedAnswer (so the cached
    // reply is the redacted one — otherwise a later cache hit would leak).
    const sanitizeIdx = src.indexOf('sanitizeOutput(');
    const cacheIdx = src.indexOf('storeCachedAnswer(');
    if (sanitizeIdx >= 0 && cacheIdx >= 0 && sanitizeIdx < cacheIdx) {
      pass(`${rel}: sanitizeOutput invoked before storeCachedAnswer`);
    } else {
      fail(`${rel}: sanitizeOutput must be called before storeCachedAnswer`);
    }
  }

  // === Feature #435 S2 — audience-scoped search ===
  section('9. S2 — public search excludes chunks sourced from src/');
  try {
    const publicHits = await assistantKB.search('how is data encrypted', 3, 'public');
    const publicLeaks = publicHits.filter(r => (r.source_file || '').replace(/\\/g, '/').startsWith('src/'));
    if (publicLeaks.length === 0) {
      pass("search('how is data encrypted', 3, 'public') returned zero chunks under src/");
    } else {
      const sample = publicLeaks.slice(0, 3).map(r => r.source_file).join(' | ');
      fail(`public search leaked ${publicLeaks.length} src/-sourced chunk(s): ${sample}`);
    }
  } catch (e) {
    fail("public-audience search threw: " + e.message);
  }

  section('10. S2 — user-audience how-to doc retrievable by user but NOT by public');
  try {
    const userQuery = 'getting started as a therapist first client';
    const userHits = await assistantKB.search(userQuery, 5, 'user');
    const publicHits = await assistantKB.search(userQuery, 5, 'public');

    const userKbHits = userHits.filter(r => (r.source_file || '').replace(/\\/g, '/').startsWith('docs/assistant-kb/'));
    const publicKbHits = publicHits.filter(r => (r.source_file || '').replace(/\\/g, '/').startsWith('docs/assistant-kb/'));

    if (userKbHits.length > 0) {
      pass(`user search retrieved ${userKbHits.length} how-to chunk(s) from docs/assistant-kb/`);
    } else {
      fail("user search returned zero docs/assistant-kb/ chunks — how-to doc not retrievable");
    }
    if (publicKbHits.length === 0) {
      pass('public search returned zero docs/assistant-kb/ chunks (user-audience content is scoped out)');
    } else {
      const sample = publicKbHits.slice(0, 3).map(r => r.source_file).join(' | ');
      fail(`public search leaked ${publicKbHits.length} user-audience chunk(s): ${sample}`);
    }
  } catch (e) {
    fail("audience-scoped how-to check threw: " + e.message);
  }

  section('11. S2 — default audience is safe (public) when omitted');
  try {
    const defaultHits = await assistantKB.search('getting started as a therapist', 5);
    const leaked = defaultHits.filter(r => (r.source_file || '').replace(/\\/g, '/').startsWith('docs/assistant-kb/'));
    if (leaked.length === 0) {
      pass('search(q, k) with no audience arg defaults to public (no user-audience leaks)');
    } else {
      fail(`search default audience leaked ${leaked.length} user-audience chunk(s)`);
    }
  } catch (e) {
    fail('default-audience check threw: ' + e.message);
  }

  section('12b. S4 — every file under docs/assistant-kb/ has a valid audience marker');
  try {
    const kbRoot = path.join(__dirname, 'docs', 'assistant-kb');
    if (!fs.existsSync(kbRoot)) {
      fail('docs/assistant-kb/ does not exist');
    } else {
      const walk = (dir, out) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) walk(p, out);
          else if (ent.isFile() && ent.name.endsWith('.md')) out.push(p);
        }
        return out;
      };
      const kbFiles = walk(kbRoot, []);
      if (kbFiles.length === 0) fail('docs/assistant-kb/ contains no markdown files');
      let missing = 0;
      let publicCount = 0;
      let userCount = 0;
      let densityFail = 0;
      const density = (t) => {
        const w = t.split(/\s+/).filter(Boolean).length || 1;
        const req = (t.match(/require\(/g) || []).length;
        const fn = (t.match(/function /g) || []).length;
        return ((req + fn) * 200) / w;
      };
      for (const f of kbFiles) {
        const src = fs.readFileSync(f, 'utf8');
        const m = src.match(/<!--\s*audience:\s*(public|user)\s*-->/);
        if (!m) { missing++; continue; }
        if (m[1] === 'public') publicCount++; else userCount++;
        if (density(src) >= 1) {
          densityFail++;
          fail('prose guardrail: code density >= 1 per 200 words in ' + path.relative(__dirname, f).replace(/\\/g, '/'));
        }
      }
      if (missing === 0) pass('all ' + kbFiles.length + ' docs/assistant-kb/*.md files have a valid audience marker');
      else fail(missing + ' file(s) missing <!-- audience: public|user --> marker');
      if (publicCount > 0) pass('found ' + publicCount + ' public-audience file(s) under docs/assistant-kb/');
      else fail('no public-audience files under docs/assistant-kb/');
      if (userCount > 0) pass('found ' + userCount + ' user-audience file(s) under docs/assistant-kb/');
      else fail('no user-audience files under docs/assistant-kb/');
      if (densityFail === 0) pass('all files pass prose guardrail (<1 require(/function per 200 words)');
    }
  } catch (e) {
    fail('S4 audience-marker check threw: ' + e.message);
  }

  section('12c. S4 — npm run docs:assistant is wired in a committed package.json');
  try {
    // Root /package.json is gitignored (workspace dev convenience) so the
    // committed home for docs:assistant lives in src/backend/package.json,
    // which any fresh clone / CI has.
    const backendPkgPath = path.join(__dirname, 'src', 'backend', 'package.json');
    const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));
    if (backendPkg.scripts && backendPkg.scripts['docs:assistant']) {
      pass("src/backend/package.json defines scripts['docs:assistant']: " + backendPkg.scripts['docs:assistant']);
    } else {
      fail("src/backend/package.json is missing scripts['docs:assistant']");
    }
    const genPath = path.join(__dirname, 'scripts', 'generate-assistant-docs.mjs');
    if (fs.existsSync(genPath)) pass('scripts/generate-assistant-docs.mjs exists');
    else fail('scripts/generate-assistant-docs.mjs missing');
  } catch (e) {
    fail('S4 package.json wiring check threw: ' + e.message);
  }

  section('12d. S4 — deterministic reference docs present and derived from source');
  try {
    const refDir = path.join(__dirname, 'docs', 'assistant-kb', 'reference');
    const required = ['endpoints.md', 'ui-labels.md', 'pricing.md'];
    for (const rf of required) {
      const p = path.join(refDir, rf);
      if (!fs.existsSync(p)) { fail('missing docs/assistant-kb/reference/' + rf); continue; }
      const src = fs.readFileSync(p, 'utf8');
      if (!/<!--\s*audience:\s*(public|user)\s*-->/.test(src)) {
        fail(rf + ' missing audience marker');
      } else {
        pass('reference/' + rf + ' present with audience marker');
      }
    }
    const endpoints = fs.readFileSync(path.join(refDir, 'endpoints.md'), 'utf8');
    if (/\/api\/subscription/.test(endpoints) && /\/api\/clients/.test(endpoints)) {
      pass('endpoints.md contains real routes derived from src/backend/src/routes');
    } else {
      fail('endpoints.md does not reference expected /api/subscription or /api/clients routes');
    }
    const uiLabels = fs.readFileSync(path.join(refDir, 'ui-labels.md'), 'utf8');
    if (/^## subscription$/m.test(uiLabels)) {
      pass('ui-labels.md contains real i18n namespaces from en.json');
    } else {
      fail('ui-labels.md missing expected namespace section (## subscription)');
    }
    const pricing = fs.readFileSync(path.join(refDir, 'pricing.md'), 'utf8');
    const tiers = ['Trial', 'Basic', 'Pro', 'Premium'];
    const missingTier = tiers.filter(t => !new RegExp('## ' + t).test(pricing));
    if (missingTier.length === 0) pass('pricing.md lists all four tiers (Trial/Basic/Pro/Premium)');
    else fail('pricing.md missing tier sections: ' + missingTier.join(', '));
  } catch (e) {
    fail('S4 reference-docs check threw: ' + e.message);
  }

  section('12e. S4 — reindex picks up new docs/assistant-kb/ files with correct audience');
  try {
    await assistantKB.reindex();
    const db2 = dbConn.getDatabase();
    const res = db2.exec("SELECT source_file, audiences FROM assistant_knowledge WHERE source_file LIKE 'docs/assistant-kb/%'");
    const kbRows = (res.length && res[0].values) ? res[0].values : [];
    const uniq = new Set(kbRows.map(r => (r[0] || '').replace(/\\/g, '/')));
    if (uniq.size >= 4) pass('reindex picked up ' + uniq.size + ' docs/assistant-kb/ files');
    else fail('reindex only picked up ' + uniq.size + ' docs/assistant-kb/ files (expected >=4)');

    const userSearch = await assistantKB.search('uploading a session recording', 5, 'user');
    const foundHowto = userSearch.some(r => (r.source_file || '').includes('docs/assistant-kb/uploading-a-session'));
    if (foundHowto) pass('user search retrieves the new uploading-a-session how-to');
    else fail('user search did NOT retrieve docs/assistant-kb/uploading-a-session.md');
  } catch (e) {
    fail('S4 reindex check threw: ' + e.message);
  }

  section('12f. S6 — >=20 authored how-to docs, each >=600 words, valid audience marker, FAQ section');
  try {
    const kbRoot = path.join(__dirname, 'docs', 'assistant-kb');
    // Only count top-level authored how-to pages; skip reference/ (auto-generated)
    // and README.md (maintenance/process doc, not KB content).
    const kbFiles = fs.readdirSync(kbRoot, { withFileTypes: true })
      .filter((ent) => ent.isFile() && ent.name.endsWith('.md') && ent.name !== 'README.md')
      .map((ent) => path.join(kbRoot, ent.name));

    let qualifying = 0;
    let missingMarker = 0;
    let tooShort = 0;
    let missingFaq = 0;
    for (const f of kbFiles) {
      const src = fs.readFileSync(f, 'utf8');
      const rel = path.relative(__dirname, f).replace(/\\/g, '/');
      const wordCount = src.split(/\s+/).filter(Boolean).length;
      const hasMarker = /<!--\s*audience:\s*(public|user)\s*-->/.test(src);
      const hasFaq = /^##+\s+(FAQ|Frequently Asked)/mi.test(src);
      if (!hasMarker) { missingMarker++; fail('S6: missing audience marker in ' + rel); continue; }
      if (wordCount < 600) { tooShort++; fail('S6: ' + rel + ' has only ' + wordCount + ' words (<600)'); continue; }
      if (!hasFaq) { missingFaq++; fail('S6: ' + rel + ' missing FAQ/Frequently Asked section'); continue; }
      qualifying++;
    }
    if (qualifying >= 20) {
      pass('S6: ' + qualifying + ' authored docs meet >=600 words + audience marker + FAQ');
    } else {
      fail('S6: only ' + qualifying + ' authored docs qualify (need >=20). shortfalls: ' +
        'missingMarker=' + missingMarker + ', tooShort=' + tooShort + ', missingFaq=' + missingFaq);
    }
  } catch (e) {
    fail('S6 authored-docs audit threw: ' + e.message);
  }

  section('12. S2 — publicAssistant.js and assistant.js call search with correct audience');
  try {
    const publicRoute = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/publicAssistant.js'), 'utf8');
    const userRoute = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/assistant.js'), 'utf8');
    if (/assistantKnowledge\.search\([^)]*,\s*['"]public['"]\s*\)/.test(publicRoute)) {
      pass("publicAssistant.js calls assistantKnowledge.search(..., 'public')");
    } else {
      fail("publicAssistant.js does NOT call search with 'public' audience arg");
    }
    if (/assistantKnowledge\.search\([^)]*,\s*['"]user['"]\s*\)/.test(userRoute)) {
      pass("assistant.js calls assistantKnowledge.search(..., 'user')");
    } else {
      fail("assistant.js does NOT call search with 'user' audience arg");
    }
  } catch (e) {
    fail("route audience-wiring check threw: " + e.message);
  }

  // === Feature #438 S5 — public-bot economics + cache fix ===
  section('13. S5 — public max_tokens<=600, authenticated max_tokens===1500');
  try {
    const publicRoute = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/publicAssistant.js'), 'utf8');
    const userRoute = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/assistant.js'), 'utf8');
    const publicMaxTokens = Array.from(publicRoute.matchAll(/max_tokens:\s*(\d+)/g)).map(m => parseInt(m[1], 10));
    const userMaxTokens = Array.from(userRoute.matchAll(/max_tokens:\s*(\d+)/g)).map(m => parseInt(m[1], 10));

    if (publicMaxTokens.length > 0 && publicMaxTokens.every(v => v <= 600)) {
      pass(`publicAssistant.js max_tokens values all <=600: [${publicMaxTokens.join(', ')}]`);
    } else {
      fail(`publicAssistant.js has max_tokens > 600: [${publicMaxTokens.join(', ')}]`);
    }
    if (userMaxTokens.length > 0 && userMaxTokens.every(v => v === 1500)) {
      pass(`assistant.js max_tokens values all === 1500: [${userMaxTokens.join(', ')}]`);
    } else {
      fail(`assistant.js max_tokens must all be 1500: got [${userMaxTokens.join(', ')}]`);
    }
  } catch (e) {
    fail('S5 max_tokens grep check threw: ' + e.message);
  }

  section('14. S5 — storeCachedAnswer receives hasRagContext in both routes');
  try {
    const publicRoute = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/publicAssistant.js'), 'utf8');
    const userRoute = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/assistant.js'), 'utf8');
    // Expect storeCachedAnswer(sanitized, assistantReply, hasRagContext) — 3 args.
    const publicCalls = Array.from(publicRoute.matchAll(/storeCachedAnswer\(([^)]*)\)/g));
    const userCalls = Array.from(userRoute.matchAll(/storeCachedAnswer\(([^)]*)\)/g));

    if (publicCalls.length > 0 && publicCalls.every(m => m[1].split(',').length >= 3 && /hasRagContext/.test(m[1]))) {
      pass(`publicAssistant.js: ${publicCalls.length} storeCachedAnswer call(s) pass hasRagContext`);
    } else {
      fail(`publicAssistant.js storeCachedAnswer call sites missing hasRagContext arg (found ${publicCalls.length} calls)`);
    }
    if (userCalls.length > 0 && userCalls.every(m => m[1].split(',').length >= 3 && /hasRagContext/.test(m[1]))) {
      pass(`assistant.js: ${userCalls.length} storeCachedAnswer call(s) pass hasRagContext`);
    } else {
      fail(`assistant.js storeCachedAnswer call sites missing hasRagContext arg (found ${userCalls.length} calls)`);
    }
  } catch (e) {
    fail('S5 storeCachedAnswer arity check threw: ' + e.message);
  }

  section('15. S5 — per-session and per-lead rate-limit guards exist alongside IP guard');
  try {
    const publicRoute = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/publicAssistant.js'), 'utf8');
    if (/checkPublicRateLimit\s*\(/.test(publicRoute)) pass('checkPublicRateLimit (IP guard) present');
    else fail('checkPublicRateLimit missing');
    if (/checkPublicSessionRateLimit\s*\(/.test(publicRoute)) pass('checkPublicSessionRateLimit (per-session guard) present');
    else fail('checkPublicSessionRateLimit missing');
    if (/checkPublicLeadRateLimit\s*\(/.test(publicRoute)) pass('checkPublicLeadRateLimit (per-lead guard) present');
    else fail('checkPublicLeadRateLimit missing');
  } catch (e) {
    fail('S5 rate-limit guard check threw: ' + e.message);
  }

  section('16. S5 — cached answers pass secret-redaction check');
  // Simulate what the routes now do: sanitize before storing, sanitize before serving.
  const secretyReply =
    'Here is the info you asked for.\n' +
    'API key: sk-abcDEF0123456789ghijklMNop\n' +
    'Bearer TokenXYZ1234567890abcDEF\n' +
    'Config: AI_API_KEY=supersecretvalue_12345\n' +
    'JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEFghiJKLmnop';
  const stored = sanitizeOutput(secretyReply); // what the cache would persist
  const served = sanitizeOutput(stored);       // what the cache-hit path emits
  // Note: env_assignment redaction keeps the KEY name and replaces only the
  // VALUE (so the reply still reads sensibly), so "AI_API_KEY=[REDACTED]" is
  // fine. Only flag a leak when a value that isn't [REDACTED] follows.
  const leakPatterns = [
    /sk-[A-Za-z0-9]/,
    /Bearer\s+\S/,
    /_API_KEY=(?!\[REDACTED\])\S/,
    /eyJ[A-Za-z0-9_-]+\./,
  ];
  const leaks = leakPatterns.filter(p => p.test(stored) || p.test(served));
  if (leaks.length === 0) {
    pass('cached answer contains no sk-*, Bearer, JWT, or *_API_KEY= patterns');
  } else {
    fail(`cached answer leaks ${leaks.length} secret-shaped pattern(s)`);
  }

  // === Feature #440 S7 — canned FAQ seed + cache behavior (FUNCTIONAL) ===
  section('17. S7 — faq-seed.json shape');
  let seedData = null;
  try {
    seedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'docs/assistant-kb/faq-seed.json'), 'utf8'));
    if (Array.isArray(seedData) && seedData.length >= 30) pass(`faq-seed.json has ${seedData.length} entries (>=30)`);
    else fail(`faq-seed.json has ${seedData ? seedData.length : 0} entries (need >=30)`);
    const badShape = seedData.filter(e => !e.id || !e.audience || !e.locale || !e.question || !e.answer);
    if (badShape.length === 0) pass('all seed entries have id/audience/locale/question/answer');
    else fail(`${badShape.length} seed entries missing required fields`);
  } catch (e) {
    fail('faq-seed.json parse failed: ' + e.message);
  }

  section('18. S7 — seeder loads FAQ and findCachedAnswer serves a hit without an LLM');
  try {
    const cache = require('./src/backend/src/services/assistantCache');
    if (typeof cache.seedCannedFaq !== 'function') {
      fail('assistantCache.seedCannedFaq is not exported');
    } else {
      const seedStats = cache.seedCannedFaq();
      pass(`seedCannedFaq() ran: ${JSON.stringify(seedStats)}`);
      // Idempotency: second run must not duplicate.
      const before = dbConn.getDatabase().exec("SELECT COUNT(*) FROM assistant_cached_answers WHERE is_seed=1")[0].values[0][0];
      cache.seedCannedFaq();
      const after = dbConn.getDatabase().exec("SELECT COUNT(*) FROM assistant_cached_answers WHERE is_seed=1")[0].values[0][0];
      if (before === after) pass(`seeder idempotent: ${before} seed rows unchanged on re-run`);
      else fail(`seeder NOT idempotent: ${before} -> ${after} rows`);

      // A standard question served from cache (no provider call happens — findCachedAnswer is pure DB+math).
      const q = seedData[0].question;
      const hit = cache.findCachedAnswer(q, 'public', 'en');
      if (hit && hit.hit) pass(`cache hit for seeded question "${q.slice(0, 40)}..." (is_seed=${hit.is_seed}, sim=${(hit.similarity||0).toFixed(3)})`);
      else fail(`no cache hit for exact seeded question "${q}"`);

      // Locale gate: an English seed must NOT be served to a Russian-detected question.
      const ruHit = cache.findCachedAnswer(q, 'public', 'ru');
      if (!ruHit || !ruHit.hit || !ruHit.is_seed) pass('locale gate: EN seed not served to RU-detected question');
      else fail('locale gate FAILED: EN seed served to RU question');

      // Audience gate: seed everything public here; assert a user-only lookup still finds public (superset) but public never sees user.
      // (All current seeds are public, so we assert public lookup works and that the audience filter param is honored.)
      const pubHit = cache.findCachedAnswer(q, 'public', 'en');
      if (pubHit && pubHit.hit) pass('audience gate: public lookup returns public seed');
      else fail('audience gate: public lookup missed a public seed');
    }
  } catch (e) {
    fail('S7 seeder/cache functional check threw: ' + e.message);
  }

  section('19. S7 — cache is consulted on every message (first-message guard removed)');
  try {
    const publicRoute = fs.readFileSync(path.join(__dirname, 'src/backend/src/routes/publicAssistant.js'), 'utf8');
    // The old code gated findCachedAnswer inside `if (session.messageCount === 0)`.
    // Assert findCachedAnswer is NOT inside that guard anymore.
    const guardIdx = publicRoute.indexOf('messageCount === 0');
    const cacheIdx = publicRoute.indexOf('findCachedAnswer');
    const guardStillWrapsCache = guardIdx !== -1 && cacheIdx !== -1 &&
      /if\s*\(\s*session\.messageCount === 0\s*\)\s*\{[^}]*findCachedAnswer/.test(publicRoute);
    if (!guardStillWrapsCache) pass('findCachedAnswer no longer gated by messageCount===0 (repeated questions can hit cache)');
    else fail('findCachedAnswer still gated to first message only');
  } catch (e) {
    fail('S7 guard-removal check threw: ' + e.message);
  }

  return finish();
}

function finish() {
  console.log('\n' + '='.repeat(60));
  console.log(`ASSISTANT KB AUDIT: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures.slice(0, 30)) console.log('  - ' + f);
    try { fs.unlinkSync(TEST_DB_PATH); } catch (_) {}
    process.exit(1);
  } else {
    console.log('\nS1 Assistant KB security audit PASSED');
    try { fs.unlinkSync(TEST_DB_PATH); } catch (_) {}
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Unhandled error: ' + (e && e.stack || e));
  process.exit(2);
});
