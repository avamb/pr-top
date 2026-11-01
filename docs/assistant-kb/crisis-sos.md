<!-- audience: public -->

# How the crisis / SOS channel works

PR-TOP includes a one-tap crisis trigger inside the Telegram bot so
a client in acute distress can reach you between sessions. The SOS
command is part of your pre-agreed between-session protocol with
the client — it is a direct notification to you, their therapist,
not a call to emergency services or a crisis line. This how-to
explains the flow from the client's tap to your response and the
lifecycle tracking that keeps you accountable.

## Client side

The Telegram bot has a persistent **SOS** button. Tapping it:

1. Sends the alert straight away. There is no confirmation step, and
   the SOS is never held back by a pending consent update: if the
   consent text changed since the client last agreed, the bot sends
   the SOS first and only afterwards shows the re-consent prompt.
2. Replies with a confirmation that the therapist has been notified,
   plus a helpline number for the client's language (USA 988, Russia
   8-800-2000-122, Spain 024, Ukraine 7333, and findahelpline.com
   for other countries).
3. Accepts optional context typed after the command, for example
   `/sos I need to talk tonight`. The SOS button sends the alert
   without a message.

Two less common replies exist. If PR-TOP recorded the alert but could
not confirm that any notification reached you, the bot tells the
client that the therapist may not have been notified and asks them to
contact you directly or call emergency services. If the alert could
not be sent at all, the bot says so, repeats the same helpline
numbers, and asks the client to try again or call emergency services.
The bot never shows the client a raw technical error in this flow.

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
  Notifications and make sure email is enabled in your SOS escalation
  preferences. Multichannel delivery (email + Telegram + push) is
  available on every plan.
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
