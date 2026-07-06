<!-- audience: user -->

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
