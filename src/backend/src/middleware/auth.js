// Authentication Middleware
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');

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
      'SELECT id, email, role, blocked_at FROM users WHERE id = ?',
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
      role: user[2]
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
      'SELECT plan, status, trial_ends_at FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(402).json({
        error: 'subscription_expired',
        message: 'No active subscription found. Please select a plan to continue.',
        redirect: '/subscription'
      });
    }

    const [plan, status, trialEndsAt] = subResult[0].values[0];

    // Check if trial has expired
    if (plan === 'trial' && trialEndsAt) {
      const expiryDate = new Date(trialEndsAt);
      if (expiryDate < new Date()) {
        // Mark as expired in DB
        db.run(
          "UPDATE subscriptions SET status = 'expired', updated_at = datetime('now') WHERE therapist_id = ? AND plan = 'trial' AND status = 'active'",
          [userId]
        );
        const { saveDatabaseAfterWrite } = require('../db/connection');
        saveDatabaseAfterWrite();

        return res.status(402).json({
          error: 'subscription_expired',
          message: 'Your trial has expired. Please select a plan to continue using PR-TOP.',
          plan: 'trial',
          expired_at: trialEndsAt,
          redirect: '/subscription'
        });
      }
    }

    // Check if subscription is inactive (canceled, expired)
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

module.exports = { authenticate, requireRole, requireActiveSubscription };
