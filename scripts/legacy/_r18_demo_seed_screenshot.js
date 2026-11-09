/**
 * R18: Hero screenshot from real demo account
 * 1. Seed demo therapist + fictional clients via API
 * 2. Start vite preview of built dist
 * 3. Take Puppeteer screenshot of /dashboard
 * 4. Save as WebP hero image
 *
 * Fictional data only — no real client names, emails, or health info.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const BACKEND = 'http://localhost:3001';
const PREVIEW_PORT = 4174; // use 4174 to avoid conflict with 4173
const OUT_DIR = path.join(__dirname, 'src', 'frontend', 'public', 'images');
const OUT_FILE = path.join(OUT_DIR, 'hero-dashboard.webp');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForPort(port, retries = 30) {
  for (let i = 0; i < retries; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      await new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/`, res => { res.resume(); resolve(); })
            .on('error', reject);
      });
      return;
    } catch {}
  }
  throw new Error(`Port ${port} not ready after ${retries}s`);
}

async function apiPost(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(url, headers = {}) {
  const res = await fetch(url, { headers });
  return res.json();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== R18: Demo Seed + Hero Screenshot ===\n');

  // 1. Get CSRF token
  console.log('1. Getting CSRF token...');
  const csrfData = await apiGet(`${BACKEND}/api/csrf-token`);
  const csrfToken = csrfData.csrfToken;
  console.log('   CSRF:', csrfToken.slice(0, 16) + '...');

  // 2. Register or login demo account
  const DEMO_EMAIL = 'demo@pr-top.com';
  const DEMO_PASS = 'DemoOnly2024!';

  console.log('\n2. Registering demo therapist account...');
  // Try register (may already exist from a previous run)
  const regData = await apiPost(
    `${BACKEND}/api/auth/register`,
    { email: DEMO_EMAIL, password: DEMO_PASS, name: 'Dr. Demo' },
    { 'X-CSRF-Token': csrfToken }
  );
  let token;
  if (regData.token) {
    token = regData.token;
    console.log('   Registered. User ID:', regData.user?.id);
  } else {
    // Account exists — login instead
    console.log('   Already exists, logging in...');
    const loginCsrf = await apiGet(`${BACKEND}/api/csrf-token`);
    const loginData = await apiPost(
      `${BACKEND}/api/auth/login`,
      { email: DEMO_EMAIL, password: DEMO_PASS },
      { 'X-CSRF-Token': loginCsrf.csrfToken }
    );
    token = loginData.token;
    console.log('   Logged in. User ID:', loginData.user?.id);
  }

  if (!token) {
    throw new Error('Could not get auth token: ' + JSON.stringify(regData));
  }

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'X-CSRF-Token': csrfToken,
  };

  // 3. Seed fictional clients
  console.log('\n3. Seeding fictional clients...');
  const demoClients = [
    { first_name: 'Anna', last_name: 'M.', notes: 'CBT for anxiety. Sessions on Tuesdays.' },
    { first_name: 'Thomas', last_name: 'K.', notes: 'Burnout recovery. Bi-weekly sessions.' },
    { first_name: 'Maria', last_name: 'S.', notes: 'Grief counselling. Weekly sessions.' },
    { first_name: 'Lena', last_name: 'V.', notes: 'Relationship issues. New client.' },
    { first_name: 'David', last_name: 'R.', notes: 'Stress management. Progress: good.' },
  ];

  const clientIds = [];
  for (const client of demoClients) {
    try {
      const newCsrf = await apiGet(`${BACKEND}/api/csrf-token`);
      const c = await apiPost(
        `${BACKEND}/api/clients`,
        client,
        { 'Authorization': `Bearer ${token}`, 'X-CSRF-Token': newCsrf.csrfToken }
      );
      if (c.id) {
        clientIds.push(c.id);
        console.log(`   Created: ${client.first_name} ${client.last_name} (ID ${c.id})`);
      } else {
        console.log(`   Skipped ${client.first_name}: ${c.error || JSON.stringify(c)}`);
      }
    } catch (e) {
      console.log(`   Error creating ${client.first_name}:`, e.message);
    }
  }

  // 4. Start vite preview
  console.log('\n4. Starting vite preview on port', PREVIEW_PORT, '...');
  const viteBin = path.join(__dirname, 'src', 'frontend', 'node_modules', '.bin',
    process.platform === 'win32' ? 'vite.cmd' : 'vite');
  const vitePreview = spawn(viteBin, ['preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: path.join(__dirname, 'src', 'frontend'),
    stdio: 'pipe',
    shell: true,
  });
  vitePreview.stderr.on('data', d => process.stderr.write(d));
  vitePreview.stdout.on('data', d => process.stdout.write(d));

  try {
    await waitForPort(PREVIEW_PORT);
    console.log('   Preview server ready at http://localhost:' + PREVIEW_PORT);

    // 5. Launch Puppeteer
    console.log('\n5. Launching Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

    // Inject auth token into localStorage so the SPA is authenticated
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('auth_token', t);
    }, token);

    // Navigate to login page and inject token via localStorage
    await page.goto(`http://localhost:${PREVIEW_PORT}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Set auth token in localStorage so SPA picks it up
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
      // Also set cookie-like storage patterns the SPA may use
      localStorage.setItem('token', t);
      sessionStorage.setItem('auth_token', t);
    }, token);

    // Navigate to dashboard
    console.log('   Navigating to /dashboard...');
    await page.goto(`http://localhost:${PREVIEW_PORT}/dashboard`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 3000)); // Let React render

    // Take screenshot
    console.log('   Taking screenshot...');
    const screenshotPath = path.join(OUT_DIR, 'hero-dashboard-raw.png');
    await page.screenshot({ path: screenshotPath, type: 'png' });
    console.log('   Raw screenshot saved:', screenshotPath);

    // Also take a cropped hero-sized screenshot (left half of screen = dashboard content)
    const clip = { x: 0, y: 0, width: 1280, height: 800 };
    await page.screenshot({ path: path.join(OUT_DIR, 'hero-dashboard-full.png'), type: 'png', clip });

    await browser.close();
    console.log('   Browser closed.');

    // Convert to WebP using sharp if available, else just copy PNG
    try {
      const sharp = require('sharp');
      await sharp(screenshotPath)
        .resize(1280, 800, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(OUT_FILE);
      console.log('\n6. WebP saved:', OUT_FILE);
    } catch (e) {
      // sharp not available — save PNG as-is (Landing.jsx will reference it)
      console.log('   (sharp not available, using PNG)', e.message);
      fs.copyFileSync(screenshotPath, OUT_FILE.replace('.webp', '.png'));
      console.log('\n6. PNG saved:', OUT_FILE.replace('.webp', '.png'));
    }

    console.log('\n=== Screenshot done! ===');
    console.log('Next: update Landing.jsx hero to use this image.');

  } finally {
    vitePreview.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
});
