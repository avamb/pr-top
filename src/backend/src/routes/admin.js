// Admin Routes - Superadmin platform management
const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger, getSystemLogs } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const backupService = require('../services/backupService');

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

// GET /api/admin/logs/audit/actions - Get distinct audit log action types
router.get('/logs/audit/actions', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    const actions = result.length > 0 ? result[0].values.map(r => r[0]) : [];
    res.json({ actions });
  } catch (error) {
    logger.error('Admin audit actions error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch audit actions' });
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
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';

    if (action) {
      whereClause += ' AND a.action = ?';
      params.push(action);
    }

    if (dateFrom) {
      whereClause += ' AND a.created_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND a.created_at <= ?';
      params.push(dateTo + ' 23:59:59');
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

// GET /api/admin/logs/system - View system logs (from in-memory ring buffer)
router.get('/logs/system', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 50));
    const level = req.query.level || '';
    const search = (req.query.search || '').trim();
    const offset = (page - 1) * perPage;

    const { logs, total } = getSystemLogs({
      level: level || undefined,
      search: search || undefined,
      limit: perPage,
      offset
    });

    res.json({
      logs,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage)
    });
  } catch (error) {
    logger.error('Admin system logs error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

// GET /api/admin/settings - Get all platform settings
router.get('/settings', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec('SELECT key, value, updated_by, updated_at FROM platform_settings ORDER BY key');

    const settings = {};
    if (result.length > 0) {
      for (const row of result[0].values) {
        settings[row[0]] = {
          value: row[1],
          updated_by: row[2],
          updated_at: row[3]
        };
      }
    }

    res.json({ settings });
  } catch (error) {
    logger.error('Admin get settings error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch platform settings' });
  }
});

// PUT /api/admin/settings - Update platform settings
router.put('/settings', (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object required' });
    }

    const db = getDatabase();

    // Allowed setting keys and their validation
    const allowedKeys = {
      trial_duration_days: { min: 1, max: 365, type: 'integer' },
      trial_client_limit: { min: 1, max: 1000, type: 'integer' },
      trial_session_limit: { min: 1, max: 10000, type: 'integer' },
      basic_client_limit: { min: 1, max: 1000, type: 'integer' },
      basic_session_limit: { min: 1, max: 10000, type: 'integer' },
      pro_client_limit: { min: 1, max: 10000, type: 'integer' },
      pro_session_limit: { min: 1, max: 100000, type: 'integer' },
      basic_price_monthly: { min: 100, max: 100000, type: 'integer' },
      pro_price_monthly: { min: 100, max: 100000, type: 'integer' },
      premium_price_monthly: { min: 100, max: 100000, type: 'integer' }
    };

    const updated = [];
    const errors = [];

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys[key]) {
        errors.push(`Unknown setting: ${key}`);
        continue;
      }

      const rule = allowedKeys[key];
      const numVal = parseInt(value, 10);

      if (isNaN(numVal)) {
        errors.push(`${key} must be a number`);
        continue;
      }

      if (numVal < rule.min || numVal > rule.max) {
        errors.push(`${key} must be between ${rule.min} and ${rule.max}`);
        continue;
      }

      // Upsert the setting
      db.run(
        `INSERT INTO platform_settings (key, value, updated_by, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')`,
        [key, String(numVal), req.user.id, String(numVal), req.user.id]
      );
      updated.push({ key, value: numVal });
    }

    if (updated.length > 0) {
      saveDatabase();

      // Audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'update_platform_settings', 'platform_settings', NULL, ?, datetime('now'))",
        [req.user.id, JSON.stringify({ updated: updated.map(u => u.key) })]
      );
      saveDatabase();
    }

    logger.info(`Superadmin ${req.user.id} updated platform settings: ${updated.map(u => `${u.key}=${u.value}`).join(', ')}`);

    // Return all current settings
    const result = db.exec('SELECT key, value, updated_by, updated_at FROM platform_settings ORDER BY key');
    const allSettings = {};
    if (result.length > 0) {
      for (const row of result[0].values) {
        allSettings[row[0]] = {
          value: row[1],
          updated_by: row[2],
          updated_at: row[3]
        };
      }
    }

    res.json({
      message: errors.length > 0 ? 'Settings partially updated' : 'Settings updated successfully',
      updated,
      errors: errors.length > 0 ? errors : undefined,
      settings: allSettings
    });
  } catch (error) {
    logger.error('Admin update settings error: ' + error.message);
    res.status(500).json({ error: 'Failed to update platform settings' });
  }
});

// GET /api/admin/stats/subscriptions - Subscription and payment analytics
router.get('/stats/subscriptions', (req, res) => {
  try {
    const db = getDatabase();

    const getCount = (sql, params = []) => {
      const r = db.exec(sql, params);
      return r.length > 0 ? r[0].values[0][0] : 0;
    };

    const getVal = (sql, params = []) => {
      const r = db.exec(sql, params);
      return r.length > 0 && r[0].values.length > 0 ? r[0].values[0][0] : null;
    };

    // Plan distribution (all subscriptions)
    const planDistResult = db.exec(
      `SELECT plan, status, COUNT(*) as count
       FROM subscriptions
       GROUP BY plan, status
       ORDER BY plan, status`
    );
    const planDistribution = {};
    if (planDistResult.length > 0) {
      for (const row of planDistResult[0].values) {
        const plan = row[0];
        const status = row[1];
        if (!planDistribution[plan]) planDistribution[plan] = {};
        planDistribution[plan][status] = row[2];
      }
    }

    // Active subscriptions by plan
    const activeTrial = getCount("SELECT COUNT(*) FROM subscriptions WHERE plan = 'trial' AND status = 'active'");
    const activeBasic = getCount("SELECT COUNT(*) FROM subscriptions WHERE plan = 'basic' AND status = 'active'");
    const activePro = getCount("SELECT COUNT(*) FROM subscriptions WHERE plan = 'pro' AND status = 'active'");
    const activePremium = getCount("SELECT COUNT(*) FROM subscriptions WHERE plan = 'premium' AND status = 'active'");
    const totalActive = activeTrial + activeBasic + activePro + activePremium;

    // Canceled and past_due
    const canceledCount = getCount("SELECT COUNT(*) FROM subscriptions WHERE status = 'canceled'");
    const pastDueCount = getCount("SELECT COUNT(*) FROM subscriptions WHERE status = 'past_due'");
    const expiredCount = getCount("SELECT COUNT(*) FROM subscriptions WHERE status = 'expired'");

    // Revenue metrics from payments
    const totalRevenue = getVal("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'succeeded'") || 0;
    const totalPayments = getCount("SELECT COUNT(*) FROM payments WHERE status = 'succeeded'");
    const failedPayments = getCount("SELECT COUNT(*) FROM payments WHERE status = 'failed'");
    const refundedPayments = getCount("SELECT COUNT(*) FROM payments WHERE status = 'refunded'");
    const totalPaymentAttempts = totalPayments + failedPayments;
    const successRate = totalPaymentAttempts > 0 ? +((totalPayments / totalPaymentAttempts) * 100).toFixed(1) : 100;

    // Monthly Recurring Revenue (MRR) estimate based on active paid plans
    // Prices: Basic $19, Pro $49, Premium $99 (in cents)
    const mrr = (activeBasic * 1900 + activePro * 4900 + activePremium * 9900);

    // Recent payments (last 10)
    const recentPaymentsResult = db.exec(
      `SELECT p.id, p.amount, p.currency, p.status, p.created_at,
              s.plan, s.therapist_id, u.email
       FROM payments p
       JOIN subscriptions s ON s.id = p.subscription_id
       JOIN users u ON u.id = s.therapist_id
       ORDER BY p.created_at DESC
       LIMIT 10`
    );
    const recentPayments = (recentPaymentsResult.length > 0 ? recentPaymentsResult[0].values : []).map(row => ({
      id: row[0],
      amount: row[1],
      currency: row[2],
      status: row[3],
      created_at: row[4],
      plan: row[5],
      therapist_id: row[6],
      therapist_email: row[7]
    }));

    // Trials expiring soon (within 7 days)
    const trialsExpiringSoon = getCount(
      "SELECT COUNT(*) FROM subscriptions WHERE plan = 'trial' AND status = 'active' AND trial_ends_at IS NOT NULL AND trial_ends_at <= datetime('now', '+7 days')"
    );

    res.json({
      plan_distribution: {
        trial: { active: activeTrial },
        basic: { active: activeBasic },
        pro: { active: activePro },
        premium: { active: activePremium },
        detailed: planDistribution
      },
      totals: {
        active: totalActive,
        canceled: canceledCount,
        past_due: pastDueCount,
        expired: expiredCount
      },
      revenue: {
        total_revenue_cents: totalRevenue,
        total_revenue_formatted: '$' + (totalRevenue / 100).toFixed(2),
        mrr_cents: mrr,
        mrr_formatted: '$' + (mrr / 100).toFixed(2),
        total_payments: totalPayments,
        failed_payments: failedPayments,
        refunded_payments: refundedPayments,
        success_rate: successRate
      },
      recent_payments: recentPayments,
      trials_expiring_soon: trialsExpiringSoon
    });
  } catch (error) {
    logger.error('Admin subscription stats error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch subscription statistics' });
  }
});

// GET /api/admin/stats/utm - UTM attribution analytics
router.get('/stats/utm', (req, res) => {
  try {
    const db = getDatabase();

    // Registration sources (utm_source breakdown)
    const sourceResult = db.exec(
      `SELECT COALESCE(utm_source, 'direct') as source, COUNT(*) as count
       FROM users WHERE role = 'therapist'
       GROUP BY COALESCE(utm_source, 'direct')
       ORDER BY count DESC`
    );
    const sources = (sourceResult.length > 0 ? sourceResult[0].values : []).map(row => ({
      source: row[0],
      count: row[1]
    }));

    // UTM medium breakdown
    const mediumResult = db.exec(
      `SELECT COALESCE(utm_medium, 'none') as medium, COUNT(*) as count
       FROM users WHERE role = 'therapist'
       GROUP BY COALESCE(utm_medium, 'none')
       ORDER BY count DESC`
    );
    const mediums = (mediumResult.length > 0 ? mediumResult[0].values : []).map(row => ({
      medium: row[0],
      count: row[1]
    }));

    // UTM campaign breakdown
    const campaignResult = db.exec(
      `SELECT utm_campaign, COUNT(*) as count
       FROM users WHERE role = 'therapist' AND utm_campaign IS NOT NULL
       GROUP BY utm_campaign
       ORDER BY count DESC`
    );
    const campaigns = (campaignResult.length > 0 ? campaignResult[0].values : []).map(row => ({
      campaign: row[0],
      count: row[1]
    }));

    // Registration trends by source over time (last 30 days, daily)
    const trendResult = db.exec(
      `SELECT DATE(created_at) as day, COALESCE(utm_source, 'direct') as source, COUNT(*) as count
       FROM users WHERE role = 'therapist' AND created_at >= datetime('now', '-30 days')
       GROUP BY DATE(created_at), COALESCE(utm_source, 'direct')
       ORDER BY day ASC, count DESC`
    );
    const trendsMap = {};
    if (trendResult.length > 0) {
      for (const row of trendResult[0].values) {
        const day = row[0];
        if (!trendsMap[day]) trendsMap[day] = {};
        trendsMap[day][row[1]] = row[2];
      }
    }

    // Build daily trend array
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const dailyTrends = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      const dayData = trendsMap[dayStr] || {};
      dailyTrends.push({
        date: dayStr,
        ...dayData,
        total: Object.values(dayData).reduce((a, b) => a + b, 0)
      });
    }

    // Total therapist registrations
    const totalResult = db.exec("SELECT COUNT(*) FROM users WHERE role = 'therapist'");
    const totalTherapists = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;

    // Registrations with UTM data vs without
    const withUtmResult = db.exec("SELECT COUNT(*) FROM users WHERE role = 'therapist' AND utm_source IS NOT NULL");
    const withUtm = withUtmResult.length > 0 ? withUtmResult[0].values[0][0] : 0;

    res.json({
      total_therapists: totalTherapists,
      with_utm_tracking: withUtm,
      without_utm_tracking: totalTherapists - withUtm,
      sources,
      mediums,
      campaigns,
      daily_trends: dailyTrends
    });
  } catch (error) {
    logger.error('Admin UTM stats error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch UTM statistics' });
  }
});

// POST /api/admin/backup - Trigger manual database backup
router.post('/backup', (req, res) => {
  try {
    logger.info(`[BACKUP] Manual backup triggered by admin ${req.user.id}`);
    const result = backupService.backup();

    if (result.success) {
      // Audit log
      const db = getDatabase();
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'manual_backup', 'system', 0, ?, datetime('now'))",
        [req.user.id, JSON.stringify({ filename: result.filename, size: result.size })]
      );
      saveDatabase();

      res.json({
        message: 'Backup created successfully',
        filename: result.filename,
        size: result.size,
        raw_size: result.raw_size
      });
    } else {
      res.status(500).json({ error: 'Backup failed: ' + result.error });
    }
  } catch (error) {
    logger.error('Admin backup error: ' + error.message);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// GET /api/admin/backups - List available backups
router.get('/backups', (req, res) => {
  try {
    const result = backupService.listBackups();
    res.json(result);
  } catch (error) {
    logger.error('Admin list backups error: ' + error.message);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// GET /api/admin/backup/status - Get backup status summary
router.get('/backup/status', (req, res) => {
  try {
    const status = backupService.getBackupStatus();
    res.json(status);
  } catch (error) {
    logger.error('Admin backup status error: ' + error.message);
    res.status(500).json({ error: 'Failed to get backup status' });
  }
});

// POST /api/admin/restore - Restore from a specific backup
router.post('/restore', (req, res) => {
  try {
    const { filename, confirm } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    if (!confirm) {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Set confirm=true to proceed. WARNING: This will replace the current database with the backup. A safety snapshot will be created first.'
      });
    }

    logger.info(`[BACKUP] Database restore triggered by admin ${req.user.id} from: ${filename}`);

    // Audit log BEFORE restore (in current DB)
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'database_restore', 'system', 0, ?, datetime('now'))",
      [req.user.id, JSON.stringify({ filename, initiated_by: req.user.email })]
    );
    saveDatabase();

    const result = backupService.restore(filename);

    if (result.success) {
      res.json({
        message: 'Database restored successfully. Server restart recommended.',
        filename: result.filename,
        size: result.size,
        restart_required: true
      });
    } else {
      res.status(500).json({ error: 'Restore failed: ' + result.error });
    }
  } catch (error) {
    logger.error('Admin restore error: ' + error.message);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

module.exports = router;
