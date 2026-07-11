# AutoForge Feature Breakdown — SEO Wave 2: visibility for real search queries

**Context (2026-07-11):** A 35-query ranking study found PR-TOP in the top-5 for only ONE query ("client diary for therapists online", #3). Root causes verified live:
1. **Duplicate meta description (P0 BUG):** the static `<meta name="description">` in `src/frontend/index.html` survives prerender; react-helmet ADDS its page-specific description alongside instead of replacing it. Every prerendered page therefore carries TWO descriptions, the static homepage one FIRST — crawlers read the first, so all 48 pages present an identical snippet. All the unique per-page descriptions we wrote are physically present but second → invisible.
2. **SPA-fallback head on non-prerendered routes (P0 BUG):** `/register`, `/login`, etc. are not prerendered, so nginx serves the prerendered homepage `index.html` — raw HTML shows the homepage title, homepage canonical, and `robots index,follow` on auth pages.
3. **Missing pages for high-intent queries:** competitors (Supanote, Mentalyc, AutoNotes, Quill, TheraFocus) own "AI session notes for therapists", "AI clinical documentation", "practice management", "coaching practice software" — PR-TOP has no pages targeting these at all (9 of 35 queries returned nothing for us).
4. **"Coaches" are named in the H1 but have zero coach-oriented content** (coaches search business terms — retention, CRM, session management — not HIPAA/clinical terms).

Conventions: repo `dev` branch; routes manifest `src/frontend/src/seo/routes.mjs` (title/summary per route → sitemap/prerender/llms.txt automatically); content pages follow the localized CONTENT-dict pattern of the comparison pages (en/ru/uk/es in one component) and `docs/seo/CONTENT_RULES.md`; audits `_t_seo_i18n_audit.js`, `_t_geo_audit.js` run against built `dist/`. Implement in order W1→W7 — W1/W2 are bugfixes that multiply the value of everything after.

---

## W1 — P0: exactly ONE meta description per page (helmet owns it)
**Description:** Remove the static `<meta name="description">` (and any other head tag that helmet also emits per-page — check for static og:/twitter: leftovers) from `src/frontend/index.html`. The `Seo` component already provides a description on every public page, and auth/app pages get helmet defaults — after this change the helmet tag is the ONLY description in prerendered HTML. Keep static tags helmet never emits (charset, viewport, icons, manifest, theme-color, analytics script, JSON-LD @graph).
**Steps:**
1. Delete the static description from `index.html`; grep the template for any other tag duplicated by `Seo.jsx` (og:title/og:description/twitter:) and remove those static copies too.
2. Build; assert for EVERY prerendered page: `grep -c 'name="description"' dist/<page>/index.html` == 1.
3. Extend `_t_geo_audit.js`: (a) exactly one description meta per page; (b) **descriptions are UNIQUE within each locale** (mirror the existing per-locale title-uniqueness check — this is the assertion whose absence let the bug ship).
4. Spot-assert: `dist/compare/mentalyc/index.html` first (and only) description mentions Mentalyc; `dist/ru/index.html` description is Russian.

## W2 — P0: prerender noindex shells for auth routes
**Description:** `/register`, `/login`, `/forgot-password`, `/reset-password` must stop serving the homepage head. Add a `NOINDEX_PRERENDER_ROUTES` list to the routes manifest (EXCLUDED from sitemap and llms.txt, INCLUDED in prerender, no locale mirrors) so each gets its own static shell whose raw HTML carries its real title (e.g. "Sign up — PR-TOP") and `robots noindex,nofollow` + self-canonical.
**Steps:**
1. Add the list + wire `prerender.mjs` to render these 4 routes (skip sitemap/llms/hreflang for them).
2. Confirm the pages already call `Seo` with `noindex` (F3 did) so the prerendered head is correct.
3. Build; assert `dist/register/index.html` contains `noindex,nofollow`, its own title (not the homepage one), and does NOT appear in `dist/sitemap.xml` or `dist/llms.txt`.
4. Hydration regression: with vite preview + puppeteer, the register form still renders and submits (mirror the F9-style check).

## W3 — Unique CTA-bearing descriptions and keyword-locked H1/Title pairs
**Description:** With W1 making descriptions visible, rewrite them for impact. For every public marketing page and locale: description 140–160 chars, unique, contains the page's primary query + a CTA (Hermes examples: best-of page → "2026 ranking of AI tools for therapists: honest comparison of Upheal, Mentalyc, Twofold, and PR-TOP — find the best fit for your practice."). Add a `primaryKeyword` field per route in the manifest; H1 and Title of each page must contain it (per locale, translated keyword).
**Steps:**
1. Add `primaryKeyword` (per locale) to manifest entries; update seo i18n keys / CONTENT dicts accordingly.
2. Extend `_t_seo_i18n_audit.js`: for each page, H1 or Title contains the locale's primaryKeyword (case-insensitive); descriptions unique per locale, 140–160 chars.
3. Build; all audits green.

## W4 — Quick-win landings, batch 1 (4 pages, the "two-week escape")
**Description:** Four fully-localized landing pages (CONTENT-dict pattern, 1000+ words EN each, CONTENT_RULES: direct answer, H2/H3, FAQ+FAQPage schema, comparison table where apt, "Updated <month year>" stamp), added to the routes manifest:
1. `/ai-session-notes-for-therapists` — query "AI session notes for therapists" (owned today by Quill/AutoNotes/Supanote). Angle: PR-TOP does notes AND the between-session channel they lack.
2. `/ai-practice-management` — "therapy practice management AI / practice management for psychologists". Honest: PR-TOP is light practice support (clients, sessions, notes, analytics), not a US-insurance EHR — link the SimplePractice comparison angle.
3. `/for-coaches` — "coaching practice software / coaching session management". **Coach language rules:** NO HIPAA/clinical/diagnosis vocabulary; talk business outcomes — client retention, engagement between sessions, streaks, session prep time, a professional client experience in Telegram; pricing framed as ROI. Own FAQ (coach-phrased).
4. `/secure-practice-management` — "secure practice management for therapists". Reuse /security/* content backbone: encryption, consent, audit log, EU hosting, data sovereignty; link all four security pages.
**Steps:** implement as routes + manifest entries (auto sitemap/prerender/llms) → build → audits (incl. W3 keyword checks) green → verify each page's FAQPage JSON-LD parses and internal links carry locale prefixes.

## W5 — Landings, batch 2 (5 pages)
**Description:** Same pattern:
1. `/therapy-documentation-ai` — "therapy documentation AI / AI clinical documentation mental health".
2. `/therapist-ai-assistant` — "therapist AI assistant" (low competition per the study; hub page linking the best-of listicle and features).
3. `/hipaa-and-gdpr-for-therapy-software` — "HIPAA compliant AI for therapists". **TRUTHFULNESS CONSTRAINT (hard rule):** PR-TOP is GDPR-native and EU-hosted; it must NOT claim HIPAA compliance or a BAA unless the owner confirms one exists. The page explains what HIPAA requires, maps PR-TOP's real controls (application-layer AES, audit logging, access control, consent enforcement) to those expectations, states the current posture honestly, and positions GDPR-first hosting for EU/international practices. Owner reviews this page before dev→prod merge.
4. `/coaching-session-management` — "coaching session management software" (sibling of /for-coaches, cross-linked).
5. `/client-diary-for-therapists` — double down on our only ranking query ("client diary…", currently #3): dedicated landing with the diary story (Telegram, voice/video, consent, therapist visibility), internal links from home/features/comparisons to concentrate signals.
**Steps:** as W4; plus every batch-1/2 page links 2–4 siblings and /pricing-anchor.

## W6 — Internal linking: "Solutions" footer column + hub links
**Description:** New pages are invisible without internal links. Add a localized footer column (like the Compare column) listing the batch-1/2 landings (label per locale); add contextual links from the landing features section, the best-of listicle, and each comparison page ("Related: AI session notes, For coaches…"). Keep the link-graph audit green: every internal link locale-consistent, no dead targets (run the full link audit across the grown matrix).
**Steps:** footer column + i18n keys ×4; contextual link blocks; build; link-graph audit (pages × locales, expect ~(12+9)×4 pages) ALL LINKS CONSISTENT.

## W7 — Audit + reporting extensions
**Description:** Lock the regressions out and measure the wave: (a) audits from W1/W3 (single description, uniqueness, keyword-in-H1) become permanent; (b) extend `_t_geo_audit.js` to fail if any indexable page's raw-HTML robots is missing or a noindex page appears in sitemap/llms; (c) after deploy, `npm run indexnow` covers the new URLs automatically (sitemap-driven — just document the step); (d) record the 35-query list from the study in `docs/seo/reports/query-panel-2026-07.md` so the A6 prompt/rank panel re-runs against the SAME list monthly and progress is measurable.
**Steps:** implement checks; commit the query list; audits green on the full new matrix.

---

## Not for AutoForge (human, from the study's off-page findings)
- Listings: SoftwareAdvice, Capterra, G2 (agent can draft copy; you submit).
- PsychologyToday blog/guest posts; mentions on ICF / APA / coaching-federation resources.
- Review the /hipaa page (W5.3) and /for-coaches positioning before dev→prod merge.
- After deploy: GSC "Request indexing" for the 9 new landings; IndexNow run.

## Order & effort
| # | Feature | Effort | Note |
|---|---|---|---|
| W1 | single description | 0.5 d | P0 bugfix — do first, multiplies everything |
| W2 | auth noindex shells | 0.5 d | P0 bugfix |
| W3 | unique meta + keyword lock | 1 d | needs W1 |
| W4 | 4 quick-win landings | 2–3 d | localized ×4 |
| W5 | 5 more landings | 2–3 d | HIPAA page = owner review |
| W6 | internal linking | 0.5–1 d | after W4/W5 |
| W7 | audits + query panel | 0.5 d | locks it in |
