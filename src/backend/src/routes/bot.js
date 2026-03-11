// Bot Integration Routes
// API endpoints used by the Telegram bot to manage users
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { encrypt } = require('../services/encryption');

const router = express.Router();

// Bot API key for authenticating bot requests
const BOT_API_KEY = process.env.BOT_API_KEY || 'dev-bot-api-key';

// Middleware to verify bot API key
function botAuth(req, res, next) {
  const apiKey = req.headers['x-bot-api-key'];
  if (!apiKey || apiKey !== BOT_API_KEY) {
    return res.status(401).json({ error: 'Invalid bot API key' });
  }
  next();
}

// POST /api/bot/register - Register or update a Telegram user with role
router.post('/register', botAuth, (req, res) => {
  try {
    const { telegram_id, role, language } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const validRoles = ['therapist', 'client'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Valid role (therapist/client) is required' });
    }

    const db = getDatabase();

    // Check if user already exists by telegram_id
    const existing = db.exec('SELECT id, role, telegram_id FROM users WHERE telegram_id = ?', [String(telegram_id)]);

    if (existing.length > 0 && existing[0].values.length > 0) {
      const existingUser = existing[0].values[0];
      logger.info(`Telegram user already exists: telegram_id=${telegram_id}, role=${existingUser[1]}`);
      return res.json({
        message: 'User already registered',
        user: {
          id: existingUser[0],
          telegram_id: existingUser[2],
          role: existingUser[1]
        },
        already_existed: true
      });
    }

    // Generate invite code for therapists
    const inviteCode = role === 'therapist' ? uuidv4().slice(0, 8) : null;

    // Insert new user
    db.run(
      'INSERT INTO users (telegram_id, role, invite_code, language) VALUES (?, ?, ?, ?)',
      [String(telegram_id), role, inviteCode, language || 'en']
    );

    saveDatabase();

    // Fetch the created user
    const result = db.exec(
      'SELECT id, telegram_id, role, invite_code, language, created_at FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const user = result[0].values[0];

    logger.info(`Telegram user registered: id=${user[0]}, telegram_id=${user[1]}, role=${user[2]}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user[0],
        telegram_id: user[1],
        role: user[2],
        invite_code: user[3],
        language: user[4],
        created_at: user[5]
      },
      already_existed: false
    });
  } catch (error) {
    logger.error('Bot register error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// GET /api/bot/user/:telegram_id - Get user by telegram_id
router.get('/user/:telegram_id', botAuth, (req, res) => {
  try {
    const { telegram_id } = req.params;
    const db = getDatabase();

    const result = db.exec(
      'SELECT id, telegram_id, role, invite_code, language, consent_therapist_access, therapist_id, created_at FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result[0].values[0];

    res.json({
      user: {
        id: user[0],
        telegram_id: user[1],
        role: user[2],
        invite_code: user[3],
        language: user[4],
        consent_therapist_access: !!user[5],
        therapist_id: user[6],
        created_at: user[7]
      }
    });
  } catch (error) {
    logger.error('Bot get user error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/bot/connect - Client enters invite code to connect with therapist
router.post('/connect', botAuth, (req, res) => {
  try {
    const { telegram_id, invite_code } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }
    if (!invite_code) {
      return res.status(400).json({ error: 'invite_code is required' });
    }

    const db = getDatabase();

    // Verify the client exists and is a client
    const clientResult = db.exec(
      'SELECT id, role, therapist_id, consent_therapist_access FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found. Please register first with /start.' });
    }

    const client = clientResult[0].values[0];
    const clientId = client[0];
    const clientRole = client[1];
    const existingTherapistId = client[2];

    if (clientRole !== 'client') {
      return res.status(400).json({ error: 'Only clients can use invite codes to connect.' });
    }

    if (existingTherapistId) {
      return res.status(400).json({
        error: 'You are already connected to a therapist. Use /disconnect first if you want to change.',
        therapist_id: existingTherapistId
      });
    }

    // Look up therapist by invite code (case-insensitive)
    const therapistResult = db.exec(
      "SELECT id, email, telegram_id, role, blocked_at FROM users WHERE LOWER(invite_code) = LOWER(?) AND role = 'therapist'",
      [invite_code.trim()]
    );

    if (therapistResult.length === 0 || therapistResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Invalid invite code. Please check the code and try again.' });
    }

    const therapist = therapistResult[0].values[0];
    const therapistId = therapist[0];
    const therapistBlocked = therapist[4];

    if (therapistBlocked) {
      return res.status(400).json({ error: 'This therapist account is currently unavailable.' });
    }

    logger.info(`Client ${clientId} (telegram_id=${telegram_id}) found therapist ${therapistId} via invite code`);

    // Return therapist info for consent flow - do NOT link yet (consent required)
    res.json({
      message: 'Therapist found. Consent is required before linking.',
      therapist: {
        id: therapistId,
        display_name: therapist[1] || `Therapist #${therapistId}`
      },
      client_id: clientId,
      requires_consent: true
    });
  } catch (error) {
    logger.error('Bot connect error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Connection failed: ' + error.message });
  }
});

// POST /api/bot/consent - Client gives consent and links to therapist
router.post('/consent', botAuth, (req, res) => {
  try {
    const { telegram_id, therapist_id, consent } = req.body;

    if (!telegram_id || !therapist_id) {
      return res.status(400).json({ error: 'telegram_id and therapist_id are required' });
    }

    const db = getDatabase();

    // Verify client
    const clientResult = db.exec(
      'SELECT id, role, therapist_id FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult[0].values[0];
    if (client[1] !== 'client') {
      return res.status(400).json({ error: 'Only clients can give consent' });
    }

    if (consent === false) {
      // Record consent decline in audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [client[0], 'consent_declined', 'user', therapist_id, JSON.stringify({ client_id: client[0], therapist_id: parseInt(therapist_id), telegram_id: String(telegram_id) })]
      );
      saveDatabase();
      logger.info(`Client ${client[0]} declined consent for therapist ${therapist_id}`);
      return res.json({ message: 'Consent declined. No connection was made.', linked: false });
    }

    // Link client to therapist with consent
    db.run(
      "UPDATE users SET therapist_id = ?, consent_therapist_access = 1, updated_at = datetime('now') WHERE id = ?",
      [therapist_id, client[0]]
    );

    // Record consent grant in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [client[0], 'consent_granted', 'user', therapist_id, JSON.stringify({ client_id: client[0], therapist_id: parseInt(therapist_id), telegram_id: String(telegram_id) })]
    );

    saveDatabase();

    logger.info(`Client ${client[0]} consented and linked to therapist ${therapist_id}`);

    res.json({
      message: 'Successfully connected to therapist',
      linked: true,
      client_id: client[0],
      therapist_id: parseInt(therapist_id)
    });
  } catch (error) {
    logger.error('Bot consent error: ' + error.message);
    res.status(500).json({ error: 'Consent processing failed: ' + error.message });
  }
});

// POST /api/bot/revoke-consent - Client revokes consent and disconnects from therapist
router.post('/revoke-consent', botAuth, (req, res) => {
  try {
    const { telegram_id } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const db = getDatabase();

    // Verify client exists
    const clientResult = db.exec(
      'SELECT id, role, therapist_id, consent_therapist_access FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult[0].values[0];
    const clientId = client[0];
    const clientRole = client[1];
    const therapistId = client[2];
    const hasConsent = client[3];

    if (clientRole !== 'client') {
      return res.status(400).json({ error: 'Only clients can revoke consent' });
    }

    if (!therapistId && !hasConsent) {
      return res.status(400).json({ error: 'You are not connected to any therapist' });
    }

    // Immediately revoke consent and unlink therapist
    db.run(
      "UPDATE users SET therapist_id = NULL, consent_therapist_access = 0, updated_at = datetime('now') WHERE id = ?",
      [clientId]
    );

    // Record consent revocation in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [clientId, 'consent_revoked', 'user', therapistId || 0, JSON.stringify({ client_id: clientId, therapist_id: therapistId, telegram_id: String(telegram_id) })]
    );

    saveDatabase();

    logger.info(`Client ${clientId} (telegram_id=${telegram_id}) revoked consent for therapist ${therapistId}`);

    res.json({
      message: 'Consent revoked successfully. You are no longer connected to your therapist.',
      revoked: true,
      client_id: clientId,
      previous_therapist_id: therapistId
    });
  } catch (error) {
    logger.error('Bot revoke-consent error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Failed to revoke consent: ' + error.message });
  }
});

// POST /api/bot/diary - Client submits a diary entry
router.post('/diary', botAuth, (req, res) => {
  try {
    const { telegram_id, content, entry_type, file_ref } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const type = entry_type || 'text';
    const validTypes = ['text', 'voice', 'video'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'entry_type must be text, voice, or video' });
    }

    // For voice/video entries, content can be a transcript or placeholder; file_ref should be set
    if (type === 'text' && (!content || !content.trim())) {
      return res.status(400).json({ error: 'content is required for text entries' });
    }
    // Voice/video entries need either content or file_ref
    if ((type === 'voice' || type === 'video') && !content && !file_ref) {
      return res.status(400).json({ error: 'Voice/video entries require content or file_ref' });
    }

    const db = getDatabase();

    // Verify the user exists and is a client
    const clientResult = db.exec(
      'SELECT id, role, therapist_id, consent_therapist_access FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found. Please register first with /start.' });
    }

    const client = clientResult[0].values[0];
    const clientId = client[0];
    const clientRole = client[1];

    if (clientRole !== 'client') {
      return res.status(400).json({ error: 'Only clients can submit diary entries.' });
    }

    // Encrypt the diary content (Class A data) - content may be empty for voice/video pending transcription
    const contentText = content ? content.trim() : '';
    let contentEncrypted = null;
    let keyVersion = null;
    let keyId = null;

    if (contentText) {
      const encResult = encrypt(contentText);
      contentEncrypted = encResult.encrypted;
      keyVersion = encResult.keyVersion;
      keyId = encResult.keyId;
    }

    // If file_ref provided, encrypt it for storage
    let encryptedFileRef = null;
    if (file_ref) {
      const fileRefEnc = encrypt(file_ref);
      encryptedFileRef = fileRefEnc.encrypted;
      if (!keyId) {
        keyId = fileRefEnc.keyId;
        keyVersion = fileRefEnc.keyVersion;
      }
    }

    // Insert diary entry with file_ref
    db.run(
      `INSERT INTO diary_entries (client_id, entry_type, content_encrypted, file_ref, encryption_key_id, payload_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [clientId, type, contentEncrypted, encryptedFileRef, keyId, keyVersion]
    );
    saveDatabase();

    // Get the created entry ID
    const lastId = db.exec("SELECT id FROM diary_entries WHERE client_id = ? ORDER BY id DESC LIMIT 1", [clientId]);
    const entryId = lastId.length > 0 ? lastId[0].values[0][0] : 0;

    logger.info(`Client ${clientId} submitted ${type} diary entry #${entryId}${file_ref ? ' with audio file' : ''}`);

    res.status(201).json({
      message: 'Diary entry saved successfully',
      entry: {
        id: entryId,
        client_id: clientId,
        entry_type: type,
        has_file: !!file_ref,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Bot diary error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Failed to save diary entry: ' + error.message });
  }
});

// GET /api/bot/diary/:telegram_id - Get diary entries for a client
router.get('/diary/:telegram_id', botAuth, (req, res) => {
  try {
    const { telegram_id } = req.params;
    const db = getDatabase();

    // Verify client exists
    const clientResult = db.exec(
      'SELECT id, role FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult[0].values[0];
    const clientId = client[0];

    // Get diary entries (without decrypting - just metadata)
    const result = db.exec(
      `SELECT id, entry_type, content_encrypted, encryption_key_id, payload_version, created_at
       FROM diary_entries WHERE client_id = ? ORDER BY created_at DESC LIMIT 50`,
      [clientId]
    );

    const entries = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      entry_type: row[1],
      content_encrypted: row[2],
      encryption_key_id: row[3],
      payload_version: row[4],
      created_at: row[5]
    }));

    res.json({ entries, total: entries.length });
  } catch (error) {
    logger.error('Bot get diary error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch diary entries' });
  }
});

// POST /api/bot/sos - Client triggers SOS alert
router.post('/sos', botAuth, (req, res) => {
  try {
    const { telegram_id, message } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const db = getDatabase();

    // Verify the user exists and is a client
    const clientResult = db.exec(
      'SELECT id, role, therapist_id, consent_therapist_access FROM users WHERE telegram_id = ?',
      [String(telegram_id)]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found. Please register first with /start.' });
    }

    const client = clientResult[0].values[0];
    const clientId = client[0];
    const clientRole = client[1];
    const therapistId = client[2];

    if (clientRole !== 'client') {
      return res.status(400).json({ error: 'Only clients can trigger SOS alerts.' });
    }

    if (!therapistId) {
      return res.status(400).json({ error: 'You are not connected to a therapist. Please connect first with /connect <code>.' });
    }

    // Encrypt the SOS message if provided (Class A data)
    let messageEncrypted = null;
    let keyId = null;
    let keyVersion = null;
    if (message && message.trim()) {
      const encResult = encrypt(message.trim());
      messageEncrypted = encResult.encrypted;
      keyId = encResult.keyId;
      keyVersion = encResult.keyVersion;
    }

    // Insert SOS event
    db.run(
      `INSERT INTO sos_events (client_id, therapist_id, message_encrypted, encryption_key_id, status, created_at)
       VALUES (?, ?, ?, ?, 'triggered', datetime('now'))`,
      [clientId, therapistId, messageEncrypted, keyId]
    );
    saveDatabase();

    // Get the created SOS event ID
    const lastId = db.exec("SELECT id, created_at FROM sos_events WHERE client_id = ? ORDER BY id DESC LIMIT 1", [clientId]);
    const sosId = lastId.length > 0 ? lastId[0].values[0][0] : 0;
    const createdAt = lastId.length > 0 ? lastId[0].values[0][1] : new Date().toISOString();

    // Record in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [clientId, 'sos_triggered', 'sos_event', sosId, JSON.stringify({ client_id: clientId, therapist_id: therapistId })]
    );
    saveDatabase();

    logger.info(`SOS ALERT: Client ${clientId} (telegram_id=${telegram_id}) triggered SOS, therapist ${therapistId}, event #${sosId}`);

    // Notify therapist immediately
    // Look up therapist's telegram_id for Telegram notification
    const therapistResult = db.exec(
      'SELECT telegram_id, email FROM users WHERE id = ?',
      [therapistId]
    );

    let notificationSent = false;
    const therapistInfo = therapistResult.length > 0 && therapistResult[0].values.length > 0
      ? therapistResult[0].values[0] : null;

    if (therapistInfo && therapistInfo[0]) {
      // Therapist has a Telegram ID - log notification (in production, send via bot)
      const clientIdentifier = `Client #${clientId} (Telegram: ${telegram_id})`;
      logger.info(`THERAPIST NOTIFICATION: SOS from ${clientIdentifier} → Therapist telegram_id=${therapistInfo[0]}`);
      logger.info(`[DEV MODE] Would send Telegram message to ${therapistInfo[0]}: "🚨 SOS ALERT from your client ${clientIdentifier}. Please check immediately."`);
      notificationSent = true;
    }

    if (therapistInfo && therapistInfo[1]) {
      // Therapist has an email - log email notification
      logger.info(`[DEV MODE] Would send email notification to ${therapistInfo[1]}: SOS alert from client #${clientId}`);
      notificationSent = true;
    }

    // Store notification record for web dashboard polling
    db.run(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [therapistId, 'sos_notification_sent', 'sos_event', sosId,
       JSON.stringify({ client_id: clientId, therapist_id: therapistId, notification_sent: notificationSent, telegram_id: String(telegram_id) })]
    );
    saveDatabase();

    res.status(201).json({
      message: 'SOS alert sent successfully',
      sos_event: {
        id: sosId,
        client_id: clientId,
        therapist_id: therapistId,
        status: 'triggered',
        created_at: createdAt
      }
    });
  } catch (error) {
    logger.error('Bot SOS error: ' + error.message);
    logger.error('Stack: ' + error.stack);
    res.status(500).json({ error: 'Failed to send SOS alert: ' + error.message });
  }
});

// GET /api/bot/exercises/:telegram_id - Get exercises sent to a client
router.get('/exercises/:telegram_id', botAuth, (req, res) => {
  try {
    const db = getDatabase();
    const telegramId = req.params.telegram_id;

    // Find client by telegram_id
    const userResult = db.exec(
      "SELECT id FROM users WHERE telegram_id = ? AND role = 'client'",
      [telegramId]
    );

    if (userResult.length === 0 || userResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const clientId = userResult[0].values[0][0];

    // Get exercise deliveries for this client
    const result = db.exec(
      `SELECT ed.id, ed.exercise_id, ed.status, ed.sent_at, ed.completed_at,
              e.title_en, e.title_ru, e.title_es, e.category,
              e.description_en, e.description_ru,
              e.instructions_en, e.instructions_ru
       FROM exercise_deliveries ed
       LEFT JOIN exercises e ON ed.exercise_id = e.id
       WHERE ed.client_id = ?
       ORDER BY ed.sent_at DESC`,
      [clientId]
    );

    const exercises = (result.length > 0 ? result[0].values : []).map(function(row) {
      return {
        delivery_id: row[0],
        exercise_id: row[1],
        status: row[2],
        sent_at: row[3],
        completed_at: row[4],
        title_en: row[5],
        title_ru: row[6],
        title_es: row[7],
        category: row[8],
        description_en: row[9],
        description_ru: row[10],
        instructions_en: row[11],
        instructions_ru: row[12]
      };
    });

    const pending = exercises.filter(function(e) { return e.status === 'sent'; });

    res.json({
      exercises: exercises,
      pending: pending,
      total: exercises.length,
      pending_count: pending.length
    });
  } catch (error) {
    logger.error('Bot get exercises error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

// POST /api/bot/exercises/:delivery_id/acknowledge - Client acknowledges exercise
router.post('/exercises/:delivery_id/acknowledge', botAuth, (req, res) => {
  try {
    const db = getDatabase();
    const deliveryId = req.params.delivery_id;
    const { telegram_id } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    // Find client by telegram_id
    const userResult = db.exec(
      "SELECT id FROM users WHERE telegram_id = ? AND role = 'client'",
      [telegram_id]
    );

    if (userResult.length === 0 || userResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const clientId = userResult[0].values[0][0];

    // Verify delivery belongs to this client
    const deliveryResult = db.exec(
      "SELECT id, status FROM exercise_deliveries WHERE id = ? AND client_id = ?",
      [deliveryId, clientId]
    );

    if (deliveryResult.length === 0 || deliveryResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Exercise delivery not found' });
    }

    // Update status to acknowledged
    db.run(
      "UPDATE exercise_deliveries SET status = 'acknowledged' WHERE id = ?",
      [deliveryId]
    );

    saveDatabase();

    res.json({
      delivery_id: parseInt(deliveryId),
      status: 'acknowledged',
      message: 'Exercise acknowledged'
    });
  } catch (error) {
    logger.error('Bot acknowledge exercise error: ' + error.message);
    res.status(500).json({ error: 'Failed to acknowledge exercise' });
  }
});

// POST /api/bot/exercises/:delivery_id/respond - Client responds/completes exercise
router.post('/exercises/:delivery_id/respond', botAuth, (req, res) => {
  try {
    const db = getDatabase();
    const deliveryId = req.params.delivery_id;
    const { telegram_id, response_text } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    if (!response_text || !response_text.trim()) {
      return res.status(400).json({ error: 'response_text is required' });
    }

    // Find client by telegram_id
    const userResult = db.exec(
      "SELECT id FROM users WHERE telegram_id = ? AND role = 'client'",
      [telegram_id]
    );

    if (userResult.length === 0 || userResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const clientId = userResult[0].values[0][0];

    // Verify delivery belongs to this client
    const deliveryResult = db.exec(
      "SELECT id, status, therapist_id FROM exercise_deliveries WHERE id = ? AND client_id = ?",
      [deliveryId, clientId]
    );

    if (deliveryResult.length === 0 || deliveryResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Exercise delivery not found' });
    }

    const therapistId = deliveryResult[0].values[0][2];

    // Encrypt the response (Class A sensitive data)
    const encrypted = encrypt(response_text.trim());

    // Update delivery: set status to completed, store encrypted response
    db.run(
      "UPDATE exercise_deliveries SET status = 'completed', response_encrypted = ?, completed_at = datetime('now') WHERE id = ?",
      [encrypted.encrypted, deliveryId]
    );

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'exercise_completed', 'exercise_delivery', ?, ?, datetime('now'))",
      [clientId, deliveryId, JSON.stringify({ client_id: clientId, therapist_id: therapistId })]
    );

    saveDatabase();

    // Notify therapist (dev mode: log to console)
    logger.info(`[TELEGRAM NOTIFICATION] Client ${telegram_id} completed exercise delivery #${deliveryId}`);
    logger.info(`[TELEGRAM NOTIFICATION] Therapist ${therapistId} should be notified`);

    res.json({
      delivery_id: parseInt(deliveryId),
      status: 'completed',
      response_encrypted: true,
      message: 'Exercise response recorded and encrypted'
    });
  } catch (error) {
    logger.error('Bot respond exercise error: ' + error.message);
    res.status(500).json({ error: 'Failed to record exercise response' });
  }
});

module.exports = router;
