#!/usr/bin/env node
/**
 * generate-og-image.mjs
 *
 * SEO Foundation F7 (#418): Generate the default Open Graph share image
 * as a real 1200×630 PNG, composed from brand primitives:
 *   - Background:  Deep Ink   #163A43
 *   - Accent tile: Therapy Teal #1F8A83 (holds the "PR-TOP" mark)
 *   - Wordmark:    White
 *   - Tagline:     Soft Sage  #A8C9BE
 *
 * The image is written to src/frontend/public/images/og-default.png so that
 * Vite copies it verbatim into dist/images/og-default.png at build time.
 *
 * Run standalone (`node scripts/generate-og-image.mjs`) or as part of the
 * frontend `build` script.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'images');
const OUT_FILE = path.join(OUT_DIR, 'og-default.png');

const WIDTH = 1200;
const HEIGHT = 630;

// Brand palette — brand/pr-top-landing-brandbook.md §5
const COLOR_DEEP_INK = '#163A43';
const COLOR_TEAL = '#1F8A83';
const COLOR_SAGE = '#A8C9BE';
const COLOR_MIST = '#F4F7F6';
const COLOR_WHITE = '#FFFFFF';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="${COLOR_DEEP_INK}"/>
      <stop offset="100%" stop-color="#0F2A31"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${COLOR_TEAL}"/>
      <stop offset="100%" stop-color="#186F69"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Decorative arc (calm, health-tech feel) -->
  <circle cx="1080" cy="80" r="260" fill="${COLOR_TEAL}" fill-opacity="0.12"/>
  <circle cx="120"  cy="560" r="200" fill="${COLOR_SAGE}" fill-opacity="0.08"/>

  <!-- Logo tile (mirrors public/icons/icon-512.svg) -->
  <g transform="translate(96, 175)">
    <rect width="280" height="280" rx="44" fill="url(#tile)"/>
    <text x="140" y="118" text-anchor="middle"
          font-family="Inter, system-ui, sans-serif" font-weight="800"
          font-size="72" fill="${COLOR_WHITE}">PR</text>
    <text x="140" y="212" text-anchor="middle"
          font-family="Inter, system-ui, sans-serif" font-weight="800"
          font-size="72" fill="${COLOR_WHITE}">TOP</text>
  </g>

  <!-- Wordmark + tagline -->
  <g transform="translate(432, 232)">
    <text x="0" y="0"
          font-family="Inter, system-ui, sans-serif" font-weight="800"
          font-size="96" fill="${COLOR_WHITE}">PR-TOP</text>
    <text x="0" y="68"
          font-family="Inter, system-ui, sans-serif" font-weight="500"
          font-size="34" fill="${COLOR_SAGE}">Practice on Top</text>
    <text x="0" y="150"
          font-family="Inter, system-ui, sans-serif" font-weight="400"
          font-size="30" fill="${COLOR_MIST}">AI support for psychologists</text>
    <text x="0" y="192"
          font-family="Inter, system-ui, sans-serif" font-weight="400"
          font-size="30" fill="${COLOR_MIST}">who want their practice on top.</text>
  </g>

  <!-- Bottom rule + domain -->
  <rect x="96" y="548" width="1008" height="2" fill="${COLOR_TEAL}" fill-opacity="0.5"/>
  <text x="96"  y="596" font-family="Inter, system-ui, sans-serif"
        font-weight="600" font-size="24" fill="${COLOR_SAGE}">pr-top.com</text>
  <text x="1104" y="596" text-anchor="end"
        font-family="Inter, system-ui, sans-serif" font-weight="500"
        font-size="22" fill="${COLOR_SAGE}">Between-session assistant · Therapist in control</text>
</svg>
`.trim();

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const buffer = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .toBuffer();

  await fs.writeFile(OUT_FILE, buffer);

  // Verify dimensions with an image library (not by filename), per F7 step 3.
  const meta = await sharp(OUT_FILE).metadata();
  if (meta.width !== WIDTH || meta.height !== HEIGHT) {
    throw new Error(
      `og-default.png dimensions mismatch: got ${meta.width}x${meta.height}, expected ${WIDTH}x${HEIGHT}`
    );
  }

  console.log(
    `[og-image] wrote ${path.relative(process.cwd(), OUT_FILE)} ` +
      `(${meta.width}×${meta.height}, ${meta.format}, ${buffer.length} bytes)`
  );
}

main().catch((err) => {
  console.error('[og-image] generation failed:', err);
  process.exit(1);
});
