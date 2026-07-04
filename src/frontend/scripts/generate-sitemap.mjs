#!/usr/bin/env node
/**
 * Build-time sitemap.xml generator.
 *
 * Reads the shared public-route manifest from src/seo/routes.mjs and writes
 * dist/sitemap.xml. Base URL is https://pr-top.com. <lastmod> is set to the
 * build date (UTC, YYYY-MM-DD).
 *
 * Invoked from package.json:  npx vite build && node scripts/generate-sitemap.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { PUBLIC_ROUTES } from '../src/seo/routes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'https://pr-top.com';
const DIST_DIR = resolve(__dirname, '..', 'dist');
const OUT_FILE = resolve(DIST_DIR, 'sitemap.xml');

// YYYY-MM-DD (UTC)
const lastmod = new Date().toISOString().slice(0, 10);

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const urlEntries = PUBLIC_ROUTES.map(({ path, changefreq, priority }) => {
  const loc = xmlEscape(`${BASE_URL}${path}`);
  const parts = [
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
  ];
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority != null) parts.push(`    <priority>${priority.toFixed(1)}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

if (!existsSync(DIST_DIR)) {
  mkdirSync(DIST_DIR, { recursive: true });
}
writeFileSync(OUT_FILE, xml, 'utf8');

console.log(`[sitemap] wrote ${OUT_FILE} with ${PUBLIC_ROUTES.length} URLs (lastmod=${lastmod})`);
