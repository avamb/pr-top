// Comments Service - polymorphic dual-visibility comments
// Implements T-10: every entity (client, session, assignment, assignment_report,
// exercise_completion, inquiry) can have two kinds of comments per author:
//   - private: visible only to the author
//   - shared:  visible to both therapist and client
//
// content is encrypted at the app layer (Class A). Metadata is Class B.
//
// Authorization rules (enforced in resolveEntityAccess):
//   - therapist must own the client tied to the entity
//   - client must be the same client tied to the entity
//   - superadmin sees everything
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
 * type and id. Returns null if the entity doesn't exist.
 *
 * For polymorphic entity types that don't have their own table yet (e.g.
 * 'assignment', 'assignment_report', 'exercise_completion'), the caller is
 * expected to validate ownership at the API layer; this resolver returns
 * a "wildcard" descriptor and the route handler must verify access.
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
    case 'assignment':
    case 'assignment_report': {
      // No dedicated table yet - allow if caller validates separately.
      // We accept the comment but require both therapist and client context
      // to be supplied by the API layer.
      return { therapist_id: null, client_id: null, deferred: true };
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

  if (user.role === 'superadmin') {
    const owner = resolveEntityOwner(db, entityType, Number(entityId));
    if (!owner) return { allowed: false, status: 404, error: 'Entity not found' };
    return { allowed: true, owner };
  }

  const owner = resolveEntityOwner(db, entityType, Number(entityId));
  if (!owner) return { allowed: false, status: 404, error: 'Entity not found' };

  // Deferred ownership for assignment/assignment_report (no dedicated table yet)
  if (owner.deferred) {
    return { allowed: true, owner };
  }

  if (user.role === 'therapist') {
    if (Number(owner.therapist_id) !== Number(user.id)) {
      return { allowed: false, status: 403, error: 'Not authorized for this entity' };
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
 *  - superadmin sees everything
 */
function canSeeComment(user, comment, owner) {
  if (user.role === 'superadmin') return true;
  if (Number(comment.author_id) === Number(user.id)) return true;
  if (comment.visibility !== 'shared') return false;

  // shared comments: must be on an entity the user is part of
  if (!owner || owner.deferred) return true; // best-effort for deferred
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
 * Patch an existing comment. Only the author may modify it.
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
  if (user.role !== 'superadmin' && Number(row.author_id) !== Number(user.id)) {
    return { allowed: false, status: 403, error: 'You may only modify your own comments' };
  }

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
 * Delete a comment. Only the author or a superadmin may delete it.
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
  if (user.role !== 'superadmin' && Number(row.author_id) !== Number(user.id)) {
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
