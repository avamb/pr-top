// Inquiries Service - therapist-tracked client work threads ("client requests")
// A client can have multiple parallel or sequential inquiries (e.g. "stop snapping
// at family", "build morning routine"). Sessions can later be linked to an
// inquiry to track progress on a specific thread.
//
// title and description are encrypted at the application layer (Class A).
// All other fields are Class B (access-controlled plaintext).

const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');

const VALID_STATUSES = ['active', 'paused', 'closed'];

/**
 * Decrypt the encrypted columns of a raw inquiry row.
 * Returns plain object with decrypted title/description.
 */
function decryptRow(row) {
  let title = '';
  let description = '';
  try {
    if (row.title_encrypted) title = decrypt(row.title_encrypted);
  } catch (e) {
    logger.warn(`inquiries.decryptRow: failed to decrypt title for inquiry ${row.id}: ${e.message}`);
    title = '';
  }
  try {
    if (row.description_encrypted) description = decrypt(row.description_encrypted);
  } catch (e) {
    logger.warn(`inquiries.decryptRow: failed to decrypt description for inquiry ${row.id}: ${e.message}`);
    description = '';
  }
  return {
    id: row.id,
    client_id: row.client_id,
    therapist_id: row.therapist_id,
    title,
    description,
    status: row.status,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
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

/**
 * Write an audit log entry. details is JSON-stringified (best-effort plaintext;
 * column is named details_encrypted historically but stores JSON metadata
 * across the codebase — see consentCheck.js, sessions.js, etc.).
 */
function audit(actorId, action, targetId, details = null) {
  try {
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, 'inquiry', ?, ?, datetime('now'))",
      [actorId, action, targetId, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    logger.error(`inquiries.audit: failed to log ${action}: ${e.message}`);
  }
}

/**
 * List inquiries for a (therapist, client) pair.
 * @param {number} therapistId
 * @param {number} clientId
 * @param {object} [opts]
 * @param {string|null} [opts.status] - filter by status (active|paused|closed) or null for all
 * @returns {Array<object>} decrypted inquiries (newest first, active before closed)
 */
function listInquiries(therapistId, clientId, opts = {}) {
  const db = getDatabase();
  const { status = null } = opts;

  let where = 'therapist_id = ? AND client_id = ?';
  const params = [therapistId, clientId];
  if (status && VALID_STATUSES.includes(status)) {
    where += ' AND status = ?';
    params.push(status);
  }

  // Active first (so therapist sees them on top), then by most recent activity
  const sql =
    `SELECT id, client_id, therapist_id, title_encrypted, description_encrypted,
            status, opened_at, closed_at, created_at, updated_at, payload_version
     FROM inquiries
     WHERE ${where}
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
              updated_at DESC, id DESC`;
  const rows = rowsToObjects(db.exec(sql, params));
  return rows.map(decryptRow);
}

/**
 * Get a single inquiry by id, scoped to a (therapist, client) pair.
 * Returns the decrypted inquiry or null.
 */
function getInquiry(therapistId, clientId, inquiryId) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, client_id, therapist_id, title_encrypted, description_encrypted,
              status, opened_at, closed_at, created_at, updated_at, payload_version
       FROM inquiries
       WHERE id = ? AND therapist_id = ? AND client_id = ?`,
      [inquiryId, therapistId, clientId]
    )
  );
  if (rows.length === 0) return null;
  return decryptRow(rows[0]);
}

/**
 * Create a new inquiry.
 * @param {object} input
 * @param {number} input.therapistId
 * @param {number} input.clientId
 * @param {string} input.title - required (Class A, encrypted)
 * @param {string} [input.description] - optional (Class A, encrypted)
 * @param {string} [input.status] - default 'active'
 * @returns {object} the created inquiry (decrypted)
 */
function createInquiry({ therapistId, clientId, title, description = '', status = 'active' }) {
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
  if (description && description.length > 5000) {
    const err = new Error('Description is too long (max 5000 chars)');
    err.code = 'invalid_input';
    throw err;
  }
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error('Invalid status');
    err.code = 'invalid_input';
    throw err;
  }

  const db = getDatabase();
  const titleEnc = encrypt(title.trim());
  const descEnc = description && description.trim() ? encrypt(description.trim()) : null;

  db.run(
    `INSERT INTO inquiries
       (client_id, therapist_id, title_encrypted, description_encrypted,
        encryption_key_id, payload_version, status, opened_at, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
    [
      clientId,
      therapistId,
      titleEnc.encrypted,
      descEnc ? descEnc.encrypted : null,
      titleEnc.keyId,
      titleEnc.keyVersion,
      status,
      status === 'closed' ? new Date().toISOString() : null,
    ]
  );

  const idResult = db.exec('SELECT last_insert_rowid()');
  const inquiryId = idResult[0].values[0][0];

  audit(therapistId, 'inquiry_create', inquiryId, { client_id: clientId, status });
  saveDatabaseAfterWrite();

  return getInquiry(therapistId, clientId, inquiryId);
}

/**
 * Update an inquiry. Allows changing title/description/status.
 * Closing an inquiry sets closed_at; re-opening clears it.
 * @returns {object|null} updated inquiry or null if not found
 */
function updateInquiry({ therapistId, clientId, inquiryId, title, description, status }) {
  const db = getDatabase();
  const existing = getInquiry(therapistId, clientId, inquiryId);
  if (!existing) return null;

  const fields = [];
  const params = [];
  const auditDetails = { client_id: clientId, changes: [] };

  if (typeof title === 'string') {
    const trimmed = title.trim();
    if (!trimmed) {
      const err = new Error('Title cannot be empty');
      err.code = 'invalid_input';
      throw err;
    }
    if (trimmed.length > 200) {
      const err = new Error('Title is too long (max 200 chars)');
      err.code = 'invalid_input';
      throw err;
    }
    const enc = encrypt(trimmed);
    fields.push('title_encrypted = ?');
    fields.push('encryption_key_id = ?');
    fields.push('payload_version = ?');
    params.push(enc.encrypted, enc.keyId, enc.keyVersion);
    auditDetails.changes.push('title');
  }

  if (typeof description === 'string') {
    if (description.length > 5000) {
      const err = new Error('Description is too long (max 5000 chars)');
      err.code = 'invalid_input';
      throw err;
    }
    if (description.trim()) {
      const enc = encrypt(description.trim());
      fields.push('description_encrypted = ?');
      params.push(enc.encrypted);
    } else {
      fields.push('description_encrypted = NULL');
    }
    auditDetails.changes.push('description');
  }

  if (typeof status === 'string') {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error('Invalid status');
      err.code = 'invalid_input';
      throw err;
    }
    fields.push('status = ?');
    params.push(status);

    if (status === 'closed' && existing.status !== 'closed') {
      fields.push("closed_at = datetime('now')");
    } else if (status !== 'closed' && existing.status === 'closed') {
      fields.push('closed_at = NULL');
    }
    auditDetails.changes.push(`status:${existing.status}->${status}`);
  }

  if (fields.length === 0) {
    return existing; // no-op
  }

  fields.push("updated_at = datetime('now')");
  params.push(inquiryId, therapistId, clientId);

  db.run(
    `UPDATE inquiries SET ${fields.join(', ')} WHERE id = ? AND therapist_id = ? AND client_id = ?`,
    params
  );

  audit(therapistId, 'inquiry_update', inquiryId, auditDetails);
  saveDatabaseAfterWrite();

  return getInquiry(therapistId, clientId, inquiryId);
}

/**
 * Close an inquiry (sets status='closed'). Convenience wrapper.
 */
function closeInquiry(therapistId, clientId, inquiryId) {
  return updateInquiry({ therapistId, clientId, inquiryId, status: 'closed' });
}

/**
 * Permanently delete an inquiry (hard delete). Returns true if a row was deleted.
 * Note: per spec, "closed" is the recommended path — sessions linked to the
 * inquiry should remain. Hard delete is exposed mainly for therapist mistakes
 * (e.g. accidentally created an inquiry for the wrong client).
 */
function deleteInquiry(therapistId, clientId, inquiryId) {
  const db = getDatabase();
  const existing = getInquiry(therapistId, clientId, inquiryId);
  if (!existing) return false;

  db.run(
    'DELETE FROM inquiries WHERE id = ? AND therapist_id = ? AND client_id = ?',
    [inquiryId, therapistId, clientId]
  );
  audit(therapistId, 'inquiry_delete', inquiryId, { client_id: clientId });
  saveDatabaseAfterWrite();
  return true;
}

module.exports = {
  VALID_STATUSES,
  listInquiries,
  getInquiry,
  createInquiry,
  updateInquiry,
  closeInquiry,
  deleteInquiry,
};
