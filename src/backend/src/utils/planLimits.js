// Plan Limits Utility
// Returns tier limits based on platform_settings and plan name

const { getDatabase } = require('../db/connection');
const { logger } = require('./logger');

// Default limits if platform_settings not available
const DEFAULT_LIMITS = {
  trial: { clients: 3, sessions_per_month: 5 },
  basic: { clients: 10, sessions_per_month: 20 },
  pro: { clients: 30, sessions_per_month: 60 },
  premium: { clients: Infinity, sessions_per_month: Infinity }
};

/**
 * Get client limit for a given plan, reading from platform_settings
 */
function getClientLimit(plan) {
  try {
    const db = getDatabase();
    const key = `${plan}_client_limit`;
    const result = db.exec('SELECT value FROM platform_settings WHERE key = ?', [key]);
    if (result.length > 0 && result[0].values.length > 0) {
      const val = parseInt(result[0].values[0][0], 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch (e) {
    logger.warn(`Could not read client limit for plan ${plan}: ${e.message}`);
  }
  return DEFAULT_LIMITS[plan]?.clients || 3;
}

/**
 * Get session limit for a given plan
 */
function getSessionLimit(plan) {
  try {
    const db = getDatabase();
    const key = `${plan}_session_limit`;
    const result = db.exec('SELECT value FROM platform_settings WHERE key = ?', [key]);
    if (result.length > 0 && result[0].values.length > 0) {
      const val = parseInt(result[0].values[0][0], 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch (e) {
    logger.warn(`Could not read session limit for plan ${plan}: ${e.message}`);
  }
  return DEFAULT_LIMITS[plan]?.sessions_per_month || 5;
}

/**
 * Get current client count for a therapist
 */
function getClientCount(therapistId) {
  const db = getDatabase();
  const result = db.exec(
    "SELECT COUNT(*) FROM users WHERE therapist_id = ? AND role = 'client'",
    [therapistId]
  );
  return result.length > 0 ? result[0].values[0][0] : 0;
}

/**
 * Check if therapist can add more clients based on their subscription
 * Returns { allowed, current, limit, plan, message }
 */
function checkClientLimit(therapistId) {
  const db = getDatabase();

  // Get current subscription
  const subResult = db.exec(
    'SELECT plan, status FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
    [therapistId]
  );

  if (subResult.length === 0 || subResult[0].values.length === 0) {
    return { allowed: false, current: 0, limit: 0, plan: null, message: 'No active subscription' };
  }

  const plan = subResult[0].values[0][0];
  const status = subResult[0].values[0][1];

  if (status !== 'active') {
    return { allowed: false, current: 0, limit: 0, plan, message: 'Subscription is not active' };
  }

  const limit = getClientLimit(plan);
  const current = getClientCount(therapistId);

  if (plan === 'premium') {
    return { allowed: true, current, limit: -1, plan, message: 'Unlimited clients on Premium plan' };
  }

  const allowed = current < limit;
  const message = allowed
    ? `${current}/${limit} clients used`
    : `Client limit reached (${current}/${limit}). Upgrade your plan to add more clients.`;

  return { allowed, current, limit, plan, message };
}

module.exports = {
  getClientLimit,
  getSessionLimit,
  getClientCount,
  checkClientLimit,
  DEFAULT_LIMITS
};
