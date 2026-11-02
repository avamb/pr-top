<!-- audience: public -->
# Supervision sharing

Supervision sharing lets a therapist show one client's history to a
supervisor or a consulting colleague without handing over a password.
You generate a read-only link for that client, send it to the
supervisor through a channel you trust, and the supervisor opens it in
any browser. The supervisor does not need a PR-TOP account. Every link
expires automatically, can be revoked at any time, and stops working on
its own as soon as the client withdraws consent or is no longer your
client. This page explains how to create and revoke links, exactly what
the supervisor sees and does not see, and how the link reacts to
changes on the client's side. Labels come from the `supervision` i18n
namespace.

## Prerequisites

- The client must be linked to you (connected through your invite code
  or deep link, or added by you) and must currently have **therapist
  access consent** granted. PR-TOP uses the same consent flag here that
  protects the rest of the client page: if the client has not granted
  consent, or has withdrawn it, a link cannot be created and existing
  links stop working.
- Your account needs an active subscription or an active trial, like
  every other action on the client page.
- The supervisor needs nothing except the link. Treat the link like a
  password: whoever holds it can open the view until it expires or is
  revoked.

## Step-by-step: create a share link

1. Open the client page from **Clients**.
2. In the header, tap **Share for supervision** (next to **Export All
   Data**). The **Share for supervision** window opens.
3. Under **Create new share link**, choose the **Link lifetime**:
   **1 day**, **7 days** (the default) or **30 days**. There is no
   unlimited option; pick the shortest lifetime that covers your
   supervision meeting.
4. Leave **Anonymize client identity** on (the default) if the
   supervisor should not see who the client is. With anonymization on,
   the client's name is replaced with "Client A", and email addresses
   and phone numbers inside the shared text are replaced with
   "[email redacted]" and "[phone redacted]". Names or other details
   written in free text are not detected, so review what the sessions
   and diary contain before sharing.
5. Optionally fill in **Internal note (optional)**, up to 500
   characters, for example "Oct supervision with Dr. Ivanov". The note
   is shown on the supervisor's overview as the therapist's note, so do
   not put anything there the supervisor should not read.
6. Tap **Create share link**. The new link appears under **Existing
   share links**. Tap **Copy** and send the URL to your supervisor.

## What the supervisor sees

The link opens a read-only page with five tabs:

- **Overview**: counts of sessions, diary entries, inquiries and shared
  notes, plus your note if you wrote one.
- **Sessions**: your sessions with this client, each with its date,
  status, AI summary and (under "Show transcript") the transcript text.
- **Diary**: the client's diary entries as text, including the
  transcripts of voice and video entries.
- **Inquiries**: the work threads you track for this client, with title,
  description and status.
- **Shared notes**: comments on the client marked as shared, written by
  you or by the client.

The view is a snapshot in time. It only contains records that already
existed when you created the link. A session, diary entry, inquiry or
shared note created after that moment never appears in the link, even
while the link is still valid. An inquiry or shared note that was edited
after you created the link is left out of the link as well. If you want
the supervisor to see newer material, create a new link. (A session that existed when you created
the link is shown with its current summary and transcript, so a summary
finished later for that session does appear.)

## What the supervisor never sees

- Diary entries the client marked as private in the bot.
- Your private comments and private notes.
- Raw audio or video files: only text is shared.
- SOS event details.
- Your other clients, your dashboard, settings or billing.
- With anonymization on, the client's name.

## Step-by-step: revoke a link

1. Open the client page and tap **Share for supervision**.
2. Under **Existing share links**, each link shows its status
   (**Active**, **Expired** or **Revoked**), when it was created, when
   it expires, and how many times it was opened (**Accessed**).
3. Tap **Revoke** on the link and confirm. Anyone holding the URL loses
   access on their next page load.
4. Revocation is recorded in the audit log.

## When a link stops working by itself

Every time the link is opened, PR-TOP checks again that sharing is still
allowed. The link stops working and is marked **Revoked** in your list
when any of these happens:

- The client withdraws therapist access consent.
- The client disconnects from you or moves to another therapist.
- The client's account no longer exists.
- Your own account is blocked.

An automatic revocation is written to the audit log with the reason. A
revoked link stays revoked: if the client grants consent again or
reconnects, the old link does not come back. Create a new link instead.
Links also stop working when their lifetime runs out; those show as
**Expired**.

## Edge cases

- **Several links for one client.** You can create more than one link,
  for example one per supervisor, each with its own lifetime and note.
  Revoking one does not affect the others.
- **Anonymized and named links side by side.** Each link keeps its own
  anonymization setting; it cannot be changed after creation. Create a
  new link with the other setting and revoke the old one.
- **The client marks an entry private after you shared.** Private
  entries are filtered out every time the link is opened, so the entry
  disappears from the supervisor's view.

## Troubleshooting

- **Supervisor sees "Share link not available".** The link was
  revoked, expired, or stopped working automatically (see above). Open
  **Share for supervision** to check its status and create a new link
  if sharing is still appropriate.
- **"Client has not granted consent for data access" when creating a
  link.** The client has not granted, or has withdrawn, therapist access
  consent. Sharing is not possible until the client grants it again in
  the bot.
- **New sessions are missing from the supervisor's view.** The link only
  contains records created before the link. Create a fresh link.
- **The diary tab is shorter than your own view.** Private diary entries
  and entries created after the link are excluded by design.

## FAQ

**Q: Does the supervisor need a PR-TOP account?**
A: No. The link itself is the access key. It is a long random token, so
it cannot be guessed, but anyone you forward it to can open it.

**Q: Can I see whether the supervisor opened the link?**
A: Yes. Each link shows an **Accessed** counter, and every opening is
written to the audit log.

**Q: What happens if my client withdraws consent while a link is
active?**
A: The link stops working the next time anyone opens it and is marked
**Revoked**. Re-granting consent later does not reactivate it.

**Q: Can the supervisor download or edit anything?**
A: No. The page is read-only and has no download or export function.

**Q: How long can a link live?**
A: 1 day, 7 days or 30 days, chosen when you create it.

**Q: Does anonymization make the content fully anonymous?**
A: No. It hides the client's name and redacts email addresses and phone
numbers. Other identifying details in session or diary text are shown
as written.

**Q: Does sharing cost anything or depend on my plan?**
A: No extra cost. Supervision sharing is available on every plan,
including the trial, while your subscription or trial is active.
