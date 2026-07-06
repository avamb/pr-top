<!-- audience: user -->
# Settings: profile, rates, and notification preferences

The Settings area is where a therapist configures their profile,
practice-level defaults (like session rates), language, notification
routing, and personal security controls. Everything on this page maps
to the `settings` and `notifications` i18n namespaces. This how-to
walks through every subsection in order.

## Prerequisites

- A signed-in therapist account. Settings are per-therapist; a
  supervisor's settings are on their own account.
- Physical access to the email address on file if you plan to change
  it — the platform sends a confirmation link.

## Sections of the Settings page

The Settings sidebar has five entries. The order below matches the
`settings` i18n namespace.

1. **Profile** — display name, practice name, email, language,
   time zone.
2. **Rates** — default session rate, currency, whether to show rates
   on client-facing exports.
3. **Notifications** — where to route SOS alerts, session-ready
   pings, digest emails, and quiet hours.
4. **Subscription** — plan changes, promo codes, invoice history. See
   the subscription-management how-to for full details.
5. **Security** — password change, active sessions list, two-factor
   authentication (2FA), account deletion.

## Step-by-step: profile

1. Open **Settings → Profile.**
2. Edit **Display name** (the name your clients never see) and
   **Practice name** (optional, shown on PDF exports).
3. Change **Email**. A confirmation link is sent to the new address;
   the change takes effect only after you click it.
4. Pick **Language** — EN/RU/ES/UK. All UI labels re-render
   immediately. This does not change the client-facing bot language.
5. Pick **Time zone**. Analytics windows and "today's" cutoffs are
   computed against this time zone.
6. Save.

## Step-by-step: rates

1. Open **Settings → Rates.**
2. Enter a **Default session rate** (per-session amount) and pick the
   **Currency**.
3. Choose whether to include rates on PDF exports intended for the
   client. Off by default.
4. Save.

Rates are metadata only — PR-TOP does not process payments from
clients, does not send invoices, and does not attempt to enforce a
per-client billing cycle. Rates make PDF exports more presentable for
therapists who invoice outside the platform.

## Step-by-step: notifications

1. Open **Settings → Notifications.**
2. **Email address for alerts** — defaults to your login email;
   override if you want alerts routed elsewhere.
3. **SOS delivery** (Premium) — choose email only, or email plus
   Telegram-to-therapist plus in-dashboard push.
4. **Session-ready pings** — get an email or in-dashboard push when a
   transcript finishes processing. Handy after a bulk upload.
5. **Weekly digest** — a Monday-morning email summarizing the last
   week's activity. On by default.
6. **Quiet hours** — a nightly window during which non-SOS
   notifications are suppressed. Format is HH:MM to HH:MM in your
   time zone.
7. Save.

## Step-by-step: security

1. Open **Settings → Security.**
2. **Change password** — enter the old password and a new one at
   least 8 characters long. On save, all other sessions are signed
   out.
3. **Active sessions** — a list of every browser and device currently
   signed in. Revoke any you don't recognise.
4. **Two-factor authentication (2FA)** — enrol a TOTP authenticator
   app (Aegis, 1Password, Authy). PR-TOP shows a QR code and
   verifies before enabling. Recovery codes are shown once — store
   them in a safe place.
5. **Danger zone → Delete account** — permanently removes your
   account, all clients, and all data after a 30-day grace period.
   During grace period you can restore by signing back in.

## Edge cases

- **Language change mid-session.** Switching language does not
  translate historical content, only future UI labels. Client-facing
  data continues to render in the client's own language.
- **Rate currency change.** New PDF exports use the new currency;
  historical exports are not re-generated.
- **Quiet hours crossing midnight.** Enter 22:00 → 07:00 for a
  night-block; the platform interprets the range as continuous.
- **2FA loss.** Use a recovery code to sign in. If you lost both the
  app and the codes, the admin support flow requires proof of
  identity to restore.

## Troubleshooting

- **Save button greyed out.** A field validation is failing —
  usually the email format or a required field left empty. Look for a
  small red hint below the field.
- **Confirmation email for the new address never arrives.** Check
  spam. Reissue by clicking **Resend confirmation**. If it still
  never arrives, the receiving mail server may be rejecting our
  sending IP; use a different address.
- **Notifications routed to wrong inbox after change.** The new
  address is only used after you click the confirmation link.
- **2FA setup shows "invalid code".** The device clock is out of
  sync. Enable automatic time on the phone and retry.
- **Cannot delete account.** If there are unresolved SOS events on
  any client, the delete button is disabled until they are resolved
  or the incidents are archived.

## FAQ

**Q: Is my email visible to my clients?**
A: No. The Telegram bot uses only your display name (from Profile) —
your email is never shared with the client.

**Q: Can I have two active email addresses?**
A: One primary login email, one optional alert email. There is no
support for a full multi-address setup.

**Q: Are rates encrypted?**
A: Rates are Class-B metadata (not diary content) and are stored in
plain form but behind auth and audit. The platform never sends them
to any third party.

**Q: Does 2FA cover the Telegram bot?**
A: 2FA protects the dashboard login. The Telegram bot is scoped to
the client — a stolen therapist account cannot impersonate the
client's Telegram bot channel.

**Q: What happens to my clients if I delete my account?**
A: All clients are archived and, after the 30-day grace, their data
is purged. Warn any active clients so they can migrate to another
therapist first if possible.

**Q: Can I change my time zone during daylight-saving transitions?**
A: Yes, any time. Analytics windows re-bucket instantly on the next
page load; historical timestamps stay in UTC internally so nothing
shifts.

**Q: Can I revoke another therapist's session?**
A: You can only see and revoke your own active sessions. Supervisors
and platform admins see their own list.
