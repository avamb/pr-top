/**
 * Runs the frontend build steps sequentially with proper working directory.
 * Uses spawn so we can handle errors per-step and add timing gaps.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendDir = path.join(__dirname, 'src', 'frontend');

function run(cmd, args) {
  process.stdout.write('\n>>> ' + cmd + ' ' + args.join(' ') + '\n');
  const result = spawnSync(cmd, args, {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.stderr.write('FAILED with exit code ' + result.status + '\n');
    process.exit(result.status || 1);
  }
}

function wait(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* busy wait */ }
}

// Step 1: Generate OG image
run('node', ['scripts/generate-og-image.mjs']);

// Step 2: Vite build
run('npx', ['vite', 'build']);

// Step 3: Short wait for Windows FS to settle
process.stdout.write('\n[build] waiting 2s for FS to settle...\n');
wait(2000);

// Verify dist/index.html exists before prerender
const indexHtml = path.join(frontendDir, 'dist', 'index.html');
if (!fs.existsSync(indexHtml)) {
  process.stderr.write('ERROR: dist/index.html not found after vite build!\n');
  process.exit(1);
}
process.stdout.write('[build] dist/index.html confirmed: ' + fs.statSync(indexHtml).size + ' bytes\n');

// Step 4: Prerender
run('node', ['scripts/prerender.mjs']);

// Step 5: Generate sitemap, robots, llms
run('node', ['scripts/generate-sitemap.mjs']);
run('node', ['scripts/generate-robots.mjs']);
run('node', ['scripts/generate-llms.mjs']);

process.stdout.write('\n[build] All steps complete.\n');
