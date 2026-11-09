#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'src/frontend/dist');

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log('  PASS ', label, detail || '');
    passed++;
  } else {
    console.log('  FAIL ', label, detail || '');
    failed++;
  }
}

const pages = [
  { locale: 'en', html: fs.readFileSync(path.join(DIST, 'practice-management-for-therapists/index.html'), 'utf8') },
  { locale: 'ru', html: fs.readFileSync(path.join(DIST, 'ru/practice-management-for-therapists/index.html'), 'utf8') },
  { locale: 'uk', html: fs.readFileSync(path.join(DIST, 'uk/practice-management-for-therapists/index.html'), 'utf8') },
  { locale: 'es', html: fs.readFileSync(path.join(DIST, 'es/practice-management-for-therapists/index.html'), 'utf8') },
];

console.log('\n=== R8 — practice-management-for-therapists verification ===');

pages.forEach(function(p) {
  var locale = p.locale;
  var html = p.html;

  // H1 check — no AI or bot
  var h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  var h1 = h1Match ? h1Match[1] : '';
  check('[' + locale + '] H1 has no AI/bot', !/AI|bot/i.test(h1), 'H1="' + h1.trim() + '"');

  // Meta description length 140-160
  var descMatch = html.match(/<meta name="description" content="([^"]+)"/);
  var desc = descMatch ? descMatch[1] : '';
  check('[' + locale + '] description length 140-160', desc.length >= 140 && desc.length <= 160, 'len=' + desc.length);

  // Updated stamp
  check('[' + locale + '] Updated stamp present',
    html.includes('Updated:') || html.includes('Обновлено:') || html.includes('Оновлено:') || html.includes('Actualizado:'));

  // JSON-LD parses — at least 1 block, all valid JSON
  var jsonLdMatches = Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g));
  var allParse = jsonLdMatches.length >= 1;
  jsonLdMatches.forEach(function(m) {
    try { JSON.parse(m[1]); } catch(e) { allParse = false; }
  });
  check('[' + locale + '] JSON-LD blocks (' + jsonLdMatches.length + ') present and parse', allParse);

  // FAQPage in JSON-LD
  check('[' + locale + '] FAQPage JSON-LD present', html.includes('"FAQPage"'));

  // Article JSON-LD present
  check('[' + locale + '] Article JSON-LD present', html.includes('"Article"'));
});

// Sitemap — count <loc> entries containing the path
var sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
var locMatches = Array.from(sitemap.matchAll(/<loc>([^<]*practice-management-for-therapists[^<]*)<\/loc>/g));
check('sitemap.xml has 4 <loc> entries for new route', locMatches.length === 4, 'count=' + locMatches.length);

// llms.txt
var llms = fs.readFileSync(path.join(DIST, 'llms.txt'), 'utf8');
check('llms.txt contains /practice-management-for-therapists', llms.includes('/practice-management-for-therapists'));

// H1 meta — no AI keywords in seoTitle for EN
var enHtml = pages[0].html;
var titleMatch = enHtml.match(/<title>([\s\S]*?)<\/title>/);
var title = titleMatch ? titleMatch[1] : '';
check('EN meta title has no AI keyword in it', /Practice management for therapists/i.test(title), 'title="' + title + '"');
check('EN meta title has no "AI" token', !/\bAI\b/i.test(title.split('|')[0]), 'title="' + title + '"');

console.log('\n============================');
console.log('R8 CHECK: ' + passed + ' passed, ' + failed + ' failed');
if (failed === 0) console.log('R8 PASSED');
