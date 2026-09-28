<!-- audience: public -->
# Sign in with an email code

This page explains how to sign in to PR-TOP using a 6-digit code sent to your email — a password-free sign-in method that works on any device and requires no password manager.

## Prerequisites

- An email address associated with your PR-TOP account.
- A browser with email access (you will click a verification link or type a 6-digit code).
- If you have already set a password, you can still choose to sign in by code; both methods work on the same account.

## Why email-code sign-in?

Sign-in by email code offers three advantages:

1. **No password to remember.** The 6-digit code is temporary and sent just for this session.
2. **Faster on mobile.** The code is automatically filled in many browsers; you do not need a password manager.
3. **One-click option.** The email also contains a direct sign-in link — tap it and you are logged in instantly, without typing anything.

## Step-by-step: sign in with an email code

### Step 1: Open the sign-in page

Navigate to `https://app.pr-top.com/login` or click **Log In** on the landing page.

The page defaults to **"Get a code"** mode. You will see:

- An email field with placeholder text `you@example.com`
- A hint: *"We'll email you a 6-digit code — no password needed."*
- A **Get code** button (primary action)
- A link at the bottom: *"Sign in with password instead"* (fallback if you prefer)

### Step 2: Enter your email and request a code

1. Type the email address registered with your PR-TOP account into the email field.
2. Make sure the email is correct — the code is sent to exactly that address.
3. Click **Get code**.

Behind the scenes, PR-TOP validates your email, generates a 6-digit code, and sends it immediately. The page shows no progress spinner — it simply moves to the next step.

**What you will see:**

- The page switches to **"Code entry"** mode.
- A message appears: *"Code sent to {your-email}"*
- Six empty input cells for your code.
- A **Send another code** button (grayed out for 60 seconds).
- A **Change email** link (in case you mistyped).
- A **Sign in with password instead** link (fallback to password mode).

### Step 3a: Enter the code manually

1. Check your email inbox (and spam folder, just in case).
2. Look for an email with the subject line and a 6-digit code displayed prominently.
3. Type the six digits into the cells on the sign-in page.

The page auto-advances to the next cell as you type each digit. After the sixth digit is entered, the code is automatically verified.

**If the code is correct:** You are signed in and redirected to the dashboard. If this is your first login via email code, your email address is automatically confirmed, and any gated features (client creation, session uploads, etc.) become available immediately.

**If the code is wrong:** An error message appears: *"The code is invalid or has expired."* The cells clear and you can type again. You have up to 5 attempts per code; after 5 wrong entries that code stops working for good, and the same message is shown for every further attempt.

**If the code no longer works:** Click **Send another code** (a 60-second cooldown applies between requests). A fresh code is sent and the old one is discarded. For safety, after many wrong entries in a row within an hour, sign-in by code is paused for that email for one hour — use your password in the meantime, or try again later.

### Step 3b: Use the one-click sign-in link (faster)

Instead of typing, you can click the sign-in link directly from your email:

1. In the email, locate the button or link labeled **"Sign in"** or **"Sign in to PR-TOP"**.
2. Click it.
3. You are taken to PR-TOP and logged in instantly — no code typing required.

This is the fastest path, especially on mobile. The link is a one-time use token valid for **10 minutes** (the same as the code). After you click it, the token is consumed and cannot be reused.

### Step 4: Set up email confirmation (if needed)

After your first successful sign-in by code, your email is automatically confirmed. However, if you registered via password sign-up and have not yet confirmed your email, you will see a yellow banner:

**"Confirm your email — We sent a verification link to {email}. Some features stay locked until you confirm."**

This banner appears because the email confirmation and code sign-in are two separate credentials. Email-code sign-in does not confirm your email address if you registered with a password. To confirm:

1. Check your inbox for the **verification email** (separate from the code email).
2. Click the **Verify email** link in that email.
3. The banner disappears and all gated features become available.

If the verification email is stale or you need to re-send it:

1. Click the **Send again** button on the banner. A fresh link is sent.
2. You can re-send up to 3 times per hour.

## One-time password limits and cooldowns

### Code validity

- **6-digit code:** Valid for **10 minutes** from the time it is sent.
- **One-click sign-in link:** Valid for **10 minutes** (same expiry as the code).

If the code or link expires, you will see a message: *"That sign-in link has expired. Request a new code below."* or *"The code is invalid or has expired."* Request a fresh code.

### Code request limits

To prevent abuse, there is a limit on code requests:

- **Maximum 3 codes per email per 15 minutes.**

If you request a code and immediately request another, the second request is allowed. After 3 requests in 15 minutes the page still shows the usual *"If that email is registered, we've sent a sign-in code."* message, but no new email is sent — the most recent code you already received keeps working until it expires.

Wait 15 minutes before requesting again. This limit is per email address, not per device.

### Wrong-entry lockout

- **Maximum 5 wrong code entries** before the code is locked.

After 5 incorrect attempts, you cannot type any more digits into that code. You must request a new code.

### Resend cooldown

The **Send another code** button is disabled for **60 seconds** after you submit the form (or click the button). This prevents accidental double-sends and respects the user's intent to wait for the first code to arrive.

## What the email looks like

The email you receive is titled **"Your sign-in code: 123456"** (or similar, depending on your language). It contains:

1. **Your 6-digit code** in large, monospaced text (easy to copy and type).
2. **"Valid for 10 minutes"** or similar time indicator.
3. A **"Sign in"** button or link (the one-click option).
4. **"If this wasn't you, ignore this email."** — a safety line if the email was sent by mistake.

The email is sent in your account's preferred language (English, Russian, Spanish, or Ukrainian).

## Edge cases and troubleshooting

### "I didn't get the code email"

**What to try:**

1. **Check spam and promotions folders.** Email providers sometimes flag authentication emails as spam.
2. **Wait 30 seconds.** Email delivery can take a moment.
3. **Request the code again.** Click **Get code** on the sign-in page and re-enter your email. A fresh code will be sent.
4. **Check the email address.** If you mistyped your email, the code goes elsewhere. Use the **Change email** link to correct it before requesting again.
5. **Contact support.** If multiple code requests do not arrive, there may be an issue with your email provider or our mail service. Email `support@pr-top.com` with the email address you are trying to sign in with.

### "I got the code but it says 'incorrect' or 'expired'"

**What to try:**

1. **Check the timestamp.** The code is valid for exactly 10 minutes. If you received it 15 minutes ago, it has expired.
2. **Copy-paste carefully.** Make sure there are no extra spaces or typos. The code is six digits: `0–9` only, no letters.
3. **Request a new code.** Click **Send another code** (wait for the 60-second button cooldown to finish). A fresh code will be sent.

### "I entered the code wrong several times and it no longer works"

**What to try:**

1. **Request a new code.** Click **Send another code** on the sign-in page (after the 60-second cooldown).
2. **Check the email carefully.** Copy the code directly from the email to avoid typos.
3. **If a fresh code is also rejected:** you may have hit the 3-codes-per-15-minutes limit (no new code is sent), or sign-in by code is paused for an hour after too many wrong entries. Wait, or sign in with your password.

### "The one-click link doesn't work / lands on an error"

Possible reasons:

1. **The link has expired.** One-click links are valid for 10 minutes. If more than 10 minutes have passed since you received the email, the link may no longer work.
2. **The link has been used.** One-click links are single-use. If you clicked it before, it cannot be used again.
3. **Browser or network issue.** Rarely, the page fails to load the redirect. Try copy-pasting the link into your browser's address bar or requesting a fresh code.

If the link lands on a page that says **"This confirmation link has expired"** or **"We couldn't confirm your email"**, request a fresh code from the sign-in page.

### "I can't use ad blockers or special browser extensions"

The sign-in form includes invisible verification to block bots. If you use an ad blocker or privacy extension:

1. **Temporarily disable it** for `pr-top.com`.
2. **Reload the sign-in page.**
3. **Request the code again.**

This applies to all sign-in methods (code, password, and registration). Once you are signed in, the extension can be re-enabled.

## Can I still sign in with a password?

Yes. The email-code method and password sign-in are both available on the same account:

- On the sign-in page, when you are in **"Get code"** mode, click the link: **"Sign in with password instead"**.
- The page switches to **"Password"** mode (email + password fields).
- Enter your credentials and click **Sign in**.

Both methods work simultaneously. You can use whichever is more convenient.

## What happens after I sign in?

After a successful sign-in by code:

1. **You are logged in.** The session is stored as a browser cookie (HttpOnly, Secure, SameSite).
2. **Your email is confirmed** (if you haven't confirmed it before). This unlocks gated features like client creation and session uploads.
3. **You land on the dashboard.** If you were trying to access a specific page before sign-in, you are redirected there instead.
4. **You can change your preferences.** Open **Settings** to update your language, timezone, and notification settings.

## FAQ

**Q: Can I change my email address after I sign in by code?**

A: Yes, but only if your email is not yet confirmed. Once email is confirmed, you must contact support to change it. If you registered with a password and have not yet confirmed your email via the verification link, you can click the **Change email** button on the dashboard banner and set a new address. A new verification email will be sent to the new address.

**Q: What if I sign in by code on one device and password on another?**

A: No problem. Both are valid. Sessions are per-device (per-cookie), so you can have separate sign-ins on your phone and desktop.

**Q: If I sign in by code, do I need a password?**

A: No. The password is optional. You can sign in by code forever and never set a password. However, if you forget which email is registered with your account, you cannot reset it without contacting support. A password is a backup way to sign in if you lose email access.

**Q: Can I request a code if I don't know my password?**

A: Yes. Code sign-in does not require a password — it only requires email access. So if you forget your password, you can still sign in by code. After you are signed in, you can set a new password in **Settings → Account**.

**Q: How long does a session last?**

A: A sign-in session stays active as long as your browser cookie is valid (typically until you close the browser or clear cookies). If you close the browser and come back later, you may be asked to sign in again — just request a fresh code.

**Q: Is my code stored anywhere?**

A: No. The code is sent only to your email and stored encrypted on the server. Support staff cannot see your code. If you lose a code, simply request a new one — there is no recovery option.

**Q: Can someone else use my code if they see it?**

A: Yes, but only if they have access to your email. If they see the code in your inbox or a forwarded email, they can type it into the sign-in form on PR-TOP and log in as you. **Keep your email secure** — treat the code like a temporary password. The code is deleted from our logs after 10 minutes, so old codes cannot be reused.

**Q: What if I do not receive email from PR-TOP at all?**

A: Check that:
1. Your email address is spelled correctly on your account (Settings → Profile).
2. Your email provider is not blocking `noreply@pr-top.com` (add it to contacts or allowlist).
3. Your email inbox is not full.
4. Try an alternate email address if you have one registered.

If you still cannot receive emails, contact support at `support@pr-top.com`.

**Q: Can I request codes for other accounts?**

A: Not without having access to those email addresses. Code delivery is the only form of authentication — if you know the email address and can receive mail sent to it, you can request a code. This is intentional: it ensures that whoever has email access to that address can sign in.
