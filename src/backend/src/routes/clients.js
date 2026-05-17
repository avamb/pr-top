// Client Routes - Therapist client management
const express = require('express');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkClientLimit, getClientCount, getClientLimit } = require('../utils/planLimits');
const { encrypt, decrypt } = require('../services/encryption');
const { verifyClientConsent } = require('../utils/consentCheck');
const telegramNotify = require('../utils/telegramNotify');
const inquiriesService = require('../services/inquiries');
const assignmentsService = require('../services/assignments');
const assignmentReports = require('../services/assignmentReports');
const supervisionShare = require('../services/supervisionShare');

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

// POST /api/clients/solo - Create a solo-mode client (T-06).
// Solo mode is a therapist-only "smart notebook" — the client never connects
// to the bot, has no telegram_id, and no invite_code. Useful for:
//  - psychoanalysts whose clients won't use a chatbot
//  - clients with paranoid traits
//  - therapists who simply want a personal notebook for a case file.
//
// Behaviour vs the legacy invite-code flow:
//  - role='client', therapist_id=THIS therapist (link is created immediately)
//  - mode='solo', telegram_id=NULL, invite_code=NULL (not generated)
//  - consent_therapist_access=1 auto-granted (no other party to consent)
//  - consent_version=0 (the consent UX is N/A in solo mode)
//
// Body: { first_name?, last_name?, email?, language?, note? }
//   first_name + last_name OR email is required (display name)
//   note (optional ≤2000 chars) is encrypted into therapist_notes for context.
router.post('/solo', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const body = req.body || {};

    const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
    const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const language = (typeof body.language === 'string' ? body.language.trim().toLowerCase() : 'en') || 'en';
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    // Need at least a name or email to identify the client
    if (!firstName && !lastName && !rawEmail) {
      return res.status(400).json({ error: 'A first name, last name, or email is required to identify the client.' });
    }

    // Validate field lengths (defensive)
    if (firstName.length > 100 || lastName.length > 100) {
      return res.status(400).json({ error: 'Name fields must be 100 characters or less.' });
    }
    if (rawEmail && rawEmail.length > 255) {
      return res.status(400).json({ error: 'Email must be 255 characters or less.' });
    }
    if (note.length > 2000) {
      return res.status(400).json({ error: 'Note must be 2000 characters or less.' });
    }

    // Validate email format if provided
    if (rawEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawEmail)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
      // Email must be unique across all users (case-insensitive)
      const emailDup = db.exec("SELECT id FROM users WHERE email = ?", [rawEmail]);
      if (emailDup.length > 0 && emailDup[0].values.length > 0) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
      }
    }

    // Validate language against supported set
    const allowedLanguages = ['en', 'ru', 'es', 'uk'];
    if (!allowedLanguages.includes(language)) {
      return res.status(400).json({ error: 'Unsupported language. Allowed: en, ru, es, uk.' });
    }

    // Enforce plan client limit — solo clients still consume a slot
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

    // Insert solo client row.
    //   - mode='solo'
    //   - telegram_id=NULL, invite_code=NULL (solo never connects to the bot)
    //   - consent_therapist_access=1 auto-granted (no other party)
    //   - consent_version=0 (extended-consent flow does not apply to solo)
    db.run(
      `INSERT INTO users (
         email, role, therapist_id, mode, language,
         consent_therapist_access, consent_version,
         first_name, last_name,
         created_at, updated_at
       ) VALUES (?, 'client', ?, 'solo', ?, 1, 0, ?, ?, datetime('now'), datetime('now'))`,
      [rawEmail || null, therapistId, language, firstName || null, lastName || null]
    );

    const newIdResult = db.exec('SELECT last_insert_rowid()');
    const newClientId = newIdResult[0].values[0][0];

    // Optional initial note — stored encrypted as a therapist_notes row so it
    // shows up in the Notes tab right away.
    if (note) {
      const encryptedNote = encrypt(note);
      db.run(
        `INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted, encryption_key_id, payload_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [therapistId, newClientId, encryptedNote.encrypted, encryptedNote.keyId, encryptedNote.keyVersion]
      );
    }

    // Audit log
    db.run(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
       VALUES (?, 'solo_client_created', 'user', ?, ?, datetime('now'))`,
      [therapistId, newClientId, JSON.stringify({
        client_id: newClientId,
        mode: 'solo',
        had_initial_note: !!note,
        had_email: !!rawEmail
      })]
    );

    saveDatabaseAfterWrite();

    logger.info(`T-06: Solo client created id=${newClientId} by therapist=${therapistId}`);

    res.status(201).json({
      message: 'Solo client created successfully',
      client: {
        id: newClientId,
        telegram_id: null,
        email: rawEmail || null,
        consent_therapist_access: true,
        language: language,
        mode: 'solo',
        first_name: firstName || '',
        last_name: lastName || '',
        phone: '',
        telegram_username: '',
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Solo client create error: ' + error.message);
    res.status(500).json({ error: 'Failed to create solo client' });
  }
});

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

    // Get paginated results with last activity indicator and active SOS count
    const offset = (page - 1) * perPage;
    const result = db.exec(
      `SELECT u.id, u.telegram_id, u.email, u.consent_therapist_access, u.language, u.created_at, u.updated_at,
              (SELECT MAX(created_at) FROM (
                SELECT created_at FROM diary_entries WHERE client_id = u.id AND (is_private = 0 OR is_private IS NULL)
                UNION ALL
                SELECT created_at FROM therapist_notes WHERE client_id = u.id
                UNION ALL
                SELECT created_at FROM sessions WHERE client_id = u.id
              )) AS last_activity,
              u.first_name, u.last_name, u.phone, u.telegram_username,
              (SELECT COUNT(*) FROM sos_events WHERE client_id = u.id AND status != 'resolved') AS active_sos_count,
              u.mode
       FROM users u
       WHERE ${whereClause}
       ORDER BY active_sos_count DESC, last_activity DESC NULLS LAST, u.created_at DESC
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
      last_activity: row[7] || null,
      first_name: row[8] || '',
      last_name: row[9] || '',
      phone: row[10] || '',
      telegram_username: row[11] || '',
      active_sos_count: row[12] || 0,
      mode: row[13] || 'bot_connected'
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
      "SELECT id, telegram_id, email, consent_therapist_access, language, created_at, updated_at, first_name, last_name, phone, telegram_username, reminders_enabled, mode FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );

    if (clientResult.length === 0 || clientResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const row = clientResult[0].values[0];
    // T-16: reminders_enabled is a tri-state (NULL = inherit, 0 = off, 1 = on)
    let remindersEnabled = null;
    if (row[11] === 1) remindersEnabled = true;
    else if (row[11] === 0) remindersEnabled = false;

    res.json({
      client: {
        id: row[0],
        telegram_id: row[1],
        email: row[2],
        consent_therapist_access: !!row[3],
        language: row[4],
        created_at: row[5],
        updated_at: row[6],
        first_name: row[7] || '',
        last_name: row[8] || '',
        phone: row[9] || '',
        telegram_username: row[10] || '',
        reminders_enabled: remindersEnabled,
        mode: row[12] || 'bot_connected'
      }
    });
  } catch (error) {
    logger.error('Get client detail error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch client details' });
  }
});

// PUT /api/clients/:id - Update client-level preferences (T-16: reminders override).
// Tri-state for reminders_enabled:
//   true  -> force reminders ON for this client (overrides therapist default)
//   false -> force reminders OFF for this client (overrides therapist default)
//   null  -> clear override, fall back to therapist's reminders_enabled_default
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const { reminders_enabled } = req.body || {};

    // Verify ownership before any update
    const ownership = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );
    if (ownership.length === 0 || ownership[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const updates = [];
    const params = [];

    if (reminders_enabled !== undefined) {
      let value;
      if (reminders_enabled === null) {
        value = null;
      } else if (reminders_enabled === true || reminders_enabled === 1) {
        value = 1;
      } else if (reminders_enabled === false || reminders_enabled === 0) {
        value = 0;
      } else {
        return res.status(400).json({ error: 'reminders_enabled must be true, false, or null' });
      }
      updates.push('reminders_enabled = ?');
      params.push(value);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(clientId);

    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    saveDatabaseAfterWrite();

    // Return the updated client (same shape as GET /:id)
    const refreshed = db.exec(
      "SELECT id, telegram_id, email, consent_therapist_access, language, created_at, updated_at, first_name, last_name, phone, telegram_username, reminders_enabled, mode FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );
    const row = refreshed[0].values[0];
    let remindersEnabled = null;
    if (row[11] === 1) remindersEnabled = true;
    else if (row[11] === 0) remindersEnabled = false;

    logger.info(`Client preferences updated by therapist ${therapistId} for client ${clientId}: reminders_enabled=${remindersEnabled}`);

    res.json({
      message: 'Client updated successfully',
      client: {
        id: row[0],
        telegram_id: row[1],
        email: row[2],
        consent_therapist_access: !!row[3],
        language: row[4],
        created_at: row[5],
        updated_at: row[6],
        first_name: row[7] || '',
        last_name: row[8] || '',
        phone: row[9] || '',
        telegram_username: row[10] || '',
        reminders_enabled: remindersEnabled,
        mode: row[12] || 'bot_connected'
      }
    });
  } catch (error) {
    logger.error('Update client error: ' + error.message);
    res.status(500).json({ error: 'Failed to update client' });
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

    // Verify client consent (uses shared helper with audit logging)
    const consentCheck = verifyClientConsent(therapistId, clientId, 'diary');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    // Build query with optional type filter
    // T-12: therapist-facing list MUST exclude entries marked private by the
    // client (is_private = 1). The IS NULL guard keeps pre-migration rows visible.
    let whereClause = 'client_id = ? AND (is_private = 0 OR is_private IS NULL)';
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
        `SELECT id, entry_type, content_encrypted, transcript_encrypted, encryption_key_id, payload_version, created_at, updated_at, embedding_ref, audio_file_ref, transcription_status
         FROM diary_entries WHERE ${whereClause}
         ORDER BY created_at DESC`,
        params
      );

      let allEntries = (allResult.length > 0 ? allResult[0].values : []).map(row => {
        let content = null;
        let transcript = null;
        try { if (row[2]) content = decrypt(row[2]); } catch (e) { content = '[decryption error]'; }
        try { if (row[3]) transcript = decrypt(row[3]); } catch (e) { transcript = '[decryption error]'; }
        return { id: row[0], entry_type: row[1], content, transcript, created_at: row[6], updated_at: row[7], embedding_ref: row[8] || null, has_audio_file: !!row[9], transcription_status: row[10] || null };
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
      saveDatabaseAfterWrite();

      return res.json({ entries, total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) });
    }

    // No search: use efficient SQL-level pagination
    const countResult = db.exec(`SELECT COUNT(*) FROM diary_entries WHERE ${whereClause}`, params);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated entries
    const result = db.exec(
      `SELECT id, entry_type, content_encrypted, transcript_encrypted, encryption_key_id, payload_version, created_at, updated_at, embedding_ref, audio_file_ref, transcription_status
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
        embedding_ref: row[8] || null,
        has_audio_file: !!row[9],
        transcription_status: row[10] || null
      };
    });

    // Record data access in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_diary', 'client', clientId, JSON.stringify({ entries_count: entries.length, page })]
    );
    saveDatabaseAfterWrite();

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

    // Verify entry exists, belongs to this client, and is not client-private (T-12).
    const entryResult = db.exec(
      'SELECT id FROM diary_entries WHERE id = ? AND client_id = ? AND (is_private = 0 OR is_private IS NULL)',
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

    // Delete the diary entry (visible non-private entries only)
    db.run('DELETE FROM diary_entries WHERE id = ? AND client_id = ? AND (is_private = 0 OR is_private IS NULL)', [entryId, clientId]);
    saveDatabaseAfterWrite();

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'delete_diary', 'diary_entry', entryId, JSON.stringify({ client_id: parseInt(clientId) })]
    );
    saveDatabaseAfterWrite();

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
    saveDatabaseAfterWrite();

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
    saveDatabaseAfterWrite();

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
    saveDatabaseAfterWrite();

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
    saveDatabaseAfterWrite();

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
    saveDatabaseAfterWrite();

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
      // T-12: hide client-private diary entries from therapist timeline.
      const countResult = db.exec(
        `SELECT COUNT(*) FROM diary_entries WHERE client_id = ? AND (is_private = 0 OR is_private IS NULL)${dateFilter}`,
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
      // T-12: omit client-private diary entries from therapist timeline.
      const diaryResult = db.exec(
        `SELECT id, 'diary' as type, created_at FROM diary_entries WHERE client_id = ? AND (is_private = 0 OR is_private IS NULL)${dateFilter}`,
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
          'SELECT id, entry_type, content_encrypted, transcript_encrypted, created_at, audio_file_ref, transcription_status FROM diary_entries WHERE id = ?',
          [item.id]
        );
        if (result.length > 0 && result[0].values.length > 0) {
          const row = result[0].values[0];
          let content = null;
          let transcript = null;
          try { if (row[2]) content = decrypt(row[2]); } catch (e) { content = '[decryption error]'; }
          try { if (row[3]) transcript = decrypt(row[3]); } catch (e) { transcript = '[decryption error]'; }
          const audioFileRef = row[5];
          timeline.push({ type: 'diary', id: row[0], entry_type: row[1], content, transcript, created_at: row[4], has_audio_file: !!audioFileRef, audio_file_ref: audioFileRef || null, transcription_status: row[6] || null });
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
    saveDatabaseAfterWrite();

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
// T-02: includes title + inquiry_id, sorts by meeting_date (scheduled_at)
// with created_at as the tiebreaker, and supports an optional inquiry_id
// query parameter for filtering. Pass `inquiry_id=null` (literal string) or
// `inquiry_id=none` to fetch only sessions with no inquiry attached.
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

    // Optional inquiry filter (T-02 + T-01).
    // - `inquiry_id=<positive int>` → only sessions linked to that inquiry
    // - `inquiry_id=none` or `inquiry_id=null` → only sessions with no inquiry
    // - omitted → all sessions
    let inquiryClause = '';
    const inquiryParams = [];
    const rawInquiry = req.query.inquiry_id;
    if (rawInquiry !== undefined && rawInquiry !== '') {
      if (rawInquiry === 'none' || rawInquiry === 'null') {
        inquiryClause = ' AND inquiry_id IS NULL';
      } else {
        const inqId = parseInt(rawInquiry, 10);
        if (Number.isNaN(inqId) || inqId <= 0) {
          return res.status(400).json({ error: 'inquiry_id must be a positive integer, "none", or "null"' });
        }
        inquiryClause = ' AND inquiry_id = ?';
        inquiryParams.push(inqId);
      }
    }

    // Get total count (respects the optional inquiry filter)
    const countResult = db.exec(
      `SELECT COUNT(*) FROM sessions WHERE therapist_id = ? AND client_id = ?${inquiryClause}`,
      [therapistId, clientId, ...inquiryParams]
    );
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated sessions. Sort by COALESCE(scheduled_at, created_at)
    // so that sessions without an explicit meeting_date still slot in by
    // upload time (defensive — the T-02 backfill should mean every row has
    // a non-null scheduled_at, but this guards against future inserts that
    // forget the column).
    const result = db.exec(
      `SELECT id, audio_ref, transcript_encrypted, summary_encrypted, status, scheduled_at, created_at, updated_at,
              title, inquiry_id
       FROM sessions
       WHERE therapist_id = ? AND client_id = ?${inquiryClause}
       ORDER BY COALESCE(scheduled_at, created_at) DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [therapistId, clientId, ...inquiryParams, perPage, offset]
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
        meeting_date: row[5],
        created_at: row[6],
        updated_at: row[7],
        title: row[8] || null,
        inquiry_id: row[9] != null ? row[9] : null
      };
    });

    // Audit log: reading client sessions (Class A - summaries)
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'read_sessions', 'client', clientId, JSON.stringify({ sessions_count: sessions.length, page, inquiry_id: rawInquiry || null })]
    );
    saveDatabaseAfterWrite();

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

    // Get exercise deliveries for this client.
    // T-22: also surface response_encrypted so the dashboard can render the
    // client's "Final" answer alongside per-run "Running notes" comments
    // (which come from the polymorphic comments table, entity_type =
    // 'exercise_completion').
    const result = db.exec(
      `SELECT ed.id, ed.exercise_id, ed.status, ed.sent_at, ed.completed_at,
              e.title_en, e.title_ru, e.title_es, e.category, e.description_en,
              ed.response_encrypted
       FROM exercise_deliveries ed
       LEFT JOIN exercises e ON ed.exercise_id = e.id
       WHERE ed.therapist_id = ? AND ed.client_id = ?
       ORDER BY ed.sent_at DESC`,
      [therapistId, clientId]
    );

    const deliveries = (result.length > 0 ? result[0].values : []).map(row => {
      let finalResponse = null;
      if (row[10]) {
        try {
          finalResponse = decrypt(row[10]);
        } catch (e) {
          logger.warn(`Exercise delivery ${row[0]}: response decryption failed: ${e.message}`);
          finalResponse = '[decryption error]';
        }
      }
      return {
        id: row[0],
        exercise_id: row[1],
        status: row[2],
        sent_at: row[3],
        completed_at: row[4],
        exercise_title: row[5] || row[6] || row[7] || 'Unknown',
        exercise_category: row[8],
        exercise_description: row[9],
        // T-22: client's final exercise response (decrypted at app layer).
        // null until the client completes the exercise.
        final_response: finalResponse
      };
    });

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

    // T-06: Solo clients have no bot side, so exercise delivery is meaningless.
    const modeRow = db.exec("SELECT mode FROM users WHERE id = ?", [clientId]);
    const clientMode = (modeRow.length > 0 && modeRow[0].values.length > 0) ? modeRow[0].values[0][0] : 'bot_connected';
    if (clientMode === 'solo') {
      return res.status(403).json({
        error: 'Exercises cannot be sent to a solo (notebook-only) client. The client is not connected to the bot.'
      });
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

    saveDatabaseAfterWrite();

    // Notify client via Telegram (real outbound delivery, non-blocking)
    if (clientTelegramId) {
      // Get client language for localized notification
      const clientLangResult = db.exec("SELECT language FROM users WHERE id = ?", [clientId]);
      const clientLang = (clientLangResult.length > 0 && clientLangResult[0].values.length > 0) ? clientLangResult[0].values[0][0] : 'en';

      logger.info(`[TELEGRAM NOTIFICATION] Sending exercise notification to client ${clientTelegramId}: "${exerciseTitle}" (delivery #${deliveryId})`);
      telegramNotify.sendExerciseNotification(clientTelegramId, exerciseTitle, clientLang)
        .then(result => {
          if (result.sent) {
            logger.info(`Exercise Telegram notification delivered to client ${clientTelegramId} (delivery #${deliveryId})`);
          } else {
            logger.warn(`Exercise Telegram notification not delivered to ${clientTelegramId}: ${result.error}`);
          }
        })
        .catch(err => {
          logger.error(`Exercise Telegram notification error for client ${clientTelegramId}: ${err.message}`);
        });
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

    saveDatabaseAfterWrite();

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
// Note: SOS events are emergency alerts - therapist can view them without consent
// (client explicitly triggered the SOS, implying they want therapist attention)
router.get('/:id/sos', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;

    // Verify client belongs to this therapist (but NOT consent - SOS is emergency)
    const clientCheck = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );
    if (clientCheck.length === 0 || clientCheck[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
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

    // Verify client belongs to this therapist (no consent needed for SOS actions)
    const clientCheck = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );
    if (clientCheck.length === 0 || clientCheck[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
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
    saveDatabaseAfterWrite();

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

// PUT /api/clients/:id/sos/:sosId/resolve - Therapist resolves SOS event
router.put('/:id/sos/:sosId/resolve', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const sosId = req.params.sosId;

    // Verify client belongs to this therapist (no consent needed for SOS actions)
    const clientCheck = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );
    if (clientCheck.length === 0 || clientCheck[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
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
    if (currentStatus === 'resolved') {
      return res.json({
        message: 'SOS event already resolved',
        sos_event: { id: parseInt(sosId), status: 'resolved' }
      });
    }

    // Update SOS event status to resolved
    db.run(
      "UPDATE sos_events SET status = 'resolved' WHERE id = ?",
      [sosId]
    );

    // Record in audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'sos_resolved', 'sos_event', sosId, JSON.stringify({ client_id: parseInt(clientId), therapist_id: therapistId, previous_status: currentStatus })]
    );
    saveDatabaseAfterWrite();

    logger.info(`Therapist ${therapistId} resolved SOS event #${sosId} for client ${clientId}`);

    res.json({
      message: 'SOS event resolved',
      sos_event: {
        id: parseInt(sosId),
        client_id: parseInt(clientId),
        therapist_id: therapistId,
        status: 'resolved'
      }
    });
  } catch (error) {
    logger.error('Resolve SOS error: ' + error.message);
    res.status(500).json({ error: 'Failed to resolve SOS event' });
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
        saveDatabaseAfterWrite();
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
      saveDatabaseAfterWrite();

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

    // Fetch all diary entries (decrypted), excluding T-12 client-private entries.
    var diaryResult = db.exec(
      "SELECT id, entry_type, content_encrypted, transcript_encrypted, created_at, updated_at FROM diary_entries WHERE client_id = ? AND (is_private = 0 OR is_private IS NULL) ORDER BY created_at DESC",
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
    saveDatabaseAfterWrite();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.json(exportData);
  } catch (error) {
    logger.error('Diary export error: ' + error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// POST /api/clients/import-bulk - Bulk client import from CSV or JSON file
// Creates multiple client records at once, useful for platform migration
const { v4: uuidv4 } = require('uuid');

const bulkImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/json', 'text/csv', 'application/vnd.ms-excel'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.json') || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are accepted'), false);
    }
  }
});

function parseCSVContent(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { error: 'CSV must have a header row and at least one data row' };

  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

  // Validate required columns
  if (!headers.includes('email') && !headers.includes('name')) {
    return { error: 'CSV must have at least an "email" or "name" column' };
  }

  const clients = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      errors.push({ row: i + 1, error: 'Column count mismatch (expected ' + headers.length + ', got ' + values.length + ')' });
      continue;
    }

    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx].trim(); });
    clients.push(obj);
  }

  return { clients, errors };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/import-bulk', (req, res, next) => {
  bulkImportUpload.single('file')(req, res, (err) => {
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

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please provide a CSV or JSON file.' });
      }

      // Check subscription - get plan and limits
      const limitCheck = checkClientLimit(therapistId);
      if (!limitCheck.plan) {
        return res.status(403).json({ error: 'No active subscription' });
      }

      const rawText = req.file.buffer.toString('utf8');
      let clientRows = [];
      let parseErrors = [];
      const isCSV = req.file.originalname.endsWith('.csv') || req.file.mimetype === 'text/csv' || req.file.mimetype === 'application/vnd.ms-excel';

      if (isCSV) {
        const parsed = parseCSVContent(rawText);
        if (parsed.error) {
          return res.status(400).json({ error: parsed.error });
        }
        clientRows = parsed.clients;
        parseErrors = parsed.errors || [];
      } else {
        // JSON format
        try {
          const data = JSON.parse(rawText);
          if (Array.isArray(data)) {
            clientRows = data;
          } else if (data.clients && Array.isArray(data.clients)) {
            clientRows = data.clients;
          } else {
            return res.status(400).json({
              error: 'Invalid JSON format. Expected an array of client objects or { "clients": [...] }'
            });
          }
        } catch (parseErr) {
          return res.status(400).json({ error: 'Invalid JSON file: ' + parseErr.message });
        }
      }

      if (clientRows.length === 0) {
        return res.status(400).json({ error: 'No client records found in the file' });
      }

      if (clientRows.length > 200) {
        return res.status(400).json({ error: 'Too many records. Maximum 200 clients per import.' });
      }

      // Check tier limit
      const currentCount = limitCheck.current;
      const limit = limitCheck.limit;
      const plan = limitCheck.plan;

      if (plan !== 'premium' && limit > 0 && (currentCount + clientRows.length) > limit) {
        const available = Math.max(0, limit - currentCount);
        return res.status(403).json({
          error: 'Import would exceed client limit',
          message: 'Your ' + plan + ' plan allows ' + limit + ' clients. You have ' + currentCount + ' and are trying to import ' + clientRows.length + '. Available slots: ' + available + '.',
          current: currentCount,
          limit: limit,
          plan: plan,
          requested: clientRows.length,
          available: available
        });
      }

      // Check for existing emails in DB to detect duplicates
      const existingEmails = new Set();
      const emailResult = db.exec("SELECT email FROM users WHERE email IS NOT NULL");
      if (emailResult.length > 0) {
        emailResult[0].values.forEach(row => {
          if (row[0]) existingEmails.add(row[0].toLowerCase());
        });
      }

      // Process each client
      const created = [];
      const skipped = [];
      const rowErrors = [...parseErrors];
      const seenEmails = new Set();

      clientRows.forEach((row, index) => {
        const rowNum = index + (isCSV ? 2 : 1); // CSV has header row offset
        const email = (row.email || '').trim().toLowerCase();
        const name = (row.name || '').trim();
        const phone = (row.phone || '').trim();
        const notes = (row.notes || '').trim();
        const language = (row.language || 'en').trim().toLowerCase();

        // Validate required fields
        if (!email && !name) {
          rowErrors.push({ row: rowNum, error: 'Either email or name is required' });
          return;
        }

        // Validate email format if provided
        if (email && !validateEmail(email)) {
          rowErrors.push({ row: rowNum, error: 'Invalid email format: ' + email });
          return;
        }

        // Check for duplicates within the file
        if (email && seenEmails.has(email)) {
          skipped.push({ row: rowNum, email: email || name, reason: 'Duplicate within import file' });
          return;
        }

        // Check for existing email in DB
        if (email && existingEmails.has(email)) {
          skipped.push({ row: rowNum, email: email, reason: 'Email already exists in the system' });
          return;
        }

        if (email) seenEmails.add(email);

        // Generate invite code for this client
        var inviteCode = uuidv4().slice(0, 8).toUpperCase();
        // Ensure uniqueness
        var codeCheck = db.exec('SELECT id FROM users WHERE invite_code = ?', [inviteCode]);
        while (codeCheck.length > 0 && codeCheck[0].values.length > 0) {
          inviteCode = uuidv4().slice(0, 8).toUpperCase();
          codeCheck = db.exec('SELECT id FROM users WHERE invite_code = ?', [inviteCode]);
        }

        // Create client record
        db.run(
          "INSERT INTO users (email, role, therapist_id, invite_code, language, consent_therapist_access, created_at, updated_at) VALUES (?, 'client', ?, ?, ?, 0, datetime('now'), datetime('now'))",
          [email || null, therapistId, inviteCode, language]
        );

        // Get the new client ID
        var newIdResult = db.exec('SELECT last_insert_rowid()');
        var newClientId = newIdResult[0].values[0][0];

        // If notes provided, create a therapist note (encrypted)
        if (notes) {
          var encryptedNote = encrypt(notes);
          db.run(
            "INSERT INTO therapist_notes (therapist_id, client_id, note_encrypted, encryption_key_id, payload_version, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
            [therapistId, newClientId, encryptedNote.encrypted, encryptedNote.keyId, encryptedNote.keyVersion]
          );
        }

        // If name/phone provided, store in client context
        if (name || phone) {
          var contextParts = [];
          if (name) contextParts.push('Name: ' + name);
          if (phone) contextParts.push('Phone: ' + phone);
          var contextText = contextParts.join('\n');
          var encryptedContext = encrypt(contextText);
          db.run(
            "INSERT INTO client_context (client_id, therapist_id, anamnesis_encrypted, encryption_key_id, payload_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
            [newClientId, therapistId, encryptedContext.encrypted, encryptedContext.keyId, encryptedContext.keyVersion]
          );
        }

        created.push({
          id: newClientId,
          email: email || null,
          name: name || null,
          invite_code: inviteCode,
          row: rowNum
        });
      });

      // Save to disk
      saveDatabaseAfterWrite();

      // Audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'bulk_client_import', 'clients', 0, JSON.stringify({
          file: req.file.originalname,
          total_rows: clientRows.length,
          created: created.length,
          skipped: skipped.length,
          errors: rowErrors.length
        })]
      );
      saveDatabaseAfterWrite();

      logger.info('Bulk client import by therapist ' + therapistId + ': ' + created.length + ' created, ' + skipped.length + ' skipped, ' + rowErrors.length + ' errors');

      res.json({
        success: true,
        summary: {
          total_rows: clientRows.length,
          created: created.length,
          skipped: skipped.length,
          errors: rowErrors.length
        },
        created: created,
        skipped: skipped,
        errors: rowErrors
      });
    } catch (error) {
      logger.error('Bulk import error: ' + (error && error.message || error));
      res.status(500).json({ error: 'Import failed. Please try again.' });
    }
  });
});

// =====================================================================
// INQUIRIES (T-01) - therapist-tracked client work threads
// =====================================================================

// GET /api/clients/:id/inquiries - list inquiries for a client
// Optional filter: ?status=active|paused|closed
router.get('/:id/inquiries', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const status = req.query.status || null;

    const consentCheck = verifyClientConsent(therapistId, clientId, 'list_inquiries');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const inquiries = inquiriesService.listInquiries(therapistId, clientId, { status });
    res.json({ inquiries, total: inquiries.length });
  } catch (error) {
    logger.error('List inquiries error: ' + error.message);
    res.status(500).json({ error: 'Failed to list inquiries' });
  }
});

// GET /api/clients/:id/inquiries/:inquiryId - get a single inquiry
router.get('/:id/inquiries/:inquiryId', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const inquiryId = parseInt(req.params.inquiryId, 10);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return res.status(400).json({ error: 'Invalid inquiry id' });
    }

    const consentCheck = verifyClientConsent(therapistId, clientId, 'view_inquiry');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const inquiry = inquiriesService.getInquiry(therapistId, clientId, inquiryId);
    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }
    res.json(inquiry);
  } catch (error) {
    logger.error('Get inquiry error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch inquiry' });
  }
});

// POST /api/clients/:id/inquiries - create a new inquiry
router.post('/:id/inquiries', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const { title, description, status } = req.body || {};

    const consentCheck = verifyClientConsent(therapistId, clientId, 'create_inquiry');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const inquiry = inquiriesService.createInquiry({
      therapistId,
      clientId: parseInt(clientId, 10),
      title,
      description,
      status: status || 'active',
    });

    logger.info(`Therapist ${therapistId} created inquiry ${inquiry.id} for client ${clientId}`);
    res.status(201).json(inquiry);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Create inquiry error: ' + error.message);
    res.status(500).json({ error: 'Failed to create inquiry' });
  }
});

// PUT /api/clients/:id/inquiries/:inquiryId - update an inquiry
router.put('/:id/inquiries/:inquiryId', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const inquiryId = parseInt(req.params.inquiryId, 10);
    const { title, description, status } = req.body || {};

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return res.status(400).json({ error: 'Invalid inquiry id' });
    }

    const consentCheck = verifyClientConsent(therapistId, clientId, 'update_inquiry');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const inquiry = inquiriesService.updateInquiry({
      therapistId,
      clientId: parseInt(clientId, 10),
      inquiryId,
      title,
      description,
      status,
    });

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    logger.info(`Therapist ${therapistId} updated inquiry ${inquiryId} for client ${clientId}`);
    res.json(inquiry);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Update inquiry error: ' + error.message);
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

// POST /api/clients/:id/inquiries/:inquiryId/close - close an inquiry
router.post('/:id/inquiries/:inquiryId/close', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const inquiryId = parseInt(req.params.inquiryId, 10);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return res.status(400).json({ error: 'Invalid inquiry id' });
    }

    const consentCheck = verifyClientConsent(therapistId, clientId, 'close_inquiry');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const inquiry = inquiriesService.closeInquiry(therapistId, parseInt(clientId, 10), inquiryId);
    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    logger.info(`Therapist ${therapistId} closed inquiry ${inquiryId} for client ${clientId}`);
    res.json(inquiry);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Close inquiry error: ' + error.message);
    res.status(500).json({ error: 'Failed to close inquiry' });
  }
});

// DELETE /api/clients/:id/inquiries/:inquiryId - permanently delete an inquiry
router.delete('/:id/inquiries/:inquiryId', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const inquiryId = parseInt(req.params.inquiryId, 10);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return res.status(400).json({ error: 'Invalid inquiry id' });
    }

    const consentCheck = verifyClientConsent(therapistId, clientId, 'delete_inquiry');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const ok = inquiriesService.deleteInquiry(therapistId, parseInt(clientId, 10), inquiryId);
    if (!ok) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    logger.info(`Therapist ${therapistId} deleted inquiry ${inquiryId} for client ${clientId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete inquiry error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete inquiry' });
  }
});

// =====================================================================
// ASSIGNMENTS (T-03) — homework tasks the therapist sets per session/client
// =====================================================================

function parseAssignmentBody(body, { requireTitle = false } = {}) {
  const out = {};
  if (body == null || typeof body !== 'object') return out;
  if ('title' in body || requireTitle) out.title = body.title;
  if ('description' in body) out.description = body.description;
  if ('exercise_id' in body) out.exerciseId = body.exercise_id;
  if ('session_id' in body) out.sessionId = body.session_id;
  if ('report_frequency' in body) out.reportFrequency = body.report_frequency;
  if ('report_frequency_n' in body) out.reportFrequencyN = body.report_frequency_n;
  if ('deadline' in body) out.deadline = body.deadline;
  if ('status' in body) out.status = body.status;
  return out;
}

// GET /api/clients/:id/assignments — list all assignments for this client.
// Optional filters: ?status=active|completed|abandoned, ?session_id=N|none
router.get('/:id/assignments', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const status = req.query.status || null;
    const sessionId = req.query.session_id || null;

    const consentCheck = verifyClientConsent(therapistId, clientId, 'list_assignments');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const assignments = assignmentsService.listAssignments(therapistId, clientId, { status, sessionId });
    res.json({ assignments, total: assignments.length });
  } catch (error) {
    logger.error('List assignments error: ' + error.message);
    res.status(500).json({ error: 'Failed to list assignments' });
  }
});

// GET /api/clients/:id/assignments/:assignmentId — single assignment
router.get('/:id/assignments/:assignmentId', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.params.id;
    const assignmentId = parseInt(req.params.assignmentId, 10);
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Invalid assignment id' });
    }

    const consentCheck = verifyClientConsent(therapistId, clientId, 'view_assignment');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const assignment = assignmentsService.getAssignment(therapistId, clientId, assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (error) {
    logger.error('Get assignment error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// POST /api/clients/:id/assignments — create a new assignment for this client
router.post('/:id/assignments', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const body = parseAssignmentBody(req.body || {}, { requireTitle: true });

    const consentCheck = verifyClientConsent(therapistId, clientId, 'create_assignment');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const assignment = assignmentsService.createAssignment({
      therapistId,
      clientId,
      sessionId: body.sessionId || null,
      exerciseId: body.exerciseId,
      title: body.title,
      description: body.description || '',
      reportFrequency: body.reportFrequency || 'on_demand',
      reportFrequencyN: body.reportFrequencyN,
      deadline: body.deadline,
      status: body.status || 'active',
    });

    logger.info(`Therapist ${therapistId} created assignment ${assignment.id} for client ${clientId}`);
    if (assignment.status === 'active') assignmentsService.notifyClientOfNewAssignment(assignment);
    res.status(201).json(assignment);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Create assignment error: ' + error.message);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// PUT /api/clients/:id/assignments/:assignmentId — update assignment
router.put('/:id/assignments/:assignmentId', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const assignmentId = parseInt(req.params.assignmentId, 10);
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Invalid assignment id' });
    }
    const body = parseAssignmentBody(req.body || {});

    const consentCheck = verifyClientConsent(therapistId, clientId, 'update_assignment');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const assignment = assignmentsService.updateAssignment({
      therapistId,
      clientId,
      assignmentId,
      title: body.title,
      description: body.description,
      exerciseId: 'exerciseId' in body ? body.exerciseId : undefined,
      reportFrequency: body.reportFrequency,
      reportFrequencyN: body.reportFrequencyN,
      deadline: body.deadline,
      status: body.status,
    });

    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    logger.info(`Therapist ${therapistId} updated assignment ${assignmentId} for client ${clientId}`);
    res.json(assignment);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Update assignment error: ' + error.message);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// POST /api/clients/:id/assignments/:assignmentId/abandon — therapist abandons
router.post('/:id/assignments/:assignmentId/abandon', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const assignmentId = parseInt(req.params.assignmentId, 10);
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Invalid assignment id' });
    }

    const consentCheck = verifyClientConsent(therapistId, clientId, 'abandon_assignment');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const assignment = assignmentsService.abandonAssignment(therapistId, clientId, assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Abandon assignment error: ' + error.message);
    res.status(500).json({ error: 'Failed to abandon assignment' });
  }
});

// DELETE /api/clients/:id/assignments/:assignmentId
router.delete('/:id/assignments/:assignmentId', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const assignmentId = parseInt(req.params.assignmentId, 10);
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Invalid assignment id' });
    }

    const consentCheck = verifyClientConsent(therapistId, clientId, 'delete_assignment');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const ok = assignmentsService.deleteAssignment(therapistId, clientId, assignmentId);
    if (!ok) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete assignment error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// =====================================================================
// T-04: ASSIGNMENT REPORTS — freeform progress reports (feature #362)
// =====================================================================
//
// Each report is a small text or voice message the client posts to the bot
// while working on an assignment. The therapist sees a chronological feed.
// All endpoints are scoped to (therapist, client, assignment) and go through
// the standard consent gate.

function assertAssignmentOwnership(therapistId, clientId, assignmentId) {
  const a = assignmentsService.getAssignment(therapistId, clientId, assignmentId);
  if (!a) return { error: 'Assignment not found', status: 404 };
  return { assignment: a };
}

// GET /api/clients/:id/assignments/:aid/reports — chronological feed
router.get('/:id/assignments/:aid/reports', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const assignmentId = parseInt(req.params.aid, 10);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({ error: 'Invalid client id' });
    }
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Invalid assignment id' });
    }
    const consentCheck = verifyClientConsent(therapistId, clientId, 'list_assignment_reports');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }
    const own = assertAssignmentOwnership(therapistId, clientId, assignmentId);
    if (own.error) return res.status(own.status).json({ error: own.error });

    const order = (req.query.order || 'asc').toString();
    const reports = assignmentReports.listReportsForAssignment(assignmentId, { order });
    res.json({ assignment_id: assignmentId, reports, total: reports.length });
  } catch (error) {
    logger.error('List assignment reports error: ' + error.message);
    res.status(500).json({ error: 'Failed to list assignment reports' });
  }
});

// POST /api/clients/:id/assignments/:aid/reports — therapist-side creation
// (catch-up notes / testing). Body: { content, is_final? }
router.post('/:id/assignments/:aid/reports', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const assignmentId = parseInt(req.params.aid, 10);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({ error: 'Invalid client id' });
    }
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Invalid assignment id' });
    }
    const consentCheck = verifyClientConsent(therapistId, clientId, 'create_assignment_report');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }
    const own = assertAssignmentOwnership(therapistId, clientId, assignmentId);
    if (own.error) return res.status(own.status).json({ error: own.error });

    const body = req.body || {};
    const isFinal = body.is_final === true || body.is_final === 1 || body.is_final === '1';
    const report = assignmentReports.createReportAsTherapist({
      therapistId, clientId, assignmentId,
      content: body.content,
      isFinal,
    });
    res.status(201).json(report);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'forbidden') {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'not_found') {
      return res.status(404).json({ error: error.message });
    }
    logger.error('Create assignment report error: ' + error.message);
    res.status(500).json({ error: 'Failed to create assignment report' });
  }
});

// GET /api/clients/:id/assignments/:aid/reports/:rid — single report
router.get('/:id/assignments/:aid/reports/:rid', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const assignmentId = parseInt(req.params.aid, 10);
    const reportId = parseInt(req.params.rid, 10);
    if (!Number.isFinite(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Invalid report id' });
    }
    const consentCheck = verifyClientConsent(therapistId, clientId, 'view_assignment_report');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }
    const own = assertAssignmentOwnership(therapistId, clientId, assignmentId);
    if (own.error) return res.status(own.status).json({ error: own.error });

    const result = assignmentReports.getReportForTherapist(therapistId, reportId);
    if (result.notFound) return res.status(404).json({ error: 'Report not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    if (Number(result.report.assignment_id) !== assignmentId) {
      return res.status(404).json({ error: 'Report not found in this assignment' });
    }
    res.json(result.report);
  } catch (error) {
    logger.error('Get assignment report error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch assignment report' });
  }
});

// PATCH /api/clients/:id/assignments/:aid/reports/:rid/acceptance — therapist
// review action (pending|accepted|rejected). Body: { status }.
router.patch('/:id/assignments/:aid/reports/:rid/acceptance', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const assignmentId = parseInt(req.params.aid, 10);
    const reportId = parseInt(req.params.rid, 10);
    if (!Number.isFinite(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Invalid report id' });
    }
    const consentCheck = verifyClientConsent(therapistId, clientId, 'review_assignment_report');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }
    const own = assertAssignmentOwnership(therapistId, clientId, assignmentId);
    if (own.error) return res.status(own.status).json({ error: own.error });

    const status = (req.body || {}).status;
    const result = assignmentReports.setAcceptanceStatus(therapistId, reportId, status);
    if (result.notFound) return res.status(404).json({ error: 'Report not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    res.json(result.report);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Update report acceptance error: ' + error.message);
    res.status(500).json({ error: 'Failed to update acceptance status' });
  }
});

// DELETE /api/clients/:id/assignments/:aid/reports/:rid — therapist removes
router.delete('/:id/assignments/:aid/reports/:rid', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const assignmentId = parseInt(req.params.aid, 10);
    const reportId = parseInt(req.params.rid, 10);
    if (!Number.isFinite(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Invalid report id' });
    }
    const consentCheck = verifyClientConsent(therapistId, clientId, 'delete_assignment_report');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }
    const own = assertAssignmentOwnership(therapistId, clientId, assignmentId);
    if (own.error) return res.status(own.status).json({ error: own.error });

    const result = assignmentReports.deleteReport(therapistId, reportId);
    if (result.notFound) return res.status(404).json({ error: 'Report not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete assignment report error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete assignment report' });
  }
});

// =====================================================================
// SUPERVISION SHARE LINKS (T-17) - read-only client history for supervisor
// =====================================================================

function publicBaseUrl(req) {
  return (
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_URL ||
    `${req.protocol}://${req.get('host')}`
  );
}

// GET /api/clients/:id/supervision-share - list all share links for this client
router.get('/:id/supervision-share', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({ error: 'Invalid client id' });
    }

    // Verify client belongs to this therapist
    const db = getDatabase();
    const ownerCheck = db.exec(
      "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
      [clientId, therapistId]
    );
    if (ownerCheck.length === 0 || ownerCheck[0].values.length === 0) {
      return res.status(404).json({ error: 'Client not found or not linked to you' });
    }

    const rows = supervisionShare.listLinks(therapistId, clientId);
    const baseUrl = publicBaseUrl(req);
    res.json({ links: rows.map((r) => supervisionShare.toApiLink(r, baseUrl)) });
  } catch (error) {
    logger.error('List supervision share links error: ' + error.message);
    res.status(500).json({ error: 'Failed to list share links' });
  }
});

// POST /api/clients/:id/supervision-share - create a new share link
// Body: { ttl: '1d'|'7d'|'30d', anonymize: boolean, note?: string }
router.post('/:id/supervision-share', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({ error: 'Invalid client id' });
    }

    const ttl = (req.body && req.body.ttl) || '7d';
    const anonymize = req.body && Object.prototype.hasOwnProperty.call(req.body, 'anonymize')
      ? !!req.body.anonymize
      : true;
    const note = req.body && typeof req.body.note === 'string' ? req.body.note.trim() : '';

    const link = supervisionShare.createLink({
      therapistId,
      clientId,
      ttl,
      anonymize,
      note,
    });

    logger.info(`Therapist ${therapistId} created supervision share for client ${clientId} (ttl=${ttl}, anonymize=${anonymize})`);
    res.status(201).json({ link: supervisionShare.toApiLink(link, publicBaseUrl(req)) });
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'not_found') {
      return res.status(404).json({ error: error.message });
    }
    logger.error('Create supervision share error: ' + error.message);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// DELETE /api/clients/:id/supervision-share/:linkId - revoke (soft delete)
router.delete('/:id/supervision-share/:linkId', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const linkId = parseInt(req.params.linkId, 10);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({ error: 'Invalid client id' });
    }
    if (!Number.isFinite(linkId) || linkId <= 0) {
      return res.status(400).json({ error: 'Invalid link id' });
    }

    const link = supervisionShare.getLinkById(therapistId, linkId);
    if (!link || link.client_id !== clientId) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    const ok = supervisionShare.revokeLink(therapistId, linkId);
    if (!ok) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    logger.info(`Therapist ${therapistId} revoked supervision share link ${linkId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Revoke supervision share error: ' + error.message);
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

module.exports = router;
