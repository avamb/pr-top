# FIRST MILESTONE CHECKLIST — PsyLink

Use this checklist to validate that the **first implementation wave** of PsyLink is actually usable and aligned with the intended product direction.

---

## Milestone goal
The first milestone is successful if the system already behaves like a **secure therapist workflow product**, not like a generic AI bot prototype.

---

## A. Product integrity checks

### A1. Product identity
- [ ] The product is clearly framed as a **therapist assistant**, not an autonomous AI therapist.
- [ ] UI / copy / prompts do not imply diagnosis or therapist replacement.
- [ ] The client diary is therapist-supervised in the therapy workflow.

### A2. Scope discipline
- [ ] The team did not drift into full billing/CRM/EHR scope.
- [ ] Graph analytics is not blocking the first milestone.
- [ ] Advanced speculative AI features were deferred if they slowed core therapist workflow.

---

## B. Security and privacy checks

### B1. Encryption
- [ ] Sensitive client messages are encrypted at rest.
- [ ] Diary entries are encrypted at rest.
- [ ] Therapist notes are encrypted at rest.
- [ ] Session transcripts are encrypted at rest.
- [ ] Session summaries are encrypted at rest.
- [ ] Sensitive data is transmitted only over encrypted channels.

### B2. Access control
- [ ] Therapist can only access explicitly linked clients.
- [ ] Client consent is explicit, not implied.
- [ ] Client can revoke consent.
- [ ] Revoking consent removes therapist access correctly.
- [ ] Sensitive reads are auditable.

### B3. Privacy operations
- [ ] Export flow works for encrypted records.
- [ ] Delete flow works for encrypted records.
- [ ] No plaintext-only fallback storage was introduced for convenience.

---

## C. Core workflow checks

### C1. Linking flow
- [ ] Therapist can onboard successfully.
- [ ] Therapist can generate/share invite code or invite flow.
- [ ] Client can connect to therapist.
- [ ] Client sees a clear consent step.

### C2. Diary flow
- [ ] Client can submit diary material.
- [ ] Diary material is stored securely.
- [ ] Therapist can review diary material of linked client.
- [ ] Unauthorized therapist cannot access it.

### C3. Therapist workspace
- [ ] Therapist can view list of linked clients.
- [ ] Therapist can inspect recent client material.
- [ ] Therapist can create private notes.
- [ ] Therapist can see recent activity / working context.

### C4. Session workflow
- [ ] Therapist can upload session audio.
- [ ] Transcript is generated successfully.
- [ ] Summary is generated successfully.
- [ ] Transcript and summary are attached to client history.

### C5. Timeline workflow
- [ ] Therapist can see a unified timeline.
- [ ] Timeline includes at least diary + therapist notes + session summaries.
- [ ] Timeline is chronological and understandable.

### C6. Exercise workflow
- [ ] Therapist can send at least one exercise to a client.
- [ ] Client receives the exercise.
- [ ] Delivery is recorded.

---

## D. AI quality and safety checks

### D1. Summary quality
- [ ] AI summaries are helpful for therapist preparation.
- [ ] Summaries do not output diagnosis-style claims.
- [ ] Summaries do not overstate certainty.

### D2. Alert/safety behavior
- [ ] SOS / urgent support flow works if included in milestone.
- [ ] System does not pretend that keyword alerts are clinically sufficient.
- [ ] Any crisis-related messaging routes toward human support / therapist involvement.

---

## E. Architecture checks

### E1. Vector search readiness
- [ ] The implementation supports vector-search-based retrieval where intended.
- [ ] Vector-search integration does not require plaintext canonical storage.

### E2. Graph future-readiness
- [ ] Architecture leaves room for future graph-analysis layer.
- [ ] Graph dependency is not required for first milestone release.
- [ ] Event/entity structures are not blocked by current schema choices.

---

## F. Manual walkthrough to perform

Run this exact scenario:

1. Create therapist account.
2. Create client account.
3. Link client to therapist via consent flow.
4. Client sends diary message.
5. Therapist sees diary entry.
6. Therapist adds note.
7. Therapist uploads session audio.
8. System generates transcript + summary.
9. Therapist views unified timeline.
10. Therapist sends an exercise.
11. Client receives it.
12. Client revokes consent.
13. Therapist loses access.

### Manual result should be:
- [ ] all steps complete successfully
- [ ] no unsafe permission leak observed
- [ ] no sensitive data appears exposed in plaintext unexpectedly

---

## G. Release decision questions

Before calling milestone complete, answer:
- [ ] Does this already feel like a therapist workflow product?
- [ ] Would a therapist understand why this is useful?
- [ ] Is the security model real, not decorative?
- [ ] Is the system useful even before future graph analytics exists?
- [ ] Did we build something trustworthy enough for a pilot?

---

## H. Definition of “milestone passed”
The first milestone passes only if:
- security foundation is real,
- therapist/client linking works,
- diary + notes + transcript + summary + timeline are functional,
- the product feels like a real assistant for therapist work,
- and future vector/graph evolution remains possible without forcing premature complexity.
