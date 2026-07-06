<!-- audience: public -->
# Client management end-to-end

This how-to covers the complete lifecycle of a client record on PR-TOP:
inviting the person, watching the connection status flip when they open
Telegram, reading and searching their timeline, managing consent flags,
and archiving or deleting a record when work ends. Everything happens
under the `clientList`, `clientDetail`, and `client` i18n namespaces on
the dashboard.

## Prerequisites

- A therapist account with at least one client seat available on your
  plan. Trial gives you 3 seats, Basic 15, Pro 60, and Premium is
  unlimited. Each active client on your roster consumes one seat;
  archived clients do not.
- A Telegram account for the client, or their willingness to install
  Telegram on a phone. PR-TOP has no direct email or SMS diary channel
  — the client-facing interface is the Telegram bot.
- The client's informed, written consent to store diary entries and,
  if relevant, session recordings. PR-TOP enforces consent flags on
  every data-writing route.

## Step-by-step

### 1. Create the client record

1. From the sidebar tap **Clients**, then **New client**. The button is
   disabled if you have reached your plan's seat cap.
2. Enter a display name. A nickname or first-name-only is fine; PR-TOP
   never asks for the client's full legal name.
3. Optionally add a short private description ("weekly, work stress,
   Wed 5pm"). This is visible only to you.
4. Save. The system generates an invite code (short alphanumeric
   string) and a Telegram deep link of the form
   `https://t.me/<your-bot>?start=<code>`.

### 2. Invite the client

Share the deep link with the client over your normal secure channel
(the platform does not send it for you). When the client taps the link
and pushes **Start** in Telegram, the bot binds their Telegram user id
to your client record.

The client row on your dashboard flips from **pending invite** through
**binding** to **connected** within a few seconds. If it stays at
**pending invite** for more than an hour, resend the link.

### 3. Manage consent flags

Open the client and tap **Consent**. There are three independent flags:

- **Diary storage** — required for any diary entry to be saved.
- **Session recording** — required for session uploads and
  transcription; the upload button is disabled without it.
- **Supervision share** — required before you can generate a share
  link for a supervising colleague (Premium only).

Every flag change is logged in the client timeline with a timestamp
and the therapist who changed it.

### 4. Work with the timeline

The client's **Timeline** tab merges every event on the record in
reverse-chronological order: diary entries, uploaded sessions, AI
summaries, private notes, exercise assignments, exercise responses,
SOS alerts, and consent changes. Filters at the top let you narrow the
view by event type.

Vector search (Pro/Premium) lets you type a plain-language question
like "when did she first mention her sister" and jumps to the matching
entries.

### 5. Archive or delete

- **Archive** — hides the client from the active list, keeps all data
  encrypted at rest, and frees the seat for a new client. Reversible.
- **Delete** — permanently removes the client and all their data
  (diary entries, sessions, notes, transcripts) after a 30-day grace
  window during which you can restore from the archive. Deletion also
  unbinds the Telegram user and severs future messages from the bot.

## Edge cases

- **A client uses the same Telegram account for two therapists.** The
  bot supports multiple bindings per Telegram user; when the client
  sends `/switch` in Telegram they can flip between therapists.
- **The client changes Telegram accounts.** Generate a fresh invite
  from the client page and share the new link. The old binding remains
  in the audit log but stops receiving messages.
- **Consent is revoked mid-relationship.** Turning off "Diary storage"
  prevents new entries from being saved but does not delete past
  entries — for that, use the data-export/deletion flow.
- **Bulk import from another platform.** Basic and above expose a CSV
  bulk-import (see the `bulkImport` namespace) that creates skeleton
  client records without invite codes; each still needs the Telegram
  invite step manually.

## Troubleshooting

- **"Client seats reached" on New client.** Archive an inactive client
  or upgrade your plan. Trial → Basic gives 12 more seats, Basic → Pro
  gives 45 more, and Pro → Premium removes the cap.
- **Row stuck at "pending invite" after a day.** The link may have
  been forwarded and someone else consumed it. Generate a fresh one
  from the client page; the old code invalidates.
- **Consent toggle greyed out.** Some flags depend on plan: supervision
  share is Premium-only. The tooltip on the disabled toggle explains
  which plan is required.
- **Timeline missing an entry.** Confirm the entry exists on the
  Diary or Sessions tab. If the client edited it, the timeline shows
  the latest version; the older version is in the audit log.
- **Delete not offered.** Only the primary therapist who created the
  record can delete it. Co-therapists (via supervision share) have
  read-only access.

## FAQ

**Q: Can two therapists share a client on PR-TOP?**
A: Full co-ownership is not supported. Premium therapists can share a
read-only view via Supervision Share (`supervision` namespace) with a
colleague who has their own PR-TOP account.

**Q: Does the client see my private notes?**
A: No. Private notes live on the client page under a separate tab and
are never sent to the bot, transcribed, or included in any AI reply.

**Q: What happens to the client's Telegram data if I delete them?**
A: Deleting the client severs the bot binding and removes all
platform-side data (diary, sessions, notes) after the 30-day grace
window. Messages already delivered to the client's personal Telegram
history remain on Telegram servers under Telegram's own retention
policy.

**Q: Can I change a client's display name after the invite?**
A: Yes, at any time. The change is local to your dashboard; the client
sees only your therapist name on their side.

**Q: How do I move a client's data to another therapist account on
PR-TOP?**
A: Direct account-to-account transfer is not currently supported.
Export the client's data to JSON from the export flow, and have the
receiving therapist import it manually. Consent should be re-obtained
before the move.

**Q: How many pending invites can I keep open?**
A: Each unbound client seat counts as one open invite. There is no
extra limit on top of the seat cap; codes expire after 30 days if
never redeemed.

**Q: What does "connected" actually mean?**
A: The bot has bound the client's Telegram user id to your client
record. Bidirectional messages will now flow — you may receive diary
entries from them, and any exercises you assign will land in their
Telegram chat.
