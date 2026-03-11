# PRODUCT REQUIREMENTS DOCUMENT
## PsyLink — Therapist Assistant Platform
**Fork of github.com/avamb/3hours (MindSetHappyBot)**

**v2.0 | March 2026 | revised after competitor review + psychologist interview**

---

## 1. Product framing

### 1.1 What PsyLink is
PsyLink is **not** a generic mental health chatbot and **not** an AI psychologist.

PsyLink is a **therapist assistant platform** for working with client material **between sessions**.

Core idea:
- client writes / sends voice / completes exercises in a familiar messenger flow;
- therapist gets structured visibility into that material;
- AI assists with summarization, organization, and contextual support;
- therapist remains the decision-maker.

### 1.2 What PsyLink is not
- not self-help automation instead of therapy;
- not autonomous clinical decision-making;
- not a keyword-only crisis detector;
- not a full EHR replacement in MVP.

### 1.3 Strategic thesis
The strongest wedge is **not “AI understands the client better than the therapist.”**

The strongest wedge is:
1. reduce double documentation work,
2. preserve between-session context,
3. improve depth of work,
4. provide therapist-supervised diary + session summaries + structured client timeline.

---

## 2. Critical product insights incorporated into v2

### 2.1 Controlled journaling is mandatory
Based on the interview with a practicing psychologist:
- journaling is useful for many schools of therapy,
- but unsafe or unhelpful for some traumatized clients if unsupervised.

**Requirement:** all client diaries used within PsyLink must be therapist-supervised when the product is used as part of real therapy.

### 2.2 Context matters more than keywords
Keyword-based psychological monitoring repeatedly failed in prior startup attempts because meaning is context-dependent.

**Requirement:** alarms and analytics must never rely only on keyword matching. Contextual interpretation and therapist oversight are mandatory.

### 2.3 Main value = deeper work, not “faster therapy”
The interview strongly suggests that psychologists are more likely to value:
- better preservation of material,
- better preparation for sessions,
- richer context,
- less double work,
than abstract promises about “faster therapy” or “more clients.”

### 2.4 Session transcription + summarization is a primary monetizable wedge
The fastest clear ROI comes from:
- recording a session,
- transcribing it,
- summarizing it,
- storing it in client context.

This must be a top-tier product pillar, not a side feature.

---

## 3. Market and competitive interpretation

### 3.1 Competitive buckets
PsyLink competes against three adjacent categories:

1. **B2C mental health / journaling apps**
   - Woebot, Wysa, Rosebud, Earkick, Calm/Headspace AI layers
   - Weakness: no real therapist supervision / mostly B2C / self-help orientation

2. **Therapist AI productivity tools**
   - Upheal, Mentalyc, Eleos, DeepCura
   - Strength: clear ROI via session notes / summaries
   - Weakness: little or no between-session client engagement layer

3. **Practice management / EHR tools**
   - SimplePractice, TherapyNotes, local scheduling/CRM tools
   - Strength: existing workflow lock-in
   - Weakness: admin-heavy, weak messaging-native client engagement, weak contextual AI

### 3.2 Strategic positioning
PsyLink should position itself as:

> a therapist-controlled between-session intelligence layer

not as:
- “AI therapist”,
- “mental health chatbot”,
- or “full clinic management system” in early stages.

### 3.3 Region strategy (pragmatic)
**Learning / early pilot market:** RU/UA + diaspora
- fast discovery
- Telegram-native behavior
- high need / contextual relevance

**Best early commercial market:** Spain
- lower competition than US
- more manageable than enterprise-heavy markets
- easier first paid therapist adoption path than US/HIPAA-first route

**Expansion after validation:** LatAm (ES/PT), then DACH, then EN markets

---

## 4. Product pillars (re-prioritized)

### P0: Therapist-supervised client layer
- client ↔ therapist linking
- explicit consent to therapist access
- therapist view of client diary entries
- therapist notes
- client timeline

### P0: Session capture and summary
- upload or record session audio
- transcript generation
- therapist-facing AI summary
- searchable session archive

### P1: Exercise delivery layer
- exercise library
- send exercise to client
- collect client feedback / completion notes

### P1: Safety support layer
- SOS / urgent flag to therapist
- configurable crisis routing
- therapist-defined escalation preferences
- conservative alerting

### P2: Contextual analytics
- therapist summary by period
- trend support
- context-aware hinting
- cross-session pattern surfacing

### P3: Advanced expressive inputs
- drawing / sketching + voice
- dual-video / environment capture (only if privacy model is robust)
- graph knowledge / long-range relationship mapping

---

## 5. Security and privacy model (hard requirement)

## 5.1 New mandatory principle
**All messages and client materials must be encrypted both in transit and at rest.**

This is now a non-negotiable product requirement.

### 5.2 In transit
All data transmission must use encrypted channels:
- TLS 1.2+ minimum for all web/API/admin traffic;
- HTTPS everywhere;
- encrypted transport for internal service communication where possible;
- secure handling of Telegram file retrieval and downstream storage.

### 5.3 At rest
All sensitive client materials must be encrypted at rest, including:
- diary entries,
- message text,
- voice transcripts,
- therapist notes,
- client context / anamnesis,
- session summaries,
- alarm-related sensitive payloads.

### 5.4 Database storage requirement
Sensitive text content must not be stored in plaintext-only form in the primary DB.

Required model:
- application-layer encryption for sensitive payload fields before DB write;
- per-environment master key stored outside the DB;
- key rotation plan;
- separation between metadata and encrypted content;
- least-privilege access for services.

### 5.5 Search architecture implication
Because PsyLink needs semantic search / analytics:
- raw sensitive content should remain encrypted at rest;
- embeddings, indices, and searchable derivatives must be reviewed as sensitive artifacts;
- for high-sensitivity fields, use a split model:
  - encrypted canonical payload,
  - minimized derived search representation,
  - strict access controls;
- if plaintext is temporarily needed for model processing, it must be memory-bound and never persist unencrypted.

### 5.6 Access control
- therapist sees only explicitly linked clients;
- client can revoke consent;
- supervisor/admin access must be role-scoped and auditable;
- all access to sensitive payloads should be logged.

### 5.7 Audit and compliance
- audit log for reads of sensitive client data;
- export/delete must include encrypted content handling;
- documented breach response playbook;
- regional compliance roadmap (GDPR first; HIPAA later if US expansion proceeds).

---

## 6. MVP scope (updated)

### 6.1 Must-have MVP
1. Role system: therapist / client
2. Consent-based linking
3. Therapist can view client diary
4. Therapist notes
5. Session audio upload / transcript / summary
6. Searchable client timeline
7. Exercise library (basic)
8. Secure encrypted storage of all sensitive materials

### 6.2 Should-have shortly after MVP
1. SOS button
2. Inactivity alerts
3. Therapist-configurable alert preferences
4. Calendar of sessions
5. Better per-client context controls

### 6.3 Not core MVP
1. complex graph analytics
2. dual video capture
3. autonomous AI alerting promises
4. generalized self-help mode as primary narrative

---

## 7. Required DB / architecture changes

### 7.1 Existing tables to revisit
Current structures from MindSetHappyBot are a good foundation, but sensitive content fields must be redesigned for encrypted persistence.

For all sensitive-text-bearing tables, introduce encrypted columns, e.g.:
- `content_encrypted`
- `summary_encrypted`
- `transcript_encrypted`
- `anamnesis_encrypted`
- `note_encrypted`

Possible metadata fields may stay plaintext if low-risk:
- timestamps
- role links
- status enums
- language tags
- non-sensitive counters

### 7.2 New principle for content-bearing tables
The following should be treated as sensitive by default:
- `moments` / `diary_entries`
- `conversations`
- `therapist_notes`
- `sessions.transcript`
- `sessions.summary`
- `client_context`
- alarm payload excerpts

### 7.3 Proposed content model
For each sensitive record:
- encrypted_payload
- payload_version
- encryption_key_id
- searchable_excerpt (optional, minimized)
- embedding_ref / embedding_policy

### 7.4 File storage
Audio / attachments should be:
- stored in encrypted object storage or encrypted filesystem volumes,
- referenced by opaque IDs,
- never publicly exposed by static URL,
- signed-access only if download is required.

---

## 8. Updated modules and priorities

### Module A — Roles and consent [P0]
Goal: establish safe therapist-client relationship model.

Includes:
- role selection on onboarding
- invite / connect flow
- explicit client consent
- revoke access flow

### Module B — Therapist workspace [P0]
Goal: therapist can work with client material without leaving the system.

Includes:
- /clients
- /view
- /summary
- /note
- timeline view

### Module C — Session intelligence [P0]
Goal: reduce double work after sessions.

Includes:
- upload session audio
- transcript generation
- summary generation
- save to client history

### Module D — Exercises [P1]
Goal: therapist can quickly send practical interventions.

Includes:
- exercise library
- filtering by category / language
- send to client
- basic shared library support later

### Module E — Safety support [P1]
Goal: therapist-defined support routing, not overpromised automation.

Includes:
- SOS button
- conservative crisis prompts
- escalation routing to therapist
- optional custom triggers, but context-aware and therapist-reviewed

### Module F — Context and analytics [P2]
Goal: improve depth of work.

Includes:
- client-specific context / anamnesis
- therapist instructions to AI
- periodic summaries
- pattern surfacing

---

## 9. Updated sprint plan

### Sprint 1 — Security foundation + roles
- implement encryption design for sensitive payloads
- key management approach
- role fields + consent model
- invite / connect flow
- revoke consent

**Output:** safe therapist-client linking foundation with encrypted content pipeline.

### Sprint 2 — Therapist workspace + diary access
- therapist client list
- diary viewing
- therapist notes
- basic timeline
- encrypted read/write path validation

**Output:** therapist can securely review client material.

### Sprint 3 — Session transcript + summary
- session upload flow
- transcription pipeline
- summary prompt
- store transcript/summary encrypted
- attach to client history

**Output:** strongest monetizable therapist workflow becomes real.

### Sprint 4 — Exercises + pilot readiness
- exercise library
- send exercise flow
- basic calendar hooks
- first pilot onboarding docs
- pricing test preparation

**Output:** pilot-ready therapist product.

### Sprint 5 — Safety layer (controlled)
- SOS button
- escalation routing
- conservative crisis flow
- therapist-defined preferences
- audit logging for alerts

**Output:** support-oriented safety features without overclaiming clinical automation.

---

## 10. Non-functional requirements (updated)

| Category | Requirement |
|---|---|
| Security | All sensitive client data encrypted in transit and at rest; application-layer encryption for sensitive payloads |
| Privacy | Explicit consent, revocation, data minimization, export/delete support |
| AI ethics | AI never diagnoses or replaces therapist judgment |
| Reliability | Alerting and summaries must fail safely; no silent loss of critical data |
| Search | Semantic search must respect encrypted canonical storage model |
| Localization | RU/EN/ES minimum; therapist-facing language quality must be professional |
| Auditability | Access to sensitive client materials must be logged |
| Scalability | Should support early solo/small practice adoption before enterprise hardening |

---

## 11. Acceptance criteria for v2 MVP
1. Therapist and client can be linked only via explicit consent.
2. Sensitive content is never stored plaintext-only in the primary DB.
3. Therapist can securely access only their own linked clients.
4. Session transcript and summary are generated and stored encrypted.
5. Therapist can review a coherent client timeline combining diary + notes + session outputs.
6. Therapist can send at least one structured exercise to a client.
7. Consent can be revoked cleanly.
8. Export/delete flows correctly handle encrypted payloads.
9. Product messaging and UI do not position AI as therapist replacement.
10. Pilot therapists confirm that the product improves depth/preparation/structure, not just novelty.

---

## 12. Go-to-market implication
### Phase 1: RU/UA + diaspora
Use for discovery, therapist interviews, design partners, early pilots.

### Phase 2: Spain
Use for first serious paid therapist adoption.

### Phase 3: LatAm / PT markets
Expand after paid validation.

### Phase 4: DACH / EN markets
Enter after stronger compliance, product maturity, and trust assets.

---

## 13. Final product principle
PsyLink succeeds if therapists feel:
- “I lose less important material,”
- “I spend less time on double documentation,”
- “I can work more deeply with this client,”
- “This tool respects the boundaries of therapy.”

If it is perceived as “just another AI chatbot,” it fails.
