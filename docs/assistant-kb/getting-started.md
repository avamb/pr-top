<!-- audience: public -->
# Getting started with PR-TOP as a therapist

This how-to walks a signed-in therapist through the first-hour setup of a
PR-TOP practice. It is written for authenticated users and is **not**
exposed to the anonymous landing-page assistant.

## Sign in

1. Open the dashboard at `https://app.pr-top.com/`.
2. Enter the email and password you registered with. If you forgot your
   password, click **Forgot password?** to receive a reset link.
3. On first login you will be prompted to confirm your display language
   (English, Russian, Spanish, or Ukrainian).

## Create your first client

1. From the sidebar choose **Clients → New client**.
2. Enter the client's display name (a nickname is fine — no real name is
   required for the Telegram flow).
3. Save. PR-TOP generates an **invite code** and a Telegram **deep link**
   you can share with the client.

## Connect the client's Telegram

Send the invite link to the client. When the client opens the link in
Telegram and taps **Start**, the bot binds their Telegram user to your
client record. You will see the client's row on your dashboard flip from
**pending invite** to **connected** within a few seconds.

## Between-session workflow

Once connected, the client can send text, voice, or video diary entries
between sessions. Everything is encrypted at rest. You review entries
from **Clients → open client → Diary**. Private therapist notes live on
the same page and are never shown to the client or included in bot
replies.

## Installing PR-TOP as a Progressive Web App (PWA)

After signing in, your browser may show a banner at the bottom of the
screen offering to add PR-TOP to your home screen. This is the PWA
install prompt, and it appears **only inside the signed-in area**
(dashboard, clients, settings, etc.) — never on public marketing pages or
the registration / login flows.

To install the PWA:
1. Sign in and navigate to any dashboard page.
2. When the "Add PR-TOP to Home Screen" banner appears, click **Install**.
3. Your OS installs a standalone shortcut. Future visits open directly
   without a browser address bar.

To dismiss permanently: click **Not now** — the banner will not appear
again on that device. To re-prompt, clear the site data in your browser
settings.

**Update banner:** When a new version of PR-TOP is deployed, a teal
"A new version is available" banner appears at the bottom-right corner of
any dashboard page. Click **Refresh** to reload and get the update.
Like the install prompt, the update banner is restricted to the
authenticated zone and will not interrupt visitors browsing the landing
page.

## What the assistant can help with

The signed-in assistant (this bot) can walk you through platform tasks
like "how do I mark a session as ended", "where do I export a
transcript", or "how do I assign an exercise". It does **not** have
access to any individual client's diary or notes.

## Prerequisites

- A registered therapist account and access to your login email.
- A modern browser (current + previous release of Chrome, Firefox,
  Safari, or Edge).
- Willingness to obtain informed consent from any real client you
  invite. PR-TOP enforces consent flags on every data-writing route.

## Edge cases

- **First login on Trial.** New accounts start on Trial with 3 client
  seats and 10 sessions/mo. You can upgrade at any time from
  Settings → Subscription.
- **Multiple therapists in one practice.** Each therapist registers
  their own account. Premium accounts can share specific clients
  read-only with a supervising colleague.
- **Client already on Telegram with a different therapist.** The
  `/switch` command lets the client flip between therapist bindings.

## Troubleshooting

- **Forgotten password.** Use **Forgot password?** on the sign-in
  page; a reset link is emailed and valid for one hour.
- **Deep link opens the wrong Telegram account.** Confirm which
  Telegram account the client is signed into (desktop vs. web can
  differ) before they tap Start.
- **Row stuck at pending invite.** Regenerate a fresh invite from
  the client page; the old code invalidates.
- **Language toggle missing.** Very small viewports collapse it into
  the profile submenu — widen the browser or open the sidebar.

## FAQ

**Q: How long is the Trial?**
A: 14 calendar days from account creation. It ends automatically;
data is preserved through a 90-day grace and a 30-day final grace.

**Q: Do I need a credit card to start?**
A: No. The 14-day trial period does not require payment information.
A card is collected only when you actively switch to a paid plan.

**Q: Can I invite myself as a test client?**
A: Yes. Use your own Telegram account bound to a "Test client"
record to try diary, exercises, and SOS as if you were the client.

**Q: What languages are supported?**
A: UI: English, Russian, Spanish, Ukrainian. Bot: same four. Vector
search is cross-lingual — an English query can retrieve entries in
any supported language.

**Q: Can the assistant read my clients' diaries?**
A: No. The assistant reads only the knowledge base you are seeing
now — never a client's diary, notes, or transcripts.

**Q: How do I contact support?**
A: The help widget in the dashboard opens a support form. Include
the browser, OS, and approximate timestamp of any error.
