#!/usr/bin/env node
// Feature #428 — F17 GEO extended audit
//
// Extends _t_seo_i18n_audit.js with GEO-specific assertions:
//   1. robots.txt contains 7 explicit AI-crawler blocks.
//   2. dist/llms.txt (if it exists — conditional until F18 lands) lists every
//      manifest route.
//   3. sitemap.xml URL count equals manifest routes × locales (16 × 4 = 64).
//   4. Every prerendered page has exactly one <h1> and a meta description of
//      length 25–160 chars.
//   5. All JSON-LD blocks on every prerendered page parse as valid JSON.
//
// Usage: node _t_geo_audit.js

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'src/frontend/dist');

const LOCALES = ['en', 'ru', 'uk', 'es'];
const PUBLIC_ROUTES = [
  '/',
  '/security/encryption',
  '/security/gdpr',
  '/security/audit-log',
  '/security/data-sovereignty',
  '/privacy',
  '/terms',
  // GEO comparison / alternatives routes — fully localized since 2026-07-06
  '/compare/upheal',
  '/alternatives/upheal',
  '/compare/mentalyc',
  '/alternatives/mentalyc',
  '/best-ai-assistant-for-therapists',
  // W4 quick-win landings batch 1 — 2026-07-12
  '/ai-session-notes-for-therapists',
  '/ai-practice-management',
  '/for-coaches',
  '/secure-practice-management',
];
// Legacy: kept for the loops below; empty since the comparison pages gained
// /ru, /uk, /es mirrors.
const EN_ONLY_ROUTES = [];

const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
  'Bingbot',
];

let passed = 0;
let failed = 0;
const failures = [];
function pass(msg) { console.log('  PASS ', msg); passed++; }
function fail(msg) { console.log('  FAIL ', msg); failed++; failures.push(msg); }
function section(t) { console.log('\n=== ' + t + ' ==='); }

function localePathFor(locale, routePath) {
  if (locale === 'en') return routePath;
  if (routePath === '/') return `/${locale}`;
  return `/${locale}${routePath}`;
}

function distFileFor(routePath) {
  if (routePath === '/') return path.join(DIST, 'index.html');
  const trimmed = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
  return path.join(DIST, trimmed, 'index.html');
}

// ---- 1. robots.txt AI-crawler blocks ----
section('1. dist/robots.txt contains 7 AI-crawler blocks');
{
  const robotsFile = path.join(DIST, 'robots.txt');
  if (!fs.existsSync(robotsFile)) {
    fail('dist/robots.txt missing (run vite build && generate-robots.mjs first)');
  } else {
    const robots = fs.readFileSync(robotsFile, 'utf8');
    for (const ua of AI_CRAWLERS) {
      const re = new RegExp('^User-agent:\\s*' + ua.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\b', 'mi');
      if (re.test(robots)) pass(`AI-crawler block present: ${ua}`);
      else fail(`AI-crawler block missing: ${ua}`);
    }
  }
}

// ---- 2. llms.txt (conditional until F18) ----
section('2. dist/llms.txt (conditional — F18)');
{
  const llmsFile = path.join(DIST, 'llms.txt');
  if (!fs.existsSync(llmsFile)) {
    // Skip cleanly — F18 has not landed yet.
    console.log('  SKIP  dist/llms.txt not present (F18 not landed) — skipping route-coverage check');
  } else {
    const llms = fs.readFileSync(llmsFile, 'utf8');
    let missing = 0;
    for (const locale of LOCALES) {
      for (const routePath of PUBLIC_ROUTES) {
        const url = 'https://pr-top.com' + localePathFor(locale, routePath);
        if (!llms.includes(url)) {
          fail(`llms.txt missing route: ${url}`);
          missing++;
        }
      }
    }
    // F20 — EN-only routes must also appear (no locale mirrors expected).
    for (const routePath of EN_ONLY_ROUTES) {
      const url = 'https://pr-top.com' + routePath;
      if (!llms.includes(url)) {
        fail(`llms.txt missing EN-only route: ${url}`);
        missing++;
      }
    }
    if (missing === 0) {
      const total = LOCALES.length * PUBLIC_ROUTES.length + EN_ONLY_ROUTES.length;
      pass(`llms.txt lists all ${total} manifest routes (localized + EN-only)`);
    }
  }
}

// ---- 3. sitemap URL count = routes × locales ----
section('3. dist/sitemap.xml URL count equals routes x locales');
{
  const smFile = path.join(DIST, 'sitemap.xml');
  if (!fs.existsSync(smFile)) {
    fail('dist/sitemap.xml missing (run generate-sitemap.mjs first)');
  } else {
    const sm = fs.readFileSync(smFile, 'utf8');
    const locMatches = sm.match(/<loc>[^<]+<\/loc>/g) || [];
    const expected = LOCALES.length * PUBLIC_ROUTES.length + EN_ONLY_ROUTES.length;
    if (locMatches.length === expected) {
      pass(`sitemap.xml has ${locMatches.length} <loc> entries (= ${LOCALES.length} locales × ${PUBLIC_ROUTES.length} routes + ${EN_ONLY_ROUTES.length} EN-only)`);
    } else {
      fail(`sitemap.xml has ${locMatches.length} <loc> entries, expected ${expected}`);
    }
    for (const routePath of EN_ONLY_ROUTES) {
      const url = 'https://pr-top.com' + routePath;
      if (sm.includes('<loc>' + url + '</loc>')) {
        pass(`sitemap.xml contains EN-only route: ${routePath}`);
      } else {
        fail(`sitemap.xml missing EN-only route: ${routePath}`);
      }
    }
  }
}

// ---- 4 & 5. Per-page: exactly one <h1>, description length 25-160, JSON-LD parses ----
section('4. Every prerendered page: exactly one <h1>, description 25-160 chars');
section('5. All JSON-LD blocks parse');

function countH1(html) {
  const m = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi);
  return m ? m.length : 0;
}
function countDescriptions(html) {
  // Count ALL <meta name="description"> occurrences — both static and helmet-injected.
  // W1: should be exactly 1 after removing the static copy from index.html.
  const re = /<meta[^>]+name=["']description["'][^>]*/gi;
  const m = html.match(re);
  return m ? m.length : 0;
}
function extractDescription(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  return m ? m[1] : null;
}
function extractJsonLdBlocks(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) blocks.push(m[1].trim());
  return blocks;
}

let pagesChecked = 0;
let h1Failures = 0;
let descFailures = 0;
let descCountFailures = 0;
let jsonLdFailures = 0;

// Per-locale description registry for W1 uniqueness check (section 6b).
// Map<locale, Map<description, localizedPath>>
const descByLocale = {};
for (const locale of LOCALES) descByLocale[locale] = new Map();

function auditPage(localizedPath, locale) {
  const file = distFileFor(localizedPath);
  if (!fs.existsSync(file)) {
    fail(`Missing prerendered file: ${localizedPath}`);
    return;
  }
  pagesChecked++;
  const html = fs.readFileSync(file, 'utf8');

  // 4a. Exactly one <h1>
  const h1Count = countH1(html);
  if (h1Count !== 1) {
    fail(`${localizedPath}: expected exactly 1 <h1>, found ${h1Count}`);
    h1Failures++;
  }

  // 4b. Description length 25–160
  const desc = extractDescription(html);
  if (!desc) {
    fail(`${localizedPath}: <meta name="description"> missing`);
    descFailures++;
  } else if (desc.length < 25 || desc.length > 160) {
    fail(`${localizedPath}: description length ${desc.length} out of 25–160 range`);
    descFailures++;
  }

  // W1(a). Exactly ONE <meta name="description"> per page (helmet owns it).
  const dCount = countDescriptions(html);
  if (dCount !== 1) {
    fail(`${localizedPath}: expected exactly 1 <meta name="description">, found ${dCount} (static+helmet duplicate?)`);
    descCountFailures++;
  }

  // Collect for W1(b) per-locale uniqueness check.
  if (desc && locale && descByLocale[locale] !== undefined) {
    descByLocale[locale].set(desc, localizedPath);
  }

  // 5. JSON-LD blocks parse
  const blocks = extractJsonLdBlocks(html);
  for (let i = 0; i < blocks.length; i++) {
    try {
      JSON.parse(blocks[i]);
    } catch (e) {
      fail(`${localizedPath}: JSON-LD block #${i + 1} does not parse: ${e.message}`);
      jsonLdFailures++;
    }
  }
}

for (const locale of LOCALES) {
  for (const routePath of PUBLIC_ROUTES) {
    auditPage(localePathFor(locale, routePath), locale);
  }
}
// F20 — EN-only routes get the same H1/description/JSON-LD checks.
for (const routePath of EN_ONLY_ROUTES) {
  auditPage(routePath, 'en');
}
if (h1Failures === 0) pass(`All ${pagesChecked} pages have exactly one <h1>`);
if (descFailures === 0) pass(`All ${pagesChecked} pages have description length 25–160`);
if (jsonLdFailures === 0) pass(`All JSON-LD blocks parse across ${pagesChecked} pages`);

// ---- 6. W1 assertions: single description + per-locale uniqueness ----
section('6. W1: single meta description per page + per-locale uniqueness');
{
  // 6a. Exactly one description per page (already counted above per page;
  // emit a single pass/fail summary here).
  if (descCountFailures === 0) {
    pass(`W1(a): all ${pagesChecked} pages have exactly ONE <meta name="description">`);
  } else {
    fail(`W1(a): ${descCountFailures} page(s) have duplicate <meta name="description"> (static + helmet)`);
  }

  // 6b. Descriptions are UNIQUE within each locale.
  // Build full per-locale arrays (including EN-only routes) so we can detect
  // two pages that share the same description text.
  // Re-collect: iterate all files and gather descriptions per locale.
  let uniquenessOk = true;
  for (const locale of LOCALES) {
    const seen = new Map(); // description -> first localizedPath
    const routes = PUBLIC_ROUTES.map((r) => localePathFor(locale, r));
    for (const lp of routes) {
      const file = distFileFor(lp);
      if (!fs.existsSync(file)) continue;
      const html = fs.readFileSync(file, 'utf8');
      const d = extractDescription(html);
      if (!d) continue;
      if (seen.has(d)) {
        fail(`W1(b): locale=${locale} duplicate description on "${lp}" and "${seen.get(d)}": "${d.substring(0, 60)}..."`);
        uniquenessOk = false;
      } else {
        seen.set(d, lp);
      }
    }
  }
  if (uniquenessOk) {
    pass(`W1(b): descriptions are unique within each locale (${LOCALES.join(', ')})`);
  }

  // 6c. Spot-assert: dist/compare/mentalyc/index.html description mentions "Mentalyc".
  {
    const f = distFileFor('/compare/mentalyc');
    if (fs.existsSync(f)) {
      const d = extractDescription(fs.readFileSync(f, 'utf8'));
      if (d && d.toLowerCase().includes('mentalyc')) {
        pass('W1(c): /compare/mentalyc description mentions "Mentalyc"');
      } else {
        fail(`W1(c): /compare/mentalyc description does not mention "Mentalyc": "${d}"`);
      }
    } else {
      fail('W1(c): dist/compare/mentalyc/index.html missing');
    }
  }

  // 6d. Spot-assert: dist/ru/index.html description is in Russian (Cyrillic).
  {
    const f = distFileFor('/ru');
    if (fs.existsSync(f)) {
      const d = extractDescription(fs.readFileSync(f, 'utf8'));
      const hasCyrillic = d && /[Ѐ-ӿ]/.test(d);
      if (hasCyrillic) {
        pass('W1(d): /ru homepage description contains Cyrillic (Russian)');
      } else {
        fail(`W1(d): /ru homepage description does not appear to be Russian: "${d}"`);
      }
    } else {
      fail('W1(d): dist/ru/index.html missing');
    }
  }
}

// ---- Summary ----
console.log('\n' + '='.repeat(60));
console.log(`GEO AUDIT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures.slice(0, 30)) console.log('  - ' + f);
  process.exit(1);
} else {
  console.log('\nF17 GEO extended audit PASSED');
  process.exit(0);
}
