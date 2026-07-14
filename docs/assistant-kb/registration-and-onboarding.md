<!-- audience: public -->
# Registration and onboarding for new therapists

This page is written for anyone evaluating PR-TOP for their practice.
It answers the pre-sales questions a therapist typically asks before
committing to a trial: what registration involves, how quickly the
first client can be onboarded, what the trial gives you, and how you
can walk away later. This is the only doc under the assistant KB that
is exposed to the anonymous, landing-page assistant.

## Prerequisites

- An email address you have access to. Registration sends a
  confirmation link that must be clicked within 30 minutes.
- A modern browser. PR-TOP supports the current and previous
  release of Chrome, Firefox, Safari, and Edge.
- Willingness to obtain informed consent from any client you plan to
  invite. PR-TOP enforces consent flags on the client record; you
  must have real consent before turning them on.

## The registration form

When you visit `/register` you are greeted with the heading
**"Create your therapist workspace"** and the subtitle
**"14-day free trial. No credit card required."**

Below the heading a short security line reads:
*Application-level encryption. Data stored in the EU.*
This is factual: client data is encrypted with AES at the
application layer and the server runs on EU infrastructure
(Hetzner). No card is collected at this step; stripe_customer_id
is NULL until you upgrade.

At the bottom of the form two links point to `/terms` (Terms of
Service) and `/privacy` (Privacy Policy) before the submit button
so you know what you are agreeing to. The form is available in all
four interface languages (EN, RU, ES, UK) and the language can be
toggled from the top-right switcher before signing up.

## Step-by-step: register

1. Go to `https://app.pr-top.com/register` or click **Get Started**
   on the landing page.
2. Review the security note and terms/privacy links on the form.
3. Enter your email and choose a password (minimum 8 characters,
   one uppercase, one lowercase, one number).
4. Choose your preferred UI language from the top-right switcher —
   EN, RU, ES, or UK. You can change this later.
5. Submit. A confirmation email lands in your inbox with a magic
   link.
6. Click the link. You are dropped into the dashboard on a fresh
   14-day Trial subscription.

## The 14-day Trial

Every fresh account starts on Trial with:

- **3 client seats** — enough to invite three real clients or a few
  test personas.
- **10 sessions per month** — a session is an uploaded audio/video
  file (transcription is not included on Trial; sessions become
  manual-notes entries).
- **Full access to the built-in exercise library** — assign as many
  exercises as you like, no per-exercise cost.
- **Basic diary-based analytics** — session counts, exercise
  engagement, mood trend if the client rates their mood.
- **Assistant chatbot** — the signed-in help bot answers questions
  about the product itself.

The Trial does not require a credit card. It ends automatically after
14 days; you can upgrade at any point during or after the Trial. No
data is deleted at Trial expiry — the account simply reverts to
read-only until you pick a paid plan.

## Step-by-step: first-hour onboarding

Once you are signed in you can be productive in about an hour.

1. **Set your profile.** Open Settings → Profile and confirm display
   name, practice name, language, and time zone.
2. **Create your first client.** Sidebar → **Clients → New client**.
   Give them a display nickname (no real name required for the
   Telegram flow).
3. **Send the invite.** Copy the Telegram deep link and send it to
   the client through your normal secure channel.
4. **Wait for the connect.** When the client opens the link and taps
   **Start** in Telegram, the client row on your dashboard flips
   from **pending invite** to **connected** within a few seconds.
5. **Assign a first exercise.** From the client page → Exercises tab,
   pick a short grounding or values exercise and schedule it for the
   next quiet-hour boundary.
6. **Watch the diary.** Ask the client to type a short daily entry to
   the bot for a few days. Their entries appear on the client's
   Diary tab, encrypted at rest, and in your dashboard activity feed.

## Edge cases

- **Multi-therapist practice.** Each therapist registers their own
  account. Practices with a supervising colleague can share specific
  clients via Supervision Share, but it requires the sharing
  therapist to be on Premium.
- **Custom SSO or Google login.** Not offered today. All accounts
  use email + password.
- **Corporate email domains.** Some corporate SMTP servers rewrite
  or block the confirmation link. If the link fails, ask your IT to
  allowlist `noreply@pr-top.com` or use a personal address.
- **Registrations from outside the four supported UI languages.** The
  UI defaults to English if the browser locale is unknown; you can
  switch at any time under Settings.

## Troubleshooting

- **Confirmation email never arrives.** Check spam. Wait ten minutes.
  Resend from the sign-up form or from the "resend confirmation" link
  after signing in. If it still fails, try a different email address.
- **"Email already registered" error.** You may have signed up
  previously with a different case (email is case-insensitive) or
  registered on an old marketing beta. Use **Forgot password?** to
  reclaim the account.
- **Trial ended sooner than expected.** Trials count calendar days
  from account creation timestamp. If the account's time zone was set
  to something unusual, the trial may end earlier than a 24-hour cycle
  in your local time.
- **Language toggle missing.** Very small viewports collapse the
  language selector into the profile submenu. Widen the browser or
  scroll inside the sidebar.
- **Bot invite link opens the wrong Telegram account.** Telegram
  desktop and Telegram web sometimes bind to different accounts.
  Confirm the account with the client before they tap Start.

## FAQ

**Q: How much does PR-TOP cost after the Trial?**
A: Basic is $19/mo, Pro is $49/mo, Premium is $99/mo. See the
pricing reference for full detail on client seats, session quotas,
and feature gating per tier.

**Q: Is there a free version after the Trial?**
A: No. When the trial ends the account enters a read-access state
unless a paid plan is selected. Data is preserved through a 90-day
grace, then a 30-day final grace, and then purged if no plan is
chosen.

**Q: Where is my data stored?**
A: PR-TOP is hosted on European infrastructure. Class-A data
(diary, private notes, transcripts, AI summaries) is encrypted at
rest at the application layer with AES; metadata (timestamps, IDs)
is access-controlled plaintext. All connections are over HTTPS.

**Q: Is PR-TOP HIPAA/GDPR compliant?**
A: PR-TOP is designed to help therapists meet GDPR obligations —
data export, right-to-be-forgotten, encrypted storage, audit
logging — but compliance is jurisdiction-specific and the
therapist remains the data controller for their clients. A DPA is
available on request.

**Q: Do I need a technical background to run PR-TOP?**
A: No. The product is a browser SPA and a Telegram bot. You do not
install anything. The therapist-side workflow is form-based; the
client-side workflow is chat-based.

**Q: Can I try PR-TOP without inviting a real client?**
A: Yes. Use your own Telegram account as a test client. Create a
"Test client" record, send the deep link to yourself, and try the
diary, exercises, and SOS commands as if you were the client.

**Q: Where can I read more before signing up?**
A: The public landing pages under `/features`, `/pricing`, and
`/security` cover the marketing and security posture. The public
security overview is the fastest read.

**Q: Who owns the data I upload?**
A: You do. PR-TOP is a data processor acting on your instructions.
Delete your account and the data is purged; export it and the
platform hands you a portable JSON archive.
