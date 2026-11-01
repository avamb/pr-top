// Authentication Middleware
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Extract token from Authorization header or session cookie
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (req.cookies && req.cookies.session_token) {
    return req.cookies.session_token;
  }
  return null;
}

// Verify JWT token and attach user to request
function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);

    const db = getDatabase();
    const result = db.exec(
      'SELECT id, email, role, blocked_at, email_verified_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result[0].values[0];

    // Check if user is blocked
    if (user[3]) {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
    }

    req.user = {
      id: user[0],
      email: user[1],
      role: user[2],
      // Email verification state (wave 1: informational; wave 2 adds the
      // requireVerifiedEmail gate on top of this flag).
      emailVerified: !!user[4]
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    logger.error('Auth middleware error: ' + error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Require specific role(s)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Parse a subscriptions timestamp. Values are either ISO strings
// ("2026-11-01T10:00:00.000Z") or SQLite datetime('now') output
// ("2026-11-01 10:00:00", UTC without a zone marker). Returns null if unparseable.
function parseSubscriptionDate(value) {
  if (!value) return null;
  let str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str = str + 'T00:00:00Z';
  }
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

// Check if therapist has an active (non-expired) subscription
// Returns 402 if trial expired or subscription inactive
// Runs before route-level authenticate, so extracts user from token directly
function requireActiveSubscription(req, res, next) {
  try {
    // Extract token to identify user
    const token = extractToken(req);
    if (!token) return next(); // Let authenticate handle auth errors

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return next(); // Let authenticate handle invalid tokens
    }

    // Look up user role
    const db = getDatabase();
    const userResult = db.exec('SELECT id, role FROM users WHERE id = ?', [decoded.userId]);
    if (userResult.length === 0 || userResult[0].values.length === 0) return next();

    const userId = userResult[0].values[0][0];
    const role = userResult[0].values[0][1];

    // Only apply to therapists
    if (role !== 'therapist') return next();

    const subResult = db.exec(
      'SELECT id, plan, status, trial_ends_at, current_period_end, stripe_subscription_id FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(402).json({
        error: 'subscription_expired',
        message: 'No active subscription found. Please select a plan to continue.',
        redirect: '/subscription'
      });
    }

    const [subId, plan, status, trialEndsAt, currentPeriodEnd, stripeSubscriptionId] = subResult[0].values[0];
    const now = new Date();
    // Rows backed by a Stripe subscription (sub_...) follow Stripe's lifecycle
    // via webhooks; the local trial clock never expires a paying customer.
    const hasStripeSubscription = typeof stripeSubscriptionId === 'string' && stripeSubscriptionId.startsWith('sub_');

    // Check if trial has expired. Trials are status 'trialing' (T-28, e.g. the
    // Confirm landing flow) or legacy plan='trial' rows with status 'active'.
    if (!hasStripeSubscription && (plan === 'trial' || status === 'trialing') && trialEndsAt) {
      const expiryDate = parseSubscriptionDate(trialEndsAt);
      if (expiryDate && expiryDate < now) {
        // Mark as expired in DB (only rows still counted as a running trial)
        db.run(
          "UPDATE subscriptions SET status = 'expired', updated_at = datetime('now') WHERE id = ? AND status IN ('active', 'trialing')",
          [subId]
        );
        if (db.getRowsModified() > 0) {
          const { saveDatabaseAfterWrite } = require('../db/connection');
          saveDatabaseAfterWrite();
        }

        return res.status(402).json({
          error: 'subscription_expired',
          message: 'Your trial has expired. Please select a plan to continue using PR-TOP.',
          plan: 'trial',
          expired_at: trialEndsAt,
          redirect: '/subscription'
        });
      }
    }

    // A canceled subscription keeps access until the end of the paid period
    // (renewal is stopped, access is not). customer.subscription.deleted sets
    // status 'expired', which ends access below.
    if (status === 'canceled') {
      const accessUntil = parseSubscriptionDate(currentPeriodEnd);
      if (accessUntil && accessUntil > now) return next();
    }

    // Check if subscription is inactive (canceled past period end, expired)
    if (status === 'expired' || status === 'canceled') {
      return res.status(402).json({
        error: 'subscription_expired',
        message: 'Your subscription is no longer active. Please select a plan to continue.',
        plan,
        status,
        redirect: '/subscription'
      });
    }

    next();
  } catch (error) {
    logger.error('Subscription check error: ' + error.message);
    next(); // Don't block on errors
  }
}

// ── Email verification gate (wave 2, track 2A) ───────────────────────────
// docs/security/SPEC_ANTIBOT_WAVES.md §3 "Трек 2A" p.3. Blocks therapists whose
// email is not yet confirmed from the mutations a bot could abuse (client
// creation, invite links, uploads, AI chat, exports). Reads are never gated.
//
// Self-sufficient: some mounts run this before the route-level `authenticate`
// (same pattern as requireActiveSubscription), so when req.user is absent the
// JWT is verified here and the flag is read from the DB. Without a token the
// request is passed on — the route's own authenticate answers 401.
function requireVerifiedEmail(req, res, next) {
  try {
    if (process.env.EMAIL_VERIFICATION_GATE === 'false') return next();

    let role;
    let emailVerified;
    if (req.user) {
      role = req.user.role;
      emailVerified = !!req.user.emailVerified;
    } else {
      const token = extractToken(req);
      if (!token) return next();
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (e) {
        return next();
      }
      const db = getDatabase();
      const result = db.exec('SELECT role, email_verified_at FROM users WHERE id = ?', [decoded.userId]);
      if (result.length === 0 || result[0].values.length === 0) return next();
      role = result[0].values[0][0];
      emailVerified = !!result[0].values[0][1];
    }

    // Superadmins and (bot) clients are never gated.
    if (role !== 'therapist' || emailVerified) return next();

    const key = 'auth.emailNotVerified';
    const message = t(key, req.locale);
    return res.status(403).json({
      error: message === key ? 'Please confirm your email address to use this feature.' : message,
      code: 'EMAIL_NOT_VERIFIED'
    });
  } catch (error) {
    logger.error('Email verification gate error: ' + error.message);
    next(); // Fail open, like requireActiveSubscription
  }
}

// Apply `mw` only to mutating requests (POST/PUT/PATCH/DELETE) and to export
// routes (any path containing "/export", checked on the full mounted path so
// both `/api/clients/:id/diary/export` and the `/api/export/*` mount match).
// Usage: app.use('/api/clients', requireActiveSubscription, gateMutations(requireVerifiedEmail), routes)
const GATED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
function gateMutations(mw) {
  return function gatedMiddleware(req, res, next) {
    const fullPath = (req.baseUrl || '') + (req.path || '');
    if (GATED_METHODS.has(req.method) || fullPath.includes('/export')) {
      return mw(req, res, next);
    }
    next();
  };
}

module.exports = { authenticate, requireRole, requireActiveSubscription, requireVerifiedEmail, gateMutations, parseSubscriptionDate };
