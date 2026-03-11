// Subscription & Stripe Routes
// Handles customer creation, subscription management, and Stripe webhooks

const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { createCustomer, getCustomer, createCheckoutSession, isConfigured, isDevMode, getStripeClient, PLAN_PRICES } = require('../services/stripe');
const { getClientLimit, getClientCount, checkClientLimit } = require('../utils/planLimits');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Auth middleware
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/subscription/stripe-status
// Check if Stripe is configured (public endpoint for health checks)
router.get('/stripe-status', (req, res) => {
  res.json({
    configured: isConfigured(),
    dev_mode: isDevMode(),
    message: isConfigured()
      ? (isDevMode() ? 'Stripe running in development mode' : 'Stripe is configured and ready')
      : 'Stripe is not configured. Set STRIPE_SECRET_KEY in environment.'
  });
});

// POST /api/subscription/create-customer
// Create a Stripe customer for the authenticated user
router.post('/create-customer', requireAuth, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        error: 'Stripe is not configured',
        message: 'Payment processing is not available. Set STRIPE_SECRET_KEY in environment.'
      });
    }

    const db = getDatabase();
    const userId = req.user.userId;

    // Check if user exists
    const userResult = db.exec('SELECT id, email, role FROM users WHERE id = ?', [userId]);
    if (userResult.length === 0 || userResult[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0].values[0];
    const userEmail = user[1];
    const userRole = user[2];

    // Only therapists can create subscriptions
    if (userRole !== 'therapist' && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Only therapists can create subscriptions' });
    }

    // Check if user already has a subscription with a Stripe customer
    const subResult = db.exec(
      'SELECT id, stripe_customer_id FROM subscriptions WHERE therapist_id = ?',
      [userId]
    );

    if (subResult.length > 0 && subResult[0].values.length > 0) {
      const existingCustomerId = subResult[0].values[0][1];
      if (existingCustomerId) {
        // Return existing customer
        try {
          const existingCustomer = await getCustomer(existingCustomerId);
          return res.json({
            message: 'Customer already exists',
            customer: {
              id: existingCustomer.id,
              email: existingCustomer.email
            },
            subscription_id: subResult[0].values[0][0]
          });
        } catch (e) {
          logger.warn(`Existing Stripe customer ${existingCustomerId} not found, creating new one`);
        }
      }
    }

    // Create Stripe customer
    const customer = await createCustomer({
      email: userEmail,
      name: req.body.name || undefined,
      userId: userId
    });

    // Create or update subscription record
    if (subResult.length > 0 && subResult[0].values.length > 0) {
      // Update existing subscription with customer ID
      db.run(
        'UPDATE subscriptions SET stripe_customer_id = ?, updated_at = datetime(\'now\') WHERE therapist_id = ?',
        [customer.id, userId]
      );
    } else {
      // Create new subscription record with trial
      db.run(
        `INSERT INTO subscriptions (therapist_id, stripe_customer_id, plan, status, trial_ends_at, created_at, updated_at)
         VALUES (?, ?, 'trial', 'active', datetime('now', '+14 days'), datetime('now'), datetime('now'))`,
        [userId, customer.id]
      );
    }

    saveDatabase();

    logger.info(`Stripe customer created for user ${userId}: ${customer.id}`);

    res.status(201).json({
      message: 'Stripe customer created successfully',
      customer: {
        id: customer.id,
        email: customer.email
      }
    });
  } catch (error) {
    logger.error('Create customer error: ' + error.message);
    res.status(500).json({ error: 'Failed to create Stripe customer: ' + error.message });
  }
});

// GET /api/subscription/current
// Get current subscription for authenticated user
router.get('/current', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;

    // Try with pending_plan and canceled_at columns, fall back gracefully
    let result;
    let hasPendingPlan = true;
    let hasCanceledAt = true;
    try {
      result = db.exec(
        `SELECT id, stripe_customer_id, stripe_subscription_id, plan, status,
                trial_ends_at, current_period_start, current_period_end, created_at, pending_plan, canceled_at
         FROM subscriptions WHERE therapist_id = ?`,
        [userId]
      );
    } catch (e) {
      hasCanceledAt = false;
      try {
        result = db.exec(
          `SELECT id, stripe_customer_id, stripe_subscription_id, plan, status,
                  trial_ends_at, current_period_start, current_period_end, created_at, pending_plan
           FROM subscriptions WHERE therapist_id = ?`,
          [userId]
        );
      } catch (e2) {
        hasPendingPlan = false;
        result = db.exec(
          `SELECT id, stripe_customer_id, stripe_subscription_id, plan, status,
                  trial_ends_at, current_period_start, current_period_end, created_at
           FROM subscriptions WHERE therapist_id = ?`,
          [userId]
        );
      }
    }

    if (result.length === 0 || result[0].values.length === 0) {
      return res.json({ subscription: null });
    }

    const sub = result[0].values[0];
    res.json({
      subscription: {
        id: sub[0],
        stripe_customer_id: sub[1],
        stripe_subscription_id: sub[2],
        plan: sub[3],
        status: sub[4],
        trial_ends_at: sub[5],
        current_period_start: sub[6],
        current_period_end: sub[7],
        created_at: sub[8],
        pending_plan: hasPendingPlan ? (sub[9] || null) : null,
        canceled_at: hasCanceledAt ? (sub[10] || null) : null
      }
    });
  } catch (error) {
    logger.error('Get subscription error: ' + error.message);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// GET /api/subscription/payments
// Get payment history for authenticated user
router.get('/payments', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;

    // Get subscription first
    const subResult = db.exec(
      'SELECT id FROM subscriptions WHERE therapist_id = ?',
      [userId]
    );

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.json({ payments: [] });
    }

    const subscriptionId = subResult[0].values[0][0];

    const result = db.exec(
      `SELECT id, stripe_payment_intent_id, amount, currency, status, created_at
       FROM payments WHERE subscription_id = ?
       ORDER BY created_at DESC`,
      [subscriptionId]
    );

    const payments = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      stripe_payment_intent_id: row[1],
      amount: row[2],
      currency: row[3],
      status: row[4],
      created_at: row[5]
    }));

    res.json({ payments });
  } catch (error) {
    logger.error('Get payments error: ' + error.message);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// POST /api/subscription/change-plan
// Change subscription plan (upgrade or downgrade)
// Upgrades take effect immediately. Downgrades are scheduled for end of current period.
router.post('/change-plan', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;
    const { plan: newPlan } = req.body;

    const validPlans = ['basic', 'pro', 'premium'];
    if (!newPlan || !validPlans.includes(newPlan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be one of: ' + validPlans.join(', ') });
    }

    // Get current subscription
    let subResult;
    try {
      subResult = db.exec(
        'SELECT id, plan, status, current_period_end, pending_plan FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
    } catch (e) {
      subResult = db.exec(
        'SELECT id, plan, status, current_period_end FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
    }

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subId = subResult[0].values[0][0];
    const currentPlan = subResult[0].values[0][1];
    const currentStatus = subResult[0].values[0][2];
    const currentPeriodEnd = subResult[0].values[0][3];

    if (currentStatus !== 'active') {
      return res.status(400).json({ error: 'Subscription is not active' });
    }

    if (currentPlan === newPlan) {
      return res.status(400).json({ error: 'Already on this plan' });
    }

    // Determine if this is an upgrade or downgrade
    const planOrder = { trial: 0, basic: 1, pro: 2, premium: 3 };
    const isDowngrade = planOrder[newPlan] < planOrder[currentPlan];

    const now = new Date();

    if (isDowngrade) {
      // Downgrade: schedule for end of current period, keep current access
      const periodEnd = currentPeriodEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      let downgradeWarning = null;
      const currentClients = getClientCount(userId);
      const newLimit = getClientLimit(newPlan);

      if (currentClients > newLimit) {
        downgradeWarning = {
          message: `You currently have ${currentClients} clients but the ${newPlan} plan allows ${newLimit}. Your existing client links will be preserved, but you won't be able to add new clients until you're within the limit.`,
          current_clients: currentClients,
          new_limit: newLimit,
          excess: currentClients - newLimit
        };
      }

      // Schedule the downgrade - current plan stays active until period end
      db.run(
        `UPDATE subscriptions SET pending_plan = ?, updated_at = datetime('now') WHERE id = ?`,
        [newPlan, subId]
      );
      saveDatabase();

      logger.info(`User ${userId} scheduled downgrade from ${currentPlan} to ${newPlan}, effective at ${periodEnd}`);

      const response = {
        message: `Downgrade to ${newPlan} scheduled. Your ${currentPlan} access continues until ${new Date(periodEnd).toLocaleDateString()}.`,
        subscription: {
          plan: currentPlan,
          pending_plan: newPlan,
          previous_plan: currentPlan,
          is_downgrade: true,
          scheduled: true,
          effective_date: periodEnd,
          current_period_end: periodEnd
        }
      };

      if (downgradeWarning) {
        response.downgrade_warning = downgradeWarning;
      }

      res.json(response);
    } else {
      // Upgrade: takes effect immediately
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      db.run(
        `UPDATE subscriptions SET plan = ?, pending_plan = NULL, current_period_start = ?, current_period_end = ?, updated_at = datetime('now') WHERE id = ?`,
        [newPlan, now.toISOString(), periodEnd.toISOString(), subId]
      );
      saveDatabase();

      logger.info(`User ${userId} upgraded from ${currentPlan} to ${newPlan} (immediate)`);

      res.json({
        message: `Upgraded to ${newPlan} successfully! New features are available immediately.`,
        subscription: {
          plan: newPlan,
          previous_plan: currentPlan,
          is_downgrade: false,
          scheduled: false,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('Change plan error: ' + error.message);
    res.status(500).json({ error: 'Failed to change plan' });
  }
});

// GET /api/subscription/limits
// Get current plan limits and usage for the authenticated therapist
router.get('/limits', requireAuth, (req, res) => {
  try {
    const userId = req.user.userId;
    const limitCheck = checkClientLimit(userId);

    res.json({
      plan: limitCheck.plan,
      clients: {
        current: limitCheck.current,
        limit: limitCheck.limit,
        can_add: limitCheck.allowed,
        message: limitCheck.message
      }
    });
  } catch (error) {
    logger.error('Get limits error: ' + error.message);
    res.status(500).json({ error: 'Failed to get plan limits' });
  }
});

// GET /api/subscription/plans
// Get available plans and pricing
router.get('/plans', (req, res) => {
  const plans = Object.entries(PLAN_PRICES).map(([key, config]) => ({
    id: key,
    name: config.name,
    amount: config.amount,
    currency: config.currency,
    interval: config.interval,
    display_price: `$${(config.amount / 100).toFixed(0)}/mo`
  }));
  res.json({ plans });
});

// POST /api/subscription/checkout
// Create a Stripe checkout session for plan upgrade
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;
    const { plan } = req.body;

    const validPlans = ['basic', 'pro', 'premium'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be one of: ' + validPlans.join(', ') });
    }

    // Check current subscription
    const subResult = db.exec(
      'SELECT id, plan, status, stripe_customer_id FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(404).json({ error: 'No subscription found. Please register first.' });
    }

    const currentPlan = subResult[0].values[0][1];
    const currentStatus = subResult[0].values[0][2];
    let customerId = subResult[0].values[0][3];

    if (currentPlan === plan) {
      return res.status(400).json({ error: 'Already on this plan' });
    }

    // Get user email for customer creation
    const userResult = db.exec('SELECT email FROM users WHERE id = ?', [userId]);
    const userEmail = userResult[0].values[0][0];

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await createCustomer({ email: userEmail, userId });
      customerId = customer.id;
      db.run(
        'UPDATE subscriptions SET stripe_customer_id = ?, updated_at = datetime(\'now\') WHERE therapist_id = ?',
        [customerId, userId]
      );
      saveDatabase();
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await createCheckoutSession({
      customerId,
      plan,
      userId,
      successUrl: `${frontendUrl}/subscription/success`,
      cancelUrl: `${frontendUrl}/subscription`
    });

    // In dev mode, automatically complete the upgrade
    if (isDevMode()) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      db.run(
        `UPDATE subscriptions SET plan = ?, status = 'active', stripe_subscription_id = ?,
         current_period_start = ?, current_period_end = ?, updated_at = datetime('now')
         WHERE therapist_id = ?`,
        [plan, session.id, now.toISOString(), periodEnd.toISOString(), userId]
      );
      // Also create a payment record in dev mode
      const subIdResult = db.exec('SELECT id FROM subscriptions WHERE therapist_id = ?', [userId]);
      if (subIdResult.length > 0 && subIdResult[0].values.length > 0) {
        const subId = subIdResult[0].values[0][0];
        const planPrices = { basic: 1900, pro: 4900, premium: 9900 };
        const amount = planPrices[plan] || 0;
        db.run(
          `INSERT INTO payments (subscription_id, stripe_payment_intent_id, amount, currency, status, created_at)
           VALUES (?, ?, ?, 'usd', 'succeeded', datetime('now'))`,
          [subId, 'pi_dev_' + Date.now(), amount]
        );
      }
      saveDatabase();
      logger.info(`Dev mode: auto-completed upgrade to ${plan} for user ${userId}`);
    }

    res.json({
      checkout_url: session.url,
      session_id: session.id,
      plan,
      dev_mode: isDevMode(),
      auto_completed: isDevMode()
    });
  } catch (error) {
    logger.error('Checkout error: ' + error.message);
    res.status(500).json({ error: 'Failed to create checkout session: ' + error.message });
  }
});

// POST /api/subscription/cancel
// Cancel subscription - access continues until end of current billing period
router.post('/cancel', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;

    let subResult;
    try {
      subResult = db.exec(
        'SELECT id, plan, status, current_period_end, pending_plan FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
    } catch (e) {
      subResult = db.exec(
        'SELECT id, plan, status, current_period_end FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
    }

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subId = subResult[0].values[0][0];
    const currentPlan = subResult[0].values[0][1];
    const currentStatus = subResult[0].values[0][2];
    const currentPeriodEnd = subResult[0].values[0][3];

    if (currentStatus === 'canceled') {
      return res.status(400).json({ error: 'Subscription already canceled' });
    }

    const now = new Date();
    // Access continues until end of current period (or 30 days from now if no period set)
    const accessUntil = currentPeriodEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Ensure canceled_at column exists
    try {
      db.run(`ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT`);
    } catch (e) {
      // Column already exists, ignore
    }

    db.run(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = ?, pending_plan = NULL, updated_at = datetime('now') WHERE id = ?`,
      [now.toISOString(), subId]
    );
    saveDatabase();

    logger.info(`Subscription canceled for user ${userId}. Access continues until ${accessUntil}`);

    res.json({
      message: 'Subscription canceled successfully. Your access continues until the end of your current billing period.',
      subscription: {
        plan: currentPlan,
        status: 'canceled',
        canceled_at: now.toISOString(),
        access_until: accessUntil,
        current_period_end: accessUntil
      }
    });
  } catch (error) {
    logger.error('Cancel error: ' + error.message);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
