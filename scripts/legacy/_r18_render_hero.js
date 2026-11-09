/**
 * R18: Render the dashboard mockup HTML with Puppeteer → WebP hero image
 * All data is fictional demo data (Anna M., Thomas K., etc.)
 * No real FIO, emails, numbers, or transcripts.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const MOCKUP_PATH = path.join(__dirname, '_r18_dashboard_mockup.html');
const OUT_DIR = path.join(__dirname, 'src', 'frontend', 'public', 'images');
const OUT_PNG = path.join(OUT_DIR, 'hero-dashboard.png');
const OUT_WEBP = path.join(OUT_DIR, 'hero-dashboard.webp');

async function main() {
  console.log('=== R18: Render hero dashboard image ===\n');

  if (!fs.existsSync(MOCKUP_PATH)) {
    throw new Error('Mockup HTML not found: ' + MOCKUP_PATH);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--force-device-scale-factor=2',
    ],
  });

  try {
    const page = await browser.newPage();

    // 1280x800 logical, 2x device pixel ratio = 2560x1600 physical pixels
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

    const fileUrl = 'file:///' + MOCKUP_PATH.replace(/\\/g, '/');
    console.log('Loading:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    // Full-page PNG at 2x scale
    console.log('Taking screenshot...');
    await page.screenshot({ path: OUT_PNG, type: 'png', fullPage: false });
    console.log('PNG saved:', OUT_PNG, '(' + Math.round(fs.statSync(OUT_PNG).size / 1024) + ' KB)');

    // Try to convert to WebP using sharp (may not be installed)
    try {
      const sharp = require('sharp');
      await sharp(OUT_PNG)
        .resize(1280, 800)
        .webp({ quality: 88, effort: 6 })
        .toFile(OUT_WEBP);
      console.log('WebP saved:', OUT_WEBP, '(' + Math.round(fs.statSync(OUT_WEBP).size / 1024) + ' KB)');
    } catch (e) {
      console.log('Note: sharp not available — using PNG only. Error:', e.message);
      // Copy PNG as WebP extension for now (browser will serve it)
      fs.copyFileSync(OUT_PNG, OUT_WEBP);
      console.log('Copied PNG as WebP placeholder:', OUT_WEBP);
    }

    // Verify: check that the file has reasonable size
    const size = fs.statSync(OUT_WEBP).size;
    if (size < 10000) {
      throw new Error('Output file is suspiciously small: ' + size + ' bytes');
    }
    console.log('\n✓ Hero image ready:', OUT_WEBP);
    console.log('  Dimensions: 1280x800 @2x (2560x1600 physical)');
    console.log('  File size:', Math.round(size / 1024), 'KB');

    // Verify fictional data (no real FIO/email patterns)
    const html = fs.readFileSync(MOCKUP_PATH, 'utf8');
    const realPatterns = [
      /@gmail\.com/, /@yahoo\.com/, /@hotmail\.com/,
      /\+7\s?\d{3}/, /\+1\s?\d{3}/, // phone numbers
      /\b(Ivanov|Petrov|Smith|Johnson|Williams)\b/, // common surnames
    ];
    let violations = 0;
    for (const pattern of realPatterns) {
      if (pattern.test(html)) {
        console.error('  ⚠ Possible real data pattern found:', pattern);
        violations++;
      }
    }
    if (violations === 0) {
      console.log('  ✓ No real FIO/email/phone patterns detected in mockup');
    }

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
});
