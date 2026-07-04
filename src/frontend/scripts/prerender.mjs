#!/usr/bin/env node
/**
 * Build-time static prerender of public marketing routes (SEO Foundation F8).
 *
 * Reads the shared public-route manifest from src/seo/routes.mjs, serves the
 * built dist/ directory over a local HTTP server, launches headless Chromium
 * via Playwright, visits each route, waits for network idle + the primary
 * <h1> to be present, and writes the fully-rendered HTML back to
 * dist/<route>/index.html. The root route ("/") overwrites dist/index.html.
 *
 * Invoked from package.json:
 *   npx vite build && node scripts/prerender.mjs && node scripts/generate-sitemap.mjs
 *
 * Rationale:
 *   The React SPA is client-rendered, which means Google/Bing crawlers see an
 *   empty <div id="root"></div> for the primary marketing content. Prerendering
 *   the small set of public routes at build time gives crawlers a fully
 *   populated document with title/meta/canonical/h1/main copy — matching what
 *   the client eventually hydrates to.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { LOCALIZED_ROUTES } from '../src/seo/routes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = resolve(__dirname, '..', 'dist');
const INDEX_HTML = resolve(DIST_DIR, 'index.html');

if (!existsSync(DIST_DIR) || !existsSync(INDEX_HTML)) {
  console.error(`[prerender] dist/ not found or missing index.html at ${DIST_DIR}. Run "vite build" first.`);
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
};

function contentTypeFor(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// Serve dist/ statically. If the requested path does not map to a real file
// under dist/, fall back to dist/index.html (SPA-style) so client routing works.
function startStaticServer() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer((req, res) => {
      try {
        // Strip query string; decode.
        const rawUrl = req.url || '/';
        const [pathnameRaw] = rawUrl.split('?');
        const pathname = decodeURIComponent(pathnameRaw);

        // Resolve against dist and prevent path traversal.
        const candidate = resolve(DIST_DIR, '.' + pathname);
        if (!candidate.startsWith(DIST_DIR)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        let filePath = candidate;
        if (existsSync(filePath) && statSync(filePath).isDirectory()) {
          filePath = join(filePath, 'index.html');
        }

        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          // SPA fallback.
          filePath = INDEX_HTML;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', contentTypeFor(filePath));
        createReadStream(filePath).pipe(res);
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err && err.message ? err.message : err));
      }
    });

    server.on('error', rejectPromise);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({ server, port });
    });
  });
}

function outputPathFor(routePath) {
  // Root ("/") overwrites dist/index.html; every other route (including locale
  // roots like "/ru" and localized subpaths like "/ru/privacy") becomes
  // dist/<route>/index.html so the nginx/static host serves it verbatim.
  if (routePath === '/' || routePath === '') {
    return INDEX_HTML;
  }
  const trimmed = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
  return resolve(DIST_DIR, trimmed, 'index.html');
}

async function prerenderRoute(browser, baseUrl, routePath) {
  const url = `${baseUrl}${routePath}`;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // Fail loudly if a route silently 404s or errors out — we want the build to break.
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response) {
      throw new Error(`no response for ${url}`);
    }
    if (response.status() >= 400) {
      throw new Error(`HTTP ${response.status()} for ${url}`);
    }

    // Wait for the primary <h1> to be present with non-empty text — this is the
    // signal that React has actually rendered marketing copy for this route.
    await page.waitForFunction(
      () => {
        const h1 = document.querySelector('h1');
        return !!h1 && h1.textContent && h1.textContent.trim().length > 0;
      },
      null,
      { timeout: 30000 },
    );

    let html = await page.content();
    // F9 — Tag the prerendered #root so the client boot code (main.jsx) can
    // decide between hydrateRoot() (path matches) and createRoot() (path
    // mismatch, e.g. SPA fallback served this file for /dashboard). Without
    // this marker, the /dashboard fallback would incorrectly try to hydrate
    // Landing markup and throw a hydration mismatch.
    const marker = ` data-prerendered-path="${routePath}"`;
    if (!html.includes('data-prerendered-path=')) {
      html = html.replace('<div id="root"', `<div id="root"${marker}`);
    }
    const outPath = outputPathFor(routePath);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
    console.log(`[prerender] ${routePath}  ->  ${outPath}`);
  } finally {
    await page.close();
    await context.close();
  }
}

async function main() {
  const { server, port } = await startStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[prerender] serving ${DIST_DIR} at ${baseUrl}`);

  // Keep the original index.html around so every route starts from the same
  // client-shell template (the root prerender overwrites it last).
  const shellTemplate = readFileSync(INDEX_HTML, 'utf8');

  let browser;
  let failed = false;
  try {
    browser = await chromium.launch({ headless: true });

    // Prerender in an order that keeps the pristine INDEX_HTML shell in place
    // as the SPA fallback until the last possible moment:
    //   1. All deep localized paths (e.g. /ru/privacy, /es/security/gdpr).
    //   2. All locale-root paths (/ru, /uk, /es) — writes dist/<loc>/index.html.
    //   3. The English root ("/") — writes dist/index.html, the shell itself.
    // With this ordering, when Playwright visits any locale root, the static
    // server hasn't written dist/<loc>/index.html yet, so the SPA fallback
    // serves the pristine shell (dist/index.html), and the React client boots
    // fresh into the correct route.
    const deep     = LOCALIZED_ROUTES.filter((r) => r.basePath !== '/');
    const localeRoots = LOCALIZED_ROUTES.filter((r) => r.basePath === '/' && r.locale !== 'en');
    const englishRoot = LOCALIZED_ROUTES.filter((r) => r.basePath === '/' && r.locale === 'en');
    const ordered = [...deep, ...localeRoots, ...englishRoot];

    for (const route of ordered) {
      try {
        await prerenderRoute(browser, baseUrl, route.path);
      } catch (err) {
        failed = true;
        console.error(`[prerender] FAILED ${route.path}: ${err && err.message ? err.message : err}`);
        // Restore the shell template so a partial write does not corrupt the
        // build output for that route.
        try {
          const outPath = outputPathFor(route.path);
          if (route.path === '/') {
            writeFileSync(INDEX_HTML, shellTemplate, 'utf8');
          } else if (existsSync(outPath)) {
            // Leave partial output alone; surface the error via non-zero exit.
          }
        } catch (_) { /* ignore */ }
      }
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  if (failed) {
    console.error('[prerender] one or more routes failed — aborting build');
    process.exit(1);
  }
  console.log(`[prerender] wrote ${LOCALIZED_ROUTES.length} prerendered pages under ${DIST_DIR}`);
}

main().catch((err) => {
  console.error('[prerender] fatal:', err);
  process.exit(1);
});
