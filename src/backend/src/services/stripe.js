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
        appInfo: { name: 'PsyLink', version: '0.1.0' }
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
        name: 'PsyLink',
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
 * Check if running in development mode (no real Stripe keys)
 */
function isDevMode() {
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
        psylink_user_id: String(userId),
        platform: 'psylink'
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
        psylink_user_id: String(userId),
        platform: 'psylink'
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
  isConfigured,
  isDevMode
};
