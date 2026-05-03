// Supervision Share Routes (T-17)
// Public, read-only endpoint mounted at /share/supervision/:token (and also as
// /api/share/supervision/:token through the same router for SPA convenience).
// No authentication, no CSRF — supervisor authenticates by possession of the
// opaque token. Each access is recorded in audit_logs.

const express = require('express');
const supervisionShare = require('../services/supervisionShare');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /share/supervision/:token
 * Returns the read-only supervisor view payload, or 404 when the link is
 * unknown / revoked / expired.
 */
router.get('/supervision/:token', (req, res) => {
  try {
    const token = req.params.token;
    if (!token || token.length < 8 || token.length > 256) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    const link = supervisionShare.findActiveLinkByToken(token);
    if (!link) {
      return res.status(404).json({ error: 'Share link not found, revoked, or expired' });
    }

    let view;
    try {
      view = supervisionShare.buildSupervisorView(link);
    } catch (e) {
      logger.error('Failed to build supervisor view: ' + e.message);
      return res.status(500).json({ error: 'Failed to load supervisor view' });
    }

    // Best-effort access logging (non-blocking)
    const ip = (req.ip || req.headers['x-forwarded-for'] || '').toString().slice(0, 64) || null;
    supervisionShare.recordAccess(link.id, ip, {
      user_agent: (req.headers['user-agent'] || '').toString().slice(0, 200),
    });

    res.json({
      ok: true,
      view,
      meta: {
        anonymize: !!link.anonymize,
        expires_at: link.expires_at,
        created_at: link.created_at,
      },
    });
  } catch (error) {
    logger.error('Supervision share view error: ' + error.message);
    res.status(500).json({ error: 'Failed to load share link' });
  }
});

/**
 * HEAD /share/supervision/:token — convenience for clients to check validity
 * without fetching the full payload.
 */
router.head('/supervision/:token', (req, res) => {
  try {
    const token = req.params.token;
    const link = supervisionShare.findActiveLinkByToken(token);
    if (!link) return res.status(404).end();
    res.status(200).end();
  } catch (e) {
    res.status(500).end();
  }
});

module.exports = router;
