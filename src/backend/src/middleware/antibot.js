// Anti-bot middleware for public forms (register, register-lead,
// register-viewer, forgot-password, login-code/request).
//
// Three checks, cheapest first (spec: docs/security/SPEC_ANTIBOT_WAVES.md §0 A5):
//   1. honeypot  - hidden `website` field must stay empty
//   2. timing    - `form_started_at` (unix ms) must be at least ANTIBOT_MIN_FORM_MS
//                  in the past
//   3. Turnstile - `turnstile_token` verified against Cloudflare siteverify
//
// Outcomes differ on purpose:
//   - honeypot  -> FAKE success mirroring the real route's success payload
//                  (status, keys, order, cookie) after a bcrypt-like delay, so a
//                  bot cannot tell it was rejected. Only a bot fills a hidden field.
//   - timing    -> honest 400 { code: 'FORM_TOO_FAST' }. Password-manager
//                  autofill can legitimately finish under the threshold; a retry
//                  passes because form_started_at comes from page mount.
//   - Turnstile -> honest 403 { code: 'TURNSTILE_FAILED' } because real people
//                  hit it (ad blockers) and need actionable text.
//
// Every check is behind an env flag so existing test scripts and the dev
// stand keep working: ANTIBOT_ENABLED=false skips honeypot/timing; an empty
// TURNSTILE_SECRET skips Turnstile.
const crypto = require('crypto');
const net = require('net');
const { logger } = require('../utils/logger');
const { getClientIp } = require('../utils/clientIp');
const { SESSION_COOKIE_OPTIONS } = require('../utils/session');
const { t } = require('../i18n');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5000;
const TURNSTILE_FAILED_FALLBACK = 'Verification failed, please reload the page and try again';
const FORM_TOO_FAST_FALLBACK = 'Please take a moment and try again.';
const FAKE_DELAY_MIN_MS = 250;
const FAKE_DELAY_MAX_MS = 450;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

function minFormMs() {
  const parsed = parseInt(process.env.ANTIBOT_MIN_FORM_MS, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3000;
}

function honeypotEnabled() {
  return process.env.ANTIBOT_ENABLED !== 'false';
}

function turnstileSecret() {
  return (process.env.TURNSTILE_SECRET || '').trim();
}

// Keep log lines single-line and bounded even if the body is hostile.
function safeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]/g, ' ').slice(0, 200);
}

function normalizedEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function translate(key, locale, fallback) {
  const msg = t(key, locale);
  // i18n returns the key itself when it is missing.
  return msg && msg !== key ? msg : fallback;
}

// SQLite datetime('now') format, which is what the real routes return for
// created_at (they read the row back after INSERT).
function sqliteNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Looks like our JWT (three base64url segments) but is signed with random
// bytes, so it can never verify against JWT_SECRET.
function dummyJwt(email, role) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ userId: 0, email, role, iat: now, exp: now + 24 * 60 * 60 });
  return `${header}.${payload}.${crypto.randomBytes(32).toString('base64url')}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fake success per route kind. Each mirrors the real success response of the
// route it protects (see routes/auth.js) in status, keys, key order and
// cookie behaviour. id=0 never exists; tokens are unverifiable.
const FAKE_RESPONSES = {
  register(res, email) {
    res.cookie('session_token', dummyJwt(email, 'therapist'), SESSION_COOKIE_OPTIONS);
    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: 0, email, role: 'therapist', created_at: sqliteNow(), timezone: 'UTC' },
      token: dummyJwt(email, 'therapist')
    });
  },
  viewer(res, email) {
    const token = dummyJwt(email, 'viewer');
    res.cookie('session_token', token, SESSION_COOKIE_OPTIONS);
    return res.status(201).json({
      message: 'Registered successfully! You can continue chatting.',
      user: { id: 0, email, role: 'viewer', created_at: sqliteNow() },
      token
    });
  },
  lead(res, email) {
    return res.status(201).json({
      message: 'Registered successfully! Check your email to verify.',
      lead: { id: 0, email, verified: false, extra_messages_limit: 10 }
    });
  },
  forgot(res) {
    return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  }
};

async function fakeSuccess(req, res, kind) {
  const body = req.body || {};
  logger.warn(`[ANTIBOT] reason=honeypot ip=${getClientIp(req)} email=${safeEmail(body.email)} fake=${kind}`);
  // bcrypt-like latency so the fake path is not distinguishable by timing
  await sleep(crypto.randomInt(FAKE_DELAY_MIN_MS, FAKE_DELAY_MAX_MS + 1));
  const builder = FAKE_RESPONSES[kind] || FAKE_RESPONSES.register;
  return builder(res, normalizedEmail(body.email));
}

function expectedHostname() {
  const raw = process.env.FRONTEND_URL || process.env.PUBLIC_URL || '';
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return LOCAL_HOSTS.includes(host) ? null : host;
  } catch (e) {
    return null;
  }
}

async function verifyTurnstile(token, ip) {
  const params = new URLSearchParams();
  params.set('secret', turnstileSecret());
  params.set('response', typeof token === 'string' ? token : '');
  if (ip && net.isIP(ip)) params.set('remoteip', ip);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`siteverify HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Returns a comma-separated failure code string, or '' when the outcome is
// acceptable. Checks success, then hostname (token was issued for our site),
// then action (token was issued for this form).
function turnstileFailureCodes(outcome, expectedAction) {
  if (!outcome || outcome.success !== true) {
    return Array.isArray(outcome && outcome['error-codes']) ? outcome['error-codes'].join(',') : 'not-success';
  }
  const host = expectedHostname();
  if (host && typeof outcome.hostname === 'string' && outcome.hostname.toLowerCase() !== host) {
    return 'hostname-mismatch';
  }
  if (expectedAction && typeof outcome.action === 'string' && outcome.action !== expectedAction) {
    return 'action-mismatch';
  }
  return '';
}

function stripAntibotFields(req) {
  if (req.body && typeof req.body === 'object') {
    delete req.body.website;
    delete req.body.form_started_at;
    delete req.body.turnstile_token;
  }
}

/**
 * antibot({ turnstile, honeypot, fake, expectedAction })
 *   turnstile      - run the Turnstile check (default true; no-op without TURNSTILE_SECRET)
 *   honeypot       - run honeypot + timing (default true; no-op with ANTIBOT_ENABLED=false)
 *   fake           - 'register' | 'viewer' | 'lead' | 'forgot': which success
 *                    payload to mirror on a honeypot hit (default 'register')
 *   expectedAction - Turnstile widget `action` the token must carry (optional)
 */
function antibot(opts) {
  const options = Object.assign({ turnstile: true, honeypot: true, fake: 'register', expectedAction: null }, opts || {});

  return async function antibotMiddleware(req, res, next) {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};

    // 1 + 2: honeypot and timing (no network, run first)
    if (options.honeypot !== false && honeypotEnabled()) {
      if (typeof body.website === 'string' ? body.website.trim() !== '' : !!body.website) {
        return fakeSuccess(req, res, options.fake);
      }

      const startedAt = Number(body.form_started_at);
      if (!Number.isFinite(startedAt) || startedAt <= 0 || (Date.now() - startedAt) < minFormMs()) {
        logger.info(`[ANTIBOT] reason=timing ip=${getClientIp(req)} email=${safeEmail(body.email)}`);
        return res.status(400).json({
          error: translate('auth.formTooFast', req.locale, FORM_TOO_FAST_FALLBACK),
          code: 'FORM_TOO_FAST'
        });
      }
    }

    // 3: Turnstile (only when configured)
    if (options.turnstile !== false && turnstileSecret()) {
      const ip = getClientIp(req);
      let outcome;
      try {
        outcome = await verifyTurnstile(body.turnstile_token, ip);
      } catch (err) {
        // Our side (or Cloudflare) is failing — do not lock humans out.
        logger.warn(`[ANTIBOT] turnstile siteverify unavailable, passing request: ${err.name === 'AbortError' ? 'timeout' : err.message} ip=${ip}`);
        outcome = null;
      }
      if (outcome) {
        const codes = turnstileFailureCodes(outcome, options.expectedAction);
        if (codes) {
          logger.warn(`[ANTIBOT] reason=turnstile ip=${ip} email=${safeEmail(body.email)} codes=${codes}`);
          return res.status(403).json({
            error: translate('auth.turnstileFailed', req.locale, TURNSTILE_FAILED_FALLBACK),
            code: 'TURNSTILE_FAILED'
          });
        }
      }
    }

    stripAntibotFields(req);
    next();
  };
}

module.exports = { antibot };
