// Reusable consent verification helper
// Checks that a therapist-client link exists and consent_therapist_access is granted.
const { getDatabase, saveDatabase } = require('../db/connection');
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
      saveDatabase();
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
      saveDatabase();
    }
    return { allowed: false, error: 'Client has not granted consent for data access', status: 403 };
  }

  return { allowed: true, client: { id: row[0], therapist_id: clientTherapistId, consent: hasConsent } };
}

module.exports = { verifyClientConsent };
