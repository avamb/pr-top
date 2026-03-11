// Database Connection and Initialization
// Uses sql.js for SQLite database (pure JS, no native compilation needed)

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

const bcrypt = require('bcryptjs');

let db = null;
let dbPath = null;

function getDbPath() {
  const dbUrl = process.env.DATABASE_URL || 'sqlite:./data/psylink.db';
  const relativePath = dbUrl.replace('sqlite:', '');
  return path.resolve(__dirname, '../../', relativePath);
}

function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    logger.debug('Database saved to disk');
  }
}

async function initDatabase() {
  dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);

  // Ensure data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  logger.info(`Connecting to database at: ${dbPath}`);

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    logger.info('Loaded existing database from disk');
  } else {
    db = new SQL.Database();
    logger.info('Created new database');
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Run schema migrations
  applySchema(db);

  // Save after schema setup
  saveDatabase();

  // Store db reference globally for health checks
  global.db = db;

  // Set up periodic save (every 5 seconds if there are changes)
  setInterval(() => {
    saveDatabase();
  }, 5000);

  logger.info('Database connection established');
  return db;
}

function applySchema(db) {
  logger.info('Applying database schema...');

  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sos_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id),
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      message_encrypted TEXT,
      encryption_key_id INTEGER REFERENCES encryption_keys(id),
      status TEXT DEFAULT 'triggered' CHECK(status IN ('triggered', 'acknowledged', 'resolved')),
      created_at TEXT DEFAULT (datetime('now')),
      acknowledged_at TEXT
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
      stripe_payment_intent_id TEXT,
      amount INTEGER,
      currency TEXT DEFAULT 'usd',
      status TEXT DEFAULT 'succeeded' CHECK(status IN ('succeeded', 'failed', 'refunded')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details_encrypted TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS encryption_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_version INTEGER NOT NULL UNIQUE,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'rotated', 'retired')),
      created_at TEXT DEFAULT (datetime('now')),
      rotated_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add pending_plan column for scheduled downgrades (migration)
  try {
    db.run('ALTER TABLE subscriptions ADD COLUMN pending_plan TEXT');
    logger.info('Added pending_plan column to subscriptions');
  } catch (e) {
    // Column already exists, ignore
  }

  // Add escalation_preferences column for SOS notification preferences (migration)
  try {
    db.run("ALTER TABLE users ADD COLUMN escalation_preferences TEXT DEFAULT '{}'");
    logger.info('Added escalation_preferences column to users');
  } catch (e) {
    // Column already exists, ignore
  }

  // Create indexes for performance
  db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_therapist_id ON users(therapist_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_diary_entries_client_id ON diary_entries(client_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_diary_entries_created_at ON diary_entries(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_therapist_notes_therapist_client ON therapist_notes(therapist_id, client_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_therapist_client ON sessions(therapist_id, client_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_therapist ON subscriptions(therapist_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_exercise_deliveries_client ON exercise_deliveries(client_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sos_events_client ON sos_events(client_id)');

  // Insert default platform settings
  const defaultSettings = [
    ['trial_duration_days', '14'],
    ['trial_client_limit', '3'],
    ['trial_session_limit', '5'],
    ['basic_client_limit', '10'],
    ['basic_session_limit', '20'],
    ['pro_client_limit', '30'],
    ['pro_session_limit', '60'],
    ['basic_price_monthly', '1900'],
    ['pro_price_monthly', '4900'],
    ['premium_price_monthly', '9900'],
  ];

  for (const [key, value] of defaultSettings) {
    db.run('INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)', [key, value]);
  }

  // Insert initial encryption key
  db.run('INSERT OR IGNORE INTO encryption_keys (key_version, status) VALUES (?, ?)', [1, 'active']);

  // Seed default superadmin account if not exists
  seedSuperadmin(db);

  logger.info('Database schema applied successfully');
}

function seedSuperadmin(db) {
  const email = process.env.SUPERADMIN_EMAIL || 'admin@psylink.app';
  const password = process.env.SUPERADMIN_PASSWORD || 'Admin123!';

  // Check if superadmin already exists
  const existing = db.exec("SELECT id FROM users WHERE role = 'superadmin' AND email = ?", [email]);
  if (existing.length > 0 && existing[0].values.length > 0) {
    logger.debug('Superadmin account already exists');
    return;
  }

  // Hash password synchronously for seed (bcryptjs supports sync)
  const passwordHash = bcrypt.hashSync(password, 12);

  db.run(
    "INSERT OR IGNORE INTO users (email, password_hash, role, language) VALUES (?, ?, 'superadmin', 'en')",
    [email, passwordHash]
  );

  logger.info(`Superadmin account seeded: ${email}`);
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDatabase, saveDatabase };
