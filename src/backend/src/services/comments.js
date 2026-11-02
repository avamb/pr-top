// Comments Service - polymorphic dual-visibility comments
// Implements T-10: every entity (client, session, assignment, assignment_report,
// exercise_completion, inquiry) can have two kinds of comments per author:
//   - private: visible only to the author
//   - shared:  visible to both therapist and client
//
// content is encrypted at the app layer (Class A). Metadata is Class B.
//
// Authorization rules (enforced in checkEntityAccess):
//   - the entity's owner is always resolved from its own table; an entity
//     type whose owner cannot be resolved is denied (fail closed)
//   - therapist must own the entity AND pass verifyClientConsent for the
//     client tied to it (still linked + consent granted)
//   - client must be the same client tied to the entity
//   - every other role (superadmin, viewer, ...) is denied: comments are
//     Class A content and superadmin is a separate platform role (audit H3/H5)
// Visibility rules (enforced in canSeeComment):
//   - everybody sees their own comments regardless of visibility
//   - 'shared' comments are visible to the counter-party (therapist <-> client)
//   - 'private' comments are NEVER visible to the counter-party
//
// Default visibility:
//   - therapist authors -> private
//   - client authors    -> shared

const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');
const { verifyClientConsent } = require('../utils/consentCheck');

const VALID_ENTITY_TYPES = [
  'client',
  'session',
  'assignment',
  'assignment_report',
  'exercise_completion',
  'inquiry',
];
const VALID_VISIBILITIES = ['private', 'shared'];

function isValidEntityType(t) {
  return VALID_ENTITY_TYPES.includes(t);
}

function isValidVisibility(v) {
  return VALID_VISIBILITIES.includes(v);
}

/**
 * Resolve the (therapist_id, client_id) pair owning an entity, given its
 * type and id. Returns null if the entity doesn't exist or its type has no
 * resolvable owner; callers treat null as "not found" (fail closed).
 */
function resolveEntityOwner(db, entityType, entityId) {
  switch (entityType) {
    case 'client': {
      // entity_id IS the client's user id
      const r = db.exec(
        "SELECT id, therapist_id, role FROM users WHERE id = ? AND role = 'client'",
        [entityId]
      );
      if (r.length === 0 || r[0].values.length === 0) return null;
      const row = r[0].values[0];
      return { therapist_id: row[1], client_id: row[0] };
    }
    case 'session': {
      const r = db.exec(
        'SELECT therapist_id, client_id FROM sessions WHERE id = ?',
        [entityId]
      );
      if (r.length === 0 || r[0].values.length === 0) return null;
      return { therapist_id: r[0].values[0][0], client_id: r[0].values[0][1] };
    }
    case 'inquiry': {
      const r = db.exec(
        'SELECT therapist_id, client_id FROM inquiries WHERE id = ?',
        [entityId]
      );
      if (r.length === 0 || r[0].values.length === 0) return null;
      return { therapist_id: r[0].values[0][0], client_id: r[0].values[0][1] };
    }
    case 'exercise_completion': {
      // exercise_deliveries holds therapist_id and client_id
      try {
        const r = db.exec(
          'SELECT therapist_id, client_id FROM exercise_deliveries WHERE id = ?',
          [entityId]
        );
        if (r.length === 0 || r[0].values.length === 0) return null;
        return { therapist_id: r[0].values[0][0], client_id: r[0].values[0][1] };
      } catch (e) {
        return null;
      }
    }
    case 'assignment': {
      // Audit H3: owner comes from the assignments table (T-03).
      try {
        const r = db.exec(
          'SELECT therapist_id, client_id FROM assignments WHERE id = ?',
          [entityId]
        );
        if (r.length === 0 || r[0].values.length === 0) return null;
        return { therapist_id: r[0].values[0][0], client_id: r[0].values[0][1] };
      } catch (e) {
        return null;
      }
    }
    case 'assignment_report': {
      // Audit H3: report -> parent assignment chain (T-04). The report row
      // carries therapist_id/client_id too; both must agree with the parent
      // assignment, otherwise the row is inconsistent and access is denied.
      try {
        const r = db.exec(
          `SELECT a.therapist_id, a.client_id, ar.therapist_id, ar.client_id
             FROM assignment_reports ar
             JOIN assignments a ON a.id = ar.assignment_id
            WHERE ar.id = ?`,
          [entityId]
        );
        if (r.length === 0 || r[0].values.length === 0) return null;
        const [aTherapist, aClient, rTherapist, rClient] = r[0].values[0];
        if (Number(aTherapist) !== Number(rTherapist) || Number(aClient) !== Number(rClient)) {
          return null;
        }
        return { therapist_id: aTherapist, client_id: aClient };
      } catch (e) {
        return null;
      }
    }
    default:
      return null;
  }
}

/**
 * Check whether the given user is authorized to read/write comments on the
 * given (entityType, entityId). Returns { allowed, status, error, owner }.
 */
function checkEntityAccess(db, user, entityType, entityId) {
  if (!isValidEntityType(entityType)) {
    return { allowed: false, status: 400, error: 'Invalid entity_type' };
  }
  if (!Number.isInteger(Number(entityId)) || Number(entityId) <= 0) {
    return { allowed: false, status: 400, error: 'Invalid entity_id' };
  }

  // Audit H3/H5: only the two parties of the entity may read or write its
  // comments. Superadmin, viewer and any other role are denied outright.
  if (user.role !== 'therapist' && user.role !== 'client') {
    return { allowed: false, status: 403, error: 'Not authorized' };
  }

  const owner = resolveEntityOwner(db, entityType, Number(entityId));
  if (!owner) return { allowed: false, status: 404, error: 'Entity not found' };

  if (user.role === 'therapist') {
    if (owner.therapist_id == null || Number(owner.therapist_id) !== Number(user.id)) {
      return { allowed: false, status: 403, error: 'Not authorized for this entity' };
    }
    // Same consent gate as every other client-data route: the client must
    // still be linked to this therapist and consent must be granted.
    if (owner.client_id != null) {
      const consent = verifyClientConsent(user.id, owner.client_id, 'comments_access');
      if (!consent.allowed) {
        return { allowed: false, status: consent.status, error: consent.error };
      }
    }
    return { allowed: true, owner };
  }

  if (user.role === 'client') {
    if (Number(owner.client_id) !== Number(user.id)) {
      return { allowed: false, status: 403, error: 'Not authorized for this entity' };
    }
    return { allowed: true, owner };
  }

  return { allowed: false, status: 403, error: 'Not authorized' };
}

/**
 * Decide whether `user` can see a single comment row.
 *  - author always sees own comment
 *  - 'shared' comments are visible to the counter-party (therapist <-> client)
 *    of the same entity
 *  - 'private' comments are NEVER visible to anyone but the author
 *  - no role bypass: superadmin is not a party to any entity
 */
function canSeeComment(user, comment, owner) {
  if (Number(comment.author_id) === Number(user.id)) return true;
  if (comment.visibility !== 'shared') return false;

  // shared comments: must be on an entity the user is part of
  if (!owner) return false;
  // ...and written by one of the entity's CURRENT parties. On the 'client'
  // entity the owner is whoever the client is linked to now, so without this
  // a new therapist would read the previous therapist's shared comments.
  const author = Number(comment.author_id);
  if (author !== Number(owner.client_id) && author !== Number(owner.therapist_id)) {
    return false;
  }
  if (user.role === 'therapist' && Number(owner.therapist_id) === Number(user.id)) {
    return true;
  }
  if (user.role === 'client' && Number(owner.client_id) === Number(user.id)) {
    return true;
  }
  return false;
}

function decryptRow(row) {
  let content = '';
  try {
    if (row.content_encrypted) content = decrypt(row.content_encrypted);
  } catch (e) {
    logger.warn(`comments.decryptRow: failed for comment ${row.id}: ${e.message}`);
    content = '[decryption error]';
  }
  return {
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    author_id: row.author_id,
    author_role: row.author_role,
    visibility: row.visibility,
    content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowsToObjects(execResult) {
  if (!execResult.length) return [];
  const cols = execResult[0].columns;
  return execResult[0].values.map((vals) => {
    const o = {};
    cols.forEach((c, i) => (o[c] = vals[i]));
    return o;
  });
}

/**
 * List comments for an entity, filtered by visibility rules for the user.
 */
function listForEntity(user, entityType, entityId) {
  const db = getDatabase();
  const access = checkEntityAccess(db, user, entityType, entityId);
  if (!access.allowed) return access;

  const result = db.exec(
    `SELECT id, entity_type, entity_id, author_id, author_role, visibility,
            content_encrypted, created_at, updated_at
     FROM comments
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY created_at ASC`,
    [entityType, Number(entityId)]
  );
  const rows = rowsToObjects(result);
  const visible = rows
    .filter((r) => canSeeComment(user, r, access.owner))
    .map(decryptRow);

  return { allowed: true, comments: visible };
}

/**
 * Create a new comment.
 */
function createComment(user, params) {
  const { entity_type, entity_id, content, visibility } = params;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return { allowed: false, status: 400, error: 'Content is required' };
  }
  if (content.length > 50000) {
    return { allowed: false, status: 400, error: 'Content exceeds 50000 character limit' };
  }
  const db = getDatabase();
  const access = checkEntityAccess(db, user, entity_type, entity_id);
  if (!access.allowed) return access;

  // Default visibility: therapist -> private; client -> shared
  let v = visibility;
  if (!v) {
    v = user.role === 'client' ? 'shared' : 'private';
  }
  if (!isValidVisibility(v)) {
    return { allowed: false, status: 400, error: 'Invalid visibility' };
  }

  const { encrypted, keyVersion, keyId } = encrypt(content.trim());
  db.run(
    `INSERT INTO comments
       (entity_type, entity_id, author_id, author_role, visibility,
        content_encrypted, encryption_key_id, payload_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      entity_type,
      Number(entity_id),
      user.id,
      user.role,
      v,
      encrypted,
      keyId,
      keyVersion,
    ]
  );
  const lastIdResult = db.exec('SELECT last_insert_rowid()');
  const id = lastIdResult[0].values[0][0];
  saveDatabaseAfterWrite();

  // Reload to get authoritative timestamps
  const fetched = db.exec(
    `SELECT id, entity_type, entity_id, author_id, author_role, visibility,
            content_encrypted, created_at, updated_at
     FROM comments WHERE id = ?`,
    [id]
  );
  const row = rowsToObjects(fetched)[0];
  logger.info(`Comment ${id} created by user ${user.id} on ${entity_type}/${entity_id} (visibility=${v})`);
  return { allowed: true, comment: decryptRow(row) };
}

/**
 * Patch an existing comment. Only the author may modify it, and only while
 * they still have access to the entity (linked + consent for therapists).
 * Allowed fields: content, visibility.
 */
function patchComment(user, commentId, patch) {
  const db = getDatabase();
  const result = db.exec(
    `SELECT id, entity_type, entity_id, author_id, author_role, visibility,
            content_encrypted, encryption_key_id, payload_version, created_at, updated_at
     FROM comments WHERE id = ?`,
    [commentId]
  );
  const rows = rowsToObjects(result);
  if (rows.length === 0) return { allowed: false, status: 404, error: 'Comment not found' };
  const row = rows[0];
  if (Number(row.author_id) !== Number(user.id)) {
    return { allowed: false, status: 403, error: 'You may only modify your own comments' };
  }
  // The response carries decrypted content, so re-run the entity gate.
  const access = checkEntityAccess(db, user, row.entity_type, row.entity_id);
  if (!access.allowed) return access;

  const updates = [];
  const args = [];

  if (patch.content !== undefined) {
    if (
      typeof patch.content !== 'string' ||
      patch.content.trim().length === 0 ||
      patch.content.length > 50000
    ) {
      return { allowed: false, status: 400, error: 'Invalid content' };
    }
    const { encrypted, keyVersion, keyId } = encrypt(patch.content.trim());
    updates.push('content_encrypted = ?');
    args.push(encrypted);
    updates.push('encryption_key_id = ?');
    args.push(keyId);
    updates.push('payload_version = ?');
    args.push(keyVersion);
  }

  if (patch.visibility !== undefined) {
    if (!isValidVisibility(patch.visibility)) {
      return { allowed: false, status: 400, error: 'Invalid visibility' };
    }
    updates.push('visibility = ?');
    args.push(patch.visibility);
  }

  if (updates.length === 0) {
    return { allowed: false, status: 400, error: 'No updatable fields supplied' };
  }

  updates.push("updated_at = datetime('now')");
  args.push(commentId);

  db.run(`UPDATE comments SET ${updates.join(', ')} WHERE id = ?`, args);
  saveDatabaseAfterWrite();

  const fetched = db.exec(
    `SELECT id, entity_type, entity_id, author_id, author_role, visibility,
            content_encrypted, created_at, updated_at
     FROM comments WHERE id = ?`,
    [commentId]
  );
  const updated = rowsToObjects(fetched)[0];
  logger.info(`Comment ${commentId} updated by user ${user.id}`);
  return { allowed: true, comment: decryptRow(updated) };
}

/**
 * Delete a comment. Only the author may delete it (audit wave 2: the former
 * superadmin exception let a platform admin destroy Class A content; the UI
 * only ever offers delete on the user's own comments).
 */
function deleteComment(user, commentId) {
  const db = getDatabase();
  const result = db.exec(
    'SELECT id, author_id FROM comments WHERE id = ?',
    [commentId]
  );
  const rows = rowsToObjects(result);
  if (rows.length === 0) return { allowed: false, status: 404, error: 'Comment not found' };
  const row = rows[0];
  if (Number(row.author_id) !== Number(user.id)) {
    return { allowed: false, status: 403, error: 'You may only delete your own comments' };
  }
  db.run('DELETE FROM comments WHERE id = ?', [commentId]);
  saveDatabaseAfterWrite();
  logger.info(`Comment ${commentId} deleted by user ${user.id}`);
  return { allowed: true, deleted: true };
}

module.exports = {
  VALID_ENTITY_TYPES,
  VALID_VISIBILITIES,
  isValidEntityType,
  isValidVisibility,
  resolveEntityOwner,
  checkEntityAccess,
  canSeeComment,
  listForEntity,
  createComment,
  patchComment,
  deleteComment,
};
