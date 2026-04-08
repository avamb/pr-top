// Admin Routes - Superadmin platform management
const express = require('express');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger, getSystemLogs } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const backupService = require('../services/backupService');
const aiProviders = require('../services/aiProviders');
const assistantKnowledge = require('../services/assistantKnowledge');
const assistantCache = require('../services/assistantCache');

const router = express.Router();

// All admin routes require superadmin role
router.use(authenticate);
router.use(requireRole('superadmin'));

// GET /api/admin/therapists - List all therapists
router.get('/therapists', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(`
      SELECT u.id, u.email, u.telegram_id, u.role, u.invite_code, u.language,
             u.created_at, u.updated_at, u.blocked_at,
             s.plan, s.is_manual_override, s.override_reason, s.override_expires_at,
             u.first_name, u.last_name, u.telegram_username, u.phone, u.other_info
      FROM users u
      LEFT JOIN subscriptions s ON s.therapist_id = u.id
      WHERE u.role = 'therapist'
      ORDER BY u.created_at DESC
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
      is_blocked: !!row[8],
      plan: row[9] || 'trial',
      is_manual_override: !!row[10],
      override_reason: row[11],
      override_expires_at: row[12],
      first_name: row[13] || '',
      last_name: row[14] || '',
      telegram_username: row[15] || '',
      phone: row[16] || '',
      other_info: row[17] || ''
    }));

    res.json({ therapists });
  } catch (error) {
    logger.error('Admin list therapists error: ' + error.message);
    res.status(500).json({ error: 'Failed to list therapists' });
  }
});

// PUT /api/admin/therapists/:id/plan - Manually assign a plan to a therapist
router.put('/therapists/:id/plan', (req, res) => {
  try {
    const { id } = req.params;
    const { plan, reason, expires_at } = req.body;
    const db = getDatabase();

    const validPlans = ['trial', 'basic', 'pro', 'premium'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be one of: ' + validPlans.join(', ') });
    }

    // Verify the user exists and is a therapist
    const userResult = db.exec('SELECT id, role FROM users WHERE id = ?', [id]);
    if (userResult.length === 0 || userResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Therapist not found' });
    }
    if (userResult[0].values[0][1] !== 'therapist') {
      return res.status(400).json({ error: 'User is not a therapist' });
    }

    // Check if subscription exists
    const subResult = db.exec('SELECT id, plan FROM subscriptions WHERE therapist_id = ?', [id]);

    let previousPlan = 'trial';

    if (subResult.length > 0 && subResult[0].values.length > 0) {
      // Update existing subscription
      previousPlan = subResult[0].values[0][1];
      db.run(
        `UPDATE subscriptions SET plan = ?, is_manual_override = 1, override_reason = ?, override_expires_at = ?, override_set_by = ?, stripe_subscription_id = NULL, status = 'active', updated_at = datetime('now') WHERE therapist_id = ?`,
        [plan, reason || null, expires_at || null, req.user.id, id]
      );
    } else {
      // Create new subscription with manual override
      previousPlan = null;
      db.run(
        `INSERT INTO subscriptions (therapist_id, plan, status, is_manual_override, override_reason, override_expires_at, override_set_by, created_at, updated_at) VALUES (?, ?, 'active', 1, ?, ?, ?, datetime('now'), datetime('now'))`,
        [id, plan, reason || null, expires_at || null, req.user.id]
      );
    }

    // Write audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'manual_plan_override', 'user', ?, ?, datetime('now'))",
      [req.user.id, parseInt(id), JSON.stringify({ plan, reason: reason || null, expires_at: expires_at || null, previous_plan: previousPlan })]
    );
    saveDatabaseAfterWrite();

    logger.info(`Superadmin ${req.user.id} set manual plan override for therapist ${id}: ${plan} (reason: ${reason || 'none'})`);

    res.json({
      message: 'Plan override set successfully',
      therapist_id: parseInt(id),
      plan,
      is_manual_override: true,
      override_reason: reason || null,
      override_expires_at: expires_at || null,
      previous_plan: previousPlan
    });
  } catch (error) {
    logger.error('Admin set plan override error: ' + error.message);
    res.status(500).json({ error: 'Failed to set plan override' });
  }
});

// DELETE /api/admin/therapists/:id/plan-override - Remove manual override, revert to trial
router.delete('/therapists/:id/plan-override', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Verify the user exists and is a therapist
    const userResult = db.exec('SELECT id, role FROM users WHERE id = ?', [id]);
    if (userResult.length === 0 || userResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Therapist not found' });
    }
    if (userResult[0].values[0][1] !== 'therapist') {
      return res.status(400).json({ error: 'User is not a therapist' });
    }

    // Check subscription
    const subResult = db.exec('SELECT id, plan, is_manual_override FROM subscriptions WHERE therapist_id = ?', [id]);
    if (subResult.length === 0 || subResult[0].values.length === 0) {
      return res.status(404).json({ error: 'No subscription found for this therapist' });
    }

    const previousPlan = subResult[0].values[0][1];

    // Reset to trial
    db.run(
      `UPDATE subscriptions SET plan = 'trial', is_manual_override = 0, override_reason = NULL, override_expires_at = NULL, override_set_by = NULL, status = 'active', updated_at = datetime('now') WHERE therapist_id = ?`,
      [id]
    );

    // Write audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'remove_plan_override', 'user', ?, ?, datetime('now'))",
      [req.user.id, parseInt(id), JSON.stringify({ previous_plan: previousPlan })]
    );
    saveDatabaseAfterWrite();

    logger.info(`Superadmin ${req.user.id} removed plan override for therapist ${id}. Reverted from ${previousPlan} to trial.`);

    res.json({
      message: 'Plan override removed. Therapist reverted to trial plan.',
      therapist_id: parseInt(id),
      plan: 'trial',
      is_manual_override: false,
      previous_plan: previousPlan
    });
  } catch (error) {
    logger.error('Admin remove plan override error: ' + error.message);
    res.status(500).json({ error: 'Failed to remove plan override' });
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
    saveDatabaseAfterWrite();

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
    saveDatabaseAfterWrite();

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
      premium_price_monthly: { min: 100, max: 100000, type: 'integer' },
      assistant_prompt_viewer_anonymous: { type: 'text', maxLength: 10000 },
      assistant_prompt_viewer_registered: { type: 'text', maxLength: 10000 }
    };

    const updated = [];
    const errors = [];

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys[key]) {
        errors.push(`Unknown setting: ${key}`);
        continue;
      }

      const rule = allowedKeys[key];

      if (rule.type === 'text') {
        // Text validation
        const strVal = String(value || '');
        if (rule.maxLength && strVal.length > rule.maxLength) {
          errors.push(`${key} must be at most ${rule.maxLength} characters`);
          continue;
        }
        db.run(
          `INSERT INTO platform_settings (key, value, updated_by, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')`,
          [key, strVal, req.user.id, strVal, req.user.id]
        );
        updated.push({ key, value: strVal });
      } else {
        // Integer validation (default)
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
    }

    if (updated.length > 0) {
      saveDatabaseAfterWrite();

      // Audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'update_platform_settings', 'platform_settings', NULL, ?, datetime('now'))",
        [req.user.id, JSON.stringify({ updated: updated.map(u => u.key) })]
      );
      saveDatabaseAfterWrite();
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
      saveDatabaseAfterWrite();

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
    saveDatabaseAfterWrite();

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

// ==================== AI Usage & Cost Dashboard ====================

const aiUsageLogger = require('../services/aiUsageLogger');

// GET /api/admin/ai/usage - Aggregated usage with optional grouping/filtering
router.get('/ai/usage', (req, res) => {
  try {
    var dateFrom = req.query.date_from || null;
    var dateTo = req.query.date_to || null;
    var groupBy = req.query.group_by || null; // day, model, therapist, operation
    var period = req.query.period || null; // day, week, month
    var therapistId = req.query.therapist_id ? parseInt(req.query.therapist_id) : null;

    var filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (groupBy) filters.groupBy = groupBy;
    if (period) filters.period = period;
    if (therapistId) filters.therapistId = therapistId;

    var data = aiUsageLogger.getUsageStats(filters);
    res.json({ usage: data });
  } catch (error) {
    logger.error('Admin AI usage error: ' + error.message);
    res.status(500).json({ error: 'Failed to get AI usage data' });
  }
});

// GET /api/admin/ai/usage/summary - Summary for current month
router.get('/ai/usage/summary', (req, res) => {
  try {
    var dateFrom = req.query.date_from || null;
    var dateTo = req.query.date_to || null;

    // Default to current month
    if (!dateFrom) {
      var now = new Date();
      dateFrom = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
    }

    var total = aiUsageLogger.getTotalUsage(dateFrom, dateTo);
    var byModel = aiUsageLogger.getUsageStats({ groupBy: 'model', dateFrom: dateFrom, dateTo: dateTo });
    var byTherapist = aiUsageLogger.getUsageStats({ groupBy: 'therapist', dateFrom: dateFrom, dateTo: dateTo });

    // Get therapist emails for display
    var db = getDatabase();
    byTherapist.forEach(function(item) {
      if (item.therapist_id) {
        var userResult = db.exec('SELECT email FROM users WHERE id = ?', [item.therapist_id]);
        if (userResult.length > 0 && userResult[0].values.length > 0) {
          item.email = userResult[0].values[0][0];
        }
      }
    });

    // Find most used model
    var mostUsedModel = byModel.length > 0 ? byModel.reduce(function(a, b) { return a.call_count > b.call_count ? a : b; }).model : null;

    // Include spending limit status
    var limitStatus = aiUsageLogger.getSpendingLimitStatus();

    res.json({
      total: total,
      by_model: byModel,
      by_therapist: byTherapist,
      most_used_model: mostUsedModel,
      date_from: dateFrom,
      date_to: dateTo,
      spending_limit: limitStatus
    });
  } catch (error) {
    logger.error('Admin AI usage summary error: ' + error.message);
    res.status(500).json({ error: 'Failed to get AI usage summary' });
  }
});

// GET /api/admin/ai/usage/daily - Daily cost/tokens for charts
router.get('/ai/usage/daily', (req, res) => {
  try {
    var dateFrom = req.query.date_from || null;
    var dateTo = req.query.date_to || null;

    // Default to last 30 days
    if (!dateFrom) {
      var d = new Date();
      d.setDate(d.getDate() - 30);
      dateFrom = d.toISOString().split('T')[0];
    }

    var daily = aiUsageLogger.getUsageStats({ period: 'day', dateFrom: dateFrom, dateTo: dateTo });
    res.json({ daily: daily, date_from: dateFrom, date_to: dateTo });
  } catch (error) {
    logger.error('Admin AI usage daily error: ' + error.message);
    res.status(500).json({ error: 'Failed to get daily AI usage' });
  }
});

// ==================== AI Spending Limits ====================

// GET /api/admin/ai/limits - Get current spending limit settings and status
router.get('/ai/limits', (req, res) => {
  try {
    const status = aiUsageLogger.getSpendingLimitStatus();
    res.json(status);
  } catch (error) {
    logger.error('Admin get AI limits error: ' + error.message);
    res.status(500).json({ error: 'Failed to get AI spending limits' });
  }
});

// PUT /api/admin/ai/limits - Update spending limit settings
router.put('/ai/limits', (req, res) => {
  try {
    const { limit_usd, warning_percent } = req.body;
    const db = getDatabase();
    const updated = [];

    if (limit_usd !== undefined) {
      const val = parseFloat(limit_usd);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ error: 'limit_usd must be a non-negative number' });
      }
      db.run(
        "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_monthly_limit_usd', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
        [String(val), req.user.id, String(val), req.user.id]
      );
      updated.push('ai_monthly_limit_usd');

      // Reset warning/reached flags when limit changes
      db.run("DELETE FROM platform_settings WHERE key IN ('ai_limit_warning_sent', 'ai_limit_reached')");
    }

    if (warning_percent !== undefined) {
      const val = parseInt(warning_percent, 10);
      if (isNaN(val) || val < 1 || val > 99) {
        return res.status(400).json({ error: 'warning_percent must be between 1 and 99' });
      }
      db.run(
        "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_limit_warning_percent', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
        [String(val), req.user.id, String(val), req.user.id]
      );
      updated.push('ai_limit_warning_percent');
    }

    if (updated.length > 0) {
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'update_ai_limits', 'platform_settings', NULL, ?, datetime('now'))",
        [req.user.id, JSON.stringify({ updated, limit_usd, warning_percent })]
      );
      saveDatabaseAfterWrite();
    }

    logger.info(`Superadmin ${req.user.id} updated AI spending limits: ${updated.join(', ')}`);

    // Return updated status
    const status = aiUsageLogger.getSpendingLimitStatus();
    res.json({ message: 'AI spending limits updated successfully', ...status });
  } catch (error) {
    logger.error('Admin update AI limits error: ' + error.message);
    res.status(500).json({ error: 'Failed to update AI spending limits' });
  }
});

// ==================== AI Model Selector ====================

// GET /api/admin/ai/models - Get available models grouped by provider
router.get('/ai/models', (req, res) => {
  try {
    const db = getDatabase();
    const allModels = aiProviders.getAllModels();

    // Transcription models (only OpenAI Whisper for now)
    const transcriptionModels = [
      { provider: 'openai', configured: allModels.find(p => p.provider === 'openai')?.configured || false, models: ['whisper-1'] }
    ];

    // Read current settings from DB
    const getSettingValue = (key, fallback) => {
      const r = db.exec("SELECT value FROM platform_settings WHERE key = ?", [key]);
      return (r.length > 0 && r[0].values.length > 0) ? r[0].values[0][0] : fallback;
    };

    // Default assistant provider/model to same as summarization
    const sumProv = getSettingValue('ai_summarization_provider', 'openai');
    const sumMod = getSettingValue('ai_summarization_model', 'gpt-4o-mini');

    const current = {
      summarization: {
        provider: sumProv,
        model: sumMod
      },
      transcription: {
        provider: getSettingValue('ai_transcription_provider', 'openai'),
        model: getSettingValue('ai_transcription_model', 'whisper-1')
      },
      assistant: {
        provider: getSettingValue('ai_assistant_provider', sumProv),
        model: getSettingValue('ai_assistant_model', sumMod)
      }
    };

    res.json({
      summarization_providers: allModels,
      transcription_providers: transcriptionModels,
      assistant_providers: allModels,
      current
    });
  } catch (error) {
    logger.error('Admin AI models error: ' + error.message);
    res.status(500).json({ error: 'Failed to get AI models' });
  }
});

// PUT /api/admin/ai/models - Save selected AI models
router.put('/ai/models', (req, res) => {
  try {
    const { summarization, transcription, assistant } = req.body;
    const db = getDatabase();
    const updated = [];

    if (summarization) {
      if (summarization.provider) {
        db.run(
          "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_summarization_provider', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
          [summarization.provider, req.user.id, summarization.provider, req.user.id]
        );
        updated.push('ai_summarization_provider');
      }
      if (summarization.model) {
        db.run(
          "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_summarization_model', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
          [summarization.model, req.user.id, summarization.model, req.user.id]
        );
        updated.push('ai_summarization_model');
      }
    }

    if (transcription) {
      if (transcription.provider) {
        db.run(
          "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_transcription_provider', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
          [transcription.provider, req.user.id, transcription.provider, req.user.id]
        );
        updated.push('ai_transcription_provider');
      }
      if (transcription.model) {
        db.run(
          "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_transcription_model', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
          [transcription.model, req.user.id, transcription.model, req.user.id]
        );
        updated.push('ai_transcription_model');
      }
    }

    if (assistant) {
      if (assistant.provider) {
        db.run(
          "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_assistant_provider', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
          [assistant.provider, req.user.id, assistant.provider, req.user.id]
        );
        updated.push('ai_assistant_provider');
      }
      if (assistant.model) {
        db.run(
          "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_assistant_model', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
          [assistant.model, req.user.id, assistant.model, req.user.id]
        );
        updated.push('ai_assistant_model');
      }
    }

    if (updated.length > 0) {
      // Audit log
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'update_ai_models', 'platform_settings', NULL, ?, datetime('now'))",
        [req.user.id, JSON.stringify({ updated })]
      );
      saveDatabaseAfterWrite();
    }

    logger.info(`Superadmin ${req.user.id} updated AI model settings: ${updated.join(', ')}`);

    // Return updated current settings
    const getSettingValue = (key, fallback) => {
      const r = db.exec("SELECT value FROM platform_settings WHERE key = ?", [key]);
      return (r.length > 0 && r[0].values.length > 0) ? r[0].values[0][0] : fallback;
    };

    const sumProv = getSettingValue('ai_summarization_provider', 'openai');
    const sumMod = getSettingValue('ai_summarization_model', 'gpt-4o-mini');

    res.json({
      message: 'AI model settings updated successfully',
      updated,
      current: {
        summarization: {
          provider: sumProv,
          model: sumMod
        },
        transcription: {
          provider: getSettingValue('ai_transcription_provider', 'openai'),
          model: getSettingValue('ai_transcription_model', 'whisper-1')
        },
        assistant: {
          provider: getSettingValue('ai_assistant_provider', sumProv),
          model: getSettingValue('ai_assistant_model', sumMod)
        }
      }
    });
  } catch (error) {
    logger.error('Admin update AI models error: ' + error.message);
    res.status(500).json({ error: 'Failed to update AI model settings' });
  }
});

// GET /api/admin/ai/test - Test connection to a provider
router.get('/ai/test', async (req, res) => {
  try {
    const providerName = req.query.provider;
    if (!providerName) {
      return res.status(400).json({ error: 'provider query parameter required' });
    }

    const provider = aiProviders.getProvider(providerName);
    if (!provider) {
      return res.status(400).json({ error: 'Unknown provider: ' + providerName });
    }

    if (!provider.isConfigured()) {
      return res.json({
        provider: providerName,
        success: false,
        configured: false,
        message: 'Provider is not configured (missing API key)'
      });
    }

    // Try a minimal API call
    const testMessages = [
      { role: 'user', content: 'Reply with exactly: OK' }
    ];

    const model = provider.listModels()[0];
    const startTime = Date.now();
    const result = await provider.chat(testMessages, { model, temperature: 0, max_tokens: 10 });
    const elapsed = Date.now() - startTime;

    res.json({
      provider: providerName,
      success: true,
      configured: true,
      message: 'Connection successful',
      response_time_ms: elapsed,
      model_used: result.model || model,
      response_text: (result.text || '').substring(0, 50)
    });
  } catch (error) {
    logger.error('Admin AI test connection error: ' + error.message);
    res.json({
      provider: req.query.provider,
      success: false,
      configured: true,
      message: 'Connection failed: ' + error.message
    });
  }
});

// ==================== Assistant AI Settings (Dedicated Endpoints) ====================

// GET /api/admin/settings/assistant-ai - Get assistant AI provider/model config
router.get('/settings/assistant-ai', (req, res) => {
  try {
    const db = getDatabase();
    const allModels = aiProviders.getAllModels();

    const getSettingValue = (key, fallback) => {
      const r = db.exec("SELECT value FROM platform_settings WHERE key = ?", [key]);
      return (r.length > 0 && r[0].values.length > 0) ? r[0].values[0][0] : fallback;
    };

    // Fallback to summarization settings if assistant not explicitly set
    const sumProv = getSettingValue('ai_summarization_provider', 'openai');
    const sumMod = getSettingValue('ai_summarization_model', 'gpt-4o-mini');

    const assistantProvider = getSettingValue('ai_assistant_provider', sumProv);
    const assistantModel = getSettingValue('ai_assistant_model', sumMod);

    // Check if the selected provider has a valid API key
    const selectedProviderObj = aiProviders.getProvider(assistantProvider);
    const providerConfigured = selectedProviderObj ? selectedProviderObj.isConfigured() : false;

    res.json({
      assistant: {
        provider: assistantProvider,
        model: assistantModel,
        provider_configured: providerConfigured
      },
      available_providers: allModels.map(p => ({
        provider: p.provider,
        configured: p.configured,
        models: p.models
      }))
    });
  } catch (error) {
    logger.error('Admin get assistant AI settings error: ' + error.message);
    res.status(500).json({ error: 'Failed to get assistant AI settings' });
  }
});

// PUT /api/admin/settings/assistant-ai - Update assistant AI provider/model config
router.put('/settings/assistant-ai', (req, res) => {
  try {
    const { provider, model } = req.body;
    const db = getDatabase();

    if (!provider || !model) {
      return res.status(400).json({ error: 'Both provider and model are required' });
    }

    // Validate provider exists
    const providerObj = aiProviders.getProvider(provider);
    if (!providerObj) {
      return res.status(400).json({ error: 'Unknown AI provider: ' + provider });
    }

    // Validate provider has a valid API key configured
    if (!providerObj.isConfigured()) {
      return res.status(400).json({
        error: 'Provider ' + provider + ' does not have a valid API key configured. Please configure the API key first.'
      });
    }

    // Validate model is available for this provider
    const availableModels = providerObj.listModels();
    if (!availableModels.includes(model)) {
      return res.status(400).json({
        error: 'Model ' + model + ' is not available for provider ' + provider + '. Available: ' + availableModels.join(', ')
      });
    }

    // Save assistant provider
    db.run(
      "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_assistant_provider', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
      [provider, req.user.id, provider, req.user.id]
    );

    // Save assistant model
    db.run(
      "INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai_assistant_model', ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = datetime('now')",
      [model, req.user.id, model, req.user.id]
    );

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'update_assistant_ai', 'platform_settings', NULL, ?, datetime('now'))",
      [req.user.id, JSON.stringify({ provider, model })]
    );

    saveDatabaseAfterWrite();

    logger.info(`Superadmin ${req.user.id} updated assistant AI settings: provider=${provider}, model=${model}`);

    res.json({
      message: 'Assistant AI settings updated successfully',
      assistant: {
        provider,
        model,
        provider_configured: true
      }
    });
  } catch (error) {
    logger.error('Admin update assistant AI settings error: ' + error.message);
    res.status(500).json({ error: 'Failed to update assistant AI settings' });
  }
});

// ==================== Assistant Knowledge Base ====================

// POST /api/admin/assistant/reindex - Trigger knowledge base re-indexing
router.post('/assistant/reindex', async (req, res) => {
  try {
    const stats = await assistantKnowledge.reindex();

    // Audit log
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'reindex_knowledge_base', 'assistant_knowledge', NULL, ?, datetime('now'))",
      [req.user.id, JSON.stringify(stats)]
    );
    saveDatabaseAfterWrite();

    logger.info(`Superadmin ${req.user.id} triggered knowledge base re-index: ${stats.indexed} files, ${stats.chunks} chunks`);

    res.json({
      message: 'Knowledge base re-indexed successfully',
      ...stats
    });
  } catch (error) {
    logger.error('Admin reindex knowledge base error: ' + error.message);
    res.status(500).json({ error: 'Failed to re-index knowledge base' });
  }
});

// GET /api/admin/assistant/knowledge-stats - Get knowledge base statistics
router.get('/assistant/knowledge-stats', (req, res) => {
  try {
    const stats = assistantKnowledge.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Admin knowledge stats error: ' + error.message);
    res.status(500).json({ error: 'Failed to get knowledge base stats' });
  }
});

// ==================== Assistant Cached Answers ====================

// GET /api/admin/assistant/cached-answers - List cached answers (paginated)
router.get('/assistant/cached-answers', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const result = assistantCache.getCachedAnswers(page, limit);
    res.json(result);
  } catch (error) {
    logger.error('Admin list cached answers error: ' + error.message);
    res.status(500).json({ error: 'Failed to list cached answers' });
  }
});

// PUT /api/admin/assistant/cached-answers/:id - Edit a cached answer
router.put('/assistant/cached-answers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { answer_text } = req.body;

    if (!answer_text || typeof answer_text !== 'string' || answer_text.trim().length === 0) {
      return res.status(400).json({ error: 'answer_text is required' });
    }

    const success = assistantCache.updateCachedAnswer(id, answer_text.trim());
    if (!success) {
      return res.status(404).json({ error: 'Cached answer not found' });
    }

    // Audit log
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'edit_cached_answer', 'assistant_cached_answers', ?, ?, datetime('now'))",
      [req.user.id, String(id), JSON.stringify({ action: 'edit' })]
    );
    saveDatabaseAfterWrite();

    res.json({ message: 'Cached answer updated', id });
  } catch (error) {
    logger.error('Admin edit cached answer error: ' + error.message);
    res.status(500).json({ error: 'Failed to edit cached answer' });
  }
});

// DELETE /api/admin/assistant/cached-answers/:id - Delete a cached answer
router.delete('/assistant/cached-answers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = assistantCache.deleteCachedAnswer(id);
    if (!success) {
      return res.status(404).json({ error: 'Cached answer not found' });
    }

    // Audit log
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'delete_cached_answer', 'assistant_cached_answers', ?, ?, datetime('now'))",
      [req.user.id, String(id), JSON.stringify({ action: 'delete' })]
    );
    saveDatabaseAfterWrite();

    res.json({ message: 'Cached answer deleted', id });
  } catch (error) {
    logger.error('Admin delete cached answer error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete cached answer' });
  }
});

// =====================================================
// ASSISTANT CHAT ANALYTICS
// =====================================================

// GET /api/admin/assistant/analytics - Aggregated assistant chat statistics
router.get('/assistant/analytics', (req, res) => {
  try {
    const db = getDatabase();

    // Total conversations
    const totalConvResult = db.exec('SELECT COUNT(*) FROM assistant_conversations');
    const totalConversations = (totalConvResult.length > 0 && totalConvResult[0].values.length > 0) ? totalConvResult[0].values[0][0] : 0;

    // Total messages
    const totalMsgResult = db.exec('SELECT COUNT(*) FROM assistant_messages');
    const totalMessages = (totalMsgResult.length > 0 && totalMsgResult[0].values.length > 0) ? totalMsgResult[0].values[0][0] : 0;

    // Cached vs fresh responses
    const cachedResult = db.exec("SELECT is_cached, COUNT(*) FROM assistant_messages WHERE role = 'assistant' GROUP BY is_cached");
    let cachedCount = 0, freshCount = 0;
    if (cachedResult.length > 0) {
      for (const row of cachedResult[0].values) {
        if (row[0] === 1) cachedCount = row[1];
        else freshCount = row[1];
      }
    }

    // Tag breakdown
    const tagResult = db.exec("SELECT tags, COUNT(*) FROM assistant_messages WHERE role = 'user' AND tags IS NOT NULL GROUP BY tags ORDER BY COUNT(*) DESC");
    const tagBreakdown = {};
    if (tagResult.length > 0 && tagResult[0].values) {
      for (const row of tagResult[0].values) {
        tagBreakdown[row[0]] = row[1];
      }
    }

    // Conversations by language
    const langResult = db.exec("SELECT language, COUNT(*) FROM assistant_conversations GROUP BY language ORDER BY COUNT(*) DESC");
    const byLanguage = {};
    if (langResult.length > 0 && langResult[0].values) {
      for (const row of langResult[0].values) {
        byLanguage[row[0] || 'unknown'] = row[1];
      }
    }

    // Top page contexts
    const contextResult = db.exec("SELECT page_context, COUNT(*) FROM assistant_conversations WHERE page_context IS NOT NULL GROUP BY page_context ORDER BY COUNT(*) DESC LIMIT 10");
    const topContexts = [];
    if (contextResult.length > 0 && contextResult[0].values) {
      for (const row of contextResult[0].values) {
        topContexts.push({ context: row[0], count: row[1] });
      }
    }

    // Most asked questions (user messages sorted by frequency)
    const topQuestionsResult = db.exec("SELECT content, COUNT(*) as cnt FROM assistant_messages WHERE role = 'user' GROUP BY content ORDER BY cnt DESC LIMIT 20");
    const topQuestions = [];
    if (topQuestionsResult.length > 0 && topQuestionsResult[0].values) {
      for (const row of topQuestionsResult[0].values) {
        topQuestions.push({ question: row[0], count: row[1] });
      }
    }

    // Feature requests
    const featureReqResult = db.exec("SELECT content FROM assistant_messages WHERE role = 'user' AND tags = 'feature_request' ORDER BY created_at DESC LIMIT 20");
    const featureRequests = [];
    if (featureReqResult.length > 0 && featureReqResult[0].values) {
      for (const row of featureReqResult[0].values) {
        featureRequests.push(row[0]);
      }
    }

    // Common difficulties
    const difficultyResult = db.exec("SELECT content FROM assistant_messages WHERE role = 'user' AND tags = 'difficulty' ORDER BY created_at DESC LIMIT 20");
    const difficulties = [];
    if (difficultyResult.length > 0 && difficultyResult[0].values) {
      for (const row of difficultyResult[0].values) {
        difficulties.push(row[0]);
      }
    }

    // Daily usage (last 30 days)
    const dailyResult = db.exec("SELECT date(created_at) as day, SUM(CASE WHEN is_cached = 1 THEN 1 ELSE 0 END) as cached, SUM(CASE WHEN is_cached = 0 THEN 1 ELSE 0 END) as fresh FROM assistant_messages WHERE role = 'assistant' AND created_at >= datetime('now', '-30 days') GROUP BY day ORDER BY day");
    const dailyUsage = [];
    if (dailyResult.length > 0 && dailyResult[0].values) {
      for (const row of dailyResult[0].values) {
        dailyUsage.push({ date: row[0], cached: row[1], fresh: row[2] });
      }
    }

    // Conversations by therapist
    const byTherapistResult = db.exec("SELECT c.therapist_id, u.email, COUNT(*) as conv_count, SUM(c.message_count) as msg_count FROM assistant_conversations c JOIN users u ON u.id = c.therapist_id GROUP BY c.therapist_id ORDER BY conv_count DESC LIMIT 20");
    const byTherapist = [];
    if (byTherapistResult.length > 0 && byTherapistResult[0].values) {
      for (const row of byTherapistResult[0].values) {
        byTherapist.push({ therapist_id: row[0], email: row[1], conversations: row[2], messages: row[3] });
      }
    }

    // Feature requests with therapist info (grouped)
    const featureReqDetailResult = db.exec(`
      SELECT am.content, u.email, am.created_at, ac.language
      FROM assistant_messages am
      JOIN assistant_conversations ac ON ac.id = am.conversation_id
      JOIN users u ON u.id = ac.therapist_id
      WHERE am.role = 'user' AND am.tags = 'feature_request'
      ORDER BY am.created_at DESC LIMIT 50
    `);
    const featureRequestDetails = [];
    if (featureReqDetailResult.length > 0 && featureReqDetailResult[0].values) {
      for (const row of featureReqDetailResult[0].values) {
        featureRequestDetails.push({ content: row[0], therapist: row[1], created_at: row[2], language: row[3] });
      }
    }

    // Feedback prompt stats
    const promptStatsResult = db.exec("SELECT COUNT(*) as total_prompts, COUNT(DISTINCT therapist_id) as therapists_prompted FROM assistant_feedback_prompts");
    let feedbackPromptStats = { total_prompts: 0, therapists_prompted: 0 };
    if (promptStatsResult.length > 0 && promptStatsResult[0].values.length > 0) {
      feedbackPromptStats = {
        total_prompts: promptStatsResult[0].values[0][0] || 0,
        therapists_prompted: promptStatsResult[0].values[0][1] || 0
      };
    }

    // Cache poisoning stats: cached answers with vs without RAG context
    let cacheWithRag = 0, cacheWithoutRag = 0;
    try {
      const cacheRagResult = db.exec("SELECT has_rag_context, COUNT(*) FROM assistant_cached_answers GROUP BY has_rag_context");
      if (cacheRagResult.length > 0 && cacheRagResult[0].values) {
        for (const row of cacheRagResult[0].values) {
          if (row[0] === 1) cacheWithRag = row[1];
          else cacheWithoutRag = row[1];
        }
      }
    } catch (e) {
      // Column may not exist yet on older databases
    }

    res.json({
      total_conversations: totalConversations,
      total_messages: totalMessages,
      cached_responses: cachedCount,
      fresh_responses: freshCount,
      tag_breakdown: tagBreakdown,
      by_language: byLanguage,
      top_contexts: topContexts,
      top_questions: topQuestions,
      feature_requests: featureRequests,
      feature_request_details: featureRequestDetails,
      difficulties: difficulties,
      daily_usage: dailyUsage,
      by_therapist: byTherapist,
      feedback_prompt_stats: feedbackPromptStats,
      cache_rag_stats: { with_rag: cacheWithRag, without_rag: cacheWithoutRag }
    });
  } catch (error) {
    logger.error('Admin assistant analytics error: ' + error.message);
    res.status(500).json({ error: 'Failed to load assistant analytics' });
  }
});

// GET /api/admin/assistant/conversations - Paginated conversation list
router.get('/assistant/conversations', (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const language = req.query.language || null;
    const therapistId = req.query.therapist_id ? parseInt(req.query.therapist_id) : null;

    let whereClause = '';
    const params = [];
    const conditions = [];

    const search = req.query.search || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;

    if (language) {
      conditions.push('c.language = ?');
      params.push(language);
    }
    if (therapistId) {
      conditions.push('c.therapist_id = ?');
      params.push(therapistId);
    }
    if (dateFrom) {
      conditions.push('c.started_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('c.started_at <= ?');
      params.push(dateTo + ' 23:59:59');
    }
    if (search) {
      conditions.push('c.id IN (SELECT DISTINCT conversation_id FROM assistant_messages WHERE content LIKE ?)');
      params.push('%' + search + '%');
    }
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const countResult = db.exec('SELECT COUNT(*) FROM assistant_conversations c ' + whereClause, params);
    const total = (countResult.length > 0 && countResult[0].values.length > 0) ? countResult[0].values[0][0] : 0;

    const result = db.exec(
      'SELECT c.id, c.therapist_id, u.email, c.started_at, c.last_message_at, c.page_context, c.language, c.message_count FROM assistant_conversations c JOIN users u ON u.id = c.therapist_id ' + whereClause + ' ORDER BY c.last_message_at DESC LIMIT ? OFFSET ?',
      [...params, limit, offset]
    );

    const conversations = [];
    if (result.length > 0 && result[0].values) {
      for (const row of result[0].values) {
        conversations.push({
          id: row[0],
          therapist_id: row[1],
          email: row[2],
          started_at: row[3],
          last_message_at: row[4],
          page_context: row[5],
          language: row[6],
          message_count: row[7]
        });
      }
    }

    res.json({
      conversations,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Admin assistant conversations error: ' + error.message);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// GET /api/admin/assistant/conversations/:id/messages - Messages for a conversation
router.get('/assistant/conversations/:id/messages', (req, res) => {
  try {
    const db = getDatabase();
    const convId = parseInt(req.params.id);

    // Get conversation info
    const convResult = db.exec(
      'SELECT c.id, c.therapist_id, u.email, c.started_at, c.page_context, c.language FROM assistant_conversations c JOIN users u ON u.id = c.therapist_id WHERE c.id = ?',
      [convId]
    );

    if (!convResult.length || !convResult[0].values.length) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conv = convResult[0].values[0];

    // Get messages with comment counts
    const msgResult = db.exec(
      `SELECT m.id, m.role, m.content, m.is_cached, m.tokens_used, m.tags, m.created_at,
              (SELECT COUNT(*) FROM assistant_admin_comments WHERE message_id = m.id) as comment_count,
              (SELECT rating FROM assistant_admin_comments WHERE message_id = m.id ORDER BY created_at DESC LIMIT 1) as latest_rating
       FROM assistant_messages m WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
      [convId]
    );

    const messages = [];
    if (msgResult.length > 0 && msgResult[0].values) {
      for (const row of msgResult[0].values) {
        messages.push({
          id: row[0],
          role: row[1],
          content: row[2],
          is_cached: row[3] === 1,
          tokens_used: row[4],
          tags: row[5],
          created_at: row[6],
          comment_count: row[7] || 0,
          latest_rating: row[8] || null
        });
      }
    }

    res.json({
      conversation: {
        id: conv[0],
        therapist_id: conv[1],
        email: conv[2],
        started_at: conv[3],
        page_context: conv[4],
        language: conv[5]
      },
      messages
    });
  } catch (error) {
    logger.error('Admin assistant messages error: ' + error.message);
    res.status(500).json({ error: 'Failed to load conversation messages' });
  }
});

// GET /api/admin/assistant/export - Export conversation data as CSV or JSON
router.get('/assistant/export', (req, res) => {
  try {
    const db = getDatabase();
    const format = req.query.format || 'json';

    // Get all conversations with messages
    const convResult = db.exec(
      'SELECT c.id, c.therapist_id, u.email, c.started_at, c.last_message_at, c.page_context, c.language, c.message_count FROM assistant_conversations c JOIN users u ON u.id = c.therapist_id ORDER BY c.started_at DESC'
    );

    const conversations = [];
    if (convResult.length > 0 && convResult[0].values) {
      for (const row of convResult[0].values) {
        const conv = {
          id: row[0], therapist_id: row[1], email: row[2], started_at: row[3],
          last_message_at: row[4], page_context: row[5], language: row[6], message_count: row[7]
        };

        // Get messages for this conversation
        const msgResult = db.exec(
          'SELECT role, content, is_cached, tags, created_at FROM assistant_messages WHERE conversation_id = ? ORDER BY created_at ASC',
          [row[0]]
        );
        conv.messages = [];
        if (msgResult.length > 0 && msgResult[0].values) {
          for (const m of msgResult[0].values) {
            conv.messages.push({ role: m[0], content: m[1], is_cached: m[2] === 1, tags: m[3], created_at: m[4] });
          }
        }
        conversations.push(conv);
      }
    }

    if (format === 'csv') {
      // Flatten to CSV rows (one row per message)
      const csvRows = ['conversation_id,therapist_email,started_at,page_context,language,message_role,message_content,is_cached,tags,created_at'];
      for (const conv of conversations) {
        for (const msg of conv.messages) {
          const escapeCsv = (s) => s ? '"' + String(s).replace(/"/g, '""') + '"' : '""';
          csvRows.push([
            conv.id, escapeCsv(conv.email), conv.started_at, escapeCsv(conv.page_context), conv.language,
            msg.role, escapeCsv(msg.content), msg.is_cached ? 1 : 0, msg.tags || '', msg.created_at
          ].join(','));
        }
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="assistant_conversations.csv"');
      res.send(csvRows.join('\n'));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="assistant_conversations.json"');
      res.json({ conversations, exported_at: new Date().toISOString() });
    }
  } catch (error) {
    logger.error('Admin assistant export error: ' + error.message);
    res.status(500).json({ error: 'Failed to export conversation data' });
  }
});

// ==========================================
// Admin Comments on Assistant Messages
// ==========================================

// POST /api/admin/assistant/messages/:messageId/comments - Create a comment on an assistant message
router.post('/assistant/messages/:messageId/comments', (req, res) => {
  try {
    const db = getDatabase();
    const messageId = parseInt(req.params.messageId);
    const adminId = req.user.id;
    const { comment_text, rating, correction_text } = req.body;

    if (!rating || !['good', 'bad', 'neutral'].includes(rating)) {
      return res.status(400).json({ error: 'Rating must be good, bad, or neutral' });
    }

    // Verify message exists
    const msgCheck = db.exec('SELECT id, role FROM assistant_messages WHERE id = ?', [messageId]);
    if (!msgCheck.length || !msgCheck[0].values.length) {
      return res.status(404).json({ error: 'Message not found' });
    }

    db.run(
      "INSERT INTO assistant_admin_comments (message_id, admin_id, comment_text, rating, correction_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
      [messageId, adminId, comment_text || null, rating, correction_text || null]
    );

    const idResult = db.exec('SELECT last_insert_rowid()');
    const commentId = idResult[0].values[0][0];
    saveDatabaseAfterWrite();

    // If correction_text is provided and rating is 'bad', integrate into cached answers
    if (correction_text && rating === 'bad') {
      try {
        // Get the original user question (previous message in same conversation)
        const msgData = db.exec(
          'SELECT conversation_id, content FROM assistant_messages WHERE id = ?',
          [messageId]
        );
        if (msgData.length && msgData[0].values.length) {
          const convId = msgData[0].values[0][0];
          // Find the user message just before this assistant message
          const userMsg = db.exec(
            "SELECT content FROM assistant_messages WHERE conversation_id = ? AND role = 'user' AND id < ? ORDER BY id DESC LIMIT 1",
            [convId, messageId]
          );
          if (userMsg.length && userMsg[0].values.length) {
            const questionText = userMsg[0].values[0][0];
            // Store or update cached answer with the correction
            assistantCache.storeCachedAnswer(questionText, correction_text);
            logger.info(`[AdminComments] Stored correction as cached answer for message #${messageId}`);
          }
        }
      } catch (cacheErr) {
        logger.warn('[AdminComments] Failed to store correction in cache: ' + cacheErr.message);
      }
    }

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at) VALUES (?, 'admin_comment_create', 'assistant_message', ?, datetime('now'))",
      [adminId, messageId]
    );
    saveDatabaseAfterWrite();

    res.status(201).json({
      id: commentId,
      message_id: messageId,
      admin_id: adminId,
      comment_text: comment_text || null,
      rating,
      correction_text: correction_text || null
    });
  } catch (error) {
    logger.error('Admin create comment error: ' + error.message);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// GET /api/admin/assistant/messages/:messageId/comments - Get all comments for a message
router.get('/assistant/messages/:messageId/comments', (req, res) => {
  try {
    const db = getDatabase();
    const messageId = parseInt(req.params.messageId);

    const result = db.exec(
      `SELECT c.id, c.message_id, c.admin_id, u.email as admin_email, c.comment_text, c.rating, c.correction_text, c.created_at, c.updated_at
       FROM assistant_admin_comments c
       JOIN users u ON u.id = c.admin_id
       WHERE c.message_id = ?
       ORDER BY c.created_at DESC`,
      [messageId]
    );

    const comments = [];
    if (result.length > 0 && result[0].values) {
      for (const row of result[0].values) {
        comments.push({
          id: row[0],
          message_id: row[1],
          admin_id: row[2],
          admin_email: row[3],
          comment_text: row[4],
          rating: row[5],
          correction_text: row[6],
          created_at: row[7],
          updated_at: row[8]
        });
      }
    }

    res.json({ comments });
  } catch (error) {
    logger.error('Admin get comments error: ' + error.message);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

// PUT /api/admin/assistant/comments/:commentId - Update a comment
router.put('/assistant/comments/:commentId', (req, res) => {
  try {
    const db = getDatabase();
    const commentId = parseInt(req.params.commentId);
    const { comment_text, rating, correction_text } = req.body;

    // Verify comment exists
    const existing = db.exec('SELECT id, message_id FROM assistant_admin_comments WHERE id = ?', [commentId]);
    if (!existing.length || !existing[0].values.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (rating && !['good', 'bad', 'neutral'].includes(rating)) {
      return res.status(400).json({ error: 'Rating must be good, bad, or neutral' });
    }

    const updates = [];
    const params = [];
    if (comment_text !== undefined) { updates.push('comment_text = ?'); params.push(comment_text || null); }
    if (rating !== undefined) { updates.push('rating = ?'); params.push(rating); }
    if (correction_text !== undefined) { updates.push('correction_text = ?'); params.push(correction_text || null); }
    updates.push("updated_at = datetime('now')");
    params.push(commentId);

    db.run(`UPDATE assistant_admin_comments SET ${updates.join(', ')} WHERE id = ?`, params);
    saveDatabaseAfterWrite();

    res.json({ success: true, id: commentId });
  } catch (error) {
    logger.error('Admin update comment error: ' + error.message);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /api/admin/assistant/comments/:commentId - Delete a comment
router.delete('/assistant/comments/:commentId', (req, res) => {
  try {
    const db = getDatabase();
    const commentId = parseInt(req.params.commentId);

    // Verify comment exists
    const existing = db.exec('SELECT id FROM assistant_admin_comments WHERE id = ?', [commentId]);
    if (!existing.length || !existing[0].values.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    db.run('DELETE FROM assistant_admin_comments WHERE id = ?', [commentId]);
    saveDatabaseAfterWrite();

    res.json({ success: true, id: commentId });
  } catch (error) {
    logger.error('Admin delete comment error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// GET /api/admin/assistant/comments/export - Export all comments for training data
router.get('/assistant/comments/export', (req, res) => {
  try {
    const db = getDatabase();
    const format = req.query.format || 'json';

    const result = db.exec(
      `SELECT c.id, c.message_id, c.admin_id, u.email as admin_email, c.comment_text, c.rating, c.correction_text, c.created_at,
              m.role as message_role, m.content as message_content, m.tags as message_tags,
              conv.id as conversation_id, conv.page_context, conv.language,
              (SELECT content FROM assistant_messages WHERE conversation_id = conv.id AND role = 'user' AND id < m.id ORDER BY id DESC LIMIT 1) as user_question
       FROM assistant_admin_comments c
       JOIN users u ON u.id = c.admin_id
       JOIN assistant_messages m ON m.id = c.message_id
       JOIN assistant_conversations conv ON conv.id = m.conversation_id
       ORDER BY c.created_at DESC`
    );

    const comments = [];
    if (result.length > 0 && result[0].values) {
      for (const row of result[0].values) {
        comments.push({
          id: row[0],
          message_id: row[1],
          admin_id: row[2],
          admin_email: row[3],
          comment_text: row[4],
          rating: row[5],
          correction_text: row[6],
          created_at: row[7],
          message_role: row[8],
          message_content: row[9],
          message_tags: row[10],
          conversation_id: row[11],
          page_context: row[12],
          language: row[13],
          user_question: row[14]
        });
      }
    }

    if (format === 'csv') {
      const csvRows = ['id,message_id,admin_email,rating,comment_text,correction_text,message_role,message_content,user_question,page_context,language,created_at'];
      for (const c of comments) {
        const escapeCsv = (s) => s ? '"' + String(s).replace(/"/g, '""') + '"' : '""';
        csvRows.push([
          c.id, c.message_id, escapeCsv(c.admin_email), c.rating, escapeCsv(c.comment_text),
          escapeCsv(c.correction_text), c.message_role, escapeCsv(c.message_content),
          escapeCsv(c.user_question), escapeCsv(c.page_context), c.language, c.created_at
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="assistant_admin_comments.csv"');
      res.send(csvRows.join('\n'));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="assistant_admin_comments.json"');
      res.json({ comments, exported_at: new Date().toISOString(), total: comments.length });
    }
  } catch (error) {
    logger.error('Admin export comments error: ' + error.message);
    res.status(500).json({ error: 'Failed to export comments' });
  }
});

// =====================================================
// ASSISTANT CONVERSATION SUMMARY & INSIGHTS (AI-powered)
// =====================================================

// POST /api/admin/assistant/summary - Generate AI summary of assistant conversations
router.post('/assistant/summary', async (req, res) => {
  try {
    const db = getDatabase();
    const { dateFrom, dateTo, therapistId, tags } = req.body;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom and dateTo are required' });
    }

    // Build query to collect messages within the date range
    let conversationQuery = `
      SELECT ac.id as conversation_id, ac.therapist_id, ac.page_context, ac.language, ac.message_count,
             u.email as therapist_email
      FROM assistant_conversations ac
      LEFT JOIN users u ON u.id = ac.therapist_id
      WHERE ac.started_at >= ? AND ac.started_at <= ?
    `;
    const params = [dateFrom, dateTo + 'T23:59:59'];

    if (therapistId) {
      conversationQuery += ' AND ac.therapist_id = ?';
      params.push(parseInt(therapistId));
    }

    conversationQuery += ' ORDER BY ac.started_at ASC';

    const convResult = db.exec(conversationQuery, params);
    if (!convResult.length || !convResult[0].values.length) {
      return res.status(200).json({
        summary: {
          feature_requests: [],
          bugs: [],
          faq: [],
          trends: [],
          recommendations: []
        },
        meta: { conversations_analyzed: 0, messages_analyzed: 0, period: { from: dateFrom, to: dateTo } }
      });
    }

    const convColumns = convResult[0].columns;
    const conversations = convResult[0].values.map(row => {
      const obj = {};
      convColumns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });

    const conversationIds = conversations.map(c => c.conversation_id);

    // Fetch messages for these conversations, optionally filtered by tags
    let msgQuery = `
      SELECT am.conversation_id, am.role, am.content, am.tags, am.created_at
      FROM assistant_messages am
      WHERE am.conversation_id IN (${conversationIds.map(() => '?').join(',')})
    `;
    const msgParams = [...conversationIds];

    if (tags && tags.length > 0) {
      msgQuery += ` AND (am.role = 'assistant' OR am.tags IN (${tags.map(() => '?').join(',')}))`;
      msgParams.push(...tags);
    }

    msgQuery += ' ORDER BY am.conversation_id, am.created_at ASC';

    const msgResult = db.exec(msgQuery, msgParams);
    let allMessages = [];
    if (msgResult.length && msgResult[0].values.length) {
      const msgColumns = msgResult[0].columns;
      allMessages = msgResult[0].values.map(row => {
        const obj = {};
        msgColumns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
    }

    // Group messages by conversation
    const conversationMap = {};
    for (const conv of conversations) {
      conversationMap[conv.conversation_id] = {
        ...conv,
        messages: []
      };
    }
    for (const msg of allMessages) {
      if (conversationMap[msg.conversation_id]) {
        conversationMap[msg.conversation_id].messages.push(msg);
      }
    }

    // Build digest for AI analysis (truncate to avoid token overflow)
    const conversationsWithMessages = Object.values(conversationMap).filter(c => c.messages.length > 0);
    let totalMessages = 0;

    let digest = '';
    for (const conv of conversationsWithMessages) {
      digest += `\n--- Conversation (therapist: ${conv.therapist_email || 'unknown'}, context: ${conv.page_context || 'general'}, lang: ${conv.language || 'en'}) ---\n`;
      for (const msg of conv.messages) {
        const tag = msg.tags ? ` [${msg.tags}]` : '';
        digest += `${msg.role}${tag}: ${msg.content}\n`;
        totalMessages++;
      }
      // Limit digest size to ~50k chars to avoid token limits
      if (digest.length > 50000) {
        digest += '\n[... additional conversations truncated for analysis ...]\n';
        break;
      }
    }

    if (!digest.trim()) {
      return res.status(200).json({
        summary: {
          feature_requests: [],
          bugs: [],
          faq: [],
          trends: [],
          recommendations: []
        },
        meta: { conversations_analyzed: 0, messages_analyzed: 0, period: { from: dateFrom, to: dateTo } }
      });
    }

    // Check if AI is configured
    const activeProvider = aiProviders.getActiveAssistantProvider(db);
    if (!activeProvider.provider.isConfigured()) {
      return res.status(503).json({
        error: 'AI provider is not configured. Please configure an AI provider in Admin > AI Models.',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    // Set up SSE streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Send meta info first
    res.write(`data: ${JSON.stringify({
      type: 'meta',
      conversations_analyzed: conversationsWithMessages.length,
      messages_analyzed: totalMessages,
      period: { from: dateFrom, to: dateTo }
    })}\n\n`);

    const analysisPrompt = `You are an expert product analyst reviewing user support conversations from a SaaS platform (PR-TOP — a therapist-controlled between-session assistant for psychologists).

Analyze the following assistant chat conversations between therapists and the in-app AI assistant. Extract and categorize insights.

CONVERSATIONS:
${digest}

Return a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):
{
  "feature_requests": [
    { "title": "Short title", "description": "Details of what the user wants", "frequency": 1, "priority": "high|medium|low" }
  ],
  "bugs": [
    { "title": "Short title", "description": "What went wrong", "severity": "critical|high|medium|low" }
  ],
  "faq": [
    { "question": "Common question", "frequency": 1, "category": "navigation|workflow|billing|technical|other" }
  ],
  "trends": [
    { "trend": "Description of observed pattern", "impact": "high|medium|low" }
  ],
  "recommendations": [
    { "action": "Specific recommendation", "rationale": "Why this matters", "effort": "low|medium|high" }
  ]
}

Guidelines:
- Group similar requests/issues together, noting frequency
- Prioritize by frequency and impact
- Be specific and actionable in recommendations
- If no items found for a category, return an empty array
- Return ONLY the JSON object, nothing else`;

    try {
      const stream = aiProviders.chatStream(
        [
          { role: 'system', content: 'You are a product analytics expert. Always respond with valid JSON only.' },
          { role: 'user', content: analysisPrompt }
        ],
        {
          provider: activeProvider.providerName,
          model: activeProvider.model,
          temperature: 0.3,
          max_tokens: 4000
        },
        db
      );

      let fullText = '';
      for await (const chunk of stream) {
        if (chunk.text) {
          fullText += chunk.text;
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
        }
        if (chunk.done) {
          // Try to parse the full response as JSON
          let parsed = null;
          try {
            // Strip markdown code fences if present
            let cleanText = fullText.trim();
            if (cleanText.startsWith('```')) {
              cleanText = cleanText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
            }
            parsed = JSON.parse(cleanText);
          } catch (parseErr) {
            logger.warn('[Admin Summary] Could not parse AI response as JSON: ' + parseErr.message);
            parsed = {
              feature_requests: [],
              bugs: [],
              faq: [],
              trends: [],
              recommendations: [],
              raw_text: fullText
            };
          }

          res.write(`data: ${JSON.stringify({
            type: 'done',
            summary: parsed,
            meta: {
              conversations_analyzed: conversationsWithMessages.length,
              messages_analyzed: totalMessages,
              period: { from: dateFrom, to: dateTo },
              model: activeProvider.model,
              provider: activeProvider.providerName
            }
          })}\n\n`);
        }
      }
    } catch (aiErr) {
      logger.error('[Admin Summary] AI error: ' + aiErr.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: aiErr.message })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // Audit log
    try {
      db.run(
        "INSERT INTO audit_log (user_id, action, details, created_at) VALUES (?, 'admin_generate_summary', ?, datetime('now'))",
        [req.user.id, JSON.stringify({ dateFrom, dateTo, therapistId: therapistId || null, tags: tags || null, conversations: conversationsWithMessages.length })]
      );
      saveDatabaseAfterWrite();
    } catch (auditErr) {
      logger.warn('[Admin Summary] Audit log failed: ' + auditErr.message);
    }

  } catch (error) {
    logger.error('Admin generate summary error: ' + error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate summary' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

// POST /api/admin/assistant/summary/export - Export summary as JSON
router.post('/assistant/summary/export', async (req, res) => {
  try {
    const { summary, meta } = req.body;
    if (!summary) {
      return res.status(400).json({ error: 'Summary data is required' });
    }

    const exportData = {
      generated_at: new Date().toISOString(),
      platform: 'PR-TOP',
      meta: meta || {},
      summary
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="assistant-summary-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    logger.error('Admin export summary error: ' + error.message);
    res.status(500).json({ error: 'Failed to export summary' });
  }
});

// ── Newsletter Management ───────────────────────────────────────────────

// GET /api/admin/newsletter - List all newsletter subscribers
router.get('/newsletter', (req, res) => {
  try {
    const db = getDatabase();
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '1=1';
    const params = [];

    if (status === 'confirmed') {
      whereClause += ' AND confirmed = 1 AND unsubscribed_at IS NULL';
    } else if (status === 'unconfirmed') {
      whereClause += ' AND confirmed = 0 AND unsubscribed_at IS NULL';
    } else if (status === 'unsubscribed') {
      whereClause += ' AND unsubscribed_at IS NOT NULL';
    }

    if (search) {
      whereClause += ' AND email LIKE ?';
      params.push('%' + search + '%');
    }

    const countResult = db.exec(`SELECT COUNT(*) FROM newsletter_subscribers WHERE ${whereClause}`, params);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    const result = db.exec(
      `SELECT id, email, language, confirmed, confirmed_at, unsubscribed_at, source, utm_source, utm_medium, utm_campaign, created_at
       FROM newsletter_subscribers
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const subscribers = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      email: row[1],
      language: row[2],
      confirmed: !!row[3],
      confirmed_at: row[4],
      unsubscribed_at: row[5],
      source: row[6],
      utm_source: row[7],
      utm_medium: row[8],
      utm_campaign: row[9],
      created_at: row[10]
    }));

    res.json({
      subscribers,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('Admin newsletter list error: ' + error.message);
    res.status(500).json({ error: 'Failed to load subscribers' });
  }
});

// GET /api/admin/newsletter/stats - Newsletter statistics
router.get('/newsletter/stats', (req, res) => {
  try {
    const db = getDatabase();

    const totalResult = db.exec('SELECT COUNT(*) FROM newsletter_subscribers');
    const confirmedResult = db.exec('SELECT COUNT(*) FROM newsletter_subscribers WHERE confirmed = 1 AND unsubscribed_at IS NULL');
    const unconfirmedResult = db.exec('SELECT COUNT(*) FROM newsletter_subscribers WHERE confirmed = 0 AND unsubscribed_at IS NULL');
    const unsubscribedResult = db.exec('SELECT COUNT(*) FROM newsletter_subscribers WHERE unsubscribed_at IS NOT NULL');

    const byLanguage = db.exec(
      "SELECT language, COUNT(*) as count FROM newsletter_subscribers WHERE confirmed = 1 AND unsubscribed_at IS NULL GROUP BY language ORDER BY count DESC"
    );

    const languageBreakdown = (byLanguage.length > 0 ? byLanguage[0].values : []).map(row => ({
      language: row[0],
      count: row[1]
    }));

    res.json({
      total: totalResult.length > 0 ? totalResult[0].values[0][0] : 0,
      confirmed: confirmedResult.length > 0 ? confirmedResult[0].values[0][0] : 0,
      unconfirmed: unconfirmedResult.length > 0 ? unconfirmedResult[0].values[0][0] : 0,
      unsubscribed: unsubscribedResult.length > 0 ? unsubscribedResult[0].values[0][0] : 0,
      byLanguage: languageBreakdown
    });
  } catch (error) {
    logger.error('Admin newsletter stats error: ' + error.message);
    res.status(500).json({ error: 'Failed to load newsletter stats' });
  }
});

// GET /api/admin/newsletter/export - Export subscribers as CSV
router.get('/newsletter/export', (req, res) => {
  try {
    const db = getDatabase();
    const { status } = req.query;

    let whereClause = '1=1';
    if (status === 'confirmed') {
      whereClause = 'confirmed = 1 AND unsubscribed_at IS NULL';
    } else if (status === 'unsubscribed') {
      whereClause = 'unsubscribed_at IS NOT NULL';
    }

    const result = db.exec(
      `SELECT email, language, confirmed, confirmed_at, unsubscribed_at, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at
       FROM newsletter_subscribers
       WHERE ${whereClause}
       ORDER BY created_at DESC`
    );

    const headers = ['email', 'language', 'confirmed', 'confirmed_at', 'unsubscribed_at', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'created_at'];
    const rows = result.length > 0 ? result[0].values : [];

    let csv = headers.join(',') + '\n';
    for (const row of rows) {
      csv += row.map(v => v === null ? '' : `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Admin newsletter export error: ' + error.message);
    res.status(500).json({ error: 'Failed to export subscribers' });
  }
});

// DELETE /api/admin/newsletter/:id - Delete a subscriber
router.delete('/newsletter/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = db.exec('SELECT email FROM newsletter_subscribers WHERE id = ?', [parseInt(id)]);
    if (!existing.length || !existing[0].values.length) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    db.run('DELETE FROM newsletter_subscribers WHERE id = ?', [parseInt(id)]);
    saveDatabaseAfterWrite();

    logger.info(`[ADMIN] Deleted newsletter subscriber id=${id}, email=${existing[0].values[0][0]}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Admin newsletter delete error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/admin/stats/viewers — Viewer analytics dashboard metrics
// ══════════════════════════════════════════════════════════════════════════
router.get('/stats/viewers', (req, res) => {
  try {
    const db = getDatabase();
    const { range } = req.query; // today, 7d, 30d, custom
    const { start, end } = req.query;

    // Build date filter
    let dateFilter = '';
    let dateFilterConv = '';
    if (range === 'today') {
      dateFilter = "AND vs.created_at >= date('now', 'start of day')";
      dateFilterConv = "AND ac.started_at >= date('now', 'start of day')";
    } else if (range === '7d') {
      dateFilter = "AND vs.created_at >= date('now', '-7 days')";
      dateFilterConv = "AND ac.started_at >= date('now', '-7 days')";
    } else if (range === '30d') {
      dateFilter = "AND vs.created_at >= date('now', '-30 days')";
      dateFilterConv = "AND ac.started_at >= date('now', '-30 days')";
    } else if (range === 'custom' && start && end) {
      dateFilter = `AND vs.created_at >= '${start}' AND vs.created_at <= '${end} 23:59:59'`;
      dateFilterConv = `AND ac.started_at >= '${start}' AND ac.started_at <= '${end} 23:59:59'`;
    }

    // 1. Total anonymous sessions
    const totalSessionsResult = db.exec(`SELECT COUNT(*) FROM viewer_sessions vs WHERE 1=1 ${dateFilter}`);
    const totalSessions = totalSessionsResult.length > 0 ? totalSessionsResult[0].values[0][0] : 0;

    // 2. Total registered viewers
    const totalViewersResult = db.exec(`SELECT COUNT(*) FROM users WHERE role = 'viewer'`);
    const totalViewers = totalViewersResult.length > 0 ? totalViewersResult[0].values[0][0] : 0;

    // 3. Viewers registered in range
    let viewersInRange = totalViewers;
    if (dateFilter) {
      const rangeViewersResult = db.exec(`SELECT COUNT(*) FROM users WHERE role = 'viewer' AND created_at >= (SELECT MIN(vs.created_at) FROM viewer_sessions vs WHERE 1=1 ${dateFilter})`);
      viewersInRange = rangeViewersResult.length > 0 ? rangeViewersResult[0].values[0][0] : 0;
    }

    // 4. Viewer → therapist conversion rate
    const totalTherapistsFromViewers = db.exec(`SELECT COUNT(*) FROM users WHERE role = 'therapist' AND email IN (SELECT DISTINCT email FROM viewer_sessions WHERE email IS NOT NULL)`);
    const therapistConversions = totalTherapistsFromViewers.length > 0 ? totalTherapistsFromViewers[0].values[0][0] : 0;

    // 5. Messages per anonymous session (avg)
    const avgMsgAnon = db.exec(`SELECT AVG(message_count) FROM viewer_sessions vs WHERE user_id IS NULL ${dateFilter}`);
    const avgMessagesAnon = avgMsgAnon.length > 0 && avgMsgAnon[0].values[0][0] != null ? Number(avgMsgAnon[0].values[0][0]).toFixed(1) : '0';

    // 6. Messages per registered viewer (avg)
    const avgMsgReg = db.exec(`SELECT AVG(message_count) FROM viewer_sessions vs WHERE user_id IS NOT NULL ${dateFilter}`);
    const avgMessagesRegistered = avgMsgReg.length > 0 && avgMsgReg[0].values[0][0] != null ? Number(avgMsgReg[0].values[0][0]).toFixed(1) : '0';

    // 7. Top viewer questions (by tag)
    const topQuestionsResult = db.exec(`
      SELECT am.content, COUNT(*) as cnt
      FROM assistant_messages am
      JOIN assistant_conversations ac ON am.conversation_id = ac.id
      WHERE ac.therapist_id = 0 AND am.role = 'user' ${dateFilterConv}
      GROUP BY am.content
      ORDER BY cnt DESC
      LIMIT 10
    `);
    const topQuestions = topQuestionsResult.length > 0
      ? topQuestionsResult[0].values.map(r => ({ question: r[0], count: r[1] }))
      : [];

    // 8. Popular landing page languages
    const langResult = db.exec(`
      SELECT language, COUNT(*) as cnt
      FROM viewer_sessions vs WHERE 1=1 ${dateFilter}
      GROUP BY language
      ORDER BY cnt DESC
    `);
    const languages = langResult.length > 0
      ? langResult[0].values.map(r => ({ language: r[0] || 'en', count: r[1] }))
      : [];

    // 9. Drop-off point (which message # viewers leave on)
    const dropoffResult = db.exec(`
      SELECT message_count, COUNT(*) as cnt
      FROM viewer_sessions vs WHERE user_id IS NULL ${dateFilter}
      GROUP BY message_count
      ORDER BY message_count ASC
    `);
    const dropoffPoints = dropoffResult.length > 0
      ? dropoffResult[0].values.map(r => ({ messageNumber: r[0], sessions: r[1] }))
      : [];

    // 10. AI cost per viewer session (estimate via token counts)
    const tokenResult = db.exec(`
      SELECT COALESCE(SUM(am.tokens_used), 0)
      FROM assistant_messages am
      JOIN assistant_conversations ac ON am.conversation_id = ac.id
      WHERE ac.therapist_id = 0 ${dateFilterConv}
    `);
    const totalTokens = tokenResult.length > 0 ? tokenResult[0].values[0][0] : 0;
    const estimatedCost = (totalTokens / 1000000 * 0.15).toFixed(4); // rough estimate
    const costPerSession = totalSessions > 0 ? (parseFloat(estimatedCost) / totalSessions).toFixed(4) : '0';

    // 11. Daily stats for chart
    const dailyResult = db.exec(`
      SELECT date(vs.created_at) as day, COUNT(*) as sessions,
             SUM(CASE WHEN vs.user_id IS NOT NULL THEN 1 ELSE 0 END) as registered
      FROM viewer_sessions vs
      WHERE vs.created_at >= date('now', '-30 days') ${dateFilter}
      GROUP BY day
      ORDER BY day ASC
    `);
    const dailyStats = dailyResult.length > 0
      ? dailyResult[0].values.map(r => ({ date: r[0], sessions: r[1], registered: r[2] }))
      : [];

    // 12. Conversion funnel: anonymous → viewer (email) → therapist (trial)
    const sessionsWithEmail = db.exec(`SELECT COUNT(DISTINCT email) FROM viewer_sessions vs WHERE email IS NOT NULL ${dateFilter}`);
    const emailCount = sessionsWithEmail.length > 0 ? sessionsWithEmail[0].values[0][0] : 0;

    const conversionFunnel = {
      anonymous: totalSessions,
      registered_viewer: emailCount,
      therapist: therapistConversions,
      anonymous_to_viewer_rate: totalSessions > 0 ? ((emailCount / totalSessions) * 100).toFixed(1) : '0',
      viewer_to_therapist_rate: emailCount > 0 ? ((therapistConversions / emailCount) * 100).toFixed(1) : '0'
    };

    res.json({
      totalSessions,
      totalViewers,
      viewersInRange,
      therapistConversions,
      avgMessagesAnon,
      avgMessagesRegistered,
      topQuestions,
      languages,
      dropoffPoints,
      totalTokens,
      estimatedCost,
      costPerSession,
      dailyStats,
      conversionFunnel
    });

  } catch (error) {
    logger.error('Admin viewer stats error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch viewer analytics' });
  }
});

// ============================================================
// Promo Code Management
// ============================================================

// POST /api/admin/promos - Create a new promo code
router.post('/promos', (req, res) => {
  try {
    const { code, plan, duration_days, max_uses, expires_at } = req.body;

    // Validate required fields
    if (!code || typeof code !== 'string' || code.trim().length < 3) {
      return res.status(400).json({ error: 'Code is required and must be at least 3 characters' });
    }
    if (!plan || !['basic', 'pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Plan must be one of: basic, pro, premium' });
    }
    if (!duration_days || !Number.isInteger(duration_days) || duration_days < 1) {
      return res.status(400).json({ error: 'duration_days must be a positive integer' });
    }
    if (max_uses !== undefined && max_uses !== null && (!Number.isInteger(max_uses) || max_uses < 1)) {
      return res.status(400).json({ error: 'max_uses must be a positive integer or null for unlimited' });
    }
    if (expires_at && isNaN(Date.parse(expires_at))) {
      return res.status(400).json({ error: 'expires_at must be a valid date string' });
    }

    const db = getDatabase();
    const normalizedCode = code.trim().toUpperCase();

    // Check uniqueness
    const existing = db.exec('SELECT id FROM promo_codes WHERE code = ?', [normalizedCode]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(409).json({ error: 'A promo code with this code already exists' });
    }

    db.run(
      'INSERT INTO promo_codes (code, plan, duration_days, max_uses, is_active, created_by, expires_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [normalizedCode, plan, duration_days, max_uses || null, req.user.id, expires_at || null]
    );
    saveDatabaseAfterWrite();

    const result = db.exec('SELECT id, code, plan, duration_days, max_uses, usage_count, is_active, created_by, created_at, expires_at FROM promo_codes WHERE code = ?', [normalizedCode]);
    const row = result[0].values[0];

    logger.info(`[Admin] Promo code created: ${normalizedCode} by user ${req.user.id}`);

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at) VALUES (?, 'promo_code_created', 'promo_code', ?, datetime('now'))",
      [req.user.id, row[0]]
    );
    saveDatabaseAfterWrite();

    res.status(201).json({
      message: 'Promo code created successfully',
      promo: {
        id: row[0], code: row[1], plan: row[2], duration_days: row[3],
        max_uses: row[4], usage_count: row[5], is_active: !!row[6],
        created_by: row[7], created_at: row[8], expires_at: row[9]
      }
    });
  } catch (error) {
    logger.error('Admin create promo error: ' + error.message);
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

// GET /api/admin/promos - List all promo codes with usage stats
router.get('/promos', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(`
      SELECT p.id, p.code, p.plan, p.duration_days, p.max_uses, p.usage_count,
             p.is_active, p.created_by, p.created_at, p.expires_at,
             u.email as creator_email
      FROM promo_codes p
      LEFT JOIN users u ON u.id = p.created_by
      ORDER BY p.created_at DESC
    `);

    const promos = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0], code: row[1], plan: row[2], duration_days: row[3],
      max_uses: row[4], usage_count: row[5], is_active: !!row[6],
      created_by: row[7], created_at: row[8], expires_at: row[9],
      creator_email: row[10],
      is_expired: row[9] ? new Date(row[9]) < new Date() : false,
      is_maxed: row[4] !== null && row[5] >= row[4]
    }));

    res.json({ promos, total: promos.length });
  } catch (error) {
    logger.error('Admin list promos error: ' + error.message);
    res.status(500).json({ error: 'Failed to list promo codes' });
  }
});

// ============================================================
// Promo Redemption Management (MUST be before /promos/:id to avoid route conflict)
// ============================================================

// GET /api/admin/promos/redemptions - List all redemptions with therapist info
router.get('/promos/redemptions', (req, res) => {
  try {
    const db = getDatabase();
    const { status } = req.query;

    let query = `
      SELECT r.id, r.promo_code_id, r.therapist_id, r.redeemed_at, r.status,
             p.code, p.plan, p.duration_days,
             u.email as therapist_email, u.first_name, u.last_name,
             COALESCE(s.plan, 'trial') as current_plan
      FROM promo_redemptions r
      JOIN promo_codes p ON p.id = r.promo_code_id
      JOIN users u ON u.id = r.therapist_id
      LEFT JOIN subscriptions s ON s.therapist_id = r.therapist_id
    `;
    const params = [];

    if (status && ['pending', 'applied', 'expired'].includes(status)) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.redeemed_at DESC';

    const result = db.exec(query, params);

    const redemptions = (result.length > 0 ? result[0].values : []).map(row => ({
      id: row[0],
      promo_code_id: row[1],
      therapist_id: row[2],
      redeemed_at: row[3],
      status: row[4],
      promo_code: row[5],
      promo_plan: row[6],
      duration_days: row[7],
      therapist_email: row[8],
      therapist_first_name: row[9] || '',
      therapist_last_name: row[10] || '',
      current_plan: row[11]
    }));

    res.json({ redemptions, total: redemptions.length });
  } catch (error) {
    logger.error('Admin list redemptions error: ' + error.message);
    res.status(500).json({ error: 'Failed to list promo redemptions' });
  }
});

// PUT /api/admin/promos/redemptions/:id/apply - Mark redemption as applied
router.put('/promos/redemptions/:id/apply', (req, res) => {
  try {
    const db = getDatabase();
    const redemptionId = parseInt(req.params.id, 10);
    if (isNaN(redemptionId)) {
      return res.status(400).json({ error: 'Invalid redemption ID' });
    }

    // Get redemption details
    const redemptionResult = db.exec(
      `SELECT r.id, r.promo_code_id, r.therapist_id, r.status,
              p.code, p.plan, p.duration_days
       FROM promo_redemptions r
       JOIN promo_codes p ON p.id = r.promo_code_id
       WHERE r.id = ?`,
      [redemptionId]
    );

    if (!redemptionResult.length || !redemptionResult[0].values.length) {
      return res.status(404).json({ error: 'Redemption not found' });
    }

    const row = redemptionResult[0].values[0];
    const currentStatus = row[3];
    const therapistId = row[2];
    const promoCode = row[4];
    const promoPlan = row[5];
    const durationDays = row[6];

    if (currentStatus === 'applied') {
      return res.status(400).json({ error: 'Redemption is already applied' });
    }

    if (currentStatus === 'expired') {
      return res.status(400).json({ error: 'Redemption has expired and cannot be applied' });
    }

    // Mark as applied
    db.run(
      "UPDATE promo_redemptions SET status = 'applied' WHERE id = ?",
      [redemptionId]
    );

    // Apply plan override to therapist subscription
    const now = new Date();
    const overrideExpires = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Check if subscription exists
    const subResult = db.exec(
      'SELECT id FROM subscriptions WHERE therapist_id = ?',
      [therapistId]
    );

    if (subResult.length > 0 && subResult[0].values.length > 0) {
      db.run(
        `UPDATE subscriptions SET plan = ?, is_manual_override = 1, override_reason = ?,
         override_expires_at = ?, override_set_by = ?, updated_at = datetime('now')
         WHERE therapist_id = ?`,
        [promoPlan, `Promo code: ${promoCode}`, overrideExpires.toISOString(), req.user.id, therapistId]
      );
    } else {
      db.run(
        `INSERT INTO subscriptions (therapist_id, plan, status, is_manual_override, override_reason, override_expires_at, override_set_by, created_at, updated_at)
         VALUES (?, ?, 'active', 1, ?, ?, ?, datetime('now'), datetime('now'))`,
        [therapistId, promoPlan, `Promo code: ${promoCode}`, overrideExpires.toISOString(), req.user.id]
      );
    }

    saveDatabaseAfterWrite();

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'promo_redemption_applied', 'promo_redemption', ?, ?, datetime('now'))",
      [req.user.id, redemptionId, JSON.stringify({ promo_code: promoCode, plan: promoPlan, duration_days: durationDays, therapist_id: therapistId })]
    );
    saveDatabaseAfterWrite();

    logger.info(`[Admin] Promo redemption ${redemptionId} applied: ${promoCode} -> therapist ${therapistId} (${promoPlan} for ${durationDays} days) by admin ${req.user.id}`);

    res.json({
      message: 'Redemption applied successfully',
      redemption_id: redemptionId,
      therapist_id: therapistId,
      plan: promoPlan,
      duration_days: durationDays,
      override_expires_at: overrideExpires.toISOString()
    });
  } catch (error) {
    logger.error('Admin apply redemption error: ' + error.message);
    res.status(500).json({ error: 'Failed to apply redemption' });
  }
});

// GET /api/admin/promos/:id - View single promo code with redemptions
router.get('/promos/:id', (req, res) => {
  try {
    const db = getDatabase();
    const promoId = parseInt(req.params.id, 10);
    if (isNaN(promoId)) {
      return res.status(400).json({ error: 'Invalid promo code ID' });
    }

    const promoResult = db.exec(`
      SELECT p.id, p.code, p.plan, p.duration_days, p.max_uses, p.usage_count,
             p.is_active, p.created_by, p.created_at, p.expires_at,
             u.email as creator_email
      FROM promo_codes p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
    `, [promoId]);

    if (!promoResult.length || !promoResult[0].values.length) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    const row = promoResult[0].values[0];
    const promo = {
      id: row[0], code: row[1], plan: row[2], duration_days: row[3],
      max_uses: row[4], usage_count: row[5], is_active: !!row[6],
      created_by: row[7], created_at: row[8], expires_at: row[9],
      creator_email: row[10],
      is_expired: row[9] ? new Date(row[9]) < new Date() : false,
      is_maxed: row[4] !== null && row[5] >= row[4]
    };

    // Get redemptions
    const redemptionResult = db.exec(`
      SELECT r.id, r.therapist_id, r.redeemed_at, r.status, u.email as therapist_email
      FROM promo_redemptions r
      LEFT JOIN users u ON u.id = r.therapist_id
      WHERE r.promo_code_id = ?
      ORDER BY r.redeemed_at DESC
    `, [promoId]);

    const redemptions = (redemptionResult.length > 0 ? redemptionResult[0].values : []).map(r => ({
      id: r[0], therapist_id: r[1], redeemed_at: r[2], status: r[3], therapist_email: r[4]
    }));

    res.json({ promo, redemptions });
  } catch (error) {
    logger.error('Admin get promo error: ' + error.message);
    res.status(500).json({ error: 'Failed to get promo code details' });
  }
});

// PUT /api/admin/promos/:id/deactivate - Deactivate a promo code
router.put('/promos/:id/deactivate', (req, res) => {
  try {
    const db = getDatabase();
    const promoId = parseInt(req.params.id, 10);
    if (isNaN(promoId)) {
      return res.status(400).json({ error: 'Invalid promo code ID' });
    }

    const existing = db.exec('SELECT id, code, is_active FROM promo_codes WHERE id = ?', [promoId]);
    if (!existing.length || !existing[0].values.length) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    const promoCode = existing[0].values[0][1];
    const isActive = existing[0].values[0][2];

    if (!isActive) {
      return res.status(400).json({ error: 'Promo code is already deactivated' });
    }

    db.run('UPDATE promo_codes SET is_active = 0 WHERE id = ?', [promoId]);
    saveDatabaseAfterWrite();

    logger.info(`[Admin] Promo code deactivated: ${promoCode} by user ${req.user.id}`);

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at) VALUES (?, 'promo_code_deactivated', 'promo_code', ?, datetime('now'))",
      [req.user.id, promoId]
    );
    saveDatabaseAfterWrite();

    res.json({ message: 'Promo code deactivated successfully', promo_id: promoId, code: promoCode });
  } catch (error) {
    logger.error('Admin deactivate promo error: ' + error.message);
    res.status(500).json({ error: 'Failed to deactivate promo code' });
  }
});

// GET /api/admin/referrals - Referral analytics: list referrals, summary stats, top referrers
router.get('/referrals', (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 50, from, to } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Build date filter clause
    let dateFilter = '';
    const dateParams = [];
    if (from) {
      dateFilter += ' AND u.created_at >= ?';
      dateParams.push(from);
    }
    if (to) {
      dateFilter += ' AND u.created_at <= ?';
      dateParams.push(to + 'T23:59:59');
    }

    // 1. Get paginated referrals list
    const referralsResult = db.exec(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.created_at,
             ref.id AS referrer_id, ref.email AS referrer_email,
             ref.first_name AS referrer_first_name, ref.last_name AS referrer_last_name,
             COALESCE(s.plan, 'trial') AS current_plan
      FROM users u
      INNER JOIN users ref ON u.referred_by = ref.id
      LEFT JOIN subscriptions s ON s.therapist_id = u.id
      WHERE u.referred_by IS NOT NULL${dateFilter}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...dateParams, limitNum, offset]);

    const referrals = (referralsResult.length > 0 ? referralsResult[0].values : []).map(row => ({
      id: row[0],
      email: row[1],
      first_name: row[2] || '',
      last_name: row[3] || '',
      registered_at: row[4],
      referrer: {
        id: row[5],
        email: row[6],
        first_name: row[7] || '',
        last_name: row[8] || ''
      },
      current_plan: row[9]
    }));

    // 2. Total count for pagination
    const countResult = db.exec(`
      SELECT COUNT(*) FROM users u
      WHERE u.referred_by IS NOT NULL${dateFilter}
    `, dateParams);
    const totalReferrals = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    // 3. Referrals this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const thisMonthResult = db.exec(
      "SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL AND created_at >= ?",
      [monthStartStr]
    );
    const referralsThisMonth = thisMonthResult.length > 0 ? thisMonthResult[0].values[0][0] : 0;

    // 4. Conversion to paid (non-trial plans)
    const paidResult = db.exec(`
      SELECT COUNT(*) FROM users u
      INNER JOIN subscriptions s ON s.therapist_id = u.id
      WHERE u.referred_by IS NOT NULL AND s.plan != 'trial'${dateFilter}
    `, dateParams);
    const paidConversions = paidResult.length > 0 ? paidResult[0].values[0][0] : 0;

    // 5. Top referrers (top 10 by referral count)
    const topReferrersResult = db.exec(`
      SELECT ref.id, ref.email, ref.first_name, ref.last_name,
             COUNT(u.id) AS referral_count,
             SUM(CASE WHEN COALESCE(s.plan, 'trial') != 'trial' THEN 1 ELSE 0 END) AS paid_count
      FROM users u
      INNER JOIN users ref ON u.referred_by = ref.id
      LEFT JOIN subscriptions s ON s.therapist_id = u.id
      WHERE u.referred_by IS NOT NULL${dateFilter}
      GROUP BY ref.id
      ORDER BY referral_count DESC
      LIMIT 10
    `, dateParams);

    const topReferrers = (topReferrersResult.length > 0 ? topReferrersResult[0].values : []).map(row => ({
      id: row[0],
      email: row[1],
      first_name: row[2] || '',
      last_name: row[3] || '',
      referral_count: row[4],
      paid_count: row[5]
    }));

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at) VALUES (?, 'view_referral_analytics', 'system', NULL, datetime('now'))",
      [req.user.id]
    );
    saveDatabaseAfterWrite();

    res.json({
      referrals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalReferrals,
        total_pages: Math.ceil(totalReferrals / limitNum)
      },
      summary: {
        total_referrals: totalReferrals,
        referrals_this_month: referralsThisMonth,
        paid_conversions: paidConversions,
        conversion_rate: totalReferrals > 0 ? Math.round((paidConversions / totalReferrals) * 10000) / 100 : 0
      },
      top_referrers: topReferrers
    });
  } catch (error) {
    logger.error('Admin referral analytics error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch referral analytics' });
  }
});

module.exports = router;
