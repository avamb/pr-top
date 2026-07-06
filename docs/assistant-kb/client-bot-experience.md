<!-- audience: user -->
# Client-side bot commands and experience

This how-to describes what the client sees inside the PR-TOP Telegram
bot: which commands are available, how streaks and reminders behave,
how to read message-delivery status, and what the client can and
cannot do without the therapist's help. It is written for the
therapist so you can coach a new client through their first week and
troubleshoot when they say "the bot isn't working". Labels come from
the `client`, `diary`, `reminders`, and `exercise` i18n namespaces.

## Prerequisites

- A connected client (invite redeemed, binding complete).
- Familiarity with your own dashboard so you can cross-reference what
  the client is seeing to what actually landed on the platform.
- The client has Telegram installed, notifications enabled for the
  PR-TOP bot chat, and the language set to one of EN/RU/ES/UK.

## What the client sees on first open

After the client taps **Start** on the invite link, the bot introduces
itself in the client's Telegram language, confirms the therapist name
they are connected to, and shows a persistent menu of commands. The
introduction states that the therapist has read-access to diary
entries and reminds the client that the SOS button is available at
any time.

## Commands the client can use

- `/diary` — start a new diary entry. Follow-up prompt accepts text,
  voice memo, or a short video message. Attachments are limited to
  20 MB per single item.
- `/mood <0–10>` — record an explicit mood rating. Accepts numeric
  scores, "meh"/"okay"/"good" words (mapped to 3/5/7), and multiple
  languages.
- `/exercise` — open the next assigned exercise if one is waiting.
- `/sos` — trigger a crisis alert. See the crisis how-to.
- `/streak` — show the current diary streak. Streaks are calendar-day
  counters that reset if the client misses a day.
- `/reminders` — set or clear a nightly diary reminder. Default is a
  soft nudge at 21:00 in the client's Telegram time zone.
- `/consent` — read the current consent-flag state and open a link
  back to the therapist for changes.
- `/lang <en|ru|es|uk>` — switch the bot's language.
- `/switch` — for clients working with multiple PR-TOP therapists,
  flip between binding targets.
- `/help` — show the full command list plus a link to a short client
  FAQ.

The commands are also available via a persistent menu button in the
chat, so the client rarely has to type them.

## Streaks and reminders

- A **streak** is the number of consecutive calendar days on which
  the client sent at least one diary entry or completed at least one
  exercise. Streaks are stored per-client and displayed with a small
  celebration message on multiples of 7 days.
- **Reminders** default to a single nightly nudge. The client can
  change the time under `/reminders`, or turn them off entirely.
  Quiet hours defined by the therapist override reminders (nothing
  fires during quiet hours).
- Missed days do not reset the streak until midnight in the client's
  time zone. If the client sends an entry across midnight, the entry
  is credited to the day the message left their phone.

## Step-by-step: coaching a new client's first week

1. On day one, send them the invite link and a short "here is what
   the bot will ask" message with the diary and exercise commands.
2. Ask them to try `/diary` right away with one sentence — this
   confirms the binding works end-to-end.
3. Turn on `/reminders` (either you show them or ask them to turn it
   on themselves). A gentle nightly nudge dramatically improves
   between-session engagement.
4. Later that week assign a short grounding or values exercise; watch
   for the completion in your dashboard.
5. On the first full session after connecting, review the streak and
   celebrate progress with the client. This normalizes the tool as
   part of the therapy, not a chore.

## Edge cases

- **Client has muted the Telegram bot.** Streaks continue to count,
  but the client will not see reminders. The dashboard cannot detect
  a mute — ask the client if their engagement drops off suddenly.
- **Client switches phone or Telegram number.** The Telegram user ID
  is the binding key. A phone-number change alone does not affect
  binding; a new Telegram account does — regenerate the invite.
- **Very long voice memo.** Voice memos are transcribed only in
  session uploads, not in diary entries. Long diary voice notes are
  stored as-is and shown to the therapist as an audio player.
- **Client using the same Telegram in multiple therapies.** `/switch`
  presents a picker; the client's diary is scoped per binding, so
  entries never cross-contaminate.

## Troubleshooting

- **Client says "the bot doesn't respond".** Confirm the bot binding
  is active on your dashboard. If it is, ask the client to tap the
  bot's profile → **Restart** to re-enable a muted chat.
- **Streak reset unexpectedly.** Check the client's Telegram time
  zone. A daylight-saving transition can nudge the midnight boundary.
- **Wrong language in bot replies.** The bot picks the language from
  the Telegram-language field at first-connect; the client can
  override with `/lang`. Language changes take effect on the next
  message.
- **Client says exercises never arrive.** Assignments are held during
  the client's quiet hours; they fire at the next allowed time. If
  the client turned off reminders, exercises still fire but without
  a nightly nudge to remind them to open the app.
- **`/consent` shows the wrong state.** Consent flags are managed on
  the therapist side. Update the flag on the dashboard client page
  and the bot will report the new state on the next `/consent`.

## FAQ

**Q: Can the client type without using a command?**
A: Yes. Free-form messages are treated as diary text by default. The
bot occasionally asks a clarifying question ("Save this as diary or
just chat?") so the client stays in control.

**Q: Does the bot reply with AI-generated content to diary entries?**
A: The bot sends a short acknowledgement and, on Pro/Premium, an
optional reflection prompt. It never provides diagnostic or clinical
content — the therapist remains the source of therapeutic input.

**Q: Can the client edit or delete a diary entry?**
A: Yes. Every diary entry has an inline edit and delete affordance
in the bot for 24 hours after sending. After that, deletion requires
asking the therapist to purge the entry on the dashboard.

**Q: Can the client see analytics about themselves?**
A: `/progress` in the bot shows a simplified view: streak, mood trend
sparkline, and completed-exercise count. Detailed analytics stay on
the therapist side.

**Q: Are diary voice memos transcribed?**
A: Not automatically for diary entries — the raw audio is stored so
the therapist hears the client's voice. Session recordings uploaded
through the dashboard are transcribed (Basic and above).

**Q: How much history can the client access via the bot?**
A: The bot shows the last 30 days of the client's own entries via
`/history`. Beyond that, the therapist is the interface — the client
can request a data export through the therapist.

**Q: Does the bot work in group chats?**
A: The bot is designed for one-to-one direct-message chats. Adding
it to a group chat is not supported and may fail silently.
