// Session issuance helper
//
// Single place that turns an authenticated user row into a session:
// signs the JWT and sets the HttpOnly session cookie. Used by /login,
// /register and (wave 2) the email-code login endpoints so every entry point
// produces the same token claims, cookie options and `user` payload shape.
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Secure cookie configuration
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches JWT expiry)
  path: '/'
};

/**
 * Issue a session for the given user.
 * @param {import('express').Response} res
 * @param {{ id: number, email: string, role: string, timezone?: string }} user
 * @returns {{ token: string, user: { id: number, email: string, role: string, timezone: string } }}
 */
function issueSession(res, user) {
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
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

module.exports = { issueSession, SESSION_COOKIE_OPTIONS, JWT_SECRET };
