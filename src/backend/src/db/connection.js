// Database Connection and Initialization
// Uses sql.js for SQLite database (pure JS, no native compilation needed)

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

const bcrypt = require('bcryptjs');

let db = null;
let dbPath = null;
let dbDirty = false;

function getDbPath() {
  const dbUrl = process.env.DATABASE_URL || 'sqlite:./data/prtop.db';
  const relativePath = dbUrl.replace('sqlite:', '');
  return path.resolve(__dirname, '../../', relativePath);
}

// Mark database as having unsaved changes. Call this after any write operation
// to ensure the next saveDatabase() will VACUUM before export.
function markDirty() {
  dbDirty = true;
}

function saveDatabase() {
  if (db && dbPath) {
    try {
      // In sql.js, db.run() modifies SQLite's in-memory page structures, but
      // db.export() may return the stale original binary representation unless
      // the database is compacted first. VACUUM forces SQLite to rebuild the
      // database file from scratch, ensuring db.export() returns all current data.
      //
      // IMPORTANT: We must ONLY write to disk when there are actual changes
      // (dbDirty is true). Without VACUUM, db.export() returns stale data,
      // so a non-dirty save would overwrite valid data with an older snapshot.
      if (!dbDirty) {
        return; // No changes to save — skip to avoid overwriting with stale export
      }
      try {
        db.run('VACUUM');
      } catch (e) {
        // VACUUM may fail if in a transaction; fall back to a checkpoint attempt
        try { db.run('PRAGMA wal_checkpoint(FULL)'); } catch (e2) { /* ignore */ }
      }
      dbDirty = false;
      const data = db.export();
      const buffer = Buffer.from(data);
      // Write directly and fsync to ensure data is flushed to disk
      const fd = fs.openSync(dbPath, 'w');
      fs.writeSync(fd, buffer, 0, buffer.length);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      logger.debug('Database saved to disk (' + buffer.length + ' bytes)');
    } catch (err) {
      logger.error('Failed to save database: ' + err.message);
    }
  }
}

// Wrapper that marks the database as dirty before saving.
// Call this after any write operation (INSERT, UPDATE, DELETE) to ensure
// the next save includes all changes via VACUUM.
function saveDatabaseAfterWrite() {
  dbDirty = true;
  saveDatabase();
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

  // Run schema migrations (these modify the DB, so mark dirty)
  applySchema(db);
  dbDirty = true;

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
      email TEXT UNIQUE COLLATE NOCASE,
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

  db.run(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)');
  db.run('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id)');

  // AI usage logging table
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      timestamp TEXT DEFAULT (datetime('now')),
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      operation TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      session_id INTEGER,
      metadata TEXT
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_ai_usage_log_therapist ON ai_usage_log(therapist_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ai_usage_log_timestamp ON ai_usage_log(timestamp)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ai_usage_log_model ON ai_usage_log(model)');

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

  // Add Ukrainian language columns to exercises table (migration)
  try {
    db.run('ALTER TABLE exercises ADD COLUMN title_uk TEXT');
    logger.info('Added title_uk column to exercises');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE exercises ADD COLUMN description_uk TEXT');
    logger.info('Added description_uk column to exercises');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE exercises ADD COLUMN instructions_uk TEXT');
    logger.info('Added instructions_uk column to exercises');
  } catch (e) {
    // Column already exists, ignore
  }

  // Backfill Ukrainian translations for existing seed exercises
  try {
    const ukCheck = db.exec("SELECT COUNT(*) FROM exercises WHERE title_uk IS NOT NULL AND is_custom = 0");
    if (ukCheck.length && ukCheck[0].values[0][0] === 0) {
      const ukTranslations = [
        { en: 'Diaphragmatic Breathing', title: 'Діафрагмальне дихання', desc: 'Техніка глибокого дихання для зниження тривожності', instr: '1. Сядьте зручно\n2. Покладіть руку на живіт\n3. Вдихніть через ніс на 4 рахунки\n4. Затримайте дихання на 4 рахунки\n5. Видихніть через рот на 6 рахунків\n6. Повторіть 5-10 разів' },
        { en: 'Progressive Muscle Relaxation', title: 'Прогресивна м\'язова релаксація', desc: 'Послідовне напруження і розслаблення груп м\'язів', instr: '1. Почніть з м\'язів стоп\n2. Напружте на 5 секунд\n3. Розслабте на 10 секунд\n4. Просувайтесь вгору по тілу\n5. Завершіть м\'язами обличчя' },
        { en: '4-7-8 Breathing', title: 'Дихання 4-7-8', desc: 'Техніка дихання для швидкого засинання та заспокоєння', instr: '1. Вдихніть через ніс на 4 рахунки\n2. Затримайте дихання на 7 рахунків\n3. Видихніть через рот на 8 рахунків\n4. Повторіть 3-4 цикли' },
        { en: 'Body Scan Meditation', title: 'Сканування тіла', desc: 'Медитація усвідомленості для розвитку зв\'язку з тілом', instr: '1. Лягте зручно\n2. Закрийте очі\n3. Спрямуйте увагу на маківку\n4. Повільно переміщуйте увагу вниз по тілу\n5. Відмічайте відчуття без оцінки\n6. Приділіть 15-20 хвилин' },
        { en: '5-4-3-2-1 Grounding', title: 'Техніка 5-4-3-2-1', desc: 'Техніка заземлення через п\'ять відчуттів', instr: '1. Назвіть 5 речей, які бачите\n2. Назвіть 4 речі, які можете торкнути\n3. Назвіть 3 звуки, які чуєте\n4. Назвіть 2 запахи\n5. Назвіть 1 смак' },
        { en: 'Mindful Observation', title: 'Усвідомлене спостереження', desc: 'Практика усвідомленої уваги до навколишнього світу', instr: '1. Оберіть об\'єкт в оточенні\n2. Спостерігайте його 2 хвилини\n3. Відмітьте колір, текстуру, форму\n4. Відмітьте свої думки та почуття\n5. Поверніться до спостереження' },
        { en: 'Thought Record', title: 'Щоденник думок', desc: 'Запис та аналіз автоматичних думок за методом КПТ', instr: '1. Опишіть ситуацію\n2. Запишіть автоматичну думку\n3. Визначте емоцію (0-100%)\n4. Знайдіть когнітивне спотворення\n5. Сформулюйте альтернативну думку\n6. Переоцініть емоцію' },
        { en: 'Cognitive Reframing', title: 'Рефреймінг', desc: 'Техніка зміни перспективи на негативні події', instr: '1. Запишіть негативну ситуацію\n2. Визначте свою інтерпретацію\n3. Задайте питання: "Які ще пояснення можливі?"\n4. Запишіть 3 альтернативні інтерпретації\n5. Оберіть найбільш реалістичну' },
        { en: 'Evidence Examination', title: 'Аналіз доказів', desc: 'Перевірка негативних переконань через збір доказів', instr: '1. Запишіть переконання\n2. Зберіть докази ЗА\n3. Зберіть докази ПРОТИ\n4. Оцініть об\'єктивно\n5. Сформулюйте збалансоване переконання' },
        { en: 'Gratitude Journal', title: 'Щоденник вдячності', desc: 'Щоденна практика запису того, за що ви вдячні', instr: '1. Щовечора запишіть 3 речі\n2. За що ви вдячні сьогодні\n3. Будьте конкретні\n4. Поясніть чому це важливо\n5. Перечитайте за тиждень' },
        { en: 'Free Writing', title: 'Вільне письмо', desc: 'Безперервне письмо без цензури для самовираження', instr: '1. Встановіть таймер на 10 хвилин\n2. Пишіть без зупинки\n3. Не редагуйте і не перечитуйте\n4. Пишіть все, що спадає на думку\n5. По закінченні відмітьте ключові теми' },
        { en: 'Letter to Self', title: 'Лист до себе', desc: 'Написання співчутливого листа самому собі', instr: '1. Уявіть, що пишете другу\n2. Зверніться до себе з теплотою\n3. Визнайте свої труднощі\n4. Напишіть слова підтримки\n5. Завершіть добрим побажанням' },
        { en: 'Behavioral Activation', title: 'Поведінкова активація', desc: 'Планування приємних та значущих активностей', instr: '1. Складіть список приємних активностей\n2. Оцініть кожну за задоволенням (1-10)\n3. Оцініть за значущістю (1-10)\n4. Заплануйте 1-2 активності на день\n5. Після виконання оцініть настрій' },
        { en: 'Exposure Hierarchy', title: 'Експозиційні сходи', desc: 'Поступове наближення до лякаючих ситуацій', instr: '1. Визначте страх\n2. Створіть список ситуацій (від легкої до складної)\n3. Оцініть кожну за тривогою (0-100)\n4. Почніть з найлегшої\n5. Практикуйте до зниження тривоги на 50%' },
        { en: 'Habit Tracking', title: 'Відстеження звичок', desc: 'Систематичне відстеження формування нових звичок', instr: '1. Оберіть одну звичку для формування\n2. Визначте тригер (після чого ви це робите)\n3. Визначте нагороду\n4. Відмічайте кожен день виконання\n5. Прагніть до 21-денної серії' },
        { en: 'Self-Compassion Break', title: 'Самоспівчуття', desc: 'Коротка практика самоспівчуття у важкі моменти', instr: '1. Визнайте: "Зараз мені важко"\n2. Нагадайте: "Всі люди переживають труднощі"\n3. Покладіть руку на серце\n4. Скажіть: "Нехай я буду добрим до себе"\n5. Дихайте спокійно 1 хвилину' },
      ];
      for (const t of ukTranslations) {
        db.run("UPDATE exercises SET title_uk = ?, description_uk = ?, instructions_uk = ? WHERE title_en = ? AND is_custom = 0", [t.title, t.desc, t.instr, t.en]);
      }
      logger.info('Backfilled Ukrainian translations for seed exercises');
    }
  } catch (e) {
    logger.warn('Ukrainian backfill migration skipped: ' + e.message);
  }

  // Add profile fields to users table (migration)
  try {
    db.run('ALTER TABLE users ADD COLUMN first_name TEXT');
    logger.info('Added first_name column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE users ADD COLUMN last_name TEXT');
    logger.info('Added last_name column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE users ADD COLUMN phone TEXT');
    logger.info('Added phone column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE users ADD COLUMN telegram_username TEXT');
    logger.info('Added telegram_username column to users');
  } catch (e) {
    // Column already exists, ignore
  }

  // Add canceled_at column to subscriptions (migration)
  try {
    db.run('ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT');
    logger.info('Added canceled_at column to subscriptions');
  } catch (e) {
    // Column already exists, ignore
  }

  // Add manual plan override columns to subscriptions (migration)
  try {
    db.run('ALTER TABLE subscriptions ADD COLUMN is_manual_override INTEGER DEFAULT 0');
    logger.info('Added is_manual_override column to subscriptions');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE subscriptions ADD COLUMN override_reason TEXT');
    logger.info('Added override_reason column to subscriptions');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE subscriptions ADD COLUMN override_expires_at TEXT');
    logger.info('Added override_expires_at column to subscriptions');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE subscriptions ADD COLUMN override_set_by INTEGER');
    logger.info('Added override_set_by column to subscriptions');
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    db.run('ALTER TABLE users ADD COLUMN other_info TEXT');
    logger.info('Added other_info column to users');
  } catch (e) {
    // Column already exists, ignore
  }

  // Add audio_file_ref column to diary_entries for local encrypted voice/video files (migration)
  try {
    db.run('ALTER TABLE diary_entries ADD COLUMN audio_file_ref TEXT');
    logger.info('Added audio_file_ref column to diary_entries');
  } catch (e) {
    // Column already exists, ignore
  }

  // Add transcription_status column to diary_entries for tracking STT processing state (migration)
  // Default is NULL (text entries don't need transcription); voice/video entries get 'pending' explicitly on INSERT
  try {
    db.run("ALTER TABLE diary_entries ADD COLUMN transcription_status TEXT DEFAULT NULL CHECK(transcription_status IS NULL OR transcription_status IN ('pending', 'processing', 'completed', 'failed'))");
    logger.info('Added transcription_status column to diary_entries');
    // Set transcription_status for existing entries based on whether transcript exists
    db.run("UPDATE diary_entries SET transcription_status = 'completed' WHERE transcript_encrypted IS NOT NULL AND entry_type IN ('voice', 'video')");
    db.run("UPDATE diary_entries SET transcription_status = 'pending' WHERE transcript_encrypted IS NULL AND entry_type IN ('voice', 'video')");
    // Text entries stay NULL (no transcription needed)
  } catch (e) {
    // Column already exists, ignore
  }

  // Normalize existing emails to lowercase (migration for case-insensitive matching)
  try {
    const mixedCaseResult = db.exec("SELECT COUNT(*) FROM users WHERE email != LOWER(email)");
    if (mixedCaseResult.length > 0 && mixedCaseResult[0].values[0][0] > 0) {
      db.run("UPDATE users SET email = LOWER(email) WHERE email != LOWER(email)");
      logger.info('Normalized existing emails to lowercase');
    }
  } catch (e) {
    logger.warn('Email normalization migration skipped: ' + e.message);
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
    ['ai_summarization_provider', 'openai'],
    ['ai_summarization_model', 'gpt-4o-mini'],
    ['ai_transcription_provider', 'openai'],
    ['ai_transcription_model', 'whisper-1'],
    ['ai_monthly_limit_usd', '0'],
    ['ai_limit_warning_percent', '80'],
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
  const email = process.env.SUPERADMIN_EMAIL || 'admin@pr-top.com';
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

module.exports = { initDatabase, getDatabase, saveDatabase, saveDatabaseAfterWrite };
