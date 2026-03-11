// Subscription & Stripe Routes
// Handles customer creation, subscription management, and Stripe webhooks

const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { createCustomer, getCustomer, isConfigured, isDevMode, getStripeClient } = require('../services/stripe');
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

    const result = db.exec(
      `SELECT id, stripe_customer_id, stripe_subscription_id, plan, status,
              trial_ends_at, current_period_start, current_period_end, created_at
       FROM subscriptions WHERE therapist_id = ?`,
      [userId]
    );

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
        created_at: sub[8]
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

module.exports = router;
