// Client Routes - Therapist client management
const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkClientLimit } = require('../utils/planLimits');
const { encrypt, decrypt } = require('../services/encryption');

const router = express.Router();

// All client routes require authenticated therapist
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

// GET /api/clients - List therapist's linked clients
// Supports: ?search=term&page=1&per_page=25&language=en
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const search = req.query.search || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 25));
    const languageFilter = req.query.language || '';

    // Build query with optional filters
    let whereClause = "therapist_id = ? AND role = 'client'";
    const params = [therapistId];

    if (search) {
      whereClause += " AND (email LIKE ? OR telegram_id LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (languageFilter) {
      whereClause += " AND language = ?";
      params.push(languageFilter);
    }

    // Get total count
    const countResult = db.exec(`SELECT COUNT(*) FROM users WHERE ${whereClause}`, params);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated results
    const offset = (page - 1) * perPage;
    const result = db.exec(
      `SELECT id, telegram_id, email, consent_therapist_access, language, created_at, updated_at
       FROM users
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    const clients = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      telegram_id: row[1],
      email: row[2],
      consent_therapist_access: !!row[3],
      language: row[4],
      created_at: row[5],
      updated_at: row[6]
    }));

    // Also include limit info
    const limitCheck = checkClientLimit(therapistId);

    res.json({
      clients,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
      limit: limitCheck.limit,
      can_add: limitCheck.allowed,
      plan: limitCheck.plan,
      limit_message: limitCheck.message
    });
  } catch (error) {
    logger.error('List clients error: ' + error.message);
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

// GET /api/clients/:id - Get client detail
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id, telegram_id, email, consent_therapist_access, language, created_at, updated_at FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const row = clientResult[0].values[0];
    res.json({
      client: {
        id: row[0],
        telegram_id: row[1],
        email: row[2],
        consent_therapist_access: !!row[3],
        language: row[4],
        created_at: row[5],
        updated_at: row[6]
      }
    });
  } catch (error) {
    logger.error('Get client detail error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch client details' });
  }
});

// GET /api/clients/:id/diary - Get diary entries for a client (decrypted)
router.get('/:id/diary', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 25));
    const entryType = req.query.entry_type || '';
    const offset = (page - 1) * perPage;

    // Verify client belongs to this therapist and has consent
    const clientResult = db.exec(
      "SELECT id, consent_therapist_access FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const client = clientResult[0].values[0];
    if (!client[1]) {
      // Record access denial in audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'access_denied', 'diary', clientId, JSON.stringify({ reason: 'consent_not_granted' })]
      );
      saveDatabase();
      return res.status(403).json({ error: 'Client has not granted consent for data access' });
    }

    // Build query with optional type filter
    let whereClause = 'client_id = ?';
    const params = [clientId];

    if (entryType && ['text', 'voice', 'video'].includes(entryType)) {
      whereClause += ' AND entry_type = ?';
      params.push(entryType);
    }

    // Get total count
    const countResult = db.exec(`SELECT COUNT(*) FROM diary_entries WHERE ${whereClause}`, params);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated entries
    const result = db.exec(
      `SELECT id, entry_type, content_encrypted, transcript_encrypted, encryption_key_id, payload_version, created_at, updated_at
       FROM diary_entries WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    const entries = (result.length > 0 ? result[0].values : []).map(row => {
      let content = null;
      let transcript = null;

      // Decrypt content for authorized read
      try {
        if (row[2]) {
          content = decrypt(row[2]);
        }
      } catch (e) {
        logger.error(`Failed to decrypt diary entry ${row[0]}: ${e.message}`);
        content = '[decryption error]';
      }

      // Decrypt transcript if present
      try {
        if (row[3]) {
          transcript = decrypt(row[3]);
        }
      } catch (e) {
        logger.error(`Failed to decrypt transcript for entry ${row[0]}: ${e.message}`);
        transcript = '[decryption error]';
      }

      return {
        id: row[0],
        entry_type: row[1],
        content: content,
        transcript: transcript,
        created_at: row[6],
        updated_at: row[7]
      };
    });

    // Record data access in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_diary', 'client', clientId, JSON.stringify({ entries_count: entries.length, page })]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} accessed diary entries for client ${clientId} (${entries.length} entries)`);

    res.json({
      entries,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    logger.error('Get client diary error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch diary entries' });
  }
});

// POST /api/clients/:id/notes - Create encrypted therapist note for a client
router.post('/:id/notes', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const { content, session_date } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id, consent_therapist_access FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    // Encrypt the note content (Class A data)
    const { encrypted, keyVersion, keyId } = encrypt(content.trim());

    // Insert note into therapist_notes table
    db.run(
      `INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted, encryption_key_id, payload_version, session_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [therapistId, clientId, encrypted, keyId, keyVersion, session_date || null]
    );

    // Get the inserted note ID immediately (before any other writes)
    const lastIdResult = db.exec('SELECT last_insert_rowid()');
    const noteId = lastIdResult[0].values[0][0];

    // Record in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'create_note', 'therapist_note', noteId, JSON.stringify({ client_id: clientId })]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} created note ${noteId} for client ${clientId}`);

    res.status(201).json({
      id: noteId,
      therapist_id: therapistId,
      client_id: parseInt(clientId),
      content: content.trim(),
      session_date: session_date || null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Create note error: ' + error.message);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// GET /api/clients/:id/notes - Get therapist notes for a client (decrypted)
router.get('/:id/notes', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 25));
    const offset = (page - 1) * perPage;

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    // Get total count
    const countResult = db.exec(
      'SELECT COUNT(*) FROM therapist_notes WHERE therapist_id = ? AND client_id = ?',
      [therapistId, clientId]
    );
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated notes
    const result = db.exec(
      `SELECT id, therapist_id, client_id, note_encrypted, encryption_key_id, payload_version, session_date, created_at, updated_at
       FROM therapist_notes
       WHERE therapist_id = ? AND client_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [therapistId, clientId, perPage, offset]
    );

    const notes = (result.length > 0 ? result[0].values : []).map(row => {
      let content = null;
      try {
        if (row[3]) {
          content = decrypt(row[3]);
        }
      } catch (e) {
        logger.error(`Failed to decrypt note ${row[0]}: ${e.message}`);
        content = '[decryption error]';
      }

      return {
        id: row[0],
        therapist_id: row[1],
        client_id: row[2],
        content: content,
        session_date: row[6],
        created_at: row[7],
        updated_at: row[8]
      };
    });

    // Record data access in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_notes', 'client', clientId, JSON.stringify({ notes_count: notes.length, page })]
    );
    saveDatabase();

    res.json({
      notes,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    logger.error('Get client notes error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/clients/link - Link a client to this therapist (via invite code)
router.post('/link', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const { client_id } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    // Check client limit before linking
    const limitCheck = checkClientLimit(therapistId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Client limit reached',
        message: limitCheck.message,
        current: limitCheck.current,
        limit: limitCheck.limit,
        plan: limitCheck.plan
      });
    }

    // Verify client exists and is a client role
    const clientResult = db.exec(
      'SELECT id, role, therapist_id FROM users WHERE id = ?',
      [client_id]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult[0].values[0];
    if (client[1] !== 'client') {
      return res.status(400).json({ error: 'User is not a client' });
    }

    if (client[2] && client[2] !== therapistId) {
      return res.status(400).json({ error: 'Client is already linked to another therapist' });
    }

    // Link the client
    db.run(
      "UPDATE users SET therapist_id = ?, updated_at = datetime('now') WHERE id = ?",
      [therapistId, client_id]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} linked client ${client_id}`);

    res.json({
      message: 'Client linked successfully',
      client_id: parseInt(client_id)
    });
  } catch (error) {
    logger.error('Link client error: ' + error.message);
    res.status(500).json({ error: 'Failed to link client' });
  }
});

module.exports = router;
