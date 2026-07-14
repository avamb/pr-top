# AutoForge Feature Breakdown — Landing Repositioning (Practice-First Messaging)

Source plan: [POSITIONING_ADDENDUM.md](POSITIONING_ADDENDUM.md). Repo: branch `dev`, frontend in `src/frontend/`.
Features are ordered by dependency — **implement in the listed order** (R1→R9). Each feature is small, independently committable, and has **locally verifiable** acceptance steps (checks run against `npx vite preview` with puppeteer, or grep on `dist/` after `npm run build` in `src/frontend/`).

Conventions for all features:
- **Copywriting mandate is mandatory.** Every agent prompt for R1–R8 MUST include §4 of [POSITIONING_ADDENDUM.md](POSITIONING_ADDENDUM.md) verbatim. The agent writes as a professional copywriter/editor: native-quality prose in **all four locales (en/ru/es/uk) in the same commit**, no calques or machine-translation cadence, calm professional tone, no hype or exclamation marks. Every string is read-aloud-checked and terminology is consistent within each locale.
- **Terminology discipline (hard rule):** the word "bot" (бот/bot) must not appear in any hero, H1 or H2; Telegram at most once per section, framed as a delivery channel; AI framed only as an assistant under the specialist's control.
- **Dual-intent SEO rule:** visible H1/hero copy is practice-first; `<title>`/meta description keep both AI-intent and routine-intent keywords (see POSITIONING_ADDENDUM §3). Never delete AI keywords from meta; never add "AI"/"bot" back into the H1.
- All landing copy lives in i18n keys (`src/frontend/src/i18n/{en,ru,es,uk}.json`, namespace `landing.*` / `landingConfirm.*` / `seo.*`). No hardcoded user-facing English in JSX (existing hardcoded strings encountered while editing must be moved to i18n).
- Build command: `cd src/frontend && npm run build`. Runtime checks: `npx vite preview --port 4173` + puppeteer script (repo uses `_t*.js` scripts as harness).
- After copy changes, verify **no raw i18n keys render** (no `landing.` literal visible on the page) in all four locales (`/`, `/ru/`, `/es/`, `/uk/`).

---

## Category: Repositioning — Hero & Meta

### R1 — Practice-first hero + dual-intent home meta
**Description:** Rewrite the home hero (`landing.heroTitle1`, `heroTitle2`, `heroSlogan`, `heroDesc` in all 4 locales) to the practice-first positioning: H1 ≈ "A unified workspace for a therapist and their practice" (EN; craft native equivalents per locale, ≤ ~70 chars where achievable); subheadline about keeping context between sessions, working at your own pace and protecting professional boundaries; below it the safety sentence: "PR-TOP brings together the client diary, session notes, assignments and safe communication. Automation technologies help structure the routine, but they do not replace the specialist and do not act on their behalf." Remove "AI Assistant" and "Telegram bot" from the H1/hero entirely. Update `seo.home.title`/`seo.home.description` (all 4 locales) to the dual-intent form (EN title: `PR-TOP — Practice Workspace for Therapists & Psychologists | Client Diary, Session Notes, AI Support Between Sessions`), and update the hardcoded fallback `title`/`description` props in `src/frontend/src/pages/Landing.jsx` (currently lines ~223–224) to match the EN values. Update `landing.footerDesc` to the same voice.
**Steps:**
1. Rewrite the hero + footer keys in `en.json`, `ru.json`, `es.json`, `uk.json` per the copywriting mandate; rewrite `seo.home.*` in all 4 locales keeping both intents.
2. Update the `Seo` fallback props in `Landing.jsx` to the new EN meta.
3. Build; puppeteer on preview `/`: H1 contains neither `AI` nor `bot`/`Bot`; page body contains the safety-sentence phrase (`do not act on their behalf` EN); `document.title` contains both `Practice Workspace` and `AI`.
4. Repeat the H1 check on `/ru/`, `/es/`, `/uk/`: H1 contains no `AI`/`ИИ` and no `бот`/`bot`; no raw `landing.` keys anywhere on the page.
5. Grep the four locale JSONs: `heroTitle1`+`heroTitle2` combined contain no `bot`/`бот` substring.

### R2 — Feature cards rewritten as outcomes for the specialist
**Description:** Rewrite `landing.feature1Title/Desc` … `feature6Title/Desc` and `landing.featuresTitle/featuresDesc` (all 4 locales) so each card sells an outcome for the practice, not a technology. Specifically: feature1 becomes "Session notes you review and control" (notes are drafts the specialist reviews — control stays with them); feature6 becomes "A familiar client channel — on your terms" (client space/channel framing; Telegram named once, at the end of the description, as the channel the client already knows; "bot" removed); remove SOS/crisis phrasing from feature6's description (it moves to R4's dedicated block). Other cards keep their meaning but pass the professional-writer pass (tone, rhythm, consistency).
**Steps:**
1. Rewrite the 14 keys (`featuresTitle`, `featuresDesc`, 6×Title, 6×Desc) in all four locale JSONs.
2. Grep locale JSONs: within `feature1Title`…`feature6Desc`, `Telegram` appears at most once per locale and `bot`/`бот` zero times; `SOS` zero times.
3. Build; puppeteer on preview `/` and `/ru/`: six feature cards render, no raw keys, feature headings contain no `bot`.

---

## Category: Repositioning — New Sections

### R3 — "Automation helps. Decisions stay with you." control section
**Description:** Add a new landing section (new component, e.g. `src/frontend/src/components/landing/ControlSection.jsx`, rendered in `Landing.jsx` after Features) with heading "Automation helps. Decisions stay with you." and body copy: PR-TOP can transcribe recordings, structure draft notes and help find context — but the service does not conduct therapy, does not diagnose, does not make clinical decisions, and does not reply to clients on the specialist's behalf outside rules the specialist sets. New i18n keys `landing.control*` in all 4 locales. This section is where AI is introduced on the page — not earlier.
**Steps:**
1. Create the section component + keys in all four locales; render it after the Features section.
2. Build; puppeteer on preview `/`: the section renders with the new H2; the phrase `does not` (EN)/`не` (RU) negation list is present; H2 count on page increases by exactly one; still exactly one `<h1>`.
3. Verify the string "AI" does not appear in the DOM *above* this section (hero and feature cards) except inside `<title>`/meta.

### R4 — Agreed care protocol block + FAQ rewrite
**Description:** Replace "crisis alerts / SOS button" messaging with a careful dedicated block (own small section or sub-block of R3's section): an *agreed response protocol* — the client has a way to signal urgency, the specialist decides in advance how such signals reach them and how they respond. Rewrite `landing.faqQ2/faqA2` (all 4 locales) in the same spirit (no "SOS button" as the lead; the mechanism described as part of the protocol). FAQPage JSON-LD updates automatically from i18n — verify it still parses.
**Steps:**
1. Add the protocol block (new keys `landing.protocol*`, all 4 locales) and rewrite `faqQ2/faqA2` in all 4 locales.
2. Build; puppeteer on preview `/`: extract the FAQPage JSON-LD, `JSON.parse` succeeds, 5 Question items, Q2 text matches the new copy.
3. Grep locale JSONs: `faqA2` no longer leads with `SOS`; the landing hero/features contain no `SOS`.
4. Puppeteer `/uk/` and `/es/`: protocol block renders localized, no raw keys.

### R5 — "One week in practice" walkthrough section
**Description:** Replace the current "learn more → feature cards" flow with a real scenario. New section (component, e.g. `WeekInPractice.jsx`; keys `landing.week*`, all 4 locales): 3–4 concrete moments of one week — e.g. Monday: session ends, a draft note is ready for your review; Wednesday: the client journals in a channel they already use, you see the context accumulate; Thursday: a signal per the agreed protocol reaches you the way you chose; Friday: before the next session you open one screen with the whole picture. Update the hero secondary CTA (`landing.learnMore`) to point at this section (`#how-it-works`).
**Steps:**
1. Create the section + keys (all 4 locales); anchor id `how-it-works`; hero secondary CTA href updated.
2. Build; puppeteer on preview `/`: clicking the hero secondary CTA scrolls to the new section (hash `#how-it-works` in URL); section shows 3–4 steps; exactly one `<h1>` on page.
3. No raw keys in all four locales on `/`, `/ru/`, `/es/`, `/uk/`.

### R6 — Section order + "Technology inside PR-TOP" section
**Description:** Reorder `Landing.jsx` main content to the target structure: Hero → Features (outcomes, R2) → Week-in-practice (R5) → Control/Protocol (R3+R4) → Anti-Burnout (existing, keep) → **new "Technology inside PR-TOP" section** → FAQ → Pricing. The technology section (keys `landing.tech*`, all 4 locales) answers "how is this built" *after* value is established: Claude-class language models for transcription/summaries, Telegram as client channel, encryption — presented as implementation facts, not selling points. Keep the existing internal solution-links block (SEO) at the bottom of the Features section unchanged.
**Steps:**
1. Reorder sections in `Landing.jsx`; add the tech section + keys (all 4 locales).
2. Build; puppeteer on preview `/`: assert section order by walking `main > section` aria-labels / headings — Features before Week-in-practice, Control before Technology, Technology before FAQ.
3. The solution-links block still renders with all 7 links (SEO internal graph unchanged); `/best-ai-assistant-for-therapists` link still present.
4. Lighthouse-style sanity: no layout console errors on load; IntersectionObserver animations still fire (burnout section becomes visible on scroll).

---

## Category: Repositioning — Funnel & SEO Corpus

### R7 — LandingConfirm alignment + hardcoded strings to i18n
**Description:** Align the reminders landing (`src/frontend/src/pages/LandingConfirm.jsx`, `src/frontend/src/components/landing/ConfirmHero.jsx`) with the addendum: the hardcoded English badge `Telegram Session Reminders` (ConfirmHero.jsx:18) and the hardcoded social-proof line `7-day free trial · No credit card required · Cancel anytime` (ConfirmHero.jsx:45) move to i18n keys (all 4 locales); badge rewording ≈ "Session reminders in a channel your client already knows". In `landingConfirm.*` copy, keep Telegram mentions to one per section and remove "bot" from headings (body mentions as channel are fine — this page's search intent is Telegram-specific, so meta/title keep Telegram).
**Steps:**
1. Move the two hardcoded strings into `landingConfirm.*` keys in all four locale JSONs; reword per mandate.
2. Grep `ConfirmHero.jsx`: no user-facing string literals remain (only `t(...)` calls and aria labels).
3. Build; puppeteer on preview `/confirm` and `/ru/confirm`: badge renders localized; no raw keys; headings contain no `bot`.

### R8 — Dual-intent keyword expansion (routine-intent cluster groundwork)
**Description:** Extend the SEO corpus for non-AI seekers per POSITIONING_ADDENDUM §3, without touching the AI-intent pages. (a) Audit all existing solution pages (`/ai-session-notes-for-therapists`, `/therapist-ai-assistant`, `/ai-practice-management`, `/therapy-documentation-ai`, and the rest of the batch-1/2 pool): meta stays AI-targeted, but each page's intro/direct-answer block gets one practice-first sentence and the safety sentence where it fits naturally (professional-writer pass, all locales those pages have). (b) Add the first routine-intent page `practice-management-for-therapists` (EN, following [CONTENT_RULES.md](CONTENT_RULES.md) fully: direct-answer block, FAQ + JSON-LD, updated-stamp, internal links to `/` and 2 siblings, wedge line) targeting queries like "practice management for therapists", "reduce admin routine private practice" — **no AI in H1**, AI mentioned only in the body as implementation. Register it in `src/frontend/src/seo/routes.mjs`.
**Steps:**
1. Sweep solution pages; add the practice-first sentence to each intro (per available locales); verify no meta title lost its existing keywords (grep diff of `seo.*` keys — only additions allowed).
2. Create the new page + route manifest entry; build; `dist/practice-management-for-therapists/index.html` exists (prerendered), contains one `<h1>` without `AI`, a parseable FAQPage JSON-LD, and an `Updated:` stamp.
3. `dist/sitemap.xml` contains the new URL; `node _t_geo_audit.js` passes with the new page included.
4. CONTENT_RULES pre-merge checklist satisfied for the new page (paste it into the PR).

### R9 — Full-locale regression QA of the repositioned landing
**Description:** Final verification feature — no copy changes. Assert the whole repositioning holds together across locales and didn't regress SEO plumbing: build + prerender green, meta/JSON-LD intact, no raw keys, terminology rules hold everywhere, screenshots for human copy review (the human-review gate from POSITIONING_ADDENDUM §4.6).
**Steps:**
1. `cd src/frontend && npm run build` succeeds; prerender produces `dist/index.html` with the new H1 (grep: no `AI Assistant for Therapists` in the H1 line, present dual-intent `<title>`).
2. Puppeteer over `/`, `/ru/`, `/es/`, `/uk/`: exactly one `<h1>` each; zero raw `landing.` keys; H1/H2s contain no `bot`/`бот`; FAQPage JSON-LD parses on each locale.
3. Grep all four locale JSONs across `landing.*`: `Telegram` count per section-group ≤ 1; safety sentence present in each locale.
4. Capture full-page screenshots of all four locales into `docs/seo/reports/repositioning-screens/` and list them in the PR description for the mandatory human copy review before `dev` → `prod`.

---

## Category: Repositioning — Polish (post-QA follow-up)

### R10 — Copy polish + leftover fixes from the R1–R9 review
**Description:** Follow-up to the 2026-07-14 review of the implemented R1–R9 (all findings verified against `dev` HEAD `ff87931`). Four fixes, no structural changes. **(a) Remove the word "bot" from the two body-copy keys where it leaked back, in all 4 locales:** `landing.week.step5.body` (e.g. EN "…the bot tells clients…" → "…the service lets clients know…"; RU "…бот сообщает клиентам…" → "…сервис сообщит клиентам…") and `landing.faqA2` (e.g. RU "специальном сигнале в Telegram-боте" → "специальном сигнале в привычном клиенту канале" or "…в Telegram"; UK "у Telegram-боті" likewise). Reword naturally per the copywriting mandate — no mechanical substitution. **(b) Russian literary fixes** (professional-editor pass, RU only unless the same flaw exists in a sibling locale): `landing.week.lead` "Пять моментов, которые узнают терапевты" → "Пять моментов, знакомых каждому терапевту"; `landing.featuresTitle` "Ваша практика стала проще" → present-tense form (e.g. "Ваша практика — проще"); `landing.feature2Desc` missing comma before the participial phrase ("Приходите на следующую встречу, зная точно, где вы остановились"). While in the file, proof-read all `landing.*` RU strings changed in R1–R6 for punctuation of participial/deverbal clauses. **(c) Update the static fallback `<title>` and `meta description` in `src/frontend/index.html`** (currently still "AI Assistant … Telegram Bot") to match the new EN `seo.home.title`/`description` — prerender overwrites `dist/index.html`, but any route served without prerender must not flash the old positioning. **(d) Footer link consistency in `Landing.jsx`:** the footer Product column link labelled `t('landing.features')` now points to `#week-in-practice` — restore it to `#features` (or relabel to the week section's own heading key); a link's label and target must match. **(e) Capture the R9 step-4 deliverable that was skipped:** full-page screenshots of `/`, `/ru/`, `/es/`, `/uk/` into `docs/seo/reports/repositioning-screens/` (puppeteer `fullPage: true` against `vite preview` is sufficient) for the mandatory human copy review before `dev` → `prod`.
**Steps:**
1. Reword the two keys in all four locale JSONs; grep all four files across `landing.*`: zero matches for `bot`/`бот`/`боті`/`бота` (the `landingConfirm.*.mockBotType` Telegram-UI mockup labels are the only allowed exception).
2. Apply the RU literary fixes; read every changed RU string aloud per the mandate; no other locale regresses (git diff touches only the intended keys).
3. Update `index.html`; build; grep `src/frontend/index.html`: title contains `Practice Workspace` and no `Telegram Bot`.
4. Fix the footer link; puppeteer on preview `/`: clicking the footer Product-column first link scrolls to the section whose heading matches the link label.
5. `node _t_r9_qa.js`, `node _t_geo_audit.js`, `node _t_seo_i18n_audit.js` all pass (no regressions).
6. Screenshots of all four locales exist in `docs/seo/reports/repositioning-screens/` (4 PNG files, non-empty, full-page) and are listed in the PR description for human review.

### R11 — Localize the pricing tier cards
**Description:** The last non-localized block on the home page: the `tiers` array in `src/frontend/src/pages/Landing.jsx` hardcodes the per-tier feature bullets in English ("Up to 3 clients", "Transcription & summary", "Agreed client protocol", "Full analytics + export", …), so the pricing section renders half-English on `/ru/`, `/es/`, `/uk/` (visible in `docs/seo/reports/repositioning-screens/landing-ru.png`). Pre-existing issue, surfaced by the R10 review. Move every bullet into i18n keys (e.g. `landing.pricingTiers.trial.feat1`… or a per-tier array — follow the existing i18n structure conventions) in **all 4 locales**, translated per the copywriting mandate (§4 of [POSITIONING_ADDENDUM.md](POSITIONING_ADDENDUM.md)) — natural native phrasing, consistent terminology with the rest of the landing (e.g. the protocol bullet must reuse the R4 "agreed protocol" wording of each locale, not a fresh translation). Tier names (Trial/Basic/Pro/Premium) may stay as product names, but "Trial" already has a localized price/period — decide consistently and keep one rule for all four tiers. No layout or price changes.
**Steps:**
1. Move all tier bullet strings from `Landing.jsx` into i18n keys in `en.json`, `ru.json`, `es.json`, `uk.json`; grep `Landing.jsx`: no hardcoded user-facing bullet literals remain in the `tiers` array (only `t(...)` calls, prices and tier names).
2. Terminology check: in each locale the protocol bullet uses the same term as `landing.protocolTitle`'s locale wording; "client(s)"/"session(s)" terms match the locale's existing landing vocabulary.
3. Build; puppeteer on preview `/ru/#pricing`: all bullet items in the four cards contain Cyrillic (no Latin-only strings except product/brand names like "PR-TOP", "Telegram", "GDPR"); repeat for `/uk/` (Cyrillic) and `/es/` (no English bullets).
4. `node _t_r9_qa.js` and `node _t_seo_i18n_audit.js` pass (no regressions); no raw i18n keys render in the pricing section in any locale.
5. Re-capture the four full-page screenshots into `docs/seo/reports/repositioning-screens/` (overwrite) so the human copy review sees the final state.
