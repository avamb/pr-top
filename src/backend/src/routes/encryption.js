// Encryption Management Routes
// Provides endpoints for encryption key management and data encryption/decryption

const express = require('express');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const {
  encrypt,
  decrypt,
  rotateKey,
  getActiveKeyVersion,
  listKeyVersions
} = require('../services/encryption');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Auth middleware
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Require superadmin for key management
function requireSuperadmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
}

// Require development mode OR superadmin for debug endpoints
// In production, only superadmins can access encrypt/decrypt test endpoints
function requireDevOrSuperadmin(req, res, next) {
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  if (isDev) {
    return next();
  }
  // In production, only superadmin can access debug endpoints
  if (req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ error: 'Debug endpoints are disabled in production' });
}

// GET /api/encryption/keys
// List all encryption key versions
router.get('/keys', requireAuth, requireSuperadmin, (req, res) => {
  try {
    const keys = listKeyVersions();
    const activeVersion = getActiveKeyVersion();
    res.json({ keys, active_version: activeVersion });
  } catch (error) {
    logger.error('List encryption keys error: ' + error.message);
    res.status(500).json({ error: 'Failed to list encryption keys' });
  }
});

// POST /api/encryption/rotate
// Rotate encryption key (create new version)
router.post('/rotate', requireAuth, requireSuperadmin, (req, res) => {
  try {
    const result = rotateKey();
    const keys = listKeyVersions();
    res.json({
      message: 'Encryption key rotated successfully',
      new_version: result.newVersion,
      new_key_id: result.newKeyId,
      keys
    });
  } catch (error) {
    logger.error('Rotate encryption key error: ' + error.message);
    res.status(500).json({ error: 'Failed to rotate encryption key' });
  }
});

// POST /api/encryption/encrypt
// Encrypt data (for testing/verification) - debug endpoint, dev-only or superadmin
router.post('/encrypt', requireAuth, requireDevOrSuperadmin, (req, res) => {
  try {
    const { plaintext } = req.body;
    if (!plaintext) {
      return res.status(400).json({ error: 'plaintext is required' });
    }

    const result = encrypt(plaintext);
    res.json({
      encrypted: result.encrypted,
      key_version: result.keyVersion,
      key_id: result.keyId
    });
  } catch (error) {
    logger.error('Encrypt error: ' + error.message);
    res.status(500).json({ error: 'Encryption failed' });
  }
});

// POST /api/encryption/decrypt
// Decrypt data (for testing/verification) - debug endpoint, dev-only or superadmin
router.post('/decrypt', requireAuth, requireDevOrSuperadmin, (req, res) => {
  try {
    const { encrypted } = req.body;
    if (!encrypted) {
      return res.status(400).json({ error: 'encrypted data is required' });
    }

    const plaintext = decrypt(encrypted);
    res.json({ plaintext });
  } catch (error) {
    logger.error('Decrypt error: ' + error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// GET /api/encryption/active-version
// Get the current active encryption key version - debug endpoint, dev-only or superadmin
router.get('/active-version', requireAuth, requireDevOrSuperadmin, (req, res) => {
  try {
    const version = getActiveKeyVersion();
    res.json({ active_version: version });
  } catch (error) {
    logger.error('Get active version error: ' + error.message);
    res.status(500).json({ error: 'Failed to get active version' });
  }
});

module.exports = router;
