/**
 * W6 Link-graph audit — verify all new internal links resolve to built dist/ pages.
 * Checks Solutions footer links + contextual Related blocks across all 4 locales.
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'src/frontend/dist');
const LOCALES = ['ru', 'uk', 'es'];

// All new links introduced by W6 (footer Solutions + contextual Related blocks)
const W6_LINKS = [
  // Footer Solutions column (Landing.jsx)
  '/ai-session-notes-for-therapists',
  '/ai-practice-management',
  '/for-coaches',
  '/therapy-documentation-ai',
  '/therapist-ai-assistant',
  '/hipaa-and-gdpr-for-therapy-software',
  '/coaching-session-management',
  '/client-diary-for-therapists',
  '/secure-practice-management',
  // Contextual Related blocks (BestOf + CompareUpheal + CompareMentalyc)
  '/best-ai-assistant-for-therapists',
  '/compare/upheal',
  '/compare/mentalyc',
];

// Also verify existing links in Landing.jsx contextual chip block
const LANDING_CHIPS = [
  '/',
  '/best-ai-assistant-for-therapists',
  '/ai-session-notes-for-therapists',
  '/for-coaches',
  '/therapy-documentation-ai',
  '/therapist-ai-assistant',
  '/client-diary-for-therapists',
  '/secure-practice-management',
];

function distPathFor(routePath, locale) {
  const base = locale === 'en' ? '' : '/' + locale;
  const full = base + routePath;
  if (full === '' || full === '/') return path.join(distDir, 'index.html');
  return path.join(distDir, full.replace(/^\//, ''), 'index.html');
}

let errors = 0;
let checks = 0;

function checkRoute(routePath) {
  const allLocales = ['en', ...LOCALES];
  for (const loc of allLocales) {
    const p = distPathFor(routePath, loc);
    checks++;
    if (!fs.existsSync(p)) {
      console.error('  FAIL missing: [' + loc + '] ' + routePath + ' -> ' + p);
      errors++;
    }
  }
}

console.log('=== W6 Link-Graph Audit ===');
console.log('');
console.log('Checking W6 solution links across all 4 locales...');
const allLinks = [...new Set([...W6_LINKS, ...LANDING_CHIPS])];
for (const link of allLinks) {
  checkRoute(link);
}
console.log('  Checked ' + allLinks.length + ' unique routes x 4 locales = ' + checks + ' dist files');
console.log('');

// Also spot-check the Solutions column appears in the homepage dist
const homeDist = path.join(distDir, 'index.html');
const homeHtml = fs.readFileSync(homeDist, 'utf8');
const hasAiSessionNotes = homeHtml.includes('/ai-session-notes-for-therapists');
const hasForCoaches = homeHtml.includes('/for-coaches');
const hasTherapyDoc = homeHtml.includes('/therapy-documentation-ai');
console.log('Spot-check homepage dist for Solutions links:');
console.log('  ' + (hasAiSessionNotes ? 'PASS' : 'FAIL') + '  /ai-session-notes-for-therapists in homepage HTML');
console.log('  ' + (hasForCoaches ? 'PASS' : 'FAIL') + '  /for-coaches in homepage HTML');
console.log('  ' + (hasTherapyDoc ? 'PASS' : 'FAIL') + '  /therapy-documentation-ai in homepage HTML');
if (!hasAiSessionNotes || !hasForCoaches || !hasTherapyDoc) errors++;

// Spot-check that compare/mentalyc has related links
const mentalycDist = path.join(distDir, 'compare', 'mentalyc', 'index.html');
const mentalycHtml = fs.readFileSync(mentalycDist, 'utf8');
const mentalycHasRelated = mentalycHtml.includes('/ai-session-notes-for-therapists');
const mentalycHasCoaches = mentalycHtml.includes('/for-coaches');
console.log('');
console.log('Spot-check /compare/mentalyc dist for Related links:');
console.log('  ' + (mentalycHasRelated ? 'PASS' : 'FAIL') + '  /ai-session-notes-for-therapists in mentalyc compare HTML');
console.log('  ' + (mentalycHasCoaches ? 'PASS' : 'FAIL') + '  /for-coaches in mentalyc compare HTML');
if (!mentalycHasRelated || !mentalycHasCoaches) errors++;

// Spot-check compare/upheal
const uphealDist = path.join(distDir, 'compare', 'upheal', 'index.html');
const uphealHtml = fs.readFileSync(uphealDist, 'utf8');
const uphealHasRelated = uphealHtml.includes('/ai-session-notes-for-therapists');
console.log('');
console.log('Spot-check /compare/upheal dist for Related links:');
console.log('  ' + (uphealHasRelated ? 'PASS' : 'FAIL') + '  /ai-session-notes-for-therapists in upheal compare HTML');
if (!uphealHasRelated) errors++;

// Spot-check best-of
const bestofDist = path.join(distDir, 'best-ai-assistant-for-therapists', 'index.html');
const bestofHtml = fs.readFileSync(bestofDist, 'utf8');
const bestofHasRelated = bestofHtml.includes('/for-coaches');
const bestofHasHipaa = bestofHtml.includes('/hipaa-and-gdpr-for-therapy-software');
console.log('');
console.log('Spot-check /best-ai-assistant-for-therapists dist for Related links:');
console.log('  ' + (bestofHasRelated ? 'PASS' : 'FAIL') + '  /for-coaches in best-of HTML');
console.log('  ' + (bestofHasHipaa ? 'PASS' : 'FAIL') + '  /hipaa-and-gdpr-for-therapy-software in best-of HTML');
if (!bestofHasRelated || !bestofHasHipaa) errors++;

console.log('');
console.log('======================================================');
if (errors === 0) {
  console.log('W6 LINK-GRAPH AUDIT: PASSED — ' + checks + ' checks, 0 errors');
} else {
  console.log('W6 LINK-GRAPH AUDIT: FAILED — ' + errors + ' error(s) found');
  process.exit(1);
}
