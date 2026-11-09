/**
 * R18 verification: hero image present in all 4 locale builds
 * Checks:
 *  1. hero-dashboard.webp referenced in <img> tag
 *  2. Old inline SVG viewBox="0 0 500 400" is gone
 *  3. Alt text is non-empty and locale-appropriate
 *  4. Image file exists on disk
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'src', 'frontend', 'dist');
const IMG = path.join(__dirname, 'src', 'frontend', 'public', 'images', 'hero-dashboard.webp');

let pass = 0;
let fail = 0;

function check(label, value) {
  if (value) {
    console.log('  PASS: ' + label);
    pass++;
  } else {
    console.error('  FAIL: ' + label);
    fail++;
  }
}

// 1. Image file exists and has reasonable size
const imgExists = fs.existsSync(IMG);
const imgSize = imgExists ? fs.statSync(IMG).size : 0;
console.log('\n--- Image file ---');
check('hero-dashboard.webp exists', imgExists);
check('file size > 10 KB', imgSize > 10000);
if (imgExists) console.log('  size: ' + Math.round(imgSize / 1024) + ' KB');

// 2. Check all 4 locales
const locales = [
  { code: 'EN', file: path.join(DIST, 'index.html') },
  { code: 'RU', file: path.join(DIST, 'ru', 'index.html') },
  { code: 'UK', file: path.join(DIST, 'uk', 'index.html') },
  { code: 'ES', file: path.join(DIST, 'es', 'index.html') },
];

// Alt text patterns for each locale
const altPatterns = {
  EN: /dashboard.*demo|demo.*dashboard/i,
  RU: /рабочий стол|демо/i,
  UK: /робочий стіл|демо/i,
  ES: /panel.*demo|demo.*panel/i,
};

for (const { code, file } of locales) {
  console.log('\n--- ' + code + ' ---');
  if (!fs.existsSync(file)) {
    console.error('  FAIL: file not found: ' + file);
    fail++;
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');

  check('hero-dashboard.webp in HTML', html.includes('hero-dashboard.webp'));
  check('old SVG viewBox="0 0 500 400" removed', !html.includes('viewBox="0 0 500 400"'));

  // Extract alt text from the img tag
  const imgTagMatch = html.match(/src="\/images\/hero-dashboard\.webp"[^>]*>/);
  if (imgTagMatch) {
    const altMatch = imgTagMatch[0].match(/alt="([^"]*)"/);
    const altText = altMatch ? altMatch[1] : '';
    check('img has non-empty alt text', altText.length > 10);
    const pattern = altPatterns[code];
    if (pattern) {
      check('alt text matches locale (' + code + ')', pattern.test(altText));
    }
    console.log('  alt: "' + altText.slice(0, 80) + '"');
  } else {
    // try different attribute order
    const altDirect = html.match(/alt="([^"]{10,})"[^>]*src="\/images\/hero-dashboard\.webp"/);
    if (altDirect) {
      check('img has non-empty alt text', true);
      console.log('  alt: "' + altDirect[1].slice(0, 80) + '"');
    } else {
      check('img tag found in HTML', false);
    }
  }

  check('data-testid="hero-illustration" present', html.includes('data-testid="hero-illustration"'));
}

// 3. Verify no real PII patterns in mockup
console.log('\n--- Data safety check ---');
const mockupPath = path.join(__dirname, '_r18_dashboard_mockup.html');
if (fs.existsSync(mockupPath)) {
  const mockup = fs.readFileSync(mockupPath, 'utf8');
  check('no real email domains', !/@gmail|@yahoo|@hotmail/.test(mockup));
  check('no phone numbers', !/\+7\s?\d{3}|\+1\s?\d{3}/.test(mockup));
  // Fictional names (Anna M., Thomas K.) are intentionally present
  check('fictional names used (Anna M.)', mockup.includes('Anna M.'));
  check('fictional names used (Thomas K.)', mockup.includes('Thomas K.'));
}

// Summary
console.log('\n=== Result: ' + pass + ' passed, ' + fail + ' failed ===');
if (fail > 0) process.exitCode = 1;
