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
 */
function ensureTable() {
  const db = getDatabase();
  db.run(`
    CREATE TABLE IF NOT EXISTS vector_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL CHECK(source_type IN ('session_transcript', 'session_summary', 'diary_entry')),
      source_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
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

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  serializeEmbedding,
  deserializeEmbedding,
  embedSessionTranscript,
  embedSessionSummary,
  embedDiaryEntry,
  semanticSearch,
  getEmbedding,
  getStats,
  ensureTable,
  VOCAB_SIZE
};
