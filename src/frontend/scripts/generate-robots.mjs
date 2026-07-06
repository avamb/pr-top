#!/usr/bin/env node
/**
 * Build-time robots.txt generator (F16 — GEO Foundation §A1).
 *
 * Generates dist/robots.txt with:
 *   - A baseline `User-agent: *` block (Allow public marketing pages,
 *     Disallow authenticated / private / auth routes).
 *   - Explicit blocks for AI crawlers that identify themselves separately.
 *     Each AI-crawler block repeats the same Allow/Disallow list so the
 *     crawler is authorised to fetch and cite the public marketing pages
 *     (Landing, /security/*, /privacy, /terms — including their locale
 *     variants) while being kept out of private routes.
 *   - The Sitemap: pointer at the end.
 *
 * Runs after `vite build` (which copies public/robots.txt into dist as a
 * fallback). This script overwrites dist/robots.txt with the generated
 * output so the deployed file is always the authoritative multi-agent
 * version. public/robots.txt is kept in sync as a dev-server fallback so
 * `npm run dev` still serves a reasonable robots.txt at /robots.txt.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = resolve(__dirname, '..', 'dist');
const OUT_FILE = resolve(DIST_DIR, 'robots.txt');

const SITEMAP_URL = 'https://pr-top.com/sitemap.xml';

// Routes that must never be indexed / cited by any crawler (private app,
// auth flows, share tokens, verification endpoints). Kept aligned with
// public/robots.txt fallback.
const DISALLOW_PATHS = [
  '/dashboard',
  '/clients',
  '/sessions',
  '/exercises',
  '/analytics',
  '/settings',
  '/subscription',
  '/admin',
  '/verify-lead',
  '/share/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm',
  '/ru/confirm',
  '/es/confirm',
  '/uk/confirm',
];

// AI crawlers we want to *explicitly* allow on public marketing pages,
// per GEO Foundation plan §A1. Explicit blocks override the wildcard
// block for these crawlers and document our stance (opt-in for public
// pages, opt-out for private routes).
const AI_CRAWLERS = [
  'GPTBot',           // OpenAI training crawler
  'OAI-SearchBot',    // OpenAI SearchGPT / answer engine
  'ClaudeBot',        // Anthropic training crawler
  'Claude-SearchBot', // Anthropic answer engine
  'PerplexityBot',    // Perplexity answer engine
  'Google-Extended',  // Google Gemini / AI Overviews opt-in token
  'Bingbot',          // Bing / Copilot answer engine
];

function block(userAgent) {
  const lines = [`User-agent: ${userAgent}`, 'Allow: /'];
  for (const p of DISALLOW_PATHS) lines.push(`Disallow: ${p}`);
  return lines.join('\n');
}

const parts = [];

// 1) Wildcard baseline.
parts.push(block('*'));

// 2) Explicit AI-crawler blocks (same policy, but named so the crawlers
//    see explicit permission for public marketing pages).
for (const ua of AI_CRAWLERS) {
  parts.push(block(ua));
}

const body = parts.join('\n\n') + `\n\nSitemap: ${SITEMAP_URL}\n`;

if (!existsSync(DIST_DIR)) {
  mkdirSync(DIST_DIR, { recursive: true });
}
writeFileSync(OUT_FILE, body, 'utf8');

console.log(
  `[robots] wrote ${OUT_FILE} with 1 wildcard + ${AI_CRAWLERS.length} AI-crawler blocks`
  + ` (${DISALLOW_PATHS.length} Disallow paths each)`,
);
