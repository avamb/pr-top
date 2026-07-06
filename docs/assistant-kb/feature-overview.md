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
