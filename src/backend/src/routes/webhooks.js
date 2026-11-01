// Webhook Routes
// Handles Stripe webhook events for payment processing

const express = require('express');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const { isConfigured, getStripeClient, resolvePlanFromStripeSubscription, PLAN_PRICES } = require('../services/stripe');
const emailService = require('../services/emailService');

const router = express.Router();

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 * Note: This route needs raw body for signature verification
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  // True only when STRIPE_WEBHOOK_SECRET is set and constructEvent accepted
  // the signature. Effects that grant trust (email verification) must check
  // this; the pre-existing subscription handling is left as-is.
  let signatureVerified = false;

  try {
    // If webhook secret is configured, verify signature
    if (STRIPE_WEBHOOK_SECRET && STRIPE_WEBHOOK_SECRET !== 'your-stripe-webhook-secret' && isConfigured()) {
      const stripe = getStripeClient();
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      signatureVerified = true;
    } else {
      // Fail closed in production: without a webhook secret anyone could post
      // forged subscription/payment events.
      if (process.env.NODE_ENV === 'production') {
        logger.error('Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not configured in production');
        return res.status(503).json({ error: 'Webhook endpoint not configured' });
      }
      // In development without webhook secret, parse the body directly
      // This allows testing with simulated webhook events
      if (typeof req.body === 'string') {
        event = JSON.parse(req.body);
      } else if (Buffer.isBuffer(req.body)) {
        event = JSON.parse(req.body.toString());
      } else {
        event = req.body;
      }
    }
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  logger.info(`Stripe webhook received: ${event.type} (${event.id || 'no-id'})`);

  const db = getDatabase();

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(db, event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(db, event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(db, event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(db, event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(db, event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(db, event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(db, event.data.object);
        break;

      case 'checkout.session.completed':
        // Plan activation follows the same trust rules as the other
        // subscription events (unsigned events only reach here outside
        // production); the email-verification effect needs a signature.
        await handleCheckoutSessionPlan(db, event.data.object);
        if (signatureVerified) {
          await handleCheckoutSessionCompleted(db, event.data.object);
        } else {
          logger.warn('[STRIPE] unsigned webhook — skipping email verification effect');
        }
        break;

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    saveDatabaseAfterWrite();
    res.json({ received: true, type: event.type });
  } catch (error) {
    logger.error(`Webhook handler error for ${event.type}: ${error.message}`);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentSucceeded(db, paymentIntent) {
  logger.info(`Payment succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount}, customer: ${paymentIntent.customer}`);

  const customerId = paymentIntent.customer;
  if (!customerId) {
    logger.warn('Payment succeeded but no customer ID attached');
    return;
  }

  // Find subscription by stripe customer ID
  const subResult = db.exec(
    'SELECT id FROM subscriptions WHERE stripe_customer_id = ?',
    [customerId]
  );

  if (subResult.length === 0 || subResult[0].values.length === 0) {
    logger.warn(`No subscription found for Stripe customer: ${customerId}`);
    // Create a payment record anyway linked to null subscription
    db.run(
      `INSERT INTO payments (subscription_id, stripe_payment_intent_id, amount, currency, status, created_at)
       VALUES (0, ?, ?, ?, 'succeeded', datetime('now'))`,
      [paymentIntent.id, paymentIntent.amount, paymentIntent.currency || 'usd']
    );
    return;
  }

  const subscriptionId = subResult[0].values[0][0];

  // Record the payment
  db.run(
    `INSERT INTO payments (subscription_id, stripe_payment_intent_id, amount, currency, status, created_at)
     VALUES (?, ?, ?, ?, 'succeeded', datetime('now'))`,
    [subscriptionId, paymentIntent.id, paymentIntent.amount, paymentIntent.currency || 'usd']
  );

  // Update subscription status to active. A canceled (ending) or expired row
  // is left alone: its lifecycle is driven by customer.subscription.* events.
  db.run(
    `UPDATE subscriptions SET status = 'active', updated_at = datetime('now')
     WHERE id = ? AND status IN ('active', 'trialing', 'past_due')`,
    [subscriptionId]
  );

  // Log audit event
  const therapistResult = db.exec(
    'SELECT therapist_id FROM subscriptions WHERE id = ?',
    [subscriptionId]
  );
  if (therapistResult.length > 0 && therapistResult[0].values.length > 0) {
    const therapistId = therapistResult[0].values[0][0];
    db.run(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at)
       VALUES (?, 'payment_succeeded', 'subscription', ?, datetime('now'))`,
      [therapistId, subscriptionId]
    );
  }

  logger.info(`Payment recorded for subscription ${subscriptionId}: ${paymentIntent.id}`);

  // Send payment receipt email (non-blocking)
  if (therapistResult.length > 0 && therapistResult[0].values.length > 0) {
    const therapistId = therapistResult[0].values[0][0];
    const userResult = db.exec('SELECT email, language FROM users WHERE id = ?', [therapistId]);
    if (userResult.length > 0 && userResult[0].values.length > 0) {
      const therapistEmail = userResult[0].values[0][0];
      const therapistLang = userResult[0].values[0][1] || 'en';
      const subInfo = db.exec('SELECT plan, current_period_end FROM subscriptions WHERE id = ?', [subscriptionId]);
      const plan = (subInfo.length > 0 && subInfo[0].values.length > 0) ? subInfo[0].values[0][0] : 'pro';
      const nextBilling = (subInfo.length > 0 && subInfo[0].values.length > 0) ? subInfo[0].values[0][1] : null;
      emailService.sendPaymentReceipt(therapistEmail, {
        amount: paymentIntent.amount,
        currency: paymentIntent.currency || 'usd',
        plan,
        paymentIntentId: paymentIntent.id,
        nextBilling
      }, therapistLang).catch(err => {
        logger.error(`Payment receipt email error: ${err.message}`);
      });
    }
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentFailed(db, paymentIntent) {
  logger.info(`Payment failed: ${paymentIntent.id}, customer: ${paymentIntent.customer}`);

  const customerId = paymentIntent.customer;
  if (!customerId) {
    logger.warn('Payment failed but no customer ID attached');
    return;
  }

  // Find subscription by stripe customer ID
  const subResult = db.exec(
    'SELECT id, therapist_id FROM subscriptions WHERE stripe_customer_id = ?',
    [customerId]
  );

  if (subResult.length === 0 || subResult[0].values.length === 0) {
    logger.warn(`No subscription found for Stripe customer: ${customerId}`);
    return;
  }

  const subscriptionId = subResult[0].values[0][0];
  const therapistId = subResult[0].values[0][1];

  // Record the failed payment
  db.run(
    `INSERT INTO payments (subscription_id, stripe_payment_intent_id, amount, currency, status, created_at)
     VALUES (?, ?, ?, ?, 'failed', datetime('now'))`,
    [subscriptionId, paymentIntent.id, paymentIntent.amount || 0, paymentIntent.currency || 'usd']
  );

  // Update subscription status to past_due. past_due keeps access, so only a
  // running subscription may enter it; expired/canceled rows stay as they are.
  db.run(
    `UPDATE subscriptions SET status = 'past_due', updated_at = datetime('now')
     WHERE id = ? AND status IN ('active', 'trialing')`,
    [subscriptionId]
  );

  // Log audit event for the failure notification
  db.run(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at)
     VALUES (?, 'payment_failed', 'subscription', ?, datetime('now'))`,
    [therapistId, subscriptionId]
  );

  // Log notification (in development, this goes to console)
  logger.warn(`NOTIFICATION: Payment failed for therapist ${therapistId}, subscription ${subscriptionId}. Payment intent: ${paymentIntent.id}`);
  logger.warn(`NOTIFICATION: Please update payment method. Last error: ${paymentIntent.last_payment_error ? paymentIntent.last_payment_error.message : 'unknown'}`);
}

/**
 * Map a Stripe subscription onto the local CHECK-constrained status set.
 * A subscription set to cancel at period end is stored as 'canceled' but keeps
 * access until current_period_end (see requireActiveSubscription); access only
 * ends when Stripe actually ends it. Returns null for states that must not
 * change the local status (incomplete: first payment still pending).
 */
function mapStripeSubscriptionStatus(subscription) {
  const stripeStatus = subscription.status;
  if (['canceled', 'incomplete_expired', 'unpaid', 'paused'].includes(stripeStatus)) return 'expired';
  if (subscription.cancel_at_period_end) return 'canceled';
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return stripeStatus;
  if (stripeStatus === 'past_due') return 'past_due';
  return null;
}

// True when a Stripe subscription has definitively ended (never revive it).
function hasStripeSubscriptionEnded(subscription) {
  return subscription.status === 'canceled' || subscription.status === 'incomplete_expired' || !!subscription.ended_at;
}

function toIsoFromUnix(seconds) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(db, subscription) {
  logger.info(`Subscription created: ${subscription.id}, customer: ${subscription.customer}`);

  const customerId = subscription.customer;
  const subResult = db.exec(
    'SELECT id, status, stripe_subscription_id FROM subscriptions WHERE stripe_customer_id = ?',
    [customerId]
  );

  if (subResult.length === 0 || subResult[0].values.length === 0) return;

  const [, localStatus, localStripeSubId] = subResult[0].values[0];
  if (localStripeSubId === subscription.id && localStatus === 'expired') {
    logger.info(`Subscription created event for already-ended ${subscription.id} ignored`);
    return;
  }

  const status = mapStripeSubscriptionStatus(subscription);
  const plan = resolvePlanFromStripeSubscription(subscription);

  // A new paid subscription replaces any trial / scheduled downgrade / old
  // cancellation on the row.
  db.run(
    `UPDATE subscriptions SET stripe_subscription_id = ?, status = COALESCE(?, status),
     plan = COALESCE(?, plan),
     current_period_start = COALESCE(?, current_period_start), current_period_end = COALESCE(?, current_period_end),
     trial_ends_at = CASE WHEN COALESCE(?, status) = 'active' THEN NULL ELSE trial_ends_at END,
     pending_plan = NULL,
     canceled_at = CASE WHEN COALESCE(?, status) = 'canceled' THEN canceled_at ELSE NULL END,
     updated_at = datetime('now')
     WHERE stripe_customer_id = ?`,
    [
      subscription.id, status, plan,
      toIsoFromUnix(subscription.current_period_start), toIsoFromUnix(subscription.current_period_end),
      status, status, customerId
    ]
  );
  if (!plan) {
    logger.warn(`Subscription created ${subscription.id}: plan could not be resolved, local plan kept`);
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(db, subscription) {
  logger.info(`Subscription updated: ${subscription.id}`);

  // An updated event delivered after customer.subscription.deleted must not
  // revive the ended subscription.
  const localResult = db.exec('SELECT status FROM subscriptions WHERE stripe_subscription_id = ?', [subscription.id]);
  const localStatus = (localResult.length > 0 && localResult[0].values.length > 0) ? localResult[0].values[0][0] : null;
  if (localStatus === 'expired' && hasStripeSubscriptionEnded(subscription)) {
    logger.info(`Subscription updated event for ended ${subscription.id} ignored (already expired)`);
    return;
  }

  const status = mapStripeSubscriptionStatus(subscription);
  const plan = resolvePlanFromStripeSubscription(subscription);
  const canceledAt = status === 'canceled'
    ? new Date((subscription.canceled_at || Math.floor(Date.now() / 1000)) * 1000).toISOString() : null;

  // plan follows the billed price; a scheduled downgrade is cleared once
  // Stripe bills the pending plan; resuming (active) clears canceled_at.
  db.run(
    `UPDATE subscriptions SET status = COALESCE(?, status),
     plan = COALESCE(?, plan),
     pending_plan = CASE WHEN ? IS NOT NULL AND pending_plan = ? THEN NULL ELSE pending_plan END,
     current_period_start = COALESCE(?, current_period_start), current_period_end = COALESCE(?, current_period_end),
     trial_ends_at = CASE WHEN COALESCE(?, status) = 'active' THEN NULL ELSE trial_ends_at END,
     canceled_at = CASE WHEN ? IS NOT NULL THEN COALESCE(canceled_at, ?)
                        WHEN COALESCE(?, status) = 'active' THEN NULL ELSE canceled_at END,
     updated_at = datetime('now')
     WHERE stripe_subscription_id = ?`,
    [
      status, plan, plan, plan,
      toIsoFromUnix(subscription.current_period_start), toIsoFromUnix(subscription.current_period_end),
      status, canceledAt, canceledAt, status, subscription.id
    ]
  );
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(db, subscription) {
  logger.info(`Subscription deleted: ${subscription.id}`);

  // The subscription has ended in Stripe: access ends now.
  db.run(
    `UPDATE subscriptions SET status = 'expired', updated_at = datetime('now')
     WHERE stripe_subscription_id = ?`,
    [subscription.id]
  );
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handleInvoicePaymentSucceeded(db, invoice) {
  logger.info(`Invoice payment succeeded: ${invoice.id}`);
  // Usually handled via payment_intent.succeeded, but log for completeness
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(db, invoice) {
  logger.info(`Invoice payment failed: ${invoice.id}`);
  // Usually handled via payment_intent.payment_failed, but log for completeness
}

/**
 * Handle checkout.session.completed event: activate the purchased plan.
 * The plan comes from the session metadata set by createCheckoutSession; the
 * row is found by client_reference_id / metadata.prtop_user_id, then by the
 * Stripe customer. customer.subscription.created applies the same plan, so
 * the order in which the two events arrive does not matter.
 */
async function handleCheckoutSessionPlan(db, session) {
  if (session.mode && session.mode !== 'subscription') return;
  if (session.payment_status && !['paid', 'no_payment_required'].includes(session.payment_status)) {
    logger.info(`Checkout session ${session.id}: payment_status=${session.payment_status}, plan not activated`);
    return;
  }

  const metaPlan = session.metadata && session.metadata.plan;
  const plan = (typeof metaPlan === 'string' && PLAN_PRICES[metaPlan]) ? metaPlan : null;
  const stripeSubId = typeof session.subscription === 'string'
    ? session.subscription
    : (session.subscription && session.subscription.id) || null;
  if (!plan && !stripeSubId) return;

  const ref = session.client_reference_id || (session.metadata && session.metadata.prtop_user_id);
  let rowId = null;
  if (ref !== undefined && ref !== null && /^\d+$/.test(String(ref))) {
    const byUser = db.exec('SELECT id FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1', [Number(ref)]);
    if (byUser.length > 0 && byUser[0].values.length > 0) rowId = byUser[0].values[0][0];
  }
  if (!rowId && session.customer) {
    const byCustomer = db.exec('SELECT id FROM subscriptions WHERE stripe_customer_id = ? ORDER BY created_at DESC LIMIT 1', [session.customer]);
    if (byCustomer.length > 0 && byCustomer[0].values.length > 0) rowId = byCustomer[0].values[0][0];
  }
  if (!rowId) {
    logger.warn(`Checkout session ${session.id}: no subscription row matched, plan not activated`);
    return;
  }

  db.run(
    `UPDATE subscriptions SET plan = COALESCE(?, plan), status = 'active',
     stripe_subscription_id = COALESCE(?, stripe_subscription_id),
     stripe_customer_id = COALESCE(stripe_customer_id, ?),
     trial_ends_at = NULL, pending_plan = NULL, canceled_at = NULL,
     updated_at = datetime('now')
     WHERE id = ?`,
    [plan, stripeSubId, session.customer || null, rowId]
  );
  logger.info(`Checkout session ${session.id}: subscription row ${rowId} activated on plan ${plan || '(unchanged)'}`);
}

/**
 * Handle checkout.session.completed event (wave 2, track 2A)
 * A completed Stripe Checkout proves the person controls the mailbox Stripe
 * mailed the receipt to, so the account counts as email-verified. Resolved by
 * client_reference_id (numeric user id) first, then by the checkout email.
 * Only sets email_verified_at when it is still NULL; the pending verification
 * token is left in place so a later click on the link lands on
 * /dashboard?verified=already instead of an error.
 */
async function handleCheckoutSessionCompleted(db, session) {
  const email = String(
    session.customer_email || (session.customer_details && session.customer_details.email) || ''
  ).trim().toLowerCase();
  const ref = session.client_reference_id;
  logger.info(`Checkout session completed: ${session.id}, customer: ${session.customer || 'n/a'}, ref: ${ref || 'n/a'}`);

  let userId = null;

  if (ref !== undefined && ref !== null && /^\d+$/.test(String(ref))) {
    const byId = db.exec("SELECT id FROM users WHERE id = ? AND role = 'therapist'", [Number(ref)]);
    if (byId.length > 0 && byId[0].values.length > 0) {
      userId = byId[0].values[0][0];
    }
  }

  if (!userId && email) {
    const byEmail = db.exec("SELECT id FROM users WHERE LOWER(email) = ? AND role = 'therapist'", [email]);
    if (byEmail.length > 0 && byEmail[0].values.length > 0) {
      userId = byEmail[0].values[0][0];
    }
  }

  if (!userId) {
    logger.warn(`Checkout session ${session.id}: no therapist matched (ref=${ref || 'n/a'}, email=${email ? 'present' : 'absent'})`);
    return;
  }

  const before = db.exec('SELECT email_verified_at FROM users WHERE id = ?', [userId]);
  const wasVerified = before.length > 0 && before[0].values.length > 0 && !!before[0].values[0][0];

  db.run(
    "UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?",
    [userId]
  );

  if (!wasVerified) {
    db.run(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
       VALUES (?, 'email_verified', 'user', ?, ?, datetime('now'))`,
      [userId, userId, JSON.stringify({ source: 'stripe_checkout', checkout_session_id: session.id || null })]
    );
    logger.info(`Checkout session ${session.id}: marked user id=${userId} as email-verified`);
  } else {
    logger.info(`Checkout session ${session.id}: user id=${userId} already email-verified`);
  }
}

module.exports = router;
