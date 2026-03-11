# PsyLink — AutoForge System / Task Brief

Use this brief as the controlling context for AutoForge when planning and decomposing implementation tasks.

---

## Mission
Build the first practical version of PsyLink: a therapist-controlled between-session assistant platform built on top of the existing MindSetHappyBot / 3hours codebase.

The goal is not to create an autonomous AI therapist.
The goal is to create a secure therapist workflow product that helps preserve context, reduce double work, and support deeper work with clients between sessions.

---

## Product identity
PsyLink is:
- therapist assistant platform
- therapist-client bridge between sessions
- structured layer for diary, voice, summaries, notes, exercises, and timeline

PsyLink is not:
- self-help replacement for therapy
- AI therapist
- full practice-management suite in first version
- keyword-only crisis engine

---

## Non-negotiable rules
1. Therapist remains the decision-maker.
2. All sensitive client data must be encrypted in transit and at rest.
3. Client diary in therapy context must be therapist-supervised.
4. Consent must be explicit and revocable.
5. Context matters more than keywords.
6. Do not overpromise crisis detection.
7. Prefer clarity and safety over flashy AI behavior.

---

## Current technical reality
The base system already has useful foundations:
- Telegram bot
- text + voice flows
- AI responses
- reminder system
- vector DB / semantic search capabilities
- multilingual support
- production-ish deployment base

This means AutoForge should reuse and adapt existing architecture where practical, not rebuild everything from scratch.

---

## Architectural guidance
### Current requirement
Support vector-search-based retrieval for history and summaries.

### Future requirement
Architecture must be ready for graph-analysis later.

### Important implementation rule
Do not force graph DB or graph-analysis complexity into V1. Instead:
- define graph-ready event/entity outputs,
- preserve data shapes that can later feed graph extraction,
- keep V1 storage and workflows simple enough to ship.

---

## Primary V1 value
The first version must win on these concrete outcomes:
1. therapist-controlled client diary
2. secure storage of sensitive materials
3. session transcript + summary
4. therapist notes
5. client timeline
6. exercise sending

If tradeoffs happen, optimize for these before anything fancy.

---

## Highest-risk mistakes to avoid
1. Building a generic AI chatbot instead of therapist workflow product.
2. Overbuilding crisis-detection claims without contextual reliability.
3. Storing sensitive content in plaintext.
4. Building graph analytics too early.
5. Expanding into billing/EHR scope before therapist utility is proven.
6. Designing around investor story instead of therapist daily workflow.

---

## Security expectations
Treat the following as highly sensitive by default:
- diary entries
- messages
- transcripts
- summaries
- therapist notes
- anamnesis / context
- crisis-related payloads

Use application-layer encryption for sensitive text payloads.
Log access to sensitive materials.
Keep canonical content encrypted at rest.

---

## Therapist interview insights to respect
A practicing psychologist highlighted that:
- journaling is useful in many therapeutic schools, but dangerous for some traumatized clients if unsupervised;
- keyword-only analytics are unreliable without context;
- AI should deepen work, not pretend to replace a specialist;
- session recording/transcription/summarization is highly valuable;
- exercise libraries and quick delivery matter;
- future expressive inputs like drawing + voice may matter, but are not core V1.

AutoForge must keep these insights visible in planning decisions.

---

## Market strategy context
Use this as planning context, not necessarily implementation scope:
- RU/UA + diaspora = discovery and pilot learning
- Spain = likely best early commercial market
- LatAm = next expansion
- DACH / EN markets = later, after compliance/product maturity

This means V1 should prioritize:
- therapist trust
- multilingual readiness
- low-friction messenger workflow
- practical therapist value

---

## Planning preference
AutoForge should decompose work into:
- architecture tasks
- DB/migration tasks
- service tasks
- handler/UI tasks
- security tasks
- testing tasks
- rollout-readiness tasks

Each task should include:
- purpose
- dependencies
- acceptance criteria
- security considerations
- likely affected files/modules

---

## Final success test
The first implementation wave is successful if a therapist can say:
- I lose less context.
- I do less double work.
- I can prepare better for the next session.
- This tool respects the boundaries of my profession.

If the system feels like “just another AI bot”, it is failing the product brief.
