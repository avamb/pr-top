<!-- audience: public -->
# Client-side bot commands and experience

This how-to describes what the client sees inside the PR-TOP Telegram
bot: which commands and buttons exist, how diary entries, exercises,
assignments and SOS behave, how session reminders look, and what the
client can and cannot do without the therapist's help. It is written
for the therapist so you can coach a new client through their first
week and troubleshoot when they say "the bot isn't working". Every
command and message described here exists in the bot today; anything
not listed (for example mood scores, streak counters or an in-bot
language switch) is not a feature of the bot.

## Prerequisites

- A connected client: the invite link or code has been used and the
  client has ticked the consent checkboxes (see the diary how-to for
  the consent flow).
- Familiarity with your own dashboard so you can cross-reference what
  the client sees with what actually landed on the platform.
- The client has Telegram installed and notifications enabled for the
  PR-TOP bot chat.

## What the client sees on first open

When the client taps **Start** on your invite link, the bot registers
them as a client, greets them in their language, and connects them to
you after the consent step. The bot picks its language from the
language set in the client's Telegram app at the moment of
registration: Russian, Ukrainian and Spanish are supported, and every
other Telegram language falls back to English. The bot has no command
for switching language afterwards.

The welcome message explains the three things the bot is for: the
thought diary (text, voice or video at any time), exercises from the
therapist, and the SOS button for urgent contact, and states that
data is encrypted. After connecting, the client gets a persistent
keyboard with six buttons: **Diary**, **Exercises**, **History**,
**SOS**, **Profile** and **Help**. The same actions are available as
slash commands.

## Commands the client can use

The "≡" menu in the chat lists these commands, with descriptions
translated into English, Russian, Spanish and Ukrainian:

- `/assignments` - list the homework you have set. Opening an
  assignment shows its description, report frequency and deadline, and
  offers **Write report** and **Mark complete** buttons.
- `/report` - start a progress report. With no argument the bot shows
  a picker of active assignments; `/report 12` arms the report for
  assignment 12 directly. The next text message or voice message is
  saved as the report. A photo sent right after you pick an assignment
  is attached to the report.
- `/exercises` - list exercises you have sent. Each one is labelled
  **New**, **In Progress** or **Completed**. Opening one shows the
  title, category and instructions with a **Start Exercise** button;
  after tapping it the client types the answer as a normal text
  message.
- `/sessions` - the last five sessions with the meeting date, an
  optional title you set and the processing status. Transcripts and
  summaries are never shown in the bot.
- `/history` - the client's last ten diary entries, with type icon,
  date in the client's own time zone, and the first 100 characters of
  the text or transcript.
- `/sos` - send a crisis alert (see below). The client can add a
  message after the command, for example `/sos I need to talk now`.
- `/profile` - shows name, phone and Telegram username, with **Edit
  Name** and **Edit Phone** buttons.
- `/timezone` - shows the current time zone and time; the client picks
  a region (Europe, Asia, Americas, Africa, Pacific/Oceania, or UTC)
  and then a time zone. Session reminders use this time zone.
- `/help` - the command list for the client's role.
- `/disconnect` - asks for confirmation, then revokes your access to
  the client's data and removes the link. The client can reconnect
  later with a new invite code.

Two more commands exist outside the menu: `/start` (register, check
status, or open an invite deep link) and `/connect CODE` (connect with
a therapist's invite code). The bot's own `/help` text for clients
lists start, help, profile, connect, exercises, sos, history, timezone
and disconnect.

## How diary entries work

There is no `/diary` command to type. Any plain text message that is
not a command and not an answer to an open exercise or report is saved
as a diary entry, and the bot replies **Diary entry saved!** The
**Diary** keyboard button only shows a hint explaining this.

- **Text:** saved as typed.
- **Voice messages, video messages and round video notes:** saved with
  the audio or video file, and the bot replies that the entry is saved
  and transcription is in progress. Transcription runs on the server;
  in `/history` an entry still waiting shows "[Transcribing...]", and
  once the text exists it is shown as a preview. If a transcription
  fails you can retry it from the diary entry on your dashboard.
- **Size limit:** Telegram lets bots download files of up to 20 MB.
  Bigger recordings are refused before download with a "file is too
  large" message asking for a shorter one.
- **Make private:** every saved entry comes with a **Make private**
  button. Pressing it hides that entry from you; the bot confirms
  that the therapist will not see it.
- **No editing in the bot:** the bot has no edit or delete option for
  entries once they are saved.

If the client has an exercise open, or has armed a report, the next
message goes to that exercise or report instead of the diary.

## SOS

`/sos`, or the **SOS** keyboard button, notifies you as part of the
agreed between-session protocol. It does not contact emergency
services, and the confirmation says so, listing the US 988 line and
findahelpline.com for immediate danger. SOS is never blocked by the
consent screen: the alert goes out first, and a pending consent update
is shown afterwards. If the platform could not reach you, the bot says
the alert was recorded but you may not have been notified and tells
the client to contact you directly. If the request itself fails, the
client gets a fixed message with the emergency numbers.

## Session reminders

If you enabled session reminders for a client, the bot can send
reminder messages with buttons: **Confirm**, **Reschedule** and
**Cancel slot**. The bot tells the client you have been informed.
Clients who have not yet answered the opt-in question are asked
**Yes, remind me** or **No thanks**.

## Step-by-step: coaching a new client's first week

1. Send the invite link from your dashboard (or the invite code, which
   the client enters as `/connect CODE`).
2. Ask the client to tick all six consent boxes and press **I agree
   and connect**.
3. Ask them to send one sentence as a diary entry. When the bot answers
   "Diary entry saved!", the binding works and you can see the entry
   in the client's diary.
4. Show them the **Make private** button so they know they control
   what you see.
5. Send a short exercise or assignment and ask them to try
   `/exercises` or `/assignments`.
6. Ask them to open `/timezone` once so reminders arrive at the right
   local time.

## Edge cases

- **The client writes a message while an exercise is open.** The
  message is taken as the exercise answer, not a diary entry. Open
  `/exercises` again to see what is open.
- **Photos outside a report.** If a client sends a photo without
  choosing an assignment first, the bot explains that photos can only
  be attached to a progress report and asks them to use `/report`.
- **Therapist accounts.** If you write to the bot from your therapist
  account, it reminds you to use the web dashboard. Therapists have a
  two-button keyboard (**Open dashboard** and **Help**) and can use
  `/settings` to turn forwarding of client voice and video diary
  messages to their own Telegram chat on or off.
- **Expired or old buttons.** Consent buttons last 30 minutes and do
  not survive a bot restart; the bot then asks the client to send
  `/start` again.
- **Consent revoked.** After a disconnect, an exercise answer typed
  later is not sent to you.

## Troubleshooting

- **Client says "the bot doesn't respond".** Check on your dashboard
  that the client is connected. Ask them to send `/start` or `/help`.
  If they muted the chat, they must unmute it in Telegram.
- **Diary entry not visible to you.** The client may have pressed
  **Make private**, or the client is not connected or has paused
  consent after an updated consent text.
- **Voice note shows no text yet.** Transcription is asynchronous;
  check again shortly or use the retry on the dashboard entry.
- **Wrong language in bot replies.** The language is fixed at
  registration from the Telegram app language and cannot be changed
  from inside the bot; contact support if it is wrong.
- **Exercises or reminders at odd hours.** Ask the client to check
  `/timezone`.
- **Recording rejected as too large.** Ask for a shorter recording
  (under 20 MB).

## FAQ

**Q: Can the client type without using a command?**
A: Yes. Plain text is saved as a diary entry, unless an exercise or
report is waiting for an answer.

**Q: Does the bot track streaks or mood scores?**
A: No. The bot has no streak, mood or progress commands. You see the
entries themselves on the dashboard.

**Q: Can the client edit or delete a diary entry in the bot?**
A: No. The client can only mark an entry private right after saving
it.

**Q: Are diary voice memos transcribed?**
A: Yes. Voice and video diary entries are sent for transcription
automatically after saving; you hear the original audio too.

**Q: How much history can the client open in the bot?**
A: `/history` shows the last ten diary entries and `/sessions` the last
five sessions.

**Q: Does the bot work in group chats?**
A: The bot is designed for one-to-one chats; group use is not
supported.
