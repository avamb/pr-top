#!/usr/bin/env node
/**
 * Build-time sitemap.xml generator.
 *
 * Reads the shared public-route manifest from src/seo/routes.mjs and writes
 * dist/sitemap.xml. Base URL is https://pr-top.com. <lastmod> is set to the
 * build date (UTC, YYYY-MM-DD).
 *
 * F14 — Localization: emits the full (routes x locales) matrix, one <url>
 * entry per (locale, route) pair. Each entry also carries xhtml:link
 * rel="alternate" hreflang="…" pointers to every locale variant plus an
 * x-default alternate pointing at the English URL. The urlset element
 * declares the required xmlns:xhtml namespace so search engines pick up the
 * alternates.
 *
 * Explicitly excluded (per SEO Foundation spec F2):
 *   /login, /register, /confirm, /dashboard/*, /clients/*, /sessions/*, ...
 *
 * Invoked from package.json:  npx vite build && node scripts/generate-sitemap.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  PUBLIC_ROUTES,
  HREFLANG_LOCALES,
  LOCALIZED_ROUTES,
  localePathFor,
} from '../src/seo/routes.mjs';

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

const urlEntries = LOCALIZED_ROUTES.map(({ path, basePath, changefreq, priority }) => {
  const loc = xmlEscape(`${BASE_URL}${path}`);
  const parts = [
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
  ];
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority != null) parts.push(`    <priority>${priority.toFixed(1)}</priority>`);

  // xhtml:link rel="alternate" — one per hreflang locale plus x-default.
  for (const altLocale of HREFLANG_LOCALES) {
    const altHref = xmlEscape(`${BASE_URL}${localePathFor(altLocale, basePath)}`);
    parts.push(
      `    <xhtml:link rel="alternate" hreflang="${altLocale}" href="${altHref}"/>`,
    );
  }
  const xDefaultHref = xmlEscape(`${BASE_URL}${localePathFor('en', basePath)}`);
  parts.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultHref}"/>`,
  );

  return `  <url>\n${parts.join('\n')}\n  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>
`;

if (!existsSync(DIST_DIR)) {
  mkdirSync(DIST_DIR, { recursive: true });
}
writeFileSync(OUT_FILE, xml, 'utf8');

console.log(
  `[sitemap] wrote ${OUT_FILE} with ${LOCALIZED_ROUTES.length} URLs`
  + ` (${PUBLIC_ROUTES.length} routes x ${HREFLANG_LOCALES.length} locales,`
  + ` lastmod=${lastmod})`,
);
