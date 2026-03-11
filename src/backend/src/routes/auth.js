// Authentication Routes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const validRoles = ['therapist', 'client', 'superadmin'];
    const userRole = validRoles.includes(role) ? role : 'therapist';

    const db = getDatabase();

    // Check if user already exists
    const existing = db.exec('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const inviteCode = uuidv4().slice(0, 8);

    logger.info(`Registering new user: ${email} with role: ${userRole}`);

    // Insert user into database
    db.run(
      'INSERT INTO users (email, password_hash, role, invite_code) VALUES (?, ?, ?, ?)',
      [email, passwordHash, userRole, inviteCode]
    );

    // Save to disk after write
    saveDatabase();

    // Get the inserted user
    const result = db.exec('SELECT id, email, role, created_at FROM users WHERE email = ?', [email]);
    const user = result[0].values[0];
    const userId = user[0];

    // Create trial subscription for therapists
    if (userRole === 'therapist') {
      let trialDays = 14;
      try {
        const settingsResult = db.exec("SELECT value FROM platform_settings WHERE key = 'trial_duration_days'");
        if (settingsResult.length > 0 && settingsResult[0].values.length > 0) {
          trialDays = parseInt(settingsResult[0].values[0][0], 10) || 14;
        }
      } catch (e) {
        logger.warn('Could not read trial_duration_days setting, using default 14');
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

      db.run(
        `INSERT INTO subscriptions (therapist_id, plan, status, trial_ends_at, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, 'trial', 'active', ?, ?, ?, ?, ?)`,
        [userId, trialEnd.toISOString(), now.toISOString(), trialEnd.toISOString(), now.toISOString(), now.toISOString()]
      );
      logger.info(`Trial subscription created for therapist id=${userId}, expires ${trialEnd.toISOString()}`);
    }

    saveDatabase();

    // Generate JWT
    const token = jwt.sign(
      { userId: userId, email: user[1], role: user[2] },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`User registered successfully: id=${userId}, email=${user[1]}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        email: user[1],
        role: user[2],
        created_at: user[3]
      },
      token
    });
  } catch (error) {
    logger.error('Registration error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDatabase();

    logger.info(`Login attempt for: ${email}`);

    const result = db.exec(
      'SELECT id, email, password_hash, role, blocked_at FROM users WHERE email = ?',
      [email]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result[0].values[0];
    const isValid = await bcrypt.compare(password, user[2]);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is blocked
    if (user[4]) {
      logger.warn(`Blocked user attempted login: id=${user[0]}, email=${user[1]}`);
      return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
    }

    const token = jwt.sign(
      { userId: user[0], email: user[1], role: user[3] },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`User logged in: id=${user[0]}, email=${user[1]}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user[0],
        email: user[1],
        role: user[3]
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const db = getDatabase();

    logger.info(`Fetching user profile: id=${decoded.userId}`);

    const result = db.exec(
      'SELECT id, email, role, language, timezone, created_at, blocked_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result[0].values[0];

    // Check if user is blocked
    if (user[6]) {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
    }

    res.json({
      user: {
        id: user[0],
        email: user[1],
        role: user[2],
        language: user[3],
        timezone: user[4],
        created_at: user[5]
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    logger.error('Auth/me error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

module.exports = router;
