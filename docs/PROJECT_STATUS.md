# PR-TOP — Project Status (SEO · GEO · Assistant · Infrastructure)

**Updated:** 2026-07-13 · **Live site:** https://pr-top.com · **Repo:** github.com/avamb/pr-top
**Branches:** `dev` = `prod` = `master`, all in sync. Prod deploys from `prod` via Dokploy; promote with a fast-forward `dev` → `prod`.
**Detailed plans:** SEO [docs/seo/SEO_PLAN.md](seo/SEO_PLAN.md) · GEO [docs/seo/AGENTIC_SEO_PLAN.md](seo/AGENTIC_SEO_PLAN.md) (RU mirror `.ru.md`) · AutoForge feature specs in `docs/seo/AUTOFORGE_FEATURES*.md` and `docs/AUTOFORGE_FEATURES_ASSISTANT_KB.md`.

This is a status snapshot for handoff. It records what is DONE and live, what is left for a human, and the durable rules that keep it from regressing.

---

## 1. SEO — technical foundation (DONE, live)
- robots.txt, build-time sitemap.xml, canonical, per-route meta via react-helmet, Open Graph / Twitter cards, static JSON-LD @graph, self-hosted fonts.
- Prerender of all public routes (JS-independent HTML for crawlers, incl. Yandex).
- Locale-in-URL: `/`, `/ru/`, `/uk/`, `/es/` with hreflang; all internal links stay within the visitor's locale (verified by a link-graph audit).
- Search consoles: Google (DNS-verified), Yandex (file-verified), Bing (present). IndexNow pings Bing + Yandex on demand (`npm run indexnow`, sitemap-driven).

## 2. SEO Wave 2 — visibility for real queries (DONE, live 2026-07-13)
From a 35-query ranking study (PR-TOP was top-5 for only 1/35). Root causes fixed:
- **P0 duplicate meta description:** a static description in `index.html` survived prerender and appeared first on all 88 pages → crawlers saw identical snippets. Removed; react-helmet is now the sole owner. (Bug shipped once because the template edit was left unstaged — audit now enforces one unique description per page per locale.)
- **P0 auth-route heads:** `/register`, `/login`, `/forgot-password`, `/reset-password` served the homepage head via SPA fallback. Now prerendered as `noindex` shells with their own titles; excluded from sitemap/llms.
- **9 keyword landing pages** (localized ×4), e.g. `/ai-session-notes-for-therapists`, `/for-coaches` (business language, no clinical terms), `/hipaa-and-gdpr-for-therapy-software` (honesty-constrained — states plainly PR-TOP is NOT HIPAA-audited and offers no BAA), `/client-diary-for-therapists` (our one ranking query, #3). Site is now 84 indexable URLs + 4 noindex shells = 88 prerendered pages.
- "Solutions" footer column + contextual hub links so the new pages are discoverable.
- 35-query panel recorded at `docs/seo/reports/query-panel-2026-07.md` for monthly re-measurement.

## 3. GEO — visibility in AI answers (DONE, live)
- robots.txt explicitly allows AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Bingbot). Recorded decision: we WANT training/answer inclusion.
- `llms.txt` + `llms-full.txt` generated at build from the route manifest.
- Comparison / alternatives / best-of pages (Upheal, Mentalyc, listicle), localized ×4, honest, no outbound competitor links (names only) — the LLM-citation assets.
- **Verified working at the crawl layer (Cloudflare AI Crawl Control, 2026-07-13):** ~127 AI-crawler requests/day and rising; GPTBot, Googlebot, ClaudeBot, PerplexityBot, Applebot all Allowed and getting 200s. Cloudflare does NOT block AI bots here.

## 4. Assistant "Ask about PR-TOP" — security + quality (DONE, live)
Public landing bot + authenticated therapist bot, shared but audience-scoped knowledge base.
- **S1** raw backend source removed from the RAG index (was an information-disclosure risk); index = curated docs only.
- **S2** audience-scoped retrieval: public bot sees public docs; signed-in bot also sees internal reference (endpoints, UI-label map).
- **S3** output guardrail: replies are redacted of secret-shaped strings (API keys, Bearer, JWT).
- **S4** knowledge base = `docs/assistant-kb/` (22 authored how-tos ≥600 words + auto-generated reference: endpoints, ui-labels, pricing). Pricing/endpoints/labels regenerate from code via `npm run docs:assistant` — pricing reads plan limits from the DB seed (`connection.js`), never hardcoded.
- **S5** public bot `max_tokens` 600, per-IP/session/lead rate limits, answer cache fixed.
- **S6** full product coverage (dashboard, clients, analytics, NL queries, bulk upload, exercises, crisis, settings, subscription, supervision, export/GDPR, onboarding, client bot, troubleshooting).
- **S7** 32 seeded canned FAQ answers served from cache without an LLM call; cache consulted on every message (not just the first); reviewed seeds outrank stale answers; reindex purges non-seed cache.
- **S8** cache matching upgraded from TF-IDF to AI embeddings (text-embedding-3-small); threshold calibrated live to 0.62 so same-intent paraphrases hit cache while distinct topics don't collide. Precision verified on prod.
- Regression net: `_t_assistant_kb_audit.js` (79 checks) + `_t_geo_audit.js` + `_t_seo_i18n_audit.js`, all green.

## 5. Infrastructure fixes (DONE, live)
- **Analytics restored:** the `/analytics/` Umami proxy was lost when the standalone nginx was removed (Traefik conflict); re-added in the frontend nginx with `^~` so the regex static-asset location can't shadow it. Real-time visits confirmed (mobile + desktop).
- **Prerendered pages served at slash-less canonical URLs** without a 301 (fixed `try_files $uri/` → `$uri/index.html` + `absolute_redirect off`).
- **favicon.ico + apple-touch-icon.png** added (were 404 for every bot/browser; SVG-only touch icon was ignored by iOS).
- **`www.pr-top.com` → `pr-top.com`** 301 (Cloudflare Redirect Rule + proxied `www` DNS record); path, query (UTM), and locale preserved. Verified 2026-07-13.

## 6. Definition of Done — keep the assistant current (enforced)
`prompts/app_spec.txt` now instructs every AutoForge feature that changes user-facing behavior to: update the matching `docs/assistant-kb/` how-to, seed a common Q&A if relevant, run `npm run docs:assistant`, and pass `node _t_assistant_kb_audit.js`. The KB re-indexes on backend startup, so a normal deploy refreshes it. Contract: `docs/assistant-kb/README.md`.

---

## 7. Open items — HUMAN (owner) actions
- **Google Search Console:** request indexing of the 9 new landings (EN today, `/ru/` next day; loop through the list in [SEO_PLAN.md](seo/SEO_PLAN.md) Phase 6). Re-submit the sitemap (grew 48 → 84 URLs).
- **Yandex Webmaster:** "Переобход" for the same EN+RU URLs (larger quota — all at once).
- **Content review before it ages:** the `/hipaa-...` page and `/for-coaches` positioning; `faq-seed.json` public answers (every visitor sees them).
- **Off-page (Program A5 / Phase 7):** list on SoftwareAdvice, Capterra, G2; PsychologyToday guest posts; mentions on ICF / APA / coaching-federation sites; Product Hunt launch. Agent can draft copy; owner submits.
- **Do NOT enable Cloudflare "Managed robots.txt"** — it would signal "no AI training," contradicting the GEO strategy.

## 8. Open items — AGENT (backlog, ready to run when asked)
- **Re-run the 35-query panel** in ~2–4 weeks (`docs/seo/reports/query-panel-2026-07.md`) to measure Wave 2 impact.
- **B1 weekly SEO monitor** + **A6 AI-visibility prompt panel** — scheduled agent; needs GSC/Yandex API creds (one-time, human).
- **N1 mobile Core Web Vitals audit** (AMP is deliberately NOT pursued — see AGENTIC_SEO_PLAN §N1).
- **B4 monthly competitor watch**; **B2 content pipeline** (2–4 pages/mo from GSC gaps).
- Optional assistant polish: `user`-audience + non-EN canned seeds; further AI-threshold tuning from real query logs.

## 9. Repo map (for a new session)
- Frontend: `src/frontend/` (React+Vite). Routes manifest `src/frontend/src/seo/routes.mjs` drives sitemap/prerender/llms. Build chain in `src/frontend/package.json` (`docs:assistant`, `indexnow` are separate scripts).
- Backend: `src/backend/` (Express, SQLite). Assistant: `routes/publicAssistant.js`, `routes/assistant.js`, `services/assistant*.js`.
- Knowledge base: `docs/assistant-kb/` (authored + `reference/` generated). Serving nginx: `src/frontend/nginx.conf` (the top-level `nginx/` dir is legacy). Deploy: Dokploy on Hetzner, Cloudflare in front.
- Backend resilience (2026-09-07, after a 2-day API hang): liveness route `/api/health/live`, healthcheck-driven kill + restart (`src/backend/healthcheck.sh`, compose `init: true`), in-process memory watchdog with hourly `[MEMORY]` log lines, V8 heap cap + container `mem_limit`, graceful SIGTERM. Runbook: `docs/troubleshooting/backend-hang-runbook.md`.
- Audits at repo root: `_t_seo_i18n_audit.js`, `_t_geo_audit.js`, `_t_assistant_kb_audit.js`.
