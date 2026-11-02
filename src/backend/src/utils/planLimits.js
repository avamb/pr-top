// Plan Limits Utility
// Returns tier limits based on platform_settings and plan name

const { getDatabase } = require('../db/connection');
const { logger } = require('./logger');
const { parseSubscriptionDate } = require('../middleware/auth');

// Default limits if platform_settings not available
const DEFAULT_LIMITS = {
  trial: { clients: 3, sessions_per_month: 5 },
  confirm: { clients: 25, sessions_per_month: 0 },
  basic: { clients: 10, sessions_per_month: 20 },
  pro: { clients: 30, sessions_per_month: 60 },
  premium: { clients: Infinity, sessions_per_month: Infinity }
};

const KNOWN_PLANS = ['trial', 'confirm', 'basic', 'pro', 'premium'];

function isRealStripeSubId(id) {
  return typeof id === 'string' && id.startsWith('sub_');
}

/**
 * Decide whether a subscription row currently grants access, and on which plan.
 * Single source of truth for every plan gate (limits, export, KB, NL query,
 * assistant, reminders, bot voice query).
 *
 * Rules (mirror requireActiveSubscription in middleware/auth.js):
 *   active   -> usable (a legacy local trial row, plan 'trial' without a Stripe
 *               sub_, stops being usable once trial_ends_at has passed)
 *   trialing -> usable until trial_ends_at (a Stripe-backed trial follows
 *               Stripe's lifecycle via webhooks instead of the local clock)
 *   canceled -> usable until current_period_end (cancel at period end)
 *   past_due -> usable (Stripe retry grace)
 *   anything else (expired, missing row, unknown) -> not usable
 *
 * On a row without a Stripe subscription, a scheduled downgrade (pending_plan)
 * becomes the effective plan once current_period_end has passed. Stripe-backed
 * rows change plan only through the renewal webhook.
 *
 * @param {object|null} sub  { plan, status, trial_ends_at, current_period_end,
 *                             stripe_subscription_id, pending_plan } (extra keys ignored)
 * @param {Date} [now]
 * @returns {{ usable: boolean, plan: string, status: string|null }}
 *          plan is 'trial' whenever usable is false.
 */
function getEffectiveSubscriptionAccess(sub, now = new Date()) {
  if (!sub) return { usable: false, plan: 'trial', status: null };
  const status = sub.status || null;
  const hasStripe = isRealStripeSubId(sub.stripe_subscription_id);
  const trialEnd = parseSubscriptionDate(sub.trial_ends_at);
  const periodEnd = parseSubscriptionDate(sub.current_period_end);

  let usable;
  switch (status) {
    case 'active':
      usable = !(sub.plan === 'trial' && !hasStripe && trialEnd && trialEnd <= now);
      break;
    case 'trialing':
      usable = hasStripe || !trialEnd || trialEnd > now;
      break;
    case 'canceled':
      usable = !!periodEnd && periodEnd > now;
      break;
    case 'past_due':
      usable = true;
      break;
    default:
      usable = false;
  }
  if (!usable) return { usable: false, plan: 'trial', status };

  let plan = sub.plan;
  // Stripe-backed rows switch plan only from the renewal webhook (live Stripe
  // state): Stripe may still bill the old price (e.g. a legacy downgrade that
  // never reached Stripe), and access must follow what is actually billed.
  if (!hasStripe && sub.pending_plan && KNOWN_PLANS.includes(sub.pending_plan) && periodEnd && periodEnd <= now) {
    plan = sub.pending_plan;
  }
  if (!KNOWN_PLANS.includes(plan)) plan = 'trial';
  return { usable: true, plan, status };
}

/**
 * Load a therapist's latest subscription row and evaluate it with
 * getEffectiveSubscriptionAccess.
 * @param {number|string} therapistId
 * @returns {{ usable: boolean, plan: string, status: string|null, subscription: object|null }}
 *          subscription is the raw row (null when the therapist has none).
 */
function getSubscriptionAccessForTherapist(therapistId) {
  const db = getDatabase();
  const result = db.exec(
    `SELECT plan, status, trial_ends_at, current_period_end, stripe_subscription_id, pending_plan
       FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1`,
    [therapistId]
  );
  if (!result.length || !result[0].values.length) {
    return { ...getEffectiveSubscriptionAccess(null), subscription: null };
  }
  const [plan, status, trialEndsAt, currentPeriodEnd, stripeSubscriptionId, pendingPlan] = result[0].values[0];
  const subscription = {
    plan, status, trial_ends_at: trialEndsAt, current_period_end: currentPeriodEnd,
    stripe_subscription_id: stripeSubscriptionId, pending_plan: pendingPlan
  };
  return { ...getEffectiveSubscriptionAccess(subscription), subscription };
}

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
      // 0 is a legitimate limit (feature not included in the plan)
      if (!isNaN(val) && val >= 0) return val;
    }
  } catch (e) {
    logger.warn(`Could not read client limit for plan ${plan}: ${e.message}`);
  }
  return DEFAULT_LIMITS[plan]?.clients ?? DEFAULT_LIMITS.trial.clients;
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
      // 0 is a legitimate limit (e.g. Confirm: no session uploads)
      if (!isNaN(val) && val >= 0) return val;
    }
  } catch (e) {
    logger.warn(`Could not read session limit for plan ${plan}: ${e.message}`);
  }
  return DEFAULT_LIMITS[plan]?.sessions_per_month ?? DEFAULT_LIMITS.trial.sessions_per_month;
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
  const access = getSubscriptionAccessForTherapist(therapistId);

  if (!access.subscription) {
    return { allowed: false, current: 0, limit: 0, plan: null, message: 'No active subscription' };
  }

  // plan: null (not the stored plan) so callers that only test `plan`
  // (e.g. bulk import) treat an unusable subscription like a missing one.
  if (!access.usable) {
    return { allowed: false, current: 0, limit: 0, plan: null, message: 'Subscription is not active' };
  }

  const plan = access.plan;

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

/**
 * Get current month's session count for a therapist
 */
function getSessionCount(therapistId) {
  const db = getDatabase();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const result = db.exec(
    "SELECT COUNT(*) FROM sessions WHERE therapist_id = ? AND created_at >= ?",
    [therapistId, monthStart]
  );
  return result.length > 0 ? result[0].values[0][0] : 0;
}

/**
 * Check if therapist can upload more sessions based on their subscription
 * Returns { allowed, current, limit, plan, message }
 */
function checkSessionLimit(therapistId) {
  const access = getSubscriptionAccessForTherapist(therapistId);

  if (!access.subscription) {
    return { allowed: false, current: 0, limit: 0, plan: null, message: 'No active subscription' };
  }

  if (!access.usable) {
    return { allowed: false, current: 0, limit: 0, plan: null, message: 'Subscription is not active' };
  }

  const plan = access.plan;

  const limit = getSessionLimit(plan);
  const current = getSessionCount(therapistId);

  if (plan === 'premium') {
    return { allowed: true, current, limit: -1, plan, message: 'Unlimited sessions on Premium plan' };
  }

  const allowed = current < limit;
  const message = allowed
    ? `${current}/${limit} sessions used this month`
    : `Session limit reached (${current}/${limit}). Upgrade your plan to upload more sessions.`;

  return { allowed, current, limit, plan, message };
}

/**
 * Check if a therapist can use Session Reminders based on their subscription.
 *
 * Returns true for plan in {trial, confirm, basic, pro, premium} while the
 * subscription is usable (see getEffectiveSubscriptionAccess: active,
 * trialing until trial end, canceled until period end, past_due).
 * Returns false for expired / ended or missing subscriptions.
 *
 * @param {number|string} therapistId
 * @returns {boolean}
 */
function canUseSessionReminders(therapistId) {
  try {
    const access = getSubscriptionAccessForTherapist(therapistId);
    return access.usable && KNOWN_PLANS.includes(access.plan);
  } catch (e) {
    logger.warn(`canUseSessionReminders check failed for therapist ${therapistId}: ${e.message}`);
    return false;
  }
}

module.exports = {
  getClientLimit,
  getSessionLimit,
  getClientCount,
  getSessionCount,
  checkClientLimit,
  checkSessionLimit,
  canUseSessionReminders,
  getEffectiveSubscriptionAccess,
  getSubscriptionAccessForTherapist,
  DEFAULT_LIMITS
};
