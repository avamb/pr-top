// Client Routes - Therapist client management
const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkClientLimit } = require('../utils/planLimits');

const router = express.Router();

// All client routes require authenticated therapist
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

// GET /api/clients - List therapist's linked clients
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;

    const result = db.exec(
      `SELECT id, telegram_id, email, consent_therapist_access, language, created_at, updated_at
       FROM users
       WHERE therapist_id = ? AND role = 'client'
       ORDER BY created_at DESC`,
      [therapistId]
    );

    const clients = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      telegram_id: row[1],
      email: row[2],
      consent_therapist_access: !!row[3],
      language: row[4],
      created_at: row[5],
      updated_at: row[6]
    }));

    // Also include limit info
    const limitCheck = checkClientLimit(therapistId);

    res.json({
      clients,
      total: clients.length,
      limit: limitCheck.limit,
      can_add: limitCheck.allowed,
      plan: limitCheck.plan,
      limit_message: limitCheck.message
    });
  } catch (error) {
    logger.error('List clients error: ' + error.message);
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

// POST /api/clients/link - Link a client to this therapist (via invite code)
router.post('/link', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const { client_id } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    // Check client limit before linking
    const limitCheck = checkClientLimit(therapistId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Client limit reached',
        message: limitCheck.message,
        current: limitCheck.current,
        limit: limitCheck.limit,
        plan: limitCheck.plan
      });
    }

    // Verify client exists and is a client role
    const clientResult = db.exec(
      'SELECT id, role, therapist_id FROM users WHERE id = ?',
      [client_id]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult[0].values[0];
    if (client[1] !== 'client') {
      return res.status(400).json({ error: 'User is not a client' });
    }

    if (client[2] && client[2] !== therapistId) {
      return res.status(400).json({ error: 'Client is already linked to another therapist' });
    }

    // Link the client
    db.run(
      "UPDATE users SET therapist_id = ?, updated_at = datetime('now') WHERE id = ?",
      [therapistId, client_id]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} linked client ${client_id}`);

    res.json({
      message: 'Client linked successfully',
      client_id: parseInt(client_id)
    });
  } catch (error) {
    logger.error('Link client error: ' + error.message);
    res.status(500).json({ error: 'Failed to link client' });
  }
});

module.exports = router;
