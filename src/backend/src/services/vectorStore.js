// Vector Store Service
// Generates TF-IDF-style embeddings and stores them for semantic search.
// In dev mode: uses local TF-IDF vectors stored in SQLite.
// In production: would integrate with a real vector DB (Pinecone, Weaviate, Qdrant, etc.).

const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { decrypt } = require('./encryption');
const { logger } = require('../utils/logger');

// Vocabulary built from therapy-domain terms for consistent dimensionality
// Each document's embedding is a sparse vector over this vocabulary
const VOCAB_SIZE = 256;

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'because', 'but', 'and', 'or', 'if', 'while', 'that', 'this', 'these',
  'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
  'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what',
  'which', 'who', 'whom'
]);

/**
 * Tokenize and normalize text into meaningful word tokens.
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0400-\u04FF]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Hash a token to a bucket index (0..VOCAB_SIZE-1).
 * Uses FNV-1a hash for fast, decent distribution.
 */
function hashToken(token) {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned
  }
  return hash % VOCAB_SIZE;
}

/**
 * Generate a TF-IDF-style embedding vector from text.
 * Returns a Float64Array of VOCAB_SIZE dimensions.
 */
function generateEmbedding(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  // Term frequency (hashed to buckets)
  const tf = new Float64Array(VOCAB_SIZE);
  const tokenBuckets = new Map(); // track which tokens map to which bucket

  for (const token of tokens) {
    const bucket = hashToken(token);
    tf[bucket] += 1;
    if (!tokenBuckets.has(bucket)) tokenBuckets.set(bucket, new Set());
    tokenBuckets.get(bucket).add(token);
  }

  // Normalize by document length (sub-linear TF: 1 + log(tf))
  for (let i = 0; i < VOCAB_SIZE; i++) {
    if (tf[i] > 0) {
      tf[i] = 1 + Math.log(tf[i]);
    }
  }

  // L2 normalize the vector
  let norm = 0;
  for (let i = 0; i < VOCAB_SIZE; i++) {
    norm += tf[i] * tf[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VOCAB_SIZE; i++) {
      tf[i] /= norm;
    }
  }

  return tf;
}

/**
 * Compute cosine similarity between two embedding vectors.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot; // Already L2-normalized, so dot product = cosine similarity
}

/**
 * Serialize an embedding vector to a compact string for DB storage.
 * Only stores non-zero values as index:value pairs.
 */
function serializeEmbedding(embedding) {
  if (!embedding) return null;
  const parts = [];
  for (let i = 0; i < embedding.length; i++) {
    if (embedding[i] !== 0) {
      parts.push(`${i}:${embedding[i].toFixed(6)}`);
    }
  }
  return parts.join(',');
}

/**
 * Deserialize an embedding string back to a Float64Array.
 */
function deserializeEmbedding(str) {
  if (!str) return null;
  const embedding = new Float64Array(VOCAB_SIZE);
  const parts = str.split(',');
  for (const part of parts) {
    const [idx, val] = part.split(':');
    embedding[parseInt(idx)] = parseFloat(val);
  }
  return embedding;
}

/**
 * Ensure the vector_embeddings table exists.
 *
 * T-09: client_id is now NULL-able so we can store therapist-scoped
 * knowledge-base chunks (source_type='kb') that are not tied to any client.
 * The CHECK constraint on source_type was dropped — the application enforces
 * the enum so adding a new source_type ('kb', future 'exercise', etc.)
 * doesn't require a destructive table rebuild.
 */
function ensureTable() {
  const db = getDatabase();
  db.run(`
    CREATE TABLE IF NOT EXISTS vector_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      client_id INTEGER,
      therapist_id INTEGER,
      embedding TEXT NOT NULL,
      text_preview TEXT,
      token_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source_type, source_id)
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_vector_embeddings_source ON vector_embeddings(source_type, source_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_vector_embeddings_client ON vector_embeddings(client_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_vector_embeddings_therapist ON vector_embeddings(therapist_id)');

  // T-09 migration: legacy CREATE TABLE had a CHECK(source_type IN (...))
  // constraint that excluded 'kb'. If we detect that constraint, rebuild the
  // table without it. SQLite has no ALTER for CHECK constraints, so the only
  // path is INSERT…SELECT into a fresh table. This runs at most once per DB.
  try {
    const sqlRow = db.exec(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='vector_embeddings'"
    );
    const existingSql = sqlRow.length > 0 && sqlRow[0].values.length > 0 ? sqlRow[0].values[0][0] : '';
    const hasLegacyCheck = typeof existingSql === 'string' && existingSql.includes('CHECK(source_type IN');
    const hasNotNullClient = typeof existingSql === 'string'
      && /client_id\s+INTEGER\s+NOT\s+NULL/i.test(existingSql);
    if (hasLegacyCheck || hasNotNullClient) {
      logger.info('vector_embeddings: rebuilding table to drop legacy CHECK / NOT NULL on client_id (T-09 KB migration)');
      db.run('BEGIN');
      db.run(`
        CREATE TABLE vector_embeddings_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_type TEXT NOT NULL,
          source_id INTEGER NOT NULL,
          client_id INTEGER,
          therapist_id INTEGER,
          embedding TEXT NOT NULL,
          text_preview TEXT,
          token_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(source_type, source_id)
        )
      `);
      db.run(`
        INSERT INTO vector_embeddings_new (id, source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count, created_at, updated_at)
        SELECT id, source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count, created_at, updated_at
        FROM vector_embeddings
      `);
      db.run('DROP TABLE vector_embeddings');
      db.run('ALTER TABLE vector_embeddings_new RENAME TO vector_embeddings');
      db.run('CREATE INDEX IF NOT EXISTS idx_vector_embeddings_source ON vector_embeddings(source_type, source_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_vector_embeddings_client ON vector_embeddings(client_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_vector_embeddings_therapist ON vector_embeddings(therapist_id)');
      db.run('COMMIT');
    }
  } catch (e) {
    logger.warn('vector_embeddings T-09 schema migration skipped: ' + e.message);
    try { db.run('ROLLBACK'); } catch (_) {}
  }

  saveDatabaseAfterWrite();
}

/**
 * Store an embedding for a session transcript in the vector DB.
 *
 * @param {number} sessionId - The session ID
 * @param {string} transcript - The plaintext transcript
 * @param {number} clientId - The client ID
 * @param {number} therapistId - The therapist ID
 * @returns {{ success: boolean, embedding_id?: number }}
 */
function embedSessionTranscript(sessionId, transcript, clientId, therapistId) {
  ensureTable();
  const db = getDatabase();

  const embedding = generateEmbedding(transcript);
  if (!embedding) {
    logger.warn(`Cannot generate embedding for session ${sessionId}: empty text`);
    return { success: false, error: 'Empty text' };
  }

  const serialized = serializeEmbedding(embedding);
  const tokens = tokenize(transcript);
  const preview = transcript.substring(0, 200);

  // Upsert: delete old entry if exists, then insert
  db.run(
    "DELETE FROM vector_embeddings WHERE source_type = 'session_transcript' AND source_id = ?",
    [sessionId]
  );

  db.run(
    `INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count)
     VALUES ('session_transcript', ?, ?, ?, ?, ?, ?)`,
    [sessionId, clientId, therapistId, serialized, preview, tokens.length]
  );

  const result = db.exec('SELECT last_insert_rowid()');
  const embeddingId = result[0].values[0][0];

  // Update the session's embedding_ref (if column exists) - not all schemas have this
  // Instead we track via the vector_embeddings table

  saveDatabaseAfterWrite();

  logger.info(`Embedded session transcript ${sessionId}: ${tokens.length} tokens, embedding_id=${embeddingId}`);
  return { success: true, embedding_id: embeddingId, token_count: tokens.length };
}

/**
 * Store an embedding for a session summary in the vector DB.
 */
function embedSessionSummary(sessionId, summary, clientId, therapistId) {
  ensureTable();
  const db = getDatabase();

  const embedding = generateEmbedding(summary);
  if (!embedding) {
    return { success: false, error: 'Empty text' };
  }

  const serialized = serializeEmbedding(embedding);
  const tokens = tokenize(summary);
  const preview = summary.substring(0, 200);

  db.run(
    "DELETE FROM vector_embeddings WHERE source_type = 'session_summary' AND source_id = ?",
    [sessionId]
  );

  db.run(
    `INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count)
     VALUES ('session_summary', ?, ?, ?, ?, ?, ?)`,
    [sessionId, clientId, therapistId, serialized, preview, tokens.length]
  );

  const result = db.exec('SELECT last_insert_rowid()');
  const embeddingId = result[0].values[0][0];

  saveDatabaseAfterWrite();
  logger.info(`Embedded session summary ${sessionId}: ${tokens.length} tokens`);
  return { success: true, embedding_id: embeddingId, token_count: tokens.length };
}

/**
 * Perform semantic search across embedded documents.
 * Returns results ranked by cosine similarity to the query.
 *
 * @param {string} queryText - The search query
 * @param {object} options - { client_id, therapist_id, source_type, limit }
 * @returns {{ results: Array, query: string }}
 */
function semanticSearch(queryText, options = {}) {
  ensureTable();
  const db = getDatabase();

  const queryEmbedding = generateEmbedding(queryText);
  if (!queryEmbedding) {
    return { results: [], query: queryText, total: 0 };
  }

  // Build SQL filter
  let sql = 'SELECT id, source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count, created_at FROM vector_embeddings WHERE 1=1';
  const params = [];

  if (options.client_id) {
    sql += ' AND client_id = ?';
    params.push(options.client_id);
  }
  if (options.therapist_id) {
    sql += ' AND therapist_id = ?';
    params.push(options.therapist_id);
  }
  if (options.source_type) {
    sql += ' AND source_type = ?';
    params.push(options.source_type);
  }

  const result = db.exec(sql, params);
  if (result.length === 0 || result[0].values.length === 0) {
    return { results: [], query: queryText, total: 0 };
  }

  // Calculate similarity for each stored embedding
  const scored = [];
  for (const row of result[0].values) {
    const [id, sourceType, sourceId, clientId, therapistId, embeddingStr, preview, tokenCount, createdAt] = row;
    const storedEmbedding = deserializeEmbedding(embeddingStr);
    const similarity = cosineSimilarity(queryEmbedding, storedEmbedding);

    if (similarity > 0.05) { // Minimum threshold
      scored.push({
        id,
        source_type: sourceType,
        source_id: sourceId,
        client_id: clientId,
        therapist_id: therapistId,
        similarity: Math.round(similarity * 10000) / 10000,
        text_preview: preview,
        token_count: tokenCount,
        created_at: createdAt
      });
    }
  }

  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);

  const limit = options.limit || 10;
  const topResults = scored.slice(0, limit);

  return {
    results: topResults,
    query: queryText,
    total: scored.length
  };
}

/**
 * Get embedding info for a specific source.
 */
function getEmbedding(sourceType, sourceId) {
  ensureTable();
  const db = getDatabase();

  const result = db.exec(
    'SELECT id, source_type, source_id, client_id, therapist_id, text_preview, token_count, created_at FROM vector_embeddings WHERE source_type = ? AND source_id = ?',
    [sourceType, sourceId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = result[0].values[0];
  return {
    id: row[0],
    source_type: row[1],
    source_id: row[2],
    client_id: row[3],
    therapist_id: row[4],
    text_preview: row[5],
    token_count: row[6],
    created_at: row[7]
  };
}

/**
 * Get all embeddings count / stats.
 */
function getStats() {
  ensureTable();
  const db = getDatabase();

  const result = db.exec(
    `SELECT source_type, COUNT(*) as count, SUM(token_count) as total_tokens
     FROM vector_embeddings GROUP BY source_type`
  );

  const stats = { total: 0, by_type: {} };
  if (result.length > 0) {
    for (const row of result[0].values) {
      stats.by_type[row[0]] = { count: row[1], total_tokens: row[2] };
      stats.total += row[1];
    }
  }

  return stats;
}

/**
 * Store an embedding for a diary entry in the vector DB.
 * Called after diary entry creation to enable semantic search.
 *
 * @param {number} entryId - The diary entry ID
 * @param {string} content - The plaintext diary content
 * @param {number} clientId - The client ID
 * @param {number} therapistId - The linked therapist ID (nullable)
 * @returns {{ success: boolean, embedding_id?: number, embedding_ref?: string }}
 */
function embedDiaryEntry(entryId, content, clientId, therapistId) {
  ensureTable();
  const db = getDatabase();

  const embedding = generateEmbedding(content);
  if (!embedding) {
    logger.warn(`Cannot generate embedding for diary entry ${entryId}: empty text`);
    return { success: false, error: 'Empty text' };
  }

  const serialized = serializeEmbedding(embedding);
  const tokens = tokenize(content);
  const preview = content.substring(0, 200);

  // Upsert: delete old entry if exists, then insert
  db.run(
    "DELETE FROM vector_embeddings WHERE source_type = 'diary_entry' AND source_id = ?",
    [entryId]
  );

  db.run(
    `INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count)
     VALUES ('diary_entry', ?, ?, ?, ?, ?, ?)`,
    [entryId, clientId, therapistId || null, serialized, preview, tokens.length]
  );

  const result = db.exec('SELECT last_insert_rowid()');
  const embeddingId = result[0].values[0][0];

  // Generate an embedding_ref string for the diary_entries table
  const embeddingRef = 'emb_diary_' + entryId + '_v' + embeddingId;

  // Update the diary entry's embedding_ref column
  db.run(
    'UPDATE diary_entries SET embedding_ref = ? WHERE id = ?',
    [embeddingRef, entryId]
  );

  saveDatabaseAfterWrite();

  logger.info(`Embedded diary entry ${entryId}: ${tokens.length} tokens, ref=${embeddingRef}`);
  return { success: true, embedding_id: embeddingId, embedding_ref: embeddingRef, token_count: tokens.length };
}

// ---------------------------------------------------------------------------
// T-09: Therapist personal knowledge base (RAG)
// ---------------------------------------------------------------------------
// A therapist uploads a PDF / DOCX / TXT / MD / EPUB. The ingest pipeline
// chunks the content (500-1000 tokens with ~100 overlap) and emits one
// vector_embeddings row per chunk with source_type='kb' and source_id =
// chunk PK in therapist_knowledge_base_chunks. client_id is intentionally
// NULL — KB is therapist-wide, not client-scoped. semanticSearch can then
// retrieve the top-k chunks for a given therapist + query and surface them
// as additional context in summarization / NL-query system prompts.

/**
 * Embed a single KB chunk text. Returns the embedding row id.
 *
 * @param {number} chunkId - The therapist_knowledge_base_chunks.id (source_id)
 * @param {string} text - Plain-text chunk content
 * @param {number} therapistId - Owning therapist
 * @returns {{ success: boolean, embedding_id?: number, token_count?: number, error?: string }}
 */
function embedKbChunk(chunkId, text, therapistId) {
  ensureTable();
  const db = getDatabase();

  const embedding = generateEmbedding(text);
  if (!embedding) {
    return { success: false, error: 'Empty text' };
  }

  const serialized = serializeEmbedding(embedding);
  const tokens = tokenize(text);
  const preview = text.substring(0, 200);

  // Upsert: drop any existing embedding for this chunk so re-ingest is idempotent
  db.run(
    "DELETE FROM vector_embeddings WHERE source_type = 'kb' AND source_id = ?",
    [chunkId]
  );

  db.run(
    `INSERT INTO vector_embeddings (source_type, source_id, client_id, therapist_id, embedding, text_preview, token_count)
     VALUES ('kb', ?, NULL, ?, ?, ?, ?)`,
    [chunkId, therapistId, serialized, preview, tokens.length]
  );

  const result = db.exec('SELECT last_insert_rowid()');
  const embeddingId = result[0].values[0][0];

  saveDatabaseAfterWrite();

  return { success: true, embedding_id: embeddingId, token_count: tokens.length };
}

/**
 * Delete every KB embedding belonging to the given chunk ids. Used when a
 * therapist deletes a knowledge-base document.
 */
function deleteKbEmbeddings(chunkIds) {
  if (!Array.isArray(chunkIds) || chunkIds.length === 0) return { deleted: 0 };
  ensureTable();
  const db = getDatabase();

  // SQLite parameter limit is high; chunk in batches of 500 to be safe.
  let total = 0;
  for (let i = 0; i < chunkIds.length; i += 500) {
    const batch = chunkIds.slice(i, i + 500);
    const placeholders = batch.map(() => '?').join(',');
    db.run(
      `DELETE FROM vector_embeddings WHERE source_type = 'kb' AND source_id IN (${placeholders})`,
      batch
    );
    total += batch.length;
  }
  saveDatabaseAfterWrite();
  return { deleted: total };
}

/**
 * Search a therapist's knowledge base for the top-k chunks most similar to
 * `queryText`. Returns embeddings rows (source_id = chunk id) ranked by
 * cosine similarity. The caller is responsible for joining back to
 * therapist_knowledge_base_chunks to recover the actual chunk text.
 *
 * @param {string} queryText
 * @param {number} therapistId
 * @param {number} [limit=5]
 * @param {number} [minSimilarity=0.05]
 * @returns {Array<{id, source_id, similarity, text_preview, token_count}>}
 */
function searchKb(queryText, therapistId, limit = 5, minSimilarity = 0.05) {
  ensureTable();
  const db = getDatabase();

  const queryEmbedding = generateEmbedding(queryText);
  if (!queryEmbedding) return [];

  const result = db.exec(
    `SELECT id, source_id, embedding, text_preview, token_count
       FROM vector_embeddings
      WHERE source_type = 'kb' AND therapist_id = ?`,
    [therapistId]
  );

  if (result.length === 0 || result[0].values.length === 0) return [];

  const scored = [];
  for (const row of result[0].values) {
    const [id, sourceId, embeddingStr, preview, tokenCount] = row;
    const stored = deserializeEmbedding(embeddingStr);
    const similarity = cosineSimilarity(queryEmbedding, stored);
    if (similarity > minSimilarity) {
      scored.push({
        id,
        source_id: sourceId,
        similarity: Math.round(similarity * 10000) / 10000,
        text_preview: preview,
        token_count: tokenCount
      });
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, Math.max(1, Math.min(20, limit)));
}

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  serializeEmbedding,
  deserializeEmbedding,
  embedSessionTranscript,
  embedSessionSummary,
  embedDiaryEntry,
  embedKbChunk,
  deleteKbEmbeddings,
  searchKb,
  semanticSearch,
  getEmbedding,
  getStats,
  ensureTable,
  VOCAB_SIZE
};
