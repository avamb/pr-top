// Session issuance helper
//
// Single place that turns an authenticated user row into a session:
// signs the JWT and sets the HttpOnly session cookie. Used by /login,
// /register and (wave 2) the email-code login endpoints so every entry point
// produces the same token claims, cookie options and `user` payload shape.
//
// Token revocation (audit wave 2, H13): every JWT carries `tv`, the user's
// users.token_version at issue time. bumpTokenVersion() increments the column,
// which invalidates every token issued before it (all devices). A token
// without `tv` (issued before this change) counts as tv=0.
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db/connection');
const { logger } = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';
// Pin the algorithm: never let the token header choose it.
const JWT_ALGORITHM = 'HS256';
const JWT_VERIFY_OPTIONS = Object.freeze({ algorithms: [JWT_ALGORITHM] });

// Secure cookie configuration
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches JWT expiry)
  path: '/'
};

/**
 * Verify a session JWT (signature, expiry, HS256 only). Throws like jwt.verify.
 * Does NOT check token_version: callers that read the user row must also call
 * isTokenVersionCurrent().
 */
function verifySessionToken(token) {
  return jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS);
}

// `tv` claim of a decoded token; tokens issued before H13 have none -> 0.
function tokenVersionOf(decoded) {
  const tv = decoded && decoded.tv;
  return Number.isInteger(tv) && tv >= 0 ? tv : 0;
}

// True when the token's `tv` matches the user's current users.token_version.
function isTokenVersionCurrent(decoded, userTokenVersion) {
  const current = Number.isInteger(Number(userTokenVersion)) ? Number(userTokenVersion) : 0;
  return tokenVersionOf(decoded) === current;
}

// Current users.token_version for a user id (0 when unknown/NULL).
function getUserTokenVersion(userId, db) {
  const database = db || getDatabase();
  const r = database.exec('SELECT token_version FROM users WHERE id = ?', [userId]);
  if (!r.length || !r[0].values.length) return 0;
  const v = Number(r[0].values[0][0]);
  return Number.isInteger(v) && v >= 0 ? v : 0;
}

/**
 * Revoke every JWT issued so far for this user (all devices) and close their
 * open dashboard websockets. The caller persists the write
 * (saveDatabaseAfterWrite) together with its own changes.
 */
function bumpTokenVersion(userId, db) {
  const database = db || getDatabase();
  database.run(
    'UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?',
    [userId]
  );
  try {
    // Lazy require: websocketService is only initialised in the server process.
    require('../services/websocketService').disconnectUser(userId, 4001, 'Session revoked');
  } catch (e) {
    logger.warn(`[Session] websocket disconnect after token revocation failed for user ${userId}: ${e.message}`);
  }
}

/**
 * Issue a session for the given user.
 * @param {import('express').Response} res
 * @param {{ id: number, email: string, role: string, timezone?: string, token_version?: number }} user
 * @returns {{ token: string, user: { id: number, email: string, role: string, timezone: string } }}
 */
function issueSession(res, user) {
  const tv = Number.isInteger(user.token_version) ? user.token_version : getUserTokenVersion(user.id);
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, tv },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, algorithm: JWT_ALGORITHM }
  );

  // Set secure HttpOnly session cookie
  res.cookie('session_token', token, SESSION_COOKIE_OPTIONS);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      timezone: user.timezone || 'UTC'
    }
  };
}

module.exports = {
  issueSession,
  verifySessionToken,
  isTokenVersionCurrent,
  tokenVersionOf,
  getUserTokenVersion,
  bumpTokenVersion,
  SESSION_COOKIE_OPTIONS,
  JWT_SECRET,
  JWT_VERIFY_OPTIONS
};
