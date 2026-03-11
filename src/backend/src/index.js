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
const authRoutes = require('./routes/auth');

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

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
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

  res.json({
    status: 'ok',
    database: dbStatus,
    tableCount,
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// Mount route handlers
app.use('/api/auth', authRoutes);
// app.use('/api/clients', require('./routes/clients'));
// app.use('/api/sessions', require('./routes/sessions'));
// app.use('/api/exercises', require('./routes/exercises'));
// app.use('/api/subscription', require('./routes/subscription'));
// app.use('/api/search', require('./routes/search'));
// app.use('/api/admin', require('./routes/admin'));
// app.use('/api/webhooks', require('./routes/webhooks'));

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');

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
