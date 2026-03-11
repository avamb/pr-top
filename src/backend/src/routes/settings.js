// Settings Routes - Therapist profile settings and escalation preferences
const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { authenticate, requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Default escalation preferences
const DEFAULT_ESCALATION_PREFS = {
  sos_telegram: true,
  sos_email: true,
  sos_web_push: true,
  sos_sound_alert: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  escalation_delay_minutes: 0
};

// GET /api/settings/profile - Get current user profile settings
router.get('/profile', authenticate, (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(
      'SELECT id, email, role, language, timezone, created_at, escalation_preferences FROM users WHERE id = ?',
      [req.user.id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result[0].values[0];
    let escalationPrefs = DEFAULT_ESCALATION_PREFS;
    try {
      if (user[6]) {
        escalationPrefs = { ...DEFAULT_ESCALATION_PREFS, ...JSON.parse(user[6]) };
      }
    } catch (e) {
      logger.warn('Failed to parse escalation_preferences for user ' + req.user.id);
    }

    res.json({
      profile: {
        id: user[0],
        email: user[1],
        role: user[2],
        language: user[3] || 'en',
        timezone: user[4] || 'UTC',
        created_at: user[5],
        escalation_preferences: escalationPrefs
      }
    });
  } catch (error) {
    logger.error('Get profile error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/settings/profile - Update user profile settings
router.put('/profile', authenticate, (req, res) => {
  try {
    const { language, timezone } = req.body;
    const db = getDatabase();

    // Validate language
    const validLanguages = ['en', 'ru', 'es'];
    if (language && !validLanguages.includes(language)) {
      return res.status(400).json({ error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` });
    }

    // Validate timezone (basic validation)
    if (timezone && typeof timezone !== 'string') {
      return res.status(400).json({ error: 'Invalid timezone format' });
    }
    if (timezone && timezone.length > 100) {
      return res.status(400).json({ error: 'Timezone value too long' });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];

    if (language) {
      updates.push('language = ?');
      params.push(language);
    }
    if (timezone) {
      updates.push('timezone = ?');
      params.push(timezone);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.user.id);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.run(sql, params);
    saveDatabase();

    // Return updated profile
    const result = db.exec(
      'SELECT id, email, role, language, timezone, created_at, escalation_preferences FROM users WHERE id = ?',
      [req.user.id]
    );

    const user = result[0].values[0];
    let escalationPrefs = DEFAULT_ESCALATION_PREFS;
    try {
      if (user[6]) {
        escalationPrefs = { ...DEFAULT_ESCALATION_PREFS, ...JSON.parse(user[6]) };
      }
    } catch (e) {}

    logger.info(`Profile updated for user id=${req.user.id}: language=${language || 'unchanged'}, timezone=${timezone || 'unchanged'}`);

    res.json({
      message: 'Profile updated successfully',
      profile: {
        id: user[0],
        email: user[1],
        role: user[2],
        language: user[3] || 'en',
        timezone: user[4] || 'UTC',
        created_at: user[5],
        escalation_preferences: escalationPrefs
      }
    });
  } catch (error) {
    logger.error('Update profile error: ' + error.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/settings/escalation - Get escalation preferences
router.get('/escalation', authenticate, (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(
      'SELECT escalation_preferences FROM users WHERE id = ?',
      [req.user.id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let prefs = DEFAULT_ESCALATION_PREFS;
    try {
      const stored = result[0].values[0][0];
      if (stored) {
        prefs = { ...DEFAULT_ESCALATION_PREFS, ...JSON.parse(stored) };
      }
    } catch (e) {
      logger.warn('Failed to parse escalation preferences');
    }

    res.json({ escalation_preferences: prefs });
  } catch (error) {
    logger.error('Get escalation prefs error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch escalation preferences' });
  }
});

// PUT /api/settings/escalation - Update escalation preferences
router.put('/escalation', authenticate, (req, res) => {
  try {
    const { escalation_preferences } = req.body;
    if (!escalation_preferences || typeof escalation_preferences !== 'object') {
      return res.status(400).json({ error: 'escalation_preferences object required' });
    }

    const db = getDatabase();

    // Validate preference fields
    const validKeys = Object.keys(DEFAULT_ESCALATION_PREFS);
    const sanitized = {};
    for (const key of validKeys) {
      if (key in escalation_preferences) {
        sanitized[key] = escalation_preferences[key];
      }
    }

    // Validate quiet hours format
    if (sanitized.quiet_hours_start && !/^\d{2}:\d{2}$/.test(sanitized.quiet_hours_start)) {
      return res.status(400).json({ error: 'Invalid quiet_hours_start format. Use HH:MM' });
    }
    if (sanitized.quiet_hours_end && !/^\d{2}:\d{2}$/.test(sanitized.quiet_hours_end)) {
      return res.status(400).json({ error: 'Invalid quiet_hours_end format. Use HH:MM' });
    }
    if (sanitized.escalation_delay_minutes !== undefined) {
      const delay = Number(sanitized.escalation_delay_minutes);
      if (isNaN(delay) || delay < 0 || delay > 60) {
        return res.status(400).json({ error: 'escalation_delay_minutes must be 0-60' });
      }
      sanitized.escalation_delay_minutes = delay;
    }

    // Merge with existing preferences
    const existingResult = db.exec('SELECT escalation_preferences FROM users WHERE id = ?', [req.user.id]);
    let existing = {};
    try {
      if (existingResult.length > 0 && existingResult[0].values[0][0]) {
        existing = JSON.parse(existingResult[0].values[0][0]);
      }
    } catch (e) {}

    const merged = { ...DEFAULT_ESCALATION_PREFS, ...existing, ...sanitized };
    const prefsJson = JSON.stringify(merged);

    db.run(
      "UPDATE users SET escalation_preferences = ?, updated_at = datetime('now') WHERE id = ?",
      [prefsJson, req.user.id]
    );
    saveDatabase();

    logger.info(`Escalation preferences updated for user id=${req.user.id}: ${prefsJson}`);

    res.json({
      message: 'Escalation preferences updated successfully',
      escalation_preferences: merged
    });
  } catch (error) {
    logger.error('Update escalation prefs error: ' + error.message);
    res.status(500).json({ error: 'Failed to update escalation preferences' });
  }
});

module.exports = router;
