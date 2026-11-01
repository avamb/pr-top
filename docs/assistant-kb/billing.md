<!-- audience: public -->

# How billing works

PR-TOP subscriptions are handled by Stripe. This how-to walks a
therapist through the day-to-day of managing their plan: where the
plan lives, what an upgrade costs and when it is charged, how
cancellation works, and what to do when a payment step fails.

## Where to change plan

Open the **Subscription** page from the sidebar of the dashboard. You
will see:

- Your current plan and its status (Trial, Active, Canceled, or
  Expired).
- The end date of the current billing period ("Period ends").
- The available tiers with their plan limits, each with an
  **Upgrade to …** or **Downgrade to …** button.

What happens when you click **Upgrade to …** depends on whether you
already pay through Stripe:

- **You are on the Trial, or on a plan without a paid Stripe
  subscription** (for example an expired plan, or a canceled plan
  whose paid period has ended): you are taken to Stripe Checkout to
  enter a card. The new plan is applied once the payment succeeds.
- **You already have an active paid subscription:** no checkout is
  needed. Your existing Stripe subscription is switched to the new
  tier and the prorated price difference for the rest of the current
  billing period is charged to your card on file right away. The new
  plan is applied only after that charge succeeds. If the charge
  fails, your plan is not changed and you see a message asking you to
  check your payment method.
- **Your plan is canceled but the paid period is still running, or
  your last payment is past due:** no new checkout is started,
  because it would create a second subscription and bill you twice.
  A canceled plan has to be resumed first (see below); a past-due
  plan can be changed again once the outstanding payment succeeds.

A downgrade is scheduled for the end of your current billing period,
and you keep your existing tier until then.

## Promo codes

If you were issued a promo code by an event organizer or during a
campaign, enter it in the **Have a promo code?** field. The code
unlocks the associated plan for a fixed number of days once your
redemption is approved.

## Cancellation

You can cancel from the same page with **Cancel subscription**. The
button is shown for active paid plans (not for the Trial, and not
while a downgrade is already scheduled). After you confirm:

1. If you pay through Stripe, PR-TOP first tells Stripe to stop
   renewing your subscription at the end of the current period. No
   further charges are made after that.
2. Your plan is marked **Canceled**, and the page shows "Your access
   continues until …" with the end date of the paid period.
3. Until that date, everything keeps working exactly as before —
   clients, sessions, dashboard and all features of your tier.
4. When the period ends, Stripe ends the subscription and the
   dashboard and client areas are locked. You are redirected to the
   Subscription page until you choose a plan again. Nothing is
   deleted by cancellation, and resubscribing restores access.

If PR-TOP cannot reach Stripe to stop the renewal, the cancellation is
not recorded at all, so you are never left in a state where the app
says "canceled" while Stripe keeps billing. You see an error and can
simply try again a few minutes later.

## Resuming a canceled subscription

Changed your mind? As long as the paid period has not ended, the
canceled-plan notice on the Subscription page shows a **Resume
subscription** link. Clicking it switches renewal back on in Stripe
first, then marks your plan as active again; the page confirms that
the subscription will renew automatically at the end of the current
period. Nothing is charged when you resume — the next charge is the
normal renewal. If the paid period has already ended, the link is
gone and you subscribe again through checkout instead.

## Invoices and receipts

Stripe emails a receipt for each successful payment to your account
email address. The **Payment History** table at the bottom of the
Subscription page lists your payments with date, amount, status and
payment ID. A prorated upgrade charge appears there as its own
payment once Stripe confirms it.

## Edge cases

- **Mid-cycle upgrade.** Stripe pro-rates the price difference and
  invoices it immediately. You pay a fraction of the higher tier for
  the rest of the current period now, and the full new price at the
  next renewal.
- **Upgrade from the Trial.** The Trial has no card on file, so an
  upgrade always goes through Stripe Checkout first.
- **Upgrade while a plan was granted by an administrator.** An
  admin-granted plan has no Stripe subscription to change, so the
  plan cards are hidden and the plan is managed by the administrator.
- **Cancel during the Trial.** The Trial is not a paid subscription,
  so there is nothing to cancel in Stripe; it simply ends on its
  trial end date.
- **Card declined at renewal.** Stripe retries the payment. While the
  subscription is past due you keep access, but plan changes wait
  until the payment succeeds. If Stripe finally ends the subscription
  or marks it unpaid, access ends.
- **Downgrade with too many clients.** If you have more clients than
  the target tier allows, your existing client links are preserved,
  but you cannot add new clients until you are within the limit.

## Troubleshooting

- **"The upgrade payment could not be completed."** Stripe declined
  the prorated charge (insufficient funds, expired card, or a security
  check). Your plan was not changed. Update your card and try again.
- **"We could not reach the payment provider."** PR-TOP could not talk
  to Stripe. Nothing was changed — neither your plan nor your
  cancellation. Wait a few minutes and retry.
- **"Billing is temporarily unavailable."** Payments are not set up on
  the server right now. Nothing was changed; try again later or
  contact support.
- **"Resume it first, then change your plan."** Your plan is canceled
  but still running. Click **Resume subscription**, then upgrade.
- **"Your last payment did not go through."** The subscription is
  past due. Stripe retries the charge automatically; plan changes are
  available again once it succeeds.
- **"This subscription has already ended and can no longer be
  resumed."** The paid period is over. Pick a plan to subscribe
  again.
- **Promo code rejected.** The code may be expired, fully redeemed,
  or scoped to a different tier than the one you picked.
- **Invoice missing from history.** Invoices sync from Stripe within
  10 minutes of payment. Refresh and wait; contact support if it does
  not appear the next day.
- **Access to Pro features lost mid-cycle.** Confirm the plan status
  on the Subscription page. A failed renewal or a period that has
  ended after cancellation is the usual cause.

## FAQ

**Q: Do I need a credit card to try PR-TOP?**
A: No. The Trial does not ask for a card. You are prompted for one
only when switching to any paid plan, through Stripe Checkout.

**Q: When am I charged for an upgrade?**
A: If you already have an active paid subscription, immediately: the
prorated difference for the rest of the current period is charged to
your card on file, and the new tier unlocks right after the charge
succeeds. From the Trial, you pay in Stripe Checkout.

**Q: What currency am I billed in?**
A: Your card's home currency. Stripe converts from USD at the
current rate; PDF invoices show the exact charged amount.

**Q: Can I get a refund?**
A: Refunds are handled case-by-case per Stripe policy. Contact
support with the invoice ID.

**Q: When does a downgrade actually take effect?**
A: At the end of the current billing period. You keep the higher
tier — and everything in it — until then.

**Q: Does canceling stop billing right away?**
A: Canceling stops the next renewal in Stripe, so you are not charged
again. You are not refunded for the current period, and you keep full
access until the end of it.

**Q: Can I undo a cancellation?**
A: Yes, until the end of the paid period. Click **Resume
subscription** on the Subscription page; renewal is switched back on
in Stripe and nothing is charged until the normal renewal date.

**Q: What happens to my data if I cancel?**
A: Nothing is deleted at cancellation. Your access continues until
the end of the paid period; after that the dashboard is locked until
you pick a plan again, and resubscribing restores access to your
existing data.

**Q: Where are past invoices stored?**
A: Under the Subscription page → Payment History. Stripe also emails
a receipt for every payment.
