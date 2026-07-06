<!-- audience: public -->

# How to assign an exercise between sessions

PR-TOP ships with a small library of pre-seeded, multilingual
therapeutic exercises (EN, RU, ES, UK) that you can assign to a
client through the Telegram bot. Pro and Premium accounts can also
add custom exercises.

## Pick from the library

1. Open the client page and choose **Assign exercise**.
2. Browse the library by category (grounding, cognitive
   reframing, homework, journaling). Preview shows the client-side
   wording in the client's selected language.
3. Confirm. PR-TOP schedules a bot message that arrives on the
   client's Telegram at the time you chose (immediately or on a
   recurring cadence).

## Author a custom exercise (Pro / Premium)

1. Go to Exercises in the sidebar and choose **New exercise**.
2. Fill in the title, category, and short description.
3. Add at least one instructions field in the language(s) you offer
   sessions in — PR-TOP validates that at least one is present.
4. Save. The exercise now appears in the library, filterable by the
   custom tag.

## Follow up

When the client responds — text, voice, or video — the response
appears on the client's diary timeline under the exercise entry.
You can pin high-signal responses so they show up in the next
session's summary.

## Edge cases

- **Quiet hours.** Assignments scheduled inside the client's quiet
  hours are held and fire at the next allowed time.
- **Disconnected client.** Assigning an exercise before the client
  has redeemed the invite queues the delivery until the binding
  completes.
- **Recurring exercises.** The library supports a "repeat weekly"
  schedule; each week the exercise fires a fresh instance so
  responses stay separate.
- **Custom exercise, no translation.** If you did not supply
  translations, the auto-translation is best-effort and marked with
  a small "auto-translated" tag in the client's chat.

## Troubleshooting

- **Custom exercise button greyed out.** Custom exercises require
  Pro or Premium. The tooltip on the disabled button explains.
- **Assignment delivered but the client says they never saw it.**
  Confirm the Telegram binding is active. Ask the client to check
  the pinned bot chat and unmute if needed.
- **Wrong language.** The client's bot language comes from Telegram
  at first-connect; they can override with `/lang`.
- **Response truncated in the review card.** Long responses render as
  first ~600 chars with a "read full response" link. The full
  encrypted body is preserved.

## FAQ

**Q: How many built-in exercises ship by default?**
A: Around 60 across categories like Anxiety, Depression, Sleep,
Relationships, Values, Grounding, and Breathing — in all four
supported languages.

**Q: Can I edit a built-in exercise?**
A: Not in place. Duplicate it into a custom exercise (Pro/Premium)
and edit the copy.

**Q: Do exercise responses count against my sessions quota?**
A: No. Sessions quota applies only to uploaded session recordings.
Exercises are unlimited on every plan.

**Q: Can I assign an exercise to many clients at once?**
A: Yes. Multi-assign from the library sends independent copies to
each selected client; responses are stored separately.

**Q: Are custom exercises shared across therapists?**
A: They are scoped to your therapist account. Colleagues on PR-TOP
must create their own copy on their own account.

**Q: Do responses feed the analytics view?**
A: Completion counts feed the exercise-engagement chart;
mood-scale steps feed the mood-trend line.

**Q: Can I schedule an exercise weeks in advance?**
A: Yes. The schedule picker accepts a specific date and time up to
90 days out; the assignment is queued and delivered on the day.

**Q: What happens when a client skips an exercise?**
A: The status flips to skipped, the exercise appears in the
Assignments tab with a skip icon, and you can reassign later or
adjust the client's plan.

**Q: How long are exercise responses retained?**
A: For the life of the client record. Deleting the client purges the
responses along with the rest of their data (after the 30-day grace
window).

**Q: Can I include a photo or attachment in an exercise prompt?**
A: Text and multi-step prompts are text-only today. If you need to
share a worksheet, link it from your own storage in the prompt text.
