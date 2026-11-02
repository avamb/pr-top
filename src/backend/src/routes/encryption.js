// Encryption Management Routes
// Provides endpoints for encryption key management and data encryption/decryption

const express = require('express');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  encrypt,
  decrypt,
  rotateKey,
  getActiveKeyVersion,
  listKeyVersions
} = require('../services/encryption');

const router = express.Router();

// Audit M6: every route authenticates through the shared `authenticate`
// middleware, which re-reads the user row on each request (role, blocked_at,
// token_version). A JWT minted before a demotion or block therefore no longer
// grants access here; the role in the token itself is never trusted.
const requireSuperadmin = requireRole('superadmin');

// Debug encrypt/decrypt endpoints (audit H5). Fail closed, mirroring the
// /api/dev/* gate in index.js: available only when NODE_ENV is explicitly
// development/test (or ENABLE_DEV_ENDPOINTS=true) and never in production.
// When disabled they answer 404 so their existence isn't advertised.
// Evaluated per request so the gate follows the live environment.
function debugEndpointsEnabled() {
  const env = process.env.NODE_ENV;
  if (env === 'production') return false;
  return env === 'development' || env === 'test' || process.env.ENABLE_DEV_ENDPOINTS === 'true';
}

function requireDebugEndpoints(req, res, next) {
  if (!debugEndpointsEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

// GET /api/encryption/keys
// List all encryption key versions
router.get('/keys', authenticate, requireSuperadmin, (req, res) => {
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
router.post('/rotate', authenticate, requireSuperadmin, (req, res) => {
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
// Encrypt data (for testing/verification) - debug endpoint: 404 in production, superadmin-only elsewhere
router.post('/encrypt', requireDebugEndpoints, authenticate, requireSuperadmin, (req, res) => {
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
// Decrypt data (for testing/verification) - debug endpoint: 404 in production, superadmin-only elsewhere
router.post('/decrypt', requireDebugEndpoints, authenticate, requireSuperadmin, (req, res) => {
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
// Get the current active encryption key version - debug endpoint: 404 in production, superadmin-only elsewhere
router.get('/active-version', requireDebugEndpoints, authenticate, requireSuperadmin, (req, res) => {
  try {
    const version = getActiveKeyVersion();
    res.json({ active_version: version });
  } catch (error) {
    logger.error('Get active version error: ' + error.message);
    res.status(500).json({ error: 'Failed to get active version' });
  }
});

module.exports = router;
