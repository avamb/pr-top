// Stripe Payment Service
// Handles Stripe SDK initialization, customer management, and payment operations
//
// In development mode (when STRIPE_SECRET_KEY is a placeholder), the service
// operates in "dev mode" - it initializes the Stripe SDK module but uses
// development fallbacks for API calls. When a real sk_test_* or sk_live_* key
// is provided, all operations go through the real Stripe API.

const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

let stripeClient = null;
let stripeConfigured = false;
let devMode = false;

/**
 * Initialize Stripe SDK with API key from environment
 * Returns true if Stripe is initialized (either real or dev mode)
 */
function initStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || secretKey === 'your-stripe-secret-key') {
    logger.warn('Stripe: No real API key found - initializing in development mode');
    logger.warn('Stripe: Set STRIPE_SECRET_KEY=sk_test_... for real Stripe integration');
    devMode = true;
    stripeConfigured = true; // Mark as configured so endpoints work in dev
    // Still initialize Stripe SDK with a dummy key to verify the module loads
    try {
      stripeClient = new Stripe('sk_test_development_placeholder', {
        apiVersion: '2023-10-16',
        appInfo: { name: 'PR-TOP', version: '0.1.0' }
      });
      logger.info('Stripe SDK loaded successfully (development mode)');
    } catch (error) {
      logger.error('Failed to load Stripe SDK module: ' + error.message);
      stripeConfigured = false;
      return false;
    }
    return true;
  }

  try {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      appInfo: {
        name: 'PR-TOP',
        version: '0.1.0'
      }
    });
    stripeConfigured = true;
    devMode = false;
    logger.info('Stripe SDK initialized with real API key');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Stripe: ' + error.message);
    stripeConfigured = false;
    return false;
  }
}

/**
 * Get the Stripe client instance
 */
function getStripeClient() {
  if (!stripeClient) {
    throw new Error('Stripe not initialized. Call initStripe() first.');
  }
  return stripeClient;
}

/**
 * Check if running with placeholder Stripe keys (no real Stripe integration)
 */
function isStripeTestMode() {
  return devMode;
}

/**
 * Check if Stripe is configured and reachable
 * Returns status object for health check
 */
async function getStripeStatus() {
  if (!stripeConfigured || !stripeClient) {
    return {
      status: 'unconfigured',
      message: 'Stripe SDK not loaded'
    };
  }

  if (devMode) {
    return {
      status: 'development',
      message: 'Stripe SDK loaded in development mode (no real API key)',
      sdk_loaded: true
    };
  }

  try {
    // Try a simple API call to verify connectivity
    await stripeClient.balance.retrieve();
    return {
      status: 'connected',
      message: 'Stripe API reachable'
    };
  } catch (error) {
    if (error.type === 'StripeAuthenticationError') {
      return {
        status: 'auth_error',
        message: 'Stripe API key is invalid'
      };
    }
    return {
      status: 'error',
      message: 'Stripe API unreachable: ' + error.message
    };
  }
}

/**
 * Create a Stripe customer for a therapist
 * In dev mode, generates a development customer ID and returns a simulated response
 * In production, calls the real Stripe API
 */
async function createCustomer({ email, name, userId }) {
  if (!stripeConfigured) {
    throw new Error('Stripe is not configured. Call initStripe() first.');
  }

  if (devMode) {
    // Development mode: generate a dev customer ID
    const devCustomerId = 'cus_dev_' + uuidv4().replace(/-/g, '').slice(0, 14);
    logger.info(`Stripe dev mode: created customer ${devCustomerId} for user ${userId}`);
    return {
      id: devCustomerId,
      object: 'customer',
      email: email,
      name: name || null,
      metadata: {
        prtop_user_id: String(userId),
        platform: 'prtop'
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      _dev_mode: true
    };
  }

  try {
    const customer = await stripeClient.customers.create({
      email,
      name: name || undefined,
      metadata: {
        prtop_user_id: String(userId),
        platform: 'prtop'
      }
    });

    logger.info(`Stripe customer created: ${customer.id} for user ${userId}`);
    return customer;
  } catch (error) {
    logger.error(`Failed to create Stripe customer for user ${userId}: ${error.message}`);
    throw error;
  }
}

/**
 * Retrieve a Stripe customer by ID
 */
async function getCustomer(customerId) {
  if (!stripeConfigured) {
    throw new Error('Stripe is not configured.');
  }

  if (devMode) {
    // In dev mode, return a basic customer object
    return {
      id: customerId,
      object: 'customer',
      livemode: false,
      _dev_mode: true
    };
  }

  return await stripeClient.customers.retrieve(customerId);
}

/**
 * Plan pricing configuration (in cents)
 */
const PLAN_PRICES = {
  confirm: { amount: 900, currency: 'usd', name: 'Confirm', interval: 'month' },
  basic: { amount: 1900, currency: 'usd', name: 'Basic Plan', interval: 'month' },
  pro: { amount: 4900, currency: 'usd', name: 'Pro Plan', interval: 'month' },
  premium: { amount: 9900, currency: 'usd', name: 'Premium Plan', interval: 'month' }
};

/**
 * Create a Stripe Checkout session for plan upgrade
 * In dev mode, simulates a checkout session with a dev URL
 * In production, creates a real Stripe checkout session
 */
async function createCheckoutSession({ customerId, plan, userId, successUrl, cancelUrl }) {
  if (!stripeConfigured) {
    throw new Error('Stripe is not configured. Call initStripe() first.');
  }

  const planConfig = PLAN_PRICES[plan];
  if (!planConfig) {
    throw new Error(`Invalid plan: ${plan}. Must be one of: ${Object.keys(PLAN_PRICES).join(', ')}`);
  }

  if (devMode) {
    // Development mode: simulate a checkout session
    const devSessionId = 'cs_dev_' + uuidv4().replace(/-/g, '').slice(0, 24);
    logger.info(`Stripe dev mode: created checkout session ${devSessionId} for user ${userId}, plan ${plan}`);
    return {
      id: devSessionId,
      object: 'checkout.session',
      url: successUrl + (successUrl.includes('?') ? '&' : '?') + 'session_id=' + devSessionId,
      payment_status: 'unpaid',
      status: 'open',
      customer: customerId,
      metadata: {
        prtop_user_id: String(userId),
        plan: plan
      },
      _dev_mode: true
    };
  }

  try {
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: planConfig.currency,
          product_data: {
            name: planConfig.name,
            description: `PR-TOP ${planConfig.name} - Monthly Subscription`
          },
          unit_amount: planConfig.amount,
          recurring: { interval: planConfig.interval }
        },
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl,
      client_reference_id: String(userId),
      metadata: {
        prtop_user_id: String(userId),
        plan: plan
      },
      // Copied onto the created Stripe subscription so webhooks can resolve
      // the plan (inline price_data prices carry no lookup_key).
      subscription_data: {
        metadata: {
          prtop_user_id: String(userId),
          plan: plan,
          platform: 'prtop'
        }
      }
    });

    logger.info(`Stripe checkout session created: ${session.id} for user ${userId}, plan ${plan}`);
    return session;
  } catch (error) {
    logger.error(`Failed to create checkout session for user ${userId}: ${error.message}`);
    throw error;
  }
}

/**
 * True when the id looks like a real Stripe subscription (sub_...) and the
 * service is running against the real Stripe API. Dev-mode rows carry
 * synthetic ids (cs_dev_...) that must never be sent to Stripe.
 */
function isRealStripeSubscriptionId(stripeSubscriptionId) {
  return !devMode && typeof stripeSubscriptionId === 'string' && stripeSubscriptionId.startsWith('sub_');
}

// Resolved Stripe price ids per plan (memoized for the process lifetime)
const planPriceIdCache = {};

/**
 * Resolve the recurring Stripe Price id for a plan.
 * Order: STRIPE_PRICE_<PLAN> env var -> existing price with lookup_key
 * prtop_<plan>_monthly -> create that price (amount/currency from PLAN_PRICES).
 * Checkout keeps using inline price_data; this is only needed to swap the item
 * of an existing subscription, which requires a Price id.
 */
async function getPlanPriceId(plan) {
  const planConfig = PLAN_PRICES[plan];
  if (!planConfig) {
    throw new Error(`Invalid plan: ${plan}. Must be one of: ${Object.keys(PLAN_PRICES).join(', ')}`);
  }
  if (planPriceIdCache[plan]) return planPriceIdCache[plan];

  const envPriceId = process.env['STRIPE_PRICE_' + plan.toUpperCase()];
  if (envPriceId) {
    planPriceIdCache[plan] = envPriceId;
    return envPriceId;
  }

  const lookupKey = `prtop_${plan}_monthly`;
  const existing = await stripeClient.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const match = existing && existing.data && existing.data[0];
  if (match && match.unit_amount === planConfig.amount && match.currency === planConfig.currency) {
    planPriceIdCache[plan] = match.id;
    return match.id;
  }

  const price = await stripeClient.prices.create({
    currency: planConfig.currency,
    unit_amount: planConfig.amount,
    recurring: { interval: planConfig.interval },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    product_data: { name: planConfig.name },
    metadata: { plan, platform: 'prtop' }
  });
  logger.info(`Stripe price created for plan ${plan}: ${price.id}`);
  planPriceIdCache[plan] = price.id;
  return price.id;
}

/**
 * Switch an existing Stripe subscription to another plan and charge the
 * prorated difference immediately. With payment_behavior=error_if_incomplete
 * Stripe rejects the update (and changes nothing) when the proration invoice
 * cannot be paid, so the caller only updates the local row on success.
 * Only valid against the real Stripe API (see isRealStripeSubscriptionId).
 */
async function changeSubscriptionPlan(stripeSubscriptionId, plan) {
  if (!stripeConfigured || devMode) {
    throw new Error('Stripe is not configured with a real API key.');
  }

  const priceId = await getPlanPriceId(plan);
  const current = await stripeClient.subscriptions.retrieve(stripeSubscriptionId);
  const items = (current && current.items && current.items.data) || [];
  if (items.length !== 1) {
    throw new Error(`Subscription ${stripeSubscriptionId} has ${items.length} items; expected exactly 1`);
  }

  const updated = await stripeClient.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: items[0].id, price: priceId }],
    proration_behavior: 'always_invoice',
    payment_behavior: 'error_if_incomplete',
    metadata: { plan, platform: 'prtop' }
  });
  logger.info(`Stripe subscription ${stripeSubscriptionId} switched to plan ${plan}`);
  return updated;
}

/**
 * Resolve the PR-TOP plan of a Stripe subscription object (webhook payload or
 * API response). Order: item price lookup_key prtop_<plan>_monthly (the price
 * actually billed) -> subscription metadata.plan (set by checkout and
 * changeSubscriptionPlan) -> unique PLAN_PRICES match on the item amount.
 * Returns a key of PLAN_PRICES, or null when the plan cannot be determined.
 */
function resolvePlanFromStripeSubscription(subscription) {
  if (!subscription) return null;
  const items = (subscription.items && subscription.items.data) || [];
  const price = items.length === 1 ? items[0].price : null;

  if (price && typeof price.lookup_key === 'string') {
    const match = price.lookup_key.match(/^prtop_([a-z]+)_monthly$/);
    if (match && PLAN_PRICES[match[1]]) return match[1];
  }

  const metaPlan = subscription.metadata && subscription.metadata.plan;
  if (typeof metaPlan === 'string' && PLAN_PRICES[metaPlan]) return metaPlan;

  if (price && typeof price.unit_amount === 'number') {
    const matches = Object.keys(PLAN_PRICES).filter(key =>
      PLAN_PRICES[key].amount === price.unit_amount &&
      (!price.currency || PLAN_PRICES[key].currency === price.currency)
    );
    if (matches.length === 1) return matches[0];
  }
  return null;
}

/**
 * Undo a scheduled cancellation (cancel_at_period_end -> false) so the Stripe
 * subscription renews again. Only valid against the real Stripe API.
 */
async function resumeSubscription(stripeSubscriptionId) {
  if (!stripeConfigured || devMode) {
    throw new Error('Stripe is not configured with a real API key.');
  }
  const updated = await stripeClient.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false });
  logger.info(`Stripe subscription ${stripeSubscriptionId} resumed (cancel_at_period_end=false)`);
  return updated;
}

/**
 * True for Stripe "No such subscription" errors (the subscription no longer
 * exists in Stripe, e.g. deleted from the dashboard).
 */
function isStripeResourceMissing(error) {
  return !!error && (error.code === 'resource_missing' || (error.raw && error.raw.code === 'resource_missing'));
}

/**
 * Stop renewal of a Stripe subscription at the end of the paid period.
 * Only valid against the real Stripe API (see isRealStripeSubscriptionId).
 */
async function cancelSubscriptionAtPeriodEnd(stripeSubscriptionId) {
  if (!stripeConfigured || devMode) {
    throw new Error('Stripe is not configured with a real API key.');
  }
  const updated = await stripeClient.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
  logger.info(`Stripe subscription ${stripeSubscriptionId} set to cancel at period end`);
  return updated;
}

/**
 * Check if Stripe is configured (synchronous check)
 */
function isConfigured() {
  return stripeConfigured;
}

module.exports = {
  initStripe,
  getStripeClient,
  getStripeStatus,
  createCustomer,
  getCustomer,
  createCheckoutSession,
  isConfigured,
  isStripeTestMode,
  isRealStripeSubscriptionId,
  getPlanPriceId,
  changeSubscriptionPlan,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
  resolvePlanFromStripeSubscription,
  isStripeResourceMissing,
  PLAN_PRICES
};
