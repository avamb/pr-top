// Webhook Routes
// Handles Stripe webhook events for payment processing

const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { isConfigured, getStripeClient } = require('../services/stripe');

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

  try {
    // If webhook secret is configured, verify signature
    if (STRIPE_WEBHOOK_SECRET && STRIPE_WEBHOOK_SECRET !== 'your-stripe-webhook-secret' && isConfigured()) {
      const stripe = getStripeClient();
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
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

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    saveDatabase();
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

module.exports = router;
