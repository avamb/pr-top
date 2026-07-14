<!-- audience: public -->
# Supervision sharing

Supervision share lets a therapist grant a supervising colleague
read-only access to a specific client's record — timeline, diary,
sessions, transcripts, AI summaries, exercise responses — for the
purpose of case consultation and supervision. It is available on
every plan. This how-to explains
what supervisors see and don't see, how to grant and revoke access,
and how consent interacts with sharing. Labels come from the
`supervision` and `supervisionShare` i18n namespaces.

## Prerequisites

- The supervising colleague does not need a PR-TOP account: the share
  is an opaque, expiring link, and the supervisor authenticates by
  possession of that link. Every access is recorded in the audit log.
- The client's **Supervision share consent** flag must be on. This is
  a separate consent from diary storage and session recording. The
  platform enforces it on every share.

## What the supervisor sees

When you grant a share, the supervisor's dashboard grows a new
sidebar entry: **Supervisees**. Under it, each shared client appears
as a read-only mirror of your own client page.

The supervisor sees:

- Client display name, timeline, diary entries, session recordings
  (playback), transcripts, and AI summaries.
- Exercise assignments and responses.
- The mood-trend and analytics charts.
- SOS events (with the resolution status).

The supervisor does NOT see:

- Your private notes on the client.
- Your other clients or any part of your dashboard.
- The client's Telegram binding tokens or the ability to send
  messages via the bot.
- Your Settings, subscription, or invoice history.

## Step-by-step: grant a share

1. Open the client page → **Supervision** tab.
2. Enable **Supervision share consent** if it is not already on. The
   platform logs the timestamp and shows a small note that this flag
   was flipped.
3. Tap **Invite supervisor**. Enter the supervisor's PR-TOP account
   email.
4. Choose a **share duration**: 7 days, 30 days, 90 days, or "until
   revoked".
5. Optionally add a **share note** (up to 500 characters) that
   appears on the supervisor's side, e.g. "Please review latest three
   sessions for transference discussion."
6. Send. The supervisor receives an email and an in-dashboard
   notification.

## Step-by-step: revoke a share

1. Open the client page → **Supervision** tab.
2. Every active share is listed with the supervisor's email, share
   date, and expiry.
3. Tap **Revoke** on the row. Access is severed immediately; the
   supervisor's sidebar entry for that client disappears within a
   minute.
4. Revocation is audit-logged so you have a record of exactly when it
   happened.

## Edge cases

- **Multiple supervisors on one client.** Up to three simultaneous
  supervisors are allowed per client. Add or revoke them independently.
- **Supervisor on the same practice.** Nothing prevents sharing with
  a colleague inside the same clinic; each account is still separate.
- **Client revokes consent.** Turning the supervision consent flag
  off automatically revokes all active shares for that client and
  writes an audit entry. Existing supervisor-side snapshots retained
  in the supervisor's browser cache clear on next refresh.
- **Supervisor downgrades to Trial.** They keep read access to shares
  they already hold, but cannot receive new shares while on Trial.

## Troubleshooting

- **Invite email never arrives.** Confirm the supervisor's PR-TOP
  account uses the email you typed. A supervisor with no PR-TOP
  account will receive an invite to sign up first.
- **Share does not appear on supervisor's dashboard.** They must be
  signed in to the account matching the invite email. Ask them to
  refresh the page.
- **Revoke did not clear immediately.** WebSocket lag can delay the
  supervisor's sidebar update by up to a minute. A hard refresh on
  the supervisor's side confirms.
- **Supervisor cannot open a session recording.** Session recordings
  stream through a signed-URL flow tied to the supervisor's session.
  If the URL expired mid-playback, refresh the page.
- **Share auto-expired unexpectedly.** Check the share duration you
  set at grant time. "Until revoked" is the only option that never
  auto-expires.

## FAQ

**Q: Can the supervisor download the client's data?**
A: Supervisors have read-only view access. They can view PDF
summaries produced by you, but bulk export (JSON/CSV) is disabled on
the supervisor side to reduce data-egress risk.

**Q: Are supervisor actions audit-logged?**
A: Yes. Every open of a diary entry, session, or transcript by a
supervisor is written to the audit log with the supervisor's account
id and timestamp. You can view the log from the client page →
Timeline → filter by "audit".

**Q: Can the supervisor add private notes?**
A: Supervisors can add notes visible only to themselves. Those notes
are not surfaced to the sharing therapist and not surfaced to any AI
context. The sharing therapist cannot see supervisor-authored notes.

**Q: Does the client know they are being supervised?**
A: Yes — the supervision consent flag exists so the client has
consented in advance. The bot's `/consent` command surfaces the
current state of all flags for the client at any time.

**Q: Can the supervisor become the primary therapist?**
A: There is no in-platform ownership transfer. If the primary
therapist is ending the relationship, they should export the client's
data and the new therapist creates a fresh client record with fresh
consent.

**Q: How many clients can I have shared at once?**
A: There is no explicit cap; the practical limit is client-consent
availability and supervisor bandwidth. Very large share counts (over
30 simultaneous) surface a small warning banner encouraging you to
audit the list.

**Q: Do supervisors count against my client seats?**
A: No. Supervisors have their own accounts and their own seats. A
share consumes neither party's seats.

**Q: What happens if the supervisor's account is deleted?**
A: All shares to that account are severed automatically. You will
see the row disappear from the Supervision tab of every affected
client.
