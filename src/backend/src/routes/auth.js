// Authentication Routes
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const emailService = require('../services/emailService');
const { t } = require('../i18n');
const { antibot } = require('../middleware/antibot');
const { getClientIp } = require('../utils/clientIp');
const { issueSession, verifySessionToken, isTokenVersionCurrent, bumpTokenVersion } = require('../utils/session');
const { authenticate } = require('../middleware/auth');
const { createVerificationToken, sendVerificationEmailAsync } = require('./emailVerification');

const router = express.Router();

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

// ---------------------------------------------------------------------------
// Audit wave 3 (track N): password-login lockout (M4), enumeration (M5)
// ---------------------------------------------------------------------------

function intEnv(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// M4: LOGIN_LOCK_MAX_FAILURES wrong passwords within LOGIN_LOCK_WINDOW_MIN
// lock PASSWORD login for that account for LOGIN_LOCK_DURATION_MIN. The lock
// answers exactly like a wrong password (no oracle); login by email code
// stays available.
const LOGIN_LOCK_MAX_FAILURES = intEnv('LOGIN_LOCK_MAX_FAILURES', 10);
const LOGIN_LOCK_WINDOW_MIN = intEnv('LOGIN_LOCK_WINDOW_MIN', 15);
const LOGIN_LOCK_DURATION_MIN = intEnv('LOGIN_LOCK_DURATION_MIN', 15);

// M5: unknown emails (and accounts without a password) are compared against
// this hash so every /login costs one bcrypt compare at the same cost (12).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const REGISTER_CHECK_EMAIL_MESSAGE = 'Check your email to continue.';

// Code login (routes/loginCode.js) limits, mirrored for the sign-in code sent
// when someone registers with an existing email.
const LOGIN_CODE_PER_EMAIL_MAX = 3;
const LOGIN_CODE_PER_EMAIL_WINDOW_MIN = 15;
const LOGIN_CODE_LOCK_MAX_FAILURES = 10;

function appUrl() {
  const raw = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3002';
  return raw.replace(/\/+$/, '');
}

function scalarValue(db, sql, params) {
  const r = db.exec(sql, params);
  return r.length > 0 && r[0].values.length > 0 ? Number(r[0].values[0][0]) || 0 : 0;
}

/**
 * Someone tried to register with an email that already has an account. A
 * therapist/superadmin owner gets a normal sign-in code email (code + magic
 * link, same limits as POST /api/auth/login-code/request), so a person who
 * forgot they already registered can get in. Viewers, clients and blocked
 * accounts get nothing. Never throws; the caller always answers the same.
 */
function notifyExistingAccountOwner(db, req, user) {
  try {
    const ip = getClientIp(req);
    if (!['therapist', 'superadmin'].includes(user.role) || user.blockedAt) {
      logger.info(`[REGISTER] existing account (no code sent) user=${user.id} ip=${ip}`);
      return;
    }
    const loginCodes = require('../utils/loginCodes');
    const failures = scalarValue(db,
      "SELECT COUNT(*) FROM audit_logs WHERE actor_id = ? AND action = 'login_code_failed' AND created_at > datetime('now', '-1 hour')",
      [user.id]);
    if (failures >= LOGIN_CODE_LOCK_MAX_FAILURES ||
        loginCodes.countRecent(db, user.id, LOGIN_CODE_PER_EMAIL_WINDOW_MIN) >= LOGIN_CODE_PER_EMAIL_MAX) {
      logger.info(`[REGISTER] existing account, code limit reached user=${user.id} ip=${ip}`);
      return;
    }
    const issued = loginCodes.createFor(db, user.id, ip, { save: false });
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, ip_address, created_at) VALUES (?, 'login_code_requested', 'user', ?, ?, ?, datetime('now'))",
      [user.id, user.id, JSON.stringify({ via: 'register_existing_email' }), ip]
    );
    saveDatabaseAfterWrite();
    logger.info(`[REGISTER] existing account, sign-in code sent user=${user.id} ip=${ip}`);

    const linkUrl = `${appUrl()}/api/auth/login-code/link?token=${encodeURIComponent(issued.linkToken)}`;
    const locale = ['en', 'ru', 'es', 'uk'].includes(user.language) ? user.language : (req.locale || 'en');
    emailService.sendLoginCodeEmail(user.email, { code: issued.code, linkUrl, ttlMin: loginCodes.TTL_MIN }, locale)
      .then((result) => {
        if (!result || !result.sent) {
          logger.info(`[REGISTER] sign-in code email not sent user=${user.id}: ${(result && result.error) || 'not sent'}`);
        }
      })
      .catch((err) => logger.error(`[REGISTER] sign-in code email error user=${user.id}: ${err.message}`));
  } catch (e) {
    logger.warn(`[REGISTER] existing-account notification failed user=${user.id}: ${e.message}`);
  }
}

/**
 * M4: count one failed password for `userId`; lock password login once the
 * window holds LOGIN_LOCK_MAX_FAILURES failures. Synchronous (no await
 * between read and write), so concurrent requests cannot lose increments.
 */
function recordFailedPassword(db, userId, ip, owner) {
  const windowMod = `-${LOGIN_LOCK_WINDOW_MIN} minutes`;
  db.run(
    `UPDATE users SET
       failed_login_count = CASE
         WHEN failed_login_window_start IS NULL OR failed_login_window_start <= datetime('now', ?) THEN 1
         ELSE failed_login_count + 1 END,
       failed_login_window_start = CASE
         WHEN failed_login_window_start IS NULL OR failed_login_window_start <= datetime('now', ?) THEN datetime('now')
         ELSE failed_login_window_start END
     WHERE id = ?`,
    [windowMod, windowMod, userId]
  );
  const failures = scalarValue(db, 'SELECT failed_login_count FROM users WHERE id = ?', [userId]);
  if (failures >= LOGIN_LOCK_MAX_FAILURES) {
    db.run(
      "UPDATE users SET password_locked_until = datetime('now', ?), failed_login_count = 0, failed_login_window_start = NULL WHERE id = ?",
      [`+${LOGIN_LOCK_DURATION_MIN} minutes`, userId]
    );
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, ip_address, created_at) VALUES (?, 'login_password_locked', 'user', ?, ?, ?, datetime('now'))",
      [userId, userId, JSON.stringify({ failures, lock_minutes: LOGIN_LOCK_DURATION_MIN }), ip || null]
    );
    logger.warn(`[LOGIN] password login locked for ${LOGIN_LOCK_DURATION_MIN} min after ${failures} failures user=${userId} ip=${ip}`);
    // Tell the owner once per lock (this branch runs exactly once: the
    // counter is reset and further failures are not counted while locked),
    // with the sign-in-code and reset hints.
    if (owner && owner.email) {
      const locale = ['en', 'ru', 'es', 'uk'].includes(owner.language) ? owner.language : 'en';
      Promise.resolve()
        .then(() => emailService.sendPasswordLoginLockedEmail(owner.email, { lockMinutes: LOGIN_LOCK_DURATION_MIN }, locale))
        .then((result) => {
          if (!result || !result.sent) logger.info(`[LOGIN] lock notice not sent user=${userId}: ${(result && result.error) || 'not sent'}`);
        })
        .catch((err) => logger.error(`[LOGIN] lock notice error user=${userId}: ${err.message}`));
    }
  }
  saveDatabaseAfterWrite();
}

// M4 anti-DoS: an IP address this account signed in from (password or email
// code) within the last LOGIN_TRUSTED_IP_DAYS days is 'known'. Wrong passwords
// from it are not counted and the lock does not apply to it, so an attacker
// elsewhere cannot lock the owner out of their usual network. Brute force
// from that network stays bounded by the per-IP auth limiter (index.js).
const LOGIN_TRUSTED_IP_DAYS = 30;
function isKnownLoginIp(db, userId, ip) {
  if (!ip) return false;
  return scalarValue(db,
    "SELECT COUNT(*) FROM audit_logs WHERE actor_id = ? AND action IN ('login', 'login_code_success') AND ip_address = ? AND created_at > datetime('now', ?)",
    [userId, ip, `-${LOGIN_TRUSTED_IP_DAYS} days`]) > 0;
}

// POST /api/auth/register
// antibot: honeypot (fake 201) -> timing (400) -> Turnstile (403).
// An email that already has an account gets 201 { message, check_email: true }
// (no user, no session cookie) — see notifyExistingAccountOwner.
router.post('/register', antibot({ turnstile: true, fake: 'register', expectedAction: 'register' }), async (req, res) => {
  try {
    // Temporary (wave 1): confirm the real IP reaches the backend through
    // CF -> Traefik -> nginx. Remove in wave 3 once verified on prod.
    logger.info('[IP] register from ' + getClientIp(req));

    const { email, password, role, language, timezone, utm_source, utm_medium, utm_campaign, utm_content, utm_term, intended_plan, name } = req.body;

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
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Please enter a valid email address' });
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

    // Validate password strength (before the existence check, so a weak
    // password gets the same 400 whether or not the email is registered)
    const pwdErrors = [];
    if (password.length < 8) pwdErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwdErrors.push('at least one uppercase letter');
    if (!/[a-z]/.test(password)) pwdErrors.push('at least one lowercase letter');
    if (!/[0-9]/.test(password)) pwdErrors.push('at least one number');
    if (pwdErrors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet requirements: ' + pwdErrors.join(', ') });
    }

    // Hash password (also on the existing-email path below, so both take
    // the same bcrypt time)
    const passwordHash = await bcrypt.hash(password, 12);

    // Audit M5: an existing email must not produce an "already exists" answer
    // (409 was an enumeration oracle). Reply 201 "check your email" without a
    // session, and mail the account owner a sign-in code instead.
    const existing = db.exec('SELECT id, role, language, blocked_at FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      const [existingId, existingRole, existingLanguage, existingBlockedAt] = existing[0].values[0];
      notifyExistingAccountOwner(db, req, {
        id: existingId,
        email: normalizedEmail,
        role: existingRole,
        language: existingLanguage,
        blockedAt: existingBlockedAt
      });
      return res.status(201).json({
        message: REGISTER_CHECK_EMAIL_MESSAGE,
        check_email: true
      });
    }
    const inviteCode = uuidv4().slice(0, 8);

    logger.info(`Registering new user: ${normalizedEmail} with role: ${userRole}`);

    // Validate and set language/timezone defaults
    const supportedLanguages = ['en', 'ru', 'es', 'uk'];
    const userLanguage = supportedLanguages.includes(language) ? language : 'en';
    // Sanitize display name (first name only): max 100 chars, no HTML
    const userFirstName = (name && typeof name === 'string') ? name.slice(0, 100).trim() : null;
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
      'INSERT INTO users (email, password_hash, role, invite_code, language, timezone, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referral_code, referred_by, first_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [normalizedEmail, passwordHash, userRole, inviteCode, userLanguage, userTimezone, utm_source || null, utm_medium || null, utm_campaign || null, utm_content || null, utm_term || null, referralCode, referredBy, userFirstName]
    );

    // Save to disk after write
    saveDatabaseAfterWrite();

    // Get the inserted user
    const result = db.exec('SELECT id, email, role, created_at FROM users WHERE email = ?', [normalizedEmail]);
    const user = result[0].values[0];
    const userId = user[0];

    // Resolve intended_plan — only 'confirm' is accepted from the public signup flow.
    // Any other value (unknown plan, missing, etc.) silently falls back to the default Trial.
    const INTENDED_PLAN_ALLOWLIST = ['confirm'];
    const useConfirmPlan = INTENDED_PLAN_ALLOWLIST.includes(intended_plan);

    // Check for acquisition source marker (header OR query param)
    const acquisitionSource = req.headers['x-acquisition-source'] || req.query.source || null;

    // Create subscription for therapists
    let trialDays = 14;
    let subscriptionPlan = 'trial';
    let nextAction = undefined;

    if (userRole === 'therapist') {
      const now = new Date();

      if (useConfirmPlan) {
        // Confirm landing-page flow: create trialing subscription (7-day free trial).
        // stripe_customer_id / current_period_start / current_period_end are filled in
        // later when Stripe Checkout completes.
        const confirmTrialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        db.run(
          `INSERT INTO subscriptions (therapist_id, plan, status, trial_ends_at, current_period_start, current_period_end, stripe_customer_id, created_at, updated_at)
           VALUES (?, 'confirm', 'trialing', ?, NULL, NULL, NULL, ?, ?)`,
          [userId, confirmTrialEnd.toISOString(), now.toISOString(), now.toISOString()]
        );
        logger.info(`Confirm subscription (trialing) created for therapist id=${userId}, trial ends ${confirmTrialEnd.toISOString()}`);
        subscriptionPlan = 'confirm';
        nextAction = 'await_stripe_checkout';
        trialDays = 7; // shown in the verification email; matches confirmTrialEnd

        // Update leads table entry for this email if it exists: mark source as landing_confirm.
        try {
          db.run(
            "UPDATE leads SET source = 'landing_confirm' WHERE email = ?",
            [normalizedEmail]
          );
        } catch (e) {
          logger.warn(`Could not update leads source for ${normalizedEmail}: ${e.message}`);
        }

        // Audit-log the confirm-landing registration.
        db.run(
          "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'register_confirm_landing', 'user', ?, ?, datetime('now'))",
          [userId, userId, JSON.stringify({ email: normalizedEmail, acquisition_source: acquisitionSource || null })]
        );
      } else {
        // Standard Trial flow
        try {
          const settingsResult = db.exec("SELECT value FROM platform_settings WHERE key = 'trial_duration_days'");
          if (settingsResult.length > 0 && settingsResult[0].values.length > 0) {
            trialDays = parseInt(settingsResult[0].values[0][0], 10) || 14;
          }
        } catch (e) {
          logger.warn('Could not read trial_duration_days setting, using default 14');
        }

        const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
        db.run(
          `INSERT INTO subscriptions (therapist_id, plan, status, trial_ends_at, current_period_start, current_period_end, created_at, updated_at)
           VALUES (?, 'trial', 'active', ?, ?, ?, ?, ?)`,
          [userId, trialEnd.toISOString(), now.toISOString(), trialEnd.toISOString(), now.toISOString(), now.toISOString()]
        );
        logger.info(`Trial subscription created for therapist id=${userId}, expires ${trialEnd.toISOString()}`);

        // Update leads source if acquisition marker present
        if (acquisitionSource) {
          try {
            db.run("UPDATE leads SET source = ? WHERE email = ?", [acquisitionSource, normalizedEmail]);
          } catch (e) {
            logger.warn(`Could not update leads source for ${normalizedEmail}: ${e.message}`);
          }
        }
      }
    }

    // Email verification (wave 2, track 2A): store sha256(token) + expiry
    // (EMAIL_VERIFICATION_TTL_H, default 48h); the plaintext only leaves by
    // email. Applies to the confirm-plan flow too — Stripe checkout may
    // confirm the address earlier (webhooks.js checkout.session.completed).
    const verificationToken = createVerificationToken(db, userId);

    saveDatabaseAfterWrite();

    // Sign JWT + set HttpOnly session cookie
    // JWT lives only in the HttpOnly cookie; it is not returned in the body.
    const session = issueSession(res, { id: userId, email: user[1], role: user[2], timezone: userTimezone });

    logger.info(`User registered successfully: id=${userId}, email=${user[1]}`);

    // Send verification email (non-blocking, failure won't break registration).
    // Replaces the old welcome email; the template carries the trial length.
    sendVerificationEmailAsync(user[1], verificationToken, userLanguage, trialDays);

    const responseBody = {
      message: 'User registered successfully',
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        created_at: user[3],
        timezone: session.user.timezone
      }
    };
    if (nextAction) {
      responseBody.next_action = nextAction;
    }
    // A12: dev-echo for automated tests only (never in production).
    if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_ECHO === 'true') {
      responseBody.dev_verification_token = verificationToken;
    }

    res.status(201).json(responseBody);
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
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(401).json({ error: t('auth.invalidCredentials', req.locale) });
    }

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email.trim().toLowerCase();

    const db = getDatabase();
    const ip = getClientIp(req);

    logger.info(`Login attempt for: ${normalizedEmail}`);

    const result = db.exec(
      `SELECT id, email, password_hash, role, blocked_at, timezone,
              CASE WHEN password_locked_until IS NOT NULL AND password_locked_until > datetime('now') THEN 1 ELSE 0 END,
              failed_login_count, failed_login_window_start, language
         FROM users WHERE email = ?`,
      [normalizedEmail]
    );
    const user = (result.length > 0 && result[0].values.length > 0) ? result[0].values[0] : null;

    // M5: always exactly one bcrypt compare — against the dummy hash for an
    // unknown email or an account without a password (viewer / bot-only).
    const hasPassword = !!user && typeof user[2] === 'string' && BCRYPT_HASH_RE.test(user[2]);
    const passwordMatches = await bcrypt.compare(password, hasPassword ? user[2] : DUMMY_PASSWORD_HASH);
    const invalidCredentials = () => res.status(401).json({ error: t('auth.invalidCredentials', req.locale) });

    if (!user) {
      return invalidCredentials();
    }

    // M4: while locked, password login fails like a wrong password (even with
    // the right one); failures are not counted during the lock. Exception: an
    // IP this account signed in from in the last 30 days (isKnownLoginIp) is
    // neither locked out nor counted.
    const knownIp = isKnownLoginIp(db, user[0], ip);
    if (user[6] && !knownIp) {
      logger.warn(`[LOGIN] password login refused (locked) user=${user[0]} ip=${ip}`);
      return invalidCredentials();
    }

    if (!hasPassword || !passwordMatches) {
      if (hasPassword && !knownIp) recordFailedPassword(db, user[0], ip, { email: user[1], language: user[9] });
      return invalidCredentials();
    }

    // Correct password: clear the failure window.
    if (Number(user[7]) > 0 || user[8]) {
      db.run('UPDATE users SET failed_login_count = 0, failed_login_window_start = NULL WHERE id = ?', [user[0]]);
    }

    // Check if user is blocked
    if (user[4]) {
      logger.warn(`Blocked user attempted login: id=${user[0]}, email=${user[1]}`);
      return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
    }

    // Sign JWT + set HttpOnly session cookie
    const session = issueSession(res, { id: user[0], email: user[1], role: user[3], timezone: user[5] });

    logger.info(`User logged in: id=${user[0]}, email=${user[1]}`);

    // Audit trail (wave 2): the unverified-cleanup job treats accounts with a
    // 'login' / 'login_code_success' row as real people and never purges them.
    // Never let audit failure block the login itself.
    try {
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, ip_address, created_at)
         VALUES (?, 'login', 'user', ?, NULL, ?, datetime('now'))`,
        [user[0], user[0], getClientIp(req)]
      );
      saveDatabaseAfterWrite();
    } catch (auditError) {
      logger.warn(`Login audit log failed for user id=${user[0]}: ${auditError.message}`);
    }

    res.json({
      message: 'Login successful',
      user: session.user
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register-viewer
// Email-only registration from the public chat CTA.
// Creates a user with role='viewer', links anonymous session, migrates messages, issues JWT.
router.post('/register-viewer', antibot({ turnstile: true, fake: 'viewer', expectedAction: 'register' }), async (req, res) => {
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

      // Existing account of ANY role: typing an email is no proof of mailbox
      // ownership, so do NOT issue a session or link the anonymous session.
      // The caller must sign in (email code / link) to resume. Audit M5: the
      // same answer for every role (the old 409 for therapist/admin emails
      // told viewers apart from therapists).
      logger.info(`[ViewerReg] Existing account id=${existingUser[0]} role=${existingRole} — login required, no token issued`);
      return res.json({
        message: 'Welcome back! Please sign in to continue.',
        existing: true,
        login_required: true,
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
          // Re-parent ONLY the anonymous landing conversations created by this
          // visitor's own viewer session (assistant_conversations.viewer_session_id),
          // from therapist_id 0 to the new viewer userId. (This used to pick the
          // most recent anonymous landing conversation of ANY visitor.)
          db.run(
            "UPDATE assistant_conversations SET therapist_id = ? WHERE therapist_id = 0 AND page_context = 'landing' AND viewer_session_id = ?",
            [userId, viewerSessionId]
          );
        }

        saveDatabaseAfterWrite();
        logger.info(`[ViewerReg] Linked session ${session_uuid} to viewer user ${userId}`);
      } catch (e) {
        logger.warn('[ViewerReg] Session linking error: ' + e.message);
      }
    }

    // Sign JWT (with token_version) + set HttpOnly session cookie
    issueSession(res, { id: userId, email: user[1], role: 'viewer', token_version: 0 });

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

    res.status(201).json({
      message: 'Registered successfully! You can continue chatting.',
      user: {
        id: userId,
        email: user[1],
        role: 'viewer',
        created_at: user[3]
      }
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
router.post('/register-lead', antibot({ turnstile: true, fake: 'lead', expectedAction: 'register_lead' }), async (req, res) => {
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

    // Audit M5: the users table is deliberately NOT consulted here. The old
    // 409 for therapist/admin emails told anyone which addresses have an
    // account; a lead row (chat quota only, no login) is created and answered
    // the same way for every email.

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

// Clear the HttpOnly session cookie (same attributes it was set with).
function clearSessionCookie(res) {
  res.clearCookie('session_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/'
  });
}

// POST /api/auth/logout - Log out THIS device: clear the session cookie.
// Deliberately does not bump token_version (that would also log the user out
// on every other device); use /logout-all for that. The SPA drops its
// localStorage copy of the token after this call.
router.post('/logout', (req, res) => {
  clearSessionCookie(res);

  logger.info('User logged out, session cookie cleared');

  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/logout-all - Revoke every session of the caller (all
// devices) by bumping users.token_version, then clear this device's cookie.
router.post('/logout-all', authenticate, (req, res) => {
  try {
    const db = getDatabase();
    bumpTokenVersion(req.user.id, db);
    try {
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, ip_address, created_at) VALUES (?, 'logout_all', 'user', ?, ?, datetime('now'))",
        [req.user.id, req.user.id, getClientIp(req)]
      );
    } catch (auditError) {
      logger.warn(`logout-all audit log failed for user id=${req.user.id}: ${auditError.message}`);
    }
    saveDatabaseAfterWrite();
    clearSessionCookie(res);
    logger.info(`User ${req.user.id} logged out on all devices (token_version bumped)`);
    res.json({ message: 'Logged out on all devices' });
  } catch (error) {
    logger.error('Logout-all error: ' + error.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifySessionToken(token);

    const db = getDatabase();

    logger.info(`Fetching user profile: id=${decoded.userId}`);

    const result = db.exec(
      'SELECT id, email, role, language, timezone, created_at, blocked_at, email_verified_at, token_version FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result[0].values[0];

    // H13: revoked token (password reset, admin block, logout-all)
    if (!isTokenVersionCurrent(decoded, user[8])) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

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
        created_at: user[5],
        email_verified: !!user[7]
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

// Forgot password rate limiting (in-memory, per email). Keyed by
// sha256(email) so the map holds no addresses; expired windows are swept
// every 10 minutes and the map is capped (oldest entries dropped first).
const forgotPasswordRates = new Map(); // sha256(email) -> { count, windowStart }
const FORGOT_PW_RATE_WINDOW = 60 * 60 * 1000; // 1 hour
const FORGOT_PW_RATE_MAX = 3;
const FORGOT_PW_RATE_MAX_KEYS = 10000;

function sweepForgotPasswordRates(now) {
  const t0 = now || Date.now();
  for (const [key, entry] of forgotPasswordRates) {
    if (t0 - entry.windowStart >= FORGOT_PW_RATE_WINDOW) forgotPasswordRates.delete(key);
  }
}
setInterval(() => sweepForgotPasswordRates(), 10 * 60 * 1000).unref();

// Returns true when this email has used up its hourly budget.
function forgotPasswordRateLimited(normalizedEmail) {
  const key = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
  const now = Date.now();
  const rateEntry = forgotPasswordRates.get(key);
  if (rateEntry && (now - rateEntry.windowStart) < FORGOT_PW_RATE_WINDOW) {
    if (rateEntry.count >= FORGOT_PW_RATE_MAX) return true;
    rateEntry.count++;
    return false;
  }
  forgotPasswordRates.delete(key);
  if (forgotPasswordRates.size >= FORGOT_PW_RATE_MAX_KEYS) {
    sweepForgotPasswordRates(now);
    // Still full: drop the oldest insertions (Map keeps insertion order).
    while (forgotPasswordRates.size >= FORGOT_PW_RATE_MAX_KEYS) {
      forgotPasswordRates.delete(forgotPasswordRates.keys().next().value);
    }
  }
  forgotPasswordRates.set(key, { count: 1, windowStart: now });
  return false;
}

// Reset tokens are stored as sha256(token) hex; the plaintext only leaves by email.
function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// POST /api/auth/forgot-password
// Logs carry user ids, never email addresses.
router.post('/forgot-password', antibot({ turnstile: true, fake: 'forgot', expectedAction: 'forgot_password' }), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email.trim().toLowerCase();

    // Always return success to prevent user enumeration
    const successMessage = 'If an account with that email exists, a password reset link has been sent.';

    // Rate limiting per email
    if (forgotPasswordRateLimited(normalizedEmail)) {
      logger.warn('Forgot password rate limited (per-email budget)');
      return res.json({ message: successMessage }); // Don't reveal rate limit
    }

    const db = getDatabase();

    // Find user by email (only therapists and superadmins can reset)
    const userResult = db.exec(
      'SELECT id, email, role, language, blocked_at FROM users WHERE email = ? AND role IN (\'therapist\', \'superadmin\')',
      [normalizedEmail]
    );

    if (userResult.length === 0 || userResult[0].values.length === 0) {
      logger.info('Forgot password: no therapist/superadmin account for the given email');
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

    // Insert new token (only its sha256 is stored)
    db.run(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, hashResetToken(resetToken), expiresAt]
    );
    saveDatabaseAfterWrite();

    // Send reset email (non-blocking)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = frontendUrl + '/reset-password?token=' + encodeURIComponent(resetToken);

    // The reset URL carries a live token: log it only under the dev-echo
    // switch used by the other auth flows (never in production).
    if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_ECHO === 'true') {
      logger.info(`[PASSWORD RESET] Link for user ${userId}: ${resetUrl}`);
    }

    emailService.sendPasswordReset(userEmail, resetToken, userLang)
      .then(result => {
        if (result.sent) {
          logger.info(`Password reset email sent to user ${userId}`);
        } else {
          logger.info(`[EMAIL] Password reset for user ${userId}: ${result.error || 'not sent'}`);
        }
      })
      .catch(err => {
        logger.error(`Password reset email error for user ${userId}: ${err.message}`);
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

    if (!token || !password || typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const db = getDatabase();

    // Find the token (stored as sha256)
    const tokenResult = db.exec(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
      [hashResetToken(token)]
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

    // Claim the token BEFORE the (async) hash: two concurrent requests with the
    // same link can no longer both pass the "unused" check above and both set
    // a password. Only the request whose UPDATE flips used 0 -> 1 continues.
    db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ? AND used = 0', [tokenId]);
    if (db.getRowsModified() !== 1) {
      return res.status(400).json({ error: 'This reset link has already been used. Please request a new one.' });
    }
    saveDatabaseAfterWrite();

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user's password; a reset also lifts a password-login lock (M4)
    db.run(
      "UPDATE users SET password_hash = ?, failed_login_count = 0, failed_login_window_start = NULL, password_locked_until = NULL, updated_at = datetime('now') WHERE id = ?",
      [passwordHash, userId]
    );

    // Invalidate all other reset tokens for this user
    db.run('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0', [userId]);

    // H13: a new password revokes every existing session (all devices).
    bumpTokenVersion(userId, db);

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
