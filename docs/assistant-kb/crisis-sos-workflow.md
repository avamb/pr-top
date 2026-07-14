<!-- audience: public -->
# Crisis / SOS therapist-side workflow

The SOS system is the highest-priority signal path in PR-TOP. When a
client taps the SOS command in Telegram, the platform fires an alert
to every notification channel you have configured and pins the event
on your dashboard until it is resolved.

**Important framing:** the SOS command is part of the agreed
between-session protocol you establish with each client before they
connect. It is a direct notification to you, their therapist — not a
call to emergency services or a crisis hotline. The bot always
reminds the client to call local emergency services if life is
immediately at risk, but PR-TOP itself remains your clinical
communication channel, not a substitute for 911 or local equivalents.

This how-to walks a therapist through what happens on receipt of an
alert, how to respond inside PR-TOP, and how to mark the incident
resolved. Labels come from the `notifications`, `security`, and
`dashboard` namespaces.

## Prerequisites

- SOS alerts are delivered on every plan. Which channels fire —
  email, Telegram-to-therapist, in-dashboard push — is controlled by
  your escalation preferences in Settings → Notifications, not by
  your subscription tier.
- The client must have been briefed that the SOS command exists and
  what it does — specifically that tapping it notifies you as their
  therapist within your agreed protocol, and does not contact
  emergency services on their behalf. The bot's `/help` output
  includes a short explanation in the client's language.
- Your notification preferences (Settings → Notifications) must be
  configured with at least an email address.

## What the client experiences

The client sends `/sos` in Telegram, or taps the pinned SOS button on
the bot menu. The bot immediately:

1. Confirms the SOS was received.
2. Sends region-appropriate crisis-line phone numbers based on the
   client's locale (English defaults if unknown).
3. Encourages the client to reach out to the therapist directly and
   to call a crisis line.

The client's message and the bot's reply are logged as an SOS event.

## Step-by-step: therapist-side response

1. **Notification arrives.** You receive an email with subject
   "PR-TOP SOS — <client display name>" and a push notification in the
   dashboard tab (via WebSocket). If Telegram-to-therapist is turned
   on, your Telegram also chimes.
2. **Open the dashboard.** The SOS card in the header stat strip
   shows a red badge with the count of open incidents. Tap it.
3. **Read the incident card.** It shows the client, timestamp, the
   verbatim message the client sent with the SOS, and the bot's
   response.
4. **Acknowledge.** Tap **Acknowledge**. This marks the event as
   "acknowledged" so any co-therapist or supervisor knows it is being
   handled and a timestamp is written to the audit log.
5. **Respond in Telegram.** Use the "Reply in Telegram" button to jump
   into the client's chat with a therapist message. Common flows:
   send a short check-in ("I am here, are you safe right now?"),
   offer a call, or share a specific crisis-line link.
6. **Coordinate off-platform if needed.** Some jurisdictions require
   escalation to emergency services. Use the phone contact you have
   on file and document the call in a private note attached to the
   SOS event.
7. **Mark the incident resolved.** Once the acute risk is de-escalated
   and follow-up is scheduled, tap **Resolve** on the event card and
   pick a resolution reason (client safe, client hospitalized,
   escalated to emergency services, other). Add a brief note. This
   clears the red badge.

## Edge cases

- **Repeated SOS in a short window.** Each SOS is its own event, but
  the dashboard groups them by client and shows a running count on
  the incident card so you don't lose the thread.
- **False alarm.** Clients occasionally hit the SOS button by
  accident. Still acknowledge and resolve; the client sees a small
  "acknowledged" reply from the bot, which is often reassuring.
- **Client is a minor.** If your practice has legal-guardian
  contacts on file (outside PR-TOP), escalate per your local policy.
  Document the escalation as a private note on the incident.
- **You are off-shift.** Set an out-of-office in Settings →
  Notifications to route SOS alerts to a covering colleague's email
  during specified hours. The SOS card on the primary dashboard still
  shows the incident so nothing is lost.

## Troubleshooting

- **No email arrived.** Check your spam folder and confirm the email
  address in Settings → Notifications is correct, and that email is
  enabled in your SOS escalation preferences. Email delivery works on
  every plan.
- **SOS card missing from the dashboard.** Refresh the tab. The
  WebSocket connection sometimes drops on network changes; a
  page-refresh reconnects it.
- **Resolve button greyed out.** The incident must be acknowledged
  first. If you skipped that step, tap Acknowledge and then Resolve.
- **Cannot reply in Telegram.** Confirm the client's Telegram binding
  is still active on the client page. If they revoked the bot, the
  reply button is disabled with a tooltip explaining why.
- **Wrong crisis line shown in the client's bot chat.** The bot picks
  from a table keyed by the client's Telegram-language field. Ask the
  client to set `/lang <en|ru|es|uk>` in Telegram to correct it;
  future SOS replies will use the corrected locale.

## FAQ

**Q: Can the client cancel an SOS after sending it?**
A: The event is logged permanently — cancellation is not offered
because clinically we do not want to erase a moment of crisis. The
client can, however, follow up with a "false alarm" message and you
resolve with the appropriate reason.

**Q: Are SOS messages included in AI summaries?**
A: SOS events appear in the client timeline and analytics. The AI
summary of a session does not automatically pull SOS messages into
its narrative, but an NL query like "any SOS in the last month" will
surface them.

**Q: Who else can see an SOS event?**
A: Only the primary therapist and any supervisor who has been granted
supervision share on that specific client. Admins can see aggregate
counts on the platform admin dashboard but not the message body.

**Q: What if I do not resolve an SOS event?**
A: Unresolved events stay pinned on the dashboard indefinitely and
count in the header badge. Weekly the platform re-emails you a
digest of unresolved incidents for continued awareness.

**Q: Can I disable SOS for a specific client?**
A: The command cannot be disabled for the client, but you can turn
off the therapist-side notification per-client under the client's
Notifications settings if a specific client has clinically justified
reasons to not trigger alarms (rare — discuss with a supervisor).

**Q: Does PR-TOP contact emergency services on my behalf?**
A: No. PR-TOP is a therapist-controlled platform. All emergency
escalations are performed by you or, where required, by the crisis
line the client contacts.

**Q: How long is the SOS message retained?**
A: For the life of the client record. Deleting the client purges
the SOS message body along with the rest of their data (after the
30-day grace window). Aggregate incident counts remain in analytics.
