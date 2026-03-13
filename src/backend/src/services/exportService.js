// Export Service - GDPR-compatible full data export
// Aggregates all client data types, decrypts, and formats for export.

const { getDatabase } = require('../db/connection');
const { decrypt } = require('./encryption');
const { logger } = require('../utils/logger');

/**
 * Safely decrypt a value, returning null on failure
 */
function safeDecrypt(encrypted) {
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch (e) {
    logger.warn('Failed to decrypt value during export: ' + e.message);
    return '[decryption failed]';
  }
}

/**
 * Export client profile data
 */
function exportClientProfile(clientId) {
  const db = getDatabase();
  const result = db.exec(
    "SELECT id, email, telegram_id, language, timezone, consent_therapist_access, created_at, updated_at FROM users WHERE id = ? AND role = 'client'",
    [clientId]
  );
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return {
    id: row[0],
    email: row[1],
    telegram_id: row[2],
    language: row[3],
    timezone: row[4],
    consent_therapist_access: !!row[5],
    created_at: row[6],
    updated_at: row[7]
  };
}

/**
 * Export client context (anamnesis, goals, etc.)
 */
function exportClientContext(clientId, therapistId) {
  const db = getDatabase();
  const result = db.exec(
    "SELECT anamnesis_encrypted, current_goals_encrypted, contraindications_encrypted, ai_instructions_encrypted, updated_at FROM client_context WHERE client_id = ? AND therapist_id = ?",
    [clientId, therapistId]
  );
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return {
    anamnesis: safeDecrypt(row[0]),
    current_goals: safeDecrypt(row[1]),
    contraindications: safeDecrypt(row[2]),
    ai_instructions: safeDecrypt(row[3]),
    updated_at: row[4]
  };
}

/**
 * Export diary entries for a client
 */
function exportDiaryEntries(clientId) {
  const db = getDatabase();
  const result = db.exec(
    "SELECT id, entry_type, content_encrypted, transcript_encrypted, file_ref, created_at FROM diary_entries WHERE client_id = ? ORDER BY created_at DESC",
    [clientId]
  );
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0],
    entry_type: row[1],
    content: safeDecrypt(row[2]),
    transcript: safeDecrypt(row[3]),
    has_file: !!row[4],
    created_at: row[5]
  }));
}

/**
 * Export sessions with transcripts and summaries
 */
function exportSessions(clientId, therapistId) {
  const db = getDatabase();
  const result = db.exec(
    "SELECT id, status, transcript_encrypted, summary_encrypted, audio_ref, created_at FROM sessions WHERE client_id = ? AND therapist_id = ? ORDER BY created_at DESC",
    [clientId, therapistId]
  );
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0],
    status: row[1],
    transcript: safeDecrypt(row[2]),
    summary: safeDecrypt(row[3]),
    has_audio: !!row[4],
    created_at: row[5]
  }));
}

/**
 * Export therapist notes for a client
 */
function exportTherapistNotes(clientId, therapistId) {
  const db = getDatabase();
  const result = db.exec(
    "SELECT id, note_encrypted, session_date, created_at, updated_at FROM therapist_notes WHERE client_id = ? AND therapist_id = ? ORDER BY created_at DESC",
    [clientId, therapistId]
  );
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0],
    note: safeDecrypt(row[1]),
    session_date: row[2],
    created_at: row[3],
    updated_at: row[4]
  }));
}

/**
 * Export exercise deliveries for a client
 */
function exportExercises(clientId) {
  const db = getDatabase();
  const result = db.exec(
    `SELECT ed.id, e.title_en, e.category, e.description_en, ed.status, ed.response_encrypted, ed.sent_at, ed.completed_at
     FROM exercise_deliveries ed
     LEFT JOIN exercises e ON e.id = ed.exercise_id
     WHERE ed.client_id = ?
     ORDER BY ed.sent_at DESC`,
    [clientId]
  );
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0],
    exercise_title: row[1],
    exercise_category: row[2],
    exercise_description: row[3],
    status: row[4],
    response: safeDecrypt(row[5]),
    sent_at: row[6],
    completed_at: row[7]
  }));
}

/**
 * Export SOS events for a client
 */
function exportSOSEvents(clientId, therapistId) {
  const db = getDatabase();
  const result = db.exec(
    "SELECT id, message_encrypted, status, acknowledged_at, created_at FROM sos_events WHERE client_id = ? AND therapist_id = ? ORDER BY created_at DESC",
    [clientId, therapistId]
  );
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0],
    message: safeDecrypt(row[1]),
    status: row[2],
    acknowledged_at: row[3],
    created_at: row[4]
  }));
}

/**
 * Full client data export - aggregates all data types
 */
function exportClientFull(clientId, therapistId) {
  const profile = exportClientProfile(clientId);
  if (!profile) return null;

  return {
    export_metadata: {
      exported_at: new Date().toISOString(),
      exported_by_therapist_id: therapistId,
      client_id: clientId,
      format_version: '1.0',
      gdpr_notice: 'This export contains all stored data for the specified client, decrypted for portability.'
    },
    profile,
    context: exportClientContext(clientId, therapistId),
    diary_entries: exportDiaryEntries(clientId),
    sessions: exportSessions(clientId, therapistId),
    therapist_notes: exportTherapistNotes(clientId, therapistId),
    exercises: exportExercises(clientId),
    sos_events: exportSOSEvents(clientId, therapistId)
  };
}

/**
 * Convert an array of objects to CSV string
 */
function objectsToCSV(data, columns) {
  if (!data || data.length === 0) return '';
  const cols = columns || Object.keys(data[0]);
  const header = cols.map(c => `"${c}"`).join(',');
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Export analytics data for CSV
 */
function exportAnalyticsCSV(therapistId, days) {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Daily activity
  const dailyResult = db.exec(
    `SELECT date(d.created_at) as date,
            COUNT(DISTINCT d.id) as diary_entries,
            0 as sessions,
            0 as notes
     FROM diary_entries d
     JOIN users u ON u.id = d.client_id AND u.therapist_id = ? AND u.consent_therapist_access = 1
     WHERE d.created_at >= ?
     GROUP BY date(d.created_at)
     UNION ALL
     SELECT date(s.created_at) as date,
            0 as diary_entries,
            COUNT(DISTINCT s.id) as sessions,
            0 as notes
     FROM sessions s
     JOIN users u ON u.id = s.client_id AND u.consent_therapist_access = 1
     WHERE s.therapist_id = ? AND s.created_at >= ?
     GROUP BY date(s.created_at)
     UNION ALL
     SELECT date(n.created_at) as date,
            0 as diary_entries,
            0 as sessions,
            COUNT(DISTINCT n.id) as notes
     FROM therapist_notes n
     WHERE n.therapist_id = ? AND n.created_at >= ?
     GROUP BY date(n.created_at)`,
    [therapistId, cutoff, therapistId, cutoff, therapistId, cutoff]
  );

  // Aggregate by date
  const dateMap = {};
  if (dailyResult.length > 0) {
    dailyResult[0].values.forEach(row => {
      const date = row[0];
      if (!dateMap[date]) dateMap[date] = { date, diary_entries: 0, sessions: 0, notes: 0, total: 0 };
      dateMap[date].diary_entries += row[1];
      dateMap[date].sessions += row[2];
      dateMap[date].notes += row[3];
      dateMap[date].total += row[1] + row[2] + row[3];
    });
  }

  const dailyData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  // Client activity
  const clientResult = db.exec(
    `SELECT u.id, u.email,
            (SELECT COUNT(*) FROM diary_entries de WHERE de.client_id = u.id AND de.created_at >= ?) as diary_entries,
            (SELECT COUNT(*) FROM sessions s WHERE s.client_id = u.id AND s.therapist_id = ? AND s.created_at >= ?) as sessions,
            (SELECT COUNT(*) FROM therapist_notes tn WHERE tn.client_id = u.id AND tn.therapist_id = ? AND tn.created_at >= ?) as notes
     FROM users u
     WHERE u.therapist_id = ? AND u.role = 'client' AND u.consent_therapist_access = 1`,
    [cutoff, therapistId, cutoff, therapistId, cutoff, therapistId]
  );

  const clientData = clientResult.length > 0 ? clientResult[0].values.map(row => ({
    client_id: row[0],
    email: row[1],
    diary_entries: row[2],
    sessions: row[3],
    notes: row[4],
    total: row[2] + row[3] + row[4]
  })) : [];

  return {
    daily_activity: objectsToCSV(dailyData),
    client_activity: objectsToCSV(clientData)
  };
}

module.exports = {
  exportClientFull,
  exportClientProfile,
  exportClientContext,
  exportDiaryEntries,
  exportSessions,
  exportTherapistNotes,
  exportExercises,
  exportSOSEvents,
  exportAnalyticsCSV,
  objectsToCSV
};
