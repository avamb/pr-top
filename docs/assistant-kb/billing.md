<!-- audience: public -->

# How billing works

PR-TOP subscriptions are handled by Stripe. This how-to walks a
therapist through the day-to-day of managing their plan.

## Where to change plan

Open **Settings → Subscription** on the dashboard. You will see:

- Your current plan and its status (Trial, Active, Canceled, or
  Expired).
- The renewal date and the amount that will be charged.
- The four available tiers (Trial, Basic, Pro, Premium) with the
  plan limits documented on the pricing page.

Click **Upgrade to Pro** (or any other tier) to be taken to Stripe
Checkout. The upgrade is applied as soon as the payment succeeds.
A downgrade is scheduled for the end of your current billing period,
and you keep your existing tier until then.

## Promo codes

If you were issued a promo code by an event organizer or during a
campaign, enter it in the **Have a promo code?** field. The code
unlocks the associated plan for a fixed number of days once your
redemption is approved.

## Cancellation

You can cancel from the same page. Cancellation keeps your access
active until the end of the paid period and preserves your data.
When the period ends, PR-TOP reverts your account to read-only —
nothing is deleted. Resubscribing at any time restores full access.

## Invoices and receipts

Stripe emails a receipt for each successful payment to your account
email address. You can also download PDF invoices from Stripe's
customer portal, which is reachable from the same Subscription
page.

## Edge cases

- **Mid-cycle upgrade.** Stripe pro-rates the price difference
  automatically. You pay a fraction of the higher tier for the rest of
  the current period and the full new price at the next renewal.
- **Card declined at renewal.** Stripe retries three times over the
  following week. During dunning you keep access; after the final
  failed attempt the plan reverts to read-only.
- **Downgrade with too many clients.** If you have more clients than
  the target tier allows, archive some first. Archived clients do not
  count against the seat cap.

## Troubleshooting

- **Card declined.** Update the card in the Subscription panel and
  retry. Stripe reports the specific reason in the payment modal.
- **Promo code rejected.** The code may be expired, fully redeemed,
  or scoped to a different tier than the one you picked.
- **Invoice missing from history.** Invoices sync from Stripe within
  10 minutes of payment. Refresh and wait; contact support if it does
  not appear the next day.
- **Access to Pro features lost mid-cycle.** Confirm the plan status
  in Settings → Subscription. A failed renewal or scheduled downgrade
  is the usual cause.

## FAQ

**Q: Do I need a credit card to try PR-TOP?**
A: No. The 14-day Trial does not ask for a card. You are prompted
for one only when you upgrade to Basic, Pro, or Premium.

**Q: What currency am I billed in?**
A: Your card's home currency. Stripe converts from USD at the
current rate; PDF invoices show the exact charged amount.

**Q: Can I get a refund?**
A: Refunds are handled case-by-case per Stripe policy. Contact
support with the invoice ID.

**Q: When does a downgrade actually take effect?**
A: At the end of the current billing period. You keep the higher
tier — and everything in it — until then.

**Q: What happens to my data if I cancel?**
A: Nothing is deleted at cancellation. Your account goes read-only at
the end of the paid period and stays that way for 90 days, then
enters a 30-day final grace before purging. Resubscribing during the
grace restores everything without a restore step.

**Q: Where are past invoices stored?**
A: Under Settings → Subscription → Invoice history. Each row links to
a Stripe-hosted PDF.
