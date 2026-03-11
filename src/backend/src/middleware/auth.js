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

module.exports = { authenticate, requireRole };
