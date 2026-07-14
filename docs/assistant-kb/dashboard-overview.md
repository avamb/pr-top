<!-- audience: public -->
# Dashboard overview and a daily therapist workflow

The PR-TOP dashboard is the therapist's home screen: the first page you
land on after you sign in, and the surface from which every other
workflow (clients, sessions, exercises, analytics, settings) is one
click away. This how-to explains what each panel on the dashboard shows,
how the numbers are computed, and how to build a repeatable daily
routine around them so nothing about a client's between-session state
is missed.

## Prerequisites

- A signed-in therapist account. Trial, Basic, Pro, and Premium tiers
  all show the same dashboard layout, but some cards (analytics,
  natural-language queries, supervision share) are gated by plan.
- At least one client on your roster. A brand-new account with zero
  clients shows a large empty-state card instead of the activity feed;
  everything else on this page assumes you have working data.
- Notifications set up in Settings if you want SOS or Telegram-bind
  events to reach you outside the browser (see the settings how-to).

## What the dashboard shows

The dashboard is split into four vertical zones. The exact wording of
each label comes from the `dashboard` and `nav` i18n namespaces.

1. **Header stats.** Four small cards summarize your current state:
   active clients (from the `clientList` count), sessions this month
   (against your plan's session quota), pending diary entries you have
   not yet reviewed, and any open SOS alerts.
2. **Activity feed.** A reverse-chronological list of everything that
   happened on your accounts in the last 14 days: new diary entries,
   completed exercises, uploaded sessions, SOS alerts, client bindings,
   and consent changes. Each row links to the underlying object.
3. **Mood-trend strip** (Pro and Premium). A compact set of sparklines,
   one per client, that plots mood scores from diary entries over the
   last 30 days. Trial and Basic show a locked card that links to the
   pricing page.
4. **Assistant panel.** The signed-in assistant chatbox lives in the
   right rail. Ask it "how do I upload a session recording" or "where
   are exercises assigned" and it will answer with excerpts from this
   knowledge base. It does not have access to any client's diary or
   private notes.

## Step-by-step: a recommended daily workflow

The following routine takes 10–15 minutes if your roster is under 20
clients and scales linearly beyond that.

1. **Open the dashboard** and skim the header stats. If the sessions
   card shows you are within 10% of your plan quota, decide now whether
   to upgrade before you upload today's recordings.
2. **Clear the SOS card first**, always. If there is an open SOS alert,
   click it and follow the crisis-response how-to before touching
   anything else. Resolving the alert removes it from the header.
3. **Walk the activity feed top to bottom.** For each new diary entry,
   click through, read it, and add a short private note if it will
   inform your next session. For each completed exercise, tap the
   client row to see how they answered.
4. **Check the mood-trend strip** for anyone whose trend has clearly
   dropped in the last week. Open their client page and skim the
   timeline for context (new stressors, missed exercises).
5. **Review pending uploads.** If a session recording was uploaded
   overnight, its transcript may already be ready; open the session,
   confirm the AI summary matches your memory of the session, and
   promote key points into your private note.
6. **Close by planning next actions.** Assign one exercise per client
   who needs one, and reply to any diary entries you want the client
   to know you read (the client sees a small "read" marker in the bot).

## Edge cases

- **Very new accounts.** With zero clients, the activity feed shows
  a "Create your first client" onboarding card. The dashboard header
  reads zero across the board and mood trends are hidden.
- **Very large rosters.** The activity feed paginates at 50 rows per
  page. Use the search box in the top-right to filter by client name
  before scrolling deeper.
- **Plan downgrades.** If you downgrade from Pro or Premium to Basic
  mid-cycle, the mood-trend strip stays visible until the end of the
  billing period, then flips to a locked card. Your existing data is
  never deleted — only the read view is gated.
- **Language switching.** The language you chose on first login can be
  changed under Settings. All dashboard labels re-render immediately;
  historical numbers do not change.

## Troubleshooting

- **The header numbers look stale.** The dashboard uses a 60-second
  cache. Refresh the browser or wait a minute; if the numbers are still
  wrong after five minutes, open the Assistant panel and ask "why are
  my dashboard numbers stuck".
- **Activity feed shows an old event twice.** This happens when a
  diary entry is edited by the client after it was already delivered.
  The dashboard shows both the original and the edit; the client page
  timeline consolidates them.
- **Mood-trend strip missing on Pro.** The strip needs at least three
  diary entries with a mood score in the last 30 days for a given
  client. Clients with only text/voice diary and no explicit mood
  ratings are excluded.
- **Assistant panel refuses to answer.** The signed-in assistant is
  rate-limited per session and per plan. Wait a minute and retry. If
  the block persists, sign out and back in to refresh the session.
- **Session-quota card at 100%.** New session uploads are blocked
  until you either upgrade or the calendar rolls over to next month.
  Existing sessions are unaffected.

## FAQ

**Q: Can I customize the dashboard layout?**
A: Not in the current release. Every therapist sees the same four
zones. You can hide the assistant panel by clicking the collapse
handle; that preference is remembered per browser.

**Q: Is the activity feed real-time?**
A: New events push into the feed over a WebSocket connection while
the dashboard is open. If you leave the browser tab idle for more than
five minutes, refresh to reconnect.

**Q: Do co-therapists see the same dashboard?**
A: Every therapist has a fully independent dashboard scoped to their
own client roster. Supervision share grants a read-only view
of a specific client to a supervising colleague, not access to your
dashboard.

**Q: Can I export the dashboard as a report?**
A: The dashboard itself is not exportable, but the underlying data —
sessions, diary entries, exercises — can be exported from each client
page. See the "Data export and deletion" how-to.

**Q: What time zone are the numbers in?**
A: Timestamps in the activity feed render in your browser's local time.
"Sessions this month" is computed against your account time zone set
in Settings; if unset, the platform defaults to UTC.

**Q: My header stat "pending diary entries" never goes down. What
gives?**
A: An entry is only marked reviewed when you open it from the
activity feed or the client's Diary tab. Simply scrolling past it in a
list does not count. Open the entry to clear the pending flag.
