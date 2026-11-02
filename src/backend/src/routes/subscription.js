// Subscription & Stripe Routes
// Handles customer creation, subscription management, and Stripe webhooks

const express = require('express');
const crypto = require('crypto');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const {
  createCustomer, getCustomer, createCheckoutSession, isConfigured, isStripeTestMode, getStripeClient, PLAN_PRICES,
  isRealStripeSubscriptionId, changeSubscriptionPlan, scheduleSubscriptionPlanChange, cancelSubscriptionAtPeriodEnd,
  resumeSubscription, isStripeResourceMissing, retrieveSubscription, subscriptionItemIsPlanPrice
} = require('../services/stripe');
const { parseSubscriptionDate, authenticate } = require('../middleware/auth');
const { getClientLimit, getClientCount, checkClientLimit } = require('../utils/planLimits');

const router = express.Router();
// Shared auth (role, blocked state and token_version re-read from the DB).
// Routes here historically read req.user.userId (the raw JWT claim); keep it
// as an alias of the DB-backed id.
function requireAuth(req, res, next) {
  authenticate(req, res, () => {
    req.user.userId = req.user.id;
    next();
  });
}

// GET /api/subscription/stripe-status
// Check if Stripe is configured (public endpoint for health checks)
router.get('/stripe-status', (req, res) => {
  res.json({
    configured: isConfigured(),
    dev_mode: isStripeTestMode(),
    message: isConfigured()
      ? (isStripeTestMode() ? 'Stripe running in development mode' : 'Stripe is configured and ready')
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

    saveDatabaseAfterWrite();

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
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// GET /api/subscription/current
// Get current subscription for authenticated user
router.get('/current', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;

    // Ensure canceled_at column exists (migration may not have run yet)
    try { db.run('ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT'); } catch (e) { /* exists */ }

    let result;
    try {
      result = db.exec(
        `SELECT id, stripe_customer_id, stripe_subscription_id, plan, status,
                trial_ends_at, current_period_start, current_period_end, created_at,
                pending_plan, canceled_at, is_manual_override, override_reason, override_expires_at
         FROM subscriptions WHERE therapist_id = ?`,
        [userId]
      );
    } catch (e) {
      // Fallback if override columns don't exist yet
      result = db.exec(
        `SELECT id, stripe_customer_id, stripe_subscription_id, plan, status,
                trial_ends_at, current_period_start, current_period_end, created_at,
                pending_plan, canceled_at
         FROM subscriptions WHERE therapist_id = ?`,
        [userId]
      );
    }

    if (result.length === 0 || result[0].values.length === 0) {
      return res.json({ subscription: null });
    }

    const sub = result[0].values[0];
    const isManualOverride = sub.length > 11 ? !!sub[11] : false;
    const overrideExpiresAt = sub.length > 13 ? sub[13] : null;

    // Check if manual override has expired
    if (isManualOverride && overrideExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(overrideExpiresAt);
      if (now > expiresAt) {
        // Override expired - reset to trial
        db.run(
          `UPDATE subscriptions SET plan = 'trial', is_manual_override = 0, override_reason = NULL, override_expires_at = NULL, override_set_by = NULL, status = 'active', updated_at = datetime('now') WHERE therapist_id = ?`,
          [userId]
        );
        // Audit log
        db.run(
          "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (NULL, 'override_expired', 'user', ?, ?, datetime('now'))",
          [userId, JSON.stringify({ previous_plan: sub[3], expired_at: overrideExpiresAt })]
        );
        saveDatabaseAfterWrite();

        logger.info(`Manual plan override expired for therapist ${userId}. Reverted to trial.`);

        return res.json({
          subscription: {
            id: sub[0],
            stripe_customer_id: sub[1],
            stripe_subscription_id: sub[2],
            plan: 'trial',
            status: 'active',
            trial_ends_at: sub[5],
            current_period_start: sub[6],
            current_period_end: sub[7],
            created_at: sub[8],
            pending_plan: null,
            canceled_at: null,
            is_manual_override: false,
            override_reason: null,
            override_expires_at: null,
            override_expired: true
          }
        });
      }
    }

    // A scheduled downgrade whose period has ended takes effect now
    if (sub[9] && applyDuePendingPlan(db, sub[0], sub[9], sub[7], sub[2])) {
      sub[3] = sub[9];
      sub[9] = null;
    }

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
        pending_plan: sub[9] || null,
        canceled_at: sub[10] || null,
        is_manual_override: isManualOverride,
        override_reason: sub.length > 12 ? sub[12] : null,
        override_expires_at: overrideExpiresAt
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

// True when Stripe runs on placeholder keys in production: billing must not
// silently fall back to dev-mode behaviour (free upgrades, fake checkouts).
function isBillingUnavailableInProduction() {
  return isStripeTestMode() && process.env.NODE_ENV === 'production';
}

// ── Per-therapist billing lock ────────────────────────────────────────────
// change-plan / cancel / resume each read the row, call Stripe (await) and
// write the row. Two overlapping requests of the same therapist (a
// double-click, two tabs) could both act on the same stale row and charge
// twice. The backend is a single process, so a chain of promises per
// therapist serialises them; each handler reads the row only after the lock
// is held. The lock is released when the response finishes (or the
// connection closes); a request whose client left while waiting is dropped.
const billingLocks = new Map(); // therapistId -> tail promise of the chain

function billingLock(req, res, next) {
  const key = String(req.user.userId);
  const previous = billingLocks.get(key) || Promise.resolve();
  let release;
  const mine = new Promise((resolve) => { release = resolve; });
  const tail = previous.then(() => mine);
  billingLocks.set(key, tail);

  let released = false;
  const done = () => {
    if (released) return;
    released = true;
    release();
    if (billingLocks.get(key) === tail) billingLocks.delete(key);
  };
  res.on('finish', done);
  res.on('close', done);

  previous.then(() => {
    if (released) return; // client went away while waiting: do nothing
    next();
  });
}

// Apply a scheduled downgrade whose billing period has ended, on a row
// without a Stripe subscription (admin-granted, dev mode). Stripe-backed rows
// change plan only through the renewal webhook, which reads the live Stripe
// subscription. Returns true when the row was changed.
function applyDuePendingPlan(db, subId, pendingPlan, currentPeriodEnd, stripeSubscriptionId) {
  if (!pendingPlan) return false;
  if (typeof stripeSubscriptionId === 'string' && stripeSubscriptionId.startsWith('sub_')) return false;
  const periodEnd = parseSubscriptionDate(currentPeriodEnd);
  if (!periodEnd || periodEnd > new Date()) return false;
  db.run(
    `UPDATE subscriptions SET plan = pending_plan, pending_plan = NULL, updated_at = datetime('now')
     WHERE id = ? AND pending_plan = ?`,
    [subId, pendingPlan]
  );
  if (db.getRowsModified() === 0) return false;
  saveDatabaseAfterWrite();
  logger.info(`Subscription ${subId}: scheduled downgrade to ${pendingPlan} applied (period ended ${currentPeriodEnd})`);
  return true;
}

function stripePeriodEndIso(stripeSubscription) {
  if (!stripeSubscription) return null;
  const item = stripeSubscription.items && stripeSubscription.items.data && stripeSubscription.items.data[0];
  const end = stripeSubscription.current_period_end || (item && item.current_period_end);
  return end ? new Date(end * 1000).toISOString() : null;
}

// Live Stripe subscription, or null when it cannot be loaded.
async function tryRetrieveSubscription(stripeSubscriptionId) {
  try {
    return await retrieveSubscription(stripeSubscriptionId);
  } catch (error) {
    logger.warn(`Could not load Stripe subscription ${stripeSubscriptionId}: ${error.message}`);
    return null;
  }
}

/**
 * Switch the Stripe subscription to renew on `plan` (no proration) and record
 * pending_plan = plan locally. pending_plan is written BEFORE the Stripe call:
 * the customer.subscription.updated webhook caused by the switch can arrive
 * before Stripe's API response, and pending_plan is what keeps the paid tier
 * until the renewal. When the call fails, the live subscription decides:
 *   applied - Stripe did switch (the response was lost): keep pending_plan
 *   failed  - Stripe is not on that price: pending_plan reset to restorePending
 *   unknown - the live state could not be loaded either: pending_plan kept;
 *             the next webhook (live state) settles the row
 */
async function scheduleDowngradeInStripe(db, subId, stripeSubscriptionId, plan, restorePending, idempotencyKey) {
  db.run(`UPDATE subscriptions SET pending_plan = ?, updated_at = datetime('now') WHERE id = ?`, [plan, subId]);
  saveDatabaseAfterWrite();
  try {
    const updated = await scheduleSubscriptionPlanChange(stripeSubscriptionId, plan, { idempotencyKey });
    return { status: 'applied', subscription: updated };
  } catch (error) {
    logger.error(`Stripe price switch to ${plan} failed for ${stripeSubscriptionId}: ${error.message}`);
    const live = await tryRetrieveSubscription(stripeSubscriptionId);
    if (!live) return { status: 'unknown', error };
    if (subscriptionItemIsPlanPrice(live, plan)) return { status: 'applied', subscription: live };
    db.run(
      `UPDATE subscriptions SET pending_plan = ?, updated_at = datetime('now') WHERE id = ? AND pending_plan = ?`,
      [restorePending || null, subId, plan]
    );
    saveDatabaseAfterWrite();
    return { status: 'failed', error };
  }
}

/**
 * Undo a scheduled downgrade in Stripe: switch the price back to `currentPlan`
 * (no proration), but only if the item really is on the pending plan's price
 * (rows from before wave 2 may never have switched it). Returns
 * { ok: true, reverted } or { ok: false, error } (nothing changed in Stripe,
 * as far as can be verified).
 */
async function revertPendingPrice(stripeSubscriptionId, currentPlan, pendingPlan, idempotencyKey) {
  let live;
  try {
    live = await retrieveSubscription(stripeSubscriptionId);
  } catch (error) {
    return { ok: false, error };
  }
  if (!subscriptionItemIsPlanPrice(live, pendingPlan)) return { ok: true, reverted: false };
  try {
    await scheduleSubscriptionPlanChange(stripeSubscriptionId, currentPlan, { idempotencyKey });
    return { ok: true, reverted: true };
  } catch (error) {
    const after = await tryRetrieveSubscription(stripeSubscriptionId);
    if (after && !subscriptionItemIsPlanPrice(after, pendingPlan)) return { ok: true, reverted: true };
    return { ok: false, error };
  }
}

const STRIPE_UNCONFIRMED = {
  error: 'We could not confirm the change with the payment provider. Please reload this page in a minute to see the current state.',
  code: 'stripe_unconfirmed'
};

// POST /api/subscription/change-plan
// Subscriptions without a Stripe subscription (trial, admin-granted) get
// 402 requires_checkout for upgrades; Stripe-backed upgrades are applied
// locally only after the prorated Stripe charge succeeds.
//
// Downgrades are scheduled for the end of the current paid period:
// - Stripe-backed: the Stripe price is switched right away WITHOUT proration
//   (nothing charged or credited), so Stripe bills the lower plan from the
//   next renewal. pending_plan holds the new plan and the local plan keeps
//   the paid tier until customer.subscription.updated reports the new period
//   (routes/webhooks.js resolveLocalPlanChange).
// - No Stripe subscription: pending_plan is applied once current_period_end
//   has passed (applyDuePendingPlan; gates see it via
//   getEffectiveSubscriptionAccess). Without a running period it applies now.
// Choosing the current plan again while a downgrade is scheduled undoes it
// ("Keep current plan" on the Subscription page).
// Every Stripe update carries an idempotency key (therapist + action + target
// plan + per-request nonce); after a failed call the live subscription is
// checked, so a lost response is not mistaken for a failure.
router.post('/change-plan', requireAuth, billingLock, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;
    const { plan: newPlan } = req.body;
    const nonce = crypto.randomUUID();
    const idemKey = (action, plan) => `prtop-${userId}-${action}-${plan}-${nonce}`;

    const validPlans = ['confirm', 'basic', 'pro', 'premium'];
    if (!newPlan || !validPlans.includes(newPlan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be one of: ' + validPlans.join(', ') });
    }

    // Get current subscription (read only after the billing lock is held)
    const subResult = db.exec(
      'SELECT id, plan, status, current_period_end, stripe_subscription_id, pending_plan FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subId = subResult[0].values[0][0];
    let currentPlan = subResult[0].values[0][1];
    const currentStatus = subResult[0].values[0][2];
    let currentPeriodEnd = subResult[0].values[0][3];
    const stripeSubscriptionId = subResult[0].values[0][4];
    let pendingPlan = subResult[0].values[0][5] || null;

    // Trialing subscriptions have no paid Stripe subscription yet: any paid
    // plan has to be bought through checkout.
    if (currentStatus === 'trialing') {
      return res.status(402).json({
        error: 'Please complete checkout to switch to a paid plan.',
        requires_checkout: true,
        plan: newPlan
      });
    }

    if (currentStatus !== 'active') {
      return res.status(400).json({ error: 'Subscription is not active' });
    }

    // A downgrade whose period already ended counts as applied (non-Stripe rows)
    if (applyDuePendingPlan(db, subId, pendingPlan, currentPeriodEnd, stripeSubscriptionId)) {
      currentPlan = pendingPlan;
      pendingPlan = null;
    }

    const hasStripeSubscription = isRealStripeSubscriptionId(stripeSubscriptionId);
    // Stripe-backed row, but Stripe is not configured in production: a local
    // change would leave Stripe billing the old price.
    const stripeUnavailable = typeof stripeSubscriptionId === 'string' &&
      stripeSubscriptionId.startsWith('sub_') && isBillingUnavailableInProduction();

    if (currentPlan === newPlan) {
      if (!pendingPlan) {
        return res.status(400).json({ error: 'Already on this plan' });
      }
      // Undo the scheduled downgrade: Stripe renews on the current plan again
      if (stripeUnavailable) {
        logger.error(`Change plan refused for user ${userId}: Stripe is not configured in production`);
        return res.status(503).json({ error: 'Billing is temporarily unavailable. Please try again later.' });
      }
      if (hasStripeSubscription) {
        const revert = await revertPendingPrice(stripeSubscriptionId, currentPlan, pendingPlan, idemKey('undo', currentPlan));
        if (!revert.ok) {
          logger.error(`Stripe downgrade undo failed for user ${userId} (${stripeSubscriptionId}): ${revert.error && revert.error.message}`);
          return res.status(502).json({
            error: 'We could not reach the payment provider to cancel the scheduled downgrade. Nothing was changed. Please try again.',
            code: 'stripe_error'
          });
        }
      }
      db.run(`UPDATE subscriptions SET pending_plan = NULL, updated_at = datetime('now') WHERE id = ?`, [subId]);
      saveDatabaseAfterWrite();
      logger.info(`User ${userId} canceled the scheduled downgrade to ${pendingPlan}; stays on ${currentPlan}`);
      return res.json({
        message: `The scheduled downgrade to ${pendingPlan} was canceled. You stay on ${currentPlan}.`,
        downgrade_canceled: true,
        plan: currentPlan,
        pending_plan: null
      });
    }

    // Determine if this is an upgrade or downgrade
    const planOrder = { trial: 0, confirm: 0.5, basic: 1, pro: 2, premium: 3 };
    const isDowngrade = planOrder[newPlan] < planOrder[currentPlan];

    const now = new Date();

    if (isDowngrade) {
      if (pendingPlan === newPlan) {
        return res.status(400).json({ error: 'This downgrade is already scheduled' });
      }

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

      if (stripeUnavailable) {
        logger.error(`Change plan refused for user ${userId}: Stripe is not configured in production`);
        return res.status(503).json({ error: 'Billing is temporarily unavailable. Please try again later.' });
      }

      const periodEndDate = parseSubscriptionDate(currentPeriodEnd);
      const periodRunning = !!periodEndDate && periodEndDate > now;

      if (!hasStripeSubscription && !periodRunning) {
        // No paid period to wait for (no Stripe billing): switch right away.
        // The client shows its own localized message for `switched: true`.
        db.run(
          `UPDATE subscriptions SET plan = ?, pending_plan = NULL, updated_at = datetime('now') WHERE id = ?`,
          [newPlan, subId]
        );
        saveDatabaseAfterWrite();
        logger.info(`User ${userId} downgraded from ${currentPlan} to ${newPlan} (no running paid period, immediate)`);
        const immediate = {
          message: `Switched to ${newPlan}.`,
          switched: true,
          subscription: {
            plan: newPlan,
            pending_plan: null,
            previous_plan: currentPlan,
            is_downgrade: true,
            scheduled: false
          }
        };
        if (downgradeWarning) immediate.downgrade_warning = downgradeWarning;
        return res.json(immediate);
      }

      if (hasStripeSubscription) {
        const result = await scheduleDowngradeInStripe(
          db, subId, stripeSubscriptionId, newPlan, pendingPlan, idemKey('downgrade', newPlan)
        );
        if (result.status === 'failed') {
          logger.error(`Stripe downgrade scheduling failed for user ${userId} (${currentPlan} -> ${newPlan})`);
          return res.status(502).json({
            error: 'We could not reach the payment provider to schedule the downgrade. Nothing was changed. Please try again.',
            code: 'stripe_error'
          });
        }
        if (result.status === 'unknown') {
          logger.error(`Stripe downgrade for user ${userId} (${currentPlan} -> ${newPlan}) unconfirmed; pending_plan kept for the webhook to settle`);
          return res.status(502).json(STRIPE_UNCONFIRMED);
        }
        const stripeEnd = stripePeriodEndIso(result.subscription);
        if (stripeEnd) {
          currentPeriodEnd = stripeEnd;
          db.run(
            `UPDATE subscriptions SET current_period_end = ?, updated_at = datetime('now') WHERE id = ?`,
            [stripeEnd, subId]
          );
          saveDatabaseAfterWrite();
        }
      } else {
        db.run(
          `UPDATE subscriptions SET pending_plan = ?, updated_at = datetime('now') WHERE id = ?`,
          [newPlan, subId]
        );
        saveDatabaseAfterWrite();
      }

      const periodEnd = currentPeriodEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      logger.info(`User ${userId} scheduled downgrade from ${currentPlan} to ${newPlan}, effective at ${periodEnd}${hasStripeSubscription ? ` (Stripe ${stripeSubscriptionId}, no proration)` : ''}`);

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
    } else if (isStripeTestMode()) {
      // Dev-mode upgrade (placeholder Stripe keys): never in production
      if (isBillingUnavailableInProduction()) {
        logger.error(`Change plan refused for user ${userId}: Stripe is not configured in production`);
        return res.status(503).json({ error: 'Billing is temporarily unavailable. Please try again later.' });
      }

      // Upgrade: takes effect immediately, no charge (development only)
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      db.run(
        `UPDATE subscriptions SET plan = ?, pending_plan = NULL, current_period_start = ?, current_period_end = ?, updated_at = datetime('now') WHERE id = ?`,
        [newPlan, now.toISOString(), periodEnd.toISOString(), subId]
      );
      saveDatabaseAfterWrite();

      logger.info(`Dev mode: user ${userId} upgraded from ${currentPlan} to ${newPlan} (immediate, no charge)`);

      res.json({
        message: `Upgraded to ${newPlan} successfully! New features are available immediately.`,
        dev_mode: true,
        subscription: {
          plan: newPlan,
          previous_plan: currentPlan,
          is_downgrade: false,
          scheduled: false,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString()
        }
      });
    } else if (!hasStripeSubscription) {
      // No paid Stripe subscription to change (trial, admin-granted plan):
      // the client has to start a normal checkout for the new plan.
      logger.info(`User ${userId} upgrade ${currentPlan} -> ${newPlan} requires checkout (no Stripe subscription)`);
      return res.status(402).json({
        error: 'Please complete checkout to upgrade to this plan.',
        requires_checkout: true,
        plan: newPlan
      });
    } else {
      // A scheduled downgrade already switched the Stripe price to the lower
      // plan. Switch it back to the plan actually paid for first (only if
      // Stripe really is on the lower price), so the prorated upgrade charge
      // is computed from that tier, not the lower one.
      if (pendingPlan) {
        const revert = await revertPendingPrice(stripeSubscriptionId, currentPlan, pendingPlan, idemKey('undo', currentPlan));
        if (!revert.ok) {
          logger.error(`Stripe downgrade undo before upgrade failed for user ${userId} (${stripeSubscriptionId}): ${revert.error && revert.error.message}`);
          if (isStripeResourceMissing(revert.error)) {
            return res.status(402).json({
              error: 'Please complete checkout to upgrade to this plan.',
              requires_checkout: true,
              plan: newPlan
            });
          }
          return res.status(502).json({
            error: 'We could not reach the payment provider. Your plan was not changed. Please try again.',
            code: 'stripe_error'
          });
        }
        db.run(`UPDATE subscriptions SET pending_plan = NULL, updated_at = datetime('now') WHERE id = ?`, [subId]);
        saveDatabaseAfterWrite();
      }

      // Upgrade: charge the prorated difference in Stripe first, then apply locally
      let updated;
      try {
        updated = await changeSubscriptionPlan(stripeSubscriptionId, newPlan, { idempotencyKey: idemKey('upgrade', newPlan) });
      } catch (stripeError) {
        logger.error(`Stripe upgrade failed for user ${userId} (${currentPlan} -> ${newPlan}): ${stripeError.message}`);
        const live = isStripeResourceMissing(stripeError) ? null : await tryRetrieveSubscription(stripeSubscriptionId);
        if (live && subscriptionItemIsPlanPrice(live, newPlan)) {
          // Stripe applied (and charged) the upgrade; only the response was lost
          logger.warn(`Stripe upgrade of ${stripeSubscriptionId} to ${newPlan} was applied despite the error; recording it`);
          updated = live;
        } else {
          if (pendingPlan && live) {
            // Stripe's state is known and unchanged: put the scheduled
            // downgrade back (best effort)
            const restore = await scheduleDowngradeInStripe(
              db, subId, stripeSubscriptionId, pendingPlan, null, idemKey('restore', pendingPlan)
            );
            if (restore.status !== 'applied') {
              logger.error(`Could not restore scheduled downgrade to ${pendingPlan} for user ${userId} (${restore.status})`);
            }
          }
          if (isStripeResourceMissing(stripeError)) {
            // The Stripe subscription no longer exists: buy the plan via checkout
            return res.status(402).json({
              error: 'Please complete checkout to upgrade to this plan.',
              requires_checkout: true,
              plan: newPlan
            });
          }
          if (!live) {
            // Neither the update nor the check went through: Stripe's state is
            // unknown; the webhook (live state) will settle the row.
            return res.status(502).json(STRIPE_UNCONFIRMED);
          }
          return res.status(402).json({
            error: 'The upgrade payment could not be completed. Your plan was not changed. Please check your payment method and try again.',
            code: 'payment_failed'
          });
        }
      }

      const periodStart = updated && updated.current_period_start
        ? new Date(updated.current_period_start * 1000).toISOString() : null;
      const periodEnd = stripePeriodEndIso(updated) || currentPeriodEnd;

      db.run(
        `UPDATE subscriptions SET plan = ?, pending_plan = NULL,
         current_period_start = COALESCE(?, current_period_start), current_period_end = COALESCE(?, current_period_end),
         updated_at = datetime('now') WHERE id = ?`,
        [newPlan, periodStart, periodEnd, subId]
      );
      saveDatabaseAfterWrite();

      logger.info(`User ${userId} upgraded from ${currentPlan} to ${newPlan} (Stripe ${stripeSubscriptionId}, prorated invoice)`);

      res.json({
        message: `Upgraded to ${newPlan} successfully! The prorated difference has been charged. New features are available immediately.`,
        charged: true,
        subscription: {
          plan: newPlan,
          previous_plan: currentPlan,
          is_downgrade: false,
          scheduled: false,
          current_period_start: periodStart,
          current_period_end: periodEnd
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

    const validPlans = ['confirm', 'basic', 'pro', 'premium'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be one of: ' + validPlans.join(', ') });
    }

    // Dev-mode checkout auto-grants the plan; never allow that in production
    if (isBillingUnavailableInProduction()) {
      logger.error(`Checkout refused for user ${userId}: Stripe is not configured in production`);
      return res.status(503).json({ error: 'Billing is temporarily unavailable. Please try again later.' });
    }

    // Check current subscription
    const subResult = db.exec(
      'SELECT id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(404).json({ error: 'No subscription found. Please register first.' });
    }

    const currentPlan = subResult[0].values[0][1];
    const currentStatus = subResult[0].values[0][2];
    let customerId = subResult[0].values[0][3];
    const existingStripeSubId = subResult[0].values[0][4];
    const existingPeriodEnd = subResult[0].values[0][5];

    // A live Stripe subscription (active, past_due, trialing, or canceled but
    // still inside its paid period) must be changed or resumed in place: a
    // second checkout would create a second, double-billed subscription.
    if (isRealStripeSubscriptionId(existingStripeSubId) && currentStatus !== 'expired') {
      const periodEndDate = parseSubscriptionDate(existingPeriodEnd);
      const canceledInGrace = currentStatus === 'canceled' && periodEndDate && periodEndDate > new Date();
      if (currentStatus !== 'canceled' || canceledInGrace) {
        return res.status(409).json({
          error: currentStatus === 'active'
            ? 'You already have an active paid subscription. Change your plan instead.'
            : currentStatus === 'canceled'
              ? 'Your subscription is still running until the end of the paid period. Resume it instead of starting a new one.'
              : 'Your subscription has an outstanding payment. Plan changes are available once it is paid.',
          code: 'subscription_exists',
          status: currentStatus,
          use_change_plan: currentStatus === 'active',
          can_resume: currentStatus === 'canceled',
          plan
        });
      }
    }

    // Block same-plan upgrade only when already fully active (not trialing).
    // Trialing users on the same plan still need to complete Stripe Checkout
    // to add payment info and activate their subscription; canceled/expired
    // users may re-subscribe to the plan they had.
    if (currentPlan === plan && !['trialing', 'canceled', 'expired'].includes(currentStatus)) {
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
      saveDatabaseAfterWrite();
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
    if (isStripeTestMode()) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      db.run(
        `UPDATE subscriptions SET plan = ?, status = 'active', stripe_subscription_id = ?,
         current_period_start = ?, current_period_end = ?,
         trial_ends_at = NULL, pending_plan = NULL, canceled_at = NULL, updated_at = datetime('now')
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
      saveDatabaseAfterWrite();
      logger.info(`Dev mode: auto-completed upgrade to ${plan} for user ${userId}`);
    }

    res.json({
      checkout_url: session.url,
      session_id: session.id,
      plan,
      dev_mode: isStripeTestMode(),
      auto_completed: isStripeTestMode()
    });
  } catch (error) {
    logger.error('Checkout error: ' + error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// POST /api/subscription/cancel
// Renewal is stopped in Stripe first; access is kept by requireActiveSubscription.
// Cancel subscription - renewal stops, access continues until end of current billing period
router.post('/cancel', requireAuth, billingLock, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;

    let subResult;
    try {
      subResult = db.exec(
        'SELECT id, plan, status, current_period_end, stripe_subscription_id, trial_ends_at, pending_plan FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
    } catch (e) {
      subResult = db.exec(
        'SELECT id, plan, status, current_period_end, stripe_subscription_id, trial_ends_at FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
    }

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subId = subResult[0].values[0][0];
    const currentPlan = subResult[0].values[0][1];
    const currentStatus = subResult[0].values[0][2];
    const trialEndsAt = subResult[0].values[0][5];
    let currentPeriodEnd = subResult[0].values[0][3];
    const stripeSubscriptionId = subResult[0].values[0][4];

    if (currentStatus === 'canceled') {
      return res.status(400).json({ error: 'Subscription already canceled' });
    }

    // An expired subscription has nothing left to cancel (and canceling it
    // would re-open access until the fallback date below).
    if (currentStatus === 'expired') {
      return res.status(400).json({ error: 'Subscription is not active' });
    }

    // A trial without a paid period ends when the trial ends
    if (currentStatus === 'trialing' && !currentPeriodEnd && trialEndsAt) {
      currentPeriodEnd = trialEndsAt;
    }

    // A paid Stripe subscription must stop renewing in Stripe first; if that
    // fails nothing is changed locally so the user is not billed silently.
    if (isRealStripeSubscriptionId(stripeSubscriptionId)) {
      try {
        const updated = await cancelSubscriptionAtPeriodEnd(stripeSubscriptionId);
        if (updated && updated.current_period_end) {
          currentPeriodEnd = new Date(updated.current_period_end * 1000).toISOString();
        }
      } catch (stripeError) {
        if (isStripeResourceMissing(stripeError)) {
          // Nothing left to stop in Stripe (subscription deleted there): cancel locally
          logger.warn(`Stripe subscription ${stripeSubscriptionId} not found while canceling for user ${userId}; canceling locally`);
        } else {
          logger.error(`Stripe cancel failed for user ${userId} (${stripeSubscriptionId}): ${stripeError.message}`);
          return res.status(502).json({
            error: 'We could not reach the payment provider to cancel your subscription. Nothing was changed. Please try again.',
            code: 'stripe_error'
          });
        }
      }
    } else if (typeof stripeSubscriptionId === 'string' && stripeSubscriptionId.startsWith('sub_') && isBillingUnavailableInProduction()) {
      // Stripe-backed row but Stripe is not configured in production: a local
      // cancel would leave the Stripe subscription renewing.
      logger.error(`Cancel refused for user ${userId}: Stripe is not configured in production`);
      return res.status(503).json({ error: 'Billing is temporarily unavailable. Please try again later.' });
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

    // current_period_end is what requireActiveSubscription uses to keep access
    // until the paid period ends, so persist the fallback date as well.
    // pending_plan is kept: for a Stripe subscription a scheduled downgrade has
    // already switched the Stripe price, so a later resume renews on that plan.
    db.run(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = ?, current_period_end = ?, updated_at = datetime('now') WHERE id = ?`,
      [now.toISOString(), accessUntil, subId]
    );
    saveDatabaseAfterWrite();

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

// POST /api/subscription/resume
// Undo a cancellation while the paid period is still running: renewal is
// switched back on in Stripe first, then the local row is restored.
// Resume a canceled subscription before its paid period ends
router.post('/resume', requireAuth, billingLock, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;

    const subResult = db.exec(
      'SELECT id, plan, status, current_period_end, stripe_subscription_id, trial_ends_at FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const [subId, plan, status, currentPeriodEnd, stripeSubscriptionId, trialEndsAt] = subResult[0].values[0];
    if (status !== 'canceled') {
      return res.status(400).json({ error: 'Subscription is not canceled' });
    }

    const now = new Date();
    const periodEnd = parseSubscriptionDate(currentPeriodEnd);
    if (!periodEnd || periodEnd <= now) {
      return res.status(409).json({
        error: 'This subscription has ended and can no longer be resumed. Please choose a plan to subscribe again.',
        requires_checkout: true,
        plan
      });
    }

    let newStatus = 'active';
    let newPeriodEnd = currentPeriodEnd;
    if (isRealStripeSubscriptionId(stripeSubscriptionId)) {
      try {
        const updated = await resumeSubscription(stripeSubscriptionId);
        if (updated && ['past_due', 'trialing'].includes(updated.status)) newStatus = updated.status;
        if (updated && updated.current_period_end) {
          newPeriodEnd = new Date(updated.current_period_end * 1000).toISOString();
        }
      } catch (stripeError) {
        if (isStripeResourceMissing(stripeError)) {
          return res.status(409).json({
            error: 'This subscription has ended and can no longer be resumed. Please choose a plan to subscribe again.',
            requires_checkout: true,
            plan
          });
        }
        logger.error(`Stripe resume failed for user ${userId} (${stripeSubscriptionId}): ${stripeError.message}`);
        return res.status(502).json({
          error: 'We could not reach the payment provider to resume your subscription. Nothing was changed. Please try again.',
          code: 'stripe_error'
        });
      }
    } else if (typeof stripeSubscriptionId === 'string' && stripeSubscriptionId.startsWith('sub_') && isBillingUnavailableInProduction()) {
      logger.error(`Resume refused for user ${userId}: Stripe is not configured in production`);
      return res.status(503).json({ error: 'Billing is temporarily unavailable. Please try again later.' });
    } else {
      // No paid Stripe subscription: a canceled trial goes back to trialing,
      // never to a paid 'active' status.
      const trialEnd = parseSubscriptionDate(trialEndsAt);
      if ((plan === 'trial' || !stripeSubscriptionId) && trialEnd && trialEnd > now) {
        newStatus = 'trialing';
      }
    }

    db.run(
      `UPDATE subscriptions SET status = ?, canceled_at = NULL, current_period_end = ?, updated_at = datetime('now') WHERE id = ?`,
      [newStatus, newPeriodEnd, subId]
    );
    saveDatabaseAfterWrite();

    logger.info(`Subscription resumed for user ${userId} (status ${newStatus})`);

    res.json({
      message: 'Subscription resumed. It will renew at the end of the current period.',
      subscription: {
        plan,
        status: newStatus,
        canceled_at: null,
        current_period_end: newPeriodEnd
      }
    });
  } catch (error) {
    logger.error('Resume error: ' + error.message);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
});

// ============================================================
// Promo Code Validation & Redemption (Therapist-facing)
// ============================================================

// POST /api/subscription/apply-promo - Validate and redeem a promo code
router.post('/apply-promo', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Check code exists
    const codeResult = db.exec(
      `SELECT id, code, plan, duration_days, max_uses, usage_count, is_active, expires_at
       FROM promo_codes WHERE code = ?`,
      [normalizedCode]
    );

    if (!codeResult.length || !codeResult[0].values.length) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    const row = codeResult[0].values[0];
    const promo = {
      id: row[0], code: row[1], plan: row[2], duration_days: row[3],
      max_uses: row[4], usage_count: row[5], is_active: !!row[6], expires_at: row[7]
    };

    // 2. Validate is_active
    if (!promo.is_active) {
      return res.status(400).json({ error: 'This promo code is no longer active' });
    }

    // 3. Validate not expired
    if (promo.expires_at) {
      const now = new Date();
      const expiresAt = new Date(promo.expires_at);
      if (now > expiresAt) {
        return res.status(400).json({ error: 'This promo code has expired' });
      }
    }

    // 4. Validate usage_count < max_uses
    if (promo.max_uses !== null && promo.usage_count >= promo.max_uses) {
      return res.status(400).json({ error: 'This promo code has reached its maximum number of uses' });
    }

    // 5. Check therapist hasn't already redeemed this code
    const existingRedemption = db.exec(
      'SELECT id, status FROM promo_redemptions WHERE promo_code_id = ? AND therapist_id = ?',
      [promo.id, userId]
    );

    if (existingRedemption.length > 0 && existingRedemption[0].values.length > 0) {
      const existingStatus = existingRedemption[0].values[0][1];
      return res.status(409).json({
        error: 'You have already redeemed this promo code',
        status: existingStatus
      });
    }

    // 6. Create redemption record with status 'pending'
    db.run(
      `INSERT INTO promo_redemptions (promo_code_id, therapist_id, redeemed_at, status)
       VALUES (?, ?, datetime('now'), 'pending')`,
      [promo.id, userId]
    );

    // 7. Increment usage_count
    db.run(
      'UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = ?',
      [promo.id]
    );

    saveDatabaseAfterWrite();

    logger.info(`[Promo] Code ${normalizedCode} redeemed by therapist ${userId} (pending)`);

    res.status(201).json({
      message: 'Promo code applied successfully! It is pending admin approval.',
      promo: {
        code: promo.code,
        plan: promo.plan,
        duration_days: promo.duration_days
      },
      status: 'pending'
    });
  } catch (error) {
    logger.error('Apply promo error: ' + error.message);
    res.status(500).json({ error: 'Failed to apply promo code' });
  }
});

// GET /api/subscription/my-promos - List therapist's own promo redemptions
router.get('/my-promos', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.userId;

    const result = db.exec(`
      SELECT r.id, r.redeemed_at, r.status,
             p.code, p.plan, p.duration_days
      FROM promo_redemptions r
      JOIN promo_codes p ON p.id = r.promo_code_id
      WHERE r.therapist_id = ?
      ORDER BY r.redeemed_at DESC
    `, [userId]);

    const redemptions = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      redeemed_at: row[1],
      status: row[2],
      code: row[3],
      plan: row[4],
      duration_days: row[5]
    }));

    res.json({ redemptions });
  } catch (error) {
    logger.error('My promos error: ' + error.message);
    res.status(500).json({ error: 'Failed to get promo redemptions' });
  }
});

module.exports = router;
