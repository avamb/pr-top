// Admin Routes - Superadmin platform management
const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require superadmin role
router.use(authenticate);
router.use(requireRole('superadmin'));

// GET /api/admin/therapists - List all therapists
router.get('/therapists', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(`
      SELECT id, email, telegram_id, role, invite_code, language,
             created_at, updated_at, blocked_at
      FROM users WHERE role = 'therapist'
      ORDER BY created_at DESC
    `);

    const therapists = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      email: row[1],
      telegram_id: row[2],
      role: row[3],
      invite_code: row[4],
      language: row[5],
      created_at: row[6],
      updated_at: row[7],
      blocked_at: row[8],
      is_blocked: !!row[8]
    }));

    res.json({ therapists });
  } catch (error) {
    logger.error('Admin list therapists error: ' + error.message);
    res.status(500).json({ error: 'Failed to list therapists' });
  }
});

// PUT /api/admin/therapists/:id/block - Block a therapist
router.put('/therapists/:id/block', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Verify the user exists and is a therapist
    const userResult = db.exec('SELECT id, email, role, blocked_at FROM users WHERE id = ?', [id]);
    if (userResult.length === 0 || userResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Therapist not found' });
    }

    const user = userResult[0].values[0];
    if (user[2] !== 'therapist') {
      return res.status(400).json({ error: 'User is not a therapist' });
    }

    if (user[3]) {
      return res.status(400).json({ error: 'Therapist is already blocked' });
    }

    // Block the therapist
    db.run(
      "UPDATE users SET blocked_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      [id]
    );
    saveDatabase();

    logger.info(`Superadmin ${req.user.id} blocked therapist ${id}`);

    res.json({
      message: 'Therapist blocked successfully',
      therapist_id: parseInt(id),
      blocked_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Admin block therapist error: ' + error.message);
    res.status(500).json({ error: 'Failed to block therapist' });
  }
});

// PUT /api/admin/therapists/:id/unblock - Unblock a therapist
router.put('/therapists/:id/unblock', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Verify the user exists and is a therapist
    const userResult = db.exec('SELECT id, email, role, blocked_at FROM users WHERE id = ?', [id]);
    if (userResult.length === 0 || userResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Therapist not found' });
    }

    const user = userResult[0].values[0];
    if (user[2] !== 'therapist') {
      return res.status(400).json({ error: 'User is not a therapist' });
    }

    if (!user[3]) {
      return res.status(400).json({ error: 'Therapist is not blocked' });
    }

    // Unblock the therapist
    db.run(
      "UPDATE users SET blocked_at = NULL, updated_at = datetime('now') WHERE id = ?",
      [id]
    );
    saveDatabase();

    logger.info(`Superadmin ${req.user.id} unblocked therapist ${id}`);

    res.json({
      message: 'Therapist unblocked successfully',
      therapist_id: parseInt(id)
    });
  } catch (error) {
    logger.error('Admin unblock therapist error: ' + error.message);
    res.status(500).json({ error: 'Failed to unblock therapist' });
  }
});

// GET /api/admin/stats/users - Platform user statistics
router.get('/stats/users', (req, res) => {
  try {
    const db = getDatabase();

    const getCount = (sql) => {
      const r = db.exec(sql);
      return r.length > 0 ? r[0].values[0][0] : 0;
    };

    // User counts
    const therapists = getCount("SELECT COUNT(*) FROM users WHERE role = 'therapist'");
    const clients = getCount("SELECT COUNT(*) FROM users WHERE role = 'client'");
    const blockedTherapists = getCount("SELECT COUNT(*) FROM users WHERE role = 'therapist' AND blocked_at IS NOT NULL");

    // Content counts
    const sessions = getCount("SELECT COUNT(*) FROM sessions");
    const diaryEntries = getCount("SELECT COUNT(*) FROM diary_entries");
    const therapistNotes = getCount("SELECT COUNT(*) FROM therapist_notes");
    const sosEvents = getCount("SELECT COUNT(*) FROM sos_events");

    // Subscription breakdown
    const activeSubscriptions = getCount("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'");
    const trialSubs = getCount("SELECT COUNT(*) FROM subscriptions WHERE plan = 'trial' AND status = 'active'");
    const basicSubs = getCount("SELECT COUNT(*) FROM subscriptions WHERE plan = 'basic' AND status = 'active'");
    const proSubs = getCount("SELECT COUNT(*) FROM subscriptions WHERE plan = 'pro' AND status = 'active'");
    const premiumSubs = getCount("SELECT COUNT(*) FROM subscriptions WHERE plan = 'premium' AND status = 'active'");

    // Audit log count
    const auditLogEntries = getCount("SELECT COUNT(*) FROM audit_logs");

    res.json({
      therapists,
      clients,
      blocked_therapists: blockedTherapists,
      sessions,
      diary_entries: diaryEntries,
      therapist_notes: therapistNotes,
      sos_events: sosEvents,
      subscriptions: activeSubscriptions,
      subscription_breakdown: {
        trial: trialSubs,
        basic: basicSubs,
        pro: proSubs,
        premium: premiumSubs
      },
      audit_log_entries: auditLogEntries
    });
  } catch (error) {
    logger.error('Admin stats/users error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// GET /api/admin/logs/audit - View audit logs
router.get('/logs/audit', (req, res) => {
  try {
    const db = getDatabase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 50));
    const action = req.query.action || '';
    const offset = (page - 1) * perPage;

    let whereClause = '1=1';
    const params = [];

    if (action) {
      whereClause += ' AND a.action = ?';
      params.push(action);
    }

    // Get total count
    const countResult = db.exec(`SELECT COUNT(*) FROM audit_logs a WHERE ${whereClause}`, params);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // Get paginated results
    const result = db.exec(
      `SELECT a.id, a.actor_id, a.action, a.target_type, a.target_id, a.details_encrypted, a.ip_address, a.created_at
       FROM audit_logs a
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    const logs = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      actor_id: row[1],
      action: row[2],
      target_type: row[3],
      target_id: row[4],
      details: row[5],
      ip_address: row[6],
      created_at: row[7]
    }));

    res.json({
      logs,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    logger.error('Admin audit logs error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
