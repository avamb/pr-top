// PR-TOP Backend API Server
// Entry point for the Express server

require('dotenv').config();
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
const cookieParser = require('cookie-parser');
const { csrfProtection, csrfTokenEndpoint } = require('./middleware/csrf');
const { requireActiveSubscription, authenticate } = require('./middleware/auth');
const { i18nMiddleware } = require('./middleware/i18n');
const { t: translate, SUPPORTED_LANGUAGES } = require('./i18n');
const assistantKnowledge = require('./services/assistantKnowledge');
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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : (process.env.NODE_ENV === 'development' ? 10000 : 500),
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: true, // Include `X-RateLimit-*` headers
  message: { error: 'Too many requests, please try again later.', retryAfter: '15 minutes' },
  handler: (req, res, next, options) => {
    const retryAfterSeconds = Math.ceil((options.windowMs - (Date.now() % options.windowMs)) / 1000);
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: retryAfterSeconds,
      retryAfterMs: retryAfterSeconds * 1000
    });
  }
});
app.use('/api/', limiter);

// Auth-specific rate limiting (stricter for login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX) : (process.env.NODE_ENV === 'development' ? 1000 : 50),
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req, res, next, options) => {
    const retryAfterSeconds = Math.ceil((options.windowMs - (Date.now() % options.windowMs)) / 1000);
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: retryAfterSeconds,
      retryAfterMs: retryAfterSeconds * 1000
    });
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Webhook routes MUST be mounted before JSON body parser (needs raw body for signature verification)
app.use('/api/webhooks', webhookRoutes);

// Body parsing (after webhooks which need raw body)
app.use(express.json({ limit: '50mb' })); // Increased for base64-encoded voice/video files from Telegram (up to ~20MB raw)
app.use(express.urlencoded({ extended: true }));

// Cookie parser for secure session cookies
app.use(cookieParser());

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

// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/assistant', require('./routes/publicAssistant')); // Public chat (no auth, mounted before auth-gated assistant routes)
app.use('/api/bot', botRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', requireActiveSubscription, dashboardRoutes);
app.use('/api/encryption', encryptionRoutes);
app.use('/api/clients', requireActiveSubscription, require('./routes/clients'));
app.use('/api/invite-code', requireActiveSubscription, require('./routes/inviteCode'));
app.use('/api/sessions', requireActiveSubscription, require('./routes/sessions'));
app.use('/api/exercises', requireActiveSubscription, require('./routes/exercises'));
app.use('/api/settings', requireActiveSubscription, require('./routes/settings'));
app.use('/api/search', requireActiveSubscription, require('./routes/search'));
app.use('/api/query', requireActiveSubscription, require('./routes/query'));
app.use('/api/export', requireActiveSubscription, require('./routes/export'));
app.use('/api/diary', requireActiveSubscription, require('./routes/diary'));
app.use('/api/assistant', requireActiveSubscription, require('./routes/assistant'));

// Dev-only seed endpoint for testing with large datasets
if (process.env.NODE_ENV !== 'production') {
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

    // Initialize Stripe SDK
    const stripeReady = initStripe();
    logger.info(`Stripe initialized: ${stripeReady ? 'configured' : 'not configured (placeholder key)'}`);

    // Start scheduled task runner (after DB is ready)
    scheduler.start();

    // Auto-reindex assistant knowledge base on startup
    try {
      const kbStats = await assistantKnowledge.reindex();
      logger.info(`Assistant knowledge base reindexed on startup: ${kbStats.indexed} files, ${kbStats.chunks} chunks, ${kbStats.removed} stale removed, embedding=${kbStats.embedding_type} (${kbStats.elapsed_ms}ms)`);
    } catch (kbError) {
      logger.warn('Assistant knowledge base reindex failed on startup: ' + kbError.message);
    }

    const server = app.listen(PORT, () => {
      logger.info(`PR-TOP API server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
    });

    // Attach WebSocket server for real-time notifications
    initWebSocket(server);
    logger.info('WebSocket server attached for real-time notifications');
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
