<!-- audience: public -->

# PR-TOP feature overview

PR-TOP is a therapist-controlled assistant that helps psychologists
work deeper between sessions, preserve context across a long
therapy arc, and reduce the double documentation burden of a busy
private practice. The therapist runs the platform. Clients only
interact with a Telegram bot on their phone.

## Three surfaces

- **Therapist dashboard** — a React web app for clients, sessions,
  exercises, notes, and analytics. Localized in English, Russian,
  Spanish, and Ukrainian.
- **Backend API** — a Node.js REST service on an encrypted SQLite
  database. Handles auth, uploads, transcription, AI summaries,
  and Stripe billing.
- **Telegram bot** — a long-polling bot the client uses for diary
  entries (text, voice, video), assigned exercises, and the SOS
  crisis trigger.

## What PR-TOP does for you

- Preserves the between-session context you would otherwise lose,
  so the next session starts already caught up.
- Transcribes and summarizes session recordings, cutting the time
  you spend on notes.
- Lets clients keep a diary in the messenger they already have,
  rather than a new app they will forget to open.
- Ships exercises directly to the client's phone with follow-up
  responses coming back onto your dashboard timeline.
- Surfaces a crisis alert path with a lifecycle you can audit.
- Offers vector semantic search over a client's history on Pro
  and Premium, so you can find that one story from six months ago
  in seconds.

## What PR-TOP is not

- Not a replacement for emergency services in an acute crisis.
- Not a shared social platform — clients never see one another.
- Not an autonomous AI therapist — every AI output goes through
  the therapist before it reaches the client.

## Plan tiers at a glance

- **Trial** — $0 for 14 days, 3 client seats, 10 sessions/mo.
- **Basic** — $19/mo, 15 clients, 50 sessions/mo, adds transcription
  and AI session summaries.
- **Pro** — $49/mo, 60 clients, 250 sessions/mo, adds vector search,
  natural-language queries, PDF/JSON/CSV export, custom exercises.
- **Premium** — $99/mo, unlimited clients and sessions, adds
  supervision share and SOS multichannel delivery.

## Edge cases

- **Multiple therapists in one practice.** Each therapist runs a
  separate account. Premium therapists can share individual clients
  read-only with a supervising colleague through Supervision Share.
- **Cross-language clients.** UI and bot support EN/RU/ES/UK; vector
  embeddings are cross-lingual, so an English NL query can retrieve
  Russian-language diary entries.
- **Zero-client accounts.** A brand-new account with no clients shows
  onboarding cards instead of the activity feed.

## Troubleshooting

- **Confused about which surface does what?** Dashboard is the
  therapist workflow; Telegram is where the client lives; the API
  glues them together.
- **Cannot find a feature you saw advertised.** Check the plan tiers
  list above — some features require a higher-tier subscription.

## FAQ

**Q: Who uses PR-TOP?**
A: Licensed psychologists, therapists, and counsellors who want a
tool to preserve between-session context and reduce documentation
double-work.

**Q: Does the client have to install a new app?**
A: No. The client uses Telegram, which they most likely already have.
The bot is a normal Telegram chat.

**Q: Where does PR-TOP store data?**
A: On European infrastructure. Class-A data is AES-encrypted at rest
at the application layer.

**Q: Can I export my data?**
A: Yes. Per-client PDF/JSON/CSV (Pro/Premium for structured formats)
and whole-account JSON archive from Settings → Security.

**Q: Is the AI ever unsupervised with the client?**
A: No. The client-facing bot sends short acknowledgements and
scheduled exercises. Clinical content flows through the therapist.

**Q: Where do I read more?**
A: The public marketing pages under `/features`, `/pricing`, and
`/security`, and the assistant knowledge base you are reading now.
