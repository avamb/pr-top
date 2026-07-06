<!-- audience: user -->
# Analytics and mood trends

PR-TOP's analytics view turns the raw between-session activity
(sessions, diary entries, exercises, SOS alerts, mood scores) into a
handful of charts and summary numbers that make it easy to see how a
client — or your whole practice — is trending over time. This how-to
walks through what each chart shows, how to read it, and how to export
the underlying data. Labels come from the `analytics`, `dashboard`, and
`viewerAnalytics` i18n namespaces.

## Prerequisites

- Analytics as a top-level dashboard tab is available to every plan,
  but the tier-gated pieces (mood-trend sparklines on the dashboard,
  per-client comparative charts, and PDF/JSON/CSV export) require Pro
  or Premium.
- The client must have at least a handful of events for a chart to
  render — most charts need three data points in the window, otherwise
  they show an "not enough data" placeholder.
- Client-level analytics require the diary-storage consent flag. When
  consent is off, the analytics tab for that client shows only session
  counts and timestamps, not any content-derived metric.

## Step-by-step: reading the analytics view

1. **Open the client page → Analytics tab.** The default window is the
   last 30 days; use the range picker to widen to 90 days, 6 months,
   or 1 year.
2. **Read the summary strip at the top.** Four numbers: total sessions
   in window, total diary entries, average mood score (0–10, from
   entries where the client tagged a mood), and exercise-completion
   rate.
3. **Session cadence chart.** Bar chart with one bar per week. Gaps
   are visible at a glance; hover any bar for the exact session date
   and duration.
4. **Mood trend line.** A smoothed line of daily mood scores. The
   shaded band around the line is a rolling-week average — thick where
   scores are consistent, wide where they vary.
5. **Exercise engagement.** Stacked bar of assigned vs. completed vs.
   skipped exercises per week.
6. **SOS incidents.** Timeline of any SOS events with resolution
   status: open, acknowledged, resolved. Empty for most clients.
7. **Export.** The **Export** button (Pro/Premium) offers PDF, JSON,
   and CSV. PDF is meant for a client-facing progress summary; JSON
   preserves every field; CSV is easiest to open in a spreadsheet.

## Practice-wide analytics

The **Analytics** entry in the sidebar (not the per-client tab)
aggregates across your whole roster:

- **Active clients over time** — how many clients had at least one
  event per week.
- **New clients** — a bar per week of invites redeemed.
- **Session throughput** — count and total minutes uploaded per week,
  useful for spotting quota crunches before you hit them.
- **Diary volume** — total diary entries per week, useful for
  correlating advertising or seasonal load.
- **SOS incidents** across the practice — number and average
  resolution time.

## Edge cases

- **Client with no mood ratings.** The mood trend line is hidden;
  the summary strip shows a dash instead of a number. Encourage the
  client to use the `/mood` command in Telegram, which prompts an
  explicit 0–10 rating.
- **Very short windows.** In the 7-day window, the smoothed mood line
  becomes noisy; the platform automatically widens to 14 days if there
  is not enough data.
- **Client on Trial diary-only.** Transcription-derived analytics
  (session duration, topic trend) require Basic and above. On Trial
  you see session counts but not durations because manual notes don't
  have audio.
- **Time zones.** The analytics engine buckets days by the therapist's
  time-zone setting, not the client's. Change it under Settings →
  Profile.

## Troubleshooting

- **A chart says "not enough data" for a client I have known for
  months.** Widen the window with the range picker. If the client has
  been quiet, three data points in the window may not be there.
- **Mood scores look absurdly high or low.** The scale is 0–10, but
  the bot accepts 1–10, 0–100, and words like "meh" (mapped to 5).
  Open individual entries to check that mappings match the client's
  intent; adjust the client's diary command in Telegram if needed.
- **Export PDF is empty or short.** PDF export omits any chart that
  has "not enough data". If most charts fell into that bucket, widen
  the window before exporting.
- **Practice-wide chart clearly wrong for one week.** Confirm you
  have not just archived a batch of clients — the aggregate is over
  active clients only.
- **CSV opens as a single column in Excel.** The file uses UTF-8 with
  comma separators; Excel on Windows sometimes wants a semicolon. Open
  it with **Data → From Text/CSV** and choose comma.

## FAQ

**Q: Can the client see their own analytics?**
A: The Telegram bot exposes a simplified view via the `/progress`
command: a short streak count and their own mood trend. It does not
show the therapist-side charts or PDF export.

**Q: How is the "average mood" computed?**
A: It is the arithmetic mean of every explicit mood rating in the
selected window. Voice/text entries without an explicit rating are
excluded — the platform does not infer sentiment.

**Q: Why are analytics gated to Pro on the dashboard sparklines but
free on the per-client tab?**
A: The per-client tab is always visible so every therapist can review
individual history. The dashboard mood-trend strip is a
whole-practice cross-section that is more expensive to compute; that
is what Pro and Premium unlock.

**Q: Is there a way to compare two clients side by side?**
A: Not as a built-in chart. Export both to CSV and compare in a
spreadsheet, or use the natural-language query "compare mood trends
for X and Y over the last 90 days" on Pro/Premium.

**Q: Do exports contain the raw diary text?**
A: JSON export includes the encrypted-at-rest diary body (decrypted
at export time by your account key). PDF and CSV exports contain a
short summary of each entry, not the full body, so they are safer to
attach to a report.

**Q: Are analytics deleted when I archive a client?**
A: Archiving hides the client from the active list but keeps all
data — you can un-archive and the charts come back exactly as they
were. Deleting a client purges the raw data after 30 days, so the
per-client analytics disappear at that point. Practice-wide aggregates
are recomputed and the deleted client no longer contributes.

**Q: Does PR-TOP send analytics data to any third party?**
A: No. Analytics compute on your own encrypted store. Anonymous
front-end telemetry is served through the self-hosted Umami install
you can see under `/analytics/`.
