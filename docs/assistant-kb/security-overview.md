<!-- audience: public -->

# PR-TOP security overview

PR-TOP is designed around therapist control of sensitive client
data. This page summarizes the security model. For deeper detail
see `docs/PRD.md` and the dedicated Security pages on the marketing
site (`/security/encryption`, `/security/gdpr`, `/security/audit-log`,
`/security/data-sovereignty`).

## Data classes

- **Class A** — the sensitive body of therapy work: diary entries,
  private therapist notes, session transcripts, and AI summaries.
  Class A is encrypted at the application layer with AES before it
  is written to disk. Even a database dump is opaque without the key.
- **Class B** — access-controlled plaintext: timestamps, identifiers,
  role labels, and other metadata that must be indexable and
  queryable for the product to function.

## Transport and identity

- All traffic is served over TLS via an nginx reverse proxy with
  Let's Encrypt certificates.
- Authentication uses short-lived JWTs delivered in an HttpOnly,
  Secure cookie, plus a CSRF token bound to the session.
- Passwords are stored as bcrypt hashes; login is rate-limited.
- Every access to a client record is written to an append-only
  audit log that the therapist can review from the dashboard.

## The assistant chatbot

The between-session assistant is answered from a hand-curated
knowledge base (`docs/`, `docs/assistant-kb/`, and UI labels) — NOT
from source code. Public queries and signed-in queries are scoped
to different audiences. All assistant replies are passed through a
redaction guardrail that strips secret-shaped strings before the
reply is returned or cached.

## Deployment

PR-TOP runs as a Docker Compose stack (six services) behind an
nginx reverse proxy, deployed via Dokploy on Hetzner. Encrypted
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
- **Cannot generate a supervision-share link.** Confirm the
  supervision consent flag is on and that your plan is Premium.
- **Audit log missing an event.** Audit entries are append-only and
  never edited. If you cannot find an event, widen the filter or
  check the correct client's timeline.

## FAQ

**Q: Is PR-TOP HIPAA/GDPR compliant?**
A: PR-TOP is designed to help therapists meet GDPR obligations —
export, right-to-be-forgotten, encrypted storage, audit logging. The
therapist remains the data controller for their clients. A DPA is
available on request.

**Q: What is Class A vs Class B?**
A: Class A = the sensitive body of therapy work (diary, notes,
transcripts, AI summaries) — AES-encrypted at rest. Class B =
metadata (IDs, timestamps, roles) — access-controlled plaintext.

**Q: What happens to the encryption key?**
A: The key is held by the operator and never included in a database
export. Backups are also encrypted; restoring requires the key.

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
