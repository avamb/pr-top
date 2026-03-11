# PsyLink — AutoForge Kickoff Prompt

Use this as the initial kickoff instruction for AutoForge.

---

You are starting implementation planning for **PsyLink**, a therapist assistant platform built on top of the existing **MindSetHappyBot / 3hours** codebase.

Your job is **not** to invent a different product. Your job is to plan and execute the first implementation wave according to the attached PRD and task seed.

## Source documents to treat as canonical
1. `PsyLink_PRD_v2_AutoForge_ru.md`
2. `PsyLink_AutoForge_Task_Seed_ru.md`
3. `PsyLink_AutoForge_Brief_ru.md`

If those documents conflict with older drafts, prefer the newer AutoForge-specific documents.

---

## Product identity (must preserve)
PsyLink is:
- a therapist-controlled between-session assistant platform,
- a structured workflow for therapist-client interaction between sessions,
- a product centered on diary, session summaries, therapist notes, exercises, and client timeline.

PsyLink is **not**:
- an autonomous AI therapist,
- a self-help bot replacing therapy,
- a full clinic/EHR/billing suite in V1,
- a keyword-only crisis detection engine.

---

## Non-negotiable implementation rules
1. **Therapist remains the decision-maker.**
2. **All sensitive client data must be encrypted in transit and at rest.**
3. **Client diary in therapy context must be therapist-supervised.**
4. **Consent must be explicit and revocable.**
5. **Do not overclaim or overbuild automated crisis inference.**
6. **Use current vector DB capabilities where useful.**
7. **Prepare for future graph analysis, but do not force graph complexity into V1.**
8. **Prefer shipping a secure useful therapist workflow over building flashy speculative AI features.**

---

## Current architectural intent
The system should support:
- encrypted canonical storage of sensitive content,
- derived/searchable representations where necessary,
- vector-search-based retrieval for summaries and timeline support,
- future graph extraction/event modeling later.

V1 should be architecturally compatible with future graph analysis, but should **not** depend on a graph database or graph pipeline to ship.

---

## V1 priorities
Your first implementation wave must prioritize, in this order:
1. encryption and consent foundation,
2. therapist-client linking,
3. secure diary storage,
4. therapist workspace,
5. session upload → transcript → summary,
6. unified client timeline,
7. exercise sending,
8. conservative safety support.

If a feature is not necessary for this list, deprioritize it.

---

## Most important user value to optimize for
The product should make a therapist say:
- “I lose less context.”
- “I do less double work.”
- “I can prepare better for the next session.”
- “This respects the boundaries of my profession.”

Do **not** optimize for investor-style feature inflation.

---

## Implementation behavior expected from AutoForge
When planning work:
- decompose into architecture, DB, service, handler, security, testing, and release-readiness tasks;
- preserve dependencies explicitly;
- add acceptance criteria to each task;
- flag security-sensitive tasks clearly;
- avoid large speculative jumps when smaller validated milestones exist.

When coding:
- reuse the existing codebase where practical;
- do not rebuild foundations that already exist;
- keep changes modular;
- preserve backward compatibility where possible.

---

## Explicit anti-goals
Do not drift into any of the following during the first implementation wave:
- building a generic AI therapy chatbot;
- building a complete billing/CRM/EHR suite;
- building graph analytics before basic secure workflow exists;
- treating keyword alerts as clinically robust;
- storing sensitive content in plaintext for convenience.

---

## First planning output requested
Your first response should produce:
1. a proposed execution plan for the first implementation wave,
2. grouped tasks with dependencies,
3. identified architectural risks,
4. identified security risks,
5. recommended first coding milestone.

Then proceed according to the task seed, starting from the security and role/consent foundation.
