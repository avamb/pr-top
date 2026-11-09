// Login-by-email-code routes (wave 2, track 2B) — mounted under /api/auth/login-code.
//
// Spec: docs/security/SPEC_ANTIBOT_WAVES.md §0 (A7, A8, A12) and §3 "Трек 2B",
// hardened per the wave-2 security review:
//   POST /request  { email }        -> always 200 { message }, >= MIN_RESPONSE_MS
//   POST /verify   { email, code }  -> 200 { message, user } (same shape as /login; JWT only in the session cookie);
//                                      EVERY failure is 401 CODE_INVALID after the
//                                      same timing floor (no locked/unknown oracle)
//   GET  /link?token=<hex64>        -> 302 to ${APP_URL}/dashboard or /login?code_error=expired
//
// Brute-force budget is per email, independent of code rows: >= 10
// `login_code_failed` audit rows for the user in the last hour lock both
// /verify and /request (silently) until the window rolls over.
//
// The per-IP limiter (loginCodeLimiter) is attached in index.js. Codes and
// tokens are never logged and never appear in audit details; under A12
// (NODE_ENV !== 'production' && AUTH_DEV_ECHO=true) /request echoes them in
// the JSON body for automated tests only.
const express = require('express');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const emailService = require('../services/emailService');
const { t, SUPPORTED_LANGUAGES } = require('../i18n');
const { antibot } = require('../middleware/antibot');
const { getClientIp } = require('../utils/clientIp');
const { issueSession, verifySessionToken, isTokenVersionCurrent, getUserTokenVersion } = require('../utils/session');
const loginCodes = require('../utils/loginCodes');

const router = express.Router();

const MIN_RESPONSE_MS = 500; // A8: equalise /request and /verify latency
const PER_EMAIL_MAX = 3; // codes per email ...
const PER_EMAIL_WINDOW_MIN = 15; // ... per window
const EMAIL_LOCK_MAX_FAILURES = 10; // failed verifies per email ...
const EMAIL_LOCK_WINDOW = '-1 hour'; // ... per window (SQLite modifier)
const EMAIL_LOCK_AUDIT_GAP = '-10 minutes'; // audit `email_locked` at most once per gap
const CODE_RE = /^\d{6}$/;
const LINK_TOKEN_RE = /^[0-9a-f]{64}$/i;

const CODE_SENT_FALLBACK = "If that email is registered, we've sent a sign-in code.";
const CODE_INVALID_FALLBACK = 'The code is invalid or has expired.';

function translate(key, locale, fallback) {
  const msg = t(key, locale);
  return msg && msg !== key ? msg : fallback;
}

// Public origin of the SPA. In prod nginx on the frontend host proxies /api/
// to the backend, so both the magic link and the post-login redirects must
// go through this origin, never the backend's own.
function appUrl() {
  const raw = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3002';
  return raw.replace(/\/+$/, '');
}

function devEcho() {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_ECHO === 'true';
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run `send` only once MIN_RESPONSE_MS have elapsed since `startedAt`, so a
// hit and a miss are indistinguishable by timing.
async function respondAfterFloor(startedAt, send) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) await sleep(MIN_RESPONSE_MS - elapsed);
  return send();
}

// Only therapists/superadmins log in by code; clients use the bot, viewers
// have their own flow. Blocked accounts are treated as non-existent.
const LOGIN_USER_SQL =
  "SELECT id, email, role, language, timezone, blocked_at, email_verified_at FROM users WHERE role IN ('therapist', 'superadmin') AND blocked_at IS NULL";

function rowToUser(result) {
  if (result.length === 0 || result[0].values.length === 0) return null;
  const r = result[0].values[0];
  return { id: r[0], email: r[1], role: r[2], language: r[3], timezone: r[4], blockedAt: r[5], emailVerifiedAt: r[6] };
}

function findLoginUserByEmail(db, email) {
  return rowToUser(db.exec(`${LOGIN_USER_SQL} AND email = ?`, [email]));
}

function findLoginUserById(db, id) {
  return rowToUser(db.exec(`${LOGIN_USER_SQL} AND id = ?`, [id]));
}

function userExists(db, id) {
  const result = db.exec('SELECT id FROM users WHERE id = ?', [id]);
  return result.length > 0 && result[0].values.length > 0;
}

function scalar(db, sql, params) {
  const result = db.exec(sql, params);
  return result.length > 0 && result[0].values.length > 0 ? Number(result[0].values[0][0]) || 0 : 0;
}

// actor_id is always the user's id on these rows so the per-email failure
// count below can rely on it.
function audit(db, action, userId, details, ip) {
  db.run(
    "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, ip_address, created_at) VALUES (?, ?, 'user', ?, ?, ?, datetime('now'))",
    [userId, action, userId, details ? JSON.stringify(details) : null, ip || null]
  );
}

// Per-email brute-force budget: failed verifies for this user in the window.
function recentFailures(db, userId) {
  return scalar(
    db,
    "SELECT COUNT(*) FROM audit_logs WHERE actor_id = ? AND action = 'login_code_failed' AND created_at > datetime('now', ?)",
    [userId, EMAIL_LOCK_WINDOW]
  );
}

function isEmailLocked(db, userId) {
  return recentFailures(db, userId) >= EMAIL_LOCK_MAX_FAILURES;
}

// Record the lock once per EMAIL_LOCK_AUDIT_GAP so a hammering client does
// not flood audit_logs. Returns true when a row was written.
function auditEmailLockedOnce(db, userId, via, ip) {
  const recent = scalar(
    db,
    "SELECT COUNT(*) FROM audit_logs WHERE actor_id = ? AND action = 'login_code_failed' AND details_encrypted LIKE '%\"email_locked\"%' AND created_at > datetime('now', ?)",
    [userId, EMAIL_LOCK_AUDIT_GAP]
  );
  if (recent > 0) return false;
  audit(db, 'login_code_failed', userId, { reason: 'email_locked', via }, ip);
  return true;
}

// A successful code/link login also proves the mailbox: mark verified once.
function markEmailVerified(db, userId) {
  db.run("UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?", [userId]);
}

// Writes are NOT persisted here; the caller saves once per request.
function completeLogin(req, res, db, user, via) {
  const ip = getClientIp(req);
  markEmailVerified(db, user.id);
  audit(db, 'login_code_success', user.id, { via }, ip);
  logger.info(`[LOGIN_CODE] verified user=${user.id} ip=${ip} via=${via}`);
  return issueSession(res, { id: user.id, email: user.email, role: user.role, timezone: user.timezone });
}

// Login-CSRF guard for GET /link: a browser that already holds a VALID
// session for a different account must not be silently switched by a link
// planted by someone else. Returns the conflicting user id, or null.
function conflictingSessionUserId(req, db, linkUserId) {
  const cookieToken = req.cookies && req.cookies.session_token;
  if (!cookieToken || typeof cookieToken !== 'string') return null;
  let decoded;
  try {
    decoded = verifySessionToken(cookieToken);
  } catch (e) {
    return null; // expired/garbage cookie: treat as no session
  }
  const sessionUserId = decoded && Number(decoded.userId);
  if (!Number.isFinite(sessionUserId) || sessionUserId === Number(linkUserId)) return null;
  if (!userExists(db, sessionUserId)) return null;
  // A revoked token (H13) is no session either.
  return isTokenVersionCurrent(decoded, getUserTokenVersion(sessionUserId, db)) ? sessionUserId : null;
}

// POST /api/auth/login-code/request
// Body: { email, turnstile_token? }. antibot: Turnstile only (no honeypot —
// the login form has no hidden field and password managers fill it fast).
router.post('/request', antibot({ turnstile: true, honeypot: false, expectedAction: 'login_code' }), async (req, res) => {
  const startedAt = Date.now();
  const ip = getClientIp(req);

  // Same body for every outcome; only the timing floor differs from a 400.
  const respond = (extra) => respondAfterFloor(startedAt, () =>
    res.json(Object.assign({ message: translate('auth.codeSentIfExists', req.locale, CODE_SENT_FALLBACK) }, extra || {}))
  );

  try {
    const email = normalizeEmail(req.body && req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Email is required', missing_fields: ['email'] });
    }

    const db = getDatabase();
    const user = findLoginUserByEmail(db, email);

    if (!user) {
      // Unknown / blocked / non-therapist: nothing to send, identical reply.
      logger.info(`[LOGIN_CODE] requested user=none ip=${ip}`);
      return respond();
    }

    if (isEmailLocked(db, user.id)) {
      logger.warn(`[LOGIN_CODE] failed(email_locked) user=${user.id} ip=${ip}`);
      if (auditEmailLockedOnce(db, user.id, 'request', ip)) saveDatabaseAfterWrite();
      return respond();
    }

    if (loginCodes.countRecent(db, user.id, PER_EMAIL_WINDOW_MIN) >= PER_EMAIL_MAX) {
      logger.warn(`[LOGIN_CODE] failed(email_limit) user=${user.id} ip=${ip}`);
      audit(db, 'login_code_failed', user.id, { reason: 'email_limit' }, ip);
      saveDatabaseAfterWrite();
      return respond();
    }

    const issued = loginCodes.createFor(db, user.id, ip, { save: false });
    audit(db, 'login_code_requested', user.id, null, ip);
    saveDatabaseAfterWrite();
    logger.info(`[LOGIN_CODE] requested user=${user.id} ip=${ip}`);

    const linkUrl = `${appUrl()}/api/auth/login-code/link?token=${encodeURIComponent(issued.linkToken)}`;
    const locale = SUPPORTED_LANGUAGES.includes(user.language) ? user.language : req.locale;

    // Send the email without holding the response (timing floor still applies).
    emailService.sendLoginCodeEmail(user.email, { code: issued.code, linkUrl, ttlMin: loginCodes.TTL_MIN }, locale)
      .then((result) => {
        if (!result || !result.sent) {
          logger.info(`[LOGIN_CODE] email not sent user=${user.id}: ${(result && result.error) || 'not sent'}`);
        }
      })
      .catch((err) => {
        logger.error(`[LOGIN_CODE] email error user=${user.id}: ${err.message}`);
      });

    // A12: dev echo for automated tests only (never in production).
    const extra = devEcho() ? { dev_code: issued.code, dev_link_token: issued.linkToken } : null;
    return respond(extra);
  } catch (error) {
    logger.error('[LOGIN_CODE] request error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/login-code/verify
// Body: { email, code }. Every failure is the same 401 CODE_INVALID after the
// same timing floor; success mirrors POST /login.
router.post('/verify', async (req, res) => {
  const startedAt = Date.now();
  const ip = getClientIp(req);

  const fail = () => respondAfterFloor(startedAt, () =>
    res.status(401).json({
      error: translate('auth.codeInvalid', req.locale, CODE_INVALID_FALLBACK),
      code: 'CODE_INVALID'
    })
  );

  try {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const code = typeof body.code === 'string' ? body.code.trim() : String(body.code || '');

    if (!email) {
      return res.status(400).json({ error: 'Email is required', missing_fields: ['email'] });
    }
    if (!CODE_RE.test(code)) {
      return res.status(400).json({
        error: translate('auth.codeInvalid', req.locale, CODE_INVALID_FALLBACK),
        code: 'CODE_INVALID'
      });
    }

    const db = getDatabase();
    const user = findLoginUserByEmail(db, email);

    if (!user) {
      // No enumeration: same answer and timing as a wrong code.
      logger.info(`[LOGIN_CODE] failed(no_user) user=none ip=${ip}`);
      return fail();
    }

    // Per-email budget first: a locked email never touches the code row.
    if (isEmailLocked(db, user.id)) {
      logger.warn(`[LOGIN_CODE] failed(email_locked) user=${user.id} ip=${ip}`);
      if (auditEmailLockedOnce(db, user.id, 'code', ip)) saveDatabaseAfterWrite();
      return fail();
    }

    const check = loginCodes.verifyCode(db, user.id, code, { save: false });
    if (!check.ok) {
      logger.warn(`[LOGIN_CODE] failed(${check.reason}) user=${user.id} ip=${ip}`);
      audit(db, 'login_code_failed', user.id, { reason: check.reason, via: 'code' }, ip);
      saveDatabaseAfterWrite();
      return fail();
    }

    const session = completeLogin(req, res, db, user, 'code');
    saveDatabaseAfterWrite();
    return respondAfterFloor(startedAt, () =>
      res.json({
        message: 'Login successful',
        user: session.user
      })
    );
  } catch (error) {
    logger.error('[LOGIN_CODE] verify error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/login-code/link?token=<hex64>
// Magic link from the email. Sets the session cookie and redirects into the
// SPA; any failure lands on the login page with code_error=expired.
router.get('/link', (req, res) => {
  const ip = getClientIp(req);
  const failUrl = `${appUrl()}/login?code_error=expired`;
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!LINK_TOKEN_RE.test(token)) {
      logger.info(`[LOGIN_CODE] failed(bad_link) user=none ip=${ip}`);
      return res.redirect(302, failUrl);
    }

    const db = getDatabase();
    const check = loginCodes.verifyLink(db, loginCodes.hash(token), { save: false });
    if (!check.ok) {
      if (check.reason === 'expired') saveDatabaseAfterWrite();
      logger.warn(`[LOGIN_CODE] failed(link_${check.reason}) user=none ip=${ip}`);
      return res.redirect(302, failUrl);
    }

    const user = findLoginUserById(db, check.userId);
    if (!user) {
      // Blocked (or role changed) since the link was issued. Same redirect
      // as every other failure so the link never reveals why.
      logger.warn(`[LOGIN_CODE] failed(blocked) user=${check.userId} ip=${ip}`);
      audit(db, 'login_code_failed', check.userId, { reason: 'blocked', via: 'link' }, ip);
      saveDatabaseAfterWrite();
      return res.redirect(302, failUrl);
    }

    const conflict = conflictingSessionUserId(req, db, user.id);
    if (conflict !== null) {
      // Browser already signed in as someone else: do not switch accounts.
      logger.warn(`[LOGIN_CODE] failed(session_conflict) user=${user.id} ip=${ip} session_user=${conflict}`);
      audit(db, 'login_code_failed', user.id, { reason: 'session_conflict', via: 'link' }, ip);
      saveDatabaseAfterWrite();
      return res.redirect(302, failUrl);
    }

    completeLogin(req, res, db, user, 'link');
    saveDatabaseAfterWrite();
    return res.redirect(302, `${appUrl()}/dashboard`);
  } catch (error) {
    logger.error('[LOGIN_CODE] link error:', error);
    return res.redirect(302, failUrl);
  }
});

module.exports = router;
