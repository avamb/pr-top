<!-- audience: public -->
# General troubleshooting and FAQ

This page is a triage guide for the most common problems a therapist
runs into on PR-TOP: I cannot sign in, my client's Telegram won't
connect, a transcription failed, a page is blank, an email never
arrived. Use it as a quick reference before contacting support. Labels
come from the `auth`, `notifications`, `sessions`, and `common`
namespaces.

## Prerequisites

- Understanding of which browser and version you are using — Chrome,
  Firefox, Safari, and Edge (current + previous release) are
  supported.
- A stable internet connection. WebSockets keep the dashboard
  synchronized with the backend; a flaky connection produces stale
  activity feeds.
- Access to your login email for password-reset and
  account-recovery flows.

## Step-by-step: general triage sequence

1. **Reproduce the issue in a new browser tab.** Rules out a stale
   tab state.
2. **Hard-refresh the page** (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R
   on macOS). Rules out a bad SPA build cached by the browser.
3. **Sign out and back in.** Rules out a soured JWT cookie.
4. **Try a different browser or incognito window.** Rules out an
   extension.
5. **Check the platform status.** The public status page at
   `/status` shows recent incidents; if a component is down, the
   issue is not on your side.
6. **Open the Assistant panel** and ask a plain question about what
   you are trying to do — the KB often has the answer.
7. **Contact support** with the exact error text, the browser and OS,
   and the approximate time in your time zone.

## Sign-in and account issues

- **Wrong password.** Use **Forgot password?**. A reset link is
  emailed and is valid for one hour.
- **Password reset link never arrives.** Check spam. Reissue. If it
  still fails, use the confirmation-email retry flow, or contact
  support.
- **"Account locked" message.** Repeated failed logins temporarily
  lock the account for 30 minutes. Wait, or reset the password to
  unlock immediately.
- **2FA code rejected.** The device clock is out of sync — enable
  automatic time on the phone. If the app is lost, use a recovery
  code; if all codes are lost, contact support with proof of
  identity.
- **Email confirmation link expired.** Links expire after 30 minutes.
  Request a fresh one from the sign-up page.

## Telegram-binding issues

- **Row stuck at "pending invite".** The link may have been consumed
  by a different Telegram account or intercepted. Regenerate a fresh
  invite from the client page — the old code invalidates.
- **Client says "the bot did not respond".** Confirm the client tapped
  the correct deep link, and that they are using the same Telegram
  account they intend to bind. Telegram desktop and Telegram web can
  be logged into different accounts.
- **Bot replies but does not save entries.** Diary storage consent
  may be off. Turn it on from the client page's Consent tab.
- **`/switch` command missing.** The client is only bound to one
  therapist. `/switch` shows only when multiple bindings exist.
- **Bot language wrong.** The client can set `/lang <en|ru|es|uk>` in
  Telegram. The therapist's UI language does not affect the bot's
  language.

## Session upload and transcription issues

- **"File too large".** Files must be under 100 MB and in mp3, m4a,
  wav, mp4, or webm. Trim or re-encode locally.
- **Transcription never finishes.** Open the session page — a failed
  job shows a **Retry** button. Repeated failures on the same file
  usually indicate corrupted audio; try re-exporting the file.
- **Wrong language transcribed.** Force the language on the row at
  upload time; auto-detect can misfire on very short or noisy files.
- **Transcript truncated at the end.** Confirm the source file was
  not truncated locally. If the local file plays fully, delete the
  session and re-upload.
- **Streaming playback stutters.** The player streams from the
  encrypted storage over a signed URL that refreshes periodically.
  A slow network can cause visible reloading. Pause a few seconds
  to let the buffer catch up.

## Notification issues

- **SOS email never arrived.** Confirm the alert email is enabled in
  Settings → Notifications (the `sos_email` toggle). Also check the
  spam/junk folder — platform emails sometimes land there on first
  delivery.
- **Weekly digest missing.** Digests fire Monday morning in your time
  zone. If your time zone was changed recently, the first digest
  may skip a week to re-anchor.
- **Session-ready ping delayed.** After a big bulk upload the
  transcription queue can back up. Pings still arrive; they may just
  be later than usual.

## UI and rendering issues

- **Blank page after login.** The SPA failed to load. Hard-refresh.
  If it still fails, an ad-blocker may be blocking the analytics
  script; the analytics is fail-open but some blockers over-reach.
  Disable the blocker for `app.pr-top.com`.
- **Charts empty on Analytics.** The client may not have enough data
  in the current window. Widen the range.
- **PDF export blank.** Charts with "not enough data" are skipped.
  Widen the window before exporting.
- **Right-rail assistant panel missing.** It is collapsed. Look for
  a small chevron on the right edge of the dashboard.

## Payment and subscription issues

- **Card declined at renewal.** Update the card in Settings →
  Subscription. Stripe retries three times over a week; after the
  final failure the plan reverts to read-only.
- **Promo code rejected.** The code is expired, fully redeemed, or
  scoped to a tier different from the one you picked.
- **Invoice missing.** Wait 10 minutes for the Stripe sync. If still
  missing, contact support with the payment date.
- **Access to Pro features lost.** Confirm the plan status in
  Settings → Subscription. A downgrade or a failed renewal is the
  usual cause.

## FAQ

**Q: Which browsers are supported?**
A: The current and previous release of Chrome, Firefox, Safari, and
Edge. Older versions may work but are not tested.

**Q: Can I use PR-TOP on mobile?**
A: The dashboard is responsive and runs on mobile browsers. The
Telegram bot is native to the client's phone Telegram app.

**Q: How do I contact support?**
A: The help widget in the dashboard opens a support form. Include
the exact error text, browser, OS, and approximate timestamp for the
fastest response.

**Q: Are there status pages I can subscribe to?**
A: Yes — the public `/status` route lists recent incidents. Follow
the RSS feed there to receive push updates.

**Q: Where do I find the API documentation?**
A: Endpoints are documented in the assistant knowledge base
reference at `reference/endpoints.md`. Public API access is not
generally offered — the dashboard is the intended integration point.

**Q: How can I check that everything is encrypted correctly?**
A: The security overview page describes the encryption model. The
admin **encryption self-check** surfaces on the platform admin
dashboard and can be requested by support if you have concerns.

**Q: My question isn't in this list — what do I do?**
A: Open the signed-in assistant chatbot from the right rail and ask
in plain language. It has read access to this entire knowledge base
and will link you to the right how-to.
