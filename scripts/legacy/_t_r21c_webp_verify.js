/**
 * _t_r21c_webp_verify.js
 * Verification for R21c: Real WebP for hero screenshot
 *
 * Checks:
 * 1. hero-dashboard.webp exists and is ≤ 120 KB
 * 2. Magic bytes are RIFF....WEBP (real WebP, not renamed PNG)
 * 3. PNG duplicate does NOT exist in public/images/
 * 4. <img> src in Landing.jsx is unchanged (/images/hero-dashboard.webp)
 * 5. The file is referenced in built dist/index.html
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = __dirname;
const WEBP    = path.join(ROOT, 'src/frontend/public/images/hero-dashboard.webp');
const PNG_DUP = path.join(ROOT, 'src/frontend/public/images/hero-dashboard.png');
const LANDING = path.join(ROOT, 'src/frontend/src/pages/Landing.jsx');
const DIST    = path.join(ROOT, 'src/frontend/dist/index.html');

let pass = 0;
let fail = 0;

function ok(msg)  { pass++; process.stderr.write(`  PASS  ${msg}\n`); }
function err(msg) { fail++; process.stderr.write(`  FAIL  ${msg}\n`); }

// 1. WebP exists
if (fs.existsSync(WEBP)) {
  ok('hero-dashboard.webp exists');
} else {
  err('hero-dashboard.webp NOT found');
  process.exit(1);
}

// 2. Size ≤ 120 KB
const sizeBytes = fs.statSync(WEBP).size;
const sizeKB    = Math.round(sizeBytes / 1024);
if (sizeBytes <= 120 * 1024) {
  ok(`hero-dashboard.webp size = ${sizeKB} KB (≤ 120 KB)`);
} else {
  err(`hero-dashboard.webp size = ${sizeKB} KB (exceeds 120 KB limit)`);
}

// 3. Magic bytes: RIFF at offset 0, WEBP at offset 8
const buf  = Buffer.alloc(12);
const fd   = fs.openSync(WEBP, 'r');
fs.readSync(fd, buf, 0, 12, 0);
fs.closeSync(fd);

const riff = buf.slice(0, 4).toString('ascii');
const webp = buf.slice(8, 12).toString('ascii');

if (riff === 'RIFF' && webp === 'WEBP') {
  ok(`Magic bytes: ${riff}....${webp} (real WebP)`);
} else {
  err(`Magic bytes WRONG: expected RIFF....WEBP, got ${riff}....${webp}`);
}

// 4. PNG duplicate does NOT exist
if (!fs.existsSync(PNG_DUP)) {
  ok('hero-dashboard.png (PNG duplicate) removed from public/images/');
} else {
  err('hero-dashboard.png PNG duplicate still exists in public/images/');
}

// 5. Landing.jsx src unchanged
const landingContent = fs.readFileSync(LANDING, 'utf8');
if (landingContent.includes('src="/images/hero-dashboard.webp"')) {
  ok('<img> src="/images/hero-dashboard.webp" unchanged in Landing.jsx');
} else {
  err('<img> src for hero-dashboard.webp NOT found in Landing.jsx');
}

// 6. Dist index.html references the webp
if (fs.existsSync(DIST)) {
  const distContent = fs.readFileSync(DIST, 'utf8');
  if (distContent.includes('/images/hero-dashboard.webp')) {
    ok('dist/index.html references /images/hero-dashboard.webp');
  } else {
    err('dist/index.html does NOT reference /images/hero-dashboard.webp');
  }
} else {
  err('dist/index.html not found — run build first');
}

// Summary
process.stderr.write('\n');
process.stderr.write('============================================================\n');
process.stderr.write(`R21c WEBP VERIFY: ${pass} passed, ${fail} failed\n`);
process.stderr.write('============================================================\n');

if (fail > 0) {
  process.exit(1);
}
