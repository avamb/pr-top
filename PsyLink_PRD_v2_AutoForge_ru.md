# PsyLink PRD v2 — AutoForge-ready

**Project:** PsyLink — Therapist Assistant Platform  
**Base repo:** github.com/avamb/3hours (MindSetHappyBot)  
**Document type:** implementation-oriented PRD for task decomposition by AutoForge  
**Version:** v2.1  
**Language:** RU  
**Status:** ready for first implementation wave

---

# 1. Product intent

## 1.1 One-line definition
PsyLink is a therapist-controlled platform for working with client material between sessions via Telegram, with AI support for summarization, organization, and contextual assistance.

## 1.2 Core positioning
PsyLink is:
- not an AI psychologist;
- not a self-help bot replacing therapy;
- not a generic journaling app;
- not a full EHR replacement in V1.

PsyLink is:
- a therapist assistant;
- a therapist-client bridge between sessions;
- a structured layer for diary, voice, session summaries, exercises, and client timeline.

## 1.3 Primary product promise
Help therapists:
- preserve more client context,
- reduce double documentation,
- work deeper between sessions,
- maintain therapist control over client journaling and sensitive flows.

---

# 2. Product principles (must not be violated)

1. **Therapist remains decision-maker.** AI never replaces clinical judgment.
2. **Client diary must be therapist-supervised** when used in therapy context.
3. **Context matters more than keywords.** No overclaiming keyword-only mental-state inference.
4. **Security is mandatory.** Sensitive data must be encrypted in transit and at rest.
5. **Consent is explicit and revocable.**
6. **V1 optimizes depth and structure, not “therapy acceleration”.**
7. **Messenger-native UX is a strength, but product identity is therapist workflow, not “just a Telegram bot”.**

---

# 3. Primary users

## 3.1 Therapist
Licensed psychologist / psychotherapist / counselor in private or small-group practice.

### Main goals
- keep better track of what happens between sessions;
- reduce post-session summarization effort;
- receive useful structure, not noisy automation;
- send exercises quickly;
- preserve timeline and context per client.

## 3.2 Client
Client of a therapist who interacts via Telegram.

### Main goals
- send text / voice / reflections in a familiar interface;
- complete exercises;
- maintain connection between sessions;
- optionally request urgent support.

---

# 4. Market assumptions used in this version

## 4.1 Market sequencing
- **Phase 1:** RU/UA + diaspora for discovery, pilot, design-partner learning
- **Phase 2:** Spain for early commercial validation
- **Phase 3:** LatAm / PT
- **Phase 4:** DACH / EN markets after stronger compliance hardening

## 4.2 Main competitive truth
Direct competitive pressure is strongest from:
- therapist AI note / transcript tools,
- not from generic B2C mental health bots.

Therefore V1 must include strong therapist workflow value, especially around:
- session transcript / summary,
- therapist workspace,
- structured client timeline.

---

# 5. Scope of Version 1

## 5.1 V1 outcome
A therapist can:
1. onboard as therapist,
2. invite/link a client with explicit consent,
3. view client diary entries,
4. add therapist notes,
5. upload session audio and receive transcript + summary,
6. see a unified client timeline,
7. send at least basic exercises,
8. rely on encrypted storage for all sensitive client data.

## 5.2 Explicitly out of V1 core
- graph knowledge engine,
- dual video capture,
- advanced cross-client analytics,
- autonomous crisis detection claims,
- replacement of external billing / EHR stack,
- full supervisor/admin enterprise workflows.

---

# 6. Technical constraints and security requirements

## 6.1 Data sensitivity classes

### Class A — highly sensitive
Must be encrypted at application layer before DB persistence:
- client diary content,
- conversation messages,
- voice transcripts,
- therapist notes,
- session summaries,
- anamnesis / client context,
- alarm excerpts,
- exercise responses from client.

### Class B — sensitive metadata
May remain plaintext if needed operationally, but must be access-controlled:
- timestamps,
- therapist/client linkage IDs,
- statuses,
- role types,
- language tags,
- counters,
- non-sensitive scheduling metadata.

## 6.2 Encryption requirements
- TLS for all transport
- application-layer encryption for Class A data
- master key not stored in DB
- key versioning and rotation support
- encrypted file storage for audio or attachments
- no public static links to sensitive files

## 6.3 Search / AI processing constraints
- canonical content remains encrypted at rest
- if embeddings/search are used, treat derivative artifacts as sensitive
- temporary plaintext processing must not persist unencrypted
- log access to sensitive records

---

# 7. Architecture modules

## Module M1 — Roles and consent
**Priority:** P0

### Goal
Support two core roles: therapist and client, with explicit linking and consent.

### Functional requirements
- user can choose role on start
- therapist can generate invite code / link
- client can connect to therapist
- client explicitly consents to therapist access
- client can revoke consent later

### Data model changes
`users`:
- role
- therapist_id
- consent_therapist_access
- invite_code

### Acceptance criteria
- therapist onboarding works from clean install
- client linking requires explicit confirmation
- revoked consent removes therapist access immediately

### Dependencies
- existing user model
- onboarding handlers
- role middleware

---

## Module M2 — Secure diary storage
**Priority:** P0

### Goal
Store client diary entries and conversation content securely, with therapist-readable access only when linked.

### Functional requirements
- incoming diary/message payload stored encrypted
- therapist can retrieve linked client entries
- unauthorized therapist access is blocked
- export/delete works correctly with encrypted data

### Data model changes
Existing `moments` / future `diary_entries`:
- content_encrypted
- encryption_key_id
- payload_version
- optional searchable_excerpt

Optional conversation store changes:
- message_payload_encrypted
- message_payload_version

### Acceptance criteria
- no plaintext-only storage of diary body in DB
- linked therapist can view decrypted content
- unlinked therapist cannot view content
- delete/export verified end-to-end

### Dependencies
- encryption service
- consent model
- DB migration

---

## Module M3 — Therapist workspace
**Priority:** P0

### Goal
Create therapist-facing commands and views for daily workflow.

### Functional requirements
- `/clients` list linked clients
- `/view <client>` show diary entries / latest materials
- `/note <client>` add private therapist note
- `/summary <client>` generate therapist-facing summary
- show last activity timestamps

### Data model changes
`therapist_notes`:
- note_encrypted
- therapist_id
- client_id
- session_date
- created_at

### Acceptance criteria
- therapist sees only own clients
- notes are encrypted at rest
- summaries are available and coherent

### Dependencies
- M1
- M2
- AI summary pipeline

---

## Module M4 — Session intelligence
**Priority:** P0

### Goal
Reduce double documentation after sessions.

### Functional requirements
- therapist uploads session audio
- system transcribes audio
- system generates summary
- transcript and summary attach to client history
- therapist can reopen old session records

### Data model changes
`sessions`:
- audio_ref
- transcript_encrypted
- summary_encrypted
- scheduled_at
- status
- created_at

### Acceptance criteria
- session audio upload path works
- transcript generated
- summary generated
- transcript + summary encrypted at rest
- session visible in client timeline

### Dependencies
- file storage
- transcription provider
- AI summarization pipeline
- secure storage layer

---

## Module M5 — Client timeline
**Priority:** P0

### Goal
Unify diary entries, therapist notes, and session outputs into one chronological view.

### Functional requirements
- display diary entries
- display session summaries
- display therapist notes markers
- filter by date
- filter by source type

### Acceptance criteria
- therapist can reconstruct recent client journey from one timeline
- timeline remains performant for at least 1 year of records per active client

### Dependencies
- M2
- M3
- M4

---

## Module M6 — Exercise library
**Priority:** P1

### Goal
Allow therapist to quickly send exercises / interventions to client.

### Functional requirements
- basic exercise library by category
- therapist can send exercise to client
- client can acknowledge / respond
- future-ready for shared therapist library

### Data model changes
`exercises`
`exercise_deliveries`

### Acceptance criteria
- therapist can send at least one stored exercise
- client receives it in bot
- delivery is recorded

### Dependencies
- therapist workspace
- client bot interface

---

## Module M7 — Safety support
**Priority:** P1

### Goal
Provide conservative, therapist-centered urgent support flows.

### Functional requirements
- client SOS button
- notify linked therapist
- configurable therapist escalation preferences
- inactivity alerts optional
- conservative crisis guidance templates

### Important restriction
No strong product claim that AI can reliably infer crisis from text alone.

### Acceptance criteria
- SOS notifies therapist reliably
- therapist can configure basic urgent-contact behavior
- alert logs are stored securely

### Dependencies
- M1
- secure notification pipeline
- therapist preferences

---

## Module M8 — Context layer
**Priority:** P2

### Goal
Store therapist-defined client context to improve summaries and AI responses.

### Functional requirements
- therapist can upload/edit anamnesis
- therapist can define current goals
- therapist can add AI instructions / boundaries for the client

### Data model changes
`client_context`:
- anamnesis_encrypted
- current_goals_encrypted
- contraindications_encrypted
- ai_instructions_encrypted

### Acceptance criteria
- therapist can update context
- summaries can incorporate context
- context remains encrypted at rest

### Dependencies
- encryption model
- therapist workspace

---

# 8. Cross-cutting services

## S1 — Encryption service
**Priority:** P0

### Responsibilities
- encrypt payloads before persistence
- decrypt on authorized read
- manage key version metadata
- support rotation-compatible design

### Requirements
- clean API for models/services
- deterministic handling of payload versioning
- no accidental plaintext fallback

---

## S2 — Audit logging
**Priority:** P0

### Responsibilities
- log reads of sensitive therapist-facing content
- log consent grants/revocations
- log access denials
- log alert events

---

## S3 — AI summarization service
**Priority:** P0

### Responsibilities
- generate therapist-facing summary for session or recent client period
- follow AI safety prompt constraints
- avoid diagnosis language

---

# 9. Suggested implementation order for AutoForge

## Wave 1 — foundation
1. S1 Encryption service
2. M1 Roles and consent
3. M2 Secure diary storage
4. S2 Audit logging

## Wave 2 — therapist utility
5. M3 Therapist workspace
6. M5 Client timeline
7. M4 Session intelligence

## Wave 3 — product usefulness expansion
8. M6 Exercise library
9. M7 Safety support
10. M8 Context layer

---

# 10. Suggested task decomposition format for AutoForge

Each task generated from this PRD should contain:
- **Task ID**
- **Module**
- **Objective**
- **Inputs / dependencies**
- **Files likely affected**
- **DB changes**
- **Acceptance criteria**
- **Security considerations**
- **Test requirements**

Example task categories:
- DB migration
- handler implementation
- service implementation
- repository implementation
- encryption integration
- prompt creation
- tests
- docs/update config

---

# 11. Recommended first task backlog

## T1
Implement encryption service abstraction for sensitive payloads.

## T2
Add role / therapist linkage / consent fields to `users` via migration.

## T3
Implement therapist onboarding and invite flow.

## T4
Implement client connect + consent + revoke flow.

## T5
Encrypt diary entry persistence path.

## T6
Implement therapist `/clients` command.

## T7
Implement therapist `/view` for linked client diary.

## T8
Create `therapist_notes` model/repo/service with encrypted payload.

## T9
Implement therapist `/note`.

## T10
Create session upload pipeline: audio reference + transcript + summary.

## T11
Create client timeline aggregator.

## T12
Add audit logging for sensitive reads.

## T13
Implement basic exercise library and send flow.

## T14
Implement SOS button and therapist notification flow.

## T15
Implement encrypted client context model and edit flow.

---

# 12. Acceptance criteria for V1 release candidate

V1 is release-candidate ready only if:
1. therapist-client linking works with explicit consent;
2. sensitive content is encrypted before DB persistence;
3. therapist can view linked client diary securely;
4. therapist can upload session audio and get transcript + summary;
5. transcript and summary are encrypted at rest;
6. therapist can view unified client timeline;
7. therapist can send at least one exercise;
8. basic urgent SOS flow works;
9. export/delete paths are validated for encrypted records;
10. logs prove access control is enforced.

---

# 13. Explicit anti-goals
Do **not** let AutoForge drift into these narratives in V1:
- “build an autonomous AI therapist”
- “build full clinic management / billing suite before therapist workflow value exists”
- “solve crisis detection as a keyword engineering problem”
- “optimize for investor story over therapist workflow”

---

# 14. Final implementation guidance
If tradeoffs are needed, optimize in this order:
1. security and consent,
2. therapist trust,
3. session summary + diary utility,
4. product depth,
5. secondary convenience features.

The product wins if a therapist says:
- “I lose less context,”
- “I do less double work,”
- “I can think better before the next session,”
- “This respects the boundaries of my profession.”
