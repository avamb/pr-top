// Invite Code Routes - Therapist invite code management
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All invite code routes require authenticated therapist
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

// GET /api/invite-code - Get current invite code for the therapist
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;

    const result = db.exec(
      'SELECT invite_code FROM users WHERE id = ? AND role IN (?, ?)',
      [therapistId, 'therapist', 'superadmin']
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Therapist not found' });
    }

    const inviteCode = result[0].values[0][0];

    // If no invite code exists yet, generate one
    if (!inviteCode) {
      const newCode = uuidv4().slice(0, 8).toUpperCase();
      db.run('UPDATE users SET invite_code = ? WHERE id = ?', [newCode, therapistId]);
      saveDatabase();
      logger.info(`Generated initial invite code for therapist id=${therapistId}`);
      return res.json({ invite_code: newCode });
    }

    res.json({ invite_code: inviteCode });
  } catch (error) {
    logger.error('Get invite code error: ' + error.message);
    res.status(500).json({ error: 'Failed to get invite code' });
  }
});

// POST /api/invite-code/regenerate - Generate a new invite code
router.post('/regenerate', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;

    // Generate new unique code
    const newCode = uuidv4().slice(0, 8).toUpperCase();

    db.run('UPDATE users SET invite_code = ? WHERE id = ?', [newCode, therapistId]);
    saveDatabase();

    logger.info(`Regenerated invite code for therapist id=${therapistId}: ${newCode}`);

    res.json({
      invite_code: newCode,
      message: 'Invite code regenerated successfully'
    });
  } catch (error) {
    logger.error('Regenerate invite code error: ' + error.message);
    res.status(500).json({ error: 'Failed to regenerate invite code' });
  }
});

module.exports = router;
