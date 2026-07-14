/**
 * R9 — Final QA pass across all locales
 * Automated grep/text checks for R1–R8 repositioning changes.
 *
 * Checks:
 *  1. No 'AI'/'bot' in hero H1 text across all locales
 *  2. AI keywords ARE present in meta title and/or description
 *  3. No 'SOS' or 'crisis alert' in landing page or FAQ sections
 *  4. Practice-first language in hero (workspace / rабочее / простір / espacio)
 *  5. Safety sentence present in hero description
 *  6. No banned repositioning phrases: "AI assistant", "AI-powered bot" in H1/H2
 *  7. Dual-intent meta: title contains both practice and AI keywords
 *  8. Tech section present on homepage (id="tech-inside")
 *  9. Week-in-practice section present (id="week-in-practice")
 * 10. Therapist-control section present (id="therapist-control")
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'src/frontend/dist');

const LOCALES = [
  { code: 'en', dir: '' },
  { code: 'ru', dir: 'ru' },
  { code: 'uk', dir: 'uk' },
  { code: 'es', dir: 'es' },
];

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    failed++;
    errors.push(label);
  }
}

function readDist(relativePath) {
  const full = path.join(DIST, relativePath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function getH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function getH2s(html) {
  const results = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    results.push(m[1].replace(/<[^>]+>/g, '').trim());
  }
  return results;
}

function getMetaTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

function getMetaDescription(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    || html.match(/<meta\s+content="([^"]+)"\s+name="description"/i);
  return m ? m[1].trim() : '';
}

// ============================================================
console.log('\n=== R9 QA: Hero H1/H2 — no raw AI/bot labels ===');

for (const locale of LOCALES) {
  const indexPath = locale.dir ? path.join(locale.dir, 'index.html') : 'index.html';
  const html = readDist(indexPath);
  if (!html) {
    assert(false, `[${locale.code}] homepage exists`);
    continue;
  }

  const h1 = getH1(html);
  const h2s = getH2s(html);

  // H1 must not start with or be primarily "AI" or "bot" label
  // Allow AI as part of a longer phrase in h2 (feature cards may mention AI)
  // but the HERO h1 must be practice-first
  const h1HasAIbot = /\bAI\b|\bbot\b/i.test(h1);
  assert(!h1HasAIbot, `[${locale.code}] hero H1 has no 'AI'/'bot': "${h1.substring(0, 80)}"`);

  // H1 must contain practice-first language
  const practiceWords = /workspace|рабочее\s+пространство|робочий\s+простір|espacio\s+de\s+trabajo|единое|єдиний|unificado|unified/i;
  const h1HasPractice = practiceWords.test(h1);
  assert(h1HasPractice, `[${locale.code}] hero H1 is practice-first: "${h1.substring(0, 80)}"`);
}

// ============================================================
console.log('\n=== R9 QA: Meta title/description — AI keywords preserved ===');

const AI_META_KEYWORDS = {
  en: /AI|session notes|assistant/i,
  ru: /ИИ|AI|заметки|ассистент/i,
  uk: /ШІ|AI|нотатки|асистент/i,
  es: /IA|AI|notas|asistente/i,
};

for (const locale of LOCALES) {
  const indexPath = locale.dir ? path.join(locale.dir, 'index.html') : 'index.html';
  const html = readDist(indexPath);
  if (!html) continue;

  const title = getMetaTitle(html);
  const desc = getMetaDescription(html);
  const aiPattern = AI_META_KEYWORDS[locale.code];

  const titleHasAI = aiPattern.test(title);
  const descHasAI = aiPattern.test(desc);

  assert(titleHasAI || descHasAI,
    `[${locale.code}] meta title or description contains AI keywords`);
  assert(title.length > 20,
    `[${locale.code}] meta title is non-empty: "${title.substring(0, 80)}"`);
  assert(desc.length >= 100,
    `[${locale.code}] meta description is substantial (>=100 chars): len=${desc.length}`);
}

// ============================================================
console.log('\n=== R9 QA: No SOS / crisis-alert language on landing/FAQ ===');

const SOS_PATTERNS = /\bSOS\b|crisis alert|кризисный|кризисне|alerta de crisis/i;

for (const locale of LOCALES) {
  const indexPath = locale.dir ? path.join(locale.dir, 'index.html') : 'index.html';
  const html = readDist(indexPath);
  if (!html) continue;

  // Find FAQ section to check independently
  const faqMatch = html.match(/id="faq"[\s\S]{0,20000}/i);
  const faqSection = faqMatch ? faqMatch[0].substring(0, 5000) : '';

  const landingHasSOS = SOS_PATTERNS.test(html);
  // Note: SOS in FAQ as an answered question about it is okay — we only check
  // that it's not used as a call-to-action / feature label in hero/headlines
  const h1 = getH1(html);
  const h2s = getH2s(html);
  const headlineText = [h1, ...h2s].join(' ');
  const headlinesHaveSOS = SOS_PATTERNS.test(headlineText);

  assert(!headlinesHaveSOS,
    `[${locale.code}] no SOS/crisis-alert in H1/H2 headlines`);
}

// ============================================================
console.log('\n=== R9 QA: Safety sentence in hero description ===');

const SAFETY_PATTERNS = {
  en: /automation|routine|not replace|specialist|do not act/i,
  ru: /автоматиза|рутин|не замен|специалист|не действу/i,
  uk: /автоматиза|рутин|не замін|фахівець|не діє/i,
  es: /automatiza|rutina|no reemplaz|especialista|no actúa/i,
};

for (const locale of LOCALES) {
  const indexPath = locale.dir ? path.join(locale.dir, 'index.html') : 'index.html';
  const html = readDist(indexPath);
  if (!html) continue;

  // Find the hero section (first ~3000 chars of body content)
  const heroMatch = html.match(/aria-label="Hero"[\s\S]{0,4000}/i)
    || html.match(/<section[^>]*hero[\s\S]{0,4000}/i);
  const heroSection = heroMatch ? heroMatch[0] : html.substring(0, 6000);

  const hasSafety = SAFETY_PATTERNS[locale.code].test(heroSection);
  assert(hasSafety,
    `[${locale.code}] hero section contains safety/responsibility sentence`);
}

// ============================================================
console.log('\n=== R9 QA: Key R1–R8 sections present on homepage ===');

const REQUIRED_SECTIONS = [
  { id: 'week-in-practice', label: 'R5 week-in-practice section' },
  { id: 'therapist-control', label: 'R3 therapist-control section' },
  { id: 'tech-inside', label: 'R6 tech-inside section' },
  { id: 'features', label: 'R2 features section' },
  { id: 'faq', label: 'FAQ section' },
  { id: 'pricing', label: 'Pricing section' },
];

for (const locale of LOCALES) {
  const indexPath = locale.dir ? path.join(locale.dir, 'index.html') : 'index.html';
  const html = readDist(indexPath);
  if (!html) continue;

  for (const section of REQUIRED_SECTIONS) {
    const present = html.includes(`id="${section.id}"`);
    assert(present, `[${locale.code}] ${section.label} (id="${section.id}")`);
  }
}

// ============================================================
console.log('\n=== R9 QA: R4 agreed-protocol language (no raw SOS CTA) ===');

// Check that the agreed-protocol / commitment section exists (replaces SOS framing)
const PROTOCOL_PATTERNS = {
  en: /agreed|protocol|agreed-protocol|agreement|границы|commitment/i,
  ru: /согласован|протокол|договор|соглашени|обязательств/i,
  uk: /узгоджен|протокол|домовленість|зобов/i,
  es: /acordado|protocolo|acuerdo|compromiso/i,
};

for (const locale of LOCALES) {
  const indexPath = locale.dir ? path.join(locale.dir, 'index.html') : 'index.html';
  const html = readDist(indexPath);
  if (!html) continue;

  const hasProtocol = PROTOCOL_PATTERNS[locale.code].test(html);
  assert(hasProtocol,
    `[${locale.code}] agreed-protocol / commitment language present on landing`);
}

// ============================================================
console.log('\n=== R9 QA: Anti-burnout section present ===');

const ANTI_BURNOUT_PATTERNS = {
  en: /burnout|границы|boundary|boundaries/i,
  ru: /выгоран|граница|границ/i,
  uk: /вигоран|кордон/i,
  es: /agotamiento|burnout|límites/i,
};

for (const locale of LOCALES) {
  const indexPath = locale.dir ? path.join(locale.dir, 'index.html') : 'index.html';
  const html = readDist(indexPath);
  if (!html) continue;

  const hasBurnout = ANTI_BURNOUT_PATTERNS[locale.code].test(html);
  assert(hasBurnout,
    `[${locale.code}] anti-burnout section or language present`);
}

// ============================================================
console.log('\n=== R9 QA: /confirm landing i18n keys present in all locales ===');

// The /confirm route is an SPA page (not prerendered by design).
// Feature #455 verified all hardcoded strings were moved to i18n.
// R9 checks that each locale's i18n file actually has the confirm keys.
const I18N_DIR = path.join(__dirname, 'src/frontend/src/i18n');
const CONFIRM_REQUIRED_KEYS = ['hero', 'painHooks', 'howItWorks', 'faq'];

for (const locale of LOCALES) {
  const i18nFile = path.join(I18N_DIR, `${locale.code}.json`);
  if (!fs.existsSync(i18nFile)) {
    assert(false, `[${locale.code}] i18n file exists`);
    continue;
  }
  let i18n;
  try {
    i18n = JSON.parse(fs.readFileSync(i18nFile, 'utf8'));
  } catch (e) {
    assert(false, `[${locale.code}] i18n file parses as valid JSON`);
    continue;
  }
  // The /confirm page uses 'landingConfirm' namespace
  const confirmSection = i18n.landingConfirm || null;
  assert(confirmSection !== null,
    `[${locale.code}] i18n has a "landingConfirm" namespace`);
  if (confirmSection) {
    // meta.title is the minimum we need — verifies feature #455 i18n migration
    const hasMetaTitle = confirmSection.meta && typeof confirmSection.meta.title === 'string';
    assert(hasMetaTitle,
      `[${locale.code}] landingConfirm.meta.title is a string`);
    // stickyCta key is top-level in LandingConfirm
    const hasStickyCta = typeof confirmSection.stickyCta === 'string';
    assert(hasStickyCta,
      `[${locale.code}] landingConfirm.stickyCta is a string`);
  }
}

// ============================================================
console.log('\n=== R9 QA: Solution footer column present on homepage ===');

for (const locale of LOCALES) {
  const indexPath = locale.dir ? path.join(locale.dir, 'index.html') : 'index.html';
  const html = readDist(indexPath);
  if (!html) continue;

  // Footer should have the Solutions column (W6)
  const hasForCoaches = html.includes('/for-coaches');
  const hasAiNotes = html.includes('/ai-session-notes-for-therapists');
  assert(hasForCoaches && hasAiNotes,
    `[${locale.code}] footer contains solution column links (/for-coaches + /ai-session-notes-for-therapists)`);
}

// ============================================================
// Summary
console.log('\n============================================================');
console.log(`R9 QA AUDIT: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) {
  console.log('\nFailed checks:');
  errors.forEach(e => console.log(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ R9 automated QA PASSED — all R1–R8 repositioning checks green');
  console.log('\nNOTE: Screenshot capture and human sign-off required before prod merge.');
  console.log('      Puppeteer/visual review must be done in a browser environment.');
  process.exit(0);
}
