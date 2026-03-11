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

    // Build query with optional filters (use u. prefix for aliased queries)
    let whereClause = "u.therapist_id = ? AND u.role = 'client'";
    const params = [therapistId];

    if (search) {
      whereClause += " AND (u.email LIKE ? OR u.telegram_id LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (languageFilter) {
      whereClause += " AND u.language = ?";
      params.push(languageFilter);
    }

    // Get total count
    const countResult = db.exec(`SELECT COUNT(*) FROM users u WHERE ${whereClause}`, params);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated results with last activity indicator
    const offset = (page - 1) * perPage;
    const result = db.exec(
      `SELECT u.id, u.telegram_id, u.email, u.consent_therapist_access, u.language, u.created_at, u.updated_at,
              (SELECT MAX(created_at) FROM (
                SELECT created_at FROM diary_entries WHERE client_id = u.id
                UNION ALL
                SELECT created_at FROM therapist_notes WHERE client_id = u.id
                UNION ALL
                SELECT created_at FROM sessions WHERE client_id = u.id
              )) AS last_activity
       FROM users u
       WHERE ${whereClause}
       ORDER BY last_activity DESC NULLS LAST, u.created_at DESC
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
      updated_at: row[6],
      last_activity: row[7] || null
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
    const dateFrom = req.query.date_from || ''; // ISO date string e.g. 2026-01-01
    const dateTo = req.query.date_to || ''; // ISO date string e.g. 2026-12-31
    const offset = (page - 1) * perPage;

    // Verify client exists
    const clientExistsResult = db.exec(
      "SELECT id, therapist_id, consent_therapist_access FROM users WHERE id = ? AND role = 'client'",
      [clientId]
    );

    if (clientExistsResult.length === 0 || clientExistsResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const clientRow = clientExistsResult[0].values[0];
    const clientTherapistId = clientRow[1];
    const hasConsent = clientRow[2];

    // Check if client is linked to this therapist (use == for type coercion since sql.js may return different types)
    if (!clientTherapistId || String(clientTherapistId) !== String(therapistId)) {
      // Record access denial in audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'access_denied', 'diary', clientId, JSON.stringify({ reason: 'not_linked_therapist' })]
      );
      saveDatabase();
      return res.status(403).json({ error: 'You are not authorized to access this client\'s data' });
    }

    if (!hasConsent) {
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

    // Date range filtering
    if (dateFrom && /^\d{4}-\d{2}-\d{2}/.test(dateFrom)) {
      whereClause += ' AND created_at >= ?';
      params.push(dateFrom.substring(0, 10) + 'T00:00:00');
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}/.test(dateTo)) {
      whereClause += ' AND created_at <= ?';
      params.push(dateTo.substring(0, 10) + 'T23:59:59');
    }

    // Get total count
    const countResult = db.exec(`SELECT COUNT(*) FROM diary_entries WHERE ${whereClause}`, params);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated entries
    const result = db.exec(
      `SELECT id, entry_type, content_encrypted, transcript_encrypted, encryption_key_id, payload_version, created_at, updated_at, embedding_ref
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
        updated_at: row[7],
        embedding_ref: row[8] || null
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
// Supports ?search=keyword to filter notes by decrypted content
router.get('/:id/notes', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 25));
    const searchQuery = (req.query.search || '').trim().toLowerCase();

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    // Get all notes (need to decrypt for search filtering, then paginate)
    const result = db.exec(
      `SELECT id, therapist_id, client_id, note_encrypted, encryption_key_id, payload_version, session_date, created_at, updated_at
       FROM therapist_notes
       WHERE therapist_id = ? AND client_id = ?
       ORDER BY created_at DESC`,
      [therapistId, clientId]
    );

    let allNotes = (result.length > 0 ? result[0].values : []).map(row => {
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

    // Filter by search query if provided (searches decrypted content)
    if (searchQuery) {
      allNotes = allNotes.filter(note =>
        note.content && note.content.toLowerCase().includes(searchQuery)
      );
    }

    const total = allNotes.length;
    const offset = (page - 1) * perPage;
    const notes = allNotes.slice(offset, offset + perPage);

    // Record data access in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_notes', 'client', clientId, JSON.stringify({ notes_count: notes.length, page, search: searchQuery || undefined })]
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

// GET /api/clients/:id/context - Get client context (anamnesis, goals, AI instructions)
router.get('/:id/context', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id, consent_therapist_access FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    // Get context record
    const result = db.exec(
      `SELECT id, anamnesis_encrypted, current_goals_encrypted, contraindications_encrypted,
              ai_instructions_encrypted, encryption_key_id, payload_version, created_at, updated_at
       FROM client_context
       WHERE therapist_id = ? AND client_id = ?
       LIMIT 1`,
      [therapistId, clientId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      // No context yet - return empty
      return res.json({
        context: {
          id: null,
          client_id: parseInt(clientId),
          therapist_id: therapistId,
          anamnesis: null,
          current_goals: null,
          contraindications: null,
          ai_instructions: null,
          created_at: null,
          updated_at: null
        }
      });
    }

    const row = result[0].values[0];

    // Decrypt each field
    const decryptField = (encrypted) => {
      if (!encrypted) return null;
      try {
        return decrypt(encrypted);
      } catch (e) {
        logger.error(`Failed to decrypt context field: ${e.message}`);
        return '[decryption error]';
      }
    };

    const context = {
      id: row[0],
      client_id: parseInt(clientId),
      therapist_id: therapistId,
      anamnesis: decryptField(row[1]),
      current_goals: decryptField(row[2]),
      contraindications: decryptField(row[3]),
      ai_instructions: decryptField(row[4]),
      created_at: row[7],
      updated_at: row[8]
    };

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_context', 'client_context', clientId, JSON.stringify({ context_id: row[0] })]
    );
    saveDatabase();

    res.json({ context });
  } catch (error) {
    logger.error('Get client context error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch client context' });
  }
});

// PUT /api/clients/:id/context - Create or update client context (anamnesis, goals, etc.)
router.put('/:id/context', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const { anamnesis, current_goals, contraindications, ai_instructions } = req.body;

    // At least one field must be provided
    if (!anamnesis && !current_goals && !contraindications && !ai_instructions) {
      return res.status(400).json({ error: 'At least one context field is required (anamnesis, current_goals, contraindications, ai_instructions)' });
    }

    // Validate max length for each field (50,000 chars max per field)
    const MAX_FIELD_LENGTH = 50000;
    const fields = { anamnesis, current_goals, contraindications, ai_instructions };
    for (const [name, value] of Object.entries(fields)) {
      if (value && typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
        return res.status(400).json({
          error: `Field '${name}' exceeds maximum length of ${MAX_FIELD_LENGTH} characters (received ${value.length})`,
          field: name,
          max_length: MAX_FIELD_LENGTH
        });
      }
    }

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id, consent_therapist_access FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    // Encrypt each provided field (Class A data)
    const encryptField = (value) => {
      if (!value || typeof value !== 'string' || value.trim().length === 0) return null;
      return encrypt(value.trim());
    };

    // Check if context already exists
    const existing = db.exec(
      'SELECT id, anamnesis_encrypted, current_goals_encrypted, contraindications_encrypted, ai_instructions_encrypted FROM client_context WHERE therapist_id = ? AND client_id = ?',
      [therapistId, clientId]
    );

    let contextId;
    const hasExisting = existing.length > 0 && existing[0].values.length > 0;

    if (hasExisting) {
      // Update existing context - merge: keep existing encrypted values for fields not provided
      const existingRow = existing[0].values[0];
      contextId = existingRow[0];

      const anamnesisEnc = anamnesis ? encryptField(anamnesis) : null;
      const goalsEnc = current_goals ? encryptField(current_goals) : null;
      const contraindicationsEnc = contraindications ? encryptField(contraindications) : null;
      const aiInstructionsEnc = ai_instructions ? encryptField(ai_instructions) : null;

      // For each field: use new encrypted value if provided, else keep existing
      const finalAnamnesis = anamnesisEnc ? anamnesisEnc.encrypted : existingRow[1];
      const finalGoals = goalsEnc ? goalsEnc.encrypted : existingRow[2];
      const finalContraindications = contraindicationsEnc ? contraindicationsEnc.encrypted : existingRow[3];
      const finalAiInstructions = aiInstructionsEnc ? aiInstructionsEnc.encrypted : existingRow[4];

      // Get key info from whichever field was encrypted
      const encResult = anamnesisEnc || goalsEnc || contraindicationsEnc || aiInstructionsEnc;
      const keyId = encResult ? encResult.keyId : null;
      const keyVersion = encResult ? encResult.keyVersion : null;

      const updateParts = [
        'anamnesis_encrypted = ?',
        'current_goals_encrypted = ?',
        'contraindications_encrypted = ?',
        'ai_instructions_encrypted = ?',
        "updated_at = datetime('now')"
      ];

      const updateParams = [finalAnamnesis, finalGoals, finalContraindications, finalAiInstructions];

      if (keyId !== null) {
        updateParts.push('encryption_key_id = ?', 'payload_version = ?');
        updateParams.push(keyId, keyVersion);
      }

      updateParams.push(therapistId, clientId);

      db.run(
        `UPDATE client_context SET ${updateParts.join(', ')} WHERE therapist_id = ? AND client_id = ?`,
        updateParams
      );
    } else {
      // Create new context record
      const anamnesisEnc = encryptField(anamnesis);
      const goalsEnc = encryptField(current_goals);
      const contraindicationsEnc = encryptField(contraindications);
      const aiInstructionsEnc = encryptField(ai_instructions);

      // Get key info from whichever field was encrypted
      const encResult = anamnesisEnc || goalsEnc || contraindicationsEnc || aiInstructionsEnc;

      db.run(
        `INSERT INTO client_context (therapist_id, client_id, anamnesis_encrypted, current_goals_encrypted,
         contraindications_encrypted, ai_instructions_encrypted, encryption_key_id, payload_version,
         created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          therapistId, clientId,
          anamnesisEnc ? anamnesisEnc.encrypted : null,
          goalsEnc ? goalsEnc.encrypted : null,
          contraindicationsEnc ? contraindicationsEnc.encrypted : null,
          aiInstructionsEnc ? aiInstructionsEnc.encrypted : null,
          encResult ? encResult.keyId : null,
          encResult ? encResult.keyVersion : null
        ]
      );

      const lastIdResult = db.exec('SELECT last_insert_rowid()');
      contextId = lastIdResult[0].values[0][0];
    }

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, hasExisting ? 'update_context' : 'create_context', 'client_context', clientId,
       JSON.stringify({ fields: Object.keys(req.body).filter(k => req.body[k]) })]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} ${hasExisting ? 'updated' : 'created'} context for client ${clientId}`);

    // Return the saved context (decrypted)
    const savedResult = db.exec(
      `SELECT id, anamnesis_encrypted, current_goals_encrypted, contraindications_encrypted,
              ai_instructions_encrypted, created_at, updated_at
       FROM client_context WHERE therapist_id = ? AND client_id = ?`,
      [therapistId, clientId]
    );

    const savedRow = savedResult[0].values[0];
    const decryptField = (encrypted) => {
      if (!encrypted) return null;
      try { return decrypt(encrypted); } catch (e) { return '[decryption error]'; }
    };

    res.status(hasExisting ? 200 : 201).json({
      context: {
        id: savedRow[0],
        client_id: parseInt(clientId),
        therapist_id: therapistId,
        anamnesis: decryptField(savedRow[1]),
        current_goals: decryptField(savedRow[2]),
        contraindications: decryptField(savedRow[3]),
        ai_instructions: decryptField(savedRow[4]),
        created_at: savedRow[5],
        updated_at: savedRow[6]
      }
    });
  } catch (error) {
    logger.error('Update client context error: ' + error.message);
    res.status(500).json({ error: 'Failed to update client context' });
  }
});

// GET /api/clients/:id/timeline - Unified timeline of diary entries, notes, and sessions
router.get('/:id/timeline', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const startDate = req.query.start_date || '';
    const endDate = req.query.end_date || '';
    const sourceType = req.query.type || ''; // Filter by source type: diary, note, session

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id, consent_therapist_access FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const client = clientResult[0].values[0];
    if (!client[1]) {
      return res.status(403).json({ error: 'Client has not granted consent for data access' });
    }

    // Build date filter clause
    let dateFilter = '';
    const dateParams = [];
    if (startDate) {
      dateFilter += ' AND created_at >= ?';
      dateParams.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND created_at <= ?';
      dateParams.push(endDate);
    }

    // Validate source type filter
    const validTypes = ['diary', 'note', 'session'];
    const filterByType = sourceType && validTypes.includes(sourceType) ? sourceType : '';

    const timeline = [];

    // 1. Fetch diary entries (if not filtering or filtering by diary)
    if (!filterByType || filterByType === 'diary') {
      const diaryResult = db.exec(
        `SELECT id, entry_type, content_encrypted, transcript_encrypted, created_at
         FROM diary_entries WHERE client_id = ?${dateFilter}
         ORDER BY created_at DESC`,
        [clientId, ...dateParams]
      );

      if (diaryResult.length > 0 && diaryResult[0].values.length > 0) {
        for (const row of diaryResult[0].values) {
          let content = null;
          let transcript = null;
          try { if (row[2]) content = decrypt(row[2]); } catch (e) { content = '[decryption error]'; }
          try { if (row[3]) transcript = decrypt(row[3]); } catch (e) { transcript = '[decryption error]'; }

          timeline.push({
            type: 'diary',
            id: row[0],
            entry_type: row[1],
            content: content,
            transcript: transcript,
            created_at: row[4]
          });
        }
      }
    }

    // 2. Fetch therapist notes (if not filtering or filtering by note)
    if (!filterByType || filterByType === 'note') {
      const notesResult = db.exec(
        `SELECT id, note_encrypted, session_date, created_at
         FROM therapist_notes WHERE therapist_id = ? AND client_id = ?${dateFilter}
         ORDER BY created_at DESC`,
        [therapistId, clientId, ...dateParams]
      );

      if (notesResult.length > 0 && notesResult[0].values.length > 0) {
        for (const row of notesResult[0].values) {
          let content = null;
          try { if (row[1]) content = decrypt(row[1]); } catch (e) { content = '[decryption error]'; }

          timeline.push({
            type: 'note',
            id: row[0],
            content: content,
            session_date: row[2],
            created_at: row[3]
          });
        }
      }
    }

    // 3. Fetch sessions (if not filtering or filtering by session)
    if (!filterByType || filterByType === 'session') {
      const sessionsResult = db.exec(
        `SELECT id, audio_ref, transcript_encrypted, summary_encrypted, status, scheduled_at, created_at
         FROM sessions WHERE therapist_id = ? AND client_id = ?${dateFilter}
         ORDER BY created_at DESC`,
        [therapistId, clientId, ...dateParams]
      );

      if (sessionsResult.length > 0 && sessionsResult[0].values.length > 0) {
        for (const row of sessionsResult[0].values) {
          let summary = null;
          try { if (row[3]) summary = decrypt(row[3]); } catch (e) { summary = '[decryption error]'; }

          timeline.push({
            type: 'session',
            id: row[0],
            has_audio: !!row[1],
            has_transcript: !!row[2],
            summary: summary,
            status: row[4],
            scheduled_at: row[5],
            created_at: row[6]
          });
        }
      }
    }

    // Sort all items chronologically (newest first)
    timeline.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_timeline', 'client', clientId, JSON.stringify({ items_count: timeline.length })]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} accessed timeline for client ${clientId} (${timeline.length} items)`);

    res.json({
      timeline,
      total: timeline.length,
      filters: {
        start_date: startDate || null,
        end_date: endDate || null,
        type: filterByType || null
      }
    });
  } catch (error) {
    logger.error('Get client timeline error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch client timeline' });
  }
});

// GET /api/clients/:id/sessions - Get sessions for a client
router.get('/:id/sessions', (req, res) => {
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
      'SELECT COUNT(*) FROM sessions WHERE therapist_id = ? AND client_id = ?',
      [therapistId, clientId]
    );
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated sessions
    const result = db.exec(
      `SELECT id, audio_ref, transcript_encrypted, summary_encrypted, status, scheduled_at, created_at, updated_at
       FROM sessions
       WHERE therapist_id = ? AND client_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [therapistId, clientId, perPage, offset]
    );

    const sessions = (result.length > 0 ? result[0].values : []).map(row => {
      let summary = null;
      try { if (row[3]) summary = decrypt(row[3]); } catch (e) { summary = '[decryption error]'; }

      return {
        id: row[0],
        has_audio: !!row[1],
        has_transcript: !!row[2],
        summary: summary,
        status: row[4],
        scheduled_at: row[5],
        created_at: row[6],
        updated_at: row[7]
      };
    });

    // Audit log: reading client sessions (Class A - summaries)
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_sessions', 'client', clientId, JSON.stringify({ sessions_count: sessions.length, page })]
    );
    saveDatabase();

    res.json({
      sessions,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    logger.error('Get client sessions error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/clients/:id/exercises - Get exercise deliveries for a client
router.get('/:id/exercises', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    // Get exercise deliveries for this client
    const result = db.exec(
      `SELECT ed.id, ed.exercise_id, ed.status, ed.sent_at, ed.completed_at,
              e.title_en, e.title_ru, e.title_es, e.category, e.description_en
       FROM exercise_deliveries ed
       LEFT JOIN exercises e ON ed.exercise_id = e.id
       WHERE ed.therapist_id = ? AND ed.client_id = ?
       ORDER BY ed.sent_at DESC`,
      [therapistId, clientId]
    );

    const deliveries = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      exercise_id: row[1],
      status: row[2],
      sent_at: row[3],
      completed_at: row[4],
      exercise_title: row[5] || row[6] || row[7] || 'Unknown',
      exercise_category: row[8],
      exercise_description: row[9]
    }));

    res.json({
      deliveries,
      total: deliveries.length
    });
  } catch (error) {
    logger.error('Get client exercises error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch exercise deliveries' });
  }
});

// POST /api/clients/:id/exercises - Send an exercise to a client
router.post('/:id/exercises', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const { exercise_id } = req.body;

    if (!exercise_id) {
      return res.status(400).json({ error: 'exercise_id is required' });
    }

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id, telegram_id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const clientTelegramId = clientResult[0].values[0][1];

    // Verify exercise exists
    const exerciseResult = db.exec(
      "SELECT id, title_en, title_ru, category, description_en FROM exercises WHERE id = ?",
      [exercise_id]
    );

    if (exerciseResult.length === 0 || exerciseResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const exerciseRow = exerciseResult[0].values[0];
    const exerciseTitle = exerciseRow[1] || exerciseRow[2] || 'Exercise';

    // Create exercise delivery
    db.run(
      "INSERT INTO exercise_deliveries (exercise_id, therapist_id, client_id, status, sent_at) VALUES (?, ?, ?, 'sent', datetime('now'))",
      [exercise_id, therapistId, clientId]
    );

    // Get the created delivery ID
    const lastId = db.exec("SELECT last_insert_rowid()");
    const deliveryId = lastId[0].values[0][0];

    // Create audit log entry
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'exercise_sent', 'exercise_delivery', ?, ?, datetime('now'))",
      [therapistId, deliveryId, JSON.stringify({ exercise_id, client_id: clientId, exercise_title: exerciseTitle })]
    );

    saveDatabase();

    // Notify client via Telegram (dev mode: log to console)
    if (clientTelegramId) {
      logger.info(`[TELEGRAM NOTIFICATION] Exercise sent to client ${clientTelegramId}: "${exerciseTitle}" (delivery #${deliveryId})`);
      logger.info(`[TELEGRAM NOTIFICATION] Message: "Your therapist has assigned you a new exercise: ${exerciseTitle}"`);
    }

    res.status(201).json({
      delivery: {
        id: deliveryId,
        exercise_id: parseInt(exercise_id),
        client_id: parseInt(clientId),
        therapist_id: therapistId,
        status: 'sent',
        exercise_title: exerciseTitle,
        exercise_category: exerciseRow[3],
        exercise_description: exerciseRow[4]
      },
      notification_sent: !!clientTelegramId,
      message: `Exercise "${exerciseTitle}" sent to client successfully`
    });
  } catch (error) {
    logger.error('Send exercise error: ' + error.message);
    res.status(500).json({ error: 'Failed to send exercise' });
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

// GET /api/clients/:id/sos - Get SOS events for a client
router.get('/:id/sos', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const result = db.exec(
      `SELECT id, client_id, therapist_id, message_encrypted, encryption_key_id, status, created_at, acknowledged_at
       FROM sos_events WHERE client_id = ? AND therapist_id = ?
       ORDER BY created_at DESC`,
      [clientId, therapistId]
    );

    const events = (result.length > 0 ? result[0].values : []).map(row => {
      let message = null;
      try {
        if (row[3]) message = decrypt(row[3]);
      } catch (e) {
        logger.error('Failed to decrypt SOS message: ' + e.message);
        message = '[decryption error]';
      }

      return {
        id: row[0],
        client_id: row[1],
        therapist_id: row[2],
        message: message,
        status: row[5],
        created_at: row[6],
        acknowledged_at: row[7]
      };
    });

    res.json({ sos_events: events, total: events.length });
  } catch (error) {
    logger.error('Get SOS events error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch SOS events' });
  }
});

// PUT /api/clients/:id/sos/:sosId/acknowledge - Therapist acknowledges SOS event
router.put('/:id/sos/:sosId/acknowledge', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const sosId = req.params.sosId;

    // Verify client belongs to this therapist
    const clientResult = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    // Verify SOS event exists and belongs to this therapist/client
    const sosResult = db.exec(
      'SELECT id, status FROM sos_events WHERE id = ? AND client_id = ? AND therapist_id = ?',
      [sosId, clientId, therapistId]
    );

    if (sosResult.length === 0 || sosResult[0].values.length === 0) {
      return res.status(404).json({ error: 'SOS event not found' });
    }

    const currentStatus = sosResult[0].values[0][1];
    if (currentStatus === 'acknowledged' || currentStatus === 'resolved') {
      return res.json({
        message: 'SOS event already ' + currentStatus,
        sos_event: { id: parseInt(sosId), status: currentStatus }
      });
    }

    // Update SOS event status to acknowledged
    db.run(
      "UPDATE sos_events SET status = 'acknowledged', acknowledged_at = datetime('now') WHERE id = ?",
      [sosId]
    );

    // Record in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'sos_acknowledged', 'sos_event', sosId, JSON.stringify({ client_id: parseInt(clientId), therapist_id: therapistId })]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} acknowledged SOS event #${sosId} for client ${clientId}`);

    res.json({
      message: 'SOS event acknowledged',
      sos_event: {
        id: parseInt(sosId),
        client_id: parseInt(clientId),
        therapist_id: therapistId,
        status: 'acknowledged'
      }
    });
  } catch (error) {
    logger.error('Acknowledge SOS error: ' + error.message);
    res.status(500).json({ error: 'Failed to acknowledge SOS event' });
  }
});

// POST /api/clients/:id/import - Import data (notes/diary) from JSON file
// Accepts JSON with { type: "notes"|"diary", entries: [...] }
const multer = require('multer');
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are accepted for import'), false);
    }
  }
});

router.post('/:id/import', (req, res, next) => {
  importUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      const db = getDatabase();
      const therapistId = req.user.id;
      const clientId = req.params.id;

      // Verify client belongs to this therapist
      const clientResult = db.exec(
        "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
        [clientId, therapistId]
      );

      if (clientResult.length === 0 || clientResult[0].values.length === 0) {
        return res.status(404).json({ error: 'Client not found or not linked to you' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please provide a JSON file.' });
      }

      // Parse JSON content
      let fileContent;
      try {
        const rawText = req.file.buffer.toString('utf8');
        fileContent = JSON.parse(rawText);
      } catch (parseErr) {
        logger.warn(`Import parse error for client ${clientId}: ${parseErr.message}`);
        return res.status(400).json({
          error: 'Malformed JSON file. Please check the file format and try again.',
          details: parseErr.message
        });
      }

      // Validate structure
      if (!fileContent || typeof fileContent !== 'object') {
        return res.status(400).json({
          error: 'Invalid file structure. Expected a JSON object with "type" and "entries" fields.'
        });
      }

      const importType = fileContent.type;
      if (!importType || !['notes', 'diary'].includes(importType)) {
        return res.status(400).json({
          error: 'Invalid import type. Must be "notes" or "diary".',
          details: 'The "type" field must be either "notes" or "diary".'
        });
      }

      if (!Array.isArray(fileContent.entries)) {
        return res.status(400).json({
          error: 'Invalid file structure. "entries" must be an array.',
          details: 'Expected "entries" to be an array of objects.'
        });
      }

      if (fileContent.entries.length === 0) {
        return res.status(400).json({
          error: 'No entries found in the import file.',
          details: 'The "entries" array is empty.'
        });
      }

      if (fileContent.entries.length > 500) {
        return res.status(400).json({
          error: 'Too many entries. Maximum 500 entries per import.',
          details: `Found ${fileContent.entries.length} entries.`
        });
      }

      // Count records before import for verification
      let countBefore;
      if (importType === 'notes') {
        const countResult = db.exec(
          'SELECT COUNT(*) FROM therapist_notes WHERE client_id = ? AND therapist_id = ?',
          [clientId, therapistId]
        );
        countBefore = countResult.length > 0 ? countResult[0].values[0][0] : 0;
      } else {
        const countResult = db.exec(
          'SELECT COUNT(*) FROM diary_entries WHERE client_id = ?',
          [clientId]
        );
        countBefore = countResult.length > 0 ? countResult[0].values[0][0] : 0;
      }

      // Validate and import entries
      const errors = [];
      let imported = 0;

      for (let i = 0; i < fileContent.entries.length; i++) {
        const entry = fileContent.entries[i];

        if (!entry || typeof entry !== 'object') {
          errors.push({ index: i, error: 'Entry must be an object' });
          continue;
        }

        if (importType === 'notes') {
          // Validate note entry
          if (!entry.content || typeof entry.content !== 'string' || entry.content.trim().length === 0) {
            errors.push({ index: i, error: 'Note must have non-empty "content" string' });
            continue;
          }

          if (entry.content.length > 50000) {
            errors.push({ index: i, error: 'Note content exceeds 50000 character limit' });
            continue;
          }

          // Encrypt and insert
          const { encrypted: noteEncrypted, keyId } = encrypt(entry.content.trim());
          const createdAt = entry.created_at || new Date().toISOString();

          db.run(
            `INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted, encryption_key_id, payload_version, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, ?, datetime('now'))`,
            [therapistId, clientId, noteEncrypted, keyId, createdAt]
          );
          imported++;

        } else if (importType === 'diary') {
          // Validate diary entry
          if (!entry.content || typeof entry.content !== 'string' || entry.content.trim().length === 0) {
            errors.push({ index: i, error: 'Diary entry must have non-empty "content" string' });
            continue;
          }

          if (entry.content.length > 50000) {
            errors.push({ index: i, error: 'Diary content exceeds 50000 character limit' });
            continue;
          }

          const entryType = entry.entry_type || 'text';
          if (!['text', 'voice', 'video'].includes(entryType)) {
            errors.push({ index: i, error: 'entry_type must be "text", "voice", or "video"' });
            continue;
          }

          // Encrypt and insert
          const { encrypted: contentEncrypted, keyId } = encrypt(entry.content.trim());
          const createdAt = entry.created_at || new Date().toISOString();

          db.run(
            `INSERT INTO diary_entries (client_id, entry_type, content_encrypted, encryption_key_id, payload_version, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, ?, datetime('now'))`,
            [clientId, entryType, contentEncrypted, keyId, createdAt]
          );
          imported++;
        }
      }

      if (imported > 0) {
        saveDatabase();
      }

      // Audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'data_import', 'user', clientId, JSON.stringify({
          import_type: importType,
          total_entries: fileContent.entries.length,
          imported: imported,
          errors: errors.length
        })]
      );
      saveDatabase();

      logger.info(`Therapist ${therapistId} imported ${imported}/${fileContent.entries.length} ${importType} for client ${clientId}`);

      // If ALL entries failed validation, return error
      if (imported === 0 && errors.length > 0) {
        return res.status(400).json({
          error: 'All entries failed validation. No data was imported.',
          validation_errors: errors,
          imported: 0,
          total: fileContent.entries.length
        });
      }

      res.json({
        message: `Successfully imported ${imported} ${importType}`,
        imported: imported,
        total: fileContent.entries.length,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      logger.error('Import error: ' + error.message);
      res.status(500).json({ error: 'Failed to import data: ' + error.message });
    }
  });
});

module.exports = router;
