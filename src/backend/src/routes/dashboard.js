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

// GET /api/dashboard/notifications - Get unacknowledged SOS alerts and other notifications
router.get('/notifications', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;

    // Get triggered (unacknowledged) SOS events
    const sosResult = db.exec(
      `SELECT se.id, se.client_id, se.status, se.created_at,
              u.email, u.telegram_id
       FROM sos_events se
       JOIN users u ON u.id = se.client_id
       WHERE se.therapist_id = ? AND se.status = 'triggered'
       ORDER BY se.created_at DESC`,
      [therapistId]
    );

    const notifications = [];

    if (sosResult.length > 0 && sosResult[0].values.length > 0) {
      for (const row of sosResult[0].values) {
        notifications.push({
          type: 'sos_alert',
          id: row[0],
          client_id: row[1],
          client_identifier: row[4] || ('Telegram: ' + row[5]),
          status: row[2],
          created_at: row[3],
          urgent: true
        });
      }
    }

    res.json({
      notifications,
      total: notifications.length,
      has_urgent: notifications.some(n => n.urgent)
    });
  } catch (error) {
    logger.error('Dashboard notifications error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/dashboard/analytics - Get client activity analytics data for charts
router.get('/analytics', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get diary entries per day
    const diaryResult = db.exec(
      `SELECT DATE(de.created_at) as day, COUNT(*) as count
       FROM diary_entries de
       JOIN users u ON u.id = de.client_id
       WHERE u.therapist_id = ? AND de.created_at >= ?
       GROUP BY DATE(de.created_at)
       ORDER BY day ASC`,
      [therapistId, startDateStr]
    );
    const diaryByDay = {};
    if (diaryResult.length > 0) {
      for (const row of diaryResult[0].values) {
        diaryByDay[row[0]] = row[1];
      }
    }

    // Get sessions per day
    const sessionsResult = db.exec(
      `SELECT DATE(s.created_at) as day, COUNT(*) as count
       FROM sessions s
       WHERE s.therapist_id = ? AND s.created_at >= ?
       GROUP BY DATE(s.created_at)
       ORDER BY day ASC`,
      [therapistId, startDateStr]
    );
    const sessionsByDay = {};
    if (sessionsResult.length > 0) {
      for (const row of sessionsResult[0].values) {
        sessionsByDay[row[0]] = row[1];
      }
    }

    // Get notes per day
    const notesResult = db.exec(
      `SELECT DATE(tn.created_at) as day, COUNT(*) as count
       FROM therapist_notes tn
       WHERE tn.therapist_id = ? AND tn.created_at >= ?
       GROUP BY DATE(tn.created_at)
       ORDER BY day ASC`,
      [therapistId, startDateStr]
    );
    const notesByDay = {};
    if (notesResult.length > 0) {
      for (const row of notesResult[0].values) {
        notesByDay[row[0]] = row[1];
      }
    }

    // Build daily timeline
    const dailyActivity = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      dailyActivity.push({
        date: dayStr,
        diary_entries: diaryByDay[dayStr] || 0,
        sessions: sessionsByDay[dayStr] || 0,
        notes: notesByDay[dayStr] || 0,
        total: (diaryByDay[dayStr] || 0) + (sessionsByDay[dayStr] || 0) + (notesByDay[dayStr] || 0)
      });
    }

    // Get per-client activity summary
    const clientActivityResult = db.exec(
      `SELECT u.id, u.email, u.telegram_id,
              (SELECT COUNT(*) FROM diary_entries WHERE client_id = u.id) as diary_count,
              (SELECT COUNT(*) FROM sessions WHERE client_id = u.id AND therapist_id = ?) as session_count,
              (SELECT COUNT(*) FROM therapist_notes WHERE client_id = u.id AND therapist_id = ?) as note_count,
              (SELECT MAX(created_at) FROM (
                SELECT created_at FROM diary_entries WHERE client_id = u.id
                UNION ALL
                SELECT created_at FROM sessions WHERE client_id = u.id
                UNION ALL
                SELECT created_at FROM therapist_notes WHERE client_id = u.id
              )) as last_activity
       FROM users u
       WHERE u.therapist_id = ? AND u.role = 'client'
       ORDER BY last_activity DESC NULLS LAST`,
      [therapistId, therapistId, therapistId]
    );

    const clientActivity = (clientActivityResult.length > 0 ? clientActivityResult[0].values : []).map(row => ({
      id: row[0],
      name: row[1] || row[2] || `Client #${row[0]}`,
      diary_entries: row[3],
      sessions: row[4],
      notes: row[5],
      total: row[3] + row[4] + row[5],
      last_activity: row[6]
    }));

    // Summary totals
    const totalDiary = Object.values(diaryByDay).reduce((a, b) => a + b, 0);
    const totalSessions = Object.values(sessionsByDay).reduce((a, b) => a + b, 0);
    const totalNotes = Object.values(notesByDay).reduce((a, b) => a + b, 0);

    // Session frequency metrics
    const weeks = Math.max(days / 7, 1);
    const sessionsPerWeek = +(totalSessions / weeks).toFixed(1);

    // Weekly session breakdown
    const weeklySessionData = [];
    for (let i = 0; i < Math.ceil(days / 7); i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > endDate) weekEnd.setTime(endDate.getTime());

      let weekSessions = 0;
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toISOString().split('T')[0];
        weekSessions += sessionsByDay[dayStr] || 0;
      }

      const weekLabel = `${weekStart.toISOString().split('T')[0]}`;
      weeklySessionData.push({
        week_start: weekLabel,
        week_end: weekEnd.toISOString().split('T')[0],
        sessions: weekSessions
      });
    }

    // Per-client session frequency
    const clientSessionFrequency = (clientActivityResult.length > 0 ? clientActivityResult[0].values : [])
      .filter(row => row[4] > 0) // only clients with sessions
      .map(row => ({
        id: row[0],
        name: row[1] || row[2] || `Client #${row[0]}`,
        sessions: row[4],
        sessions_per_week: +(row[4] / weeks).toFixed(1)
      }))
      .sort((a, b) => b.sessions - a.sessions);

    // Days with sessions vs total days
    const daysWithSessions = Object.keys(sessionsByDay).length;

    const sessionFrequency = {
      total_sessions: totalSessions,
      sessions_per_week: sessionsPerWeek,
      days_with_sessions: daysWithSessions,
      total_days: days,
      weekly_breakdown: weeklySessionData,
      per_client: clientSessionFrequency
    };

    res.json({
      period: { days, start_date: startDateStr, end_date: endDate.toISOString().split('T')[0] },
      daily_activity: dailyActivity,
      client_activity: clientActivity,
      session_frequency: sessionFrequency,
      totals: {
        diary_entries: totalDiary,
        sessions: totalSessions,
        notes: totalNotes,
        total: totalDiary + totalSessions + totalNotes
      }
    });
  } catch (error) {
    logger.error('Dashboard analytics error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

module.exports = router;
