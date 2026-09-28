// Email verification routes (wave 2, track 2A) — mounted under /api/auth
// before routes/auth.js (docs/security/SPEC_ANTIBOT_WAVES.md §3 "Трек 2A").
//
//   GET  /api/auth/verify-email?token=        public, redirects to the SPA
//   POST /api/auth/resend-verification        authenticate, therapist, 3/h
//   POST /api/auth/change-unverified-email    authenticate, unverified only
//
// Only sha256(token) is stored (users.verification_token_hash); the plaintext
// goes out by email and — under A12 (NODE_ENV !== 'production' and
// AUTH_DEV_ECHO=true) — is echoed as `dev_verification_token` for tests.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const emailService = require('../services/emailService');
const { t } = require('../i18n');
const { authenticate } = require('../middleware/auth');
const { issueSession, JWT_SECRET } = require('../utils/session');
const { getClientIp } = require('../utils/clientIp');

const router = express.Router();

// Resend + change-email share one hourly budget per user, counted from
// audit_logs (no extra table / in-memory state needed).
const RESEND_LIMIT_PER_HOUR = 3;
const RESEND_COUNTED_ACTIONS = "('verification_resent', 'email_changed_unverified')";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_REGEX = /^[a-f0-9]{64}$/i;

// Same precedence as emailService.sendVerificationEmail (the link's origin).
function frontendUrl() {
  return process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3002';
}

// User id of a VALID session_token cookie on this request, else null.
// Used by GET /verify-email to detect a login-CSRF setup: someone else's
// browser session must not be swapped for the token owner's.
function cookieSessionUserId(req) {
  const raw = req.cookies && req.cookies.session_token;
  if (!raw) return null;
  try {
    const decoded = jwt.verify(raw, JWT_SECRET);
    return decoded && decoded.userId != null ? decoded.userId : null;
  } catch (e) {
    return null;
  }
}

function ttlHours() {
  const n = parseInt(process.env.EMAIL_VERIFICATION_TTL_H || '48', 10);
  return Number.isFinite(n) && n > 0 ? n : 48;
}

// A12: echo secrets that otherwise only leave by email. Never in production.
function devEcho() {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_ECHO === 'true';
}

// t() returns the key itself when a translation is missing — keep an English
// fallback so a stale i18n bundle never leaks raw keys to the UI.
function tr(key, locale, fallback) {
  const s = t(key, locale);
  return s === key ? fallback : s;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a fresh verification token for `userId`, store its hash + expiry on
 * the users row and return the PLAINTEXT token (email only — never log it).
 * The caller is responsible for saveDatabaseAfterWrite().
 * Also used by POST /api/auth/register (routes/auth.js).
 */
function createVerificationToken(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlHours() * 60 * 60 * 1000).toISOString();
  db.run(
    'UPDATE users SET verification_token_hash = ?, verification_expires_at = ? WHERE id = ?',
    [hashToken(token), expiresAt, userId]
  );
  return token;
}

/**
 * Fire-and-forget verification email (same non-blocking pattern as the old
 * welcome email in /register): failures are logged, never surfaced.
 */
function sendVerificationEmailAsync(email, token, locale, trialDays) {
  emailService.sendVerificationEmail(email, token, locale, { trialDays })
    .then(result => {
      if (result && result.sent) {
        logger.info(`Verification email sent to ${email}`);
      } else {
        logger.info(`[EMAIL] Verification email for ${email}: ${(result && result.error) || 'not sent'}`);
      }
    })
    .catch(err => {
      logger.error(`Verification email error for ${email}: ${err.message}`);
    });
}

// Trial length shown in the email: 7 for the confirm-landing plan, otherwise
// the platform setting (default 14) — mirrors /register.
function resolveTrialDays(db, userId) {
  try {
    const sub = db.exec(
      'SELECT plan FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (sub.length && sub[0].values.length && sub[0].values[0][0] === 'confirm') return 7;
    const setting = db.exec("SELECT value FROM platform_settings WHERE key = 'trial_duration_days'");
    if (setting.length && setting[0].values.length) {
      return parseInt(setting[0].values[0][0], 10) || 14;
    }
  } catch (e) {
    logger.warn('Could not resolve trial days for verification email: ' + e.message);
  }
  return 14;
}

function countRecentResends(db, userId) {
  const r = db.exec(
    `SELECT COUNT(*) FROM audit_logs
     WHERE actor_id = ? AND action IN ${RESEND_COUNTED_ACTIONS}
       AND created_at > datetime('now', '-1 hour')`,
    [userId]
  );
  return r.length && r[0].values.length ? Number(r[0].values[0][0]) || 0 : 0;
}

function audit(db, actorId, action, targetId, details, ip) {
  db.run(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, ip_address, created_at)
     VALUES (?, ?, 'user', ?, ?, ?, datetime('now'))`,
    [actorId, action, targetId, details ? JSON.stringify(details) : null, ip || null]
  );
}

function loadUser(db, userId) {
  const r = db.exec(
    `SELECT id, email, role, language, timezone, password_hash, email_verified_at, blocked_at
     FROM users WHERE id = ?`,
    [userId]
  );
  if (!r.length || !r[0].values.length) return null;
  const row = r[0].values[0];
  return {
    id: row[0],
    email: row[1],
    role: row[2],
    language: row[3] || 'en',
    timezone: row[4] || 'UTC',
    passwordHash: row[5],
    emailVerifiedAt: row[6],
    blockedAt: row[7]
  };
}

// GET /api/auth/verify-email?token=<hex64>
// Public (the link is clicked from the mailbox, usually without a session).
// Every outcome is a redirect into the SPA:
//   invalid/unknown token  -> /verify-email?status=error
//   expired                -> /verify-email?status=expired
//   already verified       -> /dashboard?verified=already
//   success                -> /dashboard?verified=1  (+ session cookie issued)
//   success, but the browser holds a valid session of ANOTHER user
//                          -> email marked verified, no new session/cookie,
//                             /login?verified=1 (login-CSRF guard)
router.get('/verify-email', (req, res) => {
  const base = frontendUrl();
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string' || !TOKEN_REGEX.test(token)) {
      return res.redirect(`${base}/verify-email?status=error`);
    }

    const db = getDatabase();
    const r = db.exec(
      `SELECT id, email, role, timezone, email_verified_at, verification_expires_at, blocked_at
       FROM users WHERE verification_token_hash = ?`,
      [hashToken(token)]
    );
    if (!r.length || !r[0].values.length) {
      logger.info('[EMAIL_VERIFY] unknown token from ' + getClientIp(req));
      return res.redirect(`${base}/verify-email?status=error`);
    }

    const [userId, email, role, timezone, verifiedAt, expiresAt, blockedAt] = r[0].values[0];

    if (verifiedAt) {
      return res.redirect(`${base}/dashboard?verified=already`);
    }
    if (expiresAt && new Date(expiresAt) < new Date()) {
      logger.info(`[EMAIL_VERIFY] expired token for user id=${userId}`);
      return res.redirect(`${base}/verify-email?status=expired`);
    }
    if (blockedAt) {
      logger.warn(`[EMAIL_VERIFY] blocked user id=${userId} tried to verify`);
      return res.redirect(`${base}/verify-email?status=error`);
    }

    const cookieUserId = cookieSessionUserId(req);
    const sessionConflict = cookieUserId != null && String(cookieUserId) !== String(userId);

    db.run(
      `UPDATE users SET email_verified_at = datetime('now'),
         verification_token_hash = NULL, verification_expires_at = NULL
       WHERE id = ?`,
      [userId]
    );
    audit(db, userId, 'email_verified', userId, sessionConflict ? { session_conflict: true } : null, getClientIp(req));
    saveDatabaseAfterWrite();

    if (sessionConflict) {
      // The token proves mailbox ownership, so the address is confirmed —
      // but the browser is logged in as someone else. Do not swap sessions.
      logger.warn(`[EMAIL_VERIFY] verified user id=${userId} while browser session belongs to user id=${cookieUserId} — no session issued`);
      return res.redirect(`${base}/login?verified=1`);
    }

    // The person is holding the mailbox — log them in right away (A2 helper).
    issueSession(res, { id: userId, email, role, timezone });
    logger.info(`[EMAIL_VERIFY] verified user id=${userId}`);

    return res.redirect(`${base}/dashboard?verified=1`);
  } catch (error) {
    logger.error('[EMAIL_VERIFY] error: ' + error.message);
    return res.redirect(`${base}/verify-email?status=error`);
  }
});

// POST /api/auth/resend-verification
// authenticate; therapist only; 3 per hour per user (shared with
// change-unverified-email). Overwrites the previous token.
router.post('/resend-verification', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Only therapist accounts use email verification' });
    }

    const db = getDatabase();
    const user = loadUser(db, req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerifiedAt) {
      return res.json({ message: 'Email address is already confirmed.', already_verified: true });
    }

    if (countRecentResends(db, user.id) >= RESEND_LIMIT_PER_HOUR) {
      logger.warn(`[EMAIL_VERIFY] resend rate limit hit for user id=${user.id}`);
      return res.status(429).json({
        error: tr('auth.resendLimit', req.locale, 'Too many requests. Please try again later.')
      });
    }

    const token = createVerificationToken(db, user.id);
    audit(db, user.id, 'verification_resent', user.id, null, getClientIp(req));
    saveDatabaseAfterWrite();

    sendVerificationEmailAsync(user.email, token, user.language, resolveTrialDays(db, user.id));
    logger.info(`[EMAIL_VERIFY] verification email re-sent for user id=${user.id}`);

    const body = { message: tr('auth.verificationResent', req.locale, 'Confirmation email sent.') };
    if (devEcho()) body.dev_verification_token = token;
    res.json(body);
  } catch (error) {
    logger.error('[EMAIL_VERIFY] resend error: ' + error.message);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// POST /api/auth/change-unverified-email  { email, password }
// authenticate; only while email_verified_at IS NULL. Lets a person fix a
// typo in their address without support. Password re-check + uniqueness;
// issues a new token to the new address. Shares the 3/h budget with resend.
router.post('/change-unverified-email', authenticate, async (req, res) => {
  try {
    const db = getDatabase();
    const user = loadUser(db, req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: 'Email address is already confirmed and cannot be changed here.' });
    }

    const { email, password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: tr('auth.emailChangeNeedsPassword', req.locale, 'Enter your password to change the email address.')
      });
    }
    const newEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();
    if (!newEmail || !EMAIL_REGEX.test(newEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (newEmail === String(user.email || '').toLowerCase()) {
      return res.status(400).json({ error: 'The new email address must differ from the current one' });
    }

    if (countRecentResends(db, user.id) >= RESEND_LIMIT_PER_HOUR) {
      logger.warn(`[EMAIL_VERIFY] change-email rate limit hit for user id=${user.id}`);
      return res.status(429).json({
        error: tr('auth.resendLimit', req.locale, 'Too many requests. Please try again later.')
      });
    }

    const passwordOk = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!passwordOk) {
      logger.warn(`[EMAIL_VERIFY] change-email wrong password for user id=${user.id}`);
      return res.status(401).json({
        error: tr('auth.invalidCredentials', req.locale, 'Invalid email or password')
      });
    }

    const existing = db.exec('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', [newEmail, user.id]);
    if (existing.length && existing[0].values.length) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const oldEmail = user.email;
    db.run('UPDATE users SET email = ? WHERE id = ?', [newEmail, user.id]);
    const token = createVerificationToken(db, user.id);
    audit(db, user.id, 'email_changed_unverified', user.id, { old_email: oldEmail, new_email: newEmail }, getClientIp(req));
    saveDatabaseAfterWrite();

    sendVerificationEmailAsync(newEmail, token, user.language, resolveTrialDays(db, user.id));
    logger.info(`[EMAIL_VERIFY] unverified email changed for user id=${user.id}`);

    const body = {
      message: tr('auth.verificationResent', req.locale, 'Confirmation email sent.'),
      email: newEmail
    };
    if (devEcho()) body.dev_verification_token = token;
    res.json(body);
  } catch (error) {
    logger.error('[EMAIL_VERIFY] change-email error: ' + error.message);
    res.status(500).json({ error: 'Failed to change email address' });
  }
});

module.exports = router;
// Shared with routes/auth.js (/register) so token format, hashing and TTL
// live in exactly one place.
module.exports.createVerificationToken = createVerificationToken;
module.exports.sendVerificationEmailAsync = sendVerificationEmailAsync;
