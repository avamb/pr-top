# AutoForge Feature Breakdown — SEO Phases 1–3

Source plan: [SEO_PLAN.md](SEO_PLAN.md). Repo: branch `dev`, frontend in `src/frontend/`.
Features are ordered by dependency — **implement in the listed order** (F1→F15). Each feature is small, independently committable, and has **locally verifiable** acceptance steps (no deployed site required; all checks run against `dist/` after `npm run build` in `src/frontend/`, or against `npx vite preview` with a headless browser).

Conventions for all features:
- Build command: `cd src/frontend && npm run build` (currently `npx vite build`; later features extend it).
- Runtime checks: `npx vite preview --port 4173` + puppeteer/playwright script (repo already uses `_t*.js` puppeteer-style scripts as test harness).
- Do not touch the legacy top-level `nginx/` directory — the live config is `src/frontend/nginx.conf`.
- Public marketing routes (source of truth after F2): `/`, `/security/encryption`, `/security/gdpr`, `/security/audit-log`, `/security/data-sovereignty`, `/privacy`, `/terms`.

---

## Category: SEO Foundation (Phase 1)

### F1 — robots.txt served as a real file
**Description:** Create `src/frontend/public/robots.txt` (exact content in SEO_PLAN.md §1.1: Allow `/`, Disallow all app/auth/admin/confirm routes, `Sitemap: https://pr-top.com/sitemap.xml`). Add explicit nginx locations above the SPA fallback in `src/frontend/nginx.conf`: `location = /robots.txt { try_files /robots.txt =404; }` and the same for `/sitemap.xml` with `default_type application/xml;`.
**Steps:**
1. Create `src/frontend/public/robots.txt` per SEO_PLAN.md §1.1.
2. Edit `src/frontend/nginx.conf`: add the two exact-match locations before `location /`.
3. Build; verify `dist/robots.txt` exists, first line is `User-agent: *`, file contains `Sitemap: https://pr-top.com/sitemap.xml` and `Disallow: /admin`.
4. Verify `src/frontend/nginx.conf` contains `location = /robots.txt`.

### F2 — Shared public-route manifest + build-time sitemap.xml
**Description:** Create `src/frontend/src/seo/routes.mjs` exporting the public marketing route list (single source of truth, imported later by sitemap, prerender, and App routing). Create `src/frontend/scripts/generate-sitemap.mjs` writing `dist/sitemap.xml` (base `https://pr-top.com`, `<lastmod>` = build date). Change `package.json` build script to `npx vite build && node scripts/generate-sitemap.mjs`.
**Steps:**
1. Create the route manifest with the 7 public routes; exclude login/register/confirm/app/admin.
2. Create the sitemap generator reading the manifest.
3. Wire into the `build` script.
4. Build; verify `dist/sitemap.xml` starts with `<?xml`, contains exactly the 7 manifest URLs, and contains no `/login`, `/register`, `/confirm`, `/dashboard`, `/admin` URLs.

### F3 — Per-route SEO meta component (canonical, robots, OG, Twitter)
**Description:** Add `react-helmet-async`. Create `src/frontend/src/components/Seo.jsx` emitting `<title>`, meta description, `<link rel="canonical" href="https://pr-top.com{path}">`, `<meta name="robots">`, Open Graph (og:title, og:description, og:url, og:type, og:image) and Twitter Card tags. Apply to all public pages: marketing pages get `index,follow` + unique titles; `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-lead`, `/confirm` (all locale variants), `/share/*`, `NotFound` get `noindex,nofollow`.
**Steps:**
1. Install `react-helmet-async`; wrap app in `HelmetProvider` in `main.jsx`.
2. Create `Seo.jsx`; add it to every public page component with per-page props.
3. Start `vite preview`; with puppeteer open `/privacy`: `document.querySelector('link[rel=canonical]').href` === `https://pr-top.com/privacy`; `meta[name=robots]` content is `index,follow`; `og:title` present.
4. Open `/login`: `meta[name=robots]` content is `noindex,nofollow`.
5. Verify each of the 7 public marketing pages has a unique `document.title`.

### F4 — Keyword-bearing title, description and landing H1
**Description:** Replace the zero-keyword title/description in `src/frontend/index.html` and the landing Seo config with keyword-bearing versions from SEO_PLAN.md §1.5 (EN title: `PR-TOP — AI Assistant for Therapists & Psychologists | Client Diary, Session Notes, Telegram Bot`). Rework the landing H1 (`src/frontend/src/pages/Landing.jsx` + i18n keys in all 4 locale files en/ru/es/uk) so the H1 contains searched phrases; keep the old slogan as a subtitle. Update the `landing.*` i18n keys consistently in all four locale JSONs.
**Steps:**
1. Update `index.html` `<title>` and `meta description` per SEO_PLAN.md §1.5.
2. Update landing H1 + subtitle via i18n keys in `en.json`, `ru.json`, `es.json`, `uk.json` (RU H1 example: `AI-ассистент для психолога: дневник клиента, заметки сессий и Telegram-бот между сессиями`).
3. Build; verify `dist/index.html` title contains `AI Assistant for Therapists`.
4. With puppeteer on preview `/`: H1 text contains `therapists` (EN default); no i18n key is rendered raw (no `landing.` literal on page).

### F5 — Static JSON-LD structured data
**Description:** Add one `<script type="application/ld+json">` to `src/frontend/index.html` head with an `@graph` of `Organization`, `WebSite` (inLanguage en/ru/es/uk) and `SoftwareApplication` (operatingSystem "Web, Telegram", offers). Add `FAQPage` JSON-LD emitted by the FAQ section of `Landing.jsx` (build the JSON from the `landing.faqQ1..Q5`/`faqA1..A5` i18n values via helmet).
**Steps:**
1. Add the static `@graph` script to `index.html`.
2. Add FAQPage JSON-LD generation to the FAQ section component.
3. Build; verify `dist/index.html` contains `application/ld+json`; extract the block with node and `JSON.parse` it — must parse and contain `"@type":"Organization"`, `"WebSite"`, `"SoftwareApplication"`.
4. With puppeteer on preview `/`: page contains a parseable FAQPage JSON-LD with 5 `Question` items.

### F6 — Self-hosted fonts (remove render-blocking Google Fonts)
**Description:** Remove the `fonts.googleapis.com` `<link>` from `src/frontend/index.html`. Add `@fontsource/inter` (weights 300–700) and `@fontsource/jetbrains-mono` (400, 500), import them in `src/main.jsx` or `index.css`, ensure `font-display: swap`.
**Steps:**
1. Install the two `@fontsource` packages; add imports; delete the Google Fonts link.
2. Build; verify `dist/index.html` contains no `fonts.googleapis` and `dist/assets/` contains `.woff2` files.
3. With puppeteer on preview `/`: computed `font-family` of `body` includes `Inter`; no network request to `fonts.googleapis.com` or `fonts.gstatic.com`.

### F7 — Open Graph default image
**Description:** Produce a 1200×630 PNG `src/frontend/public/images/og-default.png` from assets in `brand/` (compose logo on brand background; a node script with sharp/canvas is acceptable). Reference it as absolute `og:image` (`https://pr-top.com/images/og-default.png`) plus `og:image:width/height` in `Seo.jsx` defaults.
**Steps:**
1. Generate the PNG (exactly 1200×630) into `src/frontend/public/images/`.
2. Set it as the default `og:image` in `Seo.jsx`.
3. Build; verify `dist/images/og-default.png` exists and its dimensions are 1200×630 (check with an image library, not by filename).
4. With puppeteer on preview `/`: `meta[property="og:image"]` is the absolute URL.

---

## Category: SEO Prerender (Phase 2)

### F8 — Post-build prerender of public routes
**Description:** Create `src/frontend/scripts/prerender.mjs`: serve `dist/` on a local port, launch headless Chromium (puppeteer), visit every route from `src/seo/routes.mjs`, wait for network idle + H1 present, write rendered HTML to `dist/<route>/index.html` (root route overwrites `dist/index.html`). Wire build: `npx vite build && node scripts/prerender.mjs && node scripts/generate-sitemap.mjs`.
**Steps:**
1. Implement `prerender.mjs` using the shared route manifest.
2. Update the `build` script order (prerender before sitemap).
3. Build; verify `dist/privacy/index.html` and `dist/security/gdpr/index.html` exist and contain an `<h1>` with non-empty text and the helmet-set canonical — checked with grep on the files, **without** running a browser.
4. Verify prerendered pages contain the `noindex`-free robots meta (`index,follow`) and the FAQ/JSON-LD where applicable (grep `application/ld+json` in `dist/index.html`).

### F9 — Hydration correctness and app-route regression check
**Description:** Ensure the SPA hydrates prerendered HTML without duplicated or flashing content and the authenticated app is unaffected. Adjust `main.jsx` if needed (e.g. `hydrateRoot` when `#root` has children, `createRoot` otherwise).
**Steps:**
1. Serve the built `dist/` with the SPA-fallback semantics (e.g. `npx vite preview` or a tiny node static server with fallback).
2. Puppeteer on `/privacy`: zero console errors; exactly one `<h1>` in the DOM after hydration; page remains interactive (click a nav link → route changes).
3. Puppeteer on `/dashboard` (not prerendered): SPA fallback still works — app redirects to `/login` as before; no 404.
4. Puppeteer on `/`: no visible content duplication (assert `document.querySelectorAll('h1').length === 1` after load).

### F10 — Docker build compatibility for prerender
**Description:** The frontend image (`src/frontend/Dockerfile`) must build successfully with the new prerender step: install Chromium dependencies in the build stage (or use puppeteer's bundled Chromium with required system libs), keep the final nginx stage slim (prerender artifacts only, no Chromium in final image).
**Steps:**
1. Update `src/frontend/Dockerfile` build stage for headless Chromium (multi-stage: builder with deps → nginx stage copies `dist/`).
2. Run `docker build src/frontend` — must succeed.
3. Run the built image locally, `curl -s localhost:PORT/privacy | grep -i '<h1'` returns the H1 (static HTML, no JS executed by curl).
4. Verify final image size did not grow by more than ~50 MB versus the previous image (no Chromium leaked into the nginx stage).

---

## Category: SEO Localization (Phase 3)

### F11 — Locale-prefix routing for public marketing pages
**Description:** Add `/ru/...`, `/uk/...`, `/es/...` URL prefixes for the public marketing routes only (English stays at root `/`). Generalize the existing pattern from the `/confirm` locale routes (`App.jsx:87-90`): on locale-prefixed routes call `i18n.changeLanguage(locale)`; the authenticated app keeps its current localStorage-based behavior. Unknown locale prefixes fall through to `NotFound`.
**Steps:**
1. Refactor `App.jsx`: public marketing routes rendered under optional locale prefix (`ru|uk|es`); extend `src/seo/routes.mjs` with a `locales` export.
2. Puppeteer on preview `/ru/`: landing renders with Russian text (assert a known `ru.json` landing string is on the page and no Cyrillic missing / no raw i18n keys).
3. Puppeteer on `/uk/privacy` and `/es/terms`: correct language content renders.
4. Puppeteer on `/`: English content (regardless of a previously set localStorage language — URL wins on public pages).
5. Puppeteer on `/dashboard` after login stub: app behavior unchanged (language from localStorage).
6. `/fr/` (unsupported) renders the NotFound page.

### F12 — Language switcher navigates locale URLs on public pages
**Description:** On public marketing pages the language switcher must navigate to the locale URL (`/` ↔ `/ru/…` ↔ `/uk/…` ↔ `/es/…`) preserving the current path, so crawlers can discover alternates via real `<a href>` links (not JS-only state flips). Inside the authenticated app the switcher keeps current behavior.
**Steps:**
1. Update the public-page language switcher to render anchor links to locale-prefixed equivalents of the current path.
2. Puppeteer on `/privacy`: switch to RU → URL becomes `/ru/privacy`, content is Russian.
3. Verify the switcher options are real `<a>` elements with `href` (crawlable), not only onClick handlers.
4. Switch back to EN → URL is `/privacy`.

### F13 — hreflang alternates, html lang, localized meta
**Description:** Extend `Seo.jsx`: on every public marketing page emit `<link rel="alternate" hreflang>` for `en` (root), `ru`, `uk`, `es` and `x-default` (→ en) with absolute URLs; set `<html lang>` per active locale; localized titles/descriptions/H1 come from i18n using the keyword table in SEO_PLAN.md §4.1 (keyword-researched, not literal translations — RU title example: `PR-TOP — AI-ассистент для психолога: дневник клиента, заметки сессий, Telegram-бот`).
**Steps:**
1. Add hreflang emission + `<html lang>` handling to `Seo.jsx`.
2. Add localized `seo.*` title/description i18n keys for all public pages in all 4 locale files.
3. Puppeteer on `/ru/`: `document.documentElement.lang === 'ru'`; 5 hreflang links present; canonical is `https://pr-top.com/ru/`; title contains `ассистент для психолога`.
4. Puppeteer on `/`: `lang="en"`, `x-default` alternate points to `https://pr-top.com/`.

### F14 — Prerender and sitemap for the full route × locale matrix
**Description:** Extend `prerender.mjs` and `generate-sitemap.mjs` to the matrix (7 routes × 4 locales; en at root, others prefixed). Sitemap entries include `xhtml:link` hreflang alternates.
**Steps:**
1. Extend both scripts via the shared manifest (`routes × locales`).
2. Build; verify `dist/ru/index.html` exists, contains `lang="ru"`, Cyrillic H1 text, and hreflang links — all via grep, no browser.
3. Verify `dist/uk/privacy/index.html` and `dist/es/terms/index.html` exist with correct-language content.
4. Verify `dist/sitemap.xml` contains 28 URLs and `xhtml:link rel="alternate"` entries; still no `/login`/`/confirm`/app URLs.

### F15 — Localization regression sweep
**Description:** Final verification feature: full build + docker build pass; all locale pages render without raw i18n keys; EN app flows unaffected.
**Steps:**
1. Full build; run existing `_t394_i18n_audit.js`-style audit (or write `_t_seo_i18n_audit.js`): crawl all 28 prerendered pages, assert no `landing.`/`seo.` raw keys, no empty H1/title/description, unique title per page.
2. `docker build src/frontend` succeeds; container serves `/ru/` with Russian static HTML via curl.
3. Puppeteer login smoke test: authenticated dashboard loads, language switch inside app still works (localStorage mode).
4. Record results in `claude-progress.txt` per repo convention.

---

## Not for AutoForge (human tasks from SEO_PLAN.md)
- Phase 0: Google Search Console / Bing / Yandex Webmaster registration (DNS access required).
- Phase 6: sitemap submission, indexing requests, weekly coverage monitoring.
- Phase 7: promotion, directories, communities, link building.
- Deployment via Dokploy and post-deploy live curl checks (SEO_PLAN.md Phase 1 acceptance).
