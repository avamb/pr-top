// Assistant Knowledge Base Builder
// Indexes project documentation, UI components, routes, API endpoints, and i18n strings
// into the assistant_knowledge table with AI embeddings for semantic retrieval.
// Falls back to TF-IDF embeddings when AI embedding API is unavailable.
// READ-ONLY access to source files - never modifies any source code.

const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');

// --- Configuration ---

// AI embedding dimensions (OpenAI text-embedding-3-small = 1536)
const AI_EMBEDDING_DIMENSIONS = 1536;
// TF-IDF fallback dimensions
const TFIDF_VOCAB_SIZE = 256;
// Similarity thresholds
const AI_SIMILARITY_THRESHOLD = 0.3;
const TFIDF_SIMILARITY_THRESHOLD = 0.05;
// Batch size for AI embedding API calls (max 2048 for OpenAI)
const EMBEDDING_BATCH_SIZE = 50;

// Track which embedding type is currently in use
let currentEmbeddingType = 'tfidf'; // 'ai' or 'tfidf'

// --- AI Embedding via OpenAI API ---

/**
 * Get the OpenAI API key and URL for embeddings.
 * Checks platform_settings first, then env vars.
 */
function getEmbeddingConfig() {
  let apiKey = process.env.AI_API_KEY;
  let apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1';
  let model = 'text-embedding-3-small';

  // Try to read from DB settings for OpenAI key
  try {
    const db = getDatabase();
    // Check if openai is configured as a provider with an API key
    const keyResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_openai_api_key'");
    if (keyResult.length > 0 && keyResult[0].values.length > 0 && keyResult[0].values[0][0]) {
      apiKey = keyResult[0].values[0][0];
    }
  } catch (e) {
    // Ignore DB errors, use env vars
  }

  return { apiKey, apiUrl, model };
}

/**
 * Check if AI embeddings are available (OpenAI API key configured).
 */
function isAIEmbeddingAvailable() {
  const { apiKey } = getEmbeddingConfig();
  return !!(apiKey && apiKey !== 'your-ai-api-key' && apiKey.length > 10);
}

/**
 * Generate AI embeddings for a single text using OpenAI text-embedding-3-small.
 * @param {string} text - Text to embed
 * @returns {Promise<Float64Array|null>} Embedding vector or null on failure
 */
async function embedText(text) {
  if (!text || !text.trim()) return null;

  const { apiKey, apiUrl, model } = getEmbeddingConfig();
  if (!apiKey || apiKey === 'your-ai-api-key' || apiKey.length <= 10) {
    return null;
  }

  try {
    const response = await fetch(apiUrl + '/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        input: text.substring(0, 8000), // Limit input size
        dimensions: AI_EMBEDDING_DIMENSIONS
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      logger.warn(`[AssistantKB] Embedding API error ${response.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      logger.warn('[AssistantKB] Unexpected embedding API response format');
      return null;
    }

    return new Float64Array(data.data[0].embedding);
  } catch (e) {
    logger.warn('[AssistantKB] Embedding API call failed: ' + e.message);
    return null;
  }
}

/**
 * Generate AI embeddings for multiple texts in a batch.
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<(Float64Array|null)[]>} Array of embedding vectors
 */
async function embedTextBatch(texts) {
  if (!texts || texts.length === 0) return [];

  const { apiKey, apiUrl, model } = getEmbeddingConfig();
  if (!apiKey || apiKey === 'your-ai-api-key' || apiKey.length <= 10) {
    return texts.map(() => null);
  }

  try {
    // Truncate each text to 8000 chars
    const inputs = texts.map(t => (t || '').substring(0, 8000));

    const response = await fetch(apiUrl + '/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        input: inputs,
        dimensions: AI_EMBEDDING_DIMENSIONS
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      logger.warn(`[AssistantKB] Batch embedding API error ${response.status}: ${errorText.substring(0, 200)}`);
      return texts.map(() => null);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      return texts.map(() => null);
    }

    // Sort by index to match input order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map(item => item.embedding ? new Float64Array(item.embedding) : null);
  } catch (e) {
    logger.warn('[AssistantKB] Batch embedding API call failed: ' + e.message);
    return texts.map(() => null);
  }
}

// --- TF-IDF Fallback Embedding ---

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

function lexicalOverlapScore(queryTokens, candidateText) {
  if (!queryTokens || queryTokens.length === 0 || !candidateText) return 0;

  const querySet = new Set(queryTokens);
  const candidateSet = new Set(tokenize(candidateText));
  if (candidateSet.size === 0) return 0;

  let overlap = 0;
  for (const token of querySet) {
    if (candidateSet.has(token)) overlap++;
  }

  return overlap / querySet.size;
}

function expandQueryTokens(tokens) {
  const expanded = new Set(tokens || []);
  const aliases = {
    referral: ['ref', 'invite', 'link'],
    invite: ['invitation', 'code', 'client', 'link'],
    colleague: ['colleagues', 'coworker', 'therapist', 'therapists'],
    therapist: ['therapists', 'colleague', 'colleagues'],
    link: ['url', 'referral', 'invite'],
    коллег: ['коллеги', 'терапевт', 'терапевты'],
    терапевт: ['терапевты', 'коллега', 'коллеги'],
    реферал: ['рефераль', 'ссылка', 'ссылки'],
    рефераль: ['реферал', 'ссылка', 'ссылки'],
    ссылк: ['ссылка', 'ссылки', 'link', 'url'],
    приглас: ['приглашение', 'invite', 'code', 'link']
  };

  for (const token of tokens || []) {
    for (const [stem, related] of Object.entries(aliases)) {
      if (token.includes(stem)) {
        for (const alias of related) expanded.add(alias);
      }
    }
  }

  return Array.from(expanded);
}

function getSourceTypeScoreBonus(sourceType) {
  const bonuses = {
    api_route: 0.3,
    ui_component: 0.2,
    documentation: 0.12,
    config: 0.08,
    i18n: 0.04,
    service: 0
  };
  return bonuses[sourceType] || 0;
}

function getSourceFileScoreAdjustment(sourceFile) {
  const normalized = String(sourceFile || '').replace(/\\/g, '/');
  if (normalized.endsWith('/assistantPrompt.js')) return -0.8;
  if (normalized.endsWith('/assistantKnowledge.js')) return -0.15;
  return 0;
}

function hashToken(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash % TFIDF_VOCAB_SIZE;
}

function generateTfidfEmbedding(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;
  const tf = new Float64Array(TFIDF_VOCAB_SIZE);
  for (const token of tokens) {
    tf[hashToken(token)] += 1;
  }
  for (let i = 0; i < TFIDF_VOCAB_SIZE; i++) {
    if (tf[i] > 0) tf[i] = 1 + Math.log(tf[i]);
  }
  let norm = 0;
  for (let i = 0; i < TFIDF_VOCAB_SIZE; i++) norm += tf[i] * tf[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < TFIDF_VOCAB_SIZE; i++) tf[i] /= norm;
  }
  return tf;
}

// --- Unified embedding functions ---

/**
 * Generate embedding for text (sync, TF-IDF only - used for backward compat).
 * For AI embeddings, use embedText() or generateEmbeddingAsync().
 */
function generateEmbedding(text) {
  return generateTfidfEmbedding(text);
}

/**
 * Generate embedding for text (async, tries AI first then TF-IDF fallback).
 * @param {string} text
 * @returns {Promise<{embedding: Float64Array|null, type: string}>}
 */
async function generateEmbeddingAsync(text) {
  if (isAIEmbeddingAvailable()) {
    const aiEmb = await embedText(text);
    if (aiEmb) {
      return { embedding: aiEmb, type: 'ai' };
    }
  }
  // Fallback to TF-IDF
  return { embedding: generateTfidfEmbedding(text), type: 'tfidf' };
}

// --- Serialization ---

/**
 * Serialize embedding to string for DB storage.
 * AI embeddings: JSON array (dense vectors).
 * TF-IDF embeddings: sparse format "idx:val,idx:val,...".
 */
function serializeEmbedding(embedding, type) {
  if (!embedding) return null;

  if (type === 'ai' || embedding.length === AI_EMBEDDING_DIMENSIONS) {
    // AI embeddings: store as JSON array (more compact for dense vectors)
    // Use reduced precision to save space
    const arr = [];
    for (let i = 0; i < embedding.length; i++) {
      arr.push(parseFloat(embedding[i].toFixed(7)));
    }
    return 'AI:' + JSON.stringify(arr);
  }

  // TF-IDF: sparse format
  const parts = [];
  for (let i = 0; i < embedding.length; i++) {
    if (embedding[i] !== 0) parts.push(`${i}:${embedding[i].toFixed(6)}`);
  }
  return parts.join(',');
}

/**
 * Deserialize embedding from DB string.
 * Auto-detects format: "AI:[...]" for AI embeddings, "idx:val,..." for TF-IDF.
 */
function deserializeEmbedding(str) {
  if (!str) return null;

  // AI embedding format: "AI:[...]"
  if (str.startsWith('AI:')) {
    try {
      const arr = JSON.parse(str.substring(3));
      return new Float64Array(arr);
    } catch (e) {
      logger.warn('[AssistantKB] Failed to deserialize AI embedding');
      return null;
    }
  }

  // TF-IDF sparse format: "idx:val,idx:val,..."
  const embedding = new Float64Array(TFIDF_VOCAB_SIZE);
  for (const part of str.split(',')) {
    const [idx, val] = part.split(':');
    embedding[parseInt(idx)] = parseFloat(val);
  }
  return embedding;
}

/**
 * Detect the type of a serialized embedding.
 */
function getEmbeddingType(serialized) {
  if (!serialized) return 'unknown';
  return serialized.startsWith('AI:') ? 'ai' : 'tfidf';
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

  // Add embedding_type column if it doesn't exist
  try {
    db.run("ALTER TABLE assistant_knowledge ADD COLUMN embedding_type TEXT DEFAULT 'tfidf'");
  } catch (e) {
    // Column already exists, ignore
  }

  saveDatabaseAfterWrite();
}

// --- File discovery and chunking ---

// Project root detection:
// - In Docker: source files are mounted at /app/project-root/ (read-only)
// - In local dev: resolve relative to this service file (4 levels up)
const DOCKER_PROJECT_ROOT = '/app/project-root';
const LOCAL_PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = fs.existsSync(path.join(DOCKER_PROJECT_ROOT, 'src'))
  ? DOCKER_PROJECT_ROOT
  : LOCAL_PROJECT_ROOT;

function getProjectRootDiagnostics() {
  return {
    project_root: PROJECT_ROOT,
    docker_root_available: fs.existsSync(path.join(DOCKER_PROJECT_ROOT, 'src')),
    frontend_available: fs.existsSync(path.join(PROJECT_ROOT, 'src', 'frontend')),
    backend_available: fs.existsSync(path.join(PROJECT_ROOT, 'src', 'backend')),
    bot_available: fs.existsSync(path.join(PROJECT_ROOT, 'src', 'bot')),
    docs_available: fs.existsSync(path.join(PROJECT_ROOT, 'docs'))
  };
}

/**
 * File categories to index with glob-like patterns.
 * All operations are READ-ONLY.
 */
const INDEX_SOURCES = [
  {
    type: 'api_route',
    description: 'Backend API route definitions',
    files: ['src/backend/src/index.js'],
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

const EXCLUDED_SOURCE_FILES = new Set([
  'src/backend/src/services/assistantPrompt.js'
]);

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
    // For i18n JSON files, group keys by top-level namespace for thematic coherence.
    // This ensures related keys (e.g., all settings.* keys) are in the same chunk,
    // improving RAG search relevance for semantic queries.
    try {
      const data = JSON.parse(content);
      const namespaces = Object.keys(data);
      const MAX_KEYS_PER_CHUNK = 100;

      for (const ns of namespaces) {
        const nsValue = data[ns];
        if (typeof nsValue !== 'object' || nsValue === null || Array.isArray(nsValue)) {
          // Simple key-value (e.g., brand: "PR-TOP")
          const val = typeof nsValue === 'string' ? nsValue.substring(0, 100) : String(nsValue);
          chunks.push(`Translation keys for [${ns}] from ${relativePath}:\n${ns} = ${val}`);
          continue;
        }

        const nsKeys = flattenKeys(nsValue, ns);

        if (nsKeys.length <= MAX_KEYS_PER_CHUNK) {
          // Namespace fits in one chunk
          const text = `Translation keys for [${ns}] from ${relativePath}:\n` + nsKeys.join('\n');
          chunks.push(text);
        } else {
          // Large namespace: split by second-level prefix
          const subGroups = {};
          for (const keyLine of nsKeys) {
            // Extract second-level prefix: "admin.therapists.name = ..." -> "therapists"
            const dotIdx = keyLine.indexOf('.');
            const secondDotIdx = dotIdx >= 0 ? keyLine.indexOf('.', dotIdx + 1) : -1;
            let subPrefix;
            if (secondDotIdx >= 0) {
              subPrefix = keyLine.substring(dotIdx + 1, secondDotIdx);
            } else {
              subPrefix = '_root';
            }
            if (!subGroups[subPrefix]) subGroups[subPrefix] = [];
            subGroups[subPrefix].push(keyLine);
          }

          const subPrefixes = Object.keys(subGroups);
          for (const sub of subPrefixes) {
            const subKeys = subGroups[sub];
            const label = sub === '_root' ? ns : `${ns}.${sub}`;
            const text = `Translation keys for [${label}] from ${relativePath}:\n` + subKeys.join('\n');
            chunks.push(text);
          }
        }
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
  const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const lineStart = content.lastIndexOf('\n', match.index);
    const contextStart = Math.max(0, lineStart - 300);
    const preContext = content.substring(contextStart, match.index);
    const commentMatches = preContext.match(/(?:\/\/[^\n]+|\/\*[\s\S]*?\*\/)\s*$/);
    if (commentMatches && commentMatches[0]) {
      const comment = commentMatches[0]
        .replace(/\/\*+|\*\/|\/\/|\*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      routes.push(`${method} ${routePath} - ${comment}`);
    } else {
      routes.push(`${method} ${routePath}`);
    }
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
          const relativePath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
          if (!EXCLUDED_SOURCE_FILES.has(relativePath)) {
            files.push({ path: fullPath, type: source.type });
          }
        }
      }
    }
    if (source.dirs) {
      for (const dir of source.dirs) {
        const fullDir = path.join(PROJECT_ROOT, dir);
        const found = findFiles(fullDir, source.extensions, source.maxDepth);
        for (const f of found) {
          const relativePath = path.relative(PROJECT_ROOT, f).replace(/\\/g, '/');
          if (!EXCLUDED_SOURCE_FILES.has(relativePath)) {
            files.push({ path: f, type: source.type });
          }
        }
      }
    }
  }

  return files;
}

/**
 * Perform a full re-index of the knowledge base.
 * Tries AI embeddings first, falls back to TF-IDF if unavailable.
 * READ-ONLY on source files. Writes only to assistant_knowledge table.
 *
 * @returns {Promise<{ indexed: number, chunks: number, removed: number, errors: number, embedding_type: string }>}
 */
async function reindex() {
  ensureTable();
  const db = getDatabase();
  const startTime = Date.now();

  const useAI = isAIEmbeddingAvailable();
  const embeddingType = useAI ? 'ai' : 'tfidf';
  currentEmbeddingType = embeddingType;

  logger.info(`[AssistantKB] Starting knowledge base re-index (embedding: ${embeddingType})...`);
  logger.info('[AssistantKB] Project root diagnostics: ' + JSON.stringify(getProjectRootDiagnostics()));

  const files = discoverFiles();
  logger.info(`[AssistantKB] Discovered ${files.length} files to index`);
  if (files.length > 0) {
    const byType = {};
    for (const file of files) {
      byType[file.type] = (byType[file.type] || 0) + 1;
    }
    logger.info('[AssistantKB] Files discovered by type: ' + JSON.stringify(byType));
  } else {
    logger.warn('[AssistantKB] No files discovered for indexing. Check deployment packaging and project root mounts/snapshot.');
  }

  // Track which source files we process (for stale entry removal)
  const processedFiles = new Set();
  let totalChunks = 0;
  let errors = 0;

  // Collect all chunks first for batch embedding
  const allChunkData = []; // { chunk, relativePath, sourceType, chunkIndex }

  for (const file of files) {
    try {
      const content = readFileSafe(file.path);
      if (!content) continue;

      const relativePath = path.relative(PROJECT_ROOT, file.path).replace(/\\/g, '/');
      processedFiles.add(relativePath);

      const chunks = chunkFile(content, file.path, file.type);

      for (let i = 0; i < chunks.length; i++) {
        allChunkData.push({
          chunk: chunks[i],
          relativePath,
          sourceType: file.type,
          chunkIndex: i
        });
      }
    } catch (e) {
      errors++;
      logger.warn('[AssistantKB] Error processing file: ' + file.path + ' - ' + e.message);
    }
  }

  logger.info(`[AssistantKB] Processing ${allChunkData.length} chunks with ${embeddingType} embeddings...`);

  // Clear existing entries for processed files
  for (const relativePath of processedFiles) {
    db.run("DELETE FROM assistant_knowledge WHERE source_file = ?", [relativePath]);
  }

  if (useAI) {
    // Batch AI embedding generation
    for (let batchStart = 0; batchStart < allChunkData.length; batchStart += EMBEDDING_BATCH_SIZE) {
      const batch = allChunkData.slice(batchStart, batchStart + EMBEDDING_BATCH_SIZE);
      const texts = batch.map(c => c.chunk);

      let embeddings;
      try {
        embeddings = await embedTextBatch(texts);
      } catch (e) {
        logger.warn(`[AssistantKB] Batch embedding failed at offset ${batchStart}, falling back to TF-IDF for this batch: ${e.message}`);
        embeddings = texts.map(() => null);
      }

      for (let i = 0; i < batch.length; i++) {
        const { chunk, relativePath, sourceType, chunkIndex } = batch[i];
        let embedding = embeddings[i];
        let type = 'ai';

        // Fall back to TF-IDF for failed embeddings
        if (!embedding) {
          embedding = generateTfidfEmbedding(chunk);
          type = 'tfidf';
          if (!embedding) continue;
        }

        const serialized = serializeEmbedding(embedding, type);
        db.run(
          "INSERT INTO assistant_knowledge (chunk_text, embedding, source_file, source_type, chunk_index, embedding_type, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
          [chunk, serialized, relativePath, sourceType, chunkIndex, type]
        );
        totalChunks++;
      }

      // Log batch progress
      const processed = Math.min(batchStart + EMBEDDING_BATCH_SIZE, allChunkData.length);
      logger.info(`[AssistantKB] Embedded ${processed}/${allChunkData.length} chunks...`);
    }
  } else {
    // TF-IDF embedding (synchronous, fast)
    for (const { chunk, relativePath, sourceType, chunkIndex } of allChunkData) {
      const embedding = generateTfidfEmbedding(chunk);
      if (!embedding) continue;

      const serialized = serializeEmbedding(embedding, 'tfidf');
      db.run(
        "INSERT INTO assistant_knowledge (chunk_text, embedding, source_file, source_type, chunk_index, embedding_type, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
        [chunk, serialized, relativePath, sourceType, chunkIndex, 'tfidf']
      );
      totalChunks++;
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
    elapsed_ms: elapsed,
    embedding_type: embeddingType
  };

  logger.info(`[AssistantKB] Re-index complete: ${stats.indexed} files, ${stats.chunks} chunks, ${stats.removed} removed, ${stats.errors} errors, embedding=${embeddingType} (${elapsed}ms)`);

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

  // Count by embedding type
  const embTypeResult = db.exec("SELECT embedding_type, COUNT(*) as cnt FROM assistant_knowledge GROUP BY embedding_type");
  const byEmbeddingType = {};
  if (embTypeResult.length > 0 && embTypeResult[0].values) {
    for (const row of embTypeResult[0].values) {
      byEmbeddingType[row[0] || 'tfidf'] = row[1];
    }
  }

  return {
    total_chunks: total,
    total_files: files,
    by_type: byType,
    by_embedding_type: byEmbeddingType,
    last_updated: lastUpdated,
    ai_embeddings_available: isAIEmbeddingAvailable()
  };
}

/**
 * Search the knowledge base for relevant chunks.
 * Uses AI embeddings when available (cross-language semantic search),
 * falls back to TF-IDF for local/offline operation.
 *
 * @param {string} query - Search query text
 * @param {number} limit - Max results (default 5)
 * @returns {Promise<Array<{chunk_text: string, source_file: string, source_type: string, similarity: number}>>}
 */
async function search(query, limit) {
  limit = limit || 5;
  ensureTable();

  const db = getDatabase();
  const allChunks = db.exec("SELECT id, chunk_text, embedding, source_file, source_type, embedding_type FROM assistant_knowledge");
  if (!allChunks.length || !allChunks[0].values) return [];
  const queryTokens = expandQueryTokens(tokenize(query));

  // Determine what embedding types exist in the DB
  const hasAIEmbeddings = allChunks[0].values.some(row => getEmbeddingType(row[2]) === 'ai');
  const hasTfidfEmbeddings = allChunks[0].values.some(row => getEmbeddingType(row[2]) !== 'ai');

  // Try to generate AI embedding for the query if we have AI embeddings in DB
  let queryAIEmbedding = null;
  let queryTfidfEmbedding = null;

  if (hasAIEmbeddings && isAIEmbeddingAvailable()) {
    queryAIEmbedding = await embedText(query);
  }
  if (hasTfidfEmbeddings || !queryAIEmbedding) {
    queryTfidfEmbedding = generateTfidfEmbedding(query);
  }

  if (!queryAIEmbedding && !queryTfidfEmbedding) return [];

  const results = [];
  for (const row of allChunks[0].values) {
    const chunkEmbType = getEmbeddingType(row[2]);
    const chunkEmbedding = deserializeEmbedding(row[2]);
    if (!chunkEmbedding) continue;

    let semanticSimilarity = 0;
    let threshold = TFIDF_SIMILARITY_THRESHOLD;

    if (chunkEmbType === 'ai' && queryAIEmbedding) {
      // AI vs AI comparison (best quality, cross-language)
      semanticSimilarity = cosineSimilarity(queryAIEmbedding, chunkEmbedding);
      threshold = AI_SIMILARITY_THRESHOLD;
    } else if (chunkEmbType !== 'ai' && queryTfidfEmbedding) {
      // TF-IDF vs TF-IDF comparison
      semanticSimilarity = cosineSimilarity(queryTfidfEmbedding, chunkEmbedding);
      threshold = TFIDF_SIMILARITY_THRESHOLD;
    } else {
      // Mismatched embedding types - skip (can't compare AI with TF-IDF)
      continue;
    }

    const lexicalScore = lexicalOverlapScore(queryTokens, row[1]);
    const sourceBonus = getSourceTypeScoreBonus(row[4]) + getSourceFileScoreAdjustment(row[3]);
    const semanticPass = semanticSimilarity > threshold;
    const lexicalPass = lexicalScore >= 0.2;
    const rankScore = semanticSimilarity + (lexicalScore * 0.5) + sourceBonus;

    if (semanticPass || lexicalPass) {
      results.push({
        id: row[0],
        chunk_text: row[1],
        source_file: row[3],
        source_type: row[4],
        similarity: rankScore,
        semantic_similarity: semanticSimilarity,
        lexical_score: lexicalScore,
        source_bonus: sourceBonus
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

/**
 * Get the current embedding type being used.
 */
function getCurrentEmbeddingType() {
  return currentEmbeddingType;
}

module.exports = {
  ensureTable,
  reindex,
  getStats,
  search,
  embedText,
  embedTextBatch,
  generateEmbedding,
  generateEmbeddingAsync,
  generateTfidfEmbedding,
  serializeEmbedding,
  deserializeEmbedding,
  cosineSimilarity,
  isAIEmbeddingAvailable,
  getCurrentEmbeddingType
};
