// Assistant Cached Answers Service
// Implements self-learning cache for the assistant chatbot.
// When a question is semantically similar to a previously answered one,
// returns the cached answer to save AI tokens.
//
// Feature #440 (S7) — canned FAQ seeder + audience/locale scoping.
//   - findCachedAnswer(question, audience, locale) filters by audience so a
//     'user'-only seed cannot leak to the anonymous public bot (mirrors S2).
//   - Seeded entries live in the same table with is_seed=1 so the admin
//     cached-answers view can render/edit/delete them without a redeploy.
//   - Locale gates on detected language so an English seed is not served
//     for a Russian question (fall through to LLM instead).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const { sanitizeOutput } = require('./assistantSanitizer');

// Import embedding utilities from assistantKnowledge
const {
  generateEmbedding,
  generateEmbeddingAsync,
  serializeEmbedding,
  deserializeEmbedding,
  cosineSimilarity,
  getEmbeddingType,
  isAIEmbeddingAvailable
} = require('./assistantKnowledge');

// Default similarity thresholds for cache hits.
// - TF-IDF (0.92): sparse hashed vectors, requires strong token overlap.
// - AI     (0.86): dense 1536-d embeddings distribute differently — same-intent
//                  paraphrases typically land ~0.86–0.95. 0.92 is too strict.
// The active threshold is picked at query time from the type of the QUERY's
// embedding (see findCachedAnswer). Rows of a different type are skipped
// entirely because their vector geometry is not comparable.
const DEFAULT_THRESHOLD = 0.92;
const DEFAULT_THRESHOLD_AI = 0.86;

// Path to the pre-seeded canned FAQ (docs/assistant-kb/faq-seed.json).
// Must resolve the project root the SAME way assistantKnowledge does: in the
// Docker image the repo is mounted at /app/project-root, not /app, so a plain
// __dirname-relative path silently misses the file and seeds 0 entries.
const _DOCKER_PROJECT_ROOT = '/app/project-root';
const _LOCAL_PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const _PROJECT_ROOT = fs.existsSync(path.join(_DOCKER_PROJECT_ROOT, 'src'))
  ? _DOCKER_PROJECT_ROOT
  : _LOCAL_PROJECT_ROOT;
const FAQ_SEED_PATH = path.join(_PROJECT_ROOT, 'docs', 'assistant-kb', 'faq-seed.json');

/**
 * Get the configured similarity threshold from platform settings.
 *
 * @param {'tfidf'|'ai'} [type='tfidf'] - Which threshold to fetch. AI cosine
 *   sim distributes differently from TF-IDF hashed-token overlap, so we keep
 *   two independent settings and pick by the active embedding type of the
 *   query. Falling back to the type-appropriate default protects the cache
 *   from a stale platform_settings row of the wrong type.
 * @returns {number} Threshold between 0 and 1
 */
function getThreshold(type) {
  const t = (type === 'ai') ? 'ai' : 'tfidf';
  const key = t === 'ai' ? 'assistant_cache_threshold_ai' : 'assistant_cache_threshold';
  const fallback = t === 'ai' ? DEFAULT_THRESHOLD_AI : DEFAULT_THRESHOLD;
  try {
    const db = getDatabase();
    const result = db.exec("SELECT value FROM platform_settings WHERE key = ?", [key]);
    if (result.length > 0 && result[0].values.length > 0) {
      const val = parseFloat(result[0].values[0][0]);
      if (val > 0 && val <= 1) return val;
    }
  } catch (e) {
    // Use default
  }
  return fallback;
}

/**
 * Search for a cached answer that matches the question, scoped by audience.
 *
 * Audience filter (mirrors S2 RAG audience gating):
 *   - 'public' request → only entries with audience='public' are searched.
 *   - 'user'   request → entries with audience IN ('public','user') are searched.
 *
 * Locale filter: when the caller passes a detected language, seeded entries
 * whose locale mismatches are skipped; non-seed (self-learned) entries are
 * not locale-gated (they were populated from real traffic).
 *
 * @param {string} questionText - The user's question
 * @param {'public'|'user'} [audience='public'] - Audience scope
 * @param {string} [locale] - Detected question language; when provided,
 *                            seed entries with a different locale are skipped.
 * @returns {{ hit: boolean, answer?: string, cached_id?: number, similarity?: number, is_seed?: boolean }}
 */
async function findCachedAnswer(questionText, audience, locale) {
  try {
    const aud = audience === 'user' ? 'user' : 'public';

    // Feature #441 (S8): embed the query with AI when available, TF-IDF
    // otherwise. The RETURNED type drives BOTH the threshold pick AND the
    // per-row skip: rows of a different embedding_type are silently skipped
    // because their vectors live in a different space and cosine similarity
    // between them is meaningless (dimension mismatch or geometric mismatch).
    const emb = await generateEmbeddingAsync(questionText);
    if (!emb || !emb.embedding) return { hit: false };
    const questionEmbedding = emb.embedding;
    const queryType = emb.type === 'ai' ? 'ai' : 'tfidf';

    const db = getDatabase();
    const threshold = getThreshold(queryType);

    // 'public' request → only public entries; 'user' request → both.
    const audienceFilter = aud === 'user'
      ? "(audience IN ('public','user') OR audience IS NULL)"
      : "(audience = 'public' OR audience IS NULL)";

    // has_rag_context=1 ensures we never serve a cache entry whose original
    // answer had no grounding (poisoning guard). Seeds always store 1.
    // embedding_type filter is applied post-fetch to be robust to NULL rows
    // written before the S8 migration (they default to 'tfidf').
    const allCached = db.exec(
      `SELECT id, question_embedding, answer_text, is_seed, locale, embedding_type
         FROM assistant_cached_answers
        WHERE has_rag_context = 1 AND ${audienceFilter}`
    );
    if (!allCached.length || !allCached[0].values) return { hit: false };

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const row of allCached[0].values) {
      const isSeed = !!row[3];
      const entryLocale = row[4];
      const rowType = (row[5] === 'ai') ? 'ai' : 'tfidf';
      // S8 type gate: never compare AI vs TF-IDF (different dimensions and
      // geometries — cosine is undefined between them). Skip cross-type rows.
      if (rowType !== queryType) continue;
      // Seed locale gate: skip when caller provided a locale and it does not
      // match. Non-seed entries fall through (populated from real traffic).
      if (isSeed && locale && entryLocale && entryLocale !== locale) continue;

      const cachedEmbedding = deserializeEmbedding(row[1]);
      if (!cachedEmbedding) continue;
      // Defense-in-depth: cosineSimilarity returns 0 on length mismatch, but
      // skip explicitly so we never treat a mismatched vector as a near-zero
      // false negative that displaces a real hit.
      if (cachedEmbedding.length !== questionEmbedding.length) continue;
      const similarity = cosineSimilarity(questionEmbedding, cachedEmbedding);

      // Curated seeds outrank real-traffic answers: prefer a seed whenever it
      // is within CURATION_MARGIN of the best score so far, so a stale/wrong
      // LLM-cached answer can never beat the reviewed seed for the same
      // question. Among same-kind entries, higher similarity wins.
      const CURATION_MARGIN = 0.05;
      let better;
      if (!bestMatch) {
        better = similarity > bestSimilarity;
      } else if (isSeed && !bestMatch.is_seed) {
        better = similarity >= bestSimilarity - CURATION_MARGIN;
      } else if (!isSeed && bestMatch.is_seed) {
        better = similarity > bestSimilarity + CURATION_MARGIN;
      } else {
        better = similarity > bestSimilarity;
      }
      if (better) {
        bestSimilarity = similarity;
        bestMatch = { id: row[0], answer: row[2], is_seed: isSeed };
      }
    }

    if (bestMatch && bestSimilarity >= threshold) {
      // Increment usage count
      db.run(
        "UPDATE assistant_cached_answers SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?",
        [bestMatch.id]
      );
      saveDatabaseAfterWrite();

      logger.info(`[AssistantCache] Cache hit (similarity: ${bestSimilarity.toFixed(3)}, id: ${bestMatch.id}, seed=${bestMatch.is_seed}, audience=${aud}, emb=${queryType})`);

      return {
        hit: true,
        answer: bestMatch.answer,
        cached_id: bestMatch.id,
        similarity: bestSimilarity,
        is_seed: bestMatch.is_seed
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
 * Only caches answers where RAG context was present to prevent cache poisoning.
 *
 * @param {string} questionText - The user's question
 * @param {string} answerText - The AI's answer
 * @param {boolean} hasRagContext - Whether RAG context was available for this answer
 * @param {{audience?: 'public'|'user', locale?: string}} [opts]
 * @returns {number|null} The ID of the cached entry, or null on error/skipped
 */
async function storeCachedAnswer(questionText, answerText, hasRagContext, opts) {
  // Prevent cache poisoning: only cache answers that had RAG context
  if (!hasRagContext) {
    logger.info('[AssistantCache] Skipping cache storage — no RAG context for this answer');
    return null;
  }

  const audience = (opts && opts.audience === 'user') ? 'user' : 'public';
  const locale = (opts && opts.locale) || 'en';

  try {
    // S8: embed with AI when available so future queries hit at the AI
    // threshold; TF-IDF fallback keeps behavior byte-identical to pre-S8 when
    // the API key is missing.
    const emb = await generateEmbeddingAsync(questionText);
    if (!emb || !emb.embedding) return null;
    const questionEmbedding = emb.embedding;
    const embType = emb.type === 'ai' ? 'ai' : 'tfidf';

    const serialized = serializeEmbedding(questionEmbedding, embType);
    const db = getDatabase();

    db.run(
      "INSERT INTO assistant_cached_answers (question_embedding, question_text, answer_text, usage_count, has_rag_context, audience, locale, is_seed, embedding_type, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))",
      [serialized, questionText, answerText, hasRagContext ? 1 : 0, audience, locale, embType]
    );

    const idResult = db.exec('SELECT last_insert_rowid()');
    const id = idResult[0].values[0][0];

    saveDatabaseAfterWrite();

    logger.info(`[AssistantCache] Stored new cached answer (id: ${id}, audience: ${audience}, emb: ${embType})`);
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
    "SELECT id, question_text, answer_text, usage_count, created_at, updated_at, has_rag_context, is_seed, audience, locale FROM assistant_cached_answers ORDER BY is_seed DESC, usage_count DESC, updated_at DESC LIMIT ? OFFSET ?",
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
        updated_at: row[5],
        has_rag_context: !!row[6],
        is_seed: !!row[7],
        audience: row[8] || 'public',
        locale: row[9] || 'en'
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

/**
 * Purge real-traffic (non-seed) cached answers, keeping curated seeds.
 * Called after a knowledge-base re-index: answers generated against the OLD
 * index are stale by definition (e.g. wrong pricing before a pricing fix), so
 * dropping them forces fresh answers from the current KB. Seeds are reviewed
 * content and are preserved.
 * @returns {number} rows removed
 */
function purgeNonSeedCache() {
  try {
    const db = getDatabase();
    const before = db.exec("SELECT COUNT(*) FROM assistant_cached_answers WHERE is_seed = 0 OR is_seed IS NULL");
    const count = (before.length && before[0].values.length) ? before[0].values[0][0] : 0;
    db.run("DELETE FROM assistant_cached_answers WHERE is_seed = 0 OR is_seed IS NULL");
    saveDatabaseAfterWrite();
    logger.info(`[AssistantCache] Purged ${count} non-seed cached answer(s) after re-index (seeds kept)`);
    return count;
  } catch (e) {
    logger.warn('[AssistantCache] Error purging non-seed cache: ' + e.message);
    return 0;
  }
}

/**
 * Compute a stable hash for a seed entry. Used as an idempotent upsert key so
 * a re-run of the seeder updates existing entries in place instead of
 * creating duplicates. Key derives from id + audience + locale + question so a
 * hand-edited answer_text does not create a phantom copy.
 */
function _seedHash(entry) {
  const key = `${entry.id}|${entry.audience}|${entry.locale}|${entry.question}`;
  return 'seed:' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
}

/**
 * Load the FAQ seed file and (idempotently) upsert each entry into
 * assistant_cached_answers.
 *
 *   - has_rag_context = 1 (so findCachedAnswer's poisoning guard permits it).
 *   - is_seed         = 1 (so the admin UI can flag it and the audit knows).
 *   - Embedding is computed AT SEED TIME so findCachedAnswer's cosine
 *     similarity path can match without an on-demand embed round-trip.
 *   - Answer is passed through sanitizeOutput before it hits the DB so no
 *     secret-shaped strings can be smuggled in via the JSON file.
 *   - Upsert-by-hash: repeated calls of seedCannedFaq() do NOT create duplicates.
 *
 * @param {string} [seedPath] - Override for the seed JSON path (used by tests).
 * @returns {{ loaded: number, inserted: number, updated: number, skipped: number, path: string }}
 */
async function seedCannedFaq(seedPath) {
  const p = seedPath || FAQ_SEED_PATH;
  // S8: reembedded counts re-embeds triggered by a type flip (e.g. seeded
  // under TF-IDF before an AI key was configured, then AI became available).
  const stats = { loaded: 0, inserted: 0, updated: 0, skipped: 0, reembedded: 0, path: p };
  const activeType = isAIEmbeddingAvailable() ? 'ai' : 'tfidf';

  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    logger.warn('[AssistantCache] FAQ seed file not found at ' + p + ' — skipping seed');
    return stats;
  }

  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (e) {
    logger.error('[AssistantCache] FAQ seed file is not valid JSON: ' + e.message);
    return stats;
  }
  if (!Array.isArray(entries)) {
    logger.error('[AssistantCache] FAQ seed file must be a JSON array');
    return stats;
  }

  const db = getDatabase();
  for (const entry of entries) {
    stats.loaded++;
    if (!entry || !entry.id || !entry.question || !entry.answer) {
      logger.warn('[AssistantCache] Skipping malformed seed entry: ' + JSON.stringify(entry).slice(0, 100));
      stats.skipped++;
      continue;
    }
    const audience = entry.audience === 'user' ? 'user' : 'public';
    const locale = entry.locale || 'en';
    const hash = _seedHash({ id: entry.id, audience, locale, question: entry.question });

    // Defensive: run answer text through sanitizeOutput at seed time so a
    // hand-authored JSON entry cannot inject a credential-shaped string.
    // (Audit assertion 16 stays green.)
    const safeAnswer = sanitizeOutput(String(entry.answer));

    // Idempotent upsert-by-hash: check first so we can skip the embed call
    // when a matching row already exists at the currently-active type. That
    // makes repeated seedCannedFaq() calls cheap (no API round-trips per seed).
    const existing = db.exec(
      'SELECT id, embedding_type FROM assistant_cached_answers WHERE question_hash = ?',
      [hash]
    );
    const hasExisting = existing.length > 0 && existing[0].values && existing[0].values.length > 0;
    const existingId = hasExisting ? existing[0].values[0][0] : null;
    const existingType = hasExisting ? (existing[0].values[0][1] === 'ai' ? 'ai' : 'tfidf') : null;

    // Re-embed only when there is no row yet OR when the stored type does
    // not match the active type (S8 "type flip" upgrade path). Otherwise
    // preserve the existing embedding to avoid an unnecessary API call.
    const needsReembed = !hasExisting || existingType !== activeType;

    let serialized = null;
    let embType = existingType;

    if (needsReembed) {
      let embedResult = null;
      try {
        embedResult = await generateEmbeddingAsync(entry.question);
      } catch (e) {
        logger.warn(`[AssistantCache] Failed to embed seed "${entry.id}": ${e.message}`);
      }
      if (!embedResult || !embedResult.embedding) {
        stats.skipped++;
        continue;
      }
      embType = embedResult.type === 'ai' ? 'ai' : 'tfidf';
      serialized = serializeEmbedding(embedResult.embedding, embType);
      if (hasExisting) stats.reembedded++;
    }

    if (hasExisting) {
      if (needsReembed) {
        db.run(
          `UPDATE assistant_cached_answers
              SET question_embedding = ?,
                  question_text      = ?,
                  answer_text        = ?,
                  has_rag_context    = 1,
                  audience           = ?,
                  locale             = ?,
                  is_seed            = 1,
                  embedding_type     = ?,
                  updated_at         = datetime('now')
            WHERE id = ?`,
          [serialized, entry.question, safeAnswer, audience, locale, embType, existingId]
        );
      } else {
        // Preserve existing embedding; just refresh text fields.
        db.run(
          `UPDATE assistant_cached_answers
              SET question_text = ?,
                  answer_text   = ?,
                  has_rag_context = 1,
                  audience      = ?,
                  locale        = ?,
                  is_seed       = 1,
                  updated_at    = datetime('now')
            WHERE id = ?`,
          [entry.question, safeAnswer, audience, locale, existingId]
        );
      }
      stats.updated++;
    } else {
      db.run(
        `INSERT INTO assistant_cached_answers
           (question_embedding, question_text, answer_text, usage_count,
            has_rag_context, audience, locale, is_seed, question_hash,
            embedding_type, created_at, updated_at)
         VALUES (?, ?, ?, 0, 1, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
        [serialized, entry.question, safeAnswer, audience, locale, hash, embType]
      );
      stats.inserted++;
    }
  }

  saveDatabaseAfterWrite();
  logger.info(`[AssistantCache] Seeded canned FAQ: loaded=${stats.loaded} inserted=${stats.inserted} updated=${stats.updated} skipped=${stats.skipped} reembedded=${stats.reembedded} activeType=${activeType}`);
  return stats;
}

module.exports = {
  findCachedAnswer,
  storeCachedAnswer,
  getCachedAnswers,
  updateCachedAnswer,
  deleteCachedAnswer,
  purgeNonSeedCache,
  getThreshold,
  seedCannedFaq,
  FAQ_SEED_PATH,
  DEFAULT_THRESHOLD,
  DEFAULT_THRESHOLD_AI
};
