// Therapist Personal Knowledge Base routes (T-09 / Feature #367)
// -----------------------------------------------------------------------------
// Pro / Premium therapists upload reference material (textbooks, articles,
// school-specific literature) which the AI uses as additional context when
// summarizing sessions or answering NL queries. The ingest pipeline lives in
// services/kbIngest.js; routes are auth-gated, role-gated, and tier-gated.
//
// All endpoints require an authenticated therapist or superadmin and an
// active Pro/Premium subscription. Documents are scoped to the uploading
// therapist — neither the client nor any other therapist can see them.

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const { checkSpendingLimit } = require('../services/aiUsageLogger');
const kbIngest = require('../services/kbIngest');

const router = express.Router();

// --- Storage configuration ------------------------------------------------

const KB_UPLOAD_DIR = path.resolve(__dirname, '../../data/kb');
if (!fs.existsSync(KB_UPLOAD_DIR)) {
  fs.mkdirSync(KB_UPLOAD_DIR, { recursive: true });
}

// Configurable max upload size (default 50 MB per spec).
const KB_MAX_FILE_BYTES = (() => {
  const raw = parseInt(process.env.KB_MAX_FILE_MB || '', 10);
  const mb = !isNaN(raw) && raw > 0 ? raw : 50;
  return mb * 1024 * 1024;
})();

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.txt', '.md', '.markdown', '.epub']);
const ALLOWED_MIME_PREFIXES = ['text/'];
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream', // some browsers report this for .md/.epub
  'application/epub+zip',
  'application/x-mobipocket-ebook'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, KB_UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Opaque filename — we never expose the original name on disk
    const opaque = crypto.randomUUID();
    const ext = (path.extname(file.originalname) || '').toLowerCase() || '.bin';
    cb(null, `${opaque}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: KB_MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const okMime = ALLOWED_MIMES.has(mime) || ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p));
    const okExt = ALLOWED_EXT.has(ext);
    if (okMime || okExt) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${mime || ext || 'unknown'}`), false);
    }
  }
});

// --- Tier gating ----------------------------------------------------------
// Mirrors routes/query.js: only Pro / Premium therapists can use the KB.
// Superadmin always has access.
function requireKbAccess(req, res, next) {
  if (req.user && req.user.role === 'superadmin') return next();

  const db = getDatabase();
  const subResult = db.exec(
    `SELECT plan, status FROM subscriptions WHERE therapist_id = ? ORDER BY created_at DESC LIMIT 1`,
    [req.user.id]
  );

  if (subResult.length === 0 || subResult[0].values.length === 0) {
    return res.status(403).json({
      error: 'No active subscription',
      message: 'The personal knowledge base requires a Pro or Premium subscription.',
      code: 'tier_gate'
    });
  }

  const [plan, status] = subResult[0].values[0];
  if (status !== 'active') {
    return res.status(403).json({
      error: 'Subscription inactive',
      message: 'Your subscription is not active. Please renew to use the knowledge base.',
      code: 'tier_gate'
    });
  }
  if (!['pro', 'premium'].includes(plan)) {
    return res.status(403).json({
      error: 'Plan upgrade required',
      message: 'The personal knowledge base is available on Pro and Premium plans. Upgrade to access this feature.',
      current_plan: plan,
      required_plans: ['pro', 'premium'],
      code: 'tier_gate'
    });
  }
  req.subscription = { plan, status };
  next();
}

// All routes: authenticated therapist/superadmin only, with tier-gating.
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));
router.use(requireKbAccess);

// --- GET /api/kb -----------------------------------------------------------
// Returns the therapist's KB document list, newest first.
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const therapistId = req.user.id;
    const result = db.exec(
      `SELECT id, title, mime_type, file_size, status, chunk_count, error_message, created_at, updated_at
         FROM therapist_knowledge_base
        WHERE therapist_id = ?
        ORDER BY created_at DESC`,
      [therapistId]
    );

    const documents = [];
    if (result.length > 0 && result[0].values.length > 0) {
      for (const row of result[0].values) {
        documents.push({
          id: row[0],
          title: row[1],
          mime_type: row[2],
          file_size: row[3],
          status: row[4],
          chunk_count: row[5] || 0,
          error_message: row[6],
          created_at: row[7],
          updated_at: row[8]
        });
      }
    }

    // Aggregate stats for the UI header
    let totalChunks = 0;
    let readyDocs = 0;
    for (const d of documents) {
      totalChunks += d.chunk_count || 0;
      if (d.status === 'ready') readyDocs++;
    }

    res.json({
      documents,
      stats: {
        total_documents: documents.length,
        ready_documents: readyDocs,
        total_chunks: totalChunks
      },
      max_file_bytes: KB_MAX_FILE_BYTES
    });
  } catch (e) {
    logger.error('KB list error: ' + e.message);
    res.status(500).json({ error: 'Failed to list knowledge base documents' });
  }
});

// --- POST /api/kb/upload --------------------------------------------------
// Accepts multipart/form-data with a single `file` field. Optional `title`
// field overrides the original filename (default).
router.post('/upload', upload.single('file'), async (req, res) => {
  // Spending-limit gate: embedding generates token cost; reject up-front if
  // the platform-wide monthly cap is hit.
  try {
    const spend = checkSpendingLimit();
    if (spend && spend.allowed === false) {
      // Remove the just-uploaded file before returning
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      return res.status(429).json({
        error: 'AI spending limit reached',
        message: 'The platform-wide monthly AI spending cap has been reached. Please contact your administrator.',
        code: 'spending_limit'
      });
    }
  } catch (e) {
    logger.warn('KB upload spending limit check failed: ' + e.message);
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use the "file" form field.' });
  }

  const therapistId = req.user.id;
  const original = req.file.originalname || 'untitled';
  const title = (req.body && typeof req.body.title === 'string' && req.body.title.trim().length > 0)
    ? req.body.title.trim().slice(0, 200)
    : original.slice(0, 200);
  const mime = req.file.mimetype || 'application/octet-stream';
  const filePath = req.file.path;
  const fileSize = req.file.size || 0;

  try {
    const db = getDatabase();
    db.run(
      `INSERT INTO therapist_knowledge_base (therapist_id, title, file_path, mime_type, file_size, status, chunk_count)
       VALUES (?, ?, ?, ?, ?, 'queued', 0)`,
      [therapistId, title, filePath, mime, fileSize]
    );
    const lastIdRes = db.exec('SELECT last_insert_rowid()');
    const kbId = lastIdRes[0].values[0][0];
    saveDatabaseAfterWrite();

    // Audit log
    try {
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES (?, 'kb_upload', 'knowledge_base', ?)`,
        [therapistId, kbId]
      );
      saveDatabaseAfterWrite();
    } catch (auditErr) { /* non-fatal */ }

    // Kick off async ingest (no await — we return immediately).
    setImmediate(() => {
      kbIngest.processIngest(kbId).catch(err => {
        logger.error(`KB async ingest crashed (id=${kbId}): ${err.message}`);
      });
    });

    return res.status(202).json({
      success: true,
      document: {
        id: kbId,
        title,
        mime_type: mime,
        file_size: fileSize,
        status: 'queued',
        chunk_count: 0
      },
      message: 'Document queued for ingestion. Refresh in a few seconds to see progress.'
    });
  } catch (e) {
    logger.error('KB upload insert error: ' + e.message);
    // Try to clean up the orphaned file
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    return res.status(500).json({ error: 'Failed to record uploaded document' });
  }
});

// --- DELETE /api/kb/:id ---------------------------------------------------
// Removes the document, its chunks, and its embeddings. Therapist-scoped.
router.delete('/:id', (req, res) => {
  const therapistId = req.user.id;
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid document id' });
  }
  try {
    const db = getDatabase();
    // Verify ownership first to avoid leaking ids across therapists.
    const owner = db.exec(
      'SELECT id FROM therapist_knowledge_base WHERE id = ? AND therapist_id = ?',
      [id, therapistId]
    );
    if (owner.length === 0 || owner[0].values.length === 0) {
      return res.status(404).json({ error: 'Knowledge base document not found' });
    }

    kbIngest.deleteKbDocument(id);

    // Audit log
    try {
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES (?, 'kb_delete', 'knowledge_base', ?)`,
        [therapistId, id]
      );
      saveDatabaseAfterWrite();
    } catch (_) {}

    return res.json({ success: true, id });
  } catch (e) {
    logger.error('KB delete error: ' + e.message);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

// --- Multer error handler -------------------------------------------------
router.use((err, req, res, next) => {
  if (err && err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: `Maximum upload size is ${Math.round(KB_MAX_FILE_BYTES / 1024 / 1024)} MB`,
        code: 'file_too_large'
      });
    }
    return res.status(400).json({ error: err.message, code: err.code });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }
  next();
});

module.exports = router;
