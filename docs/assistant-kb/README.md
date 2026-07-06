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

## Definition of done for ANY new or changed feature

1. Does the feature change what a therapist or client sees or can do?
   → update the matching how-to page (or add a new one, 800+ words:
   intro → prerequisites → step-by-step → edge cases → troubleshooting
   → FAQ). Every factual claim (limits, plan gating, button labels)
   must be verified against code/i18n — no invented behavior.
2. Run `npm run docs:assistant` so the generated reference picks up new
   routes / labels / pricing.
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
