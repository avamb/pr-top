const crypto = require('crypto');

/**
 * CSRF Protection Middleware for SPA
 *
 * Uses the Synchronizer Token Pattern:
 * 1. GET /api/csrf-token returns a CSRF token
 * 2. State-changing requests (POST/PUT/DELETE/PATCH) must include X-CSRF-Token header
 * 3. Requests with valid Authorization (JWT) headers are exempt (API-to-API calls)
 *
 * For SPAs using JWT in Authorization headers, CSRF risk is minimal since
 * browsers don't auto-attach custom headers in cross-origin requests.
 * This adds defense-in-depth.
 */

// In-memory token store (per-session tokens)
const csrfTokens = new Map();

// Clean up expired tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.created > 2 * 60 * 60 * 1000) { // 2 hour expiry
      csrfTokens.delete(token);
    }
  }
}, 30 * 60 * 1000);

function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, { created: Date.now() });
  return token;
}

function validateCsrfToken(token) {
  if (!token) return false;
  const data = csrfTokens.get(token);
  if (!data) return false;
  // Token valid for 2 hours
  if (Date.now() - data.created > 2 * 60 * 60 * 1000) {
    csrfTokens.delete(token);
    return false;
  }
  return true;
}

/**
 * CSRF token endpoint handler
 */
function csrfTokenEndpoint(req, res) {
  const token = generateCsrfToken();
  res.json({ csrfToken: token });
}

/**
 * CSRF protection middleware
 * Validates X-CSRF-Token header on state-changing requests
 */
function csrfProtection(req, res, next) {
  // Safe methods don't need CSRF protection
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Webhook endpoints are exempt (use their own signature verification)
  if (req.path.startsWith('/api/webhooks') || req.path.startsWith('/webhooks') || req.originalUrl.startsWith('/api/webhooks')) {
    return next();
  }

  // Bot API endpoints are exempt (server-to-server with bot auth)
  if (req.path.startsWith('/api/bot/') || req.path.startsWith('/bot/') || req.originalUrl.startsWith('/api/bot/')) {
    return next();
  }

  // Fully public anonymous endpoints — no session/auth to protect, CSRF provides no value
  const publicPaths = ['/api/assistant/public-chat', '/api/auth/register-lead'];
  if (publicPaths.includes(req.originalUrl.split('?')[0]) || publicPaths.includes(req.path)) {
    return next();
  }

  // Dev endpoints are exempt (only available in development mode)
  if (req.path.startsWith('/api/dev/') || req.originalUrl.startsWith('/api/dev/')) {
    return next();
  }

  // Requests with Authorization header (JWT) are already CSRF-safe
  // because browsers don't auto-attach custom Authorization headers
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // For non-authenticated state-changing requests (login, register),
  // require CSRF token
  const csrfToken = req.headers['x-csrf-token'];
  if (!csrfToken) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'A CSRF token is required for this request. Get one from GET /api/csrf-token'
    });
  }

  if (!validateCsrfToken(csrfToken)) {
    return res.status(403).json({
      error: 'CSRF token invalid',
      message: 'The CSRF token is invalid or expired. Get a new one from GET /api/csrf-token'
    });
  }

  next();
}

module.exports = { csrfProtection, csrfTokenEndpoint, generateCsrfToken, validateCsrfToken };
