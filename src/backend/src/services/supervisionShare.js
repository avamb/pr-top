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
//
// Audit H4: every public access re-validates the link (findActiveLinkByToken):
//   - not revoked, not expired;
//   - the client still exists and is still linked to the therapist who
//     created the link, and consent_therapist_access is still granted
//     (same check as utils/consentCheck.verifyClientConsent);
//   - the creating therapist's account still exists and isn't blocked;
//   - no consent revocation / (re)grant / admin re-link of the client was
//     audit-logged after the link was created (backstop for revivals).
// Consent revocation (routes/bot.js) and admin re-linking (routes/clients.js
// POST /link) also revoke a client's links eagerly via revokeAllForClient.
// When a client/consent/therapist check fails the link is revoked on the spot
// (revoked_at set, audit row 'supervision_share_auto_revoke'), so it stays
// dead even if consent is granted again later. The view is also frozen at the
// link's creation time: records created after created_at are never included,
// and client-private diary entries are always excluded.

const crypto = require('crypto');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { decrypt } = require('./encryption');
const { logger } = require('../utils/logger');
const { verifyClientConsent } = require('../utils/consentCheck');

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
  // Confirm client belongs to this therapist and has granted consent (H4:
  // a share link exposes Class A data, so it needs the same consent gate as
  // the dashboard routes).
  const consent = verifyClientConsent(therapistId, clientId, 'create_supervision_share');
  if (!consent.allowed) {
    const consentMissing = consent.status === 403 && /consent/i.test(consent.error || '');
    const err = new Error(consentMissing
      ? 'Client has not granted consent for data access'
      : 'Client not found or not linked to you');
    err.code = consentMissing ? 'consent_required' : 'not_found';
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
  const rows = rowsToObjects(db.exec(sql, params));
  // H4: a link whose access conditions no longer hold (consent revoked or
  // re-granted since, client moved, therapist blocked) is revoked here too,
  // so the therapist's list shows it as Revoked/inactive even if nobody has
  // opened it since. Already revoked or expired rows are left untouched.
  const now = new Date();
  for (const row of rows) {
    if (row.revoked_at) continue;
    if (row.expires_at && new Date(row.expires_at) < now) continue;
    const problem = linkAccessProblem(db, row);
    if (problem) {
      autoRevokeLink(db, row, problem);
      const r = db.exec('SELECT revoked_at FROM supervision_share_links WHERE id = ?', [row.id]);
      row.revoked_at = r.length > 0 && r[0].values.length > 0 ? r[0].values[0][0] : new Date().toISOString();
    }
  }
  return rows;
}

/**
 * Revoke every still-active share link of a client (H4). Call wherever a
 * client withdraws consent, is unlinked from or moves away from a therapist,
 * or is deleted. Returns the number of links revoked. The caller persists the
 * write with saveDatabaseAfterWrite() together with its own changes.
 */
function revokeAllForClient(clientId, reason = 'client_unlinked', db = getDatabase()) {
  const before = db.exec(
    'SELECT COUNT(*) FROM supervision_share_links WHERE client_id = ? AND revoked_at IS NULL',
    [clientId]
  );
  const count = before.length > 0 ? Number(before[0].values[0][0]) : 0;
  if (count === 0) return 0;
  db.run(
    "UPDATE supervision_share_links SET revoked_at = datetime('now') WHERE client_id = ? AND revoked_at IS NULL",
    [clientId]
  );
  try {
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (0, 'supervision_share_revoke_all', 'user', ?, ?, datetime('now'))",
      [clientId, JSON.stringify({ client_id: clientId, reason, count })]
    );
  } catch (e) {
    logger.error(`supervisionShare.revokeAllForClient audit failed: ${e.message}`);
  }
  logger.info(`Revoked ${count} supervision share link(s) of client ${clientId} (${reason})`);
  return count;
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
 * Check that the parties behind a share link still allow access (H4).
 * Returns null when everything is fine, otherwise a short reason code.
 */
function linkAccessProblem(db, link) {
  // Client still exists, is still linked to the creating therapist, and
  // consent is still granted. No auditAction: the denial is audited by
  // autoRevokeLink with the right actor (the anonymous share link).
  const consent = verifyClientConsent(link.therapist_id, link.client_id);
  if (!consent.allowed) {
    if (consent.status === 404) return 'client_not_found';
    return /consent/i.test(consent.error || '') ? 'consent_revoked' : 'client_unlinked';
  }
  const t = db.exec('SELECT id, blocked_at FROM users WHERE id = ?', [link.therapist_id]);
  if (t.length === 0 || t[0].values.length === 0) return 'therapist_not_found';
  if (t[0].values[0][1]) return 'therapist_blocked';
  // Backstop: there is no consent timestamp column, so use the audit trail.
  // Any consent revocation, (re)grant or admin re-link recorded after the
  // link was created means the link belongs to an earlier consent period
  // and must not come back to life, even though consent is granted now.
  const cutoff = link.created_at || new Date(0).toISOString();
  const changed = db.exec(
    `SELECT 1 FROM audit_logs
      WHERE datetime(created_at) > datetime(?)
        AND ((actor_id = ? AND action IN ('consent_granted', 'consent_revoked'))
          OR (target_id = ? AND action = 'superadmin_direct_link'))
      LIMIT 1`,
    [cutoff, link.client_id, link.client_id]
  );
  if (changed.length > 0 && changed[0].values.length > 0) return 'consent_changed_since_link';
  return null;
}

/**
 * Revoke a link because its access conditions no longer hold. Idempotent.
 */
function autoRevokeLink(db, link, reason) {
  try {
    db.run(
      "UPDATE supervision_share_links SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL",
      [link.id]
    );
    audit(0, 'supervision_share_auto_revoke', link.id, { client_id: link.client_id, reason });
    saveDatabaseAfterWrite();
    logger.info(`Supervision share link ${link.id} auto-revoked (${reason})`);
  } catch (e) {
    logger.error(`supervisionShare.autoRevokeLink failed for link ${link.id}: ${e.message}`);
  }
}

/**
 * Look up a share link by its public token. Returns null if missing, revoked,
 * expired, or no longer allowed (client unlinked / consent revoked / therapist
 * blocked; such links are revoked on the spot, see linkAccessProblem).
 * Used by the public /share/supervision/:token endpoint (GET and HEAD).
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
  const problem = linkAccessProblem(db, link);
  if (problem) {
    autoRevokeLink(db, link, problem);
    return null;
  }
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
  // H4: the view is frozen at the moment the link was created. Records
  // created afterwards are never shared; inquiries and comments edited
  // afterwards are left out too (sessions show their current summary). datetime() normalises both the
  // SQLite "YYYY-MM-DD HH:MM:SS" and ISO-8601 forms before comparing.
  const cutoff = link.created_at || new Date().toISOString();

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
           AND datetime(created_at) <= datetime(?)
         ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 200`,
        [therapistId, clientId, cutoff]
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
        // T-12: never share client-private diary entries with supervisors.
        `SELECT id, entry_type, content_encrypted, transcript_encrypted, created_at
         FROM diary_entries WHERE client_id = ? AND (is_private = 0 OR is_private IS NULL)
           AND datetime(created_at) <= datetime(?)
         ORDER BY created_at DESC LIMIT 200`,
        [clientId, cutoff]
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
           AND datetime(created_at) <= datetime(?)
           AND datetime(COALESCE(updated_at, created_at)) <= datetime(?)
         ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
                  updated_at DESC LIMIT 200`,
        [therapistId, clientId, cutoff, cutoff]
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
           AND author_id IN (?, ?)
           AND datetime(created_at) <= datetime(?)
           AND datetime(COALESCE(updated_at, created_at)) <= datetime(?)
         ORDER BY created_at DESC LIMIT 200`,
        [clientId, therapistId, clientId, cutoff, cutoff]
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
  linkAccessProblem,
  revokeAllForClient,
  recordAccess,
  buildSupervisorView,
  anonymizeText,
};
