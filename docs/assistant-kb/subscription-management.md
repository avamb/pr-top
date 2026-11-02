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
  - **Trial** — $0 for 14 days, 3 client seats, 5 session uploads/mo.
  - **Basic** — $19/mo, 10 client seats, 20 session uploads/mo.
  - **Pro** — $49/mo, 30 client seats, 60 session uploads/mo, adds
    vector search, natural-language queries, PDF/JSON/CSV export,
    custom exercises.
  - **Premium** — $99/mo, unlimited clients and sessions, adds
    supervision share and SOS alert channels.

The exact tier matrix lives at `docs/assistant-kb/reference/pricing.md`
and is regenerated from source at every release.

## Step-by-step: upgrade

1. Open the **Subscription** page from the sidebar.
2. The card at the top shows your current tier, its status, and the
   trial end date or the end of the current billing period.
3. Under **Available Plans**, click **Upgrade to …** on the tier you
   want. Each card shows the monthly price.
4. What happens next depends on how you pay today:
   - **From the Trial, or without a paid Stripe subscription** (for
     example after a cancellation has run out): you are sent to
     Stripe Checkout to enter a card. The new tier is applied once
     the payment succeeds.
   - **From an active paid plan:** there is no checkout. PR-TOP
     switches your existing Stripe subscription to the new tier and
     Stripe immediately charges the prorated difference for the rest
     of the current billing period to your card on file. Only after
     that charge succeeds is the new tier applied; its quotas and
     features unlock right away and a confirmation message says the
     prorated difference has been charged.
5. If the charge is declined, nothing changes: you stay on your
   current tier and see a message asking you to check your payment
   method.
6. Promo codes are applied separately in the **Have a promo code?**
   section further down the page.

## Step-by-step: downgrade

1. Open the **Subscription** page from the sidebar.
2. Under **Available Plans**, click **Downgrade to …** on the lower
   tier you want. The change is sent right away (there is no separate
   confirmation step).
3. The page confirms "Downgrade to … scheduled. Your current access
   continues until …". The card of the new tier now shows
   **Downgrade Scheduled**, and a notice under your current plan
   repeats the effective date. You keep your current tier — its
   limits and features — until that date.
4. If you pay through Stripe, PR-TOP switches your Stripe subscription
   to the lower price for the next renewal. Nothing is charged or
   credited for the current period. When Stripe starts the new
   billing period, your plan changes to the lower tier automatically.
   If Stripe cannot be reached, nothing is scheduled and an error asks
   you to try again.
5. A plan without a paid Stripe subscription (for example one granted
   by an administrator) switches when its current period ends, or
   immediately if it has no period end.
6. To undo it, click **Keep …** (for example **Keep Pro**) in the
   downgrade notice before the effective date. Stripe renews on your
   current tier again, nothing is charged, and the page confirms "The
   scheduled downgrade was canceled. You stay on …".
7. Upgrading to a higher tier before the effective date also replaces
   the scheduled downgrade; the prorated charge is then calculated
   from the tier you are actually paying for.
8. If the page says "We could not confirm the change with the payment
   provider", the connection to Stripe dropped mid-change. Reload the
   page after a minute to see the state Stripe reports.

## Step-by-step: cancel

1. Open the **Subscription** page from the sidebar.
2. Click **Cancel subscription** under your current plan. The link is
   shown for active paid plans, also while a downgrade is scheduled;
   it is hidden during the Trial. A scheduled downgrade stays in place
   when you cancel, so resuming later renews on the lower plan.
3. Confirm the browser prompt, which reminds you that access continues
   until the end of the current billing period.
4. If you pay through Stripe, PR-TOP first tells Stripe to stop
   renewing your subscription, so you will not be charged again. Only
   then is your plan marked **Canceled**.
5. The page now shows "Your subscription has been canceled. Your
   access continues until …" with the end date of the paid period.
   Until that date, everything continues to work.
6. If Stripe cannot be reached, the cancellation is not recorded and
   an error asks you to try again — you are never shown "canceled"
   while Stripe keeps billing.

## Step-by-step: resume a canceled subscription

1. Open the **Subscription** page. A canceled plan shows "Your
   subscription has been canceled. Your access continues until …".
2. While that date is still in the future, a **Resume subscription**
   link appears in the same notice. Click it.
3. If you pay through Stripe, PR-TOP first switches renewal back on
   in Stripe; then your plan is marked active again and the page
   confirms that it will renew automatically at the end of the
   current period. Nothing is charged at that moment.
4. If the paid period has already ended, resuming is no longer
   possible — choose a plan to subscribe again through checkout.

## What happens to your data

- **Upgrade** — data is untouched. New capabilities unlock instantly.
- **Downgrade** — data is untouched, but read views for features you
  no longer have become locked cards. Nothing is deleted. If you
  re-upgrade later, everything is exactly as you left it.
- **Cancel** — nothing is deleted. Until the end of the paid period
  you keep full access. After that, the dashboard and client areas
  are locked and you are redirected to the Subscription page; you can
  still sign in.
- **Resubscribe** — pick a tier on the Subscription page and complete
  Stripe Checkout. Your existing data is available again without any
  restore step.

## Edge cases

- **Mid-cycle upgrade.** Stripe pro-rates the price difference and
  invoices it immediately — you pay a fraction of the higher tier for
  the remainder of the current billing period right away, then the
  full new price on the next renewal. Your renewal date does not
  move.
- **Trial → paid.** The trial is a real free window with no card on
  file, so moving to a paid tier always goes through Stripe Checkout.
  You can do this before the trial ends.
- **Cancel, then change your mind.** While the plan shows Canceled
  you keep access until the period end, and **Resume subscription**
  restores renewal. If you pay through Stripe, upgrading waits — resume
  first, then upgrade. After the period has ended, pick a tier again;
  this starts a new checkout.
- **Past-due payment.** If a renewal charge fails, Stripe retries it
  automatically and you keep access meanwhile. Plan changes and new
  checkouts are blocked until the payment succeeds, so you are never
  billed for two subscriptions at once.
- **Downgrade below current seat count.** If you have more clients
  than the target tier allows, the downgrade is still scheduled and a
  warning explains that your existing client links are preserved, but
  you cannot add new clients until you are within the new limit.
- **Downgrade below current-month usage.** Session uploads are counted
  per calendar month. The downgrade still schedules; once the lower
  tier takes effect, its monthly upload limit applies to the uploads
  already made in that calendar month.
- **Canceled or past-due plan.** While a canceled plan's paid period
  is still running, or while Stripe retries a failed renewal, your
  tier's features and limits stay available.

## Troubleshooting

- **"The upgrade payment could not be completed."** Stripe declined
  the prorated upgrade charge (insufficient funds, expired card,
  security check failed). Your plan was not changed. Update the card
  and retry.
- **"We could not reach the payment provider."** Stripe was not
  reachable. Nothing was changed — no upgrade, no cancellation. Retry
  in a few minutes.
- **"Billing is temporarily unavailable."** Payments are not set up on
  the server at the moment. Nothing was changed; try again later.
- **"Resume it first, then change your plan."** Your canceled plan is
  still running. Use **Resume subscription**, then upgrade.
- **"Your last payment did not go through."** The subscription is past
  due; wait for Stripe's automatic retry to succeed before changing
  plans.
- **Promo code rejected.** The code may be expired, fully redeemed,
  or restricted to a specific tier. Check with whoever gave you the
  code; the admin can view redemption state.
- **Invoice missing from history.** Invoices sync from Stripe within
  10 minutes of payment. Refresh; if it still doesn't appear after a
  day, contact support.
- **Access to Pro features lost mid-cycle.** If your card was
  declined at renewal, Stripe retries the charge automatically and
  you keep your tier meanwhile. If Stripe finally ends the
  subscription or marks it unpaid, access ends and you are sent to
  the Subscription page to choose a plan. A scheduled downgrade whose
  effective date has passed is the other common cause.
- **No Cancel subscription link.** The link only appears for an
  active paid plan. It is hidden if the plan is already canceled
  (the card then shows "Your access continues until …"), during the
  Trial, or for a plan granted by an administrator.

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
A: No. The trial is a real no-card window. You will be asked for a
card only when you upgrade, in Stripe Checkout.

**Q: Am I charged immediately when I upgrade a paid plan?**
A: Yes. The prorated difference for the rest of the current billing
period is charged to your card on file right away, and the new tier
unlocks only after that charge succeeds. Later renewals are at the
full price of the new tier.

**Q: If I cancel, will Stripe still charge me next month?**
A: No. Canceling stops the renewal in Stripe. You keep access until
the end of the period you already paid for.

**Q: I canceled by mistake. What now?**
A: Click **Resume subscription** on the Subscription page before the
paid period ends. Renewal is switched back on and nothing else
changes.

**Q: What if I upgrade, use one Pro feature, and downgrade the same
day?**
A: You are charged the pro-rated Pro cost for the time you were on
Pro, and the downgrade schedules for end-of-period as usual.

**Q: Where do I find my past invoices?**
A: On the **Subscription** page, in the **Payment History** table at
the bottom. Each row shows the date, amount, status and payment ID;
Stripe also emails a receipt for every payment.

**Q: Can I move seats between clients?**
A: Every client linked to your account uses one seat. There is no
transfer step: a seat frees up when a client is no longer linked to
you.

**Q: Do I get money back when I downgrade?**
A: No. You keep the tier you already paid for until the end of the
period, and Stripe charges the lower price from the next renewal.

**Q: What is the safest way to migrate to a new plan?**
A: Upgrade first, verify the new features work as expected, then
downgrade only if you want to move back down. Downgrades take effect
at end-of-period so there is no rush.
