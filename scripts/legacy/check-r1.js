/**
 * R1 acceptance checks:
 * 1. heroTitle1+heroTitle2 for all 4 locales contain no 'AI'/'bot' tokens
 * 2. seo.home.title contains AI keywords in all 4 locales
 * 3. Safety sentence present in heroDesc for all 4 locales
 */
const fs = require('fs');
const path = require('path');

const locales = [
  { code: 'en', file: 'src/frontend/src/i18n/en.json', aiBot: /\bAI\b|\bbot\b/i, aiCheck: /AI/i, safetyPhrase: 'do not act on their behalf' },
  { code: 'ru', file: 'src/frontend/src/i18n/ru.json', aiBot: /\bAI\b|\bИИ\b|\bбот\b/i, aiCheck: /ИИ|AI/i, safetyPhrase: 'не действуют от его имени' },
  { code: 'uk', file: 'src/frontend/src/i18n/uk.json', aiBot: /\bAI\b|\bШІ\b|\bбот\b/i, aiCheck: /ШІ|AI/i, safetyPhrase: 'не діють від його імені' },
  { code: 'es', file: 'src/frontend/src/i18n/es.json', aiBot: /\bIA\b|\bbot\b/i, aiCheck: /IA/i, safetyPhrase: 'actúan en su nombre' },
];

let pass = 0;
let fail = 0;

for (const loc of locales) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, loc.file), 'utf8'));
  const landing = data.landing;
  const seo = data.seo.home;

  const heroH1 = (landing.heroTitle1 || '') + ' ' + (landing.heroTitle2 || '');
  const heroDesc = landing.heroDesc || '';
  const seoTitle = seo.title || '';

  // Check 1: H1 has no AI/bot
  if (loc.aiBot.test(heroH1)) {
    process.stdout.write('[' + loc.code.toUpperCase() + '] FAIL: H1 contains AI/bot: "' + heroH1 + '"\n');
    fail++;
  } else {
    process.stdout.write('[' + loc.code.toUpperCase() + '] PASS: H1 has no AI/bot: "' + heroH1 + '"\n');
    pass++;
  }

  // Check 2: seo.home.title has AI keywords
  if (!loc.aiCheck.test(seoTitle)) {
    process.stdout.write('[' + loc.code.toUpperCase() + '] FAIL: title missing AI keyword: "' + seoTitle + '"\n');
    fail++;
  } else {
    process.stdout.write('[' + loc.code.toUpperCase() + '] PASS: title has AI keyword: "' + seoTitle.substring(0, 80) + '..."\n');
    pass++;
  }

  // Check 3: safety sentence in heroDesc
  if (!heroDesc.includes(loc.safetyPhrase)) {
    process.stdout.write('[' + loc.code.toUpperCase() + '] FAIL: heroDesc missing safety phrase "' + loc.safetyPhrase + '"\n');
    process.stdout.write('       heroDesc: "' + heroDesc + '"\n');
    fail++;
  } else {
    process.stdout.write('[' + loc.code.toUpperCase() + '] PASS: heroDesc has safety phrase\n');
    pass++;
  }
}

process.stdout.write('\nR1 checks: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
