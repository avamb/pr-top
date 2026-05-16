// T-03: Assignments Service — concrete homework tasks the therapist sets at
// the end of a session. An assignment either references a library/custom
// exercise (exercise_id) OR is freeform (exercise_id IS NULL, title +
// description carry the instruction).
//
// title and description are encrypted at the application layer (Class A).
// All other fields are Class B (access-controlled plaintext).
//
// Status flow: active → completed | abandoned.
// Sessions can have 1+ assignments; deleting a session sets session_id=NULL on
// its assignments rather than deleting them (FK uses ON DELETE SET NULL).

const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');
const telegramNotify = require('../utils/telegramNotify');
const wsService = require('./websocketService');

const VALID_STATUSES = ['active', 'completed', 'abandoned'];
const VALID_FREQUENCIES = ['daily', 'every_n_days', 'weekly', 'on_demand'];

/**
 * Decrypt the encrypted columns of a raw assignment row.
 */
function decryptRow(row) {
  let title = '';
  let description = '';
  try {
    if (row.title_encrypted) title = decrypt(row.title_encrypted);
  } catch (e) {
    logger.warn(`assignments.decryptRow: failed to decrypt title for assignment ${row.id}: ${e.message}`);
    title = '';
  }
  try {
    if (row.description_encrypted) description = decrypt(row.description_encrypted);
  } catch (e) {
    logger.warn(`assignments.decryptRow: failed to decrypt description for assignment ${row.id}: ${e.message}`);
    description = '';
  }
  return {
    id: row.id,
    session_id: row.session_id,
    therapist_id: row.therapist_id,
    client_id: row.client_id,
    exercise_id: row.exercise_id,
    title,
    description,
    report_frequency: row.report_frequency,
    report_frequency_n: row.report_frequency_n,
    deadline: row.deadline,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    payload_version: row.payload_version,
  };
}

/**
 * Convert sql.js rows (column array + values) into objects for ergonomic use.
 */
function rowsToObjects(execResult) {
  if (!execResult || execResult.length === 0) return [];
  const { columns, values } = execResult[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

function audit(actorId, action, targetId, details = null) {
  try {
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, 'assignment', ?, ?, datetime('now'))",
      [actorId, action, targetId, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    logger.error(`assignments.audit: failed to log ${action}: ${e.message}`);
  }
}

/**
 * Validate report_frequency + report_frequency_n combo.
 * Throws an Error with code='invalid_input' on failure.
 */
function validateFrequency(frequency, frequencyN) {
  if (!VALID_FREQUENCIES.includes(frequency)) {
    const err = new Error('Invalid report_frequency');
    err.code = 'invalid_input';
    throw err;
  }
  if (frequency === 'every_n_days') {
    const n = parseInt(frequencyN, 10);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      const err = new Error('report_frequency_n must be an integer between 1 and 365');
      err.code = 'invalid_input';
      throw err;
    }
    return n;
  }
  // For non-every_n_days frequencies, the N column is meaningless; persist NULL.
  return null;
}

function validateTitle(title) {
  if (!title || typeof title !== 'string' || !title.trim()) {
    const err = new Error('Title is required');
    err.code = 'invalid_input';
    throw err;
  }
  if (title.length > 200) {
    const err = new Error('Title is too long (max 200 chars)');
    err.code = 'invalid_input';
    throw err;
  }
}

function validateDescription(description) {
  if (description == null) return;
  if (typeof description !== 'string') {
    const err = new Error('Description must be a string');
    err.code = 'invalid_input';
    throw err;
  }
  if (description.length > 5000) {
    const err = new Error('Description is too long (max 5000 chars)');
    err.code = 'invalid_input';
    throw err;
  }
}

function validateExerciseId(exerciseId, therapistId) {
  if (exerciseId == null) return null;
  const n = parseInt(exerciseId, 10);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error('Invalid exercise_id');
    err.code = 'invalid_input';
    throw err;
  }
  // Verify the exercise exists and is either a global template (is_custom=0)
  // or owned by this therapist (is_custom=1, therapist_id matches).
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      'SELECT id, is_custom, therapist_id FROM exercises WHERE id = ?',
      [n]
    )
  );
  if (rows.length === 0) {
    const err = new Error('Exercise not found');
    err.code = 'invalid_input';
    throw err;
  }
  const ex = rows[0];
  if (ex.is_custom === 1 && ex.therapist_id != null && Number(ex.therapist_id) !== Number(therapistId)) {
    const err = new Error('You do not own this exercise');
    err.code = 'invalid_input';
    throw err;
  }
  return n;
}

function validateDeadline(deadline) {
  if (deadline == null || deadline === '') return null;
  if (typeof deadline !== 'string') {
    const err = new Error('Deadline must be an ISO date string');
    err.code = 'invalid_input';
    throw err;
  }
  const parsed = new Date(deadline);
  if (isNaN(parsed.getTime())) {
    const err = new Error('Deadline is not a valid date');
    err.code = 'invalid_input';
    throw err;
  }
  return parsed.toISOString();
}

/**
 * List assignments for a (therapist, client) pair.
 * Optional filters: status, session_id (positive int OR 'none' for orphans).
 */
function listAssignments(therapistId, clientId, opts = {}) {
  const db = getDatabase();
  const { status = null, sessionId = null } = opts;

  let where = 'therapist_id = ? AND client_id = ?';
  const params = [therapistId, clientId];
  if (status && VALID_STATUSES.includes(status)) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (sessionId === 'none' || sessionId === 'null') {
    where += ' AND session_id IS NULL';
  } else if (sessionId != null) {
    const n = parseInt(sessionId, 10);
    if (Number.isInteger(n) && n > 0) {
      where += ' AND session_id = ?';
      params.push(n);
    }
  }

  // Active first, then by most recent creation
  const sql =
    `SELECT id, session_id, therapist_id, client_id, exercise_id,
            title_encrypted, description_encrypted,
            report_frequency, report_frequency_n, deadline,
            status, created_at, updated_at, completed_at, payload_version
     FROM assignments
     WHERE ${where}
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
              created_at DESC, id DESC`;
  const rows = rowsToObjects(db.exec(sql, params));
  return rows.map(decryptRow);
}

/**
 * List assignments attached to a specific session, scoped to a therapist.
 * Verifies the session belongs to the therapist first (caller should still
 * run the standard consent check on the client).
 */
function listAssignmentsForSession(therapistId, sessionId) {
  const db = getDatabase();
  const sessRows = rowsToObjects(
    db.exec(
      'SELECT id, therapist_id, client_id FROM sessions WHERE id = ?',
      [sessionId]
    )
  );
  if (sessRows.length === 0) {
    return { notFound: true };
  }
  if (Number(sessRows[0].therapist_id) !== Number(therapistId)) {
    return { forbidden: true };
  }
  const clientId = sessRows[0].client_id;
  const sql =
    `SELECT id, session_id, therapist_id, client_id, exercise_id,
            title_encrypted, description_encrypted,
            report_frequency, report_frequency_n, deadline,
            status, created_at, updated_at, completed_at, payload_version
     FROM assignments
     WHERE session_id = ? AND therapist_id = ?
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
              created_at DESC, id DESC`;
  const rows = rowsToObjects(db.exec(sql, [sessionId, therapistId]));
  return { clientId, assignments: rows.map(decryptRow) };
}

/**
 * Get a single assignment by id, scoped to a (therapist, client) pair.
 */
function getAssignment(therapistId, clientId, assignmentId) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, session_id, therapist_id, client_id, exercise_id,
              title_encrypted, description_encrypted,
              report_frequency, report_frequency_n, deadline,
              status, created_at, updated_at, completed_at, payload_version
       FROM assignments
       WHERE id = ? AND therapist_id = ? AND client_id = ?`,
      [assignmentId, therapistId, clientId]
    )
  );
  if (rows.length === 0) return null;
  return decryptRow(rows[0]);
}

/**
 * Get a single assignment by id, scoped to a client only (no therapist check).
 * Used by the bot endpoints where the client is the actor.
 */
function getAssignmentForClient(clientId, assignmentId) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, session_id, therapist_id, client_id, exercise_id,
              title_encrypted, description_encrypted,
              report_frequency, report_frequency_n, deadline,
              status, created_at, updated_at, completed_at, payload_version
       FROM assignments
       WHERE id = ? AND client_id = ?`,
      [assignmentId, clientId]
    )
  );
  if (rows.length === 0) return null;
  return decryptRow(rows[0]);
}

/**
 * List active assignments for a single client (bot side — no therapist filter
 * beyond the implicit one carried by the row).
 */
function listActiveAssignmentsForClient(clientId) {
  const db = getDatabase();
  const sql =
    `SELECT id, session_id, therapist_id, client_id, exercise_id,
            title_encrypted, description_encrypted,
            report_frequency, report_frequency_n, deadline,
            status, created_at, updated_at, completed_at, payload_version
     FROM assignments
     WHERE client_id = ? AND status = 'active'
     ORDER BY created_at DESC, id DESC`;
  const rows = rowsToObjects(db.exec(sql, [clientId]));
  return rows.map(decryptRow);
}

/**
 * Create a new assignment.
 */
function createAssignment({
  therapistId, clientId, sessionId = null,
  exerciseId = null, title, description = '',
  reportFrequency = 'on_demand', reportFrequencyN = null, deadline = null,
  status = 'active'
}) {
  validateTitle(title);
  validateDescription(description);
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error('Invalid status');
    err.code = 'invalid_input';
    throw err;
  }
  const freqN = validateFrequency(reportFrequency, reportFrequencyN);
  const deadlineISO = validateDeadline(deadline);
  const exerciseIdInt = validateExerciseId(exerciseId, therapistId);

  // Validate session_id (if provided) belongs to this therapist+client.
  let sessionIdInt = null;
  if (sessionId != null && sessionId !== '') {
    const n = parseInt(sessionId, 10);
    if (!Number.isInteger(n) || n <= 0) {
      const err = new Error('Invalid session_id');
      err.code = 'invalid_input';
      throw err;
    }
    const db = getDatabase();
    const sessRows = rowsToObjects(
      db.exec(
        'SELECT id, therapist_id, client_id FROM sessions WHERE id = ?',
        [n]
      )
    );
    if (sessRows.length === 0) {
      const err = new Error('Session not found');
      err.code = 'invalid_input';
      throw err;
    }
    const sess = sessRows[0];
    if (Number(sess.therapist_id) !== Number(therapistId) ||
        Number(sess.client_id) !== Number(clientId)) {
      const err = new Error('Session does not belong to this therapist+client');
      err.code = 'invalid_input';
      throw err;
    }
    sessionIdInt = n;
  }

  const db = getDatabase();
  const titleEnc = encrypt(title.trim());
  const descEnc = description && description.trim() ? encrypt(description.trim()) : null;

  db.run(
    `INSERT INTO assignments
       (session_id, therapist_id, client_id, exercise_id,
        title_encrypted, description_encrypted, encryption_key_id, payload_version,
        report_frequency, report_frequency_n, deadline, status,
        created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
    [
      sessionIdInt,
      therapistId,
      clientId,
      exerciseIdInt,
      titleEnc.encrypted,
      descEnc ? descEnc.encrypted : null,
      titleEnc.keyId,
      titleEnc.keyVersion,
      reportFrequency,
      freqN,
      deadlineISO,
      status,
      status === 'completed' ? new Date().toISOString() : null,
    ]
  );

  const idResult = db.exec('SELECT last_insert_rowid()');
  const assignmentId = idResult[0].values[0][0];

  audit(therapistId, 'assignment_create', assignmentId, {
    client_id: clientId,
    session_id: sessionIdInt,
    exercise_id: exerciseIdInt,
    status,
    report_frequency: reportFrequency,
  });
  saveDatabaseAfterWrite();

  return getAssignment(therapistId, clientId, assignmentId);
}

/**
 * Update an assignment. Allows changing title/description/status/frequency/deadline.
 */
function updateAssignment({
  therapistId, clientId, assignmentId,
  title, description, exerciseId,
  reportFrequency, reportFrequencyN, deadline, status
}) {
  const db = getDatabase();
  const existing = getAssignment(therapistId, clientId, assignmentId);
  if (!existing) return null;

  const fields = [];
  const params = [];
  const auditDetails = { client_id: clientId, changes: [] };

  if (typeof title === 'string') {
    validateTitle(title);
    const enc = encrypt(title.trim());
    fields.push('title_encrypted = ?', 'encryption_key_id = ?', 'payload_version = ?');
    params.push(enc.encrypted, enc.keyId, enc.keyVersion);
    auditDetails.changes.push('title');
  }

  if (typeof description === 'string') {
    validateDescription(description);
    if (description.trim()) {
      const enc = encrypt(description.trim());
      fields.push('description_encrypted = ?');
      params.push(enc.encrypted);
    } else {
      fields.push('description_encrypted = NULL');
    }
    auditDetails.changes.push('description');
  }

  if (exerciseId !== undefined) {
    const exId = validateExerciseId(exerciseId, therapistId);
    fields.push('exercise_id = ?');
    params.push(exId);
    auditDetails.changes.push('exercise_id');
  }

  if (reportFrequency !== undefined || reportFrequencyN !== undefined) {
    // Either one provided → re-validate both as a pair using the new (or
    // existing) values.
    const nextFreq = reportFrequency !== undefined ? reportFrequency : existing.report_frequency;
    const nextN = reportFrequencyN !== undefined ? reportFrequencyN : existing.report_frequency_n;
    const validatedN = validateFrequency(nextFreq, nextN);
    fields.push('report_frequency = ?', 'report_frequency_n = ?');
    params.push(nextFreq, validatedN);
    auditDetails.changes.push(`frequency:${existing.report_frequency}->${nextFreq}`);
  }

  if (deadline !== undefined) {
    const iso = validateDeadline(deadline);
    fields.push('deadline = ?');
    params.push(iso);
    auditDetails.changes.push('deadline');
  }

  if (typeof status === 'string') {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error('Invalid status');
      err.code = 'invalid_input';
      throw err;
    }
    fields.push('status = ?');
    params.push(status);

    if (status === 'completed' && existing.status !== 'completed') {
      fields.push("completed_at = datetime('now')");
    } else if (status !== 'completed' && existing.status === 'completed') {
      fields.push('completed_at = NULL');
    }
    auditDetails.changes.push(`status:${existing.status}->${status}`);
  }

  if (fields.length === 0) {
    return existing; // no-op
  }

  fields.push("updated_at = datetime('now')");
  params.push(assignmentId, therapistId, clientId);

  db.run(
    `UPDATE assignments SET ${fields.join(', ')} WHERE id = ? AND therapist_id = ? AND client_id = ?`,
    params
  );

  audit(therapistId, 'assignment_update', assignmentId, auditDetails);
  saveDatabaseAfterWrite();

  return getAssignment(therapistId, clientId, assignmentId);
}

/**
 * Mark an assignment as completed. Convenience wrapper used by the bot when the
 * client says "done". This is the pre-T-05 path; once T-05 lands the therapist
 * formally accepts via a separate endpoint.
 */
function completeAssignment(clientId, assignmentId) {
  const db = getDatabase();
  const existing = getAssignmentForClient(clientId, assignmentId);
  if (!existing) return null;
  if (existing.status === 'completed') return existing;

  db.run(
    `UPDATE assignments
        SET status = 'completed',
            completed_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ? AND client_id = ?`,
    [assignmentId, clientId]
  );
  audit(clientId, 'assignment_complete', assignmentId, { client_id: clientId });
  saveDatabaseAfterWrite();
  return getAssignmentForClient(clientId, assignmentId);
}

/**
 * Mark an assignment as abandoned. Therapist-side action.
 */
function abandonAssignment(therapistId, clientId, assignmentId) {
  return updateAssignment({
    therapistId, clientId, assignmentId, status: 'abandoned'
  });
}

/**
 * Permanently delete an assignment.
 */
function deleteAssignment(therapistId, clientId, assignmentId) {
  const db = getDatabase();
  const existing = getAssignment(therapistId, clientId, assignmentId);
  if (!existing) return false;

  db.run(
    'DELETE FROM assignments WHERE id = ? AND therapist_id = ? AND client_id = ?',
    [assignmentId, therapistId, clientId]
  );
  audit(therapistId, 'assignment_delete', assignmentId, { client_id: clientId });
  saveDatabaseAfterWrite();
  return true;
}

/**
 * Send a Telegram + WebSocket notification to the client when a new
 * assignment is created. Best-effort — failures never throw to the caller.
 * Re-used by both the /api/clients and /api/sessions creation routes.
 */
function notifyClientOfNewAssignment(assignment) {
  try {
    const db = getDatabase();
    const userRes = db.exec(
      'SELECT telegram_id, language, first_name, email FROM users WHERE id = ?',
      [assignment.client_id]
    );
    if (!userRes || userRes.length === 0 || userRes[0].values.length === 0) return;
    const [telegramId, lang, firstName, email] = userRes[0].values[0];
    const clientLang = String(lang || 'en').toLowerCase();
    const title = assignment.title || 'New task';

    let text;
    if (clientLang === 'ru') {
      text = `📝 *Новое задание*\n\nВаш терапевт назначил вам задание: *${title}*\n\nИспользуйте /assignments чтобы посмотреть детали и отправить отчёт.`;
    } else if (clientLang === 'es') {
      text = `📝 *Nueva tarea*\n\nTu terapeuta te ha asignado una tarea: *${title}*\n\nUsa /assignments para ver detalles y enviar un informe.`;
    } else if (clientLang === 'uk') {
      text = `📝 *Нове завдання*\n\nВаш терапевт призначив вам завдання: *${title}*\n\nВикористовуйте /assignments, щоб переглянути деталі та надіслати звіт.`;
    } else {
      text = `📝 *New Assignment*\n\nYour therapist has set you a new task: *${title}*\n\nUse /assignments to view details and submit a report.`;
    }

    if (telegramId) {
      telegramNotify
        .sendMessage(telegramId, text)
        .catch((e) => logger.warn(`[T-03] Telegram notify failed: ${e.message}`));
    }

    const clientName = firstName || email || `Client #${assignment.client_id}`;
    try {
      wsService.emitToTherapist(assignment.therapist_id, {
        type: 'assignment_created',
        client_id: assignment.client_id,
        client_name: clientName,
        assignment_id: assignment.id,
        title: assignment.title,
        session_id: assignment.session_id,
        timestamp: new Date().toISOString(),
      });
    } catch (wsErr) {
      logger.warn(`[T-03] WS emit failed: ${wsErr.message}`);
    }
  } catch (e) {
    logger.warn(`[T-03] notifyClientOfNewAssignment failed: ${e.message}`);
  }
}

module.exports = {
  VALID_STATUSES,
  VALID_FREQUENCIES,
  listAssignments,
  listAssignmentsForSession,
  getAssignment,
  getAssignmentForClient,
  listActiveAssignmentsForClient,
  createAssignment,
  updateAssignment,
  completeAssignment,
  abandonAssignment,
  deleteAssignment,
  notifyClientOfNewAssignment,
};
