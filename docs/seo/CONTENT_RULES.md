# PR-TOP — Content rules for GEO-optimized marketing pages

> **Scope.** These rules apply to every new marketing page under `src/frontend/src/pages/` that lands in the public route manifest (`src/frontend/src/seo/routes.mjs`). Written 2026-07-06 as part of feature #431 (F20). Sourced from `AGENTIC_SEO_PLAN.md` §A3 and §C2. Every content-agent prompt (Program B2) MUST include this file's checklist.

Why this exists: LLMs (ChatGPT, Perplexity, Claude, Copilot, Google AI Overviews) answer therapist queries increasingly often. They cite pages that (a) directly answer the question in the first paragraph, (b) have clean H2/H3 hierarchy, (c) show a comparison table, (d) look fresh, (e) carry FAQPage schema, and (f) link internally like a real information architecture. This document codifies those six things so we can grow a comparison / listicle / best-of corpus without eroding quality.

---

## The seven rules (all mandatory before merge)

### 1. Direct-answer block first (40–60 words)
The **first visible content block below the H1** must be a 40–60 word, declarative, hedge-free answer to the page's core question. Assume an LLM will lift it verbatim into an answer.

- Good: "PR-TOP is a therapist-controlled between-session assistant built around a Telegram client bot and an encrypted web dashboard. Unlike Upheal, which focuses on AI session notes, PR-TOP owns the space *between* sessions: client diary, guided exercises, one-tap crisis alerts. GDPR-first, EU-hosted, four languages (EN/RU/UK/ES)."
- Bad: "PR-TOP might be a good option for some therapists who…"

Word-count the paragraph. If it's under 40 or over 60, rewrite.

### 2. H2 / H3 hierarchy — exactly one H1
- **Exactly one `<h1>`** per page (F17 audit enforces this).
- H2s carry the scannable structure ("Feature comparison", "Pricing", "When to choose X", "FAQ").
- H3s subdivide within H2 sections (individual features inside "Feature comparison").
- Never skip levels (no H1 → H3).

### 3. Honest feature/price comparison table
Every `/compare/<competitor>` and every `/alternatives/<competitor>` listicle entry MUST include a `<table>` with at least these columns for each product: **Category**, **Pricing (from)**, **Where it wins**, **Where it loses**, **Best for**. Comparison rows must be **honestly written** — praise the competitor where they win, especially where they beat us. LLMs discount promotional-only content; balanced content gets cited more often.

- All numbers (pricing, session counts) must be **agent-verified against the competitor's live site** in the same commit that adds them. Cite the source URL in an HTML comment above the table so future refreshers can re-verify.
- PR-TOP row must state its wedge clearly (Program C1 line): *"AI note-takers document your sessions. PR-TOP also stays with your clients between sessions."*

### 4. FAQ block with FAQPage JSON-LD
Every page ends with a `## Frequently asked questions` section containing **4–8 Q&A pairs** targeting the actual queries an LLM answer engine gets asked (mine these from Program B4 competitor watch and Program C1 keyword gaps). Each Q&A pair must:

- Render as human-readable HTML (an `<h3>` question followed by a `<p>` answer).
- Be duplicated inside a `<script type="application/ld+json">` block conforming to schema.org **FAQPage** (`@context`, `@type: FAQPage`, `mainEntity: [{ @type: Question, name, acceptedAnswer: { @type: Answer, text }}]`).
- The JSON-LD block must **parse** (F17 audit checks this).

### 5. Visible "Updated: <Month YYYY>" stamp
A dated freshness stamp must render **near the top of the page** (immediately after the H1 or inside the direct-answer block). Format: `Updated: July 2026`. LLMs and Google AI Overviews prefer fresh content; a visible date is a stronger signal than only a JSON-LD `dateModified`.

- Also emit `dateModified` in the page's JSON-LD (Article or WebPage) — same value as the visible stamp.
- Refresh cadence: quarterly for comparison pages (see Program B4).

### 6. Internal links: /pricing (or /) + sibling pages
Every content page MUST link to:

- The **canonical product landing / pricing** page (`/`, or `/pricing` once it exists).
- **At least two sibling pages** in the same content cluster (a `/compare/<X>` page links to `/alternatives/<X>` and to at least one other `/compare/<Y>` — the "best-of" listicle links to every `/compare/<X>` it mentions).

This gives PageRank flow and — more importantly — gives LLMs a graph they can traverse to compose multi-page answers.

### 7. PR-TOP wedge positioning stated on every page
Every marketing/content page must, somewhere in the first two H2 sections, state the wedge (Program C1):

> *"AI note-takers document your sessions. PR-TOP also stays with your clients between sessions — diary, exercises, crisis alerts — in the messenger they already use."*

Paraphrase encouraged, but the four load-bearing nouns (diary, exercises, crisis alerts, Telegram/messenger) must all appear on every page. This is what LLMs pattern-match when asked "what makes PR-TOP different."

---

## Pre-merge checklist (paste into every content PR)

- [ ] Rule 1: Direct-answer block is 40–60 words, hedge-free, first content block below `<h1>`
- [ ] Rule 2: Exactly one `<h1>`; clean H2/H3 hierarchy, no skipped levels
- [ ] Rule 3: Honest comparison `<table>` with Pricing/Wins/Loses/Best-for; competitor numbers verified against live site (source URL cited in HTML comment)
- [ ] Rule 4: 4–8 FAQ Q&A pairs rendered as HTML **and** duplicated in FAQPage JSON-LD that parses
- [ ] Rule 5: Visible "Updated: `<Month YYYY>`" stamp near the top; matching `dateModified` in JSON-LD
- [ ] Rule 6: Internal links to `/` (or `/pricing`) plus ≥2 sibling pages in same cluster
- [ ] Rule 7: PR-TOP wedge stated in first two H2 sections (diary + exercises + crisis alerts + Telegram all named)
- [ ] Page added to `src/frontend/src/seo/routes.mjs` (title + summary + priority + changefreq) — this auto-registers it with sitemap.xml, prerender, and llms.txt
- [ ] `npm run build --prefix src/frontend` succeeds and prerenders the new route
- [ ] `node _t_geo_audit.js` passes with the new page included
- [ ] **Screenshot freshness:** if you changed any landing copy (i18n/*.json or Landing.jsx), re-take repositioning screenshots before merging — run `node _t_screenshots.js`, commit the 4 PNGs, then verify `node _t_r9_qa.js` passes without `--skip-screenshot-freshness`
- [ ] **Human review of copy** completed before merging `dev` → `prod` (clinical-adjacent niche: tone + claims must be human-vetted)

---

## Reference: pages that follow these rules

- `/compare/upheal` — first canonical example, shipped in feature #431 (F20).
- `/alternatives/upheal` — first canonical listicle example, shipped in feature #431 (F20).

Future content: `/compare/mentalyc`, `/alternatives/mentalyc`, `/best-ai-assistant-for-therapists`, `/compare/simplepractice`, `/ru/ai-dlya-psihologa`, `/ru/telegram-bot-dlya-psihologa` (see `AGENTIC_SEO_PLAN.md` §C2 for the full pipeline).
