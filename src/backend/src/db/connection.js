// Database Connection and Initialization
// Uses better-sqlite3 for SQLite database

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

let db = null;

function getDbPath() {
  const dbUrl = process.env.DATABASE_URL || 'sqlite:./data/psylink.db';
  const dbPath = dbUrl.replace('sqlite:', '');
  return path.resolve(__dirname, '../../', dbPath);
}

function initDatabase() {
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);

  // Ensure data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  logger.info(`Connecting to database at: ${dbPath}`);

  db = new Database(dbPath, {
    verbose: process.env.LOG_LEVEL === 'debug' ? (sql) => logger.debug(`SQL: ${sql}`) : undefined
  });

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema migrations
  applySchema(db);

  // Store db reference globally for health checks
  global.db = db;

  logger.info('Database connection established');
  return db;
}

function applySchema(db) {
  logger.info('Applying database schema...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('therapist', 'client', 'superadmin')),
      therapist_id INTEGER REFERENCES users(id),
      consent_therapist_access INTEGER DEFAULT 0,
      invite_code TEXT UNIQUE,
      language TEXT DEFAULT 'en',
      timezone TEXT DEFAULT 'UTC',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      blocked_at TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT
    );

    CREATE TABLE IF NOT EXISTS diary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id),
      entry_type TEXT NOT NULL CHECK(entry_type IN ('text', 'voice', 'video')),
      content_encrypted TEXT,
      transcript_encrypted TEXT,
      encryption_key_id INTEGER REFERENCES encryption_keys(id),
      payload_version INTEGER DEFAULT 1,
      file_ref TEXT,
      embedding_ref TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS therapist_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      note_encrypted TEXT NOT NULL,
      encryption_key_id INTEGER REFERENCES encryption_keys(id),
      payload_version INTEGER DEFAULT 1,
      session_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      audio_ref TEXT,
      transcript_encrypted TEXT,
      summary_encrypted TEXT,
      encryption_key_id INTEGER REFERENCES encryption_keys(id),
      payload_version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'transcribing', 'summarizing', 'complete', 'failed')),
      scheduled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      anamnesis_encrypted TEXT,
      current_goals_encrypted TEXT,
      contraindications_encrypted TEXT,
      ai_instructions_encrypted TEXT,
      encryption_key_id INTEGER REFERENCES encryption_keys(id),
      payload_version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(therapist_id, client_id)
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title_ru TEXT,
      title_en TEXT,
      title_es TEXT,
      description_ru TEXT,
      description_en TEXT,
      description_es TEXT,
      instructions_ru TEXT,
      instructions_en TEXT,
      instructions_es TEXT,
      is_custom INTEGER DEFAULT 0,
      therapist_id INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'acknowledged', 'completed')),
      response_encrypted TEXT,
      encryption_key_id INTEGER REFERENCES encryption_keys(id),
      sent_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sos_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id),
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      message_encrypted TEXT,
      encryption_key_id INTEGER REFERENCES encryption_keys(id),
      status TEXT DEFAULT 'triggered' CHECK(status IN ('triggered', 'acknowledged', 'resolved')),
      created_at TEXT DEFAULT (datetime('now')),
      acknowledged_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan TEXT DEFAULT 'trial' CHECK(plan IN ('trial', 'basic', 'pro', 'premium')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'canceled', 'past_due', 'expired')),
      trial_ends_at TEXT,
      current_period_start TEXT,
      current_period_end TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
      stripe_payment_intent_id TEXT,
      amount INTEGER,
      currency TEXT DEFAULT 'usd',
      status TEXT DEFAULT 'succeeded' CHECK(status IN ('succeeded', 'failed', 'refunded')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details_encrypted TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS encryption_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_version INTEGER NOT NULL UNIQUE,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'rotated', 'retired')),
      created_at TEXT DEFAULT (datetime('now')),
      rotated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_therapist_id ON users(therapist_id);
    CREATE INDEX IF NOT EXISTS idx_diary_entries_client_id ON diary_entries(client_id);
    CREATE INDEX IF NOT EXISTS idx_diary_entries_created_at ON diary_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_therapist_notes_therapist_client ON therapist_notes(therapist_id, client_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_therapist_client ON sessions(therapist_id, client_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_therapist ON subscriptions(therapist_id);
    CREATE INDEX IF NOT EXISTS idx_exercise_deliveries_client ON exercise_deliveries(client_id);
    CREATE INDEX IF NOT EXISTS idx_sos_events_client ON sos_events(client_id);
  `);

  // Insert default platform settings
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)
  `);
  insertSetting.run('trial_duration_days', '14');
  insertSetting.run('trial_client_limit', '3');
  insertSetting.run('trial_session_limit', '5');
  insertSetting.run('basic_client_limit', '10');
  insertSetting.run('basic_session_limit', '20');
  insertSetting.run('pro_client_limit', '30');
  insertSetting.run('pro_session_limit', '60');
  insertSetting.run('basic_price_monthly', '1900');
  insertSetting.run('pro_price_monthly', '4900');
  insertSetting.run('premium_price_monthly', '9900');

  // Insert initial encryption key
  const insertKey = db.prepare(`
    INSERT OR IGNORE INTO encryption_keys (key_version, status) VALUES (?, ?)
  `);
  insertKey.run(1, 'active');

  logger.info('Database schema applied successfully');
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };
