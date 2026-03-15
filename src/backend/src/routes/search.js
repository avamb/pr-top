// Search Routes - Semantic search across client history using vector embeddings
const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getDatabase, saveDatabase } = require('../db/connection');
const { semanticSearch, getEmbedding, getStats } = require('../services/vectorStore');
const { logger } = require('../utils/logger');
const { verifyClientConsent } = require('../utils/consentCheck');

// All search routes require authentication
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

// POST /api/search - Semantic search across embedded client data
router.post('/', (req, res) => {
  try {
    const { query, client_id, source_type, limit } = req.body;
    const therapistId = req.user.id;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'query text is required' });
    }

    if (query.trim().length > 1000) {
      return res.status(400).json({ error: 'Query too long (max 1000 characters)' });
    }

    // Build search options
    const options = {
      therapist_id: req.user.role === 'superadmin' ? undefined : therapistId,
      limit: Math.min(limit || 10, 50)
    };

    if (client_id) {
      // Verify client belongs to therapist
      const db = getDatabase();
      const clientCheck = db.exec(
        "SELECT id FROM users WHERE id = ? AND therapist_id = ? AND role = 'client' AND consent_therapist_access = 1",
        [client_id, therapistId]
      );

      if (req.user.role !== 'superadmin' && (clientCheck.length === 0 || clientCheck[0].values.length === 0)) {
        return res.status(403).json({ error: 'Client not found or not linked to you' });
      }

      options.client_id = client_id;
    }

    if (source_type) {
      if (!['session_transcript', 'session_summary', 'diary_entry'].includes(source_type)) {
        return res.status(400).json({ error: 'Invalid source_type. Must be: session_transcript, session_summary, or diary_entry' });
      }
      options.source_type = source_type;
    }

    const result = semanticSearch(query.trim(), options);

    // Audit log
    try {
      const db = getDatabase();
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, created_at)
         VALUES (?, 'semantic_search', 'search', ?, datetime('now'))`,
        [therapistId, client_id || 0]
      );
      saveDatabase();
    } catch (auditErr) {
      logger.warn('Failed to audit log semantic search: ' + auditErr.message);
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Semantic search error: ' + error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/search/embedding/:sourceType/:sourceId - Check if a specific source has an embedding
router.get('/embedding/:sourceType/:sourceId', (req, res) => {
  try {
    const { sourceType, sourceId } = req.params;

    if (!['session_transcript', 'session_summary', 'diary_entry'].includes(sourceType)) {
      return res.status(400).json({ error: 'Invalid source type' });
    }

    const embedding = getEmbedding(sourceType, parseInt(sourceId));

    if (!embedding) {
      return res.status(404).json({ error: 'No embedding found for this source' });
    }

    // Verify therapist has access
    if (req.user.role !== 'superadmin' && embedding.therapist_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify client consent based on source type
    if (req.user.role !== 'superadmin') {
      const db = getDatabase();
      let clientId = null;

      if (sourceType === 'diary_entry') {
        const diaryResult = db.exec('SELECT client_id FROM diary_entries WHERE id = ?', [parseInt(sourceId)]);
        if (diaryResult.length > 0 && diaryResult[0].values.length > 0) {
          clientId = diaryResult[0].values[0][0];
        }
      } else if (sourceType === 'session_transcript' || sourceType === 'session_summary') {
        const sessionResult = db.exec('SELECT client_id FROM sessions WHERE id = ?', [parseInt(sourceId)]);
        if (sessionResult.length > 0 && sessionResult[0].values.length > 0) {
          clientId = sessionResult[0].values[0][0];
        }
      }

      if (clientId) {
        const consentCheck = verifyClientConsent(req.user.id, clientId, 'embedding_view');
        if (!consentCheck.allowed) {
          return res.status(consentCheck.status).json({ error: consentCheck.error });
        }
      }
    }

    res.json({ success: true, embedding });
  } catch (error) {
    logger.error('Get embedding error: ' + error.message);
    res.status(500).json({ error: 'Failed to get embedding info' });
  }
});

// GET /api/search/stats - Get vector store statistics
router.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    logger.error('Vector stats error: ' + error.message);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
