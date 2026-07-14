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

---

# Wave 2 — Trust & Truthfulness (second Hermes UX audit, 2026-07-14)

Source: second external UX audit after R1–R11 shipped. Verdict: the repositioning worked; remaining risk is **contradictions between the new narrative and old claims** (security wording, data-location promise, review-vs-autosave, registration screen). Implement in order R12→R20; R12–R15 are P0.

**Truth-before-copy mandate (applies to every Wave-2 feature, in addition to the §4 copywriting mandate):** every factual claim (encryption model, who can decrypt, data location, what is saved automatically, trial length, card requirement) must be **verified against the actual code/architecture in the same session** before the copy is written. Verified facts as of 2026-07-14: encryption is application-level with a server-held `ENCRYPTION_MASTER_KEY` (backend `.env`) — the operator *can* technically decrypt, so "end-to-end encryption", "zero-knowledge" and unqualified "not even the service team can read" are **not** claimable; hosting is a single EU deployment (no region choice, no self-hosting); registration creates a 14-day trial with `stripe_customer_id = NULL` (no card required; confirm-funnel variant is 7 days — `src/backend/src/routes/auth.js:148-163`). If a fact cannot be verified, the agent stops and marks the item `[HUMAN]` instead of writing marketing-safe fiction. Never weaken meta/SEO keywords while fixing copy.

### R12 — P0: One truthful security story (kill E2EE / zero-knowledge contradictions)
**Description:** The site says "Application-level encryption" on the landing (accurate) but "End-to-end encryption" in the footer (`landing.encryption`) and "End-to-End Encryption" + "Zero-Knowledge Architecture" on `/security/encryption` (`security.encryptionTitle`, `security.enc.zeroKnowledge*`) — a contradiction any DPO will catch, and architecturally false (server-held master key). Fix in all 4 locales: (a) footer link label → "Application-level encryption"; (b) security page H1 → "How PR-TOP protects clinical data" (title/meta keep the keyword-bearing but truthful form, e.g. "Application-level encryption for clinical data"); (c) replace the Zero-Knowledge section with an honest access-model section: what is encrypted → where it is stored → who can technically decrypt (the platform, under strict controls) → what support staff can and cannot access → audit logging; (d) landing sweep: reword "Not even the service team can read your files/content" (`landing.feature3Desc`, `landing.tech3Desc`, `landing.faqA1`) to a claim the architecture supports, e.g. "encrypted at the application level; access is restricted, logged, and never used for support without your explicit consent" — exact wording per copywriting mandate. Do not delete the `/security/encryption` route or its SEO registration.
**Steps:**
1. Verify the key model in `src/backend` (master key location, decryption path) and record findings in the PR description.
2. Update the keys in all 4 locales; grep all locales: zero matches for `end-to-end`/`E2EE`/`zero-knowledge` (case-insensitive) in `landing.*` and `security.*` (the unrelated idiom in `TherapyDocumentationAi.jsx` "handles documentation end-to-end" must also be reworded — it collides with the encryption term).
3. Build; puppeteer `/security/encryption`: H1 no longer says "End-to-End"; page renders the what/where/who access table; no raw keys.
4. Puppeteer `/` all 4 locales: footer security column shows the new label; FAQ answer 1 renders the new claim; FAQPage JSON-LD parses.

### R13 — P0: Data-location claim matches reality
**Description:** `landing.feature3Desc` promises "You decide where the data lives" while `landing.tech4Desc` states EU-only hosting. There is no region choice or self-hosting. Rewrite feature3Desc (all 4 locales) to: data stored in the EU + *you* control who in your practice can access it (access-control is the real user power). Align `landing.tech4Desc` wording ("EU-based data hosting", export/deletion on request). If the owner later adds deployment options, this copy is revisited — do not invent options now.
**Steps:**
1. Rewrite the two keys in all 4 locales per mandate.
2. Grep all locales: no "decide where the data lives"-style phrasing remains (`where the data lives`, `где хранятся данные` in the *choice* sense, etc.).
3. Build + puppeteer `/`: card 3 and tech section no longer contradict each other; no raw keys in any locale.

### R14 — P0: Review-vs-autosave — one precise truth
**Description:** `landing.tech1Desc` claims "All output is reviewed and approved by you before anything is saved", but `landing.week.step4.body` says a voice memo "is transcribed and filed under the right client automatically". Verify actual behavior in the backend (diary/notes/transcription flow): drafts *are* persisted server-side before review. Rewrite both (all 4 locales) around the draft model: drafts are saved privately to the specialist's workspace for review; nothing becomes part of the clinical record, and nothing reaches a client, without explicit confirmation. `week.step4` keeps its scene but says the memo lands "as a draft attached to the right client, ready for your review".
**Steps:**
1. Verify the persistence flow in `src/backend/src/routes/` (diary, sessions, transcription) and record findings in the PR.
2. Rewrite `tech1Desc` + `week.step4.body` in all 4 locales; the two statements must be logically consistent (a reviewer reading both must find no contradiction — state the draft model in both).
3. Build + puppeteer `/` (EN + RU): both texts render, no raw keys; grep: no "before anything is saved" absolute claim remains.

### R15 — P0: No PWA/update banners on public marketing pages
**Description:** `InstallPrompt` (PWA install + service-worker "new version" banner) is mounted globally in `App.jsx:183`, so both banners appear over the landing hero and the register page. Gate it: render only on authenticated app routes (`/dashboard`, `/clients`, `/sessions`, `/exercises`, `/analytics`, `/settings`, `/subscription`, `/admin`) — never on public marketing/auth routes. Prefer a route-prefix check (reuse the public-route manifest `src/seo/routes.mjs` or an isPublicRoute helper) over scattering per-page flags.
**Steps:**
1. Implement the gate; unit-testable helper preferred.
2. Puppeteer on preview `/`: dispatch `window.dispatchEvent(new CustomEvent('sw-updated'))` — no banner appears; same on `/register`.
3. Puppeteer stub login → `/dashboard`: dispatch the same event — banner appears (behavior preserved in-app).
4. No console errors on `/`.

### R16 — P1: Registration screen that closes the trust loop
**Description:** `/register` currently asks only email/password/confirm — no trial terms, no legal links, no reassurance (verified: no Terms/Privacy/trial strings in `Register.jsx`). Rework the copy side of the screen (all 4 locales): heading "Create your therapist workspace"; sub-line "Start your 14-day free trial. No credit card required. No client data is needed to explore PR-TOP." (facts verified — 14-day trial, `stripe_customer_id NULL` at signup; the 7-day wording applies only to the confirm-funnel plan and must not leak here); consent line under the button: "By creating an account, you agree to the Terms of Service and Privacy Policy" with working links to `/terms` and `/privacy` (locale-prefixed); a one-line security reassurance reusing R12's truthful wording. DPA link: `[HUMAN]` — only add if the owner provides a DPA document/page; do not fabricate one. Keep the form fields and validation logic unchanged.
**Steps:**
1. Add the new i18n keys (all 4 locales) and render them in `Register.jsx`; links must be real `<a>`/`<Link>` elements resolving in the active locale.
2. Puppeteer `/register`: heading, trial line, consent line with two working links render; clicking Terms navigates to `/terms`; no raw keys; `noindex` meta unchanged.
3. Puppeteer `/ru/register` (or RU-switched): localized strings render.
4. Grep: the register screen nowhere says "7-day" (that's the confirm-funnel trial only).

### R17 — P1: Native-English polish pass (audit table)
**Description:** Apply the audit's language table to the EN locale, then re-align RU/ES/UK to the same meaning (translate the *new* EN, not patch the old): heroSlogan → "Keep the full client context between sessions. Review every note. Maintain clear professional boundaries."; heroDesc → "PR-TOP brings together client diaries, session notes, assignments, and secure communication in one place. It helps you organise routine work, while clinical judgement and client decisions remain with you." (drops "automation technologies", "specialist", "do not act on their behalf" — the safety meaning is kept via "clinical judgement…remain with you"); `feature4Desc` → message-delivery hours framing ("Set the hours when client messages are delivered and when you receive notifications…"); `feature6Desc` → "Clients can keep a diary, complete exercises, and send updates in Telegram — without learning another app. You receive everything in a structured workspace, not in your personal inbox."; protocol heading → "A pre-agreed protocol — not an emergency service" + sub-line "PR-TOP is not a crisis line and does not contact emergency services…"; word-level fixes across landing keys: safe→secure communication, session thread→client timeline, "regardless of how many people you see"→caseload phrasing, "Voice a quick observation"→"Record a quick observation", "The channel is Telegram."→"For now, that channel is Telegram.", "A message, without the blur"→"Client messages without blurred boundaries", "European hosting"→"EU-based data hosting". Preserve every truth-fix from R12–R14 (this feature must run after them; if wordings collide, R12–R14 truthfulness wins over style).
**Steps:**
1. Apply EN changes; read-aloud pass; then rewrite RU/ES/UK from the new EN per the copywriting mandate (native prose, not calques).
2. `node _t_r9_qa.js` passes — including the safety-sentence assertion; if the QA script greps the old literal safety sentence, update the assertion to the new "clinical judgement…remain with you" phrasing *in the same commit*.
3. Build + puppeteer all 4 locales: no raw keys; H1/H2 still contain no `AI`/`bot`.
4. Re-capture the 4 review screenshots (`node _t_screenshots.js`) and commit them.

### R18 — P1: Real product screenshot in the hero (replace abstract SVG)
**Description:** The hero illustration is an abstract dashboard drawing; the audit asks for at least one real, anonymized product screenshot (client timeline, note-review screen, communication-hours settings, or protocol settings). Capture from a local run of the actual app **populated only with seeded demo data** (fictional names; never real client data — verify the seed source), export as an optimized image (WebP/PNG ≤ 200 KB, 2x retina), and replace the hero SVG in `Landing.jsx` with the screenshot in a browser-frame wrapper, `alt` text per locale, `loading="eager"`, explicit width/height (no CLS). Keep the old SVG in git history only.
**Steps:**
1. Seed demo data; capture the note-review screen (best matches "notes you review and control"); verify no real-looking personal data is visible.
2. Integrate; build; puppeteer `/`: image loads (naturalWidth > 0), `alt` localized, Lighthouse-style check: no layout shift on load (compare H1 bounding box before/after image load).
3. Page weight increase ≤ 250 KB; prerendered `dist/index.html` references the asset.

### R19 — P1: Professional proof section `[HUMAN inputs required]`
**Description:** The page makes many promises with no external validation. Add a compact trust section (component + keys, all 4 locales) rendered between Pricing and Footer with **only owner-supplied facts**: legal entity name + jurisdiction, DPO/privacy contact, security/compliance facts already truthfully claimable (EU hosting, GDPR export/deletion, audit log — reuse R12 wording), and testimonials/advisor names **only if the owner provides real ones**. The agent must NOT invent testimonials, client counts, certifications, or advisory boards; if no testimonials are provided, ship the section with the legal/security facts only and leave a clearly-marked extension point.
**Steps:**
1. Collect owner-provided inputs from `docs/seo/TRUST_FACTS.md` (create the template with `[HUMAN]` placeholders if absent and implement only the rows that are filled in).
2. Render the section; build + puppeteer all 4 locales: section renders only filled facts; grep the diff for invented superlatives ("trusted by", "hundreds of therapists") — must be absent unless sourced from TRUST_FACTS.md.
3. FAQ/JSON-LD untouched; no raw keys.

### R20 — P2: Footer & related-links labels — stop pulling the site back to the old position
**Description:** The visible anchor texts of the internal SEO links ("AI session notes", "AI therapist assistant", "Best AI assistants for therapists", footer "Compare" column) re-introduce AI-first framing on the repositioned home page. Keep every URL and target page unchanged (SEO), but reword the *visible labels* (all 4 locales) toward task-first phrasing where the target page allows it (e.g. "AI session notes" → "Session notes & transcription", "AI therapist assistant" → "Your assistant between sessions", listicle keeps its comparative meaning, e.g. "Compare therapist tools"). Do not change `seo.*` meta of the target pages; do not reduce the number of links (internal graph must stay intact).
**Steps:**
1. Reword the label keys (all 4 locales); URLs and link count unchanged (assert in a puppeteer check: same hrefs before/after — snapshot the href list in the test).
2. `node _t_link_graph_w6.js` passes (link-graph audit unchanged).
3. Build + puppeteer `/` + `/ru/`: labels render, hrefs intact, no raw keys.

## R21 — Wave-2 fix pack (findings of the 2026-07-14 owner review of shipped R12–R20)

Split into four independent features R21a–R21d, ordered by priority. Common rules: the §4 copywriting mandate and the truth-before-copy mandate apply; every feature ends with the audit suite green (`node _t_r9_qa.js`, `_t_geo_audit.js`, `_t_seo_i18n_audit.js`, `_t_link_graph_w6.js` — 0 failures) and, if the landing changed visually, with re-captured review screenshots (`node _t_screenshots.js`, commit the 4 PNGs in the same PR).

### R21a — P0: Render the approved company facts (R19 defect)
**Context (verified 2026-07-14):** the R19 agent created its own empty template at `docs/TRUST_FACTS.md` and never read the owner-filled authoritative file **`docs/seo/TRUST_FACTS.md`** (commit b1101c4). `src/frontend/src/data/trustFacts.js` contains only empty `numbers/associations/advisors/testimonials` arrays, so `hasTrustFacts()` is false and `ProfessionalProofSection` renders **nothing**. The owner-approved facts are absent from the site.
**Description:** Add a `legalEntity` fact group to `trustFacts.js`, sourced **only** from the `publish: yes` rows of `docs/seo/TRUST_FACTS.md`: legal entity "ABH TEAM OÜ (private limited company)", registry code "14162982" linked to `https://ariregister.rik.ee/eng/company/14162982`, jurisdiction "Estonia — European Union", registered address "Narva mnt 5, 10117 Tallinn, Estonia", operating since 2016, privacy/support contact `support@pr-top.com`. Render it in `ProfessionalProofSection` (update `hasTrustFacts()` to count the new group) as a calm one-or-two-line legal block — suggested wording is in TRUST_FACTS.md §"Suggested rendering"; localize naturally in all 4 locales (company name, address and code stay untranslated). Delete the duplicate `docs/TRUST_FACTS.md`; update the header comment in `trustFacts.js` to point at `docs/seo/TRUST_FACTS.md`. Hard rules remain: no surnames, no personal identification codes, no invented numbers; `testimonials`/`advisors`/`numbers`/`associations` stay empty.
**Acceptance steps:**
1. Build; grep prerendered `dist/index.html`, `dist/ru/index.html`, `dist/es/index.html`, `dist/uk/index.html`: each contains `ABH TEAM OÜ` and `14162982`; zero matches for the withheld surnames (`Bakanova`, `Andreev` as personal names) and personal codes (`4710207`, `3620127`) anywhere in `dist/`.
2. Puppeteer on preview `/` and `/ru/`: the proof/legal block renders between Pricing and Footer; the registry-code link points to the e-Business Register URL; no raw i18n keys.
3. `docs/TRUST_FACTS.md` deleted; `git grep -l "docs/TRUST_FACTS.md"` over the repo returns nothing (every reference reads `docs/seo/TRUST_FACTS.md`).
4. Audit suite green; screenshots re-captured and committed.

### R21b — P1: Remove the leftover "end-to-end" wording (R12 residue)
**Context (verified):** `src/frontend/src/pages/TherapyDocumentationAi.jsx:59` H2 reads "How PR-TOP handles therapy documentation end-to-end". R12 banned the term sitewide because it collides with the retired "end-to-end encryption" claim; this heading survived the sweep.
**Description:** Reword the heading (and any sibling strings on that page using the idiom) so no reader can misread an encryption promise — e.g. "How PR-TOP handles therapy documentation, from session to record". Apply to every locale variant the page has; keep the H2's keyword value (therapy documentation) intact; do not touch the page's meta/SEO keys otherwise.
**Acceptance steps:**
1. Grep `src/frontend/src` (jsx + i18n): zero case-insensitive matches for `end-to-end`/`end to end` (the R12-cleared i18n keys must stay clean too).
2. Build; puppeteer on the page route: new H2 renders, page still passes `node _t_geo_audit.js` (direct-answer block, FAQ JSON-LD intact).
3. Audit suite green.

### R21c — P1: Real WebP for the hero screenshot (R18 residue)
**Context (verified):** `src/frontend/public/images/hero-dashboard.webp` has PNG magic bytes — it is a renamed PNG (216 958 bytes), and an identical `hero-dashboard.png` twin is also committed. Browsers render it by content sniffing, but the file misses WebP compression and the twin bloats the repo/dist.
**Description:** Produce a genuine WebP from the PNG source (`cwebp`/sharp, quality ~85): target ≤ 120 KB at 2560×1600, or downscale to 1920×1200 if needed to hit the budget without visible quality loss on a 2x display. Keep exactly one file (`hero-dashboard.webp`), remove the PNG twin from `public/`, keep the `<img>` markup (`width`/`height`/`aspectRatio`/`loading="eager"`) unchanged apart from the src if the name changes.
**Acceptance steps:**
1. Magic bytes of the shipped file are `RIFF....WEBP` (verify with a byte check, not the extension); size ≤ 120 KB; `hero-dashboard.png` no longer exists under `public/` or `dist/images/`.
2. Puppeteer on preview `/`: hero image loads (`naturalWidth > 0`), no layout shift (H1 bounding box stable across load).
3. Visual spot-check at 2x zoom: text in the screenshot (sidebar labels, client names) stays legible; if not, raise quality/resolution and re-check the budget.
4. Audit suite green; screenshots re-captured and committed.

### R21d — P2: Screenshot freshness as definition-of-done
**Context:** the re-capture step was skipped after R17/R18/R20 (twice overall); the owner re-captured manually on 2026-07-14 12:42.
**Description:** Make freshness structural, not tribal: (a) add a repo-root note to `_t_screenshots.js` usage in `docs/seo/CONTENT_RULES.md` pre-merge checklist ("landing copy or hero visuals changed → re-run `node _t_screenshots.js`, commit the 4 PNGs"); (b) extend `_t_r9_qa.js` with a freshness assertion: fail if any `docs/seo/reports/repositioning-screens/*.png` is older (mtime) than the newest file under `src/frontend/src/i18n/` or `src/frontend/src/pages/Landing.jsx` — with a `--skip-screenshot-freshness` escape hatch for CI environments without the artifacts.
**Acceptance steps:**
1. CONTENT_RULES.md checklist gains the re-capture line.
2. `node _t_r9_qa.js` fails when a landing i18n file is touched after the PNGs (demonstrate in the PR by touching a file, running, reverting), and passes after `node _t_screenshots.js`.
3. Full audit suite green at the end.

> **Owner decision pending (not for agents):** the in-app stat card label "SOS ALERTS" is visible in the hero screenshot and clashes with the agreed-protocol language. Renaming an in-product label (e.g. "Protocol alerts") is a product decision — flag in the PR, do not rename unilaterally.

---

## R22 — Support-assistant KB truth sync (owner audit 2026-07-14)

**Context (verified):** the support chatbot answers from `docs/assistant-kb/` — md files are auto-reindexed into `assistant_knowledge` (embeddings) on every backend startup (`src/backend/src/index.js:443`) and `faq-seed.json` re-seeds cached answers with answer-text refresh, so *indexing* is automatic on deploy. The *content*, however, is only partially synced with the repositioning: the deterministic layer was regenerated during Wave 2 (2026-07-14 12:22) and `security-overview.md` is exemplary (it honestly explains why PR-TOP is NOT E2EE/zero-knowledge), but **the generator itself hardcodes a false claim** — `scripts/generate-assistant-docs.mjs:391` writes "All plans include end-to-end encryption of the …" into `reference/pricing.md` (line 8), directly contradicting the site and `security-overview.md` inside the same KB. 19 of 26 prose files are dated 2026-07-07 (pre-repositioning); `client-bot-experience.md:26` and `crisis-sos-workflow.md:26,70` still frame crisis handling as an "SOS button", and 4 files + `faq-seed.json:79` use "end-to-end" as a process idiom (banned collision). Deterministic regeneration (`npm run docs:assistant`) is not wired into any build/release step — it relies on discipline.

### R22a — P0: Fix the false E2EE claim in the docs generator
**Description:** In `scripts/generate-assistant-docs.mjs` replace the hardcoded "All plans include end-to-end encryption…" pricing lead with the R12-truthful wording ("All plans include application-level encryption (AES-256) of clinical content; see the security overview for the exact access model."). Regenerate the deterministic layer (`npm run docs:assistant`) and commit the refreshed `reference/*.md`. Sweep the whole KB for encryption-sense E2EE claims.
**Acceptance steps:**
1. Grep `scripts/generate-assistant-docs.mjs` + `docs/assistant-kb/reference/`: zero matches for `end-to-end encrypt` (case-insensitive).
2. `docs/assistant-kb/reference/pricing.md` regenerated in the same commit; `node _t_assistant_kb_audit.js` passes.
3. Cross-consistency check: `security-overview.md`'s "No, not E2EE" answer and `pricing.md` no longer contradict each other (manual read, noted in PR).

### R22b — P1: Reposition the stale prose how-tos (19 files of 2026-07-07)
**Description:** Editorial pass over every prose file older than the repositioning, under the §4 copywriting mandate + truth-before-copy: crisis pages (`crisis-sos.md`, `crisis-sos-workflow.md`, `client-bot-experience.md`) adopt the agreed-protocol framing — the `/sos` command and pinned button remain factually described as the *mechanism*, but the narrative is "a pre-agreed response protocol, not an emergency service" (mirror the landing's R4/R17 language, including "PR-TOP is not a crisis line and does not contact emergency services"); replace "end-to-end" process idioms in `client-management.md` (H1!), `bulk-session-upload.md`, `client-bot-experience.md`, `faq-seed.json` (e.g. "from start to finish"); align terminology with the site (practice workspace, client channel, drafts-for-review model from R14). Facts (commands, flows, limits) must be re-verified against the code, not assumed.
**Acceptance steps:**
1. Grep `docs/assistant-kb/`: zero case-insensitive `end-to-end` matches; `SOS button` appears only inside factual UI references, with the protocol framing present in the same section (crisis files contain "not a crisis line"/"not an emergency service" wording in every locale-relevant file).
2. `node _t_assistant_kb_audit.js` passes; `faq-seed.json` seeds re-applied (answer-text refresh confirmed via the seed upsert path).
3. Spot-check three regenerated answers through the assistant retrieval path (dev run): pricing/security/crisis questions return the new wording.

### R22c — P2: Wire deterministic docs regeneration into the release gate
**Description:** `npm run docs:assistant --check` (dry-run drift detector) must run as part of the standard audit chain so a release cannot ship with `reference/*.md` out of sync with routes/i18n/tiers: add it to `_t_assistant_kb_audit.js` (fail on drift) or as a separate `docs:assistant:check` invocation in the documented pre-release checklist in `docs/seo/CONTENT_RULES.md`, mirroring the R21d screenshot-freshness pattern.
**Acceptance steps:**
1. Demonstrate in the PR: change a tier bullet key in `en.json`, run the audit — it fails on drift; run `npm run docs:assistant`, audit passes; revert the demo change.
2. Checklist updated; full audit suite green.

---

## R23 — P1: Plan-gating claims in the assistant KB must be backed by code (anti-myth gate)

**Context (verified 2026-07-14):** agents twice wrote plausible-sounding tier restrictions into `docs/assistant-kb/` that the code does not contain — "SOS delivery is Premium" (4 files), "supervision share requires Premium / a locked overlay / a supervisor account" (3 files), "Premium client handoff" (a feature that does not exist at all). All were corrected by the owner in commits fb7858a and 95e0d24 after code verification. The truth-before-copy mandate catches topics a feature explicitly names, but not background facts — this needs an automated gate.

**Description:** Add a tier-claim verification section to `_t_assistant_kb_audit.js`:
1. **Claim detector.** Scan every file under `docs/assistant-kb/` (md + `faq-seed.json`) for plan-gating language: case-insensitive matches of `(Premium|Pro|Basic|Trial)` within the same sentence as gating words (`only|requires|available on|gated|locked|upgrade|not available on|plan allows`). Tier names in *pricing enumerations* (reference/pricing.md tier tables) are exempt via an explicit path allowlist.
2. **Gate registry.** Create `docs/assistant-kb/plan-gates.json` — the machine-readable list of REAL gates, each entry: `{ "id", "claim" (short human phrase), "code_ref" (repo-relative file), "anchor" (a regex that must match inside that file, e.g. the actual gating condition) }`. Seed it with the gates verified today: voice queries Pro/Premium (`src/backend/src/routes/bot.js`, anchor `['pro', 'premium'].includes(plan)`), NL-query upgrade path (`src/frontend/src/pages/ClientDetail.jsx`, anchor `required_plans`), per-plan client seat limit (`src/backend/src/routes/clients.js`, anchor `plan !== 'premium' && limit > 0`), session quotas and analytics-export gating (find and anchor the real checks the same way — verify in code first; if a gate cannot be found, it does not go into the registry).
3. **Audit rule.** Every detected claim must reference a registry id via an inline HTML comment next to the claim (`<!-- gate: voice-queries-pro -->`) or the audit fails with the offending file/line. For every registry entry, the audit greps `code_ref` for `anchor` — if the anchor no longer matches (gate removed/renamed), the audit fails, forcing the KB and registry to be updated together with the code.
4. **Backfill.** Annotate the legitimate tier statements currently in the KB (subscription-management.md quota/seat text, natural-language-queries.md, reference/pricing.md is path-exempt) with their gate ids; there must be zero unannotated claims at merge time.

**Acceptance steps:**
1. `docs/assistant-kb/plan-gates.json` exists; every entry's `code_ref` file exists and `anchor` matches (audit proves it).
2. Negative test demonstrated in the PR: add a fake claim "Diary is Premium-only" to a KB file, run `node _t_assistant_kb_audit.js` — it fails naming the file and line; revert.
3. Positive test: annotate a real claim with its gate id — audit passes.
4. Full audit suite green (`_t_assistant_kb_audit.js`, `_t_r9_qa.js`, `_t_geo_audit.js`, `_t_seo_i18n_audit.js`, `_t_link_graph_w6.js`); `npm run docs:assistant:check` reports no drift.
5. The §4 copywriting mandate and truth-before-copy note in this doc gain one line: "tier restrictions may only be stated with a `gate:` annotation backed by plan-gates.json".
