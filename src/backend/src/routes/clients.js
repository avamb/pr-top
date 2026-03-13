// Client Routes - Therapist client management
const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkClientLimit } = require('../utils/planLimits');
const { encrypt, decrypt } = require('../services/encryption');
const { verifyClientConsent } = require('../utils/consentCheck');

const router = express.Router();

/**
 * Convert a local datetime string (e.g. '2026-03-12T00:00:00') in a given IANA timezone
 * to its UTC equivalent ISO string. If timezone is empty or invalid, returns the input as-is.
 * This enables timezone-aware date filtering: a user in Asia/Tokyo filtering for March 12
 * gets entries from March 12 00:00 Tokyo time (= March 11 15:00 UTC).
 */
function convertLocalDateToUTC(localDateTimeStr, timezone) {
  if (!timezone || typeof timezone !== 'string') {
    return localDateTimeStr;
  }
  try {
    // Validate the timezone
    Intl.DateTimeFormat('en-US', { timeZone: timezone });

    // Parse the local datetime components
    const parts = localDateTimeStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!parts) return localDateTimeStr;

    const [, year, month, day, hour, min, sec] = parts;

    // Create a date in UTC, then find the offset for the target timezone
    // We use an iterative approach: start with UTC guess, then adjust
    const utcGuess = new Date(Date.UTC(
      parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour), parseInt(min), parseInt(sec)
    ));

    // Get what time it would be in the target timezone if it were this UTC time
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
    const localParts = formatter.formatToParts(utcGuess);
    const getPart = (type) => {
      const p = localParts.find(x => x.type === type);
      return p ? parseInt(p.value) : 0;
    };

    const localYear = getPart('year');
    const localMonth = getPart('month');
    const localDay = getPart('day');
    const localHour = getPart('hour') === 24 ? 0 : getPart('hour');
    const localMin = getPart('minute');
    const localSec = getPart('second');

    // Calculate offset in milliseconds between UTC and local
    const localAsUTC = new Date(Date.UTC(localYear, localMonth - 1, localDay, localHour, localMin, localSec));
    const offsetMs = localAsUTC.getTime() - utcGuess.getTime();

    // The UTC time we want is: local_time - offset
    const targetUTC = new Date(utcGuess.getTime() - offsetMs);
    return targetUTC.toISOString().replace('Z', '').substring(0, 19);
  } catch (e) {
    // Invalid timezone or parse error - return original
    return localDateTimeStr;
  }
}

// All client routes require authenticated therapist
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

// GET /api/clients - List therapist's linked clients
// Supports: ?search=term&page=1&per_page=25&language=en
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const rawSearch = (req.query.search || '').trim();
    if (rawSearch.length > 500) {
      return res.status(400).json({ error: 'Search query too long (max 500 characters)' });
    }
    const search = rawSearch;
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
    const rawSearchQuery = (req.query.search || '').trim();
    if (rawSearchQuery.length > 500) {
      return res.status(400).json({ error: 'Search query too long (max 500 characters)' });
    }
    const searchQuery = rawSearchQuery.toLowerCase();
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

    // Date range filtering (timezone-aware: convert user's local date boundaries to UTC)
    const userTimezone = req.query.timezone || '';
    if (dateFrom && /^\d{4}-\d{2}-\d{2}/.test(dateFrom)) {
      whereClause += ' AND created_at >= ?';
      const fromStr = dateFrom.substring(0, 10) + 'T00:00:00';
      params.push(convertLocalDateToUTC(fromStr, userTimezone));
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}/.test(dateTo)) {
      whereClause += ' AND created_at <= ?';
      const toStr = dateTo.substring(0, 10) + 'T23:59:59';
      params.push(convertLocalDateToUTC(toStr, userTimezone));
    }

    // When search is active, we need to decrypt all entries first, then filter & paginate
    if (searchQuery) {
      // Fetch all matching entries (without pagination) for search filtering
      const allResult = db.exec(
        `SELECT id, entry_type, content_encrypted, transcript_encrypted, encryption_key_id, payload_version, created_at, updated_at, embedding_ref
         FROM diary_entries WHERE ${whereClause}
         ORDER BY created_at DESC`,
        params
      );

      let allEntries = (allResult.length > 0 ? allResult[0].values : []).map(row => {
        let content = null;
        let transcript = null;
        try { if (row[2]) content = decrypt(row[2]); } catch (e) { content = '[decryption error]'; }
        try { if (row[3]) transcript = decrypt(row[3]); } catch (e) { transcript = '[decryption error]'; }
        return { id: row[0], entry_type: row[1], content, transcript, created_at: row[6], updated_at: row[7], embedding_ref: row[8] || null };
      });

      // Filter by search query (searches decrypted content and transcript)
      allEntries = allEntries.filter(entry =>
        (entry.content && entry.content.toLowerCase().includes(searchQuery)) ||
        (entry.transcript && entry.transcript.toLowerCase().includes(searchQuery))
      );

      const total = allEntries.length;
      const entries = allEntries.slice(offset, offset + perPage);

      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'read_diary', 'client', clientId, JSON.stringify({ entries_count: entries.length, page, search: searchQuery })]
      );
      saveDatabase();

      return res.json({ entries, total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) });
    }

    // No search: use efficient SQL-level pagination
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

// DELETE /api/clients/:id/diary/:entryId - Delete a diary entry
router.delete('/:id/diary/:entryId', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const entryId = req.params.entryId;

    // Verify client exists and is linked to this therapist
    const clientResult = db.exec(
      "SELECT id, therapist_id, consent_therapist_access FROM users WHERE id = ? AND role = 'client'",
      [clientId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const clientRow = clientResult[0].values[0];
    if (String(clientRow[1]) !== String(therapistId)) {
      return res.status(403).json({ error: 'You are not authorized to manage this client\'s data' });
    }

    if (!clientRow[2]) {
      return res.status(403).json({ error: 'Client has not granted consent for data access' });
    }

    // Verify entry exists and belongs to this client
    const entryResult = db.exec(
      'SELECT id FROM diary_entries WHERE id = ? AND client_id = ?',
      [entryId, clientId]
    );

    if (entryResult.length === 0 || entryResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }

    // Delete associated vector embeddings
    db.run(
      "DELETE FROM vector_embeddings WHERE source_type = 'diary_entry' AND source_id = ?",
      [entryId]
    );

    // Delete the diary entry
    db.run('DELETE FROM diary_entries WHERE id = ? AND client_id = ?', [entryId, clientId]);
    saveDatabase();

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'delete_diary', 'diary_entry', entryId, JSON.stringify({ client_id: parseInt(clientId) })]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} deleted diary entry ${entryId} for client ${clientId}`);

    res.json({ success: true, message: 'Diary entry deleted successfully' });
  } catch (error) {
    logger.error('Delete diary entry error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete diary entry' });
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

    // Verify client belongs to this therapist AND has granted consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'create_note');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
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

// PUT /api/clients/:id/notes/:noteId - Update an existing therapist note
router.put('/:id/notes/:noteId', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const noteId = req.params.noteId;
    const { content, session_date } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    if (content.length > 50000) {
      return res.status(400).json({ error: 'Note content exceeds 50000 character limit' });
    }

    // Verify client consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'update_note');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    // Verify the note belongs to this therapist and client
    const noteResult = db.exec(
      'SELECT id, therapist_id, client_id, created_at FROM therapist_notes WHERE id = ? AND therapist_id = ? AND client_id = ?',
      [noteId, therapistId, clientId]
    );

    if (noteResult.length === 0 || noteResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const originalCreatedAt = noteResult[0].values[0][3];

    // Encrypt the updated content
    const { encrypted, keyVersion, keyId } = encrypt(content.trim());

    // Update the note (only updated_at changes, created_at stays the same)
    db.run(
      `UPDATE therapist_notes SET note_encrypted = ?, encryption_key_id = ?, payload_version = ?, session_date = ?, updated_at = datetime('now') WHERE id = ?`,
      [encrypted, keyId, keyVersion, session_date || null, noteId]
    );

    // Record in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'update_note', 'therapist_note', noteId, JSON.stringify({ client_id: clientId })]
    );
    saveDatabase();

    // Fetch the updated note to return accurate timestamps
    const updatedResult = db.exec(
      'SELECT id, created_at, updated_at FROM therapist_notes WHERE id = ?',
      [noteId]
    );

    const updatedRow = updatedResult[0].values[0];

    logger.info(`Therapist ${therapistId} updated note ${noteId} for client ${clientId}`);

    res.json({
      id: parseInt(noteId),
      therapist_id: therapistId,
      client_id: parseInt(clientId),
      content: content.trim(),
      session_date: session_date || null,
      created_at: updatedRow[1],
      updated_at: updatedRow[2]
    });
  } catch (error) {
    logger.error('Update note error: ' + error.message);
    res.status(500).json({ error: 'Failed to update note' });
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
    const rawNoteSearch = (req.query.search || '').trim();
    if (rawNoteSearch.length > 500) {
      return res.status(400).json({ error: 'Search query too long (max 500 characters)' });
    }
    const searchQuery = rawNoteSearch.toLowerCase();

    // Verify client belongs to this therapist OR therapist has existing notes for this client
    // (therapist retains access to their own notes even after client revokes consent)
    const clientResult = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    const clientLinked = clientResult.length > 0 && clientResult[0].values.length > 0;

    if (!clientLinked) {
      // Check if therapist has any notes for this client (own intellectual property)
      const notesExist = db.exec(
        "SELECT COUNT(*) FROM therapist_notes WHERE therapist_id = ? AND client_id = ?",
        [therapistId, clientId]
      );
      const noteCount = notesExist.length > 0 ? notesExist[0].values[0][0] : 0;
      if (noteCount === 0) {
        return res.status(404).json({ error: 'Client not found or not linked to you' });
      }
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

    // Verify client belongs to this therapist AND has granted consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'context');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
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
    const { anamnesis, current_goals, contraindications, ai_instructions, expected_updated_at } = req.body;

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

    // Verify client belongs to this therapist AND has granted consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'update_context');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
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

    // Optimistic concurrency control: check if data changed since client last fetched
    if (hasExisting && expected_updated_at) {
      const currentTimestamp = db.exec(
        'SELECT updated_at FROM client_context WHERE therapist_id = ? AND client_id = ?',
        [therapistId, clientId]
      );
      if (currentTimestamp.length > 0 && currentTimestamp[0].values.length > 0) {
        const dbUpdatedAt = currentTimestamp[0].values[0][0];
        if (dbUpdatedAt && dbUpdatedAt !== expected_updated_at) {
          // Conflict detected - return latest data so client can merge
          const latestRow = existing[0].values[0];
          const decryptConflict = (encrypted) => {
            if (!encrypted) return null;
            try { return decrypt(encrypted); } catch (e) { return '[decryption error]'; }
          };
          const latestUpdatedAt = db.exec(
            'SELECT updated_at FROM client_context WHERE therapist_id = ? AND client_id = ?',
            [therapistId, clientId]
          );
          return res.status(409).json({
            error: 'Context was modified by another session. Please review the latest version and try again.',
            conflict: true,
            latest_context: {
              id: latestRow[0],
              client_id: parseInt(clientId),
              therapist_id: therapistId,
              anamnesis: decryptConflict(latestRow[1]),
              current_goals: decryptConflict(latestRow[2]),
              contraindications: decryptConflict(latestRow[3]),
              ai_instructions: decryptConflict(latestRow[4]),
              updated_at: latestUpdatedAt[0].values[0][0]
            }
          });
        }
      }
    }

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

      const nowISO = new Date().toISOString();
      const updateParts = [
        'anamnesis_encrypted = ?',
        'current_goals_encrypted = ?',
        'contraindications_encrypted = ?',
        'ai_instructions_encrypted = ?',
        'updated_at = ?'
      ];

      const updateParams = [finalAnamnesis, finalGoals, finalContraindications, finalAiInstructions, nowISO];

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

      const insertNow = new Date().toISOString();
      db.run(
        `INSERT INTO client_context (therapist_id, client_id, anamnesis_encrypted, current_goals_encrypted,
         contraindications_encrypted, ai_instructions_encrypted, encryption_key_id, payload_version,
         created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          therapistId, clientId,
          anamnesisEnc ? anamnesisEnc.encrypted : null,
          goalsEnc ? goalsEnc.encrypted : null,
          contraindicationsEnc ? contraindicationsEnc.encrypted : null,
          aiInstructionsEnc ? aiInstructionsEnc.encrypted : null,
          encResult ? encResult.keyId : null,
          encResult ? encResult.keyVersion : null,
          insertNow, insertNow
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
// Supports pagination via page & per_page query params (default: page=1, per_page=50)
router.get('/:id/timeline', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const startDate = req.query.start_date || '';
    const endDate = req.query.end_date || '';
    const sourceType = req.query.type || ''; // Filter by source type: diary, note, session
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(req.query.per_page) || 50));

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

    // Build date filter clause (normalize date strings like diary endpoint)
    const userTimezone = req.query.timezone || '';
    let dateFilter = '';
    const dateParams = [];
    if (startDate && /^\d{4}-\d{2}-\d{2}/.test(startDate)) {
      dateFilter += ' AND created_at >= ?';
      const startDateStr = startDate.substring(0, 10) + 'T00:00:00';
      dateParams.push(convertLocalDateToUTC(startDateStr, userTimezone));
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}/.test(endDate)) {
      dateFilter += ' AND created_at <= ?';
      const endDateStr = endDate.substring(0, 10) + 'T23:59:59';
      dateParams.push(convertLocalDateToUTC(endDateStr, userTimezone));
    }

    // Validate source type filter
    const validTypes = ['diary', 'note', 'session'];
    const filterByType = sourceType && validTypes.includes(sourceType) ? sourceType : '';

    // First, get total counts efficiently (without decryption)
    let totalCount = 0;
    if (!filterByType || filterByType === 'diary') {
      const countResult = db.exec(
        `SELECT COUNT(*) FROM diary_entries WHERE client_id = ?${dateFilter}`,
        [clientId, ...dateParams]
      );
      if (countResult.length > 0) totalCount += countResult[0].values[0][0];
    }
    if (!filterByType || filterByType === 'note') {
      const countResult = db.exec(
        `SELECT COUNT(*) FROM therapist_notes WHERE therapist_id = ? AND client_id = ?${dateFilter}`,
        [therapistId, clientId, ...dateParams]
      );
      if (countResult.length > 0) totalCount += countResult[0].values[0][0];
    }
    if (!filterByType || filterByType === 'session') {
      const countResult = db.exec(
        `SELECT COUNT(*) FROM sessions WHERE therapist_id = ? AND client_id = ?${dateFilter}`,
        [therapistId, clientId, ...dateParams]
      );
      if (countResult.length > 0) totalCount += countResult[0].values[0][0];
    }

    const totalPages = Math.ceil(totalCount / perPage);

    // Use a UNION ALL approach for efficient paginated timeline
    // We fetch only created_at and id+type to sort, then paginate, then fetch full details
    // For simplicity with SQLite in-memory, we use a two-pass approach:
    // Pass 1: Get sorted IDs for the requested page (lightweight - no decryption)
    // Pass 2: Fetch full details only for items on this page

    const allItems = [];

    if (!filterByType || filterByType === 'diary') {
      const diaryResult = db.exec(
        `SELECT id, 'diary' as type, created_at FROM diary_entries WHERE client_id = ?${dateFilter}`,
        [clientId, ...dateParams]
      );
      if (diaryResult.length > 0) {
        for (const row of diaryResult[0].values) {
          allItems.push({ id: row[0], source: 'diary', created_at: row[2] });
        }
      }
    }

    if (!filterByType || filterByType === 'note') {
      const notesResult = db.exec(
        `SELECT id, 'note' as type, created_at FROM therapist_notes WHERE therapist_id = ? AND client_id = ?${dateFilter}`,
        [therapistId, clientId, ...dateParams]
      );
      if (notesResult.length > 0) {
        for (const row of notesResult[0].values) {
          allItems.push({ id: row[0], source: 'note', created_at: row[2] });
        }
      }
    }

    if (!filterByType || filterByType === 'session') {
      const sessionsResult = db.exec(
        `SELECT id, 'session' as type, created_at FROM sessions WHERE therapist_id = ? AND client_id = ?${dateFilter}`,
        [therapistId, clientId, ...dateParams]
      );
      if (sessionsResult.length > 0) {
        for (const row of sessionsResult[0].values) {
          allItems.push({ id: row[0], source: 'session', created_at: row[2] });
        }
      }
    }

    // Sort all items chronologically (newest first)
    allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply pagination
    const offset = (page - 1) * perPage;
    const pageItems = allItems.slice(offset, offset + perPage);

    // Now fetch full details only for items on this page (decrypt only what's needed)
    const timeline = [];
    for (const item of pageItems) {
      if (item.source === 'diary') {
        const result = db.exec(
          'SELECT id, entry_type, content_encrypted, transcript_encrypted, created_at FROM diary_entries WHERE id = ?',
          [item.id]
        );
        if (result.length > 0 && result[0].values.length > 0) {
          const row = result[0].values[0];
          let content = null;
          let transcript = null;
          try { if (row[2]) content = decrypt(row[2]); } catch (e) { content = '[decryption error]'; }
          try { if (row[3]) transcript = decrypt(row[3]); } catch (e) { transcript = '[decryption error]'; }
          timeline.push({ type: 'diary', id: row[0], entry_type: row[1], content, transcript, created_at: row[4] });
        }
      } else if (item.source === 'note') {
        const result = db.exec(
          'SELECT id, note_encrypted, session_date, created_at FROM therapist_notes WHERE id = ?',
          [item.id]
        );
        if (result.length > 0 && result[0].values.length > 0) {
          const row = result[0].values[0];
          let content = null;
          try { if (row[1]) content = decrypt(row[1]); } catch (e) { content = '[decryption error]'; }
          timeline.push({ type: 'note', id: row[0], content, session_date: row[2], created_at: row[3] });
        }
      } else if (item.source === 'session') {
        const result = db.exec(
          'SELECT id, audio_ref, transcript_encrypted, summary_encrypted, status, scheduled_at, created_at FROM sessions WHERE id = ?',
          [item.id]
        );
        if (result.length > 0 && result[0].values.length > 0) {
          const row = result[0].values[0];
          let summary = null;
          try { if (row[3]) summary = decrypt(row[3]); } catch (e) { summary = '[decryption error]'; }
          timeline.push({ type: 'session', id: row[0], has_audio: !!row[1], has_transcript: !!row[2], summary, status: row[4], scheduled_at: row[5], created_at: row[6] });
        }
      }
    }

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_timeline', 'client', clientId, JSON.stringify({ items_count: timeline.length, page, total: totalCount })]
    );
    saveDatabase();

    logger.info(`Therapist ${therapistId} accessed timeline for client ${clientId} (page ${page}/${totalPages}, ${timeline.length} items)`);

    res.json({
      timeline,
      total: totalCount,
      page,
      per_page: perPage,
      total_pages: totalPages,
      has_more: page < totalPages,
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

    // Verify client belongs to this therapist AND has granted consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'sessions');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
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

    // Verify client belongs to this therapist AND has granted consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'exercises');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
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

    // Verify client belongs to this therapist AND has granted consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'exercise_send');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    // Get telegram_id for notification
    const clientTgResult = db.exec(
      "SELECT telegram_id FROM users WHERE id = ?",
      [clientId]
    );
    const clientTelegramId = (clientTgResult.length > 0 && clientTgResult[0].values.length > 0) ? clientTgResult[0].values[0][0] : null;

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

// POST /api/clients/link - Superadmin-only direct client linking (bypasses invite+consent flow)
// Normal therapists must use the proper flow: therapist shares invite code → client enters code → client consents → link created
router.post('/link', requireRole('superadmin'), (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const { client_id, target_therapist_id } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    // Superadmin can link to themselves or specify a target therapist
    const linkToTherapistId = target_therapist_id || therapistId;

    // Check client limit before linking
    const limitCheck = checkClientLimit(linkToTherapistId);
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

    if (client[2] && client[2] !== linkToTherapistId) {
      return res.status(400).json({ error: 'Client is already linked to another therapist' });
    }

    // Superadmin direct link - sets consent since this is an admin override
    db.run(
      "UPDATE users SET therapist_id = ?, consent_therapist_access = 1, updated_at = datetime('now') WHERE id = ?",
      [linkToTherapistId, client_id]
    );

    // Record in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [req.user.id, 'superadmin_direct_link', 'user', client_id, JSON.stringify({ client_id: parseInt(client_id), therapist_id: linkToTherapistId, admin_id: req.user.id })]
    );

    saveDatabase();

    logger.info(`Superadmin ${req.user.id} directly linked client ${client_id} to therapist ${linkToTherapistId}`);

    res.json({
      message: 'Client linked successfully (superadmin override)',
      client_id: parseInt(client_id),
      therapist_id: linkToTherapistId
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

    // Verify client belongs to this therapist AND has granted consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'sos');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
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

    // Verify client belongs to this therapist AND has granted consent
    const consentCheck = verifyClientConsent(therapistId, clientId, 'sos_acknowledge');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
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

      // Verify client belongs to this therapist AND has granted consent
      const consentCheck = verifyClientConsent(therapistId, clientId, 'import');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
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
      res.status(500).json({ error: 'Something went wrong. Please try again later.' });
    }
  });
});

// GET /clients/:id/diary/export - Export diary entries as JSON file
router.get('/:id/diary/export', (req, res) => {
  try {
    var db = getDatabase();
    var therapistId = req.user.id;
    var clientId = req.params.id;

    // Verify client exists and is linked
    var clientResult = db.exec(
      "SELECT id, therapist_id, consent_therapist_access, email, telegram_id FROM users WHERE id = ? AND role = 'client'",
      [clientId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    var clientRow = clientResult[0].values[0];
    var clientTherapistId = clientRow[1];
    var hasConsent = clientRow[2];
    var clientEmail = clientRow[3];
    var clientTelegramId = clientRow[4];

    if (!clientTherapistId || String(clientTherapistId) !== String(therapistId)) {
      return res.status(403).json({ error: 'You are not authorized to access this client\'s data' });
    }

    if (!hasConsent) {
      return res.status(403).json({ error: 'Client has not granted consent for data access' });
    }

    // Fetch all diary entries (decrypted)
    var diaryResult = db.exec(
      "SELECT id, entry_type, content_encrypted, transcript_encrypted, created_at, updated_at FROM diary_entries WHERE client_id = ? ORDER BY created_at DESC",
      [clientId]
    );

    var entries = (diaryResult.length > 0 ? diaryResult[0].values : []).map(function(row) {
      var content = null;
      var transcript = null;
      try { if (row[2]) content = decrypt(row[2]); } catch (e) { content = '[decryption error]'; }
      try { if (row[3]) transcript = decrypt(row[3]); } catch (e) { transcript = '[decryption error]'; }
      return {
        id: row[0],
        entry_type: row[1],
        content: content,
        transcript: transcript,
        created_at: row[4],
        updated_at: row[5]
      };
    });

    var clientName = clientEmail || clientTelegramId || ('client_' + clientId);
    var safeClientName = clientName.replace(/[^a-zA-Z0-9_@.-]/g, '_');
    var dateStr = new Date().toISOString().split('T')[0];
    var filename = 'diary_export_' + safeClientName + '_' + dateStr + '.json';

    var exportData = {
      export_date: new Date().toISOString(),
      client_id: Number(clientId),
      client_identifier: clientName,
      total_entries: entries.length,
      entries: entries
    };

    // Log export action in audit
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'diary_export', 'client', clientId, JSON.stringify({ entries_count: entries.length })]
    );
    saveDatabase();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.json(exportData);
  } catch (error) {
    logger.error('Diary export error: ' + error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

module.exports = router;
