<!-- audience: user -->
# Assistant knowledge base — update contract

This folder is the ONLY RAG source for the "Ask about PR-TOP" assistant
(public landing bot AND signed-in therapist bot). Raw source code is
deliberately NOT indexed (security decision, 2026-07-06). If it isn't
written here, the assistant honestly answers "I don't have information
about that" — so keeping this folder current is a product feature, not
paperwork.

## Two layers, two update mechanisms

| Layer | Files | How it updates |
|---|---|---|
| Generated reference | `reference/endpoints.md`, `reference/ui-labels.md`, `reference/pricing.md` | **Automatic**: `npm run docs:assistant` (in `src/backend`) regenerates them from routes / i18n / plan config. Run before every release. Never edit by hand. |
| Authored how-tos | every other `.md` here | **Manual/agent-authored**: updated by whoever ships the feature. The generator never overwrites them ("kept"). |

## Drift detection — `npm run docs:assistant:check`

A companion `--check` mode renders the three reference files into memory and
compares them to what is currently on disk. If any file would change, it
prints a line-level diff and exits with code 1.

```bash
# In src/backend:
npm run docs:assistant:check     # verify — exits 0 (in sync) or 1 (drift)
npm run docs:assistant           # fix — regenerate and write
```

This check is wired into `node _t_assistant_kb_audit.js` (section 12g) so it
runs automatically as part of the definition-of-done gate. It catches the
classic mistake: a developer changes an i18n label, an API route, or a plan
price, then forgets to regenerate the reference docs before merging.

## Definition of done for ANY new or changed feature

1. Does the feature change what a therapist or client sees or can do?
   → update the matching how-to page (or add a new one, 800+ words:
   intro → prerequisites → step-by-step → edge cases → troubleshooting
   → FAQ). Every factual claim (limits, plan gating, button labels)
   must be verified against code/i18n — no invented behavior.
2. Run `npm run docs:assistant` so the generated reference picks up new
   routes / labels / pricing. Then run `npm run docs:assistant:check` to
   confirm the on-disk files match the generated output (exit 0 = in sync).
3. Run `node _t_assistant_kb_audit.js` — it enforces ≥20 authored docs,
   ≥600 words each, valid audience markers, FAQ sections, and that no
   `src/`-sourced chunks leak into the index.
4. Reindex on deploy happens automatically (backend startup) or via
   admin → AI Models → reindex.

## Audience markers

- `<!-- audience: public -->` — retrievable by the anonymous landing
  bot AND signed-in users. Default for all product-level docs: the
  product has a free trial, so product behavior is not a secret, and
  pre-sales visitors ask "how does X work" questions.
- `<!-- audience: user -->` — signed-in bot only. Reserved for internal
  surfaces (API endpoint map, UI-label dump) and anything that would
  help an attacker more than a customer.

## Plan-tier gating rules — Feature #476 (R23)

**Truth-before-copy mandate**: a tariff restriction in `docs/assistant-kb/` is
permitted ONLY when it is backed by a real code-level gate registered in
`docs/assistant-kb/plan-gates.json`.

### Workflow for writing a plan-tier claim

1. **Check the registry first.** Read `plan-gates.json`. If the gate you
   need is already listed (e.g., `nl-queries-pro`, `data-export-pro`),
   proceed to step 3.
2. **Add a new gate entry** if the code check does not exist yet:
   - `id`: kebab-case identifier, e.g. `my-feature-pro`
   - `statement`: one human-readable sentence describing the restriction
   - `code_ref`: repo-relative path to the source file that enforces it
   - `anchor`: a regex that MUST match inside `code_ref` (the actual gate
     condition, e.g. `\\['pro',\\s*'premium'\\]\\.includes\\(plan\\)`)
   - The audit script will reject the entry if the anchor is not found.
3. **Annotate the claim** by placing `<!-- gate: <id> -->` on the line
   immediately before the restricting sentence in the `.md` file.
   `faq-seed.json` entries must not contain tier-restriction language at
   all — rewrite them to use plan-neutral phrasing.
4. **Run the audit** — `node _t_assistant_kb_audit.js` must exit 0.

### What counts as a "tariff-gating claim"

The audit flags any **sentence** in a how-to `.md` that contains BOTH:
- a plan tier name (`Premium`, `Pro`, `Basic`, `Trial` — capitalised), AND
- one of the registered gate words (see full list below)

Sentences are detected **across soft-wrapped lines**: the scanner collapses
single-newline breaks within a paragraph before splitting on `[.!?]`, so
a claim split over two lines is treated as one sentence.

Descriptive pricing sentences that merely list plan names without
restricting a specific feature (e.g., "The four tiers are Trial, Basic,
Pro, and Premium") do not trigger the rule.

#### Full gate-word list (R23c)

| Word / phrase | Example trigger | Exclusion |
|---|---|---|
| `only` | "Pro only", "available on Premium only", "Premium-only", "Pro-only" | `read-only` excluded via lookbehind _(updated R23c — see below)_ |
| `available on` | "available on Pro and Premium" | — |
| `locked` | "locked card", "locked for Trial users" | — |
| `unlock` | "upgrade to Pro to unlock", "Pro and Premium unlock" | — |
| `limited to` | "limited to Premium subscribers" | — |
| `gated` | "gated by plan", "gated on Basic" _(added R23b)_ | — |
| `blocked` | "blocked on Trial", "blocked for Basic" _(added R23b)_ | — |

**`only` lookbehind — R23c precision fix:**

The `only` gate word uses a negative lookbehind to avoid false-positives on the
compound adjective **`read-only`** (e.g. "a read-only view on Premium"), which is
not a plan-gating claim. The lookbehind is `(?<!read-)only`, meaning:

- `read-only` → lookbehind matches → **excluded** (correctly not flagged)
- `Premium-only` → lookbehind does NOT match → **caught** (correctly flagged)
- `Pro-only` → lookbehind does NOT match → **caught** (correctly flagged)
- `Basic-only` → lookbehind does NOT match → **caught** (correctly flagged)

> **R23b regression (now fixed):** The original lookbehind `(?<!-)only` excluded
> ALL hyphenated `...-only` forms, including `Premium-only`, `Pro-only`, and
> `Basic-only` — the exact compound forms most often used in myth claims. R23c
> narrows the exclusion to `read-only` only.

The words `upgrade`, `requires`, and `missing` are intentionally **not** in
the registry — they produce too many false positives in pricing/payment copy.

#### How to annotate a claim correctly

Place `<!-- gate: <id> -->` anywhere in the **same paragraph block** as the
claim, or in the **immediately preceding paragraph block** (separated by one
blank line, with no markdown heading between). The annotation may appear on
the same line or on its own line. Inline-within-the-sentence also works.

**Correct — annotation on own line before paragraph:**
```markdown
<!-- gate: nl-queries-pro -->
Natural-language queries are available on Pro and Premium only;
the other dashboard cards work the same on every plan.
```

**Correct — annotation inline in sentence (even mid-sentence):**
```markdown
Natural-language queries are available on Pro and Premium only <!-- gate: nl-queries-pro -->;
the other dashboard cards work the same on every plan.
```

**Correct — annotation covers a soft-wrapped claim (R23b):**
```markdown
<!-- gate: nl-queries-pro -->
If you downgrade from Pro or Premium to Basic
mid-cycle, the mood-trend strip stops responding.
```

**Wrong — heading between annotation and claim:**
```markdown
<!-- gate: nl-queries-pro -->

## Some Other Section

Natural-language queries are available on Pro and Premium only.
```
_(The heading breaks the section scope; the claim is ungated.)_

### Currently registered gates

See `plan-gates.json` for the authoritative list. At the time of writing:
- `voice-queries-pro` — voice queries require Pro/Premium (`bot.js`)
- `nl-queries-pro` — NL text queries require Pro/Premium (`query.js`)
- `client-kb-pro` — personal KB requires Pro/Premium (`kb.js`)
- `data-export-pro` — full CSV/notes export requires Pro/Premium (`export.js`)
- `analytics-export-premium` — analytics export requires Premium (`export.js`)
- `client-seats-limit` — client seat caps enforced by tier (`planLimits.js`)

## Canned FAQ seed (`faq-seed.json`) — Feature #440 (S7)

`faq-seed.json` is a companion to the how-to pages. It preloads the top
standard questions (pricing, free trial, is-it-GDPR, how-do-clients-join,
etc.) into `assistant_cached_answers` at backend startup and via the admin
endpoint `POST /api/admin/assistant/seed-faq`, so those questions never
have to hit the LLM.

- **Schema**: an array of `{ id, audience, locale, question, answer, tags[] }`.
  `audience` is `"public"` or `"user"`. `locale` is a language tag (currently
  English-only).
- **Idempotency**: the seeder upserts by a stable hash of
  `id|audience|locale|question`, so re-running the seeder never creates
  duplicates. Edit the JSON and restart (or POST `/api/admin/assistant/seed-faq`)
  to pick up changes.
- **Audience filter**: when a public bot request arrives, `findCachedAnswer`
  searches only `audience='public'` entries — `user`-scoped seeds cannot
  leak. Signed-in bot requests search both.
- **Locale rule**: a seed is served ONLY when its `locale` matches the
  language detected on the incoming question. If the detected language does
  not match any seed with the same question, the request falls through to
  the LLM. This keeps English seeds from being returned for Russian /
  Spanish / Ukrainian questions.
- **Admin curation**: seeded entries appear in `/admin/cached-answers`
  flagged `is_seed: true`. They can be edited (answer text) or deleted
  without a redeploy; a deleted seed will be re-created on the next
  startup unless the entry is also removed from `faq-seed.json`.
- **Secret redaction**: answers pass through `sanitizeOutput` at seed time
  so a hand-authored JSON entry cannot smuggle a credential-shaped string
  into the cache.
