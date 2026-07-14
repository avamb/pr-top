# PR-TOP — Positioning Addendum: Practice-First Messaging + Dual-Intent SEO

> **Prepared:** 2026-07-13. Supplements [SEO_PLAN.md](SEO_PLAN.md) and [AGENTIC_SEO_PLAN.md](AGENTIC_SEO_PLAN.md).
> Feature breakdown implementing this addendum: [AUTOFORGE_FEATURES_REPOSITIONING.md](AUTOFORGE_FEATURES_REPOSITIONING.md).
> Origin: external positioning review ("Hermes review", July 2026), accepted by the owner.

## 1. The problem with the current messaging

The site currently opens with the technology stack: *"AI Assistant… / Telegram bot / AI session notes"*. A practicing therapist does not come looking for AI or for a bot — they come with the question: *"Will this help me run my practice better, keep context between sessions, protect my personal boundaries, and not put clients at risk?"*

Leading with AI/bot provokes exactly the wrong questions in the professional audience: "Will the AI answer my clients instead of me?", "What if it says something harmful?", "Is this therapy or communication automation?". This is most damaging with the *strongest* therapists — the ones who protect quality of care and professional responsibility.

## 2. The new positioning (visible copy)

**Core statement:** PR-TOP is a *unified workspace for a therapist and their practice* — client context, session notes, assignments and safe communication in one protected place. Automation technologies structure the routine, **but do not replace the specialist and never act on their behalf**.

Three pillars for all visible marketing copy:

1. **Not "AI assistant" → "platform for a healthy private practice."** Hero headline: workspace/practice-first. AI appears only lower on the page, framed as *"Automation helps. Decisions stay with you."*
2. **Not "bot" → "a familiar client channel."** The word "bot" is removed from hero, H1s and H2s. Telegram is mentioned as the delivery medium ("PR-TOP can use Telegram as the channel your client already knows"), not as the product.
3. **Not "crisis alerts" as a feature bullet → an agreed response protocol.** Crisis/SOS functionality is presented in its own careful block: a protocol agreed in advance with the specialist, not a panic gadget.

## 3. Dual-intent SEO (the supplement to the SEO strategy)

We must capture **both** search intents, per the owner's decision (2026-07-13):

| Intent | Who searches | Where we target it |
|---|---|---|
| **AI-intent** — "AI assistant for therapists", "AI session notes", "AI для психолога" | Early adopters actively looking for AI tooling | `<title>`/meta description, solution pages (`/ai-session-notes-for-therapists`, `/therapist-ai-assistant`, …), compare/alternatives corpus, llms.txt. **Unchanged as query targets.** |
| **Routine-intent** — "practice management for therapists", "client diary", "как психологу вести заметки", "reduce admin routine therapist" | The broader majority who want less routine and a saner practice, without an AI framing | Home H1/hero, new landing sections, plus a new solution-page cluster targeting non-AI phrasing |

Operational rules:

- **H1 and hero copy ≠ meta title.** The visible H1 carries the practice-first message; the `<title>` may carry both intents (e.g. `PR-TOP — Practice Workspace for Therapists & Psychologists | Client Diary, Session Notes, AI Support Between Sessions`). This keeps the existing AI-query rankings while the page itself speaks to professionals correctly. SEO_PLAN §1.5 keyword targets remain valid *for meta*, and are superseded *for on-page H1/hero copy* by this addendum.
- Existing AI-targeting solution/compare pages are **kept and not renamed** — their traffic intent matches their copy.
- A new routine-intent page cluster is added over time (working titles): `practice-management-for-therapists` (non-AI phrasing), `reduce-admin-routine-for-therapists`, RU/UK/ES equivalents. These follow [CONTENT_RULES.md](CONTENT_RULES.md) fully.
- The wedge line (CONTENT_RULES rule 7) stays — it already leads with the practice, not the technology.

## 4. Copywriting mandate (mandatory for every implementing agent)

Every agent touching marketing copy works **as a professional writer and editor**, not as a translator or keyword-stuffer:

1. **Native quality in all four locales.** Each of en/ru/es/uk must read as if originally written by a professional native copywriter. No calques, no word-for-word translation, no machine-translation cadence. Idiom, rhythm and register are adapted per language.
2. **Tone:** calm, mature, respectful of clinical responsibility. No hype, no exclamation marks, no "revolutionary", no emoji in body copy. The reader is a professional protecting the quality of their work.
3. **Terminology discipline:** "bot" never in hero/H1/H2; Telegram at most once per section, always as a delivery channel; AI always framed as an assistant under the specialist's control.
4. **The safety sentence** must appear on the home page and read naturally in each locale: *"Automation technologies help structure the routine, but they do not replace the specialist and do not act on their behalf."*
5. **Craft checks before commit:** read every string aloud (or simulate it) — reject anything that sounds bureaucratic or salesy; keep terminology consistent within each locale (one term per concept across all keys); hero H1 ≤ 70 characters per locale where achievable, subheadline ≤ 160.
6. **Human review** of all copy before `dev` → `prod` merge (existing CONTENT_RULES checklist item) — this addendum raises it from a checklist line to a hard gate for repositioning work.
