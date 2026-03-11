// Bot Integration Routes
// API endpoints used by the Telegram bot to manage users
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');

const router = express.Router();

// Bot API key for authenticating bot requests
const BOT_API_KEY = process.env.BOT_API_KEY || 'dev-bot-api-key';

// Middleware to verify bot API key
function botAuth(req, res, next) {
  const apiKey = req.headers['x-bot-api-key'];
  if (!apiKey || apiKey !== BOT_API_KEY) {
    return res.status(401).json({ error: 'Invalid bot API key' });
  }
  next();
}

// POST /api/bot/register - Register or update a Telegram user with role
router.post('/register', botAuth, (req, res) => {
  try {
    const { telegram_id, role, language } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const validRoles = ['therapist', 'client'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Valid role (therapist/client) is required' });
    }

    const db = getDatabase();

    // Check if user already exists by telegram_id
    const existing = db.exec('SELECT id, role, telegram_id FROM users WHERE telegram_id = ?', [String(telegram_id)]);

    if (existing.length > 0 && existing[0].values.length > 0) {
      const existingUser = existing[0].values[0];
      logger.info(`Telegram user already exists: telegram_id=${telegram_id}, role=${existingUser[1]}`);
      return res.json({
        message: 'User already registered',
        user: {
          id: existingUser[0],
          telegram_id: existingUser[2],
          role: existingUser[1]
        },
        already_existed: true
      });
    }

    // Generate invite code for therapists
    const inviteCode = role === 'therapist' ? uuidv4().slice(0, 8) : null;

    // Insert new user
    db.run(
      'INSERT INTO users (telegram_id, role, invite_code, language) VALUES (?, ?, ?, ?)',
      [String(telegram_id), role, inviteCode, language || 'en']
    );

    saveDatabase();

    // Fetch the created user
    const result = db.exec(
      'SELECT id, telegram_id, role, invite_code, language, created_at FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const user = result[0].values[0];

    logger.info(`Telegram user registered: id=${user[0]}, telegram_id=${user[1]}, role=${user[2]}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user[0],
        telegram_id: user[1],
        role: user[2],
        invite_code: user[3],
        language: user[4],
        created_at: user[5]
      },
      already_existed: false
    });
  } catch (error) {
    logger.error('Bot register error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// GET /api/bot/user/:telegram_id - Get user by telegram_id
router.get('/user/:telegram_id', botAuth, (req, res) => {
  try {
    const { telegram_id } = req.params;
    const db = getDatabase();

    const result = db.exec(
      'SELECT id, telegram_id, role, invite_code, language, consent_therapist_access, therapist_id, created_at FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result[0].values[0];

    res.json({
      user: {
        id: user[0],
        telegram_id: user[1],
        role: user[2],
        invite_code: user[3],
        language: user[4],
        consent_therapist_access: !!user[5],
        therapist_id: user[6],
        created_at: user[7]
      }
    });
  } catch (error) {
    logger.error('Bot get user error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
