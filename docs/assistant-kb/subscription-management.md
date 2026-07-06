<!-- audience: public -->
# Subscription management: upgrade, downgrade, cancel, and what
# happens to your data

PR-TOP subscriptions are billed monthly by Stripe. Every therapist
starts on a 14-day free Trial and can move to Basic, Pro, or Premium
at any time. This how-to covers the full billing surface: comparing
tiers, changing your plan, applying a promo code, and understanding
exactly what happens to your data across each transition. Labels
here come from the `subscription`, `billing`, and `settings`
namespaces.

## Prerequisites

- Signed-in therapist account.
- A valid credit card if you plan to move off Trial. Stripe is the
  payment processor; PR-TOP never sees the full card number.
- Understanding of the current tier limits:
  - **Trial** — $0 for 14 days, 3 client seats, 10 sessions/mo.
  - **Basic** — $19/mo, 15 client seats, 50 sessions/mo.
  - **Pro** — $49/mo, 60 client seats, 250 sessions/mo, adds vector
    search, natural-language queries, PDF/JSON/CSV export, custom
    exercises.
  - **Premium** — $99/mo, unlimited clients and sessions, adds
    supervision share and SOS alert channels.

The exact tier matrix lives at `docs/assistant-kb/reference/pricing.md`
and is regenerated from source at every release.

## Step-by-step: upgrade

1. Open **Settings → Subscription.**
2. The card at the top shows your current tier, next renewal date,
   and remaining trial days if applicable.
3. Tap **Upgrade** and pick a new tier from the modal. The button on
   each tier says the exact monthly price in your currency.
4. If prompted, enter card details in the embedded Stripe form.
   Existing cards are pre-selected.
5. Optionally enter a **Promo code** to apply a discount or extended
   trial. Codes are managed by admins under `adminPromos`.
6. Confirm. The upgrade is effective immediately; the new tier's
   quotas and features unlock right away.

## Step-by-step: downgrade

1. Open **Settings → Subscription** and tap **Change plan**.
2. Pick a lower tier. The confirmation modal shows a summary of what
   you will lose: any Pro-only features (NL queries, custom
   exercises), any Premium-only features (supervision share, SOS
   channels), the reduced client seat cap, and the reduced session
   quota.
3. Confirm. The downgrade is scheduled to take effect at the end of
   the current billing period, so you keep everything until then.
4. Cancel the pending downgrade any time before the effective date
   from the same panel.

## Step-by-step: cancel

1. Open **Settings → Subscription**.
2. Tap **Cancel subscription**.
3. Optionally tell us why (the reason field is optional and used only
   for aggregate product research; it is never tied back to your
   client data).
4. Confirm. Cancellation takes effect at the end of the current
   billing period. Until then, everything continues to work.

## What happens to your data

- **Upgrade** — data is untouched. New capabilities unlock instantly.
- **Downgrade** — data is untouched, but read views for features you
  no longer have become locked cards. Nothing is deleted. If you
  re-upgrade later, everything is exactly as you left it.
- **Cancel** — at the end of the billing period, your account reverts
  to a read-only state. You can still sign in, view clients, and
  export data for 90 days. After 90 days without a new subscription,
  data enters a 30-day final grace period and is then purged.
- **Reactivate during grace** — pick a new tier from Settings →
  Subscription. All data reactivates without any restore step.

## Edge cases

- **Mid-cycle upgrade.** Stripe pro-rates the price difference
  automatically — you pay a fraction of the higher tier for the
  remainder of the current billing period, then the full new price on
  the next renewal.
- **Trial → paid.** The 14-day trial is a real free window; you can
  upgrade before it ends and the trial converts into a paid
  subscription without interruption.
- **Downgrade below current seat count.** If you have more clients
  than the target tier allows, the downgrade modal warns you and
  asks you to archive some clients first. Archived clients do not
  count against the seat cap.
- **Downgrade below current-month usage.** If you have already
  uploaded more sessions this month than the target tier allows, the
  downgrade still schedules — the new limit only applies to next
  month.

## Troubleshooting

- **Card declined.** Stripe surfaces the reason in the payment modal
  (insufficient funds, expired card, security check failed). Update
  the card and retry.
- **Promo code rejected.** The code may be expired, fully redeemed,
  or restricted to a specific tier. Check with whoever gave you the
  code; the admin can view redemption state.
- **Invoice missing from history.** Invoices sync from Stripe within
  10 minutes of payment. Refresh; if it still doesn't appear after a
  day, contact support.
- **Access to Pro features lost mid-cycle.** If your card was
  declined at renewal, Stripe automatically retries three times over
  the following week. During dunning you keep access; after the
  final failed attempt the plan reverts to read-only.
- **Cancel button greyed out.** You already have a scheduled
  cancellation. Look at the top of the subscription card for the
  effective date, and use **Reactivate** to abort the cancellation.

## FAQ

**Q: Can I be on two plans at once for two practices?**
A: Each therapist account holds one plan. Run two accounts if you
truly need two separate billing lines.

**Q: What currency will I be billed in?**
A: The card's home currency, converted from USD by Stripe at the
current rate. PDF invoices show the exact charged amount.

**Q: Can I get a refund?**
A: Refunds are handled per Stripe policy on a case-by-case basis.
Contact support with the invoice ID.

**Q: Does the trial ask for a card up front?**
A: No. The trial is a real no-card 14-day window. You will be asked
for a card only when you upgrade.

**Q: What if I upgrade, use one Pro feature, and downgrade the same
day?**
A: You are charged the pro-rated Pro cost for the time you were on
Pro, and the downgrade schedules for end-of-period as usual.

**Q: Where do I find my past invoices?**
A: **Settings → Subscription → Invoice history**. Each row shows
date, amount, and a download link to the Stripe-hosted PDF.

**Q: Can I move seats between clients?**
A: Seats are consumed by active clients only. Archive an inactive
client to free their seat; the seat becomes available immediately
and can be used for a new client without any transfer step.

**Q: What is the safest way to migrate to a new plan?**
A: Upgrade first, verify the new features work as expected, then
downgrade only if you want to move back down. Downgrades take effect
at end-of-period so there is no rush.
