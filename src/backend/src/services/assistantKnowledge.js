// Assistant Knowledge Base Builder
// Indexes project documentation, UI components, routes, API endpoints, and i18n strings
// into the assistant_knowledge table with TF-IDF embeddings for semantic retrieval.
// READ-ONLY access to source files - never modifies any source code.

const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');

// --- Embedding utilities (shared with vectorStore.js approach) ---

const VOCAB_SIZE = 256;

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
  'which', 'who', 'whom', 'import', 'export', 'default', 'const', 'let',
  'var', 'function', 'return', 'require', 'module', 'exports', 'new',
  'class', 'extends', 'true', 'false', 'null', 'undefined', 'typeof'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0400-\u04FF]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function hashToken(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash % VOCAB_SIZE;
}

function generateEmbedding(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;
  const tf = new Float64Array(VOCAB_SIZE);
  for (const token of tokens) {
    tf[hashToken(token)] += 1;
  }
  for (let i = 0; i < VOCAB_SIZE; i++) {
    if (tf[i] > 0) tf[i] = 1 + Math.log(tf[i]);
  }
  let norm = 0;
  for (let i = 0; i < VOCAB_SIZE; i++) norm += tf[i] * tf[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VOCAB_SIZE; i++) tf[i] /= norm;
  }
  return tf;
}

function serializeEmbedding(embedding) {
  if (!embedding) return null;
  const parts = [];
  for (let i = 0; i < embedding.length; i++) {
    if (embedding[i] !== 0) parts.push(`${i}:${embedding[i].toFixed(6)}`);
  }
  return parts.join(',');
}

function deserializeEmbedding(str) {
  if (!str) return null;
  const embedding = new Float64Array(VOCAB_SIZE);
  for (const part of str.split(',')) {
    const [idx, val] = part.split(':');
    embedding[parseInt(idx)] = parseFloat(val);
  }
  return embedding;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// --- Table management ---

function ensureTable() {
  const db = getDatabase();
  db.run(`CREATE TABLE IF NOT EXISTS assistant_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_type TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_source ON assistant_knowledge(source_file)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_type ON assistant_knowledge(source_type)');
  saveDatabaseAfterWrite();
}

// --- File discovery and chunking ---

// Project root (relative to this service file)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/**
 * File categories to index with glob-like patterns.
 * All operations are READ-ONLY.
 */
const INDEX_SOURCES = [
  {
    type: 'api_route',
    description: 'Backend API route definitions',
    dirs: ['src/backend/src/routes'],
    extensions: ['.js'],
    maxDepth: 1
  },
  {
    type: 'ui_component',
    description: 'Frontend React components',
    dirs: ['src/frontend/src/pages', 'src/frontend/src/components'],
    extensions: ['.jsx', '.js'],
    maxDepth: 2
  },
  {
    type: 'i18n',
    description: 'Internationalization translation files',
    dirs: ['src/frontend/src/i18n'],
    extensions: ['.json', '.js'],
    maxDepth: 1
  },
  {
    type: 'service',
    description: 'Backend service modules',
    dirs: ['src/backend/src/services'],
    extensions: ['.js'],
    maxDepth: 2
  },
  {
    type: 'documentation',
    description: 'Project documentation',
    dirs: ['docs'],
    extensions: ['.md'],
    maxDepth: 1
  },
  {
    type: 'bot',
    description: 'Telegram bot handlers',
    dirs: ['src/bot/src'],
    extensions: ['.js'],
    maxDepth: 2
  },
  {
    type: 'config',
    description: 'Configuration files',
    files: ['docker-compose.yml', 'README.md', '.env.example']
  }
];

/**
 * Recursively find files in a directory (READ-ONLY).
 */
function findFiles(dir, extensions, maxDepth, currentDepth) {
  currentDepth = currentDepth || 0;
  if (currentDepth > (maxDepth || 3)) return [];
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        results.push(...findFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch (e) {
    logger.debug('[AssistantKB] Cannot read directory: ' + dir + ' - ' + e.message);
  }
  return results;
}

/**
 * Read a file safely (READ-ONLY). Returns null on error.
 */
function readFileSafe(filePath) {
  try {
    const stat = fs.statSync(filePath);
    // Skip files larger than 500KB
    if (stat.size > 500 * 1024) {
      logger.debug('[AssistantKB] Skipping large file: ' + filePath);
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    logger.debug('[AssistantKB] Cannot read file: ' + filePath + ' - ' + e.message);
    return null;
  }
}

/**
 * Extract meaningful content summary from different file types.
 * Returns an array of text chunks suitable for embedding.
 */
function chunkFile(content, filePath, sourceType) {
  const relativePath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
  const chunks = [];
  const MAX_CHUNK_SIZE = 2000; // characters per chunk

  if (sourceType === 'i18n' && filePath.endsWith('.json')) {
    // For i18n JSON files, extract key paths as documentation
    try {
      const data = JSON.parse(content);
      const keys = flattenKeys(data);
      // Group keys into chunks of ~50 keys
      for (let i = 0; i < keys.length; i += 50) {
        const batch = keys.slice(i, i + 50);
        const text = `Translation keys from ${relativePath}:\n` + batch.join('\n');
        chunks.push(text);
      }
    } catch (e) {
      chunks.push(`i18n file ${relativePath}: ${content.substring(0, MAX_CHUNK_SIZE)}`);
    }
    return chunks;
  }

  if (sourceType === 'api_route') {
    // Extract route definitions and their descriptions
    const routeInfo = extractRouteInfo(content, relativePath);
    if (routeInfo) chunks.push(routeInfo);
  }

  if (sourceType === 'ui_component') {
    // Extract component purpose and key features
    const componentInfo = extractComponentInfo(content, relativePath);
    if (componentInfo) chunks.push(componentInfo);
  }

  // For all types: chunk the raw content as fallback/supplement
  const header = `File: ${relativePath} (${sourceType})\n`;

  // Split by logical boundaries
  const sections = content.split(/\n(?=\/\/\s*={3,}|\/\*\*|\/\/\s*---)/);

  let currentChunk = header;
  for (const section of sections) {
    if (currentChunk.length + section.length > MAX_CHUNK_SIZE) {
      if (currentChunk.length > header.length) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = header + section;
    } else {
      currentChunk += section;
    }
  }
  if (currentChunk.length > header.length) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [header + content.substring(0, MAX_CHUNK_SIZE)];
}

/**
 * Flatten JSON keys for i18n indexing.
 */
function flattenKeys(obj, prefix) {
  prefix = prefix || '';
  const keys = [];
  for (const key in obj) {
    const fullKey = prefix ? prefix + '.' + key : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...flattenKeys(obj[key], fullKey));
    } else {
      const val = typeof obj[key] === 'string' ? obj[key].substring(0, 100) : String(obj[key]);
      keys.push(fullKey + ' = ' + val);
    }
  }
  return keys;
}

/**
 * Extract API route information from Express router files.
 */
function extractRouteInfo(content, relativePath) {
  const routes = [];
  const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    routes.push(`${match[1].toUpperCase()} ${match[2]}`);
  }
  if (routes.length === 0) return null;
  return `API Routes in ${relativePath}:\n${routes.join('\n')}`;
}

/**
 * Extract React component information.
 */
function extractComponentInfo(content, relativePath) {
  const info = [`Component: ${relativePath}`];

  // Extract component name from export
  const exportMatch = content.match(/export\s+default\s+function\s+(\w+)/);
  if (exportMatch) info.push('Name: ' + exportMatch[1]);

  // Extract useTranslation keys used
  const tKeys = [];
  const tRegex = /t\(['"`]([^'"`]+)['"`]\)/g;
  let m;
  while ((m = tRegex.exec(content)) !== null) {
    if (!tKeys.includes(m[1])) tKeys.push(m[1]);
  }
  if (tKeys.length > 0) info.push('i18n keys: ' + tKeys.slice(0, 20).join(', '));

  // Extract fetch/API calls
  const apiCalls = [];
  const fetchRegex = /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  while ((m = fetchRegex.exec(content)) !== null) {
    if (!apiCalls.includes(m[1])) apiCalls.push(m[1]);
  }
  if (apiCalls.length > 0) info.push('API calls: ' + apiCalls.join(', '));

  return info.length > 1 ? info.join('\n') : null;
}

// --- Main indexing functions ---

/**
 * Discover all files to index based on INDEX_SOURCES config.
 * READ-ONLY: only reads the filesystem, never writes.
 */
function discoverFiles() {
  const files = [];

  for (const source of INDEX_SOURCES) {
    if (source.files) {
      // Specific files
      for (const f of source.files) {
        const fullPath = path.join(PROJECT_ROOT, f);
        if (fs.existsSync(fullPath)) {
          files.push({ path: fullPath, type: source.type });
        }
      }
    }
    if (source.dirs) {
      for (const dir of source.dirs) {
        const fullDir = path.join(PROJECT_ROOT, dir);
        const found = findFiles(fullDir, source.extensions, source.maxDepth);
        for (const f of found) {
          files.push({ path: f, type: source.type });
        }
      }
    }
  }

  return files;
}

/**
 * Perform a full re-index of the knowledge base.
 * READ-ONLY on source files. Writes only to assistant_knowledge table.
 *
 * @returns {{ indexed: number, chunks: number, removed: number, errors: number }}
 */
function reindex() {
  ensureTable();
  const db = getDatabase();
  const startTime = Date.now();

  logger.info('[AssistantKB] Starting knowledge base re-index...');

  const files = discoverFiles();
  logger.info(`[AssistantKB] Discovered ${files.length} files to index`);

  // Track which source files we process (for stale entry removal)
  const processedFiles = new Set();
  let totalChunks = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const content = readFileSafe(file.path);
      if (!content) continue;

      const relativePath = path.relative(PROJECT_ROOT, file.path).replace(/\\/g, '/');
      processedFiles.add(relativePath);

      const chunks = chunkFile(content, file.path, file.type);

      // Remove old entries for this file
      db.run("DELETE FROM assistant_knowledge WHERE source_file = ?", [relativePath]);

      // Insert new chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = generateEmbedding(chunk);
        if (!embedding) continue;

        const serialized = serializeEmbedding(embedding);
        db.run(
          "INSERT INTO assistant_knowledge (chunk_text, embedding, source_file, source_type, chunk_index, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
          [chunk, serialized, relativePath, file.type, i]
        );
        totalChunks++;
      }
    } catch (e) {
      errors++;
      logger.warn('[AssistantKB] Error indexing file: ' + file.path + ' - ' + e.message);
    }
  }

  // Remove entries for files that no longer exist
  let removed = 0;
  const existingFiles = db.exec("SELECT DISTINCT source_file FROM assistant_knowledge");
  if (existingFiles.length > 0 && existingFiles[0].values) {
    for (const row of existingFiles[0].values) {
      const sourceFile = row[0];
      if (!processedFiles.has(sourceFile)) {
        db.run("DELETE FROM assistant_knowledge WHERE source_file = ?", [sourceFile]);
        removed++;
        logger.info('[AssistantKB] Removed stale entries for: ' + sourceFile);
      }
    }
  }

  saveDatabaseAfterWrite();

  const elapsed = Date.now() - startTime;
  const stats = {
    indexed: processedFiles.size,
    chunks: totalChunks,
    removed: removed,
    errors: errors,
    elapsed_ms: elapsed
  };

  logger.info(`[AssistantKB] Re-index complete: ${stats.indexed} files, ${stats.chunks} chunks, ${stats.removed} removed, ${stats.errors} errors (${elapsed}ms)`);

  return stats;
}

/**
 * Get knowledge base statistics.
 */
function getStats() {
  ensureTable();
  const db = getDatabase();

  const totalResult = db.exec("SELECT COUNT(*) FROM assistant_knowledge");
  const total = (totalResult.length > 0 && totalResult[0].values.length > 0) ? totalResult[0].values[0][0] : 0;

  const byTypeResult = db.exec("SELECT source_type, COUNT(*) as cnt FROM assistant_knowledge GROUP BY source_type ORDER BY cnt DESC");
  const byType = {};
  if (byTypeResult.length > 0 && byTypeResult[0].values) {
    for (const row of byTypeResult[0].values) {
      byType[row[0]] = row[1];
    }
  }

  const filesResult = db.exec("SELECT COUNT(DISTINCT source_file) FROM assistant_knowledge");
  const files = (filesResult.length > 0 && filesResult[0].values.length > 0) ? filesResult[0].values[0][0] : 0;

  const lastUpdatedResult = db.exec("SELECT MAX(updated_at) FROM assistant_knowledge");
  const lastUpdated = (lastUpdatedResult.length > 0 && lastUpdatedResult[0].values.length > 0) ? lastUpdatedResult[0].values[0][0] : null;

  return { total_chunks: total, total_files: files, by_type: byType, last_updated: lastUpdated };
}

/**
 * Search the knowledge base for relevant chunks.
 *
 * @param {string} query - Search query text
 * @param {number} limit - Max results (default 5)
 * @returns {Array<{chunk_text: string, source_file: string, source_type: string, similarity: number}>}
 */
function search(query, limit) {
  limit = limit || 5;
  ensureTable();

  const queryEmbedding = generateEmbedding(query);
  if (!queryEmbedding) return [];

  const db = getDatabase();
  const allChunks = db.exec("SELECT id, chunk_text, embedding, source_file, source_type FROM assistant_knowledge");
  if (!allChunks.length || !allChunks[0].values) return [];

  const results = [];
  for (const row of allChunks[0].values) {
    const chunkEmbedding = deserializeEmbedding(row[2]);
    const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
    if (similarity > 0.05) {
      results.push({
        id: row[0],
        chunk_text: row[1],
        source_file: row[3],
        source_type: row[4],
        similarity: similarity
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

module.exports = {
  ensureTable,
  reindex,
  getStats,
  search,
  generateEmbedding,
  serializeEmbedding,
  deserializeEmbedding,
  cosineSimilarity
};
