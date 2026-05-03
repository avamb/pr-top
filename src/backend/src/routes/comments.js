// Comments Routes - polymorphic dual-comment (private + shared) API
// Implements T-10. Operates on the polymorphic `comments` table:
//   - GET    /api/comments?entity_type=&entity_id=    list visible comments
//   - POST   /api/comments                            create a new comment
//   - PATCH  /api/comments/:id                        update content / visibility
//   - DELETE /api/comments/:id                        delete a comment (author / superadmin)
//
// The actual visibility / authorization logic lives in services/comments.js.

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const commentsService = require('../services/comments');

const router = express.Router();

// All comment routes require authentication. Both therapists and clients may
// reach these endpoints (clients use the bot, but the bot proxies through the
// REST API on behalf of the client user).
router.use(authenticate);

// GET /api/comments?entity_type=session&entity_id=42
//   Returns the list of comments visible to the authenticated user for that
//   entity, ordered by created_at ASC.
router.get('/', (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) {
      return res
        .status(400)
        .json({ error: 'entity_type and entity_id query params are required' });
    }
    const result = commentsService.listForEntity(req.user, entity_type, entity_id);
    if (!result.allowed) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ comments: result.comments, total: result.comments.length });
  } catch (err) {
    logger.error('Comments list error: ' + err.message);
    return res.status(500).json({ error: 'Failed to list comments' });
  }
});

// POST /api/comments
//   { entity_type, entity_id, content, visibility? }
//   Default visibility: therapist -> private, client -> shared.
router.post('/', (req, res) => {
  try {
    const { entity_type, entity_id, content, visibility } = req.body || {};
    if (!entity_type || !entity_id) {
      return res
        .status(400)
        .json({ error: 'entity_type and entity_id are required' });
    }
    const result = commentsService.createComment(req.user, {
      entity_type,
      entity_id,
      content,
      visibility,
    });
    if (!result.allowed) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(201).json(result.comment);
  } catch (err) {
    logger.error('Comments create error: ' + err.message);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PATCH /api/comments/:id
//   Body may contain { content, visibility }. Only the author (or a superadmin)
//   may modify a comment.
router.patch('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid comment id' });
    }
    const result = commentsService.patchComment(req.user, id, req.body || {});
    if (!result.allowed) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result.comment);
  } catch (err) {
    logger.error('Comments patch error: ' + err.message);
    return res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /api/comments/:id
//   Only the author (or a superadmin) may delete.
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid comment id' });
    }
    const result = commentsService.deleteComment(req.user, id);
    if (!result.allowed) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error('Comments delete error: ' + err.message);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
