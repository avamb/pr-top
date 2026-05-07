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
        logger.debug('saveDatabase: skipping (no dirty changes)');
        return; // No changes to save — skip to avoid overwriting with stale export
      }
      logger.debug('saveDatabase: dirty flag set, performing VACUUM + save');
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
      role TEXT NOT NULL CHECK(role IN ('therapist', 'client', 'superadmin', 'viewer')),
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

  // T-13: Add is_template column to exercises table (migration)
  // Marks pre-seeded library exercises as "templates / examples of formatting"
  // so the UI can show a "Template/Пример" badge and avoid presenting them as
  // PR-TOP-authored exercises (interview: misha_drozd_2026-04-19, lines 410-484).
  try {
    db.run('ALTER TABLE exercises ADD COLUMN is_template INTEGER DEFAULT 0');
    logger.info('Added is_template column to exercises');
  } catch (e) {
    // Column already exists, ignore
  }

  // Backfill is_template: every seeded (is_custom=0) row is a template,
  // custom exercises (is_custom=1) authored by therapists are not templates.
  // Idempotent — only updates rows whose is_template does not already match.
  try {
    db.run('UPDATE exercises SET is_template = 1 WHERE is_custom = 0 AND (is_template IS NULL OR is_template != 1)');
    db.run('UPDATE exercises SET is_template = 0 WHERE is_custom = 1 AND (is_template IS NULL OR is_template != 0)');
  } catch (e) {
    logger.warn('is_template backfill skipped: ' + e.message);
  }

  // T-16: Optional between-session reminders (off by default for new therapists)
  // Interview: alexey_*_2026-04-* lines 745-758 — psychoanalysis does not use
  // between-session reminders. Reminders are now per-therapist + per-client opt-in.
  // - therapists.reminders_enabled_default: master toggle for the therapist (default 0)
  //   New therapists start with reminders OFF.
  // - clients.reminders_enabled: nullable per-client override.
  //   NULL = inherit therapist's default; 0 = force off; 1 = force on.
  // Backward compat: existing therapists (created before this migration) get 1
  //   so their already-running diary reminders keep working.
  let _addedRemindersDefaultColumn = false;
  try {
    db.run('ALTER TABLE users ADD COLUMN reminders_enabled_default INTEGER DEFAULT 0');
    logger.info('Added reminders_enabled_default column to users');
    _addedRemindersDefaultColumn = true;
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE users ADD COLUMN reminders_enabled INTEGER DEFAULT NULL');
    logger.info('Added reminders_enabled column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  // Backward-compat backfill: only run on the very first migration pass so we
  // do not retroactively re-enable a therapist who has explicitly turned the
  // toggle off. Once the column exists, the application owns the value.
  if (_addedRemindersDefaultColumn) {
    try {
      db.run("UPDATE users SET reminders_enabled_default = 1 WHERE role = 'therapist'");
      logger.info('Backfilled reminders_enabled_default=1 for existing therapists');
    } catch (e) {
      logger.warn('reminders_enabled_default backfill skipped: ' + e.message);
    }
  }

  // T-14: Exercise library content cleanup (#372)
  // Interview misha_drozd_2026-04-19 lines 410-533: Marina flagged "Cognitive
  // Reframing" as too generic — "you could call 100 different exercises
  // 'reframing'" — and the steps relied on "think and invent alternatives",
  // which is therapy work the client cannot do alone. Etalon (good) is "Habit
  // Tracking": concrete trigger/reward/streak. T-14 removes the bad card and
  // tightens two more cards with citable, concrete protocols.
  //
  // For existing DBs: seedDefaultExercises() only runs on an empty exercises
  // table, so we need an idempotent in-place migration to bring already-seeded
  // rows up to date. Each branch detects the OLD content signature, only acts
  // if it finds it, and is therefore safe to re-run on every backend boot.
  try {
    // Sub-step 1: tighten 4-7-8 Breathing per Andrew Weil's protocol.
    // Detect old version by the trailing "Repeat 3-4 cycles" instruction.
    const old478 = db.exec(
      "SELECT id FROM exercises WHERE is_custom = 0 AND title_en = '4-7-8 Breathing' AND instructions_en LIKE '%Repeat 3-4 cycles%'"
    );
    if (old478.length && old478[0].values.length) {
      db.run(
        `UPDATE exercises SET
           description_ru = ?, description_en = ?, description_es = ?, description_uk = ?,
           instructions_ru = ?, instructions_en = ?, instructions_es = ?, instructions_uk = ?,
           updated_at = datetime('now')
         WHERE is_custom = 0 AND title_en = '4-7-8 Breathing'`,
        [
          'Техника дыхания для быстрого засыпания и успокоения (по Эндрю Вейлу)',
          'Breathing pattern for quick relaxation and sleep aid (Andrew Weil protocol)',
          'Patron de respiracion para relajacion rapida (protocolo de Andrew Weil)',
          'Техніка дихання для швидкого засинання та заспокоєння (за Ендрю Вейлом)',
          '1. Сядьте прямо, кончик языка прижмите к нёбу за верхними зубами\n2. Полностью выдохните через рот со звуком "хуу"\n3. Закройте рот, вдохните через нос на 4 счёта\n4. Задержите дыхание на 7 счётов\n5. Выдохните через рот со звуком "хуу" на 8 счётов\n6. Повторите цикл 4 раза; делайте 1-2 раза в день',
          '1. Sit upright with back straight; rest tongue tip behind upper teeth\n2. Exhale fully through mouth, making a soft "whoosh" sound\n3. Close mouth; inhale silently through nose for 4 counts\n4. Hold breath for 7 counts\n5. Exhale through mouth (whoosh) for 8 counts\n6. Repeat the cycle 4 times; do once or twice per day',
          '1. Sientese erguido; coloque la punta de la lengua detras de los dientes superiores\n2. Exhale completamente por la boca con un sonido suave "fff"\n3. Cierre la boca; inhale por la nariz durante 4 tiempos\n4. Mantenga la respiracion durante 7 tiempos\n5. Exhale por la boca (sonido "fff") durante 8 tiempos\n6. Repita el ciclo 4 veces; hagalo 1-2 veces al dia',
          '1. Сядьте рівно, кінчик язика притисніть до піднебіння за верхніми зубами\n2. Повністю видихніть через рот зі звуком "хуу"\n3. Закрийте рот, вдихніть через ніс на 4 рахунки\n4. Затримайте дихання на 7 рахунків\n5. Видихніть через рот зі звуком "хуу" на 8 рахунків\n6. Повторіть цикл 4 рази; робіть 1-2 рази на день',
        ]
      );
      logger.info('T-14: rewrote 4-7-8 Breathing with Andrew Weil protocol (6 concrete steps + frequency)');
    }

    // Sub-step 2: tighten Evidence Examination per Beck (1979) dispute prompts.
    // Detect old version by the vague "Evaluate objectively" instruction.
    const oldEvidence = db.exec(
      "SELECT id FROM exercises WHERE is_custom = 0 AND title_en = 'Evidence Examination' AND instructions_en LIKE '%Evaluate objectively%'"
    );
    if (oldEvidence.length && oldEvidence[0].values.length) {
      db.run(
        `UPDATE exercises SET
           description_ru = ?, description_en = ?, description_es = ?, description_uk = ?,
           instructions_ru = ?, instructions_en = ?, instructions_es = ?, instructions_uk = ?,
           updated_at = datetime('now')
         WHERE is_custom = 0 AND title_en = 'Evidence Examination'`,
        [
          'Проверка негативного убеждения через структурированный сбор фактов и переоценку (КПТ, по А. Беку)',
          'Test a negative belief with a structured fact-gathering worksheet and re-rating (CBT, Beck 1979)',
          'Probar una creencia negativa con una hoja estructurada de hechos y reevaluacion (TCC, Beck 1979)',
          'Перевірка негативного переконання через структурований збір фактів та переоцінку (КПТ, за А. Беком)',
          '1. Запишите убеждение одним предложением (например, "Я всегда проваливаю всё")\n2. Оцените, насколько вы в это верите сейчас (0-100%)\n3. Запишите 3 факта ЗА это убеждение, с датой и местом\n4. Запишите 3 факта ПРОТИВ этого убеждения, с датой и местом\n5. Письменно ответьте: "Что бы я сказал другу с таким же убеждением?"\n6. Сформулируйте сбалансированное утверждение по шаблону "Иногда происходит X, но также верно Y"\n7. Снова оцените веру в исходное убеждение (0-100%)',
          '1. Write the belief in one sentence (e.g., "I always fail at everything")\n2. Rate how much you believe it now (0-100%)\n3. List 3 facts that SUPPORT the belief, with date and place\n4. List 3 facts that CONTRADICT the belief, with date and place\n5. Answer in writing: "If a friend told me this belief, what would I say to them?"\n6. Write a balanced statement using the template "Sometimes X happens, but Y is also true"\n7. Re-rate how much you believe the original belief (0-100%)',
          '1. Escriba la creencia en una oracion (por ej., "Siempre fracaso en todo")\n2. Califique cuanto la cree ahora (0-100%)\n3. Liste 3 hechos que APOYAN la creencia, con fecha y lugar\n4. Liste 3 hechos que CONTRADICEN la creencia, con fecha y lugar\n5. Responda por escrito: "Que le diria a un amigo con esta misma creencia?"\n6. Escriba una afirmacion equilibrada con la formula "A veces ocurre X, pero tambien es cierto que Y"\n7. Vuelva a calificar cuanto cree la afirmacion original (0-100%)',
          '1. Запишіть переконання одним реченням (наприклад, "Я завжди все провалюю")\n2. Оцініть, наскільки ви в це вірите зараз (0-100%)\n3. Запишіть 3 факти ЗА це переконання, з датою та місцем\n4. Запишіть 3 факти ПРОТИ цього переконання, з датою та місцем\n5. Письмово дайте відповідь: "Що я сказав би другові з таким же переконанням?"\n6. Сформулюйте збалансоване твердження за шаблоном "Іноді трапляється X, але також правда, що Y"\n7. Знову оцініть віру у вихідне переконання (0-100%)',
        ]
      );
      logger.info('T-14: rewrote Evidence Examination with concrete dispute prompts (Beck 1979)');
    }

    // Sub-step 3: remove Cognitive Reframing — Marina explicitly rejected it
    // ("слишком общая штука, и она не рабочая"). Only delete if no deliveries
    // reference it, otherwise existing client-facing assignments would be
    // orphaned. If deliveries exist, log a warning so an admin can decide.
    const reframingRows = db.exec(
      "SELECT id FROM exercises WHERE is_custom = 0 AND title_en = 'Cognitive Reframing'"
    );
    if (reframingRows.length && reframingRows[0].values.length) {
      const reframingId = reframingRows[0].values[0][0];
      const deliveryCheck = db.exec(
        "SELECT COUNT(*) FROM exercise_deliveries WHERE exercise_id = ?",
        [reframingId]
      );
      const deliveryCount = deliveryCheck.length ? deliveryCheck[0].values[0][0] : 0;
      if (deliveryCount === 0) {
        db.run('DELETE FROM exercises WHERE id = ?', [reframingId]);
        logger.info(`T-14: removed seeded Cognitive Reframing exercise (id=${reframingId}) — too generic per Marina's review`);
      } else {
        logger.warn(`T-14: kept Cognitive Reframing (id=${reframingId}) — has ${deliveryCount} delivery rows; manual cleanup needed before retiring`);
      }
    }
  } catch (e) {
    logger.warn('T-14 exercise content cleanup skipped: ' + e.message);
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

  // Add stripe_payment_method_id column to subscriptions for SetupIntent flow (migration)
  try {
    db.run('ALTER TABLE subscriptions ADD COLUMN stripe_payment_method_id TEXT');
    logger.info('Added stripe_payment_method_id column to subscriptions');
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

  // Migration: Add 'viewer' role to users table CHECK constraint
  // SQLite doesn't support ALTER CHECK, so we recreate the table
  try {
    const checkInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    if (checkInfo.length > 0 && checkInfo[0].values.length > 0) {
      const createSql = checkInfo[0].values[0][0];
      if (createSql && !createSql.includes("'viewer'")) {
        logger.info('Migrating users table to add viewer role...');
        db.run('PRAGMA foreign_keys = OFF');
        // Drop leftover temp table from any previous failed migration attempt
        try { db.run('DROP TABLE IF EXISTS users_new'); } catch (e2) { /* ignore */ }
        db.run(`CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id TEXT UNIQUE,
          email TEXT UNIQUE,
          password_hash TEXT,
          role TEXT NOT NULL CHECK(role IN ('therapist', 'client', 'superadmin', 'viewer')),
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
          utm_term TEXT,
          escalation_preferences TEXT DEFAULT '{}',
          first_name TEXT,
          last_name TEXT,
          phone TEXT,
          telegram_username TEXT,
          other_info TEXT,
          referred_by INTEGER REFERENCES users(id),
          referral_code TEXT UNIQUE
        )`);
        db.run(`INSERT INTO users_new SELECT
          id, telegram_id, email, password_hash, role, therapist_id,
          consent_therapist_access, invite_code, language, timezone,
          created_at, updated_at, blocked_at,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          escalation_preferences, first_name, last_name, phone, telegram_username, other_info,
          referred_by, referral_code
        FROM users`);
        db.run('DROP TABLE users');
        db.run('ALTER TABLE users_new RENAME TO users');
        // Recreate indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_therapist_id ON users(therapist_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)');
        db.run('PRAGMA foreign_keys = ON');
        logger.info('Users table migrated to include viewer role');
      }
    }
  } catch (e) {
    logger.warn('Viewer role migration skipped: ' + e.message);
  }

  // Create assistant_chats table for therapist-assistant chat history
  db.run(`CREATE TABLE IF NOT EXISTS assistant_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    messages TEXT NOT NULL DEFAULT '[]',
    page_context TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Add deleted_at column for soft-delete support
  try {
    db.run('ALTER TABLE assistant_chats ADD COLUMN deleted_at TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists
  }

  // Add title column for auto-generated conversation titles
  try {
    db.run('ALTER TABLE assistant_chats ADD COLUMN title TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists
  }

  // Add archived_at column for auto-archive support
  try {
    db.run('ALTER TABLE assistant_chats ADD COLUMN archived_at TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists
  }

  // Create assistant_cached_answers table for self-learning cache
  db.run(`CREATE TABLE IF NOT EXISTS assistant_cached_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_embedding TEXT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    has_rag_context INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Add has_rag_context column if missing (migration for existing databases)
  try {
    db.run('ALTER TABLE assistant_cached_answers ADD COLUMN has_rag_context INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists
  }

  // Create assistant_knowledge table for knowledge base indexing
  db.run(`CREATE TABLE IF NOT EXISTS assistant_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_type TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

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
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_chats_therapist_updated ON assistant_chats(therapist_id, updated_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_cached_answers_usage ON assistant_cached_answers(usage_count DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_source ON assistant_knowledge(source_file)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_type ON assistant_knowledge(source_type)');

  // Create assistant_conversations table for analytics-grade chat tracking
  db.run(`CREATE TABLE IF NOT EXISTS assistant_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    started_at TEXT DEFAULT (datetime('now')),
    last_message_at TEXT DEFAULT (datetime('now')),
    page_context TEXT,
    language TEXT DEFAULT 'en',
    message_count INTEGER DEFAULT 0
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_conversations_therapist ON assistant_conversations(therapist_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_conversations_started ON assistant_conversations(started_at DESC)');

  // Create assistant_messages table for individual message tracking
  db.run(`CREATE TABLE IF NOT EXISTS assistant_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES assistant_conversations(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    is_cached INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    tags TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation ON assistant_messages(conversation_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_messages_created ON assistant_messages(created_at DESC)');

  // Create assistant_admin_comments table for superadmin feedback on assistant responses
  db.run(`CREATE TABLE IF NOT EXISTS assistant_admin_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES assistant_messages(id),
    admin_id INTEGER NOT NULL REFERENCES users(id),
    comment_text TEXT,
    rating TEXT CHECK(rating IN ('good', 'bad', 'neutral')),
    correction_text TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_admin_comments_message ON assistant_admin_comments(message_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_admin_comments_admin ON assistant_admin_comments(admin_id)');

  // Create assistant_feedback_prompts table for tracking proactive feature request prompts
  db.run(`CREATE TABLE IF NOT EXISTS assistant_feedback_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    last_prompted_at TEXT DEFAULT (datetime('now')),
    prompt_count INTEGER DEFAULT 1,
    UNIQUE(therapist_id)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_feedback_prompts_therapist ON assistant_feedback_prompts(therapist_id)');

  // Create viewer_sessions table for anonymous landing-page chat sessions
  db.run(`CREATE TABLE IF NOT EXISTS viewer_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    ip TEXT,
    fingerprint TEXT,
    user_agent TEXT,
    language TEXT DEFAULT 'en',
    created_at TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now')),
    message_count INTEGER DEFAULT 0,
    email TEXT DEFAULT NULL,
    user_id INTEGER DEFAULT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_viewer_sessions_uuid ON viewer_sessions(uuid)');
  db.run('CREATE INDEX IF NOT EXISTS idx_viewer_sessions_ip ON viewer_sessions(ip)');

  // Migration: add user_id column to viewer_sessions if missing
  try {
    const vsColCheck = db.exec("PRAGMA table_info(viewer_sessions)");
    if (vsColCheck.length > 0) {
      const cols = vsColCheck[0].values.map(r => r[1]);
      if (!cols.includes('user_id')) {
        db.run('ALTER TABLE viewer_sessions ADD COLUMN user_id INTEGER DEFAULT NULL');
        logger.info('[DB] Added user_id column to viewer_sessions');
      }
    }
  } catch (e) {
    // Column may already exist
  }

  // Create leads table for landing page chat lead capture
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    session_uuid TEXT,
    language TEXT DEFAULT 'en',
    source TEXT DEFAULT 'landing_chat',
    verified INTEGER DEFAULT 0,
    verification_token TEXT,
    token_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now')),
    message_count INTEGER DEFAULT 0,
    extra_messages_limit INTEGER DEFAULT 10,
    conversation_id INTEGER,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_leads_session_uuid ON leads(session_uuid)');
  db.run('CREATE INDEX IF NOT EXISTS idx_leads_verification_token ON leads(verification_token)');

  // Create newsletter_subscribers table for email newsletter subscriptions
  db.run(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    language TEXT DEFAULT 'en',
    confirmed INTEGER DEFAULT 0,
    confirm_token TEXT,
    confirmed_at TEXT,
    unsubscribed_at TEXT,
    source TEXT DEFAULT 'landing',
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_newsletter_token ON newsletter_subscribers(confirm_token)');

  // Create promo_codes table for promotional/discount codes
  db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    plan TEXT NOT NULL CHECK(plan IN ('basic', 'pro', 'premium')),
    duration_days INTEGER NOT NULL,
    max_uses INTEGER DEFAULT NULL,
    usage_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT DEFAULT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code)');
  db.run('CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active)');

  // Create promo_redemptions table for tracking code usage
  db.run(`CREATE TABLE IF NOT EXISTS promo_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id),
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    redeemed_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'applied', 'expired'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_redemptions(promo_code_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_promo_redemptions_therapist ON promo_redemptions(therapist_id)');

  // Add referred_by column to users table (migration)
  try {
    db.run('ALTER TABLE users ADD COLUMN referred_by INTEGER REFERENCES users(id)');
    logger.info('Added referred_by column to users');
  } catch (e) {
    // Column already exists, ignore
  }

  // Add referral_code column to users table (unique referral code per therapist)
  try {
    db.run('ALTER TABLE users ADD COLUMN referral_code TEXT');
    logger.info('Added referral_code column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)');

  // Backfill referral_code for existing therapists/superadmins that don't have one
  try {
    const therapistsWithout = db.exec("SELECT id FROM users WHERE role IN ('therapist', 'superadmin') AND referral_code IS NULL");
    if (therapistsWithout.length > 0 && therapistsWithout[0].values.length > 0) {
      const crypto = require('crypto');
      for (const row of therapistsWithout[0].values) {
        const code = crypto.randomBytes(4).toString('hex'); // 8 hex chars
        db.run('UPDATE users SET referral_code = ? WHERE id = ?', [code, row[0]]);
      }
      logger.info('Backfilled referral_code for ' + therapistsWithout[0].values.length + ' existing users');
    }
  } catch (e) {
    logger.warn('Referral code backfill skipped: ' + e.message);
  }

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
    ['assistant_chat_archive_days', '90'],
    ['assistant_prompt_viewer_anonymous', ''],
    ['assistant_prompt_viewer_registered', ''],
  ];

  for (const [key, value] of defaultSettings) {
    db.run('INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)', [key, value]);
  }

  // Insert initial encryption key
  db.run('INSERT OR IGNORE INTO encryption_keys (key_version, status) VALUES (?, ?)', [1, 'active']);

  // Migration: Add 'viewer' role to users table CHECK constraint
  // SQLite doesn't support ALTER CHECK, so we recreate the table
  try {
    const checkInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    if (checkInfo.length > 0 && checkInfo[0].values.length > 0) {
      const createSql = checkInfo[0].values[0][0];
      if (createSql && !createSql.includes("'viewer'")) {
        logger.info('Migrating users table to add viewer role...');
        db.run('PRAGMA foreign_keys = OFF');
        try { db.run('DROP TABLE IF EXISTS users_new'); } catch (e2) { /* ignore */ }
        db.run(`CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id TEXT UNIQUE,
          email TEXT UNIQUE,
          password_hash TEXT,
          role TEXT NOT NULL CHECK(role IN ('therapist', 'client', 'superadmin', 'viewer')),
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
          utm_term TEXT,
          escalation_preferences TEXT DEFAULT '{}',
          first_name TEXT,
          last_name TEXT,
          phone TEXT,
          telegram_username TEXT,
          other_info TEXT,
          referred_by INTEGER REFERENCES users(id),
          referral_code TEXT UNIQUE
        )`);
        db.run(`INSERT INTO users_new SELECT
          id, telegram_id, email, password_hash, role, therapist_id,
          consent_therapist_access, invite_code, language, timezone,
          created_at, updated_at, blocked_at,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          escalation_preferences, first_name, last_name, phone, telegram_username, other_info,
          referred_by, referral_code
        FROM users`);
        db.run('DROP TABLE users');
        db.run('ALTER TABLE users_new RENAME TO users');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_therapist_id ON users(therapist_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)');
        db.run('PRAGMA foreign_keys = ON');
        logger.info('Users table migrated to include viewer role');
      }
    }
  } catch (e) {
    logger.warn('Viewer role migration skipped: ' + e.message);
  }

  // Create inquiries table — therapist-tracked client requests/work threads.
  // A client can have multiple parallel/sequential inquiries (e.g. "less reactive
  // with family", "stop procrastinating"). Sessions can be linked to inquiries.
  // title/description encrypted at app layer (Class A). Metadata is Class B.
  db.run(`CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id),
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    title_encrypted TEXT NOT NULL,
    description_encrypted TEXT,
    encryption_key_id INTEGER REFERENCES encryption_keys(id),
    payload_version INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'closed')),
    opened_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_inquiries_client ON inquiries(client_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_inquiries_therapist ON inquiries(therapist_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_inquiries_therapist_client ON inquiries(therapist_id, client_id)');

  // T-10: Polymorphic comments table — dual-comment model (private + shared).
  // Replaces the single-purpose therapist_notes table with a generalized model
  // that can attach comments to ANY entity (client, session, assignment, report,
  // exercise_completion, inquiry). Each comment has a visibility flag:
  //   - 'private' = only visible to the author
  //   - 'shared'  = visible to both therapist and client
  // content_encrypted is Class A (AES at app layer). All other fields are Class B.
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('client', 'session', 'assignment', 'assignment_report', 'exercise_completion', 'inquiry')),
    entity_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL REFERENCES users(id),
    author_role TEXT NOT NULL CHECK(author_role IN ('therapist', 'client', 'superadmin')),
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'shared')),
    content_encrypted TEXT NOT NULL,
    encryption_key_id INTEGER REFERENCES encryption_keys(id),
    payload_version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_comments_visibility ON comments(visibility)');
  db.run('CREATE INDEX IF NOT EXISTS idx_comments_entity_visibility ON comments(entity_type, entity_id, visibility)');

  // T-10: One-time migration of existing therapist_notes -> comments.
  // Each existing note becomes a private comment by the therapist on the client entity.
  // Idempotent: only runs if therapist_notes has data and we haven't migrated yet.
  try {
    const migCheck = db.exec(
      "SELECT COUNT(*) FROM comments WHERE entity_type = 'client' AND author_role = 'therapist' AND visibility = 'private'"
    );
    const alreadyMigrated = migCheck.length > 0 ? migCheck[0].values[0][0] : 0;
    const notesCheck = db.exec("SELECT COUNT(*) FROM therapist_notes");
    const noteCount = notesCheck.length > 0 ? notesCheck[0].values[0][0] : 0;
    if (noteCount > 0 && alreadyMigrated === 0) {
      logger.info(`T-10 migration: copying ${noteCount} therapist_notes -> comments`);
      db.run(`
        INSERT INTO comments (
          entity_type, entity_id, author_id, author_role, visibility,
          content_encrypted, encryption_key_id, payload_version, created_at, updated_at
        )
        SELECT
          'client', client_id, therapist_id, 'therapist', 'private',
          note_encrypted, encryption_key_id, COALESCE(payload_version, 1), created_at, updated_at
        FROM therapist_notes
      `);
      logger.info('T-10 migration: therapist_notes -> comments complete');
    }
  } catch (e) {
    logger.warn('T-10 comments migration skipped: ' + e.message);
  }

  // T-07: Optional metadata for sessions uploaded via the admin web UI.
  // - title: free-form short label shown next to the session in the timeline
  // - inquiry_id: optional link to an inquiry (T-01) so the recording attaches to a thread
  // scheduled_at already exists on the sessions table and is reused as meeting_date.
  try {
    db.run('ALTER TABLE sessions ADD COLUMN title TEXT');
    logger.info('Added title column to sessions');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE sessions ADD COLUMN inquiry_id INTEGER REFERENCES inquiries(id)');
    logger.info('Added inquiry_id column to sessions');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_sessions_inquiry ON sessions(inquiry_id)');
  } catch (e) {
    // Index already exists, ignore
  }

  // T-02: Session date-based ID + calendar.
  // Sessions are identified by meeting date (not by topic). The existing
  // `scheduled_at` column on the sessions table is reused as the canonical
  // meeting_date — it represents when the actual session took place
  // (entered by the therapist), distinct from `created_at` which records
  // when the audio was uploaded. For sessions that pre-date T-02 and don't
  // yet have scheduled_at filled in, we backfill scheduled_at = created_at
  // (one-shot; idempotent via the WHERE clause). We also add an index on
  // (client_id, scheduled_at) for the calendar widget which scans by date
  // for a single client.
  try {
    const t02Backfill = db.run(
      "UPDATE sessions SET scheduled_at = created_at WHERE scheduled_at IS NULL OR scheduled_at = ''"
    );
    if (t02Backfill && typeof t02Backfill.changes === 'number' && t02Backfill.changes > 0) {
      logger.info(`T-02: backfilled scheduled_at = created_at for ${t02Backfill.changes} sessions`);
    }
  } catch (e) {
    logger.warn('T-02 scheduled_at backfill skipped: ' + e.message);
  }
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_sessions_client_meeting ON sessions(client_id, scheduled_at)');
  } catch (e) {
    // Index already exists, ignore
  }
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_sessions_therapist_meeting ON sessions(therapist_id, scheduled_at)');
  } catch (e) {
    // Index already exists, ignore
  }

  // T-19: Single-track (therapist-only) recording.
  // When a client did not consent to being recorded but the therapist wants the
  // session AI summary to work from a Zoom recording, the upload is marked
  // recording_mode='single_track'. The system runs speaker diarization on the
  // file, the therapist confirms which detected speaker is *their* voice
  // (audio-preview of the first ~10 sec of each speaker), and ONLY that
  // speaker's audio is fed into transcription/summarization. Other speaker
  // segments are dropped — neither transcribed nor persisted to disk after
  // selection.
  //
  // Columns:
  //   - recording_mode: 'mixed' (default — both voices, original behavior) or
  //                     'single_track' (therapist-only voice, pending selection).
  //   - selected_speaker_label: the diarization label the therapist confirmed
  //     as their own voice (e.g. 'speaker_0'). NULL until selected.
  //   - speaker_segments_json: JSON array describing each detected speaker:
  //       [{ label, total_sec, segments: [{start_sec, end_sec}, ...],
  //          preview_start_sec, preview_end_sec }, ...]
  //     Cleared (set to NULL) after the therapist picks a speaker, so the
  //     other-speaker timing data is not retained on disk.
  //
  // Status flow for single_track:
  //   pending  →  diarizing  →  awaiting_speaker_selection  →
  //   transcribing  →  summarizing  →  complete
  // (Existing 'mixed' flow: pending → transcribing → complete is unchanged.)
  try {
    db.run("ALTER TABLE sessions ADD COLUMN recording_mode TEXT DEFAULT 'mixed'");
    logger.info('Added recording_mode column to sessions');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE sessions ADD COLUMN selected_speaker_label TEXT');
    logger.info('Added selected_speaker_label column to sessions');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE sessions ADD COLUMN speaker_segments_json TEXT');
    logger.info('Added speaker_segments_json column to sessions');
  } catch (e) {
    // Column already exists, ignore
  }
  // Backfill recording_mode='mixed' for any existing rows where the column
  // was just added (NULL after ALTER). Idempotent — only touches NULL rows.
  try {
    const r = db.run("UPDATE sessions SET recording_mode = 'mixed' WHERE recording_mode IS NULL");
    if (r && typeof r.changes === 'number' && r.changes > 0) {
      logger.info(`T-19: backfilled recording_mode='mixed' for ${r.changes} sessions`);
    }
  } catch (e) {
    logger.warn('T-19 recording_mode backfill skipped: ' + e.message);
  }

  // T-19 status migration. The original sessions.status CHECK constraint only
  // allowed ('pending','transcribing','summarizing','complete','failed'). Single-
  // track flow needs 'diarizing','awaiting_speaker_selection','diarization_failed',
  // 'transcription_failed' on top. SQLite can't ALTER an existing CHECK, so when
  // we detect the legacy constraint we rebuild the table with a relaxed one
  // (TEXT, no CHECK at all — application code is the source of truth for valid
  // statuses going forward; the pre-existing values are preserved verbatim).
  try {
    const meta = db.exec(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions'"
    );
    const ddl = (meta.length > 0 && meta[0].values.length > 0) ? (meta[0].values[0][0] || '') : '';
    const hasLegacyCheck = /CHECK\s*\(\s*status\s+IN\s*\(\s*'pending',\s*'transcribing',\s*'summarizing',\s*'complete',\s*'failed'\s*\)\s*\)/i.test(ddl);
    if (hasLegacyCheck) {
      logger.info('T-19: rebuilding sessions table to relax legacy status CHECK constraint');
      // Pull every existing column from the live table so we don't drop user data.
      const colsRes = db.exec("PRAGMA table_info('sessions')");
      const cols = (colsRes.length > 0 ? colsRes[0].values : [])
        .map(r => ({ name: r[1], type: r[2] || 'TEXT', notnull: r[3], dflt: r[4], pk: r[5] }));
      const colNames = cols.map(c => c.name);
      // Build a column DDL that keeps the original PK + types and the existing
      // FK references; we drop only the legacy CHECK from `status`.
      function renderDefault(d) {
        if (d === null || d === undefined) return '';
        const s = String(d);
        // PRAGMA strips outer parens from expressions like (datetime('now')).
        // Wrap function-call defaults back in parens, leave literals as-is.
        const isFnCall = /[()]/.test(s);
        const isQuoted = /^['"].*['"]$/.test(s);
        const isNumeric = /^-?\d+(?:\.\d+)?$/.test(s);
        if (isFnCall) return ` DEFAULT (${s})`;
        if (isQuoted || isNumeric || /^(NULL|CURRENT_TIME|CURRENT_DATE|CURRENT_TIMESTAMP)$/i.test(s)) return ` DEFAULT ${s}`;
        return ` DEFAULT '${s.replace(/'/g, "''")}'`;
      }
      const ddlParts = cols.map(c => {
        if (c.name === 'id') return `${c.name} INTEGER PRIMARY KEY AUTOINCREMENT`;
        if (c.name === 'status') return `status TEXT DEFAULT 'pending'`;
        let part = `${c.name} ${c.type}`;
        part += renderDefault(c.dflt);
        return part;
      });
      // FKs are not strictly needed for application correctness — the
      // application enforces them. We drop them on the rebuild to keep the
      // migration tiny and side-effect-free.
      db.run('BEGIN');
      try {
        db.run(`CREATE TABLE sessions_v2 (${ddlParts.join(', ')})`);
        const cn = colNames.join(', ');
        db.run(`INSERT INTO sessions_v2 (${cn}) SELECT ${cn} FROM sessions`);
        db.run('DROP TABLE sessions');
        db.run('ALTER TABLE sessions_v2 RENAME TO sessions');
        db.run('COMMIT');
        // Re-create the calendar indexes the rebuild dropped.
        db.run('CREATE INDEX IF NOT EXISTS idx_sessions_client_meeting ON sessions(client_id, scheduled_at)');
        db.run('CREATE INDEX IF NOT EXISTS idx_sessions_therapist_meeting ON sessions(therapist_id, scheduled_at)');
        try { db.run('CREATE INDEX IF NOT EXISTS idx_sessions_inquiry ON sessions(inquiry_id)'); } catch (_) {}
        try { db.run('CREATE INDEX IF NOT EXISTS idx_sessions_therapist_client ON sessions(therapist_id, client_id)'); } catch (_) {}
        logger.info('T-19: sessions table rebuilt with relaxed status constraint');
      } catch (rebuildErr) {
        try { db.run('ROLLBACK'); } catch (_) {}
        throw rebuildErr;
      }
    }
  } catch (e) {
    logger.warn('T-19 status-constraint migration skipped: ' + e.message);
  }

  // T-15: Post-session therapist notes ("На что обратить внимание в следующий раз").
  // After a session, the therapist can quickly type or dictate quick notes about
  // what to focus on next session. The notes are Class A encrypted (sensitive
  // therapist observations) and never shown to the client. The AI summarizer
  // receives this field as additional context when (re)generating a summary.
  // - post_session_notes_encrypted: Class A encrypted text (nullable)
  // - post_session_notes_audio_path: optional opaque ref if the notes were
  //   captured via voice and the raw audio was kept (currently we only persist
  //   the transcript; this column reserves the option to attach the audio file).
  try {
    db.run('ALTER TABLE sessions ADD COLUMN post_session_notes_encrypted TEXT');
    logger.info('Added post_session_notes_encrypted column to sessions');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE sessions ADD COLUMN post_session_notes_audio_path TEXT');
    logger.info('Added post_session_notes_audio_path column to sessions');
  } catch (e) {
    // Column already exists, ignore
  }

  // T-17: Supervision share links — therapist generates a read-only public
  // share link to show client history to a supervisor without sharing a password.
  // Link has TTL (1d/7d/30d), optional anonymization, can be revoked at any time.
  // The token is the only secret - it's checked against this table to authenticate
  // supervisor access on /share/supervision/:token (no auth/cookies/csrf).
  db.run(`CREATE TABLE IF NOT EXISTS supervision_share_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    client_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    anonymize INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    revoked_at TEXT,
    last_accessed_at TEXT,
    access_count INTEGER NOT NULL DEFAULT 0
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_supervision_share_links_token ON supervision_share_links(token)');
  db.run('CREATE INDEX IF NOT EXISTS idx_supervision_share_links_therapist ON supervision_share_links(therapist_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_supervision_share_links_client ON supervision_share_links(client_id)');

  // T-08: Custom summary prompts per modality.
  // Therapists work in different modalities (psychoanalysis, CBT, NLP, gestalt,
  // generic). The summarization service picks a preset prompt fragment by id
  // and optionally appends (or replaces with) a therapist-supplied custom prompt.
  // - users.summary_specialization: one of psychoanalysis|cbt|nlp|gestalt|generic.
  //   The actual enum is enforced in app code (services/ai/summary-presets.js)
  //   rather than via SQL CHECK so the preset list can grow without migrations.
  // - users.custom_summary_prompt_encrypted: Class A encrypted free-text prompt
  //   (≤2000 chars). NULL = no custom prompt.
  // - users.custom_summary_prompt_mode: 'append' (default) | 'replace'.
  //   Controls whether the custom prompt is appended to the preset or replaces it.
  // - users.custom_summary_prompt_key_id / payload_version: standard Class A
  //   encryption metadata so the value can survive future key rotation.
  // Backward compat: existing therapists are backfilled to 'generic' once.
  let _addedSummarySpecializationColumn = false;
  try {
    db.run("ALTER TABLE users ADD COLUMN summary_specialization TEXT");
    logger.info('Added summary_specialization column to users');
    _addedSummarySpecializationColumn = true;
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE users ADD COLUMN custom_summary_prompt_encrypted TEXT');
    logger.info('Added custom_summary_prompt_encrypted column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run("ALTER TABLE users ADD COLUMN custom_summary_prompt_mode TEXT DEFAULT 'append'");
    logger.info('Added custom_summary_prompt_mode column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE users ADD COLUMN custom_summary_prompt_key_id INTEGER REFERENCES encryption_keys(id)');
    logger.info('Added custom_summary_prompt_key_id column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE users ADD COLUMN custom_summary_prompt_payload_version INTEGER');
    logger.info('Added custom_summary_prompt_payload_version column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  // Backfill: every existing therapist / superadmin without a specialization
  // gets 'generic' so AI summarization keeps working post-migration. Idempotent
  // — only updates rows that are currently NULL.
  if (_addedSummarySpecializationColumn) {
    try {
      db.run(
        "UPDATE users SET summary_specialization = 'generic' WHERE summary_specialization IS NULL AND role IN ('therapist', 'superadmin')"
      );
      logger.info("Backfilled summary_specialization='generic' for existing therapists / superadmins");
    } catch (e) {
      logger.warn('summary_specialization backfill skipped: ' + e.message);
    }
  }

  // T-18: Extended consent disclaimer.
  // - users.consent_version: integer tracking which version of the consent text
  //   the client agreed to. 0 = legacy (pre-T-18, no extended disclaimer) or
  //   has not consented yet. Each subsequent text update bumps the constant
  //   CONSENT_TEXT_VERSION (in src/bot/src/index.js) so existing clients are
  //   forced to re-consent before the next bot interaction.
  // - users.consent_text_hash: optional sha256 hex of the disclaimer body the
  //   client agreed to (kept for forensic/audit reference; not used for
  //   gating). NULL for legacy rows.
  // Backfill: existing connected clients (consent_therapist_access=1) get
  // consent_version=0 explicitly so the bot's version-gate prompts them
  // for re-consent on next interaction.
  try {
    db.run('ALTER TABLE users ADD COLUMN consent_version INTEGER DEFAULT 0');
    logger.info('T-18: added consent_version column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.run('ALTER TABLE users ADD COLUMN consent_text_hash TEXT');
    logger.info('T-18: added consent_text_hash column to users');
  } catch (e) {
    // Column already exists, ignore
  }
  // Idempotent backfill: ensure NULL values become 0 (older rows that
  // existed before the ALTER may have NULL despite the DEFAULT, depending
  // on sql.js version).
  try {
    db.run("UPDATE users SET consent_version = 0 WHERE consent_version IS NULL");
  } catch (e) {
    // Best-effort
  }

  // T-06: Solo mode (therapist-only "smart notebook").
  // Some therapists (psychoanalysts, those working with paranoid clients) cannot
  // bring the client into the bot. Solo mode lets the therapist create a "client"
  // entity manually that lives entirely on the therapist's side: the client never
  // sees the system, has no telegram_id and no invite_code, but the therapist can
  // still upload session audio, write post-session notes, and run NL queries.
  // - users.mode: 'bot_connected' (default, legacy invite-code flow) | 'solo'.
  //   Stored on the client row only; therapist/superadmin/viewer rows leave it
  //   NULL or default. The application enforces the enum via app code (no SQL
  //   CHECK so future modes can be added without a table rebuild).
  // Backfill: every existing client row gets 'bot_connected' so legacy invite-
  // code clients keep working unchanged.
  let _addedClientModeColumn = false;
  try {
    db.run("ALTER TABLE users ADD COLUMN mode TEXT DEFAULT 'bot_connected'");
    logger.info('T-06: added mode column to users');
    _addedClientModeColumn = true;
  } catch (e) {
    // Column already exists, ignore
  }
  // Idempotent backfill: existing client rows with NULL mode become
  // 'bot_connected' so they stay on the legacy flow. Run on every boot so
  // any later-introduced NULL row also gets normalised.
  try {
    db.run("UPDATE users SET mode = 'bot_connected' WHERE role = 'client' AND (mode IS NULL OR mode = '')");
    if (_addedClientModeColumn) {
      logger.info("T-06: backfilled mode='bot_connected' for existing clients");
    }
  } catch (e) {
    logger.warn('T-06 mode backfill skipped: ' + e.message);
  }

  // T-09: Therapist personal knowledge base (RAG).
  // Pro/Premium therapists upload their professional library (textbooks,
  // articles, school-specific literature) and the AI uses semantic top-k
  // chunks as additional context during session summarization and NL
  // queries. Every chunk gets a vector_embeddings row with source_type='kb'.
  // - therapist_knowledge_base: one row per uploaded document. Stores opaque
  //   filesystem path (file lives on disk under data/kb/<opaque>.bin),
  //   declared title, mime type, byte size, ingest status (queued / ingesting
  //   / ready / failed), final chunk_count once ready, optional error text.
  //   The original document is NOT encrypted at app layer because (a) it is
  //   third-party reference material the therapist explicitly uploaded, and
  //   (b) we never expose the raw file back to the bot or to clients. We only
  //   stream it back to the same therapist for download/preview if needed.
  // - therapist_knowledge_base_chunks: one row per text chunk used for
  //   retrieval. content_text holds plaintext (so it can be ranked + reused as
  //   AI context); access is therapist-scoped via the FK. Embeddings live in
  //   the existing vector_embeddings table (source_type='kb', source_id=chunk id).
  db.run(`CREATE TABLE IF NOT EXISTS therapist_knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued',
    chunk_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_kb_therapist ON therapist_knowledge_base(therapist_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_kb_status ON therapist_knowledge_base(status)');

  db.run(`CREATE TABLE IF NOT EXISTS therapist_knowledge_base_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kb_id INTEGER NOT NULL REFERENCES therapist_knowledge_base(id) ON DELETE CASCADE,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content_text TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_kb_chunks_kb ON therapist_knowledge_base_chunks(kb_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_kb_chunks_therapist ON therapist_knowledge_base_chunks(therapist_id)');

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
