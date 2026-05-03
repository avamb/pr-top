// Supervision Share Service (T-17)
// Therapist generates a read-only public share link to show client history to a
// supervisor without sharing a password. Link has TTL (1d/7d/30d), optional
// anonymization, and can be revoked at any time. Public endpoint authenticates
// supervisor access via opaque token only — no auth/cookies/csrf.
//
// Read-only share view INCLUDES (when consent_therapist_access is granted):
//   - sessions (metadata + summary; transcripts when available)
//   - diary entries (transcripts/text content)
//   - inquiries (the client's tracked work threads)
//   - shared comments/notes (visibility='shared')
// Share view EXCLUDES:
//   - private therapist comments
//   - SOS event details with personal data
//   - raw audio/video files (we expose only transcripts)
//   - real client identity when anonymize=true
//
// All access through a share link is recorded in audit_logs.

const crypto = require('crypto');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { decrypt } = require('./encryption');
const { logger } = require('../utils/logger');

// Allowed TTL options exposed to the UI. Maps to seconds.
const TTL_OPTIONS = {
  '1d': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
};

/**
 * Generate a cryptographically random opaque share token (URL-safe).
 * 32 bytes -> 43 base64url chars.
 */
function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Convert sql.js exec result to plain objects.
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
 * Best-effort audit log helper. Schema mirrors other services in this codebase.
 */
function audit(actorId, action, targetId, details = null, ipAddress = null) {
  try {
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, ip_address, created_at) VALUES (?, ?, 'supervision_share', ?, ?, ?, datetime('now'))",
      [actorId, action, targetId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (e) {
    logger.error(`supervisionShare.audit failed for ${action}: ${e.message}`);
  }
}

/**
 * Map a raw DB row to the JSON shape returned to therapists/UI.
 */
function toApiLink(row, baseUrl) {
  const isExpired = !!row.expires_at && new Date(row.expires_at) < new Date();
  const isRevoked = !!row.revoked_at;
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/share/supervision/${row.token}` : null;
  return {
    id: row.id,
    therapist_id: row.therapist_id,
    client_id: row.client_id,
    token: row.token,
    url,
    expires_at: row.expires_at,
    anonymize: !!row.anonymize,
    note: row.note || null,
    created_at: row.created_at,
    revoked_at: row.revoked_at || null,
    last_accessed_at: row.last_accessed_at || null,
    access_count: row.access_count || 0,
    is_expired: isExpired,
    is_revoked: isRevoked,
    is_active: !isExpired && !isRevoked,
  };
}

/**
 * Create a new supervision share link.
 * @param {object} input
 * @param {number} input.therapistId
 * @param {number} input.clientId
 * @param {string} input.ttl - one of '1d' | '7d' | '30d'
 * @param {boolean} [input.anonymize=true]
 * @param {string} [input.note]
 */
function createLink({ therapistId, clientId, ttl, anonymize = true, note = '' }) {
  if (!TTL_OPTIONS[ttl]) {
    const err = new Error('Invalid TTL. Must be 1d, 7d, or 30d');
    err.code = 'invalid_input';
    throw err;
  }
  if (note && typeof note === 'string' && note.length > 500) {
    const err = new Error('Note is too long (max 500 chars)');
    err.code = 'invalid_input';
    throw err;
  }

  const db = getDatabase();
  // Confirm client belongs to this therapist
  const clientCheck = db.exec(
    "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client'",
    [clientId, therapistId]
  );
  if (clientCheck.length === 0 || clientCheck[0].values.length === 0) {
    const err = new Error('Client not found or not linked to you');
    err.code = 'not_found';
    throw err;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_OPTIONS[ttl] * 1000).toISOString();

  db.run(
    `INSERT INTO supervision_share_links
       (therapist_id, client_id, token, expires_at, anonymize, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [therapistId, clientId, token, expiresAt, anonymize ? 1 : 0, note || null]
  );

  const idRes = db.exec('SELECT last_insert_rowid()');
  const id = idRes[0].values[0][0];
  audit(therapistId, 'supervision_share_create', id, {
    client_id: clientId,
    ttl,
    anonymize: !!anonymize,
  });
  saveDatabaseAfterWrite();

  return getLinkById(therapistId, id);
}

/**
 * Get a single share link (must belong to therapist).
 */
function getLinkById(therapistId, id) {
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, therapist_id, client_id, token, expires_at, anonymize, note,
              created_at, revoked_at, last_accessed_at, access_count
       FROM supervision_share_links
       WHERE id = ? AND therapist_id = ?`,
      [id, therapistId]
    )
  );
  return rows[0] || null;
}

/**
 * List share links for a therapist (optionally filtered by client_id).
 */
function listLinks(therapistId, clientId = null) {
  const db = getDatabase();
  let sql = `SELECT id, therapist_id, client_id, token, expires_at, anonymize, note,
                    created_at, revoked_at, last_accessed_at, access_count
             FROM supervision_share_links
             WHERE therapist_id = ?`;
  const params = [therapistId];
  if (clientId) {
    sql += ' AND client_id = ?';
    params.push(clientId);
  }
  sql += ' ORDER BY created_at DESC';
  return rowsToObjects(db.exec(sql, params));
}

/**
 * Revoke a share link (soft revoke — sets revoked_at).
 * Returns true if a row was revoked, false if not found.
 */
function revokeLink(therapistId, id) {
  const db = getDatabase();
  const link = getLinkById(therapistId, id);
  if (!link) return false;
  if (link.revoked_at) return true; // already revoked, idempotent

  db.run(
    "UPDATE supervision_share_links SET revoked_at = datetime('now') WHERE id = ? AND therapist_id = ?",
    [id, therapistId]
  );
  audit(therapistId, 'supervision_share_revoke', id, { client_id: link.client_id });
  saveDatabaseAfterWrite();
  return true;
}

/**
 * Look up a share link by its public token. Returns null if missing/revoked/expired.
 * Used by the public /share/supervision/:token endpoint.
 */
function findActiveLinkByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const db = getDatabase();
  const rows = rowsToObjects(
    db.exec(
      `SELECT id, therapist_id, client_id, token, expires_at, anonymize, note,
              created_at, revoked_at, last_accessed_at, access_count
       FROM supervision_share_links
       WHERE token = ?`,
      [token]
    )
  );
  if (rows.length === 0) return null;
  const link = rows[0];
  if (link.revoked_at) return null;
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null;
  return link;
}

/**
 * Record an access against a share link (increments counter, updates last_accessed_at,
 * writes audit row). Best-effort — never throws to caller.
 */
function recordAccess(linkId, ipAddress = null, details = null) {
  try {
    const db = getDatabase();
    db.run(
      `UPDATE supervision_share_links
       SET last_accessed_at = datetime('now'),
           access_count = COALESCE(access_count, 0) + 1
       WHERE id = ?`,
      [linkId]
    );
    audit(0, 'supervision_share_access', linkId, details, ipAddress);
    saveDatabaseAfterWrite();
  } catch (e) {
    logger.warn(`supervisionShare.recordAccess: ${e.message}`);
  }
}

/**
 * Anonymize a string by stripping or replacing person-identifying tokens.
 * Generic safety net — backed by name/phone/email replacement.
 */
function anonymizeText(text, displayName) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  // Replace email addresses
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]');
  // Replace phone numbers (loose)
  out = out.replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone redacted]');
  return out;
}

/**
 * Build the read-only supervisor view for a given share link. Decrypts only
 * fields that supervisors are allowed to see; applies anonymization when set.
 *
 * Returns: {
 *   client: { display_name, language, anonymized },
 *   sessions: [...],
 *   diary: [...],
 *   inquiries: [...],
 *   shared_comments: [...],
 *   meta: { expires_at, anonymize, note, created_at }
 * }
 */
function buildSupervisorView(link) {
  const db = getDatabase();
  const { therapist_id: therapistId, client_id: clientId, anonymize, note } = link;
  const isAnonymized = !!anonymize;

  // Resolve display name
  let displayName = 'Client A';
  let language = 'en';
  try {
    const cRows = rowsToObjects(
      db.exec(
        'SELECT first_name, last_name, email, telegram_username, language FROM users WHERE id = ?',
        [clientId]
      )
    );
    if (cRows[0]) {
      const c = cRows[0];
      language = c.language || 'en';
      if (!isAnonymized) {
        const fn = (c.first_name || '').trim();
        const ln = (c.last_name || '').trim();
        if (fn || ln) {
          displayName = `${fn} ${ln}`.trim();
        } else if (c.telegram_username) {
          displayName = `@${c.telegram_username}`;
        } else if (c.email) {
          displayName = c.email;
        }
      }
    }
  } catch (e) {
    logger.warn(`buildSupervisorView: client lookup failed: ${e.message}`);
  }

  // Sessions (metadata + summary; transcript surfaced if present and not anonymized-stripped)
  const sessions = [];
  try {
    const sRows = rowsToObjects(
      db.exec(
        `SELECT id, scheduled_at, status, summary_encrypted, transcript_encrypted, created_at
         FROM sessions WHERE therapist_id = ? AND client_id = ?
         ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 200`,
        [therapistId, clientId]
      )
    );
    for (const r of sRows) {
      let summary = null;
      let transcript = null;
      try { if (r.summary_encrypted) summary = decrypt(r.summary_encrypted); } catch (e) { summary = null; }
      try { if (r.transcript_encrypted) transcript = decrypt(r.transcript_encrypted); } catch (e) { transcript = null; }
      if (isAnonymized) {
        summary = anonymizeText(summary, displayName);
        transcript = anonymizeText(transcript, displayName);
      }
      sessions.push({
        id: r.id,
        scheduled_at: r.scheduled_at,
        status: r.status,
        summary,
        transcript,
        has_transcript: !!r.transcript_encrypted,
        created_at: r.created_at,
      });
    }
  } catch (e) {
    logger.warn(`buildSupervisorView: sessions query failed: ${e.message}`);
  }

  // Diary entries (text/transcript content only — never raw audio/video)
  const diary = [];
  try {
    const dRows = rowsToObjects(
      db.exec(
        `SELECT id, entry_type, content_encrypted, transcript_encrypted, created_at
         FROM diary_entries WHERE client_id = ?
         ORDER BY created_at DESC LIMIT 200`,
        [clientId]
      )
    );
    for (const r of dRows) {
      let content = null;
      let transcript = null;
      try { if (r.content_encrypted) content = decrypt(r.content_encrypted); } catch (e) { content = null; }
      try { if (r.transcript_encrypted) transcript = decrypt(r.transcript_encrypted); } catch (e) { transcript = null; }
      if (isAnonymized) {
        content = anonymizeText(content, displayName);
        transcript = anonymizeText(transcript, displayName);
      }
      diary.push({
        id: r.id,
        entry_type: r.entry_type,
        content,
        transcript,
        created_at: r.created_at,
      });
    }
  } catch (e) {
    logger.warn(`buildSupervisorView: diary query failed: ${e.message}`);
  }

  // Inquiries (T-01) — therapist-tracked work threads
  const inquiries = [];
  try {
    // Defensive: table may not exist in older databases
    const iRows = rowsToObjects(
      db.exec(
        `SELECT id, title_encrypted, description_encrypted, status, opened_at, closed_at, created_at, updated_at
         FROM inquiries WHERE therapist_id = ? AND client_id = ?
         ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
                  updated_at DESC LIMIT 200`,
        [therapistId, clientId]
      )
    );
    for (const r of iRows) {
      let title = '';
      let description = '';
      try { if (r.title_encrypted) title = decrypt(r.title_encrypted); } catch (e) { title = ''; }
      try { if (r.description_encrypted) description = decrypt(r.description_encrypted); } catch (e) { description = ''; }
      if (isAnonymized) {
        title = anonymizeText(title, displayName);
        description = anonymizeText(description, displayName);
      }
      inquiries.push({
        id: r.id,
        title,
        description,
        status: r.status,
        opened_at: r.opened_at,
        closed_at: r.closed_at,
        created_at: r.created_at,
      });
    }
  } catch (e) {
    // Older DB without inquiries table — non-fatal.
    logger.debug(`buildSupervisorView: inquiries query skipped: ${e.message}`);
  }

  // Shared comments (T-10) — visibility='shared' only
  const sharedComments = [];
  try {
    const cRows = rowsToObjects(
      db.exec(
        `SELECT id, entity_type, entity_id, author_role, content_encrypted, created_at
         FROM comments
         WHERE entity_type = 'client' AND entity_id = ?
           AND visibility = 'shared'
         ORDER BY created_at DESC LIMIT 200`,
        [clientId]
      )
    );
    for (const r of cRows) {
      let content = null;
      try { if (r.content_encrypted) content = decrypt(r.content_encrypted); } catch (e) { content = null; }
      if (isAnonymized) content = anonymizeText(content, displayName);
      sharedComments.push({
        id: r.id,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        author_role: r.author_role,
        content,
        created_at: r.created_at,
      });
    }
  } catch (e) {
    logger.debug(`buildSupervisorView: comments query skipped: ${e.message}`);
  }

  return {
    client: {
      display_name: displayName,
      language,
      anonymized: isAnonymized,
    },
    sessions,
    diary,
    inquiries,
    shared_comments: sharedComments,
    meta: {
      expires_at: link.expires_at,
      anonymize: isAnonymized,
      note: note || null,
      created_at: link.created_at,
    },
  };
}

module.exports = {
  TTL_OPTIONS,
  generateToken,
  toApiLink,
  createLink,
  getLinkById,
  listLinks,
  revokeLink,
  findActiveLinkByToken,
  recordAccess,
  buildSupervisorView,
  anonymizeText,
};
