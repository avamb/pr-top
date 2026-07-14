/**
 * Repositioning review screenshots: full-page PNG for all 4 locales (EN/RU/ES/UK).
 * Saves to docs/seo/reports/repositioning-screens/ — re-run after any landing copy
 * change so the mandatory human copy review sees the current state.
 * Usage: node _t_screenshots.js (serves the existing dist/ via vite preview; build first).
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const OUT_DIR = path.join(__dirname, 'docs', 'seo', 'reports', 'repositioning-screens');
const LOCALES = [
  { code: 'en', path: '/' },
  { code: 'ru', path: '/ru/' },
  { code: 'es', path: '/es/' },
  { code: 'uk', path: '/uk/' },
];
const PORT = 4173;

fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitForServer(url, retries = 30) {
  const http = require('http');
  for (let i = 0; i < retries; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          res.resume();
          resolve();
        }).on('error', reject);
      });
      return;
    } catch {}
  }
  throw new Error('Server did not start in time');
}

async function main() {
  // Start vite preview
  const vitePreview = spawn(
    path.join(__dirname, 'src', 'frontend', 'node_modules', '.bin', 'vite'),
    ['preview', '--port', String(PORT), '--strictPort'],
    {
      cwd: path.join(__dirname, 'src', 'frontend'),
      stdio: 'pipe',
      shell: true,
    }
  );

  vitePreview.stderr.on('data', d => process.stderr.write(d));

  try {
    await waitForServer(`http://localhost:${PORT}/`);
    console.log('Preview server ready');

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    for (const locale of LOCALES) {
      const url = `http://localhost:${PORT}${locale.path}`;
      console.log(`Capturing ${locale.code}: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));
      const outFile = path.join(OUT_DIR, `landing-${locale.code}.png`);
      await page.screenshot({ fullPage: true, path: outFile });
      console.log(`  -> saved ${outFile}`);
    }

    await browser.close();
    console.log('All screenshots captured.');
  } finally {
    vitePreview.kill('SIGTERM');
  }
}

main().catch(err => {
  process.stderr.write(err.message + '\n');
  process.exitCode = 1;
});
