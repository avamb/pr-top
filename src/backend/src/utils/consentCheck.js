// Reusable consent verification helper
// Checks that a therapist-client link exists and consent_therapist_access is granted.
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('./logger');

/**
 * Verify that a therapist has consent to access a client's data.
 * @param {number} therapistId - The therapist's user ID
 * @param {number|string} clientId - The client's user ID
 * @param {string} [auditAction] - Optional audit action to log on denial
 * @returns {{ allowed: boolean, error?: string, status?: number, client?: object }}
 */
function verifyClientConsent(therapistId, clientId, auditAction) {
  const db = getDatabase();

  const result = db.exec(
    "SELECT id, therapist_id, consent_therapist_access FROM users WHERE id = ? AND role = 'client'",
    [clientId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return { allowed: false, error: 'Client not found', status: 404 };
  }

  const row = result[0].values[0];
  const clientTherapistId = row[1];
  const hasConsent = row[2];

  // Check therapist linkage
  if (!clientTherapistId || String(clientTherapistId) !== String(therapistId)) {
    if (auditAction) {
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'access_denied', auditAction, clientId, JSON.stringify({ reason: 'not_linked_therapist' })]
      );
      saveDatabaseAfterWrite();
    }
    return { allowed: false, error: 'You are not authorized to access this client\'s data', status: 403 };
  }

  // Check consent
  if (!hasConsent) {
    if (auditAction) {
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'access_denied', auditAction, clientId, JSON.stringify({ reason: 'consent_not_granted' })]
      );
      saveDatabaseAfterWrite();
    }
    return { allowed: false, error: 'Client has not granted consent for data access', status: 403 };
  }

  return { allowed: true, client: { id: row[0], therapist_id: clientTherapistId, consent: hasConsent } };
}

/**
 * Startup check (audit wave 2): clients whose therapist_id points at a
 * superadmin account. Before wave 2, POST /api/clients/link let a superadmin
 * link clients to their own account with consent forced on, which gives the
 * platform admin the client's Class A data through the therapist routes.
 * Logs a warning with the count (never ids or emails) and returns it.
 * Read-only; safe to call right after initDatabase().
 * @returns {number}
 */
function warnClientsLinkedToSuperadmin() {
  try {
    const db = getDatabase();
    const r = db.exec(
      `SELECT COUNT(*) FROM users c JOIN users a ON a.id = c.therapist_id
        WHERE c.role = 'client' AND a.role = 'superadmin'`
    );
    const count = r.length > 0 && r[0].values.length > 0 ? Number(r[0].values[0][0]) : 0;
    if (count > 0) {
      logger.warn(`[Consent] ${count} client(s) are linked to a superadmin account. Superadmin is a platform role and must not hold clients: the client should /disconnect in the bot and reconnect with their therapist's invite code.`);
    }
    return count;
  } catch (e) {
    logger.warn('[Consent] superadmin-linked client check failed: ' + e.message);
    return 0;
  }
}

module.exports = { verifyClientConsent, warnClientsLinkedToSuperadmin };
