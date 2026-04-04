// Invite Code Routes - Therapist invite code management
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
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
      saveDatabaseAfterWrite();
      logger.info(`Generated initial invite code for therapist id=${therapistId}`);
      return res.json({ invite_code: newCode });
    }

    res.json({ invite_code: inviteCode });
  } catch (error) {
    logger.error('Get invite code error: ' + error.message);
    res.status(500).json({ error: 'Failed to get invite code' });
  }
});

// GET /api/invite-code/link - Get invite deep link for Telegram bot
router.get('/link', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const botUsername = process.env.BOT_USERNAME || '';

    if (!botUsername) {
      return res.status(400).json({ error: 'BOT_USERNAME is not configured on the server' });
    }

    const result = db.exec(
      'SELECT invite_code FROM users WHERE id = ? AND role IN (?, ?)',
      [therapistId, 'therapist', 'superadmin']
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Therapist not found' });
    }

    let inviteCode = result[0].values[0][0];

    // Auto-generate if no invite code exists yet
    if (!inviteCode) {
      inviteCode = uuidv4().slice(0, 8).toUpperCase();
      db.run('UPDATE users SET invite_code = ? WHERE id = ?', [inviteCode, therapistId]);
      saveDatabaseAfterWrite();
      logger.info(`Generated initial invite code for therapist id=${therapistId}`);
    }

    const inviteLink = `https://t.me/${botUsername}?start=${inviteCode}`;

    res.json({
      invite_link: inviteLink,
      invite_code: inviteCode,
      bot_username: botUsername
    });
  } catch (error) {
    logger.error('Get invite link error: ' + error.message);
    res.status(500).json({ error: 'Failed to get invite link' });
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
    saveDatabaseAfterWrite();

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
