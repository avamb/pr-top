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

// POST /api/bot/connect - Client enters invite code to connect with therapist
router.post('/connect', botAuth, (req, res) => {
  try {
    const { telegram_id, invite_code } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }
    if (!invite_code) {
      return res.status(400).json({ error: 'invite_code is required' });
    }

    const db = getDatabase();

    // Verify the client exists and is a client
    const clientResult = db.exec(
      'SELECT id, role, therapist_id, consent_therapist_access FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found. Please register first with /start.' });
    }

    const client = clientResult[0].values[0];
    const clientId = client[0];
    const clientRole = client[1];
    const existingTherapistId = client[2];

    if (clientRole !== 'client') {
      return res.status(400).json({ error: 'Only clients can use invite codes to connect.' });
    }

    if (existingTherapistId) {
      return res.status(400).json({
        error: 'You are already connected to a therapist. Use /disconnect first if you want to change.',
        therapist_id: existingTherapistId
      });
    }

    // Look up therapist by invite code (case-insensitive)
    const therapistResult = db.exec(
      "SELECT id, email, telegram_id, role, blocked_at FROM users WHERE LOWER(invite_code) = LOWER(?) AND role = 'therapist'",
      [invite_code.trim()]
    );

    if (therapistResult.length === 0 || therapistResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Invalid invite code. Please check the code and try again.' });
    }

    const therapist = therapistResult[0].values[0];
    const therapistId = therapist[0];
    const therapistBlocked = therapist[4];

    if (therapistBlocked) {
      return res.status(400).json({ error: 'This therapist account is currently unavailable.' });
    }

    logger.info(`Client ${clientId} (telegram_id=${telegram_id}) found therapist ${therapistId} via invite code`);

    // Return therapist info for consent flow - do NOT link yet (consent required)
    res.json({
      message: 'Therapist found. Consent is required before linking.',
      therapist: {
        id: therapistId,
        display_name: therapist[1] || `Therapist #${therapistId}`
      },
      client_id: clientId,
      requires_consent: true
    });
  } catch (error) {
    logger.error('Bot connect error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Connection failed: ' + error.message });
  }
});

// POST /api/bot/consent - Client gives consent and links to therapist
router.post('/consent', botAuth, (req, res) => {
  try {
    const { telegram_id, therapist_id, consent } = req.body;

    if (!telegram_id || !therapist_id) {
      return res.status(400).json({ error: 'telegram_id and therapist_id are required' });
    }

    const db = getDatabase();

    // Verify client
    const clientResult = db.exec(
      'SELECT id, role, therapist_id FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult[0].values[0];
    if (client[1] !== 'client') {
      return res.status(400).json({ error: 'Only clients can give consent' });
    }

    if (consent === false) {
      // Record consent decline in audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [client[0], 'consent_declined', 'user', therapist_id, JSON.stringify({ client_id: client[0], therapist_id: parseInt(therapist_id), telegram_id: String(telegram_id) })]
      );
      saveDatabase();
      logger.info(`Client ${client[0]} declined consent for therapist ${therapist_id}`);
      return res.json({ message: 'Consent declined. No connection was made.', linked: false });
    }

    // Link client to therapist with consent
    db.run(
      "UPDATE users SET therapist_id = ?, consent_therapist_access = 1, updated_at = datetime('now') WHERE id = ?",
      [therapist_id, client[0]]
    );

    // Record consent grant in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [client[0], 'consent_granted', 'user', therapist_id, JSON.stringify({ client_id: client[0], therapist_id: parseInt(therapist_id), telegram_id: String(telegram_id) })]
    );

    saveDatabase();

    logger.info(`Client ${client[0]} consented and linked to therapist ${therapist_id}`);

    res.json({
      message: 'Successfully connected to therapist',
      linked: true,
      client_id: client[0],
      therapist_id: parseInt(therapist_id)
    });
  } catch (error) {
    logger.error('Bot consent error: ' + error.message);
    res.status(500).json({ error: 'Consent processing failed: ' + error.message });
  }
});

module.exports = router;
