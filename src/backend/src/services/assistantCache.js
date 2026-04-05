// Assistant Cached Answers Service
// Implements self-learning cache for the assistant chatbot.
// When a question is semantically similar to a previously answered one,
// returns the cached answer to save AI tokens.

const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');

// Import embedding utilities from assistantKnowledge
const {
  generateEmbedding,
  serializeEmbedding,
  deserializeEmbedding,
  cosineSimilarity
} = require('./assistantKnowledge');

// Default similarity threshold for cache hits
const DEFAULT_THRESHOLD = 0.92;

/**
 * Get the configured similarity threshold from platform settings.
 * @returns {number} Threshold between 0 and 1
 */
function getThreshold() {
  try {
    const db = getDatabase();
    const result = db.exec("SELECT value FROM platform_settings WHERE key = 'assistant_cache_threshold'");
    if (result.length > 0 && result[0].values.length > 0) {
      const val = parseFloat(result[0].values[0][0]);
      if (val > 0 && val <= 1) return val;
    }
  } catch (e) {
    // Use default
  }
  return DEFAULT_THRESHOLD;
}

/**
 * Search for a cached answer that matches the question.
 *
 * @param {string} questionText - The user's question
 * @returns {{ hit: boolean, answer?: string, cached_id?: number, similarity?: number }}
 */
function findCachedAnswer(questionText) {
  try {
    const questionEmbedding = generateEmbedding(questionText);
    if (!questionEmbedding) return { hit: false };

    const db = getDatabase();
    const threshold = getThreshold();

    const allCached = db.exec("SELECT id, question_embedding, answer_text FROM assistant_cached_answers");
    if (!allCached.length || !allCached[0].values) return { hit: false };

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const row of allCached[0].values) {
      const cachedEmbedding = deserializeEmbedding(row[1]);
      const similarity = cosineSimilarity(questionEmbedding, cachedEmbedding);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { id: row[0], answer: row[2] };
      }
    }

    if (bestMatch && bestSimilarity >= threshold) {
      // Increment usage count
      db.run(
        "UPDATE assistant_cached_answers SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?",
        [bestMatch.id]
      );
      saveDatabaseAfterWrite();

      logger.info(`[AssistantCache] Cache hit for question (similarity: ${bestSimilarity.toFixed(3)}, id: ${bestMatch.id})`);

      return {
        hit: true,
        answer: bestMatch.answer,
        cached_id: bestMatch.id,
        similarity: bestSimilarity
      };
    }

    return { hit: false };
  } catch (e) {
    logger.warn('[AssistantCache] Error searching cache: ' + e.message);
    return { hit: false };
  }
}

/**
 * Store a Q&A pair in the cache for future use.
 *
 * @param {string} questionText - The user's question
 * @param {string} answerText - The AI's answer
 * @returns {number|null} The ID of the cached entry, or null on error
 */
function storeCachedAnswer(questionText, answerText) {
  try {
    const questionEmbedding = generateEmbedding(questionText);
    if (!questionEmbedding) return null;

    const serialized = serializeEmbedding(questionEmbedding);
    const db = getDatabase();

    db.run(
      "INSERT INTO assistant_cached_answers (question_embedding, question_text, answer_text, usage_count, created_at, updated_at) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))",
      [serialized, questionText, answerText]
    );

    const idResult = db.exec('SELECT last_insert_rowid()');
    const id = idResult[0].values[0][0];

    saveDatabaseAfterWrite();

    logger.info(`[AssistantCache] Stored new cached answer (id: ${id})`);
    return id;
  } catch (e) {
    logger.warn('[AssistantCache] Error storing cache: ' + e.message);
    return null;
  }
}

/**
 * Get all cached answers (paginated) for admin view.
 *
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {{ items: Array, total: number, page: number, pages: number }}
 */
function getCachedAnswers(page, limit) {
  page = page || 1;
  limit = limit || 20;
  const offset = (page - 1) * limit;

  const db = getDatabase();

  const countResult = db.exec("SELECT COUNT(*) FROM assistant_cached_answers");
  const total = (countResult.length > 0 && countResult[0].values.length > 0) ? countResult[0].values[0][0] : 0;

  const result = db.exec(
    "SELECT id, question_text, answer_text, usage_count, created_at, updated_at FROM assistant_cached_answers ORDER BY usage_count DESC, updated_at DESC LIMIT ? OFFSET ?",
    [limit, offset]
  );

  const items = [];
  if (result.length > 0 && result[0].values) {
    for (const row of result[0].values) {
      items.push({
        id: row[0],
        question_text: row[1],
        answer_text: row[2],
        usage_count: row[3],
        created_at: row[4],
        updated_at: row[5]
      });
    }
  }

  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

/**
 * Update a cached answer's text.
 *
 * @param {number} id - Cached answer ID
 * @param {string} answerText - New answer text
 * @returns {boolean} Success
 */
function updateCachedAnswer(id, answerText) {
  try {
    const db = getDatabase();
    db.run(
      "UPDATE assistant_cached_answers SET answer_text = ?, updated_at = datetime('now') WHERE id = ?",
      [answerText, id]
    );
    saveDatabaseAfterWrite();
    return true;
  } catch (e) {
    logger.warn('[AssistantCache] Error updating cache: ' + e.message);
    return false;
  }
}

/**
 * Delete a cached answer.
 *
 * @param {number} id - Cached answer ID
 * @returns {boolean} Success
 */
function deleteCachedAnswer(id) {
  try {
    const db = getDatabase();
    db.run("DELETE FROM assistant_cached_answers WHERE id = ?", [id]);
    saveDatabaseAfterWrite();
    return true;
  } catch (e) {
    logger.warn('[AssistantCache] Error deleting cache: ' + e.message);
    return false;
  }
}

module.exports = {
  findCachedAnswer,
  storeCachedAnswer,
  getCachedAnswers,
  updateCachedAnswer,
  deleteCachedAnswer,
  getThreshold,
  DEFAULT_THRESHOLD
};
