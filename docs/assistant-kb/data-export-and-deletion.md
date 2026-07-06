<!-- audience: user -->
# Data export, GDPR requests, and deleting a client or account

PR-TOP is designed so a therapist — as the data controller for their
clients — can meet the export and deletion obligations of GDPR and
similar regimes without leaving the dashboard. This how-to covers
per-client export, whole-account export, deleting a single client,
and deleting your entire therapist account. Labels are drawn from the
`settings`, `client`, `subscription`, and `privacy` namespaces.

## Prerequisites

- Basic, Pro, or Premium tier for structured export in JSON/CSV. PDF
  export of a per-client summary is available on Pro/Premium.
- You must be the primary therapist on the client record (supervisors
  cannot export).
- For an account-level export, keep the browser tab open until the
  archive finishes assembling — very large accounts can take several
  minutes.

## Step-by-step: per-client export

1. Open the client page → **Export** button in the top-right.
2. Choose format:
   - **PDF** — human-readable progress summary. Includes charts,
     session summaries, exercise responses. Recommended for sharing
     with the client or supervisor.
   - **JSON** — machine-readable full export. Includes every field
     available in the client record: timeline, diary bodies,
     transcripts, AI summaries, exercise responses, mood ratings,
     SOS events, audit log.
   - **CSV** — flat tabular export split across a few files (one for
     diary entries, one for exercises, etc.).
3. Choose the date window: everything, last 12 months, last 90 days,
   or a custom range.
4. Confirm. The export runs in the background and appears in the
   Downloads section of your browser once ready (or emailed for
   large exports).

## Step-by-step: whole-account export

1. Open **Settings → Security → Data export**.
2. The archive contains every client (respecting consent flags),
   every session, every transcript, plus your therapist profile.
3. Choose JSON only (whole-account CSV is not offered).
4. Confirm. You will receive an email with a link once the archive
   is ready. The link expires in 7 days.

## Step-by-step: delete a single client

1. Open the client page → **Danger zone → Delete client**.
2. Confirm the client's display name in the confirmation modal —
   this prevents accidental deletion.
3. The client enters a **30-day recovery window**. During that time
   they appear in the archived-clients list and can be restored with
   one tap.
4. After 30 days the record is purged: diary entries, sessions,
   transcripts, AI summaries, exercise responses, and the Telegram
   binding are irrecoverably removed. Aggregate analytics for your
   practice are recomputed.
5. Audit-log entries covering the deletion itself are retained per
   the platform's audit retention policy — content is gone, but the
   fact-of-deletion timestamp is preserved for compliance.

## Step-by-step: delete your therapist account

1. Open **Settings → Security → Danger zone → Delete account**.
2. Type your email address in the confirmation field.
3. Confirm. Your account enters a **30-day recovery window** during
   which signing in restores everything.
4. All active clients are also placed into the same deletion timeline.
   Sharing therapists (if any) are notified.
5. After 30 days the account and all its data are purged.

## Handling GDPR-style requests from clients

- **Right to access (Article 15).** Use per-client JSON export and
  send it to the client via a secure channel of your choosing.
- **Right to portability (Article 20).** JSON export is the portable
  format. Include a short readme in the outbound package explaining
  the field names.
- **Right to rectification (Article 16).** Diary entries are editable
  by the client for 24 hours via the bot; beyond that you can edit on
  the dashboard. Private notes are the therapist's own record — the
  client cannot demand rectification of your notes but can request
  supplementation.
- **Right to erasure (Article 17).** Delete the client record. The
  30-day grace is a soft delete and does not prevent compliance — the
  final purge happens automatically at day 31.
- **Right to restrict processing (Article 18).** Turn off the
  diary-storage consent flag. New entries are refused; existing
  entries stay encrypted at rest until you decide otherwise.

## Edge cases

- **Very large exports.** Accounts with hundreds of sessions can
  produce >100 MB archives. These are delivered via a signed email
  link rather than an in-browser download. Links expire in 7 days.
- **Export mid-transcription.** Sessions that have not yet finished
  transcription export without their transcript. Re-export after
  transcription completes to include it.
- **Client asks for erasure while an SOS is open.** Resolve the SOS
  first (or archive as false alarm), then process the deletion. The
  platform blocks account deletion while unresolved SOS events exist.
- **Client on Trial data with unbilled quota.** Deleting a client
  releases the seat immediately regardless of billing state.

## Troubleshooting

- **PDF export fails silently.** Try a smaller window. Very long
  timelines occasionally exceed the PDF layout budget; JSON always
  works.
- **JSON export missing a session.** The session may still be
  transcribing. Wait for the activity feed's "transcription complete"
  event, then re-export.
- **Restore-from-grace grey button.** The grace has expired. Check
  the archive tab; if the row is gone the record has been purged.
- **Audit log still shows deleted client name.** By design.
  Audit-log entries preserve enough metadata to prove compliance;
  they do not contain diary content.
- **Whole-account export email never arrives.** Check spam. The
  link is one-time; if you already clicked it and lost the file,
  restart the export.

## FAQ

**Q: Does deleting a client delete the messages already on the
client's Telegram phone?**
A: No. Messages already sitting in Telegram's app on the client's
device remain there under Telegram's own retention policy. PR-TOP
deletion severs the binding and removes all platform-side data.

**Q: Are exports encrypted?**
A: The JSON archive is delivered over HTTPS and the download link is
signed and short-lived. If you need at-rest encryption of the file,
encrypt it locally before storing.

**Q: How long is the audit log retained?**
A: Audit-log entries are retained per the platform's compliance
policy (see security overview). Content is not part of the audit
log; deletion is fully honored for content while metadata proof of
action is preserved.

**Q: Can I export just a single session's transcript?**
A: Open the session page and use the **Download transcript** action.
It produces a small text or PDF file scoped to that one session.

**Q: Does exporting count as a data breach event?**
A: No — you as the data controller initiated it. The audit log
records the export event for your own records.

**Q: If I delete my account, will co-therapists lose the shared
clients too?**
A: Yes. Supervision shares are scoped to your client records; when
those records are purged, the supervisor's read view disappears
along with them.

**Q: Can I selectively delete just the transcripts and keep the
diary?**
A: Yes. Open each session page and delete only that session
(deletes transcript + AI summary + audio). Diary entries are stored
independently and are unaffected.
