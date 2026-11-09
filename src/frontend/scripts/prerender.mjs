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

import { LOCALIZED_ROUTES, NOINDEX_PRERENDER_ROUTES } from '../src/seo/routes.mjs';

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
  // Read the SPA shell into memory once at startup so the static server can
  // always serve it — even if dist/index.html is temporarily locked by the OS
  // (Windows antivirus / indexer) after being written by the previous step.
  const shellHtml = readFileSync(INDEX_HTML, 'utf8');

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
          // SPA fallback: serve the shell from memory to avoid Windows FS locks.
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(shellHtml);
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', contentTypeFor(filePath));
        const stream = createReadStream(filePath);
        stream.on('error', (streamErr) => {
          // Guard: if the file became inaccessible after existsSync passed
          // (Windows FS race), fall back to the in-memory shell.
          if (!res.headersSent) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(shellHtml);
          }
        });
        stream.pipe(res);
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

// Unknown path used to render the SPA's NotFound page into dist/404.html (M30).
const NOT_FOUND_SENTINEL_PATH = '/__prerender-404__';

// Language the app boots in for a URL when nothing else is stored: the URL
// locale prefix, otherwise English. main.jsx switches to this language before
// hydrating, so the prerendered markup and the first client render agree.
function prerenderLangFor(routePath) {
  const m = routePath.match(/^\/(ru|uk|es)(\/|$)/);
  return m ? m[1] : 'en';
}

async function prerenderRoute(browser, baseUrl, routePath, { outFile, notFound = false } = {}) {
  const url = `${baseUrl}${routePath}`;
  // Fixed locale + fresh storage: the snapshot must not depend on the build
  // machine's language.
  const context = await browser.newContext({ locale: 'en-US' });
  // The build must never depend on third-party network: abort every request
  // that is not for our own static server. Otherwise a widget that keeps a
  // connection open (Cloudflare Turnstile on /register and /forgot-password
  // did exactly this once VITE_TURNSTILE_SITE_KEY was set) stalls
  // `networkidle` and fails the whole Docker build. Aborted scripts fire
  // `onerror`, components fall back gracefully, and the <h1> still renders.
  await context.route(
    (requestUrl) =>
      (requestUrl.hostname !== '127.0.0.1' && requestUrl.hostname !== 'localhost')
      // Same-origin analytics script: the static server has no /analytics/;
      // abort it (a script left pending would block the 'load' event).
      || requestUrl.pathname.startsWith('/analytics/'),
    (route) => route.abort(),
  );
  // Hydration correctness: the snapshot is taken AFTER React effects ran, but
  // hydrateRoot() compares it with the FIRST render (before any effect). Pages
  // whose state changes when a request settles (the auth forms disable their
  // submit button and show a spinner until /api/csrf-token answers, then
  // re-render) were therefore captured in a different state than the one
  // they hydrate from (React errors #418/#423/#425). Same-origin /api
  // requests are left pending forever so every page is captured in its
  // initial, request-pending state. (Pending fetches do not delay the
  // 'load' event, which is why we no longer wait for 'networkidle'.)
  await context.route(
    (requestUrl) => requestUrl.pathname.startsWith('/api/'),
    () => { /* never fulfilled */ },
  );
  // Same reasoning for browser-only state: components that react to
  // IntersectionObserver entries (table-of-contents highlighting, reveal on
  // scroll) or to a "first visit" flag in localStorage (the assistant FAB's
  // pulse ring) re-render right after mount, so a snapshot taken afterwards
  // differs from what hydrateRoot() renders first. Make the observer inert and
  // mark the intro as seen so the snapshot equals the initial render.
  await context.addInitScript(() => {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
    try { localStorage.setItem('public_assistant_intro_seen', '1'); } catch (_) { /* ignore */ }
  });
  const page = await context.newPage();
  try {
    // Fail loudly if a route silently 404s or errors out — we want the build to break.
    const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
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

    // Let the lazy route chunk, fonts-independent layout effects and the
    // react-helmet-async head update settle before the snapshot.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(250);

    // Adjacent text nodes (`← {t('back')}` renders "← " and "Back" as two
    // nodes) merge into ONE node when the serialized HTML is parsed again, so
    // hydration found a single text node where React expects two and failed
    // with #425. React's own SSR separates such nodes with an `<!-- -->`
    // comment, which hydration skips - do the same in the snapshot.
    await page.evaluate(() => {
      const root = document.getElementById('root');
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      for (const node of texts) {
        const prev = node.previousSibling;
        if (prev && prev.nodeType === Node.TEXT_NODE) {
          node.parentNode.insertBefore(document.createComment(' '), node);
        }
      }
    });

    let html = await page.content();
    // F9 — Tag the prerendered #root so the client boot code (main.jsx) can
    // decide between hydrateRoot() (path matches) and createRoot() (path
    // mismatch, e.g. SPA fallback served this file for /dashboard). Without
    // this marker, the /dashboard fallback would incorrectly try to hydrate
    // Landing markup and throw a hydration mismatch.
    if (notFound) {
      // 404.html is served by nginx for ANY unknown URL, so it must not claim
      // to be prerendered for a particular path (main.jsx would try to
      // hydrate it) and must not mention the sentinel path.
      html = html.replace(/The page <code[^>]*>[^<]*<\/code> does not exist\./, 'The page you requested does not exist.');
      html = html.replace(/ data-prerendered-(path|lang)="[^"]*"/g, '');
      // Seo.jsx derives canonical / og:url from the current path.
      html = html.replace(new RegExp(`<(link|meta)\\b[^>]*${NOT_FOUND_SENTINEL_PATH}[^>]*>`, 'g'), '');
      if (html.includes(NOT_FOUND_SENTINEL_PATH)) {
        throw new Error('sentinel path leaked into 404.html');
      }
    } else {
      // main.jsx also needs the language the page was prerendered in.
      const marker = ` data-prerendered-path="${routePath}" data-prerendered-lang="${prerenderLangFor(routePath)}"`;
      if (!html.includes('data-prerendered-path=')) {
        html = html.replace('<div id="root"', `<div id="root"${marker}`);
      }
    }
    const outPath = outFile || outputPathFor(routePath);
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
    //   4. W2: auth noindex shells (/register, /login, /forgot-password, /reset-password)
    //      — rendered AFTER the root so the pristine shell is already the correct
    //      homepage prerender when these pages get their own dist/<route>/index.html.
    //      These routes are NOT in LOCALIZED_ROUTES (no sitemap / llms.txt / hreflang).
    // With this ordering, when Playwright visits any locale root, the static
    // server hasn't written dist/<loc>/index.html yet, so the SPA fallback
    // serves the pristine shell (dist/index.html), and the React client boots
    // fresh into the correct route.
    const deep        = LOCALIZED_ROUTES.filter((r) => r.basePath !== '/');
    const localeRoots = LOCALIZED_ROUTES.filter((r) => r.basePath === '/' && r.locale !== 'en');
    const englishRoot = LOCALIZED_ROUTES.filter((r) => r.basePath === '/' && r.locale === 'en');
    // W2 — auth noindex shells: map to same shape as LOCALIZED_ROUTES for the loop.
    const noindexShells = NOINDEX_PRERENDER_ROUTES.map(({ path }) => ({ path, basePath: path }));
    const ordered = [...deep, ...localeRoots, ...englishRoot, ...noindexShells];

    // M30 - dist/404.html: the SPA's NotFound page, served by nginx with a real
    // 404 status for URLs that are neither files, prerendered pages nor SPA
    // routes. Rendered by visiting a path no route matches.
    ordered.push({
      path: NOT_FOUND_SENTINEL_PATH,
      outFile: resolve(DIST_DIR, '404.html'),
      notFound: true,
    });

    // Dev aid: PRERENDER_ONLY="/login,/__prerender-404__" renders just those.
    const only = (process.env.PRERENDER_ONLY || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (only.length) {
      for (let i = ordered.length - 1; i >= 0; i--) {
        if (!only.includes(ordered[i].path)) ordered.splice(i, 1);
      }
    }

    for (const route of ordered) {
      try {
        await prerenderRoute(browser, baseUrl, route.path, { outFile: route.outFile, notFound: route.notFound });
      } catch (err) {
        failed = true;
        console.error(`[prerender] FAILED ${route.path}: ${err && err.message ? err.message : err}`);
        // Restore the shell template so a partial write does not corrupt the
        // build output for that route.
        try {
          const outPath = route.outFile || outputPathFor(route.path);
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
  const totalRendered = LOCALIZED_ROUTES.length + NOINDEX_PRERENDER_ROUTES.length + 1; // +1: 404.html
  console.log(`[prerender] wrote ${totalRendered} prerendered pages under ${DIST_DIR} (${LOCALIZED_ROUTES.length} public + ${NOINDEX_PRERENDER_ROUTES.length} noindex auth shells + 404.html)`);
}

main().catch((err) => {
  console.error('[prerender] fatal:', err);
  process.exit(1);
});
