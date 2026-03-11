// Query Routes - Natural Language query for therapist client data
// Gated to Pro/Premium subscription tiers

const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const { executeNLQuery } = require('../services/nlQuery');

const router = express.Router();

// All query routes require authenticated therapist
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

// Tier gating: only Pro and Premium can use NL queries
function requireNLQueryAccess(req, res, next) {
  const db = getDatabase();
  const userId = req.user.id;

  // Superadmin always has access
  if (req.user.role === 'superadmin') return next();

  const subResult = db.exec(
    `SELECT plan, status FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (subResult.length === 0 || subResult[0].values.length === 0) {
    return res.status(403).json({
      error: 'No active subscription',
      message: 'Natural language queries require a Pro or Premium subscription.'
    });
  }

  const [plan, status] = subResult[0].values[0];

  if (status !== 'active') {
    return res.status(403).json({
      error: 'Subscription inactive',
      message: 'Your subscription is not active. Please renew to use NL queries.'
    });
  }

  if (!['pro', 'premium'].includes(plan)) {
    return res.status(403).json({
      error: 'Plan upgrade required',
      message: 'Natural language queries are available on Pro and Premium plans. Please upgrade to access this feature.',
      current_plan: plan,
      required_plans: ['pro', 'premium']
    });
  }

  req.subscription = { plan, status };
  next();
}

// POST /api/query
// Natural language text query about a specific client
// Body: { client_id: number, query: string, limit?: number }
router.post('/', requireNLQueryAccess, (req, res) => {
  try {
    const { client_id, query, limit } = req.body;
    const therapistId = req.user.id;

    // Validate inputs
    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'query text is required' });
    }
    if (query.trim().length > 1000) {
      return res.status(400).json({ error: 'Query too long (max 1000 characters)' });
    }

    const db = getDatabase();

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      `SELECT id, telegram_id, consent_therapist_access FROM users
       WHERE id = ? AND therapist_id = ? AND role = 'client'`,
      [client_id, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const clientRow = clientResult[0].values[0];
    if (!clientRow[2]) { // consent_therapist_access
      return res.status(403).json({ error: 'Client has not granted access consent' });
    }

    // Execute NL query
    const result = executeNLQuery(therapistId, client_id, query.trim(), {
      limit: Math.min(limit || 10, 50)
    });

    // Audit log the query
    try {
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at)
         VALUES (?, 'nl_query', 'client', ?, datetime('now'))`,
        [therapistId, client_id]
      );
      saveDatabase();
    } catch (auditErr) {
      logger.warn('Failed to audit log NL query: ' + auditErr.message);
    }

    logger.info(`NL query by therapist ${therapistId} for client ${client_id}: "${query.trim().substring(0, 50)}..." -> ${result.total_matches} matches`);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('NL query error: ' + error.message);
    res.status(500).json({ error: 'Failed to execute query' });
  }
});

module.exports = router;
