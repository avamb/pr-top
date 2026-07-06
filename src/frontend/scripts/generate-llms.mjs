#!/usr/bin/env node
/**
 * Build-time llms.txt + llms-full.txt generator (F18 — GEO Foundation §A2).
 *
 * llmstxt.org (https://llmstxt.org/) defines two companion files at the
 * root of a site that let AI answer engines discover authoritative,
 * plain-text content without having to render JavaScript or scrape HTML:
 *
 *   dist/llms.txt       — Markdown "table of contents". Starts with a H1
 *                          product title, one-paragraph summary, then one
 *                          Markdown section per topic. Each section lists
 *                          links as `- [Title](url): summary`.
 *
 *   dist/llms-full.txt  — Plain-text extraction (tags stripped, whitespace
 *                          collapsed) of every prerendered English page,
 *                          concatenated with `URL:` headers, so an LLM can
 *                          ingest the entire public marketing corpus in a
 *                          single request without needing to fetch each
 *                          route separately.
 *
 * The route index is derived from the shared route manifest (routes.mjs)
 * + per-route title/summary metadata added in F18. Locale variants are
 * listed under a ## Languages section so every URL emitted by the sitemap
 * also appears in llms.txt (this is what the F17 GEO audit checks).
 *
 * Runs after the prerender step in package.json:
 *   vite build && prerender.mjs && generate-sitemap.mjs
 *     && generate-robots.mjs && generate-llms.mjs
 *
 * (llms-full.txt requires the English prerendered HTML files to already
 *  exist under dist/, which is why this must run AFTER prerender.mjs.)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  PUBLIC_ROUTES,
  EN_ONLY_ROUTES,
  LOCALES,
  LLMS_SECTIONS,
  localePathFor,
} from '../src/seo/routes.mjs';

// F20 — routes.mjs merges PUBLIC_ROUTES + EN_ONLY_ROUTES via a single
// `allEnglishRoutes` lookup because LLMS_SECTIONS references comparison
// paths that live in EN_ONLY_ROUTES.
const ALL_ENGLISH_ROUTES = [...PUBLIC_ROUTES, ...EN_ONLY_ROUTES];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = resolve(__dirname, '..', 'dist');
const LLMS_OUT = resolve(DIST_DIR, 'llms.txt');
const LLMS_FULL_OUT = resolve(DIST_DIR, 'llms-full.txt');

const SITE_ORIGIN = 'https://pr-top.com';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up the manifest entry for a public marketing path (localized or EN-only). */
function routeByPath(path) {
  const r = ALL_ENGLISH_ROUTES.find((x) => x.path === path);
  if (!r) throw new Error(`[llms] LLMS_SECTIONS references unknown path: ${path}`);
  return r;
}

/**
 * Return the on-disk path of the English prerendered HTML for a given
 * public marketing route ("/" → dist/index.html, "/privacy" →
 * dist/privacy/index.html, etc.).
 */
function distFileForRoute(routePath) {
  if (routePath === '/') return resolve(DIST_DIR, 'index.html');
  const trimmed = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
  return resolve(DIST_DIR, trimmed, 'index.html');
}

/**
 * Strip <head>, <script>, <style>, and every remaining HTML tag from an HTML
 * string; decode a small set of common entities; collapse whitespace to
 * single spaces / blank-line-separated paragraphs. The goal is a readable
 * plain-text rendering suitable for LLM ingestion — NOT a lossless HTML
 * roundtrip.
 */
function htmlToPlainText(html) {
  let out = html;

  // Drop the <head> block entirely (it's mostly meta/link/script noise; the
  // interesting metadata like <title> is redundantly present in <h1>).
  out = out.replace(/<head[\s\S]*?<\/head>/gi, '');

  // Drop <script>, <style>, <noscript>, <template>, and SVG blocks — none
  // contribute human-readable copy.
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  out = out.replace(/<template[\s\S]*?<\/template>/gi, '');
  out = out.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // Turn block-level closing tags into newlines so paragraphs survive.
  out = out.replace(
    /<\/(p|div|section|article|header|footer|main|nav|li|h[1-6]|tr|br|hr)\s*>/gi,
    '\n',
  );
  out = out.replace(/<br\s*\/?>/gi, '\n');

  // Strip all remaining tags.
  out = out.replace(/<[^>]+>/g, '');

  // Decode the common entities we actually emit.
  out = out
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…');

  // Collapse runs of whitespace within a line, then collapse runs of blank
  // lines to a single blank line.
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n');
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  return out;
}

// ---------------------------------------------------------------------------
// llms.txt (llmstxt.org-style Markdown index)
// ---------------------------------------------------------------------------

function buildLlmsIndex() {
  const lines = [];

  // H1 + product summary (llmstxt.org spec).
  lines.push('# PR-TOP');
  lines.push('');
  lines.push(
    'PR-TOP is a therapist-controlled between-session assistant for psychologists and therapists. '
      + 'It combines a Telegram bot for clients (voice/text/video diary, SOS, guided exercises) with '
      + 'a web dashboard for therapists (AI-assisted session notes, semantic search across client '
      + 'history, encrypted timeline, crisis alerts). All Class A data (diary entries, transcripts, '
      + 'therapist notes) is AES-encrypted at the application layer; the therapist retains full '
      + 'control over what is shared with any AI provider. GDPR-first: EU-only hosting, self-hosted '
      + 'analytics, no third-party trackers.',
  );
  lines.push('');

  // Topic sections (##). Each links English (canonical) URLs with title + summary.
  for (const section of LLMS_SECTIONS) {
    lines.push(`## ${section.heading}`);
    lines.push('');
    for (const p of section.paths) {
      const route = routeByPath(p);
      lines.push(`- [${route.title}](${SITE_ORIGIN}${p}): ${route.summary}`);
    }
    lines.push('');
  }

  // Languages section: enumerate every non-English localized URL so the
  // llms.txt file surfaces the complete crawlable set (matches sitemap.xml).
  lines.push('## Languages');
  lines.push('');
  lines.push(
    'The following localized mirrors of the public marketing pages are also available. '
      + 'Content is machine-translated + human-reviewed; English is canonical.',
  );
  lines.push('');
  for (const locale of LOCALES) {
    for (const route of PUBLIC_ROUTES) {
      const url = `${SITE_ORIGIN}${localePathFor(locale, route.path)}`;
      lines.push(`- [${route.title} (${locale})](${url}): ${route.summary}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// llms-full.txt (plain-text concatenation of English prerendered pages)
// ---------------------------------------------------------------------------

function buildLlmsFull() {
  const parts = [];

  parts.push('# PR-TOP — full text corpus');
  parts.push('');
  parts.push(
    'This file is a plain-text extraction of every public marketing page in English, '
      + 'concatenated with URL headers. Intended for LLM ingestion.',
  );
  parts.push('');

  for (const route of ALL_ENGLISH_ROUTES) {
    const htmlPath = distFileForRoute(route.path);
    if (!existsSync(htmlPath)) {
      throw new Error(
        `[llms] missing prerendered file for ${route.path} at ${htmlPath}. `
          + `Run prerender.mjs before generate-llms.mjs.`,
      );
    }
    const html = readFileSync(htmlPath, 'utf8');
    const text = htmlToPlainText(html);

    parts.push('----------------------------------------------------------------------');
    parts.push(`URL: ${SITE_ORIGIN}${route.path}`);
    parts.push(`Title: ${route.title}`);
    parts.push(`Summary: ${route.summary}`);
    parts.push('----------------------------------------------------------------------');
    parts.push('');
    parts.push(text);
    parts.push('');
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!existsSync(DIST_DIR)) {
  mkdirSync(DIST_DIR, { recursive: true });
}

const llmsBody = buildLlmsIndex();
writeFileSync(LLMS_OUT, llmsBody, 'utf8');

const llmsFullBody = buildLlmsFull();
writeFileSync(LLMS_FULL_OUT, llmsFullBody, 'utf8');

const totalRouteEntries =
  LLMS_SECTIONS.reduce((n, s) => n + s.paths.length, 0)
  + LOCALES.length * PUBLIC_ROUTES.length;

console.log(
  `[llms] wrote ${LLMS_OUT} (${llmsBody.length} bytes, ${totalRouteEntries} route entries)`,
);
console.log(
  `[llms] wrote ${LLMS_FULL_OUT} (${llmsFullBody.length} bytes,`
    + ` ${ALL_ENGLISH_ROUTES.length} English pages extracted)`,
);
