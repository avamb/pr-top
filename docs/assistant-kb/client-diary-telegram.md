<!-- audience: public -->

# How the client diary works over Telegram

PR-TOP's between-session channel is a Telegram bot the client already
has installed on their phone. This how-to explains what your client
sees, what you see, and how privacy is enforced.

## Connecting the client

1. On your dashboard, copy your invite link (**Copy Invite Link**) or
   your invite code (**Your Invite Code**).
2. Share the link with the client through your usual channel (email,
   WhatsApp). No client data is sent — only the link. A client who
   only has the code sends `/connect YOURCODE` to the bot.
3. The client opens the link, taps **Start** inside Telegram, and the
   bot shows the consent text. After the client ticks all six boxes
   and presses **I agree and connect**, the bot links their Telegram
   account to you.

## What the client can send

- Text diary entries: any plain message that is not a command.
- Voice messages (transcribed automatically on the server).
- Video messages and round video notes (also transcribed).
- Answers to exercises you have assigned, typed as text.
- Progress reports on assignments, as text or voice, with an optional
  photo, after `/report`.
- **SOS** — a one-tap crisis button that notifies the therapist as
  part of the pre-agreed protocol (not an emergency service call).
  See the crisis how-to for what happens next.

Right after each saved diary entry the bot offers a **Make private**
button; a private entry is hidden from you. The bot has no edit or
delete option for saved entries.

Every message is encrypted at rest before it lands in the database.

## What you see on the dashboard

- A running diary timeline on the client page.
- Voice and video transcriptions inline with the audio, with a retry
  button if a transcription failed.
- Private therapist notes on the same page — visible only to you and,
  if you enabled it, a supervising colleague with access to this client.

## Privacy boundaries

- The client cannot see your private notes.
- The assistant chatbot cannot read the diary of any specific client;
  it only knows about the platform.
- A client can revoke consent at any time from inside the bot. When
  they do, all future entries stop, and PR-TOP surfaces the revocation
  on your client roster.

## Consent, connection buttons and recording size

- **Consent before anything is shared.** After the client opens your
  invite link (or sends `/connect` with your code), the bot shows the
  consent text with six checkboxes. All six must be ticked before
  **"I agree and connect"** links the client to you. The bot only links
  to the therapist whose invite code the client just used.
- **Expired consent buttons.** A consent prompt lives for 30 minutes and
  does not survive a bot restart. Pressing an old button makes the bot
  answer that the button has expired and ask the client to send `/start`
  again (or reopen your invite link) and repeat the step. Nothing is
  linked by an expired button.
- **Client linked by an administrator.** If a platform administrator
  linked the client to you, the client has not consented yet. The next
  time the client writes a diary message, sends a voice, video or photo,
  or opens exercises, assignments or `/report`, the bot first shows the
  consent prompt for you. An SOS is always sent first; the prompt
  follows it.
- **Declining the administrator link.** If the client presses
  **Cancel** on that prompt, the bot asks "Disconnect from <therapist>?"
  with **Yes, disconnect** and **Back**. Only **Yes, disconnect** removes
  the link (the same effect as `/disconnect`); **Back** shows the consent
  prompt again. If your account is currently blocked, the client cannot
  give consent; the bot says the therapist is unavailable and offers the
  same **Yes, disconnect** button. The link itself is not removed
  automatically.
- **Declining an updated consent text.** When the consent text changes,
  connected clients are asked to agree again. If the client presses
  **Cancel**, they stay connected to you, but diary entries and exercises
  are paused: the bot shows the consent again on their next diary or
  exercise action until they agree, or they leave with `/disconnect`.
  An SOS always goes through.
- **Exercise answers after a disconnect.** If the client disconnects
  (or moves to another therapist) after you sent an exercise, an answer
  typed later is neither saved nor sent to you; the client is told that
  they are no longer connected to the therapist who sent it.
- **Recording size.** Telegram lets the bot download files of up to
  20 MB. Larger voice or video messages are rejected before download
  with a "file is too large" message asking for a shorter recording. If
  a download from Telegram fails, nothing is saved and the client is
  asked to send the recording again.

## Edge cases

- **Muted bot notifications.** If the client mutes the PR-TOP bot in
  Telegram, entries can still be sent but bot messages (such as
  session reminders) are silent. Ask the client to unmute if
  engagement dips.
- **Phone or Telegram change.** The Telegram user id is the binding
  key. Changing phone numbers keeps the binding; a new Telegram
  account breaks it and you must reinvite.
- **Photos.** The bot accepts a photo only as an attachment to a
  progress report (`/report`, pick an assignment, then send the
  photo). Elsewhere it explains this and saves nothing.
- **Open exercise or report.** While an exercise or a report is
  waiting for an answer, the next text message goes there instead of
  the diary.

## Troubleshooting

- **Client never connects.** Check that the client ticked all six
  consent boxes and pressed **I agree and connect**; an old consent
  button expires after 30 minutes, and the client then sends `/start`
  again.
- **Bot replies but no diary entries appear.** The client may have
  pressed **Make private** on those entries, or paused consent after
  an updated consent text (see above).
- **Wrong language in bot replies.** The bot takes its language from
  the client's Telegram app language when they first register
  (English, Russian, Spanish or Ukrainian; anything else falls back
  to English). There is no language command in the bot.
- **Voice or video note shows no text.** Transcription runs after the
  entry is saved; in `/history` it shows "[Transcribing...]" until it
  completes. Use the retry button on the entry in your dashboard if
  it failed.

## FAQ

**Q: Can the client edit an entry after sending it?**
A: No. The only control the bot gives is **Make private**, offered
right after the entry is saved.

**Q: Are diary entries encrypted?**
A: Yes. Every diary entry is Class-A data — encrypted at rest with
AES at the application layer.

**Q: What if the client sends a photo or document?**
A: Photos are only accepted as attachments to a progress report
started with `/report`; otherwise the bot explains that. Documents
are not handled as diary entries.

**Q: How much diary history does the client see in the bot?**
A: The `/history` command shows the client's last ten entries. Beyond
that, the therapist is the interface.

**Q: Does PR-TOP support Telegram group chats?**
A: No. The bot is designed for one-to-one direct-message chats only.
