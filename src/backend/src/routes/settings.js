// Settings Routes - Therapist profile settings
const express = require('express');
const { getDatabase, saveDatabase } = require('../db/connection');
const { authenticate, requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// GET /api/settings/profile - Get current user profile settings
router.get('/profile', authenticate, (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(
      'SELECT id, email, role, language, timezone, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result[0].values[0];
    res.json({
      profile: {
        id: user[0],
        email: user[1],
        role: user[2],
        language: user[3] || 'en',
        timezone: user[4] || 'UTC',
        created_at: user[5]
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
      'SELECT id, email, role, language, timezone, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    const user = result[0].values[0];
    logger.info(`Profile updated for user id=${req.user.id}: language=${language || 'unchanged'}, timezone=${timezone || 'unchanged'}`);

    res.json({
      message: 'Profile updated successfully',
      profile: {
        id: user[0],
        email: user[1],
        role: user[2],
        language: user[3] || 'en',
        timezone: user[4] || 'UTC',
        created_at: user[5]
      }
    });
  } catch (error) {
    logger.error('Update profile error: ' + error.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
