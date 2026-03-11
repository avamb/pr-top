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

module.exports = router;
