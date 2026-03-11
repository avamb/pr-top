// PsyLink Backend API Server
// Entry point for the Express server

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase, saveDatabase } = require('./db/connection');
const { logger } = require('./utils/logger');
const { initStripe, getStripeStatus, isConfigured: isStripeConfigured } = require('./services/stripe');
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const subscriptionRoutes = require('./routes/subscription');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const encryptionRoutes = require('./routes/encryption');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Webhook routes MUST be mounted before JSON body parser (needs raw body for signature verification)
app.use('/api/webhooks', webhookRoutes);

// Body parsing (after webhooks which need raw body)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/encryption', encryptionRoutes);
app.use('/api/clients', require('./routes/clients'));
app.use('/api/invite-code', require('./routes/inviteCode'));
app.use('/api/sessions', require('./routes/sessions'));
// app.use('/api/exercises', require('./routes/exercises'));
// app.use('/api/search', require('./routes/search'));

// Dev-only seed endpoint for testing with large datasets
if (process.env.NODE_ENV !== 'production') {
  const bcrypt = require('bcryptjs');
  app.post('/api/dev/seed-clients', async (req, res) => {
    try {
      const { therapist_id, count } = req.body;
      if (!therapist_id || !count) return res.status(400).json({ error: 'therapist_id and count required' });
      const { getDatabase, saveDatabase: save } = require('./db/connection');
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
}

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error: ' + err.message);
  logger.error('Stack: ' + err.stack);
  res.status(500).json({ error: 'Internal server error: ' + err.message });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');

    // Initialize Stripe SDK
    const stripeReady = initStripe();
    logger.info(`Stripe initialized: ${stripeReady ? 'configured' : 'not configured (placeholder key)'}`);

    app.listen(PORT, () => {
      logger.info(`PsyLink API server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
