# PsyLink — AutoForge Task Seed

**Purpose:** initial machine-friendly task backlog for AutoForge  
**Based on:** `PsyLink_PRD_v2_AutoForge_ru.md`  
**Version:** v1

---

## Global implementation constraints

Before all tasks:
- do not build PsyLink as an autonomous AI therapist;
- do not assume keyword-only crisis inference is clinically reliable;
- keep therapist as decision-maker;
- all sensitive client materials must be encrypted in transit and at rest;
- architect for current vector search support and future graph analysis support, but keep graph analysis out of V1 core delivery;
- avoid full EHR/billing scope creep in V1.

---

## Architecture-wide design tasks

### AF-ARCH-001 — Define sensitive data model and encryption boundaries
**Objective:** classify data into encrypted payloads vs safe metadata.

**Deliverables:**
- data classification document
- field-level encryption policy
- DB field mapping proposal
- key versioning approach

**Acceptance criteria:**
- every sensitive text-bearing field identified
- clear rule for what may remain plaintext metadata
- compatible with export/delete flows

**Dependencies:** none

---

### AF-ARCH-002 — Design encryption service abstraction
**Objective:** create application-layer encryption/decryption interface for all sensitive payloads.

**Deliverables:**
- encryption service interface
- payload versioning scheme
- key ID strategy
- failure handling policy

**Acceptance criteria:**
- service can be reused by diary/messages/notes/sessions/context modules
- no plaintext-only fallback path in design

**Dependencies:** AF-ARCH-001

---

### AF-ARCH-003 — Define searchable storage strategy for encrypted content
**Objective:** support current vector DB and future graph analysis without requiring plaintext canonical storage.

**Deliverables:**
- split-storage architecture:
  - encrypted canonical payload
  - minimized searchable derivative
  - embedding generation path
- access policy for embeddings and derivatives

**Acceptance criteria:**
- canonical content remains encrypted at rest
- vector search path is compatible with encrypted source-of-truth model
- graph layer can later consume controlled derived entities/relationships

**Dependencies:** AF-ARCH-001, AF-ARCH-002

---

### AF-ARCH-004 — Design future graph-analysis extension point
**Objective:** prepare architecture for later graph-based relationship analysis without coupling V1 to graph implementation.

**Deliverables:**
- event/entity schema proposal
- graph-ready extraction interface from sessions/diary/context
- “not in V1” boundary notes

**Acceptance criteria:**
- V1 modules can emit structured events/entities later
- no mandatory graph DB dependency in V1 release

**Dependencies:** AF-ARCH-003

---

## Core product tasks — Wave 1

### AF-CORE-001 — Add therapist/client role fields to user model
**Objective:** extend user schema for PsyLink roles.

**Deliverables:**
- migration for role / therapist_id / consent_therapist_access / invite_code
- model updates

**Acceptance criteria:**
- roles supported cleanly
- invite code unique
- therapist-client relation supported

**Dependencies:** none

---

### AF-CORE-002 — Implement onboarding role selection
**Objective:** let new user choose therapist or client role.

**Acceptance criteria:**
- `/start` offers role choice
- role persists in DB
- repeated starts handle existing role gracefully

**Dependencies:** AF-CORE-001

---

### AF-CORE-003 — Implement therapist invite flow
**Objective:** therapist can generate/share invite mechanism.

**Acceptance criteria:**
- therapist can retrieve invite code
- code can be refreshed/regenerated safely
- access limited to therapist role

**Dependencies:** AF-CORE-001, AF-CORE-002

---

### AF-CORE-004 — Implement client connect + consent flow
**Objective:** client links to therapist only with explicit consent.

**Acceptance criteria:**
- client enters invite code
- therapist identified
- explicit consent required
- revoke flow supported

**Dependencies:** AF-CORE-003

---

### AF-CORE-005 — Implement role middleware / access isolation
**Objective:** ensure therapist-only commands and cross-therapist isolation.

**Acceptance criteria:**
- therapist-only commands blocked for clients
- therapist cannot view other therapist’s clients
- revocation immediately affects authorization

**Dependencies:** AF-CORE-004

---

## Secure diary and messaging tasks — Wave 1

### AF-DATA-001 — Refactor diary entry storage to encrypted payload model
**Objective:** store diary content encrypted at application layer.

**Acceptance criteria:**
- no plaintext-only diary content persisted
- retrieval works for authorized reads
- export/delete still valid

**Dependencies:** AF-ARCH-002, AF-CORE-004

---

### AF-DATA-002 — Refactor conversation/message storage to encrypted payload model
**Objective:** protect all client-therapist relevant message content.

**Acceptance criteria:**
- message bodies encrypted at rest
- authorized processing path works
- migration strategy defined for existing data

**Dependencies:** AF-ARCH-002

---

### AF-DATA-003 — Implement audit logging for sensitive reads
**Objective:** log who accessed sensitive client content and when.

**Acceptance criteria:**
- diary/session/context reads auditable
- consent changes auditable
- access denials auditable

**Dependencies:** AF-CORE-005, AF-DATA-001

---

## Therapist workspace tasks — Wave 2

### AF-THER-001 — Implement `/clients`
**Objective:** therapist sees linked clients and last activity.

**Acceptance criteria:**
- only linked clients shown
- last activity visible
- performant on realistic small-practice dataset

**Dependencies:** AF-CORE-005

---

### AF-THER-002 — Implement `/view <client>` secure diary view
**Objective:** therapist reviews linked client entries.

**Acceptance criteria:**
- linked therapist sees client diary
- unauthorized therapist denied
- data decrypted only on authorized path

**Dependencies:** AF-DATA-001, AF-THER-001

---

### AF-THER-003 — Implement encrypted therapist notes
**Objective:** therapist can create private notes per client.

**Acceptance criteria:**
- notes encrypted at rest
- notes linked to therapist and client
- notes visible only to author therapist or explicitly scoped future supervisor role

**Dependencies:** AF-ARCH-002, AF-THER-001

---

### AF-THER-004 — Implement `/summary <client>`
**Objective:** generate therapist-facing recent summary from diary + relevant history.

**Acceptance criteria:**
- summary uses authorized content only
- prompt avoids diagnosis claims
- summary useful for session prep

**Dependencies:** AF-DATA-001, AF-ARCH-003, AF-THER-001

---

## Session intelligence tasks — Wave 2

### AF-SESS-001 — Design secure audio storage flow
**Objective:** define how session audio is uploaded, referenced, protected.

**Acceptance criteria:**
- no public static exposure
- encrypted storage or encrypted volume path defined
- lifecycle/retention documented

**Dependencies:** AF-ARCH-001

---

### AF-SESS-002 — Implement session model and storage
**Objective:** add session records tied to therapist and client.

**Acceptance criteria:**
- session status supported
- session timestamps stored
- transcript/summary fields prepared as encrypted payloads

**Dependencies:** AF-SESS-001, AF-ARCH-002

---

### AF-SESS-003 — Implement transcription pipeline
**Objective:** therapist uploads session audio and receives transcript.

**Acceptance criteria:**
- transcript generated successfully
- transcript stored encrypted
- failures handled explicitly

**Dependencies:** AF-SESS-002

---

### AF-SESS-004 — Implement session summary pipeline
**Objective:** generate therapist-facing summary from transcript.

**Acceptance criteria:**
- summary stored encrypted
- clinically cautious tone
- useful session-prep output

**Dependencies:** AF-SESS-003

---

## Timeline + search tasks — Wave 2

### AF-TIME-001 — Implement unified client timeline aggregator
**Objective:** merge diary entries, therapist notes, session outputs chronologically.

**Acceptance criteria:**
- timeline can display mixed event types
- date filtering works
- event source type visible

**Dependencies:** AF-DATA-001, AF-THER-003, AF-SESS-004

---

### AF-TIME-002 — Integrate vector-search support for client history
**Objective:** use vector DB to improve retrieval for summaries and search.

**Acceptance criteria:**
- embeddings generated from approved derivative representation
- vector search improves history recall
- encrypted canonical store remains source of truth

**Dependencies:** AF-ARCH-003, AF-DATA-001, AF-SESS-004

---

## Exercise library tasks — Wave 3

### AF-EX-001 — Implement exercise library schema
**Objective:** store structured exercises by category/language.

**Acceptance criteria:**
- exercise records created/readable
- categories supported
- multilingual field strategy defined

**Dependencies:** none

---

### AF-EX-002 — Implement therapist exercise send flow
**Objective:** therapist sends exercise to client quickly.

**Acceptance criteria:**
- therapist can choose and send exercise
- client receives it in bot
- delivery event recorded

**Dependencies:** AF-EX-001, AF-THER-001

---

## Safety tasks — Wave 3

### AF-SAFE-001 — Implement SOS flow
**Objective:** client can trigger urgent notification to linked therapist.

**Acceptance criteria:**
- SOS button available where appropriate
- linked therapist notified
- event logged securely

**Dependencies:** AF-CORE-004

---

### AF-SAFE-002 — Implement conservative alert preferences
**Objective:** therapist configures basic inactivity/urgent preferences.

**Acceptance criteria:**
- inactivity threshold configurable
- no overclaiming automated crisis inference
- logs and acknowledgements supported

**Dependencies:** AF-SAFE-001

---

## Context + future intelligence tasks — Wave 3+

### AF-CTX-001 — Implement encrypted client context store
**Objective:** therapist stores anamnesis, goals, contraindications, AI instructions.

**Acceptance criteria:**
- context encrypted at rest
- editable by linked therapist
- available to summary pipeline

**Dependencies:** AF-ARCH-002, AF-THER-001

---

### AF-GRAPH-001 — Define graph extraction event model
**Objective:** prepare future graph analysis layer from sessions, diary, exercises, outcomes.

**Acceptance criteria:**
- graph node/edge candidates documented
- extraction rules drafted
- no required graph DB for V1 release

**Dependencies:** AF-ARCH-004, AF-CTX-001, AF-TIME-001

---

## Release-readiness tasks

### AF-REL-001 — Security validation pass
**Objective:** confirm sensitive content encryption coverage.

**Acceptance criteria:**
- no sensitive plaintext-only payloads left
- storage/transport review complete
- key handling documented

### AF-REL-002 — Consent and deletion validation
**Objective:** verify privacy-critical flows.

**Acceptance criteria:**
- consent grant/revoke works
- export/delete includes encrypted records correctly
- access isolation proven

### AF-REL-003 — Pilot readiness package
**Objective:** prepare first therapist pilot.

**Acceptance criteria:**
- onboarding docs ready
- therapist expectations/disclaimers ready
- support and escalation process documented

---

## Recommended execution order
1. AF-ARCH-001
2. AF-ARCH-002
3. AF-ARCH-003
4. AF-CORE-001..005
5. AF-DATA-001..003
6. AF-THER-001..004
7. AF-SESS-001..004
8. AF-TIME-001..002
9. AF-EX-001..002
10. AF-SAFE-001..002
11. AF-CTX-001
12. AF-GRAPH-001
13. AF-REL-001..003

---

## Success condition for first implementation wave
AutoForge should produce a system where:
- therapist and client can be linked safely;
- sensitive material is encrypted;
- therapist can review diary + notes + sessions in one place;
- session transcription + summary works;
- architecture is already compatible with vector DB and future graph analytics.
