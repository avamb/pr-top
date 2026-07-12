# PR-TOP — 35-Query Ranking Panel (July 2026)

**Study date:** 2026-07-11 (Hermes ranking study — baseline before Wave 2 SEO work)
**Purpose:** Fixed query list for monthly A6 prompt/rank panel so progress is measurable
against an identical baseline. Re-run by a scheduled agent monthly; record results in a
new `query-panel-YYYY-MM.md` file in this directory.

---

## Results: July 2026 baseline

PR-TOP appeared in the **top-5** for **1 of 35 queries** at Wave-2 launch.

| # | Query | Language | PR-TOP rank | Competitors in top-5 |
|---|---|---|---|---|
| 1 | client diary for therapists online | EN | **#3** | Evernote, BetterHelp |
| 2 | AI session notes for therapists | EN | — | Quill, AutoNotes, Supanote, Mentalyc |
| 3 | AI clinical documentation mental health | EN | — | Supanote, Freed, Eleos, Heidi |
| 4 | AI note-taker for therapists | EN | — | Mentalyc, Upheal, Twofold, Heidi |
| 5 | therapy documentation AI | EN | — | Supanote, AutoNotes, Freed |
| 6 | therapist AI assistant | EN | — | Twofold, Mentalyc, Upheal |
| 7 | best AI assistant for therapists | EN | — | Upheal, Mentalyc, Twofold, Heidi, Quill |
| 8 | AI practice management for therapists | EN | — | SimplePractice, TherapyNotes, Jane |
| 9 | practice management software for therapists | EN | — | SimplePractice, TherapyNotes, Jane, TheraNest |
| 10 | therapy practice management AI | EN | — | SimplePractice, TherapyNotes |
| 11 | coaching practice software | EN | — | CoachAccountable, Paperbell, HoneyBook |
| 12 | coaching session management software | EN | — | CoachAccountable, Practice, HoneyBook |
| 13 | secure practice management for therapists | EN | — | SimplePractice, TherapyNotes |
| 14 | HIPAA compliant AI for therapists | EN | — | Heidi, Freed, Eleos, Supanote |
| 15 | GDPR compliant therapy software | EN | — | SimplePractice (EU), Kairos, Theranest |
| 16 | telegram bot for therapists | EN | — | No dedicated competitors |
| 17 | between-session support for therapy clients | EN | — | BetterHelp, Wysa, Woebot |
| 18 | therapist client communication app | EN | — | SimplePractice, Spruce Health |
| 19 | client journaling app therapy | EN | — | Penzu, Reflectly, BetterHelp |
| 20 | Upheal alternatives | EN | — | Mentalyc, Twofold, Heidi, Supanote |
| 21 | Mentalyc alternatives | EN | — | Upheal, Twofold, Heidi, AutoNotes |
| 22 | encrypted therapy notes app | EN | — | SimplePractice, TherapyNotes |
| 23 | телеграм-бот для психолога | RU | — | No dedicated competitors |
| 24 | ИИ-ассистент для психолога | RU | — | Zigmund (general therapy), Яндекс.Алиса |
| 25 | дневник клиента психолога онлайн | RU | — | Generic diary apps |
| 26 | CRM для психолога | RU | — | Prostoy Biznes, AmoCRM |
| 27 | AI заметки для психолога | RU | — | No dedicated competitors |
| 28 | приложение для психолога | RU | — | Zigmund, YouTalk, Yasno |
| 29 | протокол сессии психолога | RU | — | Generic note apps |
| 30 | телеграм-бот для психолога | UK | — | No dedicated competitors |
| 31 | застосунок для психолога | UK | — | Ukr therapy platforms |
| 32 | ШІ-асистент для психолога | UK | — | No dedicated competitors |
| 33 | дневник клієнта психолога | UK | — | Generic diary apps |
| 34 | asistente IA para terapeutas | ES | — | No dedicated competitors |
| 35 | diario del cliente psicología | ES | — | Generic diary apps |

---

## Wave-2 targeted pages (to regain in monthly re-runs)

The following pages were built during Wave 2 to target the queries above:

| Page | Target queries (#) |
|---|---|
| `/ai-session-notes-for-therapists` | 2, 3, 4 |
| `/therapy-documentation-ai` | 5, 3 |
| `/therapist-ai-assistant` | 6, 7 |
| `/ai-practice-management` | 8, 9, 10 |
| `/for-coaches` | 11 |
| `/coaching-session-management` | 12 |
| `/secure-practice-management` | 13 |
| `/hipaa-and-gdpr-for-therapy-software` | 14, 15 |
| `/client-diary-for-therapists` | 1, 19 |
| `/compare/upheal` | 20 |
| `/alternatives/upheal` | 20 |
| `/compare/mentalyc` | 21 |
| `/alternatives/mentalyc` | 21 |
| `/best-ai-assistant-for-therapists` | 7, 4 |

Queries 23–35 (RU/UK/ES) — no direct competitor pages exist; these are first-mover
opportunities. The `/ru/`, `/uk/`, `/es/` locale mirrors of the above pages provide the
targets once they gain index authority.

---

## How to run the monthly panel

```bash
# 1. Build (so sitemap / prerender are fresh)
cd src/frontend && npm run build

# 2. Run the GEO audit to confirm all audits pass before submitting
node _t_geo_audit.js
node _t_seo_i18n_audit.js

# 3. Post-deploy: ping search engines with new/changed URLs
cd src/frontend && npm run indexnow
# Note: run AFTER Dokploy deploy completes (not during Docker build stage)
# because the build environment has no guaranteed egress to api.indexnow.org.
# The command reads dist/sitemap.xml (all public marketing routes x 4 locales)
# and POSTs the full list to https://api.indexnow.org/indexnow in one call,
# covering Bing + Yandex within minutes.
# Dry-run (inspect payload without sending): npm run indexnow -- --dry-run

# 4. For each query in the 35-query list, ask a web-search-enabled model:
#    "What is the best [query]?" and note whether PR-TOP appears in the top-5 results.
#    Record in a new docs/seo/reports/query-panel-YYYY-MM.md (copy this file as template).
```

---

## KPI target (from AGENTIC_SEO_PLAN.md §A6)

- Month 1 (Aug 2026): PR-TOP in top-5 for ≥3 of 35 queries (all EN)
- Month 3 (Oct 2026): ≥8 of 35 queries (incl. first RU entries)
- Month 6 (Jan 2027): ≥15 of 35 queries (EN + RU cluster well represented)

---

## IndexNow post-deploy step (documented here per W7 spec)

After every production deploy that adds or changes public marketing pages:

```bash
cd src/frontend
npm run indexnow
```

This is **sitemap-driven** — it reads `dist/sitemap.xml` and automatically covers all
URLs without manual list maintenance. New pages added to `routes.mjs` appear in the
sitemap at build time and are included in the next IndexNow ping automatically.

The IndexNow key file is committed at `src/frontend/public/<key>.txt` and is NOT a
secret (IndexNow requires the key to be publicly readable for verification). The ping
endpoint is `https://api.indexnow.org/indexnow` which broadcasts to Bing and Yandex in
a single call.

**Do NOT** run `npm run indexnow` inside Docker build (no egress). Run it from the host
after `dokploy deploy` completes — or wire it to a Dokploy post-deploy hook.
