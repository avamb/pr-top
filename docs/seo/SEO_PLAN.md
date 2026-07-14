# PR-TOP.com — SEO & Growth Plan (Executable, Step-by-Step)

**Target site:** https://pr-top.com/
**Target repository:** https://github.com/avamb/pr-top — local working copy `C:\Projects\dev-psy-bot`, **work on branch `dev`** (GitHub default branch `master` is ~169 commits behind `dev`; do not base work on `master`).
**Prepared:** 2026-07-04. Based on the verified audit in [SEO_AUDIT_ASSESSMENT.md](SEO_AUDIT_ASSESSMENT.md).
**Positioning addendum (2026-07-13):** [POSITIONING_ADDENDUM.md](POSITIONING_ADDENDUM.md) — practice-first visible copy + dual-intent SEO (capture both AI-intent and routine-intent queries). It supersedes §1.5 for on-page H1/hero copy (meta keyword targets remain valid); implementation backlog in [AUTOFORGE_FEATURES_REPOSITIONING.md](AUTOFORGE_FEATURES_REPOSITIONING.md).
**How to use:** phases are ordered by priority. Each step has exact file paths (relative to repo root), content templates, and acceptance criteria. Any coding agent can execute a phase top-to-bottom and verify it with the listed checks. Steps marked `[HUMAN]` need account access and must be done by the owner.

**Key repo facts an executing agent needs (verified on `dev`, 2026-07-04):**
- Frontend: `src/frontend/` (React 18 + Vite). Files in `src/frontend/public/` are copied to `dist/` root at build. Build script is `"build": "npx vite build"` in `src/frontend/package.json`.
- Serving: the frontend container runs nginx with `src/frontend/nginx.conf` (SPA fallback `try_files $uri $uri/ /index.html`). TLS and routing are handled by **Dokploy/Traefik** — the top-level `nginx/` directory is legacy (its service was removed from `docker-compose.yml`); do **not** edit it, edit `src/frontend/nginx.conf` only.
- Routes: `src/frontend/src/App.jsx`. Public routes on `dev`: `/`, `/confirm` (+ locale variants `/ru/confirm`, `/es/confirm`, `/uk/confirm` — signup-funnel pages, must be **noindex**), `/register`, `/login`, `/forgot-password`, `/reset-password`, `/security/encryption`, `/security/gdpr`, `/security/audit-log`, `/security/data-sovereignty`, `/privacy`, `/terms`, `/verify-lead`, `/share/supervision/:token`. Everything under `/dashboard`, `/clients`, `/sessions`, `/exercises`, `/analytics`, `/settings`, `/subscription`, `/admin` is private. **Re-derive this list from `App.jsx` before executing — `dev` moves fast.**
- i18n: `src/frontend/src/i18n/` — en/ru/es/uk via i18next, selected by localStorage/browser (no URL locales for marketing pages yet; the `/xx/confirm` routes at `App.jsx:87-90` are the existing pattern to extend in Phase 3).
- Landing (`src/frontend/src/pages/Landing.jsx`) contains FAQ and pricing as page sections, not separate routes.

---

## Phase 0 — Baseline & accounts (0.5 day) `[HUMAN]`

1. Create **Google Search Console** property for `pr-top.com` (Domain property, DNS TXT verification).
2. Create **Bing Webmaster Tools** account (can import from GSC).
3. Create **Yandex Webmaster** account and verify `pr-top.com` (CIS + Russian-speaking diaspora market; note: skip Yandex-specific work for the Ukraine segment — Yandex is banned there, Google only).
4. Record baseline metrics in `docs/seo/BASELINE.md`: pages indexed (`site:pr-top.com` in Google/Yandex), Lighthouse scores (mobile) for `/`, current GSC impressions/clicks (likely ~0).

**Acceptance:** all three consoles verified; `docs/seo/BASELINE.md` committed.

---

## Phase 1 — Technical foundation (1–2 days of code) — P0

### 1.1 robots.txt
Create `src/frontend/public/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /clients
Disallow: /sessions
Disallow: /exercises
Disallow: /analytics
Disallow: /settings
Disallow: /subscription
Disallow: /admin
Disallow: /verify-lead
Disallow: /share/
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /confirm
Disallow: /ru/confirm
Disallow: /es/confirm
Disallow: /uk/confirm

Sitemap: https://pr-top.com/sitemap.xml
```

### 1.2 sitemap.xml (generated at build)
Create `src/frontend/scripts/generate-sitemap.mjs` that writes `dist/sitemap.xml` from a single source-of-truth route list, and wire it into `src/frontend/package.json`: `"build": "npx vite build && node scripts/generate-sitemap.mjs"`.

Route list (initial): `/`, `/security/encryption`, `/security/gdpr`, `/security/audit-log`, `/security/data-sovereignty`, `/privacy`, `/terms`. Use `https://pr-top.com` as base, `<lastmod>` = build date. Do **not** include login/register/confirm/app/admin routes.

### 1.3 Explicit nginx locations (belt-and-braces)
In `src/frontend/nginx.conf` (the only nginx config in use — top-level `nginx/` is legacy), add **above** the SPA fallback:

```nginx
location = /robots.txt  { try_files /robots.txt =404; }
location = /sitemap.xml { try_files /sitemap.xml =404; default_type application/xml; }
```

### 1.4 Per-route meta management
Add `react-helmet-async` to `src/frontend`. Create `src/frontend/src/components/Seo.jsx` that sets: `<title>`, `<meta name="description">`, `<link rel="canonical" href="https://pr-top.com{path}">`, `<meta name="robots">`, OG and Twitter tags. Apply to every public page. Rules:
- Public marketing pages: `robots: index,follow`, unique title ≤ 60 chars, description 140–160 chars, canonical without query strings.
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-lead`, `/confirm` (all locale variants), `/share/*` and all app/admin pages: `robots: noindex,nofollow`.

### 1.5 New keyword-bearing title / description / H1 (highest ROI step)
Replace in `src/frontend/index.html` and in the landing `Seo` config:

- Title (EN): `PR-TOP — AI Assistant for Therapists & Psychologists | Client Diary, Session Notes, Telegram Bot`
- Description (EN): `PR-TOP helps psychologists and coaches stay connected with clients between sessions: secure client diary, AI session notes, crisis alerts and a Telegram bot. GDPR-compliant.`
- H1 on landing: keep the brand slogan as a subtitle if desired, but the H1 must contain a searched phrase, e.g. `AI assistant for therapists and psychologists — client diary, session notes and a Telegram bot between sessions`.
- RU/UK/ES equivalents go live with Phase 3 locale URLs (see keyword table in Phase 4).

### 1.6 Open Graph image
Export a 1200×630 PNG from `brand/` assets to `src/frontend/public/images/og-default.png`; reference it as `og:image` (absolute URL) in `Seo.jsx`.

### 1.7 Static JSON-LD in index.html (crawler-safe, no JS required)
Add to `src/frontend/index.html` `<head>` a single `<script type="application/ld+json">` with `@graph` of:
- `Organization` (name PR-TOP, url, logo),
- `WebSite` (url, inLanguage en/ru/es/uk),
- `SoftwareApplication` (applicationCategory: "MedicalApplication"/"BusinessApplication", operatingSystem: "Web, Telegram", offers with priceRange).
Add `FAQPage` JSON-LD rendered by the FAQ section component (questions from i18n keys `landing.faqQ1..Q5`) — via helmet, and later baked in by prerender (Phase 2).

### 1.8 Self-host fonts
Replace the `fonts.googleapis.com` stylesheet link in `src/frontend/index.html` with self-hosted `@fontsource/inter` and `@fontsource/jetbrains-mono` imports. Removes a render-blocking third-party request (LCP) and a GDPR irritant.

**Acceptance checks for Phase 1 (run after deploy):**
```
curl -s https://pr-top.com/robots.txt   | head -1        # → "User-agent: *"
curl -s https://pr-top.com/sitemap.xml  | head -1        # → "<?xml"
curl -s https://pr-top.com/ | grep -c 'rel="canonical"'  # → 1
curl -s https://pr-top.com/ | grep -c 'og:title'          # → ≥1
curl -s https://pr-top.com/ | grep -c 'application/ld+json' # → ≥1
curl -s https://pr-top.com/ | grep -c 'fonts.googleapis'  # → 0
```
Validate JSON-LD at https://validator.schema.org and OG at https://www.opengraph.xyz. Then `[HUMAN]` submit sitemap in GSC/Bing/Yandex and request indexing of `/`.

---

## Phase 2 — Prerender public routes (2–4 days) — P1

Goal: public pages must serve full HTML without JavaScript. Required for Yandex (poor JS rendering), speeds up Google indexing, fixes content-invisible-to-crawlers risk.

**Approach (no framework migration):** post-build snapshot prerendering.

1. Create `src/frontend/scripts/prerender.mjs`: launch headless Chromium (puppeteer), serve `dist/` locally, visit each route from the same route list as sitemap generation, wait for network idle, write the rendered HTML to `dist/<route>/index.html`.
2. Wire into build: `"build": "npx vite build && node scripts/prerender.mjs && node scripts/generate-sitemap.mjs"`.
3. nginx already resolves `try_files $uri $uri/ /index.html` — `dist/security/gdpr/index.html` will be served statically. Verify no regression for app routes (they keep the SPA fallback).
4. React hydration: ensure `main.jsx` works when root has prerendered content (use `hydrateRoot` fallback or simply let React re-render — verify no visible flash/duplication).
5. Real 404s: after prerender, ensure the `NotFound` page sets `noindex` meta. (Full soft-404 elimination is optional; sitemap hygiene covers most of it.)

**Acceptance:** `curl -s https://pr-top.com/security/gdpr | grep -i '<h1'` returns the page H1 without executing JS; same for `/`, `/privacy`, `/terms`. Google Rich Results Test shows content.

---

## Phase 3 — Locale-in-URL + hreflang (3–5 days) — P2, strategic centerpiece

Today Google only sees English (language lives in localStorage). The primary market is RU/UA-speaking therapists → without this phase there is no organic channel in the primary market.

1. Add locale prefix routing for **public marketing pages**: `/ru/...`, `/uk/...`, `/es/...`; English stays at root (`/`). The codebase already has this pattern for `/confirm` (`App.jsx:87-90`, `<LandingConfirm locale="ru" />`) — generalize it: wrap public routes with an optional locale prefix, call `i18n.changeLanguage(locale)` on match; keep localStorage behavior for the authenticated app.
2. Set `<html lang>` per locale (via helmet / prerender).
3. `Seo.jsx`: emit hreflang alternates on every public page: `en` (root), `ru`, `uk`, `es`, and `x-default` → en.
4. Extend `generate-sitemap.mjs` and `prerender.mjs` to the full route × locale matrix (7 routes × 4 locales initially).
5. Language switcher on public pages must navigate to the locale URL (not just flip state), so crawlers discover the alternates.
6. Localized titles/descriptions/H1 per keyword table (Phase 4) — **not** literal translations of the English title.

**Acceptance:** `curl -s https://pr-top.com/ru/ | grep 'lang="ru"'` and grep for `hreflang` returns 5 alternates; RU page shows Russian text without JS; sitemap contains all locale URLs.

---

## Phase 4 — Keyword targeting & new indexable pages (start week 2, ongoing) — P2/P3

### 4.1 Seed keyword clusters (validate volumes in GSC/Yandex Wordstat before writing)

| Intent | RU | UK | EN | ES |
|---|---|---|---|---|
| Category | приложение для психолога, CRM для психолога | застосунок для психолога | practice management software for therapists | software para psicólogos |
| Bot | телеграм-бот для психолога, бот для клиентов психолога | телеграм-бот для психолога | telegram bot for therapists | bot de telegram para psicólogos |
| Diary | дневник клиента психолога, дневник эмоций онлайн | щоденник клієнта психолога | client journaling app therapy | diario del cliente psicología |
| Notes | заметки психолога, протокол сессии психолога | нотатки психолога | AI therapy session notes, progress notes software | notas de sesión psicología |
| AI | AI ассистент для психолога, ИИ для психологов | ШІ для психологів | AI assistant for therapists | IA para psicólogos |
| Trust | конфиденциальность данных клиентов психолога | конфіденційність даних клієнтів | GDPR compliant therapy software | protección de datos psicología |

### 4.2 New public routes (each: unique 600–1200 words, one intent, FAQ block with FAQPage schema, CTA, internal links; add to route list → auto-included in sitemap + prerender)

Order of creation:
1. `/pricing` — extract the pricing section from `Landing.jsx` into a page (keep a landing anchor too). Add `Offer`/`Product` schema.
2. `/faq` — extract FAQ into a page; keep the landing FAQ short.
3. `/features/client-diary`
4. `/features/session-notes`
5. `/features/telegram-bot`
6. `/for-psychologists` (later `/for-coaches`)
7. `/security` — overview page linking the four existing security pages.

### 4.3 Content rules for the writing agent
- One search intent per page; the target phrase appears in title, H1, first paragraph, and one H2 — naturally, no stuffing.
- Every page links to 2–4 sibling pages and to `/pricing`.
- Trust signals on every page: GDPR, encryption, data sovereignty (link the security pages).
- RU/UK content written natively (not machine-translated verbatim) — this niche is sensitive to tone.

---

## Phase 5 — Performance / Core Web Vitals (1–2 days, after Phase 2) — P2

Budget: LCP < 2.5s (mobile), INP < 200ms, CLS < 0.1.

1. Code-split the app away from the landing: `React.lazy` for all `GuardedLayout`/`AdminLayout` pages in `App.jsx` so the landing bundle excludes dashboard/admin code.
2. Fonts already self-hosted (1.8); add `font-display: swap`.
3. Convert landing images in `src/frontend/public/images/` to WebP/AVIF with explicit `width`/`height` (CLS).
4. Verify gzip/brotli in `src/frontend/nginx.conf` (gzip present — OK).
5. Verify with Lighthouse CI or PageSpeed Insights; record scores in `docs/seo/BASELINE.md`.

---

## Phase 6 — Indexing operations (30 min/week, ongoing) `[HUMAN]`

1. After each phase deploy: GSC → URL Inspection → Request indexing for changed key pages; same in Yandex Webmaster ("Переобход страниц").
2. Weekly: GSC Pages report — fix any "Crawled – currently not indexed", soft-404, duplicate-without-canonical items.
3. Weekly: check `site:pr-top.com` count in Google and Yandex.

---

## Phase 7 — Off-page: promotion & link building (parallel, ongoing) — P3

Niche-specific channels, in priority order. Rule: value-first, no spam — this professional community is small and reputation-sensitive.

### RU/CIS segment
1. **B17.ru** — largest RU psychologist portal: company profile, expert articles by founder(s).
2. **psy.su** and psychologist association sites — directory listings, partner announcements.
3. Professional **Telegram channels/chats** for therapists (supervision groups, CBT/gestalt communities): sponsored posts + genuine participation.
4. **vc.ru** and **Habr** — founder story / "how we built an AI assistant for therapists with privacy-first architecture" (Habr loves the encryption/data-sovereignty angle; links from both).
5. Partnerships with **therapy training institutes and supervision schools**: student discount → mention on their sites (backlink + trust).

### UA segment
6. UA psychologist communities (Facebook/Instagram/Telegram), НАПУ and similar association partnerships; UA-language content pages from Phase 3/4 are the landing targets.

### EN/Global segment
7. **Product Hunt** launch (once prerender + EN content pages are live).
8. Listings: **G2, Capterra, AlternativeTo, SaaSHub** — category "therapy notes / practice management".
9. **Reddit r/therapists, r/psychotherapy** — participate genuinely, mention product only where rules allow.
10. Guest posts / podcast appearances in therapist-tech niche.

### Content engine (from month 2)
- 2 blog/knowledge posts per month targeting long-tail queries from GSC data (add `/blog` or `/guides` route section, prerendered).
- Each post pitched to 1–2 external channels for a link/mention.

**KPI:** ≥10 referring domains by month 3, ≥30 by month 6 (check via GSC Links report / Ahrefs free tier).

---

## Phase 8 — Monitoring & iteration (ongoing)

Weekly dashboard (owner or scheduled agent):
- GSC: impressions, clicks, average position for seed keywords; Pages indexed.
- Yandex Webmaster: same for RU segment.
- Umami (already installed): organic sessions, signup conversions from organic.
- Monthly: pick the 3 queries with impressions-but-low-CTR → improve titles/descriptions; pick 3 rising queries → new content pages.

**Success criteria (6 months):** all public pages indexed in Google+Yandex; ≥1,000 organic impressions/day; ≥5 first-page rankings in RU cluster; measurable organic → registration funnel in Umami.

---

## Execution order summary

| Priority | Phase | Effort | Depends on |
|---|---|---|---|
| P0 | 0. Accounts & baseline | 0.5 d `[HUMAN]` | — |
| P0 | 1. Technical foundation | 1–2 d | — |
| P1 | 2. Prerender | 2–4 d | 1 |
| P2 | 3. Locale URLs + hreflang | 3–5 d | 2 |
| P2 | 5. Performance | 1–2 d | 2 |
| P2/P3 | 4. Keywords & pages | ongoing | 2 (3 for non-EN) |
| P0→ | 6. Indexing ops | 30 min/wk `[HUMAN]` | 1 |
| P3 | 7. Off-page & promotion | ongoing | 1–2 |
| — | 8. Monitoring | weekly | 0 |
