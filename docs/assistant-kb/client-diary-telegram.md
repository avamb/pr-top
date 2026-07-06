<!-- audience: user -->

# How the client diary works over Telegram

PR-TOP's between-session channel is a Telegram bot the client already
has installed on their phone. This how-to explains what your client
sees, what you see, and how privacy is enforced.

## Connecting the client

1. From the client page, tap **Invite via Telegram**. PR-TOP generates
   a one-time invite code AND a deep link that opens the bot
   pre-populated with that code.
2. Share the deep link with the client through your usual channel
   (email, WhatsApp). No client data is sent — only the link.
3. The client opens the link, taps **Start** inside Telegram, and the
   bot binds their Telegram user to your client record. Their status
   flips from *Pending invite* to *Connected*.

## What the client can send

- Text diary entries.
- Voice notes (transcribed automatically).
- Short video notes.
- Answers to exercises you have assigned.
- **SOS** — a one-tap crisis button. See the crisis how-to for what
  happens next.

Every message is encrypted at rest before it lands in the database.

## What you see on the dashboard

- A running diary timeline on the client page.
- Voice transcriptions inline with the audio.
- Private therapist notes on the same page — visible only to you and,
  if you enabled it, a supervising colleague on the Premium plan.

## Privacy boundaries

- The client cannot see your private notes.
- The assistant chatbot cannot read the diary of any specific client;
  it only knows about the platform.
- A client can revoke consent at any time from inside the bot. When
  they do, all future entries stop, and PR-TOP surfaces the revocation
  on your client roster.
