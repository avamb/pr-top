// PR-TOP Backend API Server
// Entry point for the Express server

require('dotenv').config();
// Fail closed before anything else loads: in production, refuse to start with
// missing / short / default JWT_SECRET, ENCRYPTION_MASTER_KEY or BOT_API_KEY.
require('./utils/secretsGuard').enforceSecrets();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase, saveDatabase, saveDatabaseAfterWrite } = require('./db/connection');
const { logger } = require('./utils/logger');
const { initStripe, getStripeStatus, isConfigured: isStripeConfigured } = require('./services/stripe');
const scheduler = require('./services/scheduler');
const { initWebSocket, getStats: getWsStats } = require('./services/websocketService');
const memoryWatchdog = require('./utils/memoryWatchdog');
const cookieParser = require('cookie-parser');
const { csrfProtection, csrfTokenEndpoint } = require('./middleware/csrf');
const { requireActiveSubscription, authenticate, requireVerifiedEmail, gateMutations } = require('./middleware/auth');
const { i18nMiddleware } = require('./middleware/i18n');
const { getClientIp } = require('./utils/clientIp');
const { t: translate, SUPPORTED_LANGUAGES } = require('./i18n');
const assistantKnowledge = require('./services/assistantKnowledge');
const assistantCache = require('./services/assistantCache');
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const subscriptionRoutes = require('./routes/subscription');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const encryptionRoutes = require('./routes/encryption');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (required behind nginx/Traefik in Docker)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    var allowed = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.PUBLIC_URL || ''
    ].filter(Boolean);
    // In development, allow any localhost port
    if (!origin || allowed.indexOf(origin) !== -1 || (process.env.NODE_ENV !== 'production' && origin && origin.match(/^http:\/\/localhost:\d+$/))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
// All limiters key on the real visitor IP (CF-Connecting-IP behind Cloudflare,
// req.ip otherwise; IPv6 collapsed to /64) — see utils/clientIp.js.
// Shared 429 handler: same JSON shape for every limiter, only the text differs.
function rateLimitHandler(message) {
  return (req, res, next, options) => {
    const retryAfterSeconds = Math.ceil((options.windowMs - (Date.now() % options.windowMs)) / 1000);
    res.status(429).json({
      error: message,
      retryAfter: retryAfterSeconds,
      retryAfterMs: retryAfterSeconds * 1000
    });
  };
}

// Path of the request without query string, lower-cased (Express routing is
// case-insensitive, so '/API/Bot/...' still reaches the bot router).
function requestPathLower(req) {
  return String(req.originalUrl || req.url || '').split('?')[0].toLowerCase();
}

// '/api/bot' or '/api/bot/...', any case — the same set of paths Express
// routes to the bot router (app.use('/api/bot') is case-insensitive).
function isBotApiRequest(req) {
  return /^\/api\/bot(\/|$)/.test(requestPathLower(req));
}

// Defence in depth: the bot calls backend:3001 directly on the internal
// Docker network and sends no proxy headers, whereas every request that came
// through nginx/Cloudflare carries X-Forwarded-For (nginx always sets it, plus
// X-Real-IP) and usually CF-Connecting-IP. Such a request to the bot API came
// from the internet — answer 404 as if the route did not exist, before any
// limiter, body parsing or bot-key check runs.
const PROXY_HEADERS = ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip'];
function rejectProxiedBotRequests(req, res, next) {
  if (isBotApiRequest(req) && PROXY_HEADERS.some((h) => req.headers[h] !== undefined)) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  next();
}
app.use(rejectProxiedBotRequests);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : (process.env.NODE_ENV !== 'production' ? 10000 : 500),
  keyGenerator: getClientIp,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: true, // Include `X-RateLimit-*` headers
  message: { error: 'Too many requests, please try again later.', retryAfter: '15 minutes' },
  handler: rateLimitHandler('Too many requests, please try again later.'),
  // Bot traffic all comes from the single bot-container IP; it has its own
  // limiter (botLimiter below) so it cannot exhaust this per-IP bucket.
  skip: isBotApiRequest
});
app.use('/api/', limiter);

// Auth-specific rate limiting (stricter for login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX) : (process.env.NODE_ENV !== 'production' ? 1000 : 50),
  keyGenerator: getClientIp,
  standardHeaders: true,
  legacyHeaders: true,
  handler: rateLimitHandler('Too many authentication attempts, please try again later.')
});
app.use('/api/auth/login', authLimiter);

// Registration rate limiting: a few sign-ups per hour per real IP is plenty
// for humans; the September 2026 bot wave created dozens per minute.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: process.env.REGISTER_RATE_LIMIT_MAX ? parseInt(process.env.REGISTER_RATE_LIMIT_MAX) : (process.env.NODE_ENV !== 'production' ? 1000 : 5),
  keyGenerator: getClientIp,
  standardHeaders: true,
  legacyHeaders: true,
  handler: rateLimitHandler('Too many registration attempts, please try again later.')
});
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/register-lead', registerLimiter);
app.use('/api/auth/register-viewer', registerLimiter);

// Email-code login rate limiting. The limiter is mounted now; the
// /api/auth/login-code router itself arrives in wave 2 (routes/loginCode.js)
// and must be mounted BEFORE the generic /api/auth router.
const loginCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: process.env.LOGIN_CODE_RATE_LIMIT_MAX ? parseInt(process.env.LOGIN_CODE_RATE_LIMIT_MAX) : (process.env.NODE_ENV !== 'production' ? 1000 : 10),
  keyGenerator: getClientIp,
  standardHeaders: true,
  legacyHeaders: true,
  handler: rateLimitHandler('Too many login code requests, please try again later.')
});
app.use('/api/auth/login-code', loginCodeLimiter);

// CSRF-token issuing (wave 3 review): every GET /api/csrf-token adds a token
// to the in-memory CSRF store, so spamming it could flush legitimate tokens.
// The SPA needs few: fetchApi caches its token, and useCsrfToken fetches once
// per mounted public form (login / register / landing forms). 120 per 15 min
// per IP leaves room for several people behind one office NAT.
const csrfTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.CSRF_TOKEN_RATE_LIMIT_MAX ? parseInt(process.env.CSRF_TOKEN_RATE_LIMIT_MAX) : (process.env.NODE_ENV !== 'production' ? 10000 : 120),
  keyGenerator: getClientIp,
  standardHeaders: true,
  legacyHeaders: true,
  handler: rateLimitHandler('Too many requests, please try again later.')
});
app.use('/api/csrf-token', csrfTokenLimiter);

// Webhook routes MUST be mounted before JSON body parser (needs raw body for signature verification)
app.use('/api/webhooks', webhookRoutes);

// Body parsing (after webhooks which need raw body)
// Audit M13: the 50mb JSON limit used to apply to every route, including
// unauthenticated ones. Only the bot API carries large JSON (base64 voice /
// video / photo, Telegram caps downloads at 20 MB raw = ~27 MB base64); it is
// parsed first with its own limit and is unreachable through the proxy
// (rejectProxiedBotRequests above). Everything else gets JSON_BODY_LIMIT.
// Bulk/client import uses multipart (multer), not JSON. An oversized body is
// answered 413 { code: 'PAYLOAD_TOO_LARGE' } by the error handler below.
app.use('/api/bot', express.json({ limit: process.env.BOT_JSON_BODY_LIMIT || '30mb' }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser for secure session cookies
app.use(cookieParser());

// Supervision share routes (T-17) — public, no auth, no CSRF
// Mounted at both /share and /api/share for SPA + API ergonomics.
const supervisionShareRoutes = require('./routes/supervisionShare');
app.use('/share', supervisionShareRoutes);
app.use('/api/share', supervisionShareRoutes);

// Public attendance-link endpoint (T-27/#401): one-tap Confirm / Reschedule /
// Release / opt-in URLs delivered via email reminders. Public, no auth, no
// CSRF — security comes from an HMAC-signed token (utils/signedLinks.js).
const publicAttendanceRoutes = require('./routes/publicAttendance');
app.use('/api/public', publicAttendanceRoutes);

// CSRF Protection
app.get('/api/csrf-token', csrfTokenEndpoint);
app.use('/api/', csrfProtection);

// i18n middleware - attach locale to every API request
app.use('/api/', i18nMiddleware);

// PATCH /api/profile/language - Quick language update endpoint
app.patch('/api/profile/language', authenticate, (req, res) => {
  try {
    const { language } = req.body;
    if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: translate('profile.invalidLanguage', req.locale) });
    }
    const { getDatabase, saveDatabaseAfterWrite } = require('./db/connection');
    const db = getDatabase();
    db.run("UPDATE users SET language = ?, updated_at = datetime('now') WHERE id = ?", [language, req.user.id]);
    saveDatabaseAfterWrite();
    const { logger } = require('./utils/logger');
    logger.info(`Language updated for user id=${req.user.id}: ${language}`);
    res.json({ message: translate('profile.languageUpdated', language), language });
  } catch (error) {
    const { logger } = require('./utils/logger');
    logger.error('Update language error: ' + error.message);
    res.status(500).json({ error: translate('errors.serverError', req.locale) });
  }
});

// GET /api/user/referral-link - Get the authenticated therapist's referral URL
app.get('/api/user/referral-link', authenticate, (req, res) => {
  try {
    const { getDatabase } = require('./db/connection');
    const db = getDatabase();
    const result = db.exec('SELECT referral_code FROM users WHERE id = ?', [req.user.id]);
    if (!result.length || !result[0].values.length || !result[0].values[0][0]) {
      return res.status(404).json({ error: 'Referral code not found' });
    }
    const referralCode = result[0].values[0][0];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const referralLink = `${frontendUrl}/register?ref=${referralCode}`;
    res.json({ referral_code: referralCode, referral_link: referralLink });
  } catch (error) {
    const { logger } = require('./utils/logger');
    logger.error('Referral link error: ' + error.message);
    res.status(500).json({ error: 'Failed to get referral link' });
  }
});

// Liveness probe for the container healthcheck (src/backend/healthcheck.sh).
// Deliberately cheap: proves the event loop is responsive and the in-memory
// SQLite handle still answers, without touching Stripe or the network.
app.get('/api/health/live', (req, res) => {
  const db = global.db;
  try {
    if (!db) throw new Error('database not initialised');
    db.exec('SELECT 1');
  } catch (e) {
    return res.status(503).json({ status: 'error', error: e.message });
  }
  res.json({ status: 'ok', uptime_s: Math.round(process.uptime()) });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const db = global.db;
  let dbStatus = 'disconnected';
  let tableCount = 0;

  if (db) {
    try {
      const result = db.exec("SELECT count(*) FROM sqlite_master WHERE type='table'");
      tableCount = result[0].values[0][0];
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'error';
    }
  }

  // Get Stripe status
  const stripeStatus = await getStripeStatus();

  res.json({
    status: 'ok',
    database: dbStatus,
    tableCount,
    stripe: stripeStatus,
    websocket: getWsStats(),
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// GET /api/features — public feature flag endpoint for the frontend
// Exposes FEATURE_* env vars (boolean values only, no secrets).
app.get('/api/features', (req, res) => {
  res.json({
    FEATURE_SESSION_REMINDERS: process.env.FEATURE_SESSION_REMINDERS === 'on'
  });
});

// Bot API rate limiting. Every bot call originates from the bot container's
// single IP, so the global per-IP limiter would lock out all clients (incl.
// SOS) after a few hundred messages. Requests carrying a valid x-bot-api-key
// are bucketed per Telegram user with a high cap (BOT_RATE_LIMIT_MAX); others
// stay per-IP at the global cap. Mounted after the body parser so telegram_id
// in the JSON body is visible. POST /api/bot/sos with a valid key is never
// limited here.
const BOT_RATE_LIMIT_MAX = process.env.BOT_RATE_LIMIT_MAX ? parseInt(process.env.BOT_RATE_LIMIT_MAX) : 6000;
const GLOBAL_RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : (process.env.NODE_ENV !== 'production' ? 10000 : 500);
// Bot routes that carry the Telegram id as the path parameter (routes/bot.js).
const BOT_TELEGRAM_ID_PATH = /^\/(?:user|profile|consent-status|diary|sessions|exercises|assignments|settings)\/([^/]+)\/?$/i;

function botTelegramId(req) {
  const fromBody = req.body && typeof req.body === 'object' ? req.body.telegram_id : undefined;
  if (fromBody !== undefined && fromBody !== null && fromBody !== '') return String(fromBody);
  if (req.query && req.query.telegram_id) return String(req.query.telegram_id);
  if (req.method === 'GET' || req.method === 'PUT') {
    const m = BOT_TELEGRAM_ID_PATH.exec(req.path || '');
    if (m) return m[1];
  }
  return null;
}

function hasValidBotKey(req) {
  return botRoutes.isValidBotApiKey(req.headers['x-bot-api-key']);
}

function isBotSosRequest(req) {
  return requestPathLower(req).replace(/\/+$/, '') === '/api/bot/sos';
}

const botLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: (req) => (hasValidBotKey(req) ? BOT_RATE_LIMIT_MAX : GLOBAL_RATE_LIMIT_MAX),
  keyGenerator: (req) => {
    if (hasValidBotKey(req)) {
      const tgId = botTelegramId(req);
      return tgId ? 'tg:' + tgId : 'bot-ip:' + getClientIp(req);
    }
    return 'ip:' + getClientIp(req);
  },
  standardHeaders: true,
  legacyHeaders: true,
  handler: rateLimitHandler('Too many requests, please try again later.'),
  // SOS must never be throttled (only for authenticated bot calls, so the
  // unauthenticated path cannot be used to brute-force the key unlimited).
  skip: (req) => isBotSosRequest(req) && hasValidBotKey(req)
});

// Mount route handlers
// Wave 2 auth extensions (docs/security/SPEC_ANTIBOT_WAVES.md §3):
// login-by-code router sits on its own prefix (limiter is mounted above),
// email-verification router shares /api/auth and is mounted before authRoutes.
app.use('/api/auth/login-code', require('./routes/loginCode'));
app.use('/api/auth', require('./routes/emailVerification'));
app.use('/api/auth', authRoutes);
app.use('/api/assistant', require('./routes/publicAssistant')); // Public chat (no auth, mounted before auth-gated assistant routes)
app.use('/api/bot', botLimiter, botRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', requireActiveSubscription, dashboardRoutes);
app.use('/api/encryption', encryptionRoutes);
// Email-verification gate (wave 2, track 2A; SPEC_ANTIBOT_WAVES.md §3 table):
// gateMutations() applies requireVerifiedEmail to POST/PUT/PATCH/DELETE and to
// */export paths only — reads stay open for unverified therapists.
// Route-level gates: GET /api/invite-code/link (routes/inviteCode.js) and
// POST /api/assistant/chat (routes/assistant.js).
app.use('/api/clients', requireActiveSubscription, gateMutations(requireVerifiedEmail), require('./routes/clients'));
// T-05: standalone /api/assignments router exposes the spec-shaped
// POST /api/assignments/:id/reports/:reportId/(accept|return) aliases on
// top of the nested /api/clients/:cid/assignments/... endpoints.
app.use('/api/assignments', requireActiveSubscription, require('./routes/assignments'));
app.use('/api/invite-code', requireActiveSubscription, gateMutations(requireVerifiedEmail), require('./routes/inviteCode'));
app.use('/api/sessions', requireActiveSubscription, gateMutations(requireVerifiedEmail), require('./routes/sessions'));
app.use('/api/exercises', requireActiveSubscription, require('./routes/exercises'));
app.use('/api/settings', requireActiveSubscription, require('./routes/settings'));
app.use('/api/search', requireActiveSubscription, require('./routes/search'));
app.use('/api/query', requireActiveSubscription, require('./routes/query'));
app.use('/api/export', requireActiveSubscription, gateMutations(requireVerifiedEmail), require('./routes/export'));
app.use('/api/diary', requireActiveSubscription, require('./routes/diary'));
app.use('/api/assistant', requireActiveSubscription, require('./routes/assistant'));
app.use('/api/kb', requireActiveSubscription, require('./routes/kb'));
app.use('/api/comments', require('./routes/comments'));

// Dev-only endpoints (seed data, set-role -> superadmin, raw SELECT, ...).
// Fail closed: never in production, and outside production only when
// NODE_ENV is explicitly development/test or ENABLE_DEV_ENDPOINTS=true —
// an unset/typo'd NODE_ENV (e.g. a staging box) must not expose them.
const DEV_ENDPOINTS_ENABLED = process.env.NODE_ENV !== 'production' && (
  process.env.NODE_ENV === 'development' ||
  process.env.NODE_ENV === 'test' ||
  process.env.ENABLE_DEV_ENDPOINTS === 'true'
);
if (DEV_ENDPOINTS_ENABLED) {
  logger.warn('[DEV] /api/dev/* endpoints are ENABLED (NODE_ENV=' + (process.env.NODE_ENV || 'unset') + ')');
  const bcrypt = require('bcryptjs');
  app.post('/api/dev/seed-clients', async (req, res) => {
    try {
      const { therapist_id, count } = req.body;
      if (!therapist_id || !count) return res.status(400).json({ error: 'therapist_id and count required' });
      const { getDatabase, saveDatabaseAfterWrite: save } = require('./db/connection');
      const db = getDatabase();
      const hash = await bcrypt.hash('TestPass123', 4);
      const ts = Date.now();
      let created = 0;
      for (let i = 1; i <= count; i++) {
        db.run("INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language) VALUES (?, ?, 'client', ?, 1, 'en')",
          [`seed${i}_${ts}@t.com`, hash, therapist_id]);
        created++;
      }
      save();
      const total = db.exec("SELECT COUNT(*) FROM users WHERE therapist_id = ? AND role = 'client'", [therapist_id]);
      res.json({ created, total: total[0].values[0][0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/dev/set-telegram-id', (req, res) => {
    try {
      const { user_id, telegram_id } = req.body;
      if (!user_id || !telegram_id) return res.status(400).json({ error: 'user_id and telegram_id required' });
      const { getDatabase, saveDatabaseAfterWrite: save } = require('./db/connection');
      const db = getDatabase();
      db.run("UPDATE users SET telegram_id = ? WHERE id = ?", [String(telegram_id), user_id]);
      save();
      res.json({ updated: true, user_id, telegram_id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/dev/update-diary-date', (req, res) => {
    try {
      const { entry_id, created_at } = req.body;
      if (!entry_id || !created_at) return res.status(400).json({ error: 'entry_id and created_at required' });
      const { getDatabase, saveDatabaseAfterWrite: save } = require('./db/connection');
      const db = getDatabase();
      db.run("UPDATE diary_entries SET created_at = ?, updated_at = ? WHERE id = ?", [created_at, created_at, entry_id]);
      save();
      res.json({ updated: true, entry_id, created_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/dev/set-consent', (req, res) => {
    try {
      const { client_id, consent } = req.body;
      if (!client_id || consent === undefined) return res.status(400).json({ error: 'client_id and consent required' });
      const { getDatabase, saveDatabaseAfterWrite: save } = require('./db/connection');
      const db = getDatabase();
      db.run("UPDATE users SET consent_therapist_access = ?, updated_at = datetime('now') WHERE id = ? AND role = 'client'", [consent ? 1 : 0, client_id]);
      save();
      res.json({ updated: true, client_id, consent: !!consent });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/dev/expire-trial', (req, res) => {
    try {
      const { therapist_id } = req.body;
      if (!therapist_id) return res.status(400).json({ error: 'therapist_id required' });
      const { getDatabase, saveDatabaseAfterWrite: save } = require('./db/connection');
      const db = getDatabase();
      db.run("UPDATE subscriptions SET trial_ends_at = datetime('now', '-1 day') WHERE therapist_id = ? AND plan = 'trial'", [therapist_id]);
      save();
      res.json({ expired: true, therapist_id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DEV: Set subscription plan (for testing plan-gated features)
  app.post('/api/dev/set-plan', (req, res) => {
    try {
      const { therapist_id, plan } = req.body;
      if (!therapist_id || !plan) return res.status(400).json({ error: 'therapist_id and plan required' });
      const validPlans = ['trial', 'basic', 'pro', 'premium'];
      if (!validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan. Must be: ' + validPlans.join(', ') });
      const { getDatabase, saveDatabaseAfterWrite: save } = require('./db/connection');
      const db = getDatabase();
      db.run("UPDATE subscriptions SET plan = ?, status = 'active' WHERE therapist_id = ?", [plan, therapist_id]);
      save();
      res.json({ success: true, therapist_id, plan });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DEV: Set user role (for testing admin features)
  app.post('/api/dev/set-role', (req, res) => {
    try {
      const { user_id, email, role } = req.body;
      if (!role) return res.status(400).json({ error: 'role required' });
      const validRoles = ['therapist', 'client', 'superadmin'];
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role. Must be: ' + validRoles.join(', ') });
      if (!user_id && !email) return res.status(400).json({ error: 'user_id or email required' });
      const { getDatabase, saveDatabaseAfterWrite: save } = require('./db/connection');
      const db = getDatabase();
      if (user_id) {
        db.run("UPDATE users SET role = ? WHERE id = ?", [role, user_id]);
      } else {
        db.run("UPDATE users SET role = ? WHERE email = ?", [role, email]);
      }
      save();
      res.json({ success: true, email, user_id, role });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DEV: Query audit logs for testing consent enforcement (#387)
  app.post('/api/dev/audit-query', (req, res) => {
    try {
      const { action, actor_id, target_id, limit: lim = 30 } = req.body;
      const { getDatabase } = require('./db/connection');
      const db = getDatabase();
      const parts = ['SELECT action, actor_id, target_type, target_id, details_encrypted, created_at FROM audit_logs WHERE 1=1'];
      const params = [];
      if (action) { parts.push('AND action = ?'); params.push(action); }
      if (actor_id) { parts.push('AND actor_id = ?'); params.push(actor_id); }
      if (target_id) { parts.push('AND target_id = ?'); params.push(target_id); }
      parts.push('ORDER BY created_at DESC LIMIT ?');
      params.push(lim);
      const r = db.exec(parts.join(' '), params);
      if (!r.length || !r[0].values.length) return res.json({ rows: [] });
      const cols = r[0].columns;
      const rows = r[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]])));
      res.json({ rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DEV: Run arbitrary SELECT query on the database (read-only, dev-only) (#388 encryption audit)
  app.post('/api/dev/db-query', (req, res) => {
    try {
      const { sql, params: qParams = [] } = req.body;
      if (!sql) return res.status(400).json({ error: 'sql required' });
      // Safety: only allow SELECT statements
      const trimmed = sql.trim().toUpperCase();
      if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA')) {
        return res.status(400).json({ error: 'Only SELECT and PRAGMA statements allowed' });
      }
      const { getDatabase } = require('./db/connection');
      const db = getDatabase();
      const r = db.exec(sql, qParams);
      if (!r.length || !r[0].values.length) return res.json({ rows: [] });
      const cols = r[0].columns;
      const rows = r[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]])));
      res.json({ rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DEV: Run scheduler jobs on-demand for testing (#391 subscription regression)
  app.post('/api/dev/run-scheduler', (req, res) => {
    try {
      const { job } = req.body;
      const validJobs = ['trial-expiration', 'subscription-downgrade', 'expiry-warning', 'diary-reminder'];
      if (!job || !validJobs.includes(job)) {
        return res.status(400).json({ error: 'job must be one of: ' + validJobs.join(', ') });
      }
      const jobMap = {
        'trial-expiration': scheduler.runTrialExpiration,
        'subscription-downgrade': scheduler.runSubscriptionDowngrade,
        'expiry-warning': scheduler.runExpiryWarning,
        'diary-reminder': scheduler.runDiaryReminder
      };
      const result = jobMap[job]();
      res.json({ job, result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DEV: Set subscription period end for testing expiry warnings
  app.post('/api/dev/set-subscription', (req, res) => {
    try {
      const { therapist_id, status, plan, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id } = req.body;
      if (!therapist_id) return res.status(400).json({ error: 'therapist_id required' });
      const { getDatabase, saveDatabaseAfterWrite: save } = require('./db/connection');
      const db = getDatabase();
      const parts = ['UPDATE subscriptions SET updated_at = datetime(\'now\')'];
      const params = [];
      if (status) { parts.push(', status = ?'); params.push(status); }
      if (plan)   { parts.push(', plan = ?');   params.push(plan); }
      if (trial_ends_at)        { parts.push(', trial_ends_at = ?');        params.push(trial_ends_at); }
      if (current_period_end)   { parts.push(', current_period_end = ?');   params.push(current_period_end); }
      if (stripe_customer_id)   { parts.push(', stripe_customer_id = ?');   params.push(stripe_customer_id); }
      if (stripe_subscription_id) { parts.push(', stripe_subscription_id = ?'); params.push(stripe_subscription_id); }
      parts.push('WHERE therapist_id = ?');
      params.push(therapist_id);
      db.run(parts.join(''), params);
      save();
      res.json({ success: true, therapist_id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  // Handle JSON parse errors gracefully (malformed request body)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body', message: err.message });
  }
  // M13: body over JSON_BODY_LIMIT / BOT_JSON_BODY_LIMIT (body-parser).
  if (err.type === 'entity.too.large') {
    logger.warn(`Request body too large: ${req.method} ${String(req.originalUrl || '').split('?')[0]} (${err.length} bytes, limit ${err.limit})`);
    return res.status(413).json({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
  }
  logger.error('Unhandled error: ' + err.message);
  logger.error('Stack: ' + err.stack);
  // Never expose internal error details to users
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');

    // Run the vector-store migrations now (encrypt legacy plaintext search
    // previews, drop embeddings of private diary entries) instead of on the
    // first search after a deploy.
    try {
      require('./services/vectorStore').ensureTable();
    } catch (e) {
      logger.error('Vector store migration failed at startup: ' + e.message);
    }

    // A key re-encryption job interrupted by a restart continues from its cursor.
    try {
      require('./services/keyRotation').resumeInterruptedJob();
    } catch (e) {
      logger.error('Key rotation resume failed: ' + e.message);
    }

    // Older code let /api/clients/link attach clients to the superadmin account,
    // which would expose their Class A data to the admin. Report (count only).
    try {
      require('./utils/consentCheck').warnClientsLinkedToSuperadmin();
    } catch (e) {
      logger.error('Superadmin-linked client check failed: ' + e.message);
    }

    // Rate limiters trust CF-Connecting-IP. That header is only meaningful
    // when nothing but Cloudflare can reach the origin; otherwise anyone can
    // spoof it and rotate limiter buckets. ORIGIN_LOCKED=true is the
    // operator's attestation that the firewall / Authenticated Origin Pulls
    // are in place (docs/troubleshooting/antibot-runbook.md).
    if (process.env.NODE_ENV === 'production' && process.env.ORIGIN_LOCKED !== 'true') {
      logger.warn('CF-Connecting-IP is trusted for rate limiting but ORIGIN_LOCKED is not set — ensure the origin only accepts traffic from Cloudflare (firewall / Authenticated Origin Pulls)');
    }

    // Initialize Stripe SDK
    const stripeReady = initStripe();
    logger.info(`Stripe initialized: ${stripeReady ? 'configured' : 'not configured (placeholder key)'}`);

    // Downgrades scheduled by older code only set pending_plan locally and never
    // switched the Stripe price; move those subscriptions onto the lower price
    // now. Best effort, never throws, skipped in dev mode / without Stripe.
    require('./services/stripe').reconcilePendingDowngrades().catch(() => {});

    // Start scheduled task runner (after DB is ready)
    scheduler.start();

    // Auto-reindex assistant knowledge base on startup
    try {
      const kbStats = await assistantKnowledge.reindex();
      logger.info(`Assistant knowledge base reindexed on startup: ${kbStats.indexed} files, ${kbStats.chunks} chunks, ${kbStats.removed} stale removed, embedding=${kbStats.embedding_type} (${kbStats.elapsed_ms}ms)`);
    } catch (kbError) {
      logger.warn('Assistant knowledge base reindex failed on startup: ' + kbError.message);
    }

    // Feature #440 (S7): (re)seed canned FAQ answers on startup so the top
    // standard questions ("how much does it cost", "is there a free trial")
    // are served from the cache without ever calling the LLM. Idempotent —
    // upsert-by-hash means restarts do not duplicate rows.
    try {
      const seedStats = await assistantCache.seedCannedFaq();
      logger.info(`Assistant FAQ seed loaded on startup: loaded=${seedStats.loaded} inserted=${seedStats.inserted} updated=${seedStats.updated} skipped=${seedStats.skipped}`);
    } catch (seedError) {
      logger.warn('Assistant FAQ seed failed on startup: ' + seedError.message);
    }

    const server = app.listen(PORT, () => {
      logger.info(`PR-TOP API server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
    });

    // Attach WebSocket server for real-time notifications
    initWebSocket(server);
    logger.info('WebSocket server attached for real-time notifications');

    // Memory watchdog: log usage periodically and exit (-> container restart)
    // before slow growth turns into GC thrash with a blocked event loop.
    memoryWatchdog.start({ beforeExit: () => saveDatabase() });

    // Graceful shutdown: flush the in-memory SQLite DB to disk and stop the
    // scheduler when Docker sends SIGTERM (or on Ctrl+C locally).
    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try { scheduler.stop(); } catch (e) { logger.warn('Scheduler stop failed: ' + e.message); }
      try { saveDatabase(); } catch (e) { logger.error('Final database save failed: ' + e.message); }
      server.close(() => process.exit(0));
      // Do not wait forever for open keep-alive connections.
      setTimeout(() => process.exit(0), 5000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
