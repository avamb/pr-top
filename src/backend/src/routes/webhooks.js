// Webhook Routes
// Handles Stripe webhook events for payment processing

const express = require('express');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const { isConfigured, getStripeClient } = require('../services/stripe');
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

  // Update subscription status to active
  db.run(
    `UPDATE subscriptions SET status = 'active', updated_at = datetime('now') WHERE id = ?`,
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

  // Update subscription status to past_due
  db.run(
    `UPDATE subscriptions SET status = 'past_due', updated_at = datetime('now') WHERE id = ?`,
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
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(db, subscription) {
  logger.info(`Subscription created: ${subscription.id}, customer: ${subscription.customer}`);

  const customerId = subscription.customer;
  const subResult = db.exec(
    'SELECT id FROM subscriptions WHERE stripe_customer_id = ?',
    [customerId]
  );

  if (subResult.length > 0 && subResult[0].values.length > 0) {
    db.run(
      `UPDATE subscriptions SET stripe_subscription_id = ?, status = 'active',
       current_period_start = ?, current_period_end = ?, updated_at = datetime('now')
       WHERE stripe_customer_id = ?`,
      [
        subscription.id,
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString(),
        customerId
      ]
    );
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(db, subscription) {
  logger.info(`Subscription updated: ${subscription.id}`);

  const status = subscription.cancel_at_period_end ? 'canceled' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'active' ? 'active' : subscription.status;

  db.run(
    `UPDATE subscriptions SET status = ?,
     current_period_start = ?, current_period_end = ?, updated_at = datetime('now')
     WHERE stripe_subscription_id = ?`,
    [
      status,
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
      subscription.id
    ]
  );
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(db, subscription) {
  logger.info(`Subscription deleted: ${subscription.id}`);

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
