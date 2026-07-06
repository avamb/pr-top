<!-- audience: user -->
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

## What the assistant can help with

The signed-in assistant (this bot) can walk you through platform tasks
like "how do I mark a session as ended", "where do I export a
transcript", or "how do I assign an exercise". It does **not** have
access to any individual client's diary or notes.
