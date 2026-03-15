// Export Routes - GDPR-compatible data export endpoints
// Supports JSON and CSV formats for client data, and CSV for analytics.

const express = require('express');
const archiver = require('archiver');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const { verifyClientConsent } = require('../utils/consentCheck');
const {
  exportClientFull,
  exportDiaryEntries,
  exportSessions,
  exportTherapistNotes,
  exportExercises,
  exportSOSEvents,
  exportClientProfile,
  exportClientContext,
  exportAnalyticsCSV,
  objectsToCSV
} = require('../services/exportService');
const { generateAnalyticsPDF } = require('../services/pdfGenerator');

const router = express.Router();

// All export routes require authenticated therapist or superadmin
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

/**
 * Tier gating middleware for full export
 * trial/basic: JSON diary only
 * pro/premium: full export (all data types, JSON + CSV)
 */
function getExportTier(req) {
  const db = getDatabase();
  const userId = req.user.id;

  if (req.user.role === 'superadmin') return 'premium';

  const subResult = db.exec(
    'SELECT plan, status FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (subResult.length === 0 || subResult[0].values.length === 0) return 'trial';
  const [plan, status] = subResult[0].values[0];
  if (status !== 'active') return 'trial';
  return plan;
}

function isFullExportAllowed(plan) {
  return ['pro', 'premium'].includes(plan);
}

// GET /api/export/client/:id?format=json|csv
// Full client data export with consent check and tier gating
router.get('/client/:id', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const format = (req.query.format || 'json').toLowerCase();

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use json or csv.' });
    }

    // Consent check
    const consent = verifyClientConsent(therapistId, clientId, 'export_client');
    if (!consent.allowed) {
      return res.status(consent.status || 403).json({ error: consent.error });
    }

    // Tier check
    const plan = getExportTier(req);
    const fullAccess = isFullExportAllowed(plan);

    if (!fullAccess && format === 'csv') {
      return res.status(403).json({
        error: 'Plan upgrade required',
        message: 'CSV export is available on Pro and Premium plans.',
        current_plan: plan,
        required_plans: ['pro', 'premium']
      });
    }

    // For trial/basic: only diary JSON export
    if (!fullAccess) {
      const diaryEntries = exportDiaryEntries(clientId);
      const profile = exportClientProfile(clientId);

      // Audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'export_client_basic', 'client', clientId, JSON.stringify({ format: 'json', plan, data_types: ['diary'] })]
      );
      saveDatabase();

      const filename = `client_${clientId}_diary_export.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json({
        export_metadata: {
          exported_at: new Date().toISOString(),
          exported_by_therapist_id: therapistId,
          client_id: clientId,
          format_version: '1.0',
          plan,
          note: 'Upgrade to Pro or Premium for full data export including sessions, notes, exercises, and CSV format.'
        },
        profile,
        diary_entries: diaryEntries
      });
    }

    // Full export for Pro/Premium
    if (format === 'json') {
      const data = exportClientFull(clientId, therapistId);
      if (!data) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'export_client_full', 'client', clientId, JSON.stringify({ format: 'json', plan, data_types: ['profile', 'context', 'diary', 'sessions', 'notes', 'exercises', 'sos'] })]
      );
      saveDatabase();

      const filename = `client_${clientId}_full_export.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(data);
    }

    // CSV format - ZIP with separate CSV files
    if (format === 'csv') {
      const data = exportClientFull(clientId, therapistId);
      if (!data) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [therapistId, 'export_client_full', 'client', clientId, JSON.stringify({ format: 'csv', plan, data_types: ['profile', 'context', 'diary', 'sessions', 'notes', 'exercises', 'sos'] })]
      );
      saveDatabase();

      const filename = `client_${clientId}_export.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        logger.error('Archive error: ' + err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Export failed' });
        }
      });
      archive.pipe(res);

      // Profile CSV
      if (data.profile) {
        archive.append(objectsToCSV([data.profile]), { name: 'profile.csv' });
      }

      // Context CSV
      if (data.context) {
        archive.append(objectsToCSV([data.context]), { name: 'context.csv' });
      }

      // Diary entries CSV
      if (data.diary_entries.length > 0) {
        archive.append(objectsToCSV(data.diary_entries), { name: 'diary_entries.csv' });
      }

      // Sessions CSV
      if (data.sessions.length > 0) {
        archive.append(objectsToCSV(data.sessions), { name: 'sessions.csv' });
      }

      // Therapist notes CSV
      if (data.therapist_notes.length > 0) {
        archive.append(objectsToCSV(data.therapist_notes), { name: 'therapist_notes.csv' });
      }

      // Exercises CSV
      if (data.exercises.length > 0) {
        archive.append(objectsToCSV(data.exercises), { name: 'exercises.csv' });
      }

      // SOS events CSV
      if (data.sos_events.length > 0) {
        archive.append(objectsToCSV(data.sos_events), { name: 'sos_events.csv' });
      }

      // Metadata
      archive.append(JSON.stringify(data.export_metadata, null, 2), { name: 'export_metadata.json' });

      return archive.finalize();
    }
  } catch (error) {
    logger.error('Export client error: ' + error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed' });
    }
  }
});

// GET /api/export/client/:id/notes
// Export therapist notes for a client
router.get('/client/:id/notes', (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = parseInt(req.params.id, 10);
    const db = getDatabase();

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Consent check
    const consent = verifyClientConsent(therapistId, clientId, 'export_notes');
    if (!consent.allowed) {
      return res.status(consent.status || 403).json({ error: consent.error });
    }

    // Tier check
    const plan = getExportTier(req);
    if (!isFullExportAllowed(plan)) {
      return res.status(403).json({
        error: 'Plan upgrade required',
        message: 'Notes export is available on Pro and Premium plans.',
        current_plan: plan,
        required_plans: ['pro', 'premium']
      });
    }

    const notes = exportTherapistNotes(clientId, therapistId);

    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'export_notes', 'client', clientId, JSON.stringify({ count: notes.length })]
    );
    saveDatabase();

    const filename = `client_${clientId}_notes_export.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({ notes, count: notes.length, exported_at: new Date().toISOString() });
  } catch (error) {
    logger.error('Export notes error: ' + error.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/analytics?days=30&format=csv|pdf
// Export analytics data as CSV ZIP or PDF report
router.get('/analytics', (req, res) => {
  try {
    const therapistId = req.user.id;
    const days = parseInt(req.query.days || '30', 10);
    const format = (req.query.format || 'csv').toLowerCase();
    const db = getDatabase();

    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Invalid days parameter (1-365)' });
    }

    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use csv or pdf.' });
    }

    // Tier check for analytics export - Premium only
    const plan = getExportTier(req);
    if (plan !== 'premium') {
      return res.status(403).json({
        error: 'Plan upgrade required',
        message: 'Analytics export is available on the Premium plan.',
        current_plan: plan,
        required_plans: ['premium']
      });
    }

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [therapistId, 'export_analytics', 'analytics', 0, JSON.stringify({ days, format })]
    );
    saveDatabase();

    // PDF format
    if (format === 'pdf') {
      const therapistEmail = req.user.email || 'therapist';
      const doc = generateAnalyticsPDF(therapistId, days, therapistEmail);

      const filename = `analytics_${days}d_report.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      doc.pipe(res);
      doc.end();
      return;
    }

    // CSV format - ZIP with separate CSV files
    const csvData = exportAnalyticsCSV(therapistId, days);

    const filename = `analytics_${days}d_export.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      logger.error('Archive error: ' + err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Export failed' });
      }
    });
    archive.pipe(res);

    if (csvData.daily_activity) {
      archive.append(csvData.daily_activity, { name: 'daily_activity.csv' });
    }
    if (csvData.client_activity) {
      archive.append(csvData.client_activity, { name: 'client_activity.csv' });
    }
    archive.append(JSON.stringify({ exported_at: new Date().toISOString(), days, therapist_id: therapistId }, null, 2), { name: 'export_metadata.json' });

    archive.finalize();
  } catch (error) {
    logger.error('Export analytics error: ' + error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed' });
    }
  }
});

module.exports = router;
