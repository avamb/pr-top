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
              is_final, acceptance_status, created_at, updated_at
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
              is_final, acceptance_status, created_at, updated_at
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
 * Update acceptance status of a (typically final) report. Used by the future
 * T-05 acceptance flow — we expose it now so the API is complete.
 */
function setAcceptanceStatus(therapistId, reportId, status) {
  const validStatuses = ['pending', 'accepted', 'rejected'];
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
  // T-21 attachments
  MAX_ATTACHMENTS_PER_REPORT,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_MIMES,
  listAttachmentsForReport,
  countAttachmentsForReport,
  getAttachment,
  insertAttachment,
  deleteAttachment,
  // exposed for tests / internal use
  insertReport,
  findAssignmentBase,
  validateContent,
};
