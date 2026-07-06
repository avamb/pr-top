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
