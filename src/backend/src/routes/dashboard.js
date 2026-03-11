// Dashboard Routes - Therapist dashboard stats and recent activity
const express = require('express');
const { getDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All dashboard routes require authenticated therapist or superadmin
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

// GET /api/dashboard/stats - Get dashboard quick stats
router.get('/stats', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;

    // Count linked clients (clients with therapist_id = current therapist and consent given)
    const clientResult = db.exec(
      'SELECT COUNT(*) FROM users WHERE therapist_id = ? AND role = ?',
      [therapistId, 'client']
    );
    const clientCount = clientResult.length > 0 ? clientResult[0].values[0][0] : 0;

    // Count sessions for this therapist
    const sessionResult = db.exec(
      'SELECT COUNT(*) FROM sessions WHERE therapist_id = ?',
      [therapistId]
    );
    const sessionCount = sessionResult.length > 0 ? sessionResult[0].values[0][0] : 0;

    // Count therapist notes
    const noteResult = db.exec(
      'SELECT COUNT(*) FROM therapist_notes WHERE therapist_id = ?',
      [therapistId]
    );
    const noteCount = noteResult.length > 0 ? noteResult[0].values[0][0] : 0;

    // Count unresolved SOS events for this therapist
    const sosResult = db.exec(
      "SELECT COUNT(*) FROM sos_events WHERE therapist_id = ? AND status != 'resolved'",
      [therapistId]
    );
    const activeSosCount = sosResult.length > 0 ? sosResult[0].values[0][0] : 0;

    // Get subscription info
    const subResult = db.exec(
      'SELECT plan, status, trial_ends_at, current_period_end FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1',
      [therapistId]
    );
    let subscription = null;
    if (subResult.length > 0 && subResult[0].values.length > 0) {
      const row = subResult[0].values[0];
      subscription = {
        plan: row[0],
        status: row[1],
        trial_ends_at: row[2],
        current_period_end: row[3]
      };
    }

    res.json({
      clients: clientCount,
      sessions: sessionCount,
      notes: noteCount,
      active_sos: activeSosCount,
      subscription
    });
  } catch (error) {
    logger.error('Dashboard stats error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/dashboard/activity - Get recent activity feed
router.get('/activity', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const activities = [];

    // Get recent diary entries from linked clients
    const diaryResult = db.exec(
      `SELECT de.id, de.entry_type, de.created_at, u.email, u.telegram_id, u.id as client_id
       FROM diary_entries de
       JOIN users u ON u.id = de.client_id
       WHERE u.therapist_id = ?
       ORDER BY de.created_at DESC
       LIMIT ?`,
      [therapistId, limit]
    );
    if (diaryResult.length > 0) {
      for (const row of diaryResult[0].values) {
        activities.push({
          type: 'diary_entry',
          id: row[0],
          entry_type: row[1],
          created_at: row[2],
          client_email: row[3],
          client_telegram_id: row[4],
          client_id: row[5]
        });
      }
    }

    // Get recent sessions
    const sessionResult = db.exec(
      `SELECT s.id, s.status, s.created_at, u.email, u.telegram_id, u.id as client_id
       FROM sessions s
       JOIN users u ON u.id = s.client_id
       WHERE s.therapist_id = ?
       ORDER BY s.created_at DESC
       LIMIT ?`,
      [therapistId, limit]
    );
    if (sessionResult.length > 0) {
      for (const row of sessionResult[0].values) {
        activities.push({
          type: 'session',
          id: row[0],
          status: row[1],
          created_at: row[2],
          client_email: row[3],
          client_telegram_id: row[4],
          client_id: row[5]
        });
      }
    }

    // Get recent SOS events
    const sosResult = db.exec(
      `SELECT se.id, se.status, se.created_at, u.email, u.telegram_id, u.id as client_id
       FROM sos_events se
       JOIN users u ON u.id = se.client_id
       WHERE se.therapist_id = ?
       ORDER BY se.created_at DESC
       LIMIT ?`,
      [therapistId, limit]
    );
    if (sosResult.length > 0) {
      for (const row of sosResult[0].values) {
        activities.push({
          type: 'sos_event',
          id: row[0],
          status: row[1],
          created_at: row[2],
          client_email: row[3],
          client_telegram_id: row[4],
          client_id: row[5]
        });
      }
    }

    // Get recent notes by this therapist
    const noteResult = db.exec(
      `SELECT tn.id, tn.created_at, u.email, u.telegram_id, u.id as client_id
       FROM therapist_notes tn
       JOIN users u ON u.id = tn.client_id
       WHERE tn.therapist_id = ?
       ORDER BY tn.created_at DESC
       LIMIT ?`,
      [therapistId, limit]
    );
    if (noteResult.length > 0) {
      for (const row of noteResult[0].values) {
        activities.push({
          type: 'note',
          id: row[0],
          created_at: row[1],
          client_email: row[2],
          client_telegram_id: row[3],
          client_id: row[4]
        });
      }
    }

    // Sort all activities by created_at descending and limit
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const limitedActivities = activities.slice(0, limit);

    res.json({ activities: limitedActivities });
  } catch (error) {
    logger.error('Dashboard activity error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard activity' });
  }
});

module.exports = router;
