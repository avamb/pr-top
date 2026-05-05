// Settings Routes - Therapist profile settings and escalation preferences
const express = require('express');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { authenticate, requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../services/encryption');
// T-08: Modality-specific summarization presets and validation helpers.
const summaryPresets = require('../services/ai/summary-presets');

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
  escalation_delay_minutes: 0,
  forward_voice_to_telegram: false
};

// GET /api/settings/profile - Get current user profile settings
router.get('/profile', authenticate, (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(
      'SELECT id, email, role, language, timezone, created_at, escalation_preferences, first_name, last_name, phone, telegram_username, other_info, reminders_enabled_default FROM users WHERE id = ?',
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
        escalation_preferences: escalationPrefs,
        first_name: user[7] || '',
        last_name: user[8] || '',
        phone: user[9] || '',
        telegram_username: user[10] || '',
        other_info: user[11] || '',
        // T-16: Optional reminders toggle (per-therapist default).
        // Stored as INTEGER 0/1; expose to clients as a boolean.
        reminders_enabled_default: user[12] === 1 || user[12] === true
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
    const { language, timezone, first_name, last_name, phone, telegram_username, other_info, reminders_enabled_default } = req.body;
    const db = getDatabase();

    // Validate language
    const validLanguages = ['en', 'ru', 'es', 'uk'];
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

    // Validate phone (allow flexible format: digits, spaces, dashes, plus, parens)
    if (phone !== undefined && phone !== '' && !/^[+\d\s\-().]{5,20}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    // Validate first_name and last_name length
    if (first_name !== undefined && first_name.length > 100) {
      return res.status(400).json({ error: 'First name too long (max 100 characters)' });
    }
    if (last_name !== undefined && last_name.length > 100) {
      return res.status(400).json({ error: 'Last name too long (max 100 characters)' });
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
    if (first_name !== undefined) {
      updates.push('first_name = ?');
      params.push(first_name.trim());
    }
    if (last_name !== undefined) {
      updates.push('last_name = ?');
      params.push(last_name.trim());
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone.trim());
    }
    if (telegram_username !== undefined) {
      // Auto-strip @ prefix
      updates.push('telegram_username = ?');
      params.push(telegram_username.replace(/^@/, '').trim());
    }
    if (other_info !== undefined) {
      if (typeof other_info === 'string' && other_info.length > 1000) {
        return res.status(400).json({ error: 'Other info too long (max 1000 characters)' });
      }
      updates.push('other_info = ?');
      params.push(typeof other_info === 'string' ? other_info.trim() : '');
    }

    // T-16: Optional reminders default (boolean) — only meaningful for therapists,
    // but we accept and persist for any role since the column lives on users.
    if (reminders_enabled_default !== undefined) {
      if (typeof reminders_enabled_default !== 'boolean'
          && reminders_enabled_default !== 0 && reminders_enabled_default !== 1) {
        return res.status(400).json({ error: 'reminders_enabled_default must be a boolean' });
      }
      updates.push('reminders_enabled_default = ?');
      params.push(reminders_enabled_default ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.user.id);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.run(sql, params);
    saveDatabaseAfterWrite();

    // Return updated profile
    const result = db.exec(
      'SELECT id, email, role, language, timezone, created_at, escalation_preferences, first_name, last_name, phone, telegram_username, other_info, reminders_enabled_default FROM users WHERE id = ?',
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
        escalation_preferences: escalationPrefs,
        first_name: user[7] || '',
        last_name: user[8] || '',
        phone: user[9] || '',
        telegram_username: user[10] || '',
        other_info: user[11] || '',
        reminders_enabled_default: user[12] === 1 || user[12] === true
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
    saveDatabaseAfterWrite();

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

// =====================================================================
// T-08: Custom summary prompts per modality
// =====================================================================
//
// Therapists configure which modality preset (psychoanalysis / cbt / nlp /
// gestalt / generic) drives their AI session summaries, and optionally
// supply a custom prompt to fine-tune it. The custom prompt is Class A
// (encrypted at app layer) — it can contain therapist working notes /
// IP. Specialization itself is Class B (plaintext metadata).

// GET /api/settings/summary - Therapist-only.
// Returns: { summary: { specialization, custom_prompt, custom_prompt_mode },
//            presets: [{id, description}] }
router.get('/summary', authenticate, (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(
      'SELECT summary_specialization, custom_summary_prompt_encrypted, custom_summary_prompt_mode FROM users WHERE id = ?',
      [req.user.id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [spec, customEnc, customMode] = result[0].values[0];

    let customPrompt = '';
    if (customEnc) {
      try {
        customPrompt = decrypt(customEnc);
      } catch (e) {
        logger.warn(`Could not decrypt custom_summary_prompt for user ${req.user.id}: ${e.message}`);
        customPrompt = '';
      }
    }

    res.json({
      summary: {
        specialization: spec || summaryPresets.DEFAULT_SPECIALIZATION,
        custom_prompt: customPrompt,
        custom_prompt_mode: customMode === 'replace' ? 'replace' : 'append'
      },
      presets: summaryPresets.listPresets(),
      max_custom_prompt_length: summaryPresets.CUSTOM_PROMPT_MAX_LENGTH
    });
  } catch (error) {
    logger.error('Get summary settings error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch summary settings' });
  }
});

// PATCH /api/settings/summary - Therapist-only.
// Body: { specialization?, custom_prompt?, custom_prompt_mode? }
// - specialization must be one of psychoanalysis|cbt|nlp|gestalt|generic
// - custom_prompt: string, 0..2000 chars; empty string clears the column
// - custom_prompt_mode: 'append' | 'replace'
router.patch('/summary', authenticate, (req, res) => {
  try {
    const { specialization, custom_prompt, custom_prompt_mode } = req.body || {};
    const db = getDatabase();

    const updates = [];
    const params = [];

    if (specialization !== undefined) {
      if (!summaryPresets.isValidSpecialization(specialization)) {
        return res.status(400).json({
          error: `Invalid specialization. Must be one of: ${summaryPresets.VALID_SPECIALIZATIONS.join(', ')}`
        });
      }
      updates.push('summary_specialization = ?');
      params.push(specialization);
    }

    if (custom_prompt_mode !== undefined) {
      if (custom_prompt_mode !== 'append' && custom_prompt_mode !== 'replace') {
        return res.status(400).json({ error: "custom_prompt_mode must be 'append' or 'replace'" });
      }
      updates.push('custom_summary_prompt_mode = ?');
      params.push(custom_prompt_mode);
    }

    if (custom_prompt !== undefined) {
      if (typeof custom_prompt !== 'string') {
        return res.status(400).json({ error: 'custom_prompt must be a string' });
      }
      const trimmed = custom_prompt.trim();
      if (trimmed.length > summaryPresets.CUSTOM_PROMPT_MAX_LENGTH) {
        return res.status(400).json({
          error: `custom_prompt too long (max ${summaryPresets.CUSTOM_PROMPT_MAX_LENGTH} characters)`
        });
      }

      if (trimmed.length === 0) {
        // Clear the column entirely.
        updates.push('custom_summary_prompt_encrypted = NULL');
        updates.push('custom_summary_prompt_key_id = NULL');
        updates.push('custom_summary_prompt_payload_version = NULL');
      } else {
        const { encrypted, keyVersion, keyId } = encrypt(trimmed);
        updates.push('custom_summary_prompt_encrypted = ?');
        params.push(encrypted);
        updates.push('custom_summary_prompt_key_id = ?');
        params.push(keyId);
        updates.push('custom_summary_prompt_payload_version = ?');
        params.push(keyVersion);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.user.id);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.run(sql, params);
    saveDatabaseAfterWrite();

    // Return the freshly-saved settings (decrypted) so the UI can confirm.
    const result = db.exec(
      'SELECT summary_specialization, custom_summary_prompt_encrypted, custom_summary_prompt_mode FROM users WHERE id = ?',
      [req.user.id]
    );
    const [spec, customEnc, customMode] = result[0].values[0];
    let customPrompt = '';
    if (customEnc) {
      try { customPrompt = decrypt(customEnc); } catch (e) { customPrompt = ''; }
    }

    logger.info(`Summary settings updated for user id=${req.user.id}: specialization=${spec}, custom_len=${customPrompt.length}, mode=${customMode}`);

    res.json({
      message: 'Summary settings updated successfully',
      summary: {
        specialization: spec || summaryPresets.DEFAULT_SPECIALIZATION,
        custom_prompt: customPrompt,
        custom_prompt_mode: customMode === 'replace' ? 'replace' : 'append'
      }
    });
  } catch (error) {
    logger.error('Update summary settings error: ' + error.message);
    res.status(500).json({ error: 'Failed to update summary settings' });
  }
});

module.exports = router;
