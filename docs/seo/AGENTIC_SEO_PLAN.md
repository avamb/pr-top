# PR-TOP — Agentic SEO & Competitive Growth Plan (GEO + Agent-Operated SEO)

> **Canonical file (agents work with this one).** A Russian mirror for the owner exists at [AGENTIC_SEO_PLAN.ru.md](AGENTIC_SEO_PLAN.ru.md) — whenever you change this file, update the mirror in the same commit.

**Prepared:** 2026-07-06. Sequel to [SEO_PLAN.md](SEO_PLAN.md) (Phases 1–3 shipped to prod: prerender, locale URLs, hreflang, sitemap, JSON-LD).
**Repo:** `C:\Projects\dev-psy-bot`, branch `dev` (Dokploy prod deploys from `prod`; promote via fast-forward merge `dev` → `prod`).
**Scope:** three programs that run largely on agents:
- **A. GEO (Generative Engine Optimization)** — get PR-TOP cited/recommended by ChatGPT, Perplexity, Claude, Copilot, Google AI Overviews.
- **B. Agent-operated SEO machine** — recurring SEO ops executed by scheduled agents / AutoForge, not humans.
- **C. Competitive content program** — own the comparison and "best-of" queries against named competitors.

Rationale: therapists increasingly ask AI assistants ("best AI note-taker for therapists", "как психологу вести заметки с ИИ") instead of googling. AI answers are won by: crawlable server-rendered content (done), answer-shaped pages, comparison/best-of coverage, brand presence on sources LLMs trust (G2, Reddit, directories), and freshness. Classic SEO (Phases 1–3) is the foundation; this plan is the growth layer.

---

## Program A — GEO: visibility in AI answers

### A1. Open the door to AI crawlers (30 min, AutoForge-able)
Update `src/frontend/public/robots.txt`: keep existing Disallow rules, add explicit allow blocks for AI crawlers so intent is unambiguous:

```
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /
```
(Each block repeats the same Disallow list for private routes as `User-agent: *`.)
**Decision recorded:** we WANT training/answer inclusion — the product benefits from being known to models. Verify no WAF/Traefik rule blocks these UAs (check access logs after a week).
**Acceptance:** `curl https://pr-top.com/robots.txt` contains GPTBot/ClaudeBot/PerplexityBot allow blocks.

### A2. llms.txt + llms-full.txt at build time (half-day, AutoForge-able)
Extend the build pipeline (`src/frontend/scripts/`) with `generate-llms.mjs`:
- `dist/llms.txt` — curated Markdown index per the llmstxt.org convention: one-paragraph product summary, then grouped links (Product, Security, Pricing, Comparisons, Languages) with one-line descriptions.
- `dist/llms-full.txt` — concatenated plain-text content of all public marketing pages (extract text from prerendered HTML).
- Regenerated on every build from the shared route manifest → never stale.
**Acceptance:** both files served with `text/plain`; llms.txt lists every public marketing page; content matches live pages.

### A3. Answer-shaped content standard (rule for all future pages)
Every marketing/content page must contain: a 40–60-word direct answer to the page's core question in the first block (LLMs lift this verbatim); scannable H2/H3 hierarchy; a stats-with-sources block (e.g., "processes N sessions/month", cite external stats with links); an FAQ section with FAQPage schema; a comparison table where relevant. Confident declarative prose — hedged text gets skipped by answer engines.
**Where enforced:** add this checklist to `docs/seo/CONTENT_RULES.md` and reference it in every content-agent prompt (see B2).

### A4. Comparison & alternatives pages — the highest-ROI GEO asset (Program C details the targets)
LLMs answering "best X" and "X vs Y" queries pull disproportionately from pages that already frame the comparison. Competitors (Mentalyc, Twofold) aggressively publish these; PR-TOP has zero. Build `/compare/<competitor>` and `/alternatives/<competitor>` pages (EN first, then RU/UK/ES) — see C2.

### A5. Brand presence on LLM-trusted sources (human + agent-assisted, ongoing)
LLMs cite aggregators more than vendor sites. Priority actions:
1. **G2 + Capterra listings** with ≥5 genuine reviews (ask pilot users) — these two are cited in nearly every "best therapy software" AI answer.
2. **Product Hunt launch** (already in SEO_PLAN Phase 7) — PH pages are heavily crawled by LLMs.
3. **Reddit**: r/therapists threads about AI note-takers are a top LLM source (competitors' review posts already rank). Genuine participation only; one honest "we built this" post per subreddit rules.
4. **AlternativeTo** listing (its "alternatives to Upheal/Mentalyc" pages feed AI answers directly).
5. RU: Habr/vc.ru founder article; B17.ru profile — the RU-language LLM answer space for "ИИ для психолога" is nearly empty → first-mover citation advantage.
**Agent-assisted:** an agent drafts listing copy, review-request emails, and the PH launch kit; a human clicks submit.

### A6. Measure AI visibility (agent-run, weekly)
- Umami: segment referrers `chatgpt.com`, `perplexity.ai`, `copilot.microsoft.com`, `gemini.google.com` (+ utm from PH/G2). Baseline: ~0 today.
- Bing Webmaster **AI Performance (BETA)** report — screenshot/record weekly.
- Prompt-probe panel: a scheduled agent asks a fixed panel of ~20 questions (EN+RU: "best AI assistant for therapists with Telegram", "телеграм-бот для психолога с дневником клиента", "Upheal alternatives"…) via web-search-enabled models monthly and logs whether PR-TOP is mentioned/cited, into `docs/seo/reports/ai-visibility-YYYY-MM.md`.
**KPI:** PR-TOP mentioned in ≥3 of 20 panel prompts within 4 months (EN), ≥8 of 20 for RU prompts (weak competition).

---

## Program B — Agent-operated SEO machine

Recurring ops, each runnable by a scheduled agent (Claude Code cron/routine) or AutoForge feature. All reports land in `docs/seo/reports/` and are committed to `dev`.

### B1. Weekly SEO monitor (agent, 30 min/week, read-only)
Script + agent: pull GSC Search Analytics API (needs one-time OAuth/service-account setup `[HUMAN]`) and Yandex Webmaster API; live-check the acceptance curls from SEO_PLAN Phase 1; diff `site:pr-top.com` index counts. Output: `reports/seo-weekly-YYYY-WW.md` — indexed pages, impressions/clicks, top queries, new coverage errors, broken checks. Flag regressions as AutoForge bug-features automatically.

### B2. Content pipeline (agent produces, human approves, ~2–4 pages/month)
Loop per page: (1) pick target query from GSC "impressions but no page" data + C1 keyword gaps → (2) agent writes a brief (intent, outline, competitor pages to beat, internal links) → (3) agent drafts the page as a React route + all 4 locales following A3 rules → (4) **human review** (tone matters in this niche) → (5) merge → prerender/sitemap update automatically → (6) IndexNow ping (B3) + GSC manual request `[HUMAN, 1 min]`.
Pages inherit the F2 route-manifest pattern, so sitemap/prerender/llms.txt pick them up with zero extra work.

### B3. IndexNow on deploy (2 h, AutoForge-able)
Generate an IndexNow key file into `src/frontend/public/`, and add `scripts/indexnow-ping.mjs` that POSTs changed URLs (diff of sitemap vs previous build, or full list — 28+ URLs is fine) to `api.indexnow.org` (covers Bing + Yandex). Wire as a post-deploy step or a Dokploy webhook-triggered agent.
**Acceptance:** key file served; ping returns 200; Bing Webmaster IndexNow section shows submissions.

### B4. Competitor watch (agent, monthly)
Agent crawls competitor pricing/feature/blog pages (Upheal, Mentalyc, Twofold, Heidi, Supanote, Freed, Eleos + any new entrants found via search), diffs against last month's snapshot in `docs/seo/competitors/`, and outputs: price changes, new features, new comparison content targeting us, and required updates to our `/compare/*` pages (which then flow into B2).

### B5. Tech-SEO regression in CI (already 80% built)
Extend `_t_seo_i18n_audit.js`: assert robots.txt AI-crawler blocks, llms.txt exists and lists all public routes, sitemap URL count matches manifest, every page's description ≤160 chars (fixes the Bing nag wholesale), exactly one H1, JSON-LD parses. Run on every AutoForge session against built `dist/`.

### B6. Review & mention harvesting (agent-assisted, ongoing)
Agent maintains `docs/seo/outreach/`: prospect list (podcasts, therapist newsletters, training institutes RU/UA/ES), drafted personalized pitches, and a tracker. Human sends from own mailbox (deliverability + authenticity). Target: 4 pitches/week sent, ≥10 referring domains by month 3.

---

## Program C — Competitive content: own the comparisons

### C1. Competitive map (validated 2026-07)
| Segment | Players | PR-TOP wedge |
|---|---|---|
| AI note-takers for therapists (EN) | Upheal ($29+/mo, AI-native EHR, ~25k sessions/mo), Mentalyc (privacy-first leader), Twofold, Heidi (reliability complaints — exploitable), Supanote, Freed, Eleos (enterprise) | They stop at documentation. **PR-TOP owns between-session continuity**: client diary, crisis alerts, exercises, Telegram-native |
| Practice management (EN) | SimplePractice, TherapyNotes, Jane | Heavy, US-insurance-centric; PR-TOP is light + GDPR/EU + Telegram |
| RU/UA/CIS | **No specialized competitor** (B2C platforms Zigmund/Yasno serve clients, not the therapist's practice) | First-mover: "телеграм-бот для психолога", "ИИ-ассистент психолога" are winnable in months |

Positioning line for all comparison content: *"AI note-takers document your sessions. PR-TOP also stays with your clients between sessions — diary, exercises, crisis alerts — in the messenger they already use."*

### C2. Page program (in build order; each = 1–2 AutoForge features, EN first, RU where marked)
1. `/compare/upheal` and `/alternatives/upheal` — biggest brand = most search volume.
2. `/compare/mentalyc`, `/alternatives/mentalyc`.
3. `/best-ai-assistant-for-therapists` — the "best-of" listicle including honest competitor entries (this is what LLMs cite; include PR-TOP with clearly-stated wedge).
4. `/compare/simplepractice` (angle: "lightweight European alternative").
5. RU: `/ru/ai-dlya-psihologa` (guide), `/ru/telegram-bot-dlya-psihologa` (category-defining page) — no competition, high intent.
6. Refresh quarterly via B4 findings (LLMs favor fresh comparison data; stamp "Updated: <month year>" visibly).
Rules: honest feature/price tables (agent-verified via B4), each page follows A3 standard, FAQPage schema, hreflang for localized versions.

### C3. Sequencing & effort
| Order | Item | Program | Effort | Executor |
|---|---|---|---|---|
| 1 | A1 robots for AI crawlers + B5 CI checks | A/B | 0.5 d | AutoForge |
| 2 | A2 llms.txt generation | A | 0.5 d | AutoForge |
| 3 | B3 IndexNow | B | 0.5 d | AutoForge |
| 4 | C2.1–C2.3 first comparison pages | C | 2–3 d | AutoForge + human review |
| 5 | A5 G2/Capterra/PH/AlternativeTo listings | A | 1–2 d spread | Human, agent-drafted |
| 6 | B1 weekly monitor + A6 AI-visibility panel | B | 1 d setup | Scheduled agent (`[HUMAN]`: API creds) |
| 7 | B2 content pipeline (continuous) | B/C | 2–4 pages/mo | Agent + human review |
| 8 | B4 competitor watch (monthly) + C2.6 refresh | B/C | auto | Scheduled agent |

### KPIs (6 months)
- AI answers: PR-TOP cited in ≥3/20 EN and ≥8/20 RU panel prompts (A6).
- Organic: comparison pages = ≥30% of non-brand organic clicks; ≥5 first-page Google positions in RU cluster.
- Referrals: measurable sessions from chatgpt.com/perplexity.ai in Umami; ≥10 referring domains (mo. 3), ≥30 (mo. 6).
- Pipeline: ≥12 new indexable pages published; 100% pass B5 CI checks.

### What stays human
G2/Capterra/PH account creation and submissions; sending outreach; API credentials for GSC/Yandex (one-time); review/approval of every content page before merge (clinical-adjacent niche — tone and claims must be human-vetted); Reddit participation.
