#!/usr/bin/env node
/**
 * IndexNow post-deploy ping script (GEO Plan §B3).
 *
 * Reads dist/sitemap.xml, extracts every <loc> URL, and POSTs the full set
 * to https://api.indexnow.org/indexnow so Bing + Yandex learn about new /
 * changed pages within minutes instead of days.
 *
 * NOT wired into `npm run build` on purpose — production builds happen
 * inside the Docker build stage which has no guaranteed egress to
 * api.indexnow.org. Instead, invoke this AFTER deployment succeeds
 * (Dokploy post-deploy hook, cron agent, or manually):
 *
 *     npm run indexnow             # POST the ping
 *     npm run indexnow -- --dry-run  # print the JSON payload without sending
 *
 * The IndexNow key file is served at
 *   https://pr-top.com/<key>.txt
 * and its body equals <key> — this is how api.indexnow.org verifies that
 * whoever POSTs the ping actually controls the host. The key is a random
 * 32-hex string and is NOT a secret; it is safe to commit and to expose in
 * plaintext responses.
 *
 * Exit codes:
 *   0 — success (200 / 202), or dry-run completed
 *   1 — sitemap missing / no URLs / non-2xx response / network error
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRONTEND_ROOT = resolve(__dirname, '..');
const PUBLIC_DIR = resolve(FRONTEND_ROOT, 'public');
const DIST_DIR = resolve(FRONTEND_ROOT, 'dist');
const SITEMAP_PATH = resolve(DIST_DIR, 'sitemap.xml');

const HOST = 'pr-top.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run') || args.has('-n');

function fail(msg) {
  console.error(`[indexnow] ERROR: ${msg}`);
  process.exit(1);
}

function findKey() {
  // Locate the 32-hex key file committed to public/. The file NAME equals
  // the key; its BODY must also equal the key (IndexNow verification rule).
  let entries;
  try {
    entries = readdirSync(PUBLIC_DIR);
  } catch (err) {
    fail(`cannot read ${PUBLIC_DIR}: ${err.message}`);
  }
  const keyFiles = entries.filter((name) => /^[0-9a-f]{32}\.txt$/i.test(name));
  if (keyFiles.length === 0) {
    fail(`no <32-hex>.txt key file found in ${PUBLIC_DIR}`);
  }
  if (keyFiles.length > 1) {
    fail(
      `multiple IndexNow key files found (${keyFiles.join(', ')}); keep exactly one`,
    );
  }
  const fileName = keyFiles[0];
  const key = fileName.replace(/\.txt$/i, '').toLowerCase();
  const body = readFileSync(resolve(PUBLIC_DIR, fileName), 'utf8').trim().toLowerCase();
  if (body !== key) {
    fail(
      `key file body does not match filename: file=${fileName} body=${body}`,
    );
  }
  return { key, fileName };
}

function extractUrls(xml) {
  const urls = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const url = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    urls.push(url);
  }
  // De-dupe while preserving order.
  return Array.from(new Set(urls));
}

function loadSitemapUrls() {
  let xml;
  try {
    xml = readFileSync(SITEMAP_PATH, 'utf8');
  } catch (err) {
    fail(`cannot read sitemap ${SITEMAP_PATH}: ${err.message} (did you run \`npm run build\`?)`);
  }
  const urls = extractUrls(xml);
  if (urls.length === 0) {
    fail(`no <loc> URLs found in ${SITEMAP_PATH}`);
  }
  // Sanity: every URL must live under the same host we claim in the ping.
  const hostPrefix = `https://${HOST}/`;
  const rootUrl = `https://${HOST}`;
  const foreign = urls.filter((u) => u !== rootUrl && !u.startsWith(hostPrefix));
  if (foreign.length > 0) {
    fail(
      `sitemap contains URLs outside host ${HOST}: ${foreign.slice(0, 3).join(', ')}`,
    );
  }
  return urls;
}

async function main() {
  const { key, fileName } = findKey();
  const urls = loadSitemapUrls();

  const payload = {
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${fileName}`,
    urlList: urls,
  };

  const json = JSON.stringify(payload, null, 2);

  if (DRY_RUN) {
    console.log(`[indexnow] DRY RUN — would POST ${urls.length} URLs to ${ENDPOINT}`);
    console.log(json);
    return;
  }

  console.log(
    `[indexnow] POST ${ENDPOINT} host=${HOST} keyLocation=${payload.keyLocation} urls=${urls.length}`,
  );

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    fail(`network error: ${err.message}`);
  }

  const text = await res.text().catch(() => '');
  if (res.status < 200 || res.status >= 300) {
    console.error(`[indexnow] response ${res.status} ${res.statusText}`);
    if (text) console.error(text);
    process.exit(1);
  }

  console.log(`[indexnow] OK ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`);
}

main().catch((err) => fail(err?.stack || String(err)));
