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
