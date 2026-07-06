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

## Edge cases

- **Muted bot notifications.** If the client mutes the PR-TOP bot in
  Telegram, entries can still be sent but reminders are silent. Ask
  the client to unmute if engagement dips.
- **Phone or Telegram change.** The Telegram user id is the binding
  key. Changing phone numbers keeps the binding; a new Telegram
  account breaks it and you must reinvite.
- **Cross-midnight entries.** An entry sent at 23:59 counts against
  the day it left the phone. Streaks are computed in the client's
  Telegram time zone.

## Troubleshooting

- **Row stuck at "pending invite".** Regenerate the deep link from
  the client page. The old code invalidates.
- **Bot replies but no diary entries appear.** Confirm the
  diary-storage consent flag on the client page is on.
- **Wrong language in bot replies.** The client can override with
  `/lang <en|ru|es|uk>`. Language changes take effect on the next
  message.
- **Voice notes not transcribed.** Diary voice notes are stored as
  audio, not transcribed. Session upload (through the dashboard) is
  the transcribed path.

## FAQ

**Q: Can the client edit an entry after sending it?**
A: The bot exposes an inline edit and delete for 24 hours. After
that, deletion requires asking the therapist to purge from the
dashboard.

**Q: Are diary entries encrypted?**
A: Yes. Every diary entry is Class-A data — encrypted at rest with
AES at the application layer.

**Q: Can I reply to a diary entry?**
A: Yes. Open the entry on the dashboard and use the therapist reply
box; the reply lands in the client's Telegram as a message from you.

**Q: What if the client sends a photo or document?**
A: The bot treats them as diary attachments — stored encrypted
alongside the text or voice note.

**Q: How much diary history does the client see in the bot?**
A: The `/history` command shows the last 30 days of the client's own
entries. Beyond that, the therapist is the interface.

**Q: Does PR-TOP support Telegram group chats?**
A: No. The bot is designed for one-to-one direct-message chats only.
