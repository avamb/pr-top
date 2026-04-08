// Authentication Routes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const emailService = require('../services/emailService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Secure cookie configuration
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches JWT expiry)
  path: '/'
};

// Helper: extract token from Authorization header or session cookie
function extractToken(req) {
  // 1. Check Authorization header first (API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  // 2. Fall back to HttpOnly session cookie (browser clients)
  if (req.cookies && req.cookies.session_token) {
    return req.cookies.session_token;
  }
  return null;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, language, timezone, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body;

    // Validate required fields individually
    const missingFields = [];
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields: ' + missingFields.join(', '),
        missing_fields: missingFields
      });
    }

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Public registration is restricted to therapist role only.
    // Client accounts are created through bot invite flow.
    // Superadmin accounts are created via CLI/seed only.
    if (role && role !== 'therapist') {
      return res.status(400).json({
        error: 'Public registration is only available for therapist accounts. Client and superadmin accounts cannot be created through public registration.'
      });
    }
    const userRole = 'therapist';

    const db = getDatabase();

    // Check if user already exists (case-insensitive via normalized email)
    const existing = db.exec('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Validate password strength
    const pwdErrors = [];
    if (password.length < 8) pwdErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwdErrors.push('at least one uppercase letter');
    if (!/[a-z]/.test(password)) pwdErrors.push('at least one lowercase letter');
    if (!/[0-9]/.test(password)) pwdErrors.push('at least one number');
    if (pwdErrors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet requirements: ' + pwdErrors.join(', ') });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const inviteCode = uuidv4().slice(0, 8);

    logger.info(`Registering new user: ${normalizedEmail} with role: ${userRole}`);

    // Validate and set language/timezone defaults
    const supportedLanguages = ['en', 'ru', 'es'];
    const userLanguage = supportedLanguages.includes(language) ? language : 'en';
    const userTimezone = (timezone && typeof timezone === 'string' && timezone.length <= 100) ? timezone : 'UTC';

    // Generate unique referral code for the new therapist
    const referralCode = crypto.randomBytes(4).toString('hex'); // 8 hex chars

    // Resolve referral: check if ref param is provided
    let referredBy = null;
    const refCode = req.body.ref || req.query.ref;
    if (refCode) {
      try {
        const refResult = db.exec('SELECT id FROM users WHERE referral_code = ?', [refCode]);
        if (refResult.length > 0 && refResult[0].values.length > 0) {
          referredBy = refResult[0].values[0][0];
          logger.info(`Referral resolved: code=${refCode} -> user_id=${referredBy}`);
        } else {
          logger.warn(`Referral code not found: ${refCode}`);
        }
      } catch (e) {
        logger.warn('Referral resolution error: ' + e.message);
      }
    }

    // Insert user into database with UTM tracking, locale defaults, referral code, and referred_by
    db.run(
      'INSERT INTO users (email, password_hash, role, invite_code, language, timezone, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [normalizedEmail, passwordHash, userRole, inviteCode, userLanguage, userTimezone, utm_source || null, utm_medium || null, utm_campaign || null, utm_content || null, utm_term || null, referralCode, referredBy]
    );

    // Save to disk after write
    saveDatabaseAfterWrite();

    // Get the inserted user
    const result = db.exec('SELECT id, email, role, created_at FROM users WHERE email = ?', [normalizedEmail]);
    const user = result[0].values[0];
    const userId = user[0];

    // Create trial subscription for therapists
    let trialDays = 14;
    if (userRole === 'therapist') {
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

    saveDatabaseAfterWrite();

    // Generate JWT
    const token = jwt.sign(
      { userId: userId, email: user[1], role: user[2] },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`User registered successfully: id=${userId}, email=${user[1]}`);

    // Send welcome email (non-blocking, failure won't break registration)
    emailService.sendWelcomeEmail(user[1], trialDays, userLanguage)
      .then(result => {
        if (result.sent) {
          logger.info(`Welcome email sent to ${user[1]}`);
        } else {
          logger.info(`[EMAIL] Welcome email for ${user[1]}: ${result.error || 'not sent'}`);
        }
      })
      .catch(err => {
        logger.error(`Welcome email error for ${user[1]}: ${err.message}`);
      });

    // Set secure HttpOnly session cookie
    res.cookie('session_token', token, SESSION_COOKIE_OPTIONS);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        email: user[1],
        role: user[2],
        created_at: user[3],
        timezone: userTimezone
      },
      token
    });
  } catch (error) {
    logger.error('Registration error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields individually
    const missingFields = [];
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields: ' + missingFields.join(', '),
        missing_fields: missingFields
      });
    }

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email.trim().toLowerCase();

    const db = getDatabase();

    logger.info(`Login attempt for: ${normalizedEmail}`);

    const result = db.exec(
      'SELECT id, email, password_hash, role, blocked_at, timezone FROM users WHERE email = ?',
      [normalizedEmail]
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

    // Set secure HttpOnly session cookie
    res.cookie('session_token', token, SESSION_COOKIE_OPTIONS);

    res.json({
      message: 'Login successful',
      user: {
        id: user[0],
        email: user[1],
        role: user[3],
        timezone: user[5] || 'UTC'
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register-viewer
// Email-only registration from the public chat CTA.
// Creates a user with role='viewer', links anonymous session, migrates messages, issues JWT.
router.post('/register-viewer', async (req, res) => {
  try {
    const { email, session_uuid, language } = req.body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const db = getDatabase();

    // Check if user already exists
    const existing = db.exec('SELECT id, role, email FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      const existingUser = existing[0].values[0];
      const existingRole = existingUser[1];

      // If they're already a viewer, log them in
      if (existingRole === 'viewer') {
        const token = jwt.sign(
          { userId: existingUser[0], email: existingUser[2], role: 'viewer' },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        // Link session if provided
        if (session_uuid) {
          try {
            db.run('UPDATE viewer_sessions SET email = ?, user_id = ? WHERE uuid = ?', [normalizedEmail, existingUser[0], session_uuid]);
            saveDatabaseAfterWrite();
          } catch (e) {
            logger.warn('Could not link viewer session: ' + e.message);
          }
        }

        res.cookie('session_token', token, SESSION_COOKIE_OPTIONS);
        return res.json({
          message: 'Welcome back! You are now logged in.',
          existing: true,
          user: { id: existingUser[0], email: existingUser[2], role: 'viewer' },
          token
        });
      }

      // If they're a therapist/admin, tell them to use the login page
      return res.status(409).json({
        error: 'An account with this email already exists. Please use the login page.',
        existing_role: existingRole,
        login_url: '/login'
      });
    }

    // Create new viewer user (no password required)
    const inviteCode = uuidv4().slice(0, 8);
    const supportedLanguages = ['en', 'ru', 'es', 'uk'];
    const userLanguage = supportedLanguages.includes(language) ? language : 'en';

    db.run(
      'INSERT INTO users (email, password_hash, role, invite_code, language, timezone) VALUES (?, ?, ?, ?, ?, ?)',
      [normalizedEmail, '', 'viewer', inviteCode, userLanguage, 'UTC']
    );
    saveDatabaseAfterWrite();

    // Get the inserted user
    const result = db.exec('SELECT id, email, role, created_at FROM users WHERE email = ?', [normalizedEmail]);
    const user = result[0].values[0];
    const userId = user[0];

    // Link anonymous session to viewer account
    if (session_uuid) {
      try {
        // Update viewer_sessions with email and user_id
        db.run('UPDATE viewer_sessions SET email = ?, user_id = ? WHERE uuid = ?', [normalizedEmail, userId, session_uuid]);

        // Migrate anonymous conversations (therapist_id=0) to this user
        // Find the conversation linked to this session
        const sessionResult = db.exec('SELECT id FROM viewer_sessions WHERE uuid = ?', [session_uuid]);
        if (sessionResult.length > 0 && sessionResult[0].values.length > 0) {
          const viewerSessionId = sessionResult[0].values[0][0];
          // Update conversations that were created as anonymous (therapist_id=0) for this session's timeframe
          // We link them by updating therapist_id from 0 to the new viewer userId
          db.run(
            "UPDATE assistant_conversations SET therapist_id = ? WHERE therapist_id = 0 AND page_context = 'landing' AND id IN (SELECT ac.id FROM assistant_conversations ac WHERE ac.therapist_id = 0 AND ac.page_context = 'landing' ORDER BY ac.last_message_at DESC LIMIT 1)",
            [userId]
          );
        }

        saveDatabaseAfterWrite();
        logger.info(`[ViewerReg] Linked session ${session_uuid} to viewer user ${userId}`);
      } catch (e) {
        logger.warn('[ViewerReg] Session linking error: ' + e.message);
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: userId, email: user[1], role: 'viewer' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`[ViewerReg] Viewer registered: id=${userId}, email=${normalizedEmail}`);

    // Send viewer welcome email (non-blocking)
    emailService.sendViewerWelcomeEmail(normalizedEmail, userLanguage)
      .then(result => {
        if (result.sent) {
          logger.info(`[ViewerReg] Welcome email sent to ${normalizedEmail}`);
        } else {
          logger.info(`[EMAIL] Viewer welcome for ${normalizedEmail}: ${result.error || 'not sent'}`);
        }
      })
      .catch(err => {
        logger.error(`[ViewerReg] Welcome email error for ${normalizedEmail}: ${err.message}`);
      });

    // Set secure HttpOnly session cookie
    res.cookie('session_token', token, SESSION_COOKIE_OPTIONS);

    res.status(201).json({
      message: 'Registered successfully! You can continue chatting.',
      user: {
        id: userId,
        email: user[1],
        role: 'viewer',
        created_at: user[3]
      },
      token
    });
  } catch (error) {
    logger.error('[ViewerReg] Registration error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// POST /api/auth/register-lead
// Creates a lead record (NOT a user) in the leads table, generates verification token, sends verification email.
// After registration, lead gets +10 messages in the chat. After email verification, +10 more.
router.post('/register-lead', async (req, res) => {
  try {
    const { email, session_uuid, language, utm_source, utm_medium, utm_campaign } = req.body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const db = getDatabase();
    const supportedLanguages = ['en', 'ru', 'es', 'uk'];
    const leadLanguage = supportedLanguages.includes(language) ? language : 'en';

    // Check if this email is already a therapist/admin user
    const existingUser = db.exec('SELECT id, role FROM users WHERE email = ?', [normalizedEmail]);
    if (existingUser.length > 0 && existingUser[0].values.length > 0) {
      const role = existingUser[0].values[0][1];
      if (role !== 'viewer') {
        return res.status(409).json({
          error: 'An account with this email already exists. Please use the login page.',
          existing_role: role,
          login_url: '/login'
        });
      }
    }

    // Check if lead already exists
    const existingLead = db.exec('SELECT id, verified, extra_messages_limit, message_count FROM leads WHERE email = ?', [normalizedEmail]);
    if (existingLead.length > 0 && existingLead[0].values.length > 0) {
      const lead = existingLead[0].values[0];
      const leadId = lead[0];
      const verified = lead[1];
      const extraLimit = lead[2];

      // Update session_uuid and last_active for returning lead
      if (session_uuid) {
        db.run("UPDATE leads SET session_uuid = ?, last_active = datetime('now') WHERE id = ?", [session_uuid, leadId]);
        // Link viewer_sessions
        db.run('UPDATE viewer_sessions SET email = ? WHERE uuid = ?', [normalizedEmail, session_uuid]);
        saveDatabaseAfterWrite();
      }

      return res.json({
        message: 'Welcome back!',
        existing: true,
        lead: { id: leadId, email: normalizedEmail, verified: !!verified, extra_messages_limit: extraLimit }
      });
    }

    // Create new lead
    const verificationToken = uuidv4();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    db.run(
      `INSERT INTO leads (email, session_uuid, language, source, verified, verification_token, token_expires_at, extra_messages_limit, utm_source, utm_medium, utm_campaign)
       VALUES (?, ?, ?, 'landing_chat', 0, ?, ?, 10, ?, ?, ?)`,
      [normalizedEmail, session_uuid || null, leadLanguage, verificationToken, tokenExpiry,
       utm_source || null, utm_medium || null, utm_campaign || null]
    );
    saveDatabaseAfterWrite();

    // Link viewer_sessions with email
    if (session_uuid) {
      try {
        db.run('UPDATE viewer_sessions SET email = ? WHERE uuid = ?', [normalizedEmail, session_uuid]);
        saveDatabaseAfterWrite();
      } catch (e) {
        logger.warn('[LeadReg] Could not link viewer session: ' + e.message);
      }
    }

    // Get the created lead
    const newLeadResult = db.exec('SELECT id FROM leads WHERE email = ?', [normalizedEmail]);
    const leadId = newLeadResult[0].values[0][0];

    logger.info(`[LeadReg] Lead registered: id=${leadId}, email=${normalizedEmail}`);

    // Send verification email (non-blocking)
    emailService.sendLeadVerificationEmail(normalizedEmail, verificationToken, leadLanguage)
      .then(result => {
        if (result.sent) {
          logger.info(`[LeadReg] Verification email sent to ${normalizedEmail}`);
        } else {
          logger.info(`[EMAIL] Lead verification for ${normalizedEmail}: ${result.error || 'not sent'}`);
        }
      })
      .catch(err => {
        logger.error(`[LeadReg] Verification email error for ${normalizedEmail}: ${err.message}`);
      });

    res.status(201).json({
      message: 'Registered successfully! Check your email to verify.',
      lead: {
        id: leadId,
        email: normalizedEmail,
        verified: false,
        extra_messages_limit: 10
      }
    });
  } catch (error) {
    logger.error('[LeadReg] Registration error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// GET /api/auth/verify-lead?token=xxx
// Verifies a lead's email, sets verified=true, adds extra messages
router.get('/verify-lead', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const db = getDatabase();

    const result = db.exec(
      'SELECT id, email, verified, token_expires_at, extra_messages_limit FROM leads WHERE verification_token = ?',
      [token]
    );

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ error: 'Invalid or expired verification token', verified: false });
    }

    const lead = result[0].values[0];
    const leadId = lead[0];
    const leadEmail = lead[1];
    const alreadyVerified = lead[2];
    const tokenExpiry = lead[3];
    const currentExtraLimit = lead[4];

    // Check if already verified
    if (alreadyVerified) {
      // Redirect to frontend verification success page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
      return res.redirect(`${frontendUrl}/verify-lead?status=already_verified`);
    }

    // Check token expiry
    if (tokenExpiry && new Date(tokenExpiry) < new Date()) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
      return res.redirect(`${frontendUrl}/verify-lead?status=expired`);
    }

    // Mark as verified and add 10 more messages
    const newExtraLimit = (currentExtraLimit || 10) + 10;
    db.run(
      "UPDATE leads SET verified = 1, extra_messages_limit = ?, last_active = datetime('now') WHERE id = ?",
      [newExtraLimit, leadId]
    );
    saveDatabaseAfterWrite();

    logger.info(`[LeadVerify] Lead verified: id=${leadId}, email=${leadEmail}, new_limit=${newExtraLimit}`);

    // Redirect to frontend verification success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    return res.redirect(`${frontendUrl}/verify-lead?status=success`);
  } catch (error) {
    logger.error('[LeadVerify] Verification error: ' + error.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    return res.redirect(`${frontendUrl}/verify-lead?status=error`);
  }
});

// POST /api/auth/logout - Clear session cookie and invalidate token
router.post('/logout', (req, res) => {
  // Clear the session cookie
  res.clearCookie('session_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/'
  });

  logger.info('User logged out, session cookie cleared');

  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

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

// Forgot password rate limiting (in-memory, per email)
const forgotPasswordRates = new Map(); // email -> { count, windowStart }
const FORGOT_PW_RATE_WINDOW = 60 * 60 * 1000; // 1 hour
const FORGOT_PW_RATE_MAX = 3;

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email.trim().toLowerCase();

    // Always return success to prevent user enumeration
    const successMessage = 'If an account with that email exists, a password reset link has been sent.';

    // Rate limiting per email
    const now = Date.now();
    const rateEntry = forgotPasswordRates.get(normalizedEmail);
    if (rateEntry && (now - rateEntry.windowStart) < FORGOT_PW_RATE_WINDOW) {
      if (rateEntry.count >= FORGOT_PW_RATE_MAX) {
        logger.warn(`Forgot password rate limited for email: ${normalizedEmail}`);
        return res.json({ message: successMessage }); // Don't reveal rate limit
      }
      rateEntry.count++;
    } else {
      forgotPasswordRates.set(normalizedEmail, { count: 1, windowStart: now });
    }

    const db = getDatabase();

    // Find user by email (only therapists and superadmins can reset)
    const userResult = db.exec(
      'SELECT id, email, role, language, blocked_at FROM users WHERE email = ? AND role IN (\'therapist\', \'superadmin\')',
      [normalizedEmail]
    );

    if (userResult.length === 0 || userResult[0].values.length === 0) {
      logger.info(`Forgot password: no therapist/superadmin found for email ${normalizedEmail}`);
      return res.json({ message: successMessage });
    }

    const user = userResult[0].values[0];
    const userId = user[0];
    const userEmail = user[1];
    const userLang = user[3] || 'en';
    const blockedAt = user[4];

    if (blockedAt) {
      logger.warn(`Forgot password: blocked user ${userId} attempted reset`);
      return res.json({ message: successMessage });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Invalidate any existing unused tokens for this user
    db.run(
      'UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0',
      [userId]
    );

    // Insert new token
    db.run(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, resetToken, expiresAt]
    );
    saveDatabaseAfterWrite();

    // Send reset email (non-blocking)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = frontendUrl + '/reset-password?token=' + encodeURIComponent(resetToken);

    // Log to console in dev mode (as per EMAIL INTEGRATION instructions)
    logger.info(`[PASSWORD RESET] Link for ${userEmail}: ${resetUrl}`);

    emailService.sendPasswordReset(userEmail, resetToken, userLang)
      .then(result => {
        if (result.sent) {
          logger.info(`Password reset email sent to ${userEmail}`);
        } else {
          logger.info(`[EMAIL] Password reset for ${userEmail}: ${result.error || 'not sent'}`);
        }
      })
      .catch(err => {
        logger.error(`Password reset email error for ${userEmail}: ${err.message}`);
      });

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at) VALUES (?, 'password_reset_requested', 'user', ?, datetime('now'))",
      [userId, userId]
    );
    saveDatabaseAfterWrite();

    res.json({ message: successMessage });
  } catch (error) {
    logger.error('Forgot password error: ' + error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const db = getDatabase();

    // Find the token
    const tokenResult = db.exec(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
      [token]
    );

    if (tokenResult.length === 0 || tokenResult[0].values.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const resetRecord = tokenResult[0].values[0];
    const tokenId = resetRecord[0];
    const userId = resetRecord[1];
    const expiresAt = resetRecord[2];
    const used = resetRecord[3];

    // Check if token was already used
    if (used) {
      return res.status(400).json({ error: 'This reset link has already been used. Please request a new one.' });
    }

    // Check if token has expired
    if (new Date(expiresAt) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }

    // Validate password strength
    const pwdErrors = [];
    if (password.length < 8) pwdErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwdErrors.push('at least one uppercase letter');
    if (!/[a-z]/.test(password)) pwdErrors.push('at least one lowercase letter');
    if (!/[0-9]/.test(password)) pwdErrors.push('at least one number');
    if (pwdErrors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet requirements: ' + pwdErrors.join(', ') });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user's password
    db.run('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', [passwordHash, userId]);

    // Mark token as used
    db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [tokenId]);

    // Invalidate all other reset tokens for this user
    db.run('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0', [userId]);

    saveDatabaseAfterWrite();

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at) VALUES (?, 'password_reset_completed', 'user', ?, datetime('now'))",
      [userId, userId]
    );
    saveDatabaseAfterWrite();

    logger.info(`Password reset completed for user ${userId}`);

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    logger.error('Reset password error: ' + error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// Export the extractToken helper for use by other modules
router.extractToken = extractToken;

module.exports = router;
