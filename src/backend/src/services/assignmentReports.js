// T-04: Assignment Reports Service (feature #362)
//
// While a client works on an assignment they may post unlimited short text or
// voice "progress reports" via the Telegram bot. The therapist sees these as
// a chronological feed inside the assignment in the dashboard and gets a
// WebSocket push when a new one lands.
//
// Reuses:
//   - encryption.js (Class A AES-GCM packed blobs)
//   - diary-style on-disk encrypted audio files (data/diary_files)
//   - diaryTranscription.transcribeWithRetry path via a thin wrapper
//   - websocketService.emitToTherapist for the push
//
// Data model: see assignment_reports table in db/connection.js.

const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');
const wsService = require('./websocketService');
const telegramNotify = require('../utils/telegramNotify');

// Reuse the diary audio directory — same encrypted-on-disk format.
const DIARY_FILES_DIR = path.resolve(__dirname, '../../data/diary_files');

const VALID_REPORT_TYPES = ['text', 'voice'];

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

function decryptRow(row) {
  let content = '';
  if (row.content_encrypted) {
    try {
      content = decrypt(row.content_encrypted);
    } catch (e) {
      logger.warn(`assignmentReports.decryptRow: failed to decrypt content for report ${row.id}: ${e.message}`);
      content = '';
    }
  }
  let therapistComment = '';
  if (row.therapist_comment_encrypted) {
    try {
      therapistComment = decrypt(row.therapist_comment_encrypted);
    } catch (e) {
      logger.warn(`assignmentReports.decryptRow: failed to decrypt therapist_comment for report ${row.id}: ${e.message}`);
      therapistComment = '';
    }
  }
  return {
    id: row.id,
    assignment_id: row.assignment_id,
    client_id: row.client_id,
    therapist_id: row.therapist_id,
    report_type: row.report_type,
    content,
    has_audio: !!row.audio_file_ref,
    transcription_status: row.transcription_status || null,
    is_final: !!row.is_final,
    acceptance_status: row.acceptance_status,
    therapist_comment: therapistComment || null,
    accepted_at: row.accepted_at || null,
    returned_at: row.returned_at || null,
    attachments: listAttachmentsForReport(row.id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function audit(actorId, action, targetId, details = null) {
  try {
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, 'assignment_report', ?, ?, datetime('now'))",
      [actorId, action, targetId, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    logger.error(`assignmentReports.audit: failed to log ${action}: ${e.message}`);
  }
}

/**
 * Find an assignment row needed for authorization. Returns a small subset
 * (id, therapist_id, client_id). null when not found.
 */
function findAssignmentBase(assignmentId) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      'SELECT id, therapist_id, client_id, status FROM assignments WHERE id = ?',
      [assignmentId]
    )
  );
  return rows.length === 0 ? null : rows[0];
}

/**
 * List reports for an assignment, oldest first (chronological) by default.
 * Already-decrypted output objects.
 */
function listReportsForAssignment(assignmentId, { order = 'asc' } = {}) {
  const db = getDatabase();
  const dir = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, assignment_id, client_id, therapist_id, report_type,
              content_encrypted, audio_file_ref, transcription_status,
              is_final, acceptance_status,
              therapist_comment_encrypted, accepted_at, returned_at,
              created_at, updated_at
       FROM assignment_reports
       WHERE assignment_id = ?
       ORDER BY datetime(created_at) ${dir}, id ${dir}`,
      [assignmentId]
    )
  );
  return rows.map(decryptRow);
}

/**
 * Fetch a single report by id.
 */
function getReport(reportId) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, assignment_id, client_id, therapist_id, report_type,
              content_encrypted, audio_file_ref, transcription_status,
              is_final, acceptance_status,
              therapist_comment_encrypted, accepted_at, returned_at,
              created_at, updated_at
       FROM assignment_reports WHERE id = ?`,
      [reportId]
    )
  );
  if (rows.length === 0) return null;
  return decryptRow(rows[0]);
}

/**
 * Validate text content for a report. Returns the trimmed content on success
 * or throws { code: 'invalid_input' }.
 */
function validateContent(content, { allowEmpty = false } = {}) {
  if (content == null) {
    if (allowEmpty) return '';
    const err = new Error('content is required');
    err.code = 'invalid_input';
    throw err;
  }
  if (typeof content !== 'string') {
    const err = new Error('content must be a string');
    err.code = 'invalid_input';
    throw err;
  }
  const trimmed = content.trim();
  if (!trimmed && !allowEmpty) {
    const err = new Error('content cannot be empty');
    err.code = 'invalid_input';
    throw err;
  }
  if (trimmed.length > 10000) {
    const err = new Error('content is too long (max 10000 chars)');
    err.code = 'invalid_input';
    throw err;
  }
  return trimmed;
}

/**
 * Internal helper to create a row. Caller is responsible for any pre-checks
 * (therapist/client linkage); this just persists, audits, notifies.
 *
 * @param {object} args
 * @param {number} args.assignmentId
 * @param {number} args.clientId
 * @param {number} args.therapistId
 * @param {'text'|'voice'} args.reportType
 * @param {string|null} args.content - plaintext, may be null for voice (pending transcript)
 * @param {string|null} args.audioFileRef - opaque .enc filename, null for text
 * @param {boolean} args.isFinal
 * @param {number} args.actorId - which user id triggered this (for audit)
 * @returns {object} freshly decrypted report row
 */
function insertReport({
  assignmentId,
  clientId,
  therapistId,
  reportType,
  content,
  audioFileRef = null,
  isFinal = false,
  actorId,
}) {
  if (!VALID_REPORT_TYPES.includes(reportType)) {
    const err = new Error(`Invalid report_type: ${reportType}`);
    err.code = 'invalid_input';
    throw err;
  }

  const db = getDatabase();

  let contentEncrypted = null;
  let keyId = null;
  let keyVersion = 1;
  if (content && content.length > 0) {
    const enc = encrypt(content);
    contentEncrypted = enc.encrypted;
    keyId = enc.keyId;
    keyVersion = enc.keyVersion;
  }

  const transcriptionStatus = reportType === 'voice'
    ? (content && content.length > 0 ? 'completed' : 'pending')
    : null;

  db.run(
    `INSERT INTO assignment_reports
       (assignment_id, client_id, therapist_id, report_type,
        content_encrypted, audio_file_ref, transcription_status,
        encryption_key_id, payload_version,
        is_final, acceptance_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
    [
      assignmentId,
      clientId,
      therapistId,
      reportType,
      contentEncrypted,
      audioFileRef,
      transcriptionStatus,
      keyId,
      keyVersion,
      isFinal ? 1 : 0,
    ]
  );

  const idResult = db.exec('SELECT last_insert_rowid()');
  const reportId = idResult[0].values[0][0];

  audit(actorId, 'assignment_report_create', reportId, {
    assignment_id: assignmentId,
    client_id: clientId,
    report_type: reportType,
    is_final: !!isFinal,
    has_audio: !!audioFileRef,
  });

  saveDatabaseAfterWrite();

  // WebSocket push so the therapist's dashboard ticks over without refresh.
  try {
    wsService.emitToTherapist(therapistId, {
      type: 'assignment_report_created',
      assignment_id: assignmentId,
      client_id: clientId,
      report_id: reportId,
      report_type: reportType,
      is_final: !!isFinal,
      timestamp: new Date().toISOString(),
    });
  } catch (wsErr) {
    logger.warn(`[T-04] WS emit assignment_report_created failed: ${wsErr.message}`);
  }

  return getReport(reportId);
}

/**
 * Therapist-initiated path: create a report on behalf of the client (testing
 * / catch-up notes). Verifies assignment ownership.
 */
function createReportAsTherapist({
  therapistId,
  clientId,
  assignmentId,
  content,
  isFinal = false,
}) {
  const base = findAssignmentBase(assignmentId);
  if (!base) {
    const err = new Error('Assignment not found');
    err.code = 'not_found';
    throw err;
  }
  if (Number(base.therapist_id) !== Number(therapistId) ||
      Number(base.client_id) !== Number(clientId)) {
    const err = new Error('Assignment does not belong to this therapist+client');
    err.code = 'forbidden';
    throw err;
  }
  const text = validateContent(content);
  return insertReport({
    assignmentId,
    clientId,
    therapistId,
    reportType: 'text',
    content: text,
    isFinal,
    actorId: therapistId,
  });
}

/**
 * Client-initiated path (bot): create a text report. Verifies the assignment
 * belongs to this client.
 */
function createTextReportAsClient({ clientId, assignmentId, content, isFinal = false }) {
  const base = findAssignmentBase(assignmentId);
  if (!base) {
    const err = new Error('Assignment not found');
    err.code = 'not_found';
    throw err;
  }
  if (Number(base.client_id) !== Number(clientId)) {
    const err = new Error('Assignment does not belong to this client');
    err.code = 'forbidden';
    throw err;
  }
  const text = validateContent(content);
  return insertReport({
    assignmentId,
    clientId,
    therapistId: base.therapist_id,
    reportType: 'text',
    content: text,
    isFinal,
    actorId: clientId,
  });
}

/**
 * Client-initiated path (bot): create a voice report with the audio file
 * already encrypted on disk. The transcript may be null (transcription will
 * fire asynchronously) or a placeholder/initial transcript.
 */
function createVoiceReportAsClient({
  clientId,
  assignmentId,
  audioFileRef,
  initialContent = null,
  isFinal = false,
}) {
  const base = findAssignmentBase(assignmentId);
  if (!base) {
    const err = new Error('Assignment not found');
    err.code = 'not_found';
    throw err;
  }
  if (Number(base.client_id) !== Number(clientId)) {
    const err = new Error('Assignment does not belong to this client');
    err.code = 'forbidden';
    throw err;
  }
  return insertReport({
    assignmentId,
    clientId,
    therapistId: base.therapist_id,
    reportType: 'voice',
    content: initialContent || null,
    audioFileRef,
    isFinal,
    actorId: clientId,
  });
}

/**
 * Update an existing report's transcript (called by the transcription
 * pipeline once Whisper returns text).
 */
function updateReportTranscript(reportId, transcript, { status = 'completed' } = {}) {
  const db = getDatabase();
  const existing = getReport(reportId);
  if (!existing) return null;

  const enc = encrypt(transcript || '');
  db.run(
    `UPDATE assignment_reports
        SET content_encrypted = ?, encryption_key_id = ?, payload_version = ?,
            transcription_status = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [enc.encrypted, enc.keyId, enc.keyVersion, status, reportId]
  );
  saveDatabaseAfterWrite();

  // Notify therapist that the transcript is ready (so the dashboard re-renders).
  try {
    wsService.emitToTherapist(existing.therapist_id, {
      type: 'assignment_report_transcribed',
      assignment_id: existing.assignment_id,
      client_id: existing.client_id,
      report_id: reportId,
      timestamp: new Date().toISOString(),
    });
  } catch (wsErr) {
    logger.warn(`[T-04] WS emit assignment_report_transcribed failed: ${wsErr.message}`);
  }

  return getReport(reportId);
}

/**
 * Mark transcription as failed (keeps the audio reference but flags status).
 */
function markTranscriptionFailed(reportId, errorMessage) {
  const db = getDatabase();
  db.run(
    `UPDATE assignment_reports
        SET transcription_status = 'failed', updated_at = datetime('now')
      WHERE id = ?`,
    [reportId]
  );
  saveDatabaseAfterWrite();
  logger.warn(`[T-04] Report ${reportId} transcription failed: ${errorMessage}`);
}

/**
 * Trigger Whisper transcription for a voice report. Returns a Promise that
 * resolves to the updated report (or null if the report was not voice).
 *
 * Reuses the diary-style audio decryption + STT pipeline. We intentionally
 * keep this module decoupled from diaryTranscription's internals so a future
 * refactor can move the shared helpers into a common module.
 */
async function processReportTranscription(reportId) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, client_id, audio_file_ref, transcription_status, report_type
         FROM assignment_reports WHERE id = ?`,
      [reportId]
    )
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.report_type !== 'voice' || !row.audio_file_ref) {
    return null;
  }

  // Lazy-require to avoid a circular import (diaryTranscription pulls in
  // services from this module's neighbourhood).
  const diaryTx = require('./diaryTranscription');

  // Mark processing.
  db.run(
    `UPDATE assignment_reports SET transcription_status = 'processing', updated_at = datetime('now') WHERE id = ?`,
    [reportId]
  );
  saveDatabaseAfterWrite();

  // If the configured transcription pipeline is not available (dev mode), the
  // diary helper still returns a dev-mode placeholder transcript, so we can
  // verify the wiring end-to-end even without a Whisper key.
  try {
    const filePath = path.join(DIARY_FILES_DIR, row.audio_file_ref);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio file not found: ${row.audio_file_ref}`);
    }

    const clientLanguage = (() => {
      try {
        const r = db.exec('SELECT language FROM users WHERE id = ?', [row.client_id]);
        if (r.length > 0 && r[0].values.length > 0) {
          return r[0].values[0][0] || undefined;
        }
      } catch (_) { /* ignore */ }
      return undefined;
    })();

    // Reuse the diary transcript function — it knows how to handle both real
    // STT API and dev-mode placeholders.
    const result = await diaryTx.transcribeDiaryEntry('voice', null, null, row.audio_file_ref, clientLanguage);
    const transcript = typeof result === 'object' && result.text ? result.text : (typeof result === 'string' ? result : '');
    return updateReportTranscript(reportId, transcript, { status: 'completed' });
  } catch (err) {
    markTranscriptionFailed(reportId, err.message);
    return null;
  }
}

/**
 * Therapist verifies the report belongs to one of their clients. Returns the
 * raw assignment row plus the report (already decrypted) when authorized.
 */
function getReportForTherapist(therapistId, reportId) {
  const report = getReport(reportId);
  if (!report) return { notFound: true };
  if (Number(report.therapist_id) !== Number(therapistId)) {
    return { forbidden: true };
  }
  return { report };
}

/**
 * Permanently delete a report (only the therapist can do this in v1; the
 * client can use the "make private" pattern via update in T-12 once linked).
 */
function deleteReport(therapistId, reportId) {
  const db = getDatabase();
  const r = getReportForTherapist(therapistId, reportId);
  if (r.notFound) return { notFound: true };
  if (r.forbidden) return { forbidden: true };

  db.run('DELETE FROM assignment_reports WHERE id = ?', [reportId]);
  audit(therapistId, 'assignment_report_delete', reportId, {
    assignment_id: r.report.assignment_id,
    client_id: r.report.client_id,
  });
  saveDatabaseAfterWrite();
  return { success: true };
}

/**
 * Update acceptance status of a (typically final) report. Lower-level helper
 * kept for backwards compatibility with the PATCH …/acceptance route.
 * T-05 callers should prefer acceptReport() / returnReport(), which carry
 * the full lifecycle (assignment status flip, notifications, encrypted
 * therapist comment) on top of the bare column update.
 */
function setAcceptanceStatus(therapistId, reportId, status) {
  const validStatuses = ['pending', 'accepted', 'returned'];
  if (!validStatuses.includes(status)) {
    const err = new Error('Invalid acceptance_status');
    err.code = 'invalid_input';
    throw err;
  }
  const r = getReportForTherapist(therapistId, reportId);
  if (r.notFound) return { notFound: true };
  if (r.forbidden) return { forbidden: true };

  const db = getDatabase();
  db.run(
    `UPDATE assignment_reports SET acceptance_status = ?, updated_at = datetime('now') WHERE id = ?`,
    [status, reportId]
  );
  audit(therapistId, 'assignment_report_set_acceptance', reportId, {
    assignment_id: r.report.assignment_id, status,
  });
  saveDatabaseAfterWrite();
  return { report: getReport(reportId) };
}

// =====================================================================
// T-05: Final report acceptance / return lifecycle (feature #363)
// =====================================================================
//
// The therapist reviews a client's final report and either:
//   - ACCEPTS the report (one-way action): the assignment is locked into
//     status='completed'; the client receives a "your report was accepted"
//     push and can no longer reopen the assignment by submitting more.
//   - RETURNS the report (reversible): the report is flagged returned, a
//     mandatory Class A therapist comment (≥10 chars) is persisted, and
//     the assignment goes back to status='active' so the client can
//     submit a fresh final after addressing the feedback. The client
//     receives a "your report was returned: <comment>" push.
//
// Both transitions only operate on FINAL reports (is_final = 1) that are
// currently in the 'pending' state; attempting to flip an accepted report
// is rejected with a 409 (one-way) and a returned report can move forward
// to accept (or be replaced by a new final from the client).

const RETURN_COMMENT_MIN_CHARS = 10;
const RETURN_COMMENT_MAX_CHARS = 4000;

/**
 * Internal: bump the assignment's status. Pure SQL update — we do NOT
 * pull in services/assignments.completeAssignment() to avoid a circular
 * require and so the side-effects (audit/log) are reported as part of
 * the assignment_report lifecycle, not the assignment one.
 */
function setAssignmentStatus(assignmentId, status) {
  const db = getDatabase();
  const completedClause = status === 'completed'
    ? ", completed_at = COALESCE(completed_at, datetime('now'))"
    : '';
  db.run(
    `UPDATE assignments
        SET status = ?, updated_at = datetime('now')${completedClause}
      WHERE id = ?`,
    [status, assignmentId]
  );
}

/**
 * Notify the client over Telegram + WebSocket that their final report
 * has been accepted or returned. Best-effort — never throws.
 *
 * @param {'accepted'|'returned'} action
 * @param {object} report - decrypted report object (post-update).
 * @param {string|null} comment - therapist comment (returns only).
 */
function notifyClientOfFinalReportAction(action, report, comment = null) {
  try {
    const db = getDatabase();
    const userRes = db.exec(
      'SELECT telegram_id, language FROM users WHERE id = ?',
      [report.client_id]
    );
    if (!userRes || userRes.length === 0 || userRes[0].values.length === 0) return;
    const [telegramId, lang] = userRes[0].values[0];
    const clientLang = String(lang || 'en').toLowerCase();

    let text;
    if (action === 'accepted') {
      if (clientLang === 'ru') {
        text = `✅ *Ваш отчёт принят*\n\nТерапевт принял ваш итоговый отчёт по заданию. Спасибо за вашу работу!`;
      } else if (clientLang === 'es') {
        text = `✅ *Tu informe ha sido aceptado*\n\nEl terapeuta ha aceptado tu informe final de la tarea. ¡Gracias por tu trabajo!`;
      } else if (clientLang === 'uk') {
        text = `✅ *Ваш звіт прийнято*\n\nТерапевт прийняв ваш підсумковий звіт по завданню. Дякуємо за вашу роботу!`;
      } else {
        text = `✅ *Your report was accepted*\n\nThe therapist accepted your final report for the assignment. Thank you for your work!`;
      }
    } else {
      const safeComment = (comment || '').slice(0, 1500);
      if (clientLang === 'ru') {
        text = `↩️ *Терапевт вернул отчёт*\n\nКомментарий терапевта:\n${safeComment}\n\nИспользуйте /report чтобы отправить новый итоговый отчёт.`;
      } else if (clientLang === 'es') {
        text = `↩️ *El terapeuta devolvió el informe*\n\nComentario del terapeuta:\n${safeComment}\n\nUsa /report para enviar un nuevo informe final.`;
      } else if (clientLang === 'uk') {
        text = `↩️ *Терапевт повернув звіт*\n\nКоментар терапевта:\n${safeComment}\n\nВикористовуйте /report, щоб надіслати новий підсумковий звіт.`;
      } else {
        text = `↩️ *Therapist returned your report*\n\nTherapist's comment:\n${safeComment}\n\nUse /report to submit a new final report.`;
      }
    }

    if (telegramId) {
      telegramNotify
        .sendMessage(String(telegramId), text)
        .catch((e) => logger.warn(`[T-05] Telegram notify ${action} failed: ${e.message}`));
    }
  } catch (e) {
    logger.warn(`[T-05] notifyClientOfFinalReportAction(${action}) crashed: ${e.message}`);
  }

  // Therapist-side WS push so the dashboard re-renders the card.
  try {
    wsService.emitToTherapist(report.therapist_id, {
      type: action === 'accepted'
        ? 'assignment_report_accepted'
        : 'assignment_report_returned',
      assignment_id: report.assignment_id,
      client_id: report.client_id,
      report_id: report.id,
      acceptance_status: report.acceptance_status,
      timestamp: new Date().toISOString(),
    });
  } catch (wsErr) {
    logger.warn(`[T-05] WS emit assignment_report_${action} failed: ${wsErr.message}`);
  }
}

/**
 * Accept a final report. One-way action.
 *
 * Returns { report } on success or { notFound | forbidden | conflict | invalid_input }
 * for the various failure modes.
 *
 * @param {number} therapistId
 * @param {number} reportId
 */
function acceptReport(therapistId, reportId) {
  const r = getReportForTherapist(therapistId, reportId);
  if (r.notFound) return { notFound: true };
  if (r.forbidden) return { forbidden: true };
  const report = r.report;

  if (!report.is_final) {
    return { invalid_input: 'Only final reports can be accepted' };
  }
  if (report.acceptance_status === 'accepted') {
    // Idempotent: already accepted, just return the current state. We do
    // NOT re-notify in this case to avoid duplicate client pushes.
    return { report };
  }
  // accept is one-way regardless of return history — return → accept is allowed.

  const db = getDatabase();
  db.run(
    `UPDATE assignment_reports
        SET acceptance_status = 'accepted',
            accepted_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ?`,
    [reportId]
  );
  setAssignmentStatus(report.assignment_id, 'completed');
  audit(therapistId, 'assignment_report_accept', reportId, {
    assignment_id: report.assignment_id, client_id: report.client_id,
  });
  saveDatabaseAfterWrite();

  const updated = getReport(reportId);
  notifyClientOfFinalReportAction('accepted', updated);
  return { report: updated };
}

/**
 * Return a final report with a mandatory therapist comment (≥10 chars).
 * Reversible: the client may submit another final after addressing the
 * feedback.
 *
 * @param {number} therapistId
 * @param {number} reportId
 * @param {string} comment - plain-text therapist feedback, Class A encrypted on persist.
 */
function returnReport(therapistId, reportId, comment) {
  if (comment == null || typeof comment !== 'string') {
    const err = new Error('comment is required');
    err.code = 'invalid_input';
    throw err;
  }
  const trimmed = comment.trim();
  if (trimmed.length < RETURN_COMMENT_MIN_CHARS) {
    const err = new Error(`comment must be at least ${RETURN_COMMENT_MIN_CHARS} characters`);
    err.code = 'invalid_input';
    throw err;
  }
  if (trimmed.length > RETURN_COMMENT_MAX_CHARS) {
    const err = new Error(`comment is too long (max ${RETURN_COMMENT_MAX_CHARS} chars)`);
    err.code = 'invalid_input';
    throw err;
  }

  const r = getReportForTherapist(therapistId, reportId);
  if (r.notFound) return { notFound: true };
  if (r.forbidden) return { forbidden: true };
  const report = r.report;

  if (!report.is_final) {
    return { invalid_input: 'Only final reports can be returned' };
  }
  if (report.acceptance_status === 'accepted') {
    // accept is one-way — cannot reopen an accepted report.
    return { conflict: 'Cannot return a report that was already accepted' };
  }

  const enc = encrypt(trimmed);
  const db = getDatabase();
  db.run(
    `UPDATE assignment_reports
        SET acceptance_status = 'returned',
            therapist_comment_encrypted = ?,
            therapist_comment_key_id = ?,
            therapist_comment_version = ?,
            returned_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ?`,
    [enc.encrypted, enc.keyId, enc.keyVersion, reportId]
  );
  // Reopen the assignment so the client can submit another final.
  setAssignmentStatus(report.assignment_id, 'active');
  audit(therapistId, 'assignment_report_return', reportId, {
    assignment_id: report.assignment_id, client_id: report.client_id,
    comment_length: trimmed.length,
  });
  saveDatabaseAfterWrite();

  const updated = getReport(reportId);
  notifyClientOfFinalReportAction('returned', updated, trimmed);
  return { report: updated };
}

// =====================================================================
// T-21: Photo attachments on assignment reports (feature #379)
// =====================================================================
//
// Storage strategy mirrors voice notes: each photo is AES-encrypted on
// disk inside data/diary_files (the same directory the diary + voice
// reports use), referenced by an opaque .enc filename. The therapist
// streams the file through a backend route that performs auth and
// decrypts on the fly; clients never see the on-disk filename.

const MAX_ATTACHMENTS_PER_REPORT = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * List attachment metadata for a single report (oldest first).
 * Never returns the encrypted blob — only ids / mime / size so the
 * frontend can render thumbnails and request streaming separately.
 */
function listAttachmentsForReport(reportId) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, report_id, mime_type, size_bytes, created_at
         FROM assignment_report_attachments
        WHERE report_id = ?
        ORDER BY datetime(created_at) ASC, id ASC`,
      [reportId]
    )
  );
  return rows.map((r) => ({
    id: r.id,
    report_id: r.report_id,
    mime_type: r.mime_type,
    size_bytes: r.size_bytes,
    created_at: r.created_at,
  }));
}

/**
 * Count attachments for a report (used to enforce the per-report cap).
 */
function countAttachmentsForReport(reportId) {
  const db = getDatabase();
  const result = db.exec(
    'SELECT COUNT(*) FROM assignment_report_attachments WHERE report_id = ?',
    [reportId]
  );
  if (result.length === 0 || result[0].values.length === 0) return 0;
  return Number(result[0].values[0][0]) || 0;
}

/**
 * Fetch a single attachment row including the file_ref (needed for
 * the streaming path). Returns null when missing.
 */
function getAttachment(attachmentId) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, report_id, file_ref, mime_type, size_bytes,
              encryption_key_id, payload_version, created_at
         FROM assignment_report_attachments WHERE id = ?`,
      [attachmentId]
    )
  );
  return rows.length === 0 ? null : rows[0];
}

/**
 * Persist a new attachment row. Caller is responsible for writing the
 * encrypted file to disk first (mirrors the voice-report path).
 *
 * @param {object} args
 * @param {number} args.reportId
 * @param {string} args.fileRef - opaque .enc filename inside DIARY_FILES_DIR
 * @param {string} args.mimeType
 * @param {number} args.sizeBytes - original (pre-encryption) byte count
 * @param {number} args.actorId - which user id triggered this (for audit)
 * @param {number|null} args.keyId
 * @param {number} args.keyVersion
 * @returns {object} the inserted attachment row (no file_ref leak)
 */
function insertAttachment({
  reportId,
  fileRef,
  mimeType,
  sizeBytes,
  actorId,
  keyId = null,
  keyVersion = 1,
}) {
  if (!fileRef || typeof fileRef !== 'string') {
    const err = new Error('file_ref is required');
    err.code = 'invalid_input';
    throw err;
  }
  const normalizedMime = String(mimeType || '').toLowerCase().trim();
  if (!ALLOWED_ATTACHMENT_MIMES.has(normalizedMime)) {
    const err = new Error(`Unsupported attachment mime type: ${mimeType}`);
    err.code = 'invalid_input';
    throw err;
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    const err = new Error('size_bytes must be a positive number');
    err.code = 'invalid_input';
    throw err;
  }
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    const err = new Error(`Attachment too large (max ${MAX_ATTACHMENT_BYTES} bytes)`);
    err.code = 'invalid_input';
    throw err;
  }
  const existing = countAttachmentsForReport(reportId);
  if (existing >= MAX_ATTACHMENTS_PER_REPORT) {
    const err = new Error(`Max ${MAX_ATTACHMENTS_PER_REPORT} attachments per report`);
    err.code = 'invalid_input';
    throw err;
  }

  const db = getDatabase();
  db.run(
    `INSERT INTO assignment_report_attachments
       (report_id, file_ref, mime_type, size_bytes,
        encryption_key_id, payload_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [reportId, fileRef, normalizedMime, sizeBytes, keyId, keyVersion]
  );
  const idResult = db.exec('SELECT last_insert_rowid()');
  const attachmentId = idResult[0].values[0][0];

  audit(actorId, 'assignment_report_attachment_create', attachmentId, {
    report_id: reportId,
    mime_type: normalizedMime,
    size_bytes: sizeBytes,
  });

  saveDatabaseAfterWrite();

  // Notify therapist so the dashboard re-fetches and renders the thumbnail.
  try {
    const report = getReport(reportId);
    if (report) {
      wsService.emitToTherapist(report.therapist_id, {
        type: 'assignment_report_attachment_added',
        assignment_id: report.assignment_id,
        client_id: report.client_id,
        report_id: reportId,
        attachment_id: attachmentId,
        mime_type: normalizedMime,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (wsErr) {
    logger.warn(`[T-21] WS emit assignment_report_attachment_added failed: ${wsErr.message}`);
  }

  return {
    id: attachmentId,
    report_id: reportId,
    mime_type: normalizedMime,
    size_bytes: sizeBytes,
  };
}

/**
 * Delete an attachment row. Caller (route layer) is responsible for
 * removing the on-disk encrypted file. Returns true when deleted,
 * false when no such row existed.
 */
function deleteAttachment(attachmentId, actorId) {
  const db = getDatabase();
  const att = getAttachment(attachmentId);
  if (!att) return false;
  db.run('DELETE FROM assignment_report_attachments WHERE id = ?', [attachmentId]);
  audit(actorId, 'assignment_report_attachment_delete', attachmentId, {
    report_id: att.report_id,
    mime_type: att.mime_type,
  });
  saveDatabaseAfterWrite();
  return true;
}

// =====================================================================
// T-25: Client engagement analytics (feature #383)
// =====================================================================
//
// Aggregate metrics over ALL assignment reports a client has produced
// for a given therapist:
//   - total reports + breakdown by type (text/voice) and finality
//   - average plaintext content length (after decryption)
//   - timeline (reports per day) for the requested window
//   - gaps between consecutive reports (in days)
//   - consistency score: 1 / (1 + std_gap_days), bounded to [0, 1]
//     where std_gap_days is the population standard deviation of the
//     day-gaps between consecutive reports. A perfectly regular cadence
//     yields 1; long-deserted, bursty cadences trend toward 0.
//
// All decryption happens through the same encryption.decrypt() helper
// the rest of this file uses, so Class A encryption is preserved end-to-end.
// We intentionally do not leak per-report plaintext to the caller; only
// numeric aggregates are returned.

/**
 * Internal: pull every report row for (therapist, client) in chronological
 * order. Decrypts content to compute length, but does NOT include the
 * plaintext in the returned objects.
 */
function listReportsForClient(therapistId, clientId, { windowDays = null } = {}) {
  const db = getDatabase();
  const params = [Number(therapistId), Number(clientId)];
  let windowClause = '';
  if (Number.isFinite(windowDays) && windowDays > 0) {
    // Window is days from "now" in UTC. We use SQLite's datetime('now', '-N days')
    // to keep the math inside the DB.
    windowClause = `AND datetime(created_at) >= datetime('now', ?)`;
    params.push(`-${Math.floor(windowDays)} days`);
  }
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, assignment_id, report_type, content_encrypted,
              is_final, acceptance_status, created_at
         FROM assignment_reports
        WHERE therapist_id = ? AND client_id = ?
          ${windowClause}
        ORDER BY datetime(created_at) ASC, id ASC`,
      params
    )
  );
  return rows.map((row) => {
    let length = 0;
    if (row.content_encrypted) {
      try {
        const text = decrypt(row.content_encrypted);
        length = (text || '').length;
      } catch (_) {
        length = 0;
      }
    }
    return {
      id: row.id,
      assignment_id: row.assignment_id,
      report_type: row.report_type,
      content_length: length,
      is_final: !!row.is_final,
      acceptance_status: row.acceptance_status,
      created_at: row.created_at,
    };
  });
}

/**
 * Compute population standard deviation of a list of numbers.
 * Returns 0 for empty or single-value lists.
 */
function stdev(values) {
  if (!values || values.length < 2) return 0;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n;
  return Math.sqrt(variance);
}

/**
 * Aggregate engagement metrics for a (therapist, client) pair.
 *
 * @param {object} args
 * @param {number} args.therapistId
 * @param {number} args.clientId
 * @param {number} [args.windowDays=90] - look-back window in days; pass 0
 *                                         to disable the window (all-time).
 * @returns {{
 *   client_id: number,
 *   window_days: number|null,
 *   summary: {
 *     total_reports: number,
 *     text_reports: number,
 *     voice_reports: number,
 *     final_reports: number,
 *     unique_assignments: number,
 *     total_chars: number,
 *     avg_chars: number,
 *     first_report_at: string|null,
 *     last_report_at: string|null,
 *     active_days: number,
 *     span_days: number,
 *   },
 *   consistency: {
 *     score: number,                 // [0,1]
 *     gap_count: number,
 *     mean_gap_days: number,
 *     median_gap_days: number,
 *     stdev_gap_days: number,
 *     max_gap_days: number,
 *     min_gap_days: number,
 *   },
 *   timeline: Array<{date: string, count: number, text: number, voice: number, total_chars: number, avg_chars: number}>,
 *   gaps_days: number[],            // gaps between consecutive reports (days, float)
 * }}
 */
function getClientEngagement(therapistId, clientId, { windowDays = 90 } = {}) {
  const reports = listReportsForClient(therapistId, clientId, {
    windowDays: Number.isFinite(windowDays) && windowDays > 0 ? windowDays : null,
  });

  const total = reports.length;
  const text = reports.filter((r) => r.report_type === 'text').length;
  const voice = reports.filter((r) => r.report_type === 'voice').length;
  const finals = reports.filter((r) => r.is_final).length;
  const uniqueAssignments = new Set(reports.map((r) => r.assignment_id)).size;
  const totalChars = reports.reduce((acc, r) => acc + (r.content_length || 0), 0);
  const avgChars = total > 0 ? Math.round(totalChars / total) : 0;

  // Bucket per UTC day so the timeline is stable regardless of viewer TZ.
  // The frontend can re-render to local TZ if desired.
  const dayBuckets = new Map();
  for (const r of reports) {
    const day = (r.created_at || '').slice(0, 10); // 'YYYY-MM-DD'
    if (!day) continue;
    if (!dayBuckets.has(day)) {
      dayBuckets.set(day, { date: day, count: 0, text: 0, voice: 0, total_chars: 0 });
    }
    const b = dayBuckets.get(day);
    b.count += 1;
    if (r.report_type === 'text') b.text += 1;
    if (r.report_type === 'voice') b.voice += 1;
    b.total_chars += (r.content_length || 0);
  }
  const timeline = Array.from(dayBuckets.values())
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((b) => ({
      date: b.date,
      count: b.count,
      text: b.text,
      voice: b.voice,
      total_chars: b.total_chars,
      avg_chars: b.count > 0 ? Math.round(b.total_chars / b.count) : 0,
    }));

  // Gaps between consecutive reports (in days, fractional).
  const gapsDays = [];
  for (let i = 1; i < reports.length; i++) {
    const prev = Date.parse(reports[i - 1].created_at);
    const curr = Date.parse(reports[i].created_at);
    if (Number.isFinite(prev) && Number.isFinite(curr) && curr >= prev) {
      gapsDays.push((curr - prev) / (1000 * 60 * 60 * 24));
    }
  }

  const sortedGaps = gapsDays.slice().sort((a, b) => a - b);
  const meanGap = gapsDays.length > 0
    ? gapsDays.reduce((a, b) => a + b, 0) / gapsDays.length
    : 0;
  const medianGap = sortedGaps.length === 0
    ? 0
    : sortedGaps.length % 2 === 1
      ? sortedGaps[(sortedGaps.length - 1) / 2]
      : (sortedGaps[sortedGaps.length / 2 - 1] + sortedGaps[sortedGaps.length / 2]) / 2;
  const stdevGap = stdev(gapsDays);
  const maxGap = gapsDays.length > 0 ? Math.max(...gapsDays) : 0;
  const minGap = gapsDays.length > 0 ? Math.min(...gapsDays) : 0;

  // Consistency score: 1 / (1 + stdev_days).
  // - stdev_days = 0  (perfectly regular cadence, e.g. every 2 days)  → 1.0
  // - stdev_days = 1  (gap varies by ±1 day on average)               → 0.5
  // - stdev_days = 7  (gap varies by ±1 week on average)              → 0.125
  // We require at least 2 reports for a meaningful score; <2 returns null.
  const consistencyScore = gapsDays.length >= 1
    ? Math.max(0, Math.min(1, 1 / (1 + stdevGap)))
    : null;

  const firstAt = reports.length > 0 ? reports[0].created_at : null;
  const lastAt = reports.length > 0 ? reports[reports.length - 1].created_at : null;
  const spanDays = (firstAt && lastAt)
    ? Math.max(0, (Date.parse(lastAt) - Date.parse(firstAt)) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    client_id: Number(clientId),
    window_days: Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : null,
    summary: {
      total_reports: total,
      text_reports: text,
      voice_reports: voice,
      final_reports: finals,
      unique_assignments: uniqueAssignments,
      total_chars: totalChars,
      avg_chars: avgChars,
      first_report_at: firstAt,
      last_report_at: lastAt,
      active_days: dayBuckets.size,
      span_days: Math.round(spanDays * 10) / 10,
    },
    consistency: {
      score: consistencyScore,
      gap_count: gapsDays.length,
      mean_gap_days: Math.round(meanGap * 100) / 100,
      median_gap_days: Math.round(medianGap * 100) / 100,
      stdev_gap_days: Math.round(stdevGap * 100) / 100,
      max_gap_days: Math.round(maxGap * 100) / 100,
      min_gap_days: Math.round(minGap * 100) / 100,
    },
    timeline,
    gaps_days: gapsDays.map((g) => Math.round(g * 100) / 100),
  };
}

module.exports = {
  VALID_REPORT_TYPES,
  listReportsForAssignment,
  getReport,
  getReportForTherapist,
  createReportAsTherapist,
  createTextReportAsClient,
  createVoiceReportAsClient,
  updateReportTranscript,
  markTranscriptionFailed,
  processReportTranscription,
  deleteReport,
  setAcceptanceStatus,
  // T-05 accept/return lifecycle
  acceptReport,
  returnReport,
  RETURN_COMMENT_MIN_CHARS,
  RETURN_COMMENT_MAX_CHARS,
  // T-21 attachments
  MAX_ATTACHMENTS_PER_REPORT,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_MIMES,
  listAttachmentsForReport,
  countAttachmentsForReport,
  getAttachment,
  insertAttachment,
  deleteAttachment,
  // T-25 engagement analytics
  getClientEngagement,
  listReportsForClient,
  // exposed for tests / internal use
  insertReport,
  findAssignmentBase,
  validateContent,
};
