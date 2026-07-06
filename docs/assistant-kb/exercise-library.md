<!-- audience: user -->
# Exercise library: assigning, creating custom exercises, and
# reviewing responses

PR-TOP ships a built-in library of between-session exercises
(breathing, grounding, thought records, values clarification, sleep
hygiene, and more) in every plan tier. Pro and Premium therapists can
also author their own custom exercises. This how-to covers the full
loop: finding an exercise, assigning it to a client, watching the
client complete it in Telegram, and reviewing responses. Labels come
from the `exercise`, `exerciseLibrary`, and `assignment` i18n
namespaces.

## Prerequisites

- The built-in library is available on every plan. Custom exercises
  are Pro and Premium.
- The client must be in the **connected** state (Telegram bound) for
  assignments to deliver.
- Diary-storage consent must be on for the client's exercise
  responses to be saved; without it, the client can still complete an
  exercise but the response is not persisted.

## Step-by-step: assigning a built-in exercise

1. **Open the client page → Exercises tab**, or use the shortcut on
   the client's Timeline entry ("Assign exercise").
2. **Browse the library.** Filters at the top let you narrow by
   category (Anxiety, Depression, Sleep, Relationships, Values,
   Grounding, Breathing) and by language. Every built-in exercise
   ships in EN/RU/ES/UK.
3. **Preview.** Tap any card to read the full prompt and expected
   response format (short text, multi-step form, or a mood scale).
4. **Assign.** Tap **Assign to client** and pick a delivery time:
   immediately, tomorrow morning, or a specific date/time. The
   platform enforces the client's own quiet hours (see the client's
   settings) before delivering.
5. **Confirm.** The exercise appears in the client's Telegram chat at
   the chosen time as a friendly prompt, in the client's chosen bot
   language.

## Step-by-step: creating a custom exercise (Pro/Premium)

1. **Open Exercise Library → New custom exercise.** The button is
   disabled on Trial and Basic.
2. **Choose the response type:**
   - **Short text** — one open response.
   - **Multi-step** — up to five prompts in sequence.
   - **Mood scale** — a 0–10 rating with optional text.
3. **Write the prompt(s).** English is required. The platform will
   auto-translate to the client's language at delivery time; you can
   also supply hand-written translations if you prefer.
4. **Set a title and category.** Categories help you find the
   exercise later; they are not visible to the client.
5. **Save.** The exercise now appears in your library filter
   ("Custom") for assignment to any of your clients.

## Step-by-step: reviewing responses

1. **Open the client page → Exercises tab → Assignments.**
2. Each row shows the assignment status: **queued**, **delivered**,
   **completed**, or **skipped**.
3. Tap a completed row to read the client's response verbatim
   (encrypted at rest, decrypted at read time). Multi-step responses
   render as a small form.
4. Add a private note if the response calls for follow-up in your
   next session.
5. Reply from the reviewer to reinforce or clarify (the reply lands
   in the client's Telegram as a therapist message).

## Edge cases

- **Client on quiet hours.** Assignments scheduled during the client's
  quiet hours are held and delivered at the next allowed time.
- **Client on trial and disconnected.** Assigning an exercise to a
  client who is not yet connected succeeds and queues the delivery.
  The exercise will fire the moment the Telegram binding completes.
- **Custom exercise in English only.** If you did not supply
  translations, the auto-translation is best-effort and marked with a
  small "auto-translated" tag in the client's chat.
- **Recurring exercises.** The library supports a "repeat weekly"
  schedule via the assignment picker; each week the exercise fires a
  fresh instance so responses stay separate.

## Troubleshooting

- **Custom exercise button greyed out.** Custom exercises require Pro
  or Premium. The tooltip on the disabled button says so.
- **Assignment delivered but client says they never saw it.** Confirm
  the client's Telegram binding is active on the client page. Ask the
  client to open Telegram and look for a pinned "PR-TOP" chat; some
  phones mute unknown-bot notifications by default.
- **Response is truncated.** Very long responses (over ~4,000
  characters) are stored in full; the review card only shows the
  first ~600 chars, with a "read full response" link.
- **Wrong language in the prompt.** The client's bot language is
  driven by their Telegram-language field at first-connect. The
  client can override with the `/lang` command in Telegram.
- **Cannot delete a custom exercise that is currently assigned.** The
  exercise stays in the library until the last outstanding assignment
  completes or is cancelled. Cancel or wait, then delete.

## FAQ

**Q: How many built-in exercises are shipped by default?**
A: Around 60 exercises across the six categories, in all four
supported languages. New exercises are added periodically and appear
in your library automatically.

**Q: Can I edit a built-in exercise?**
A: You cannot edit it in place, but you can duplicate it into a
custom exercise (Pro/Premium) and edit the copy.

**Q: Can clients decline an exercise?**
A: Yes. In Telegram the client can tap "Skip" or ignore the prompt.
Skipped exercises are logged; the assignment status flips to
**skipped**. You can re-assign the same exercise later.

**Q: Do exercise responses count against the sessions quota?**
A: No. Sessions quota applies only to uploaded session recordings.
Exercise assignments and responses are unlimited on every plan.

**Q: Can I assign the same exercise to many clients at once?**
A: Yes. From the library, tap the exercise card, then **Multi-assign**
and pick clients from your roster. Each client receives their own
assignment instance and responses are stored independently.

**Q: Are custom exercises shared across therapists in a practice?**
A: Custom exercises are scoped to your therapist account. If a
colleague on PR-TOP wants the same custom exercise, they must create
their own copy on their own account.

**Q: Can I include a follow-up mood rating with any exercise?**
A: Yes. When you set a custom exercise up, add a mood-scale step at
the end. Built-in exercises with "mood rating" in the category do
this by default.

**Q: How are exercise responses treated for the analytics view?**
A: Completion counts appear in the exercise-engagement chart on the
Analytics tab; mood-scale responses feed the mood-trend line.
