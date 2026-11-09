<!-- audience: public -->

# PR-TOP security overview

PR-TOP is designed around therapist control of sensitive client
data. This page summarizes the security model. For deeper detail
see `docs/PRD.md` and the dedicated Security pages on the marketing
site (`/security/encryption`, `/security/gdpr`, `/security/audit-log`,
`/security/data-sovereignty`).

## Security in plain language (five-point summary)

The `/security/encryption` page opens with a five-point human-readable
summary that non-technical therapists can read before the scroll:

1. **Where stored** — All data is processed and stored in EU data centers.
2. **How encrypted** — Application-layer AES-256. **PR-TOP is not
   end-to-end encrypted and not zero-knowledge.** The platform operator
   holds the decryption keys. A database dump alone reveals only ciphertext.
3. **Who can access** — Only the application layer (using the operator-held
   master key) can decrypt clinical content. Database-level access is
   insufficient. PR-TOP support does not access clinical data under normal
   operation.
4. **Audit trail** — Every sensitive-data access is recorded in a
   tamper-proof audit log (entries are purged automatically after 730 days by
   default; the operator can change this window). Therapists can review
   their own access log in the dashboard.
5. **GDPR** — All processing is EU-based. You can request a full export or
   deletion of your data at any time. Clinics that need a Data Processing
   Agreement should contact support@pr-top.com to discuss processing terms.

Technical details (algorithms, key management, TLS configuration, access
model) appear in a collapsible "For your IT reviewer" accordion below the
summary, so technical and non-technical visitors each get the information
they need.

## Data classes

- **Class A** — the sensitive body of therapy work: diary entries,
  private therapist notes, session transcripts, AI draft summaries awaiting
  therapist review, therapist-entered anamnesis and contraindications, SOS
  alert content, and exercise responses. Class A is encrypted at the
  application layer with AES before it is written to disk. Even a database
  dump is opaque without the key.
  Note: anamnesis and contraindications are **therapist-entered fields** on
  the client card — they are not AI-generated. AI produces only draft notes
  and session summaries that require explicit therapist review before use.
- **Class B** — access-controlled plaintext: timestamps, identifiers,
  role labels, and other metadata that must be indexable and
  queryable for the product to function.
- **Search index.** The semantic-search index keeps a short text
  preview (up to 200 characters) of each session transcript, session
  summary and diary entry. These previews are Class A too: they are
  encrypted like the records they come from and are decrypted only
  when search results are returned to the client's own therapist.
  When a client marks a diary entry private in the bot, its search
  index entry is deleted, so it can no longer be found by search.

## Transport and identity

- All traffic is served over TLS via an nginx reverse proxy with
  Let's Encrypt certificates.
- Authentication uses short-lived JWTs delivered in an HttpOnly,
  Secure cookie. The web app never stores or reads the token itself
  (it is not kept in browser storage and is not returned in login
  responses), and every state-changing request must also carry a CSRF
  token.
- Passwords are stored as bcrypt hashes; login is rate-limited.
- A sign-in session lasts at most 24 hours. Every session token carries
  a per-account version number, so sessions can be revoked server-side
  before they expire:
  - **Resetting your password** (via **Forgot password?**) signs you out
    on every device and browser. Sign in again with the new password.
  - **An administrator blocking an account** ends all of that account's
    sessions immediately, including open real-time dashboard
    connections. If the account is later unblocked, the old sessions do
    not come back; the therapist simply signs in again.
  - **Signing out from the sidebar** ends the session in that browser
    only (the session cookie is cleared server-side and the browser's
    cached profile is removed). Sessions on your other devices stay signed
    in until they expire or you reset your password.
- Every access to a client record is written to an append-only
  audit log that the therapist can review from the dashboard.

## Who inside the app can read clinical content

- Clinical content (session transcripts, summaries and recordings,
  diary entries and their audio, search previews, and comments on
  clients, sessions, assignments and reports) is returned only to the
  client's currently linked therapist, and only while the client's
  therapist access consent is granted. The client sees their own
  data in the bot.
- The platform administrator role is a separate role for running the
  service (therapist accounts, statistics, AI configuration, audit and
  system logs, backups). It gets no special read access to clinical
  content: administrator accounts pass the same linked-therapist and
  consent checks as any therapist, and a client's private diary
  entries stay hidden from them too.
- Supervision share links follow the same rules: a link stops working
  as soon as the client withdraws consent or is no longer linked to
  the therapist who created it (see the Supervision sharing page).

## The assistant chatbot

The between-session assistant is answered from a hand-curated
knowledge base (`docs/`, `docs/assistant-kb/`, and UI labels) — NOT
from source code. Public queries and signed-in queries are scoped
to different audiences. All assistant replies are passed through a
redaction guardrail that strips secret-shaped strings before the
reply is returned or cached.

## Deployment

PR-TOP runs as a Docker Compose stack (six services) behind an
nginx reverse proxy, deployed via Dokploy on Hetzner in the European
Union. All client data is stored and processed within the EU — no
data is transferred to servers outside EU jurisdiction. Encrypted
daily backups run on a configurable retention schedule.

## Consent enforcement

- Every client record carries three independent consent flags:
  diary storage, session recording, and supervision share.
- Data-writing API routes reject requests when the relevant flag is
  off. The UI disables the associated affordance (upload button,
  share modal) with a tooltip.
- Consent flag changes are audit-logged with therapist id and
  timestamp.

## Edge cases

- **Consent revocation mid-relationship.** Turning off diary storage
  prevents new entries; existing entries stay encrypted until you use
  the deletion flow.
- **Backup restoration.** Restoring from an encrypted backup requires
  the operator to hold the encryption key. Without the key the
  backup is unreadable.
- **Third-party AI providers.** AI configuration disables provider-
  side training on submitted data. Only excerpts required to answer a
  query are sent inline; nothing is retained by the provider on
  PR-TOP's account.

## Troubleshooting

- **Cannot upload a session.** Confirm the session-recording consent
  flag on the client page is on.
- **Supervision-share link shows less than expected.** The share is
  read-only and is a snapshot: it contains only records created before
  the link, never private diary entries. If the client withdraws
  therapist access consent or leaves your practice, the link stops
  working entirely and is marked Revoked.
- **Audit log missing an event.** Audit entries are append-only and
  never edited. If you cannot find an event, widen the filter or
  check the correct client's timeline.
- **Suddenly sent back to the sign-in page on another device.** This is
  expected after a password reset: the reset revokes every existing
  session. Sign in again with the new password.

## FAQ

**Q: Is PR-TOP HIPAA/GDPR compliant?**
A: PR-TOP is designed to help therapists meet GDPR obligations —
export, right-to-be-forgotten, encrypted storage, audit logging. The
therapist remains the data controller for their clients. A DPA is
available on request.

**Q: If I think someone else is signed in to my account, how do I end their session?**
A: Reset your password with **Forgot password?** on the sign-in page.
Setting a new password revokes every existing session on every device,
so anyone holding an old session is signed out at their next request.
Signing out from the sidebar only ends the session in the browser you
click it in.

**Q: What is Class A vs Class B?**
A: Class A = the sensitive body of therapy work (diary, notes,
transcripts, AI summaries) — AES-encrypted at rest. Class B =
metadata (IDs, timestamps, roles) — access-controlled plaintext.

**Q: What happens to the encryption key?**
A: The key is held by the operator and never included in a database
export. Backups are also encrypted; restoring requires the key.

**Q: Who can technically decrypt my clients' data?**
A: Decryption requires the ENCRYPTION_MASTER_KEY, which is held by
the service operator and stored in a protected environment variable —
never in the database. Under normal operation no PR-TOP team member
accesses clinical content; support works with anonymized metadata and
logs only.

**Q: Can a PR-TOP platform administrator read my clients' diaries or transcripts in the app?**
A: Not through any special access. The administrator role manages the
service, not clinical work. Transcripts, summaries, recordings, diary
entries, search previews and comments are returned only to the
client's linked therapist while consent is granted, and administrator
accounts pass the same checks. Administrators see platform metadata
such as account lists and usage statistics.

**Q: Where is PR-TOP's data stored?**
A: All client data is stored exclusively in the European Union
(Hetzner infrastructure). There is no US region and no self-hosting
option — PR-TOP is a managed SaaS product. The therapist controls
access (who can read client data) through authentication, consent,
and role-based permissions; the physical location is EU-only.

**Q: Is PR-TOP end-to-end encrypted or zero-knowledge?**
A: No. PR-TOP uses application-layer encryption (AES-256) which
protects data in the database and in backups, but the master key is
held by the operator on the server. This is not the same as
true end-to-end encryption (where only the end-user holds keys) or
zero-knowledge architecture (where the service cannot decrypt at all).
The honest description is: "encrypted at rest, key held by operator."

**Q: Does the assistant chatbot have my clients' data?**
A: No. The assistant reads only the public and user-audience
knowledge base — never a specific client's diary, notes, or
transcripts.

**Q: Are secret-shaped strings ever leaked into chatbot replies?**
A: No. Every assistant reply passes through a redaction guardrail
that strips API keys, JWTs, Bearer tokens, and env-style secret
assignments before the reply is returned or cached.

**Q: How long are backups retained?**
A: Retention is configurable by the operator. Defaults are
documented in the deployment runbook.
