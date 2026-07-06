<!-- audience: public -->

# How the crisis / SOS channel works

PR-TOP includes a one-tap crisis trigger inside the Telegram bot so
a client in acute distress can reach you between sessions. This
how-to explains the flow from the client's tap to your response and
the lifecycle tracking that keeps you accountable.

## Client side

The Telegram bot has a persistent **SOS** button. Tapping it:

1. Asks the client to confirm (a mis-tap safety net).
2. Sends an immediate acknowledgement message with your configured
   crisis-line contact and, if enabled, national emergency numbers
   in their locale.
3. Opens a text field for optional context ("what is happening").

## Therapist side

PR-TOP notifies you across every channel you have configured:

- Real-time dashboard alert (WebSocket, red banner).
- Email to your account address.
- Optional SMS or push notification, depending on your settings.

The alert opens the client's SOS lifecycle timeline. From there you
can mark states: *Acknowledged*, *Contacted*, *Resolved*, or
*Escalated to emergency services*. Every state change is stored in
the audit log with a timestamp.

## Coverage and expectations

PR-TOP is NOT a substitute for emergency services. The bot always
reminds the client to call local emergency numbers if life is at
risk. Set expectations up front with each client about your
response window — PR-TOP surfaces your configured window inside the
client's bot session.

## Edge cases

- **Repeated SOS in a short window.** Each SOS is its own event. The
  dashboard groups them by client with a running count so you can
  keep track of severity.
- **False alarm / mis-tap.** Acknowledge and resolve normally with
  "false alarm" as the reason. The client sees a friendly
  acknowledgement, which is often reassuring.
- **You are off-shift.** Configure an alternate SOS routing address
  in Settings → Notifications during covering hours; the primary
  dashboard still shows the incident.
- **Client is a minor.** Escalate per your local policy using the
  guardian contact you hold outside PR-TOP; document escalation as a
  private note on the incident.

## Troubleshooting

- **No email arrived.** Confirm your alert email in Settings →
  Notifications. Multichannel SOS delivery (email + Telegram + push)
  is Premium; other tiers rely on in-dashboard push.
- **SOS card missing from the dashboard.** The WebSocket connection
  may have dropped. Refresh the page to reconnect.
- **Resolve button greyed out.** The incident must be acknowledged
  first — tap Acknowledge then Resolve.
- **Wrong crisis line shown to the client.** The bot picks by
  Telegram-language field. Ask the client to run `/lang <en|ru|es|uk>`
  and future SOS replies will use the corrected locale.

## FAQ

**Q: Does PR-TOP contact emergency services on my behalf?**
A: No. PR-TOP is therapist-controlled. All emergency escalations are
done by you or the crisis line the client contacts.

**Q: Who can see an SOS event?**
A: The primary therapist and any supervisor with active supervision
share on that specific client. Admins see aggregate counts only.

**Q: Are SOS messages retained forever?**
A: Retained for the life of the client record. Deleting the client
purges the SOS body along with the rest of their data.

**Q: Can the client cancel an SOS?**
A: The event is logged permanently. The client can send a follow-up
"false alarm" message; you resolve with the appropriate reason.

**Q: Are SOS events included in AI summaries?**
A: They appear in the timeline and analytics but are not
auto-included in session summaries. Natural-language queries can
surface them explicitly ("any SOS in the last month").

**Q: Can I disable SOS for one client?**
A: The command itself remains available for the client, but you can
mute therapist-side notifications per-client in the client's
Notifications settings if clinically appropriate.
