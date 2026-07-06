# AutoForge Feature Breakdown — Agentic SEO, wave 1 (items 1–4 of AGENTIC_SEO_PLAN.md §C3)

Source plan: [AGENTIC_SEO_PLAN.md](AGENTIC_SEO_PLAN.md). Continues the F-numbering from [AUTOFORGE_FEATURES.md](AUTOFORGE_FEATURES.md) (F1–F15, all shipped).
Conventions unchanged: implement in order F16→F22; all acceptance checks run locally against `dist/` after `cd src/frontend && npm run build`, or with puppeteer/playwright on `npx vite preview`. Shared route manifest: `src/frontend/src/seo/routes.mjs`. Content rules for pages: AGENTIC_SEO_PLAN.md §A3 (put them in `docs/seo/CONTENT_RULES.md` as part of F20).

**Prod note:** AutoForge works on `dev`; production deploys from `prod`. Human reviews comparison-page copy (F20–F22) before merging `dev` → `prod`.

---

## Category: GEO Foundation

### F16 — robots.txt: explicit AI-crawler access (Plan §A1)
**Description:** Extend `src/frontend/public/robots.txt` with explicit blocks for AI crawlers, each repeating the same Disallow list as `User-agent: *`: `GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `Claude-SearchBot`, `PerplexityBot`, `Google-Extended`, `Bingbot`. Intent: allow crawling and answer/training inclusion for all public marketing pages while keeping private routes disallowed.
**Steps:**
1. Refactor robots.txt generation if needed: to avoid hand-maintaining 8 copies of the Disallow list, generate `dist/robots.txt` from a template in the existing build scripts (extend `generate-sitemap.mjs` or add `generate-robots.mjs`), keeping `public/robots.txt` as the `User-agent: *` fallback OR fully switching to generated output — either way the served file must contain all blocks.
2. Build; verify `dist/robots.txt` contains a `User-agent: GPTBot` block with `Allow: /` and `Disallow: /dashboard`, and equivalent blocks for all 7 listed crawlers.
3. Verify the `Sitemap:` line and the original `User-agent: *` block are intact.

### F17 — Meta-description length normalization + extended CI audit (Plan §B5)
**Description:** (a) Shorten every page meta description to ≤160 characters in all 4 locale files (`en.json`, `ru.json`, `es.json`, `uk.json` — all `seo.*` description keys) and in `src/frontend/index.html` (current EN description is 173 chars). Keep keywords, cut adjectives. (b) Extend `_t_seo_i18n_audit.js` (or create `_t_geo_audit.js`) with assertions: robots.txt contains the 7 AI-crawler blocks; `dist/llms.txt` exists and lists every route from the manifest (skip until F18 lands — make the check conditional on file existence, then mandatory); sitemap URL count equals manifest routes × locales; every prerendered page has exactly one `<h1>` and description length 25–160; all JSON-LD blocks parse.
**Steps:**
1. Rewrite descriptions ≤160 chars, all locales, keyword-bearing.
2. Extend the audit script with the new assertions.
3. Build; run the audit: all checks pass; specifically assert no description >160 across all 28 pages.

### F18 — llms.txt + llms-full.txt build-time generation (Plan §A2)
**Description:** Create `src/frontend/scripts/generate-llms.mjs`, wired into the build after prerender. Outputs: (a) `dist/llms.txt` — llmstxt.org-style Markdown: `# PR-TOP` H1, one-paragraph product summary (therapist-controlled between-session assistant: client diary, AI session notes, crisis alerts, Telegram bot; GDPR), then sections `## Product`, `## Security`, `## Legal`, `## Languages` with `- [Title](https://pr-top.com/path): one-line description` entries derived from the route manifest + per-route metadata (add a `title`/`summary` field to `routes.mjs` entries); (b) `dist/llms-full.txt` — plain-text extraction (strip tags, collapse whitespace) of every prerendered EN page concatenated with URL headers.
**Steps:**
1. Add `title`/`summary` metadata to `routes.mjs`.
2. Implement the generator; wire into `package.json` build chain after prerender.
3. Build; verify `dist/llms.txt` starts with `# PR-TOP`, contains an entry for every manifest route, and `dist/llms-full.txt` contains the landing H1 text and is >5 KB.
4. Verify both are plain text (no HTML tags) and F17's conditional llms check now activates and passes.

### F19 — IndexNow: key file + ping script (Plan §B3)
**Description:** Instant-indexing pings to Bing+Yandex on deploy. Generate a static IndexNow key (32-hex string, committed — it is not a secret), serve it as `src/frontend/public/<key>.txt` containing the key itself. Create `src/frontend/scripts/indexnow-ping.mjs`: reads `dist/sitemap.xml`, POSTs all URLs to `https://api.indexnow.org/indexnow` (JSON body: host, key, keyLocation, urlList). NOT part of `npm run build` (build runs in Docker without network guarantees) — expose as `npm run indexnow` for post-deploy invocation (manual, cron agent, or Dokploy post-deploy hook).
**Steps:**
1. Generate the key file in `public/`; implement the script; add the npm script.
2. Build; verify `dist/<key>.txt` exists and its content equals the filename key.
3. Dry-run mode check: `node scripts/indexnow-ping.mjs --dry-run` prints the JSON payload with 28+ URLs and correct keyLocation without sending.
4. Document invocation in the script header + `docs/seo/AGENTIC_SEO_PLAN.md` §B3 stays accurate.

---

## Category: GEO Comparisons (content pages — human reviews copy before dev→prod merge)

Shared requirements for F20–F22: each page is a React route added to `routes.mjs` (→ auto sitemap/prerender/llms.txt); follows `docs/seo/CONTENT_RULES.md` (§A3: 40–60-word direct answer first, H2/H3 hierarchy, honest feature/price comparison table, FAQ block with FAQPage JSON-LD, visible "Updated: July 2026" stamp, internal links to /pricing + sibling pages, PR-TOP wedge positioning: "note-takers document sessions; PR-TOP stays with clients between sessions — diary, exercises, crisis alerts, in Telegram"). EN-only in this wave (locale versions come later). Competitor facts must be sourced from their public pricing/feature pages at implementation time and dated.

### F20 — Content rules file + /compare/upheal + /alternatives/upheal
**Description:** Create `docs/seo/CONTENT_RULES.md` (checklist from Plan §A3). Build two pages: `/compare/upheal` ("PR-TOP vs Upheal") — honest table: Upheal = AI-native EHR, notes/scheduling/billing, from ~$29/mo, US-centric; PR-TOP = between-session continuity, Telegram-native client channel, crisis alerts, GDPR/EU, RU/UK/ES/EN. `/alternatives/upheal` ("Upheal alternatives") — listicle including Mentalyc, Twofold, Heidi, Supanote + PR-TOP with wedge clearly stated.
**Steps:**
1. Create CONTENT_RULES.md.
2. Implement both pages as routes + manifest entries with title/summary/seo metadata.
3. Build; verify `dist/compare/upheal/index.html` exists, contains one H1 with "Upheal", a `<table>`, FAQPage JSON-LD that parses, canonical, and "Updated:" stamp; same for alternatives page.
4. Audit (F17) passes with the two new pages included; sitemap now contains them.

### F21 — /compare/mentalyc + /alternatives/mentalyc
**Description:** Same pattern. Mentalyc angle: privacy-first AI notetaker (zero recording storage) — acknowledge honestly; PR-TOP wedge: Mentalyc ends at documentation, PR-TOP adds the client-facing between-session layer; both privacy-focused (contrast approaches: anonymized transcripts vs self-host/GDPR/data-sovereignty — link `/security/*` pages).
**Steps:** mirror F20 steps 2–4 for the two Mentalyc pages.

### F22 — /best-ai-assistant-for-therapists (best-of listicle)
**Description:** The LLM-citation magnet: "Best AI assistants for therapists (2026)" — 6–8 honest entries (Upheal, Mentalyc, Twofold, Heidi, Supanote, Freed, Eleos, PR-TOP), one-paragraph verdict each with "best for" labels (PR-TOP: "best for between-session client support & Telegram-first practices"), summary comparison table, direct-answer intro, FAQ. Links out to /compare/* pages (internal hub structure).
**Steps:**
1. Implement page + manifest entry.
2. Build; verify prerendered page has the comparison table with ≥6 competitor names, ItemList or FAQPage JSON-LD parses, "Updated:" stamp.
3. Full audit run green; sitemap/llms.txt include all 5 new URLs of this wave.
