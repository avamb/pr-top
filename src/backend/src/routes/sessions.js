// Sessions Routes - Audio upload, transcript, summary management
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate, requireRole } = require('../middleware/auth');
const { getDatabase, saveDatabase } = require('../db/connection');
const { encrypt, decrypt } = require('../services/encryption');
const { processSessionTranscription } = require('../services/transcription');
const { processSessionSummary } = require('../services/summarization');
const { checkSessionLimit } = require('../utils/planLimits');
const { logger } = require('../utils/logger');
const { verifyClientConsent } = require('../utils/consentCheck');

// Configure multer for audio file uploads
// Files are stored in a non-public directory with opaque (random) filenames
const UPLOAD_DIR = path.resolve(__dirname, '../../data/sessions');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate opaque filename - no original name exposure
    const opaqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${opaqueId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow common audio and video formats (video for session recordings)
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
      'audio/webm', 'audio/aac', 'audio/flac', 'audio/m4a',
      'audio/x-m4a', 'audio/mp4', 'application/octet-stream',
      'video/webm', 'video/mp4', 'video/ogg', 'video/quicktime'
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Encrypt a file on disk (in-place replacement with encrypted version)
function encryptFileOnDisk(filePath) {
  const fileData = fs.readFileSync(filePath);
  const { encrypted, keyVersion, keyId } = encrypt(fileData.toString('base64'));
  fs.writeFileSync(filePath + '.enc', encrypted);
  // Remove the original unencrypted file
  fs.unlinkSync(filePath);
  return { encryptedPath: filePath + '.enc', keyVersion, keyId };
}

// POST /api/sessions - Upload session audio
router.post('/', authenticate, requireRole('therapist', 'superadmin'), upload.single('audio'), async (req, res) => {
  try {
    const therapistId = req.user.id;
    const clientId = req.body.client_id;

    if (!clientId) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'client_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const db = getDatabase();

    // Check session upload limit based on subscription tier
    const sessionCheck = checkSessionLimit(therapistId);
    if (!sessionCheck.allowed) {
      // Clean up uploaded file if limit reached
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        error: sessionCheck.message,
        current: sessionCheck.current,
        limit: sessionCheck.limit,
        plan: sessionCheck.plan
      });
    }

    // Verify the client belongs to this therapist
    const clientCheck = db.exec(
      "SELECT id FROM users WHERE id = ? AND role = 'client' AND therapist_id = ? AND consent_therapist_access = 1",
      [clientId, therapistId]
    );

    if (clientCheck.length === 0 || clientCheck[0].values.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Client not found or not linked to you' });
    }

    // Encrypt the uploaded audio file on disk
    const { encryptedPath, keyVersion, keyId } = encryptFileOnDisk(req.file.path);

    // Store relative path as audio_ref (opaque ID based)
    const audioRef = path.basename(encryptedPath);

    // Create session record in database
    db.run(
      `INSERT INTO sessions (therapist_id, client_id, audio_ref, encryption_key_id, payload_version, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [therapistId, clientId, audioRef, keyId, keyVersion]
    );

    // Get the created session ID
    const result = db.exec('SELECT last_insert_rowid()');
    const sessionId = result[0].values[0][0];

    // Create audit log entry
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES (?, 'session_audio_upload', 'session', ?)",
      [therapistId, sessionId]
    );

    saveDatabase();

    logger.info(`Session audio uploaded: session_id=${sessionId}, therapist=${therapistId}, client=${clientId}`);

    // Trigger transcription asynchronously (don't block the response)
    processSessionTranscription(sessionId).then(result => {
      if (result.success) {
        logger.info(`Auto-transcription completed for session ${sessionId}`);
      } else {
        logger.warn(`Auto-transcription failed for session ${sessionId}: ${result.error}`);
      }
    }).catch(err => {
      logger.error(`Auto-transcription error for session ${sessionId}: ${err.message}`);
    });

    res.status(201).json({
      id: sessionId,
      therapist_id: therapistId,
      client_id: parseInt(clientId),
      audio_ref: audioRef,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.error('Session upload error: ' + error.message);
    res.status(500).json({ error: 'Failed to upload session audio' });
  }
});

// GET /api/sessions/:id - Get session details
router.get('/:id', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const result = db.exec(
      `SELECT id, therapist_id, client_id, audio_ref, transcript_encrypted, summary_encrypted,
              encryption_key_id, payload_version, status, scheduled_at, created_at, updated_at
       FROM sessions WHERE id = ?`,
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result[0].values[0];

    // Verify therapist owns this session (unless superadmin)
    if (req.user.role !== 'superadmin' && row[1] !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify client consent (unless superadmin)
    if (req.user.role !== 'superadmin' && row[2]) {
      const consentCheck = verifyClientConsent(req.user.id, row[2], 'session');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    const session = {
      id: row[0],
      therapist_id: row[1],
      client_id: row[2],
      audio_ref: row[3],
      has_transcript: !!row[4],
      has_summary: !!row[5],
      status: row[8],
      scheduled_at: row[9],
      created_at: row[10],
      updated_at: row[11]
    };

    // Decrypt transcript if present
    if (row[4]) {
      try {
        session.transcript = decrypt(row[4]);
      } catch (e) {
        session.transcript = null;
        session.transcript_error = 'Decryption failed';
      }
    }

    // Decrypt summary if present
    if (row[5]) {
      try {
        session.summary = decrypt(row[5]);
      } catch (e) {
        session.summary = null;
        session.summary_error = 'Decryption failed';
      }
    }

    // Audit log: reading session data (Class A - transcript, summary)
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'read_session', 'session', ?, ?, datetime('now'))",
      [req.user.id, sessionId, JSON.stringify({ client_id: row[2], has_transcript: !!row[4], has_summary: !!row[5] })]
    );
    saveDatabase();

    res.json(session);
  } catch (error) {
    logger.error('Get session error: ' + error.message);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// POST /api/sessions/:id/transcribe - Manually trigger transcription
router.post('/:id/transcribe', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    // Verify session exists and belongs to therapist
    const result = db.exec(
      'SELECT id, therapist_id, audio_ref, transcript_encrypted, client_id FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result[0].values[0];
    if (req.user.role !== 'superadmin' && row[1] !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify client consent (unless superadmin)
    if (req.user.role !== 'superadmin' && row[4]) {
      const consentCheck = verifyClientConsent(req.user.id, row[4], 'session_transcribe');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    if (!row[2]) {
      return res.status(400).json({ error: 'No audio file to transcribe' });
    }

    const transcriptionResult = await processSessionTranscription(parseInt(sessionId));

    if (transcriptionResult.success) {
      res.json({ message: 'Transcription completed successfully', session_id: parseInt(sessionId) });
    } else {
      res.status(500).json({ error: 'Transcription failed', details: transcriptionResult.error });
    }
  } catch (error) {
    logger.error('Manual transcription error: ' + error.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// POST /api/sessions/:id/summarize - Manually trigger summary generation
router.post('/:id/summarize', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const result = db.exec(
      'SELECT id, therapist_id, transcript_encrypted, client_id FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result[0].values[0];
    if (req.user.role !== 'superadmin' && row[1] !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify client consent (unless superadmin)
    if (req.user.role !== 'superadmin' && row[3]) {
      const consentCheck = verifyClientConsent(req.user.id, row[3], 'session_summarize');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    if (!row[2]) {
      return res.status(400).json({ error: 'No transcript available. Transcribe the session first.' });
    }

    const summaryResult = await processSessionSummary(parseInt(sessionId));

    if (summaryResult.success) {
      res.json({ message: 'Summary generated successfully', session_id: parseInt(sessionId) });
    } else {
      res.status(500).json({ error: 'Summary generation failed', details: summaryResult.error });
    }
  } catch (error) {
    logger.error('Manual summary error: ' + error.message);
    res.status(500).json({ error: 'Summary generation failed' });
  }
});

// GET /api/sessions/:id/summary - Get just the summary
router.get('/:id/summary', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const result = db.exec(
      'SELECT therapist_id, summary_encrypted, client_id FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result[0].values[0];
    if (req.user.role !== 'superadmin' && row[0] !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify client consent (unless superadmin)
    if (req.user.role !== 'superadmin' && row[2]) {
      const consentCheck = verifyClientConsent(req.user.id, row[2], 'session_summary');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    if (!row[1]) {
      return res.status(404).json({ error: 'No summary available for this session' });
    }

    const summary = decrypt(row[1]);
    res.json({ session_id: parseInt(sessionId), summary });
  } catch (error) {
    logger.error('Get summary error: ' + error.message);
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

// GET /api/sessions/:id/transcript - Get just the transcript
router.get('/:id/transcript', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const result = db.exec(
      'SELECT therapist_id, transcript_encrypted, client_id FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result[0].values[0];
    if (req.user.role !== 'superadmin' && row[0] !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify client consent (unless superadmin)
    if (req.user.role !== 'superadmin' && row[2]) {
      const consentCheck = verifyClientConsent(req.user.id, row[2], 'session_transcript');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    if (!row[1]) {
      return res.status(404).json({ error: 'No transcript available for this session' });
    }

    const transcript = decrypt(row[1]);
    res.json({ session_id: parseInt(sessionId), transcript });
  } catch (error) {
    logger.error('Get transcript error: ' + error.message);
    res.status(500).json({ error: 'Failed to retrieve transcript' });
  }
});

// DELETE /api/sessions/:id - Delete a session and its associated files
router.delete('/:id', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const result = db.exec(
      'SELECT id, therapist_id, client_id, audio_ref FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result[0].values[0];
    if (req.user.role !== 'superadmin' && row[1] !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify client consent (unless superadmin)
    if (req.user.role !== 'superadmin' && row[2]) {
      const consentCheck = verifyClientConsent(req.user.id, row[2], 'session_delete');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    // Delete associated vector embeddings
    db.run(
      "DELETE FROM vector_embeddings WHERE source_type IN ('session_transcript', 'session_summary') AND source_id = ?",
      [sessionId]
    );

    // Delete the audio file if it exists
    if (row[3]) {
      const audioPath = path.join(UPLOAD_DIR, row[3]);
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }

    // Delete the session record
    db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
    saveDatabase();

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'delete_session', 'session', ?, ?, datetime('now'))",
      [req.user.id, sessionId, JSON.stringify({ client_id: row[2] })]
    );
    saveDatabase();

    logger.info(`Therapist ${req.user.id} deleted session ${sessionId}`);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    logger.error('Delete session error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// GET /api/sessions/:id/stream - Stream decrypted audio/video file
router.get('/:id/stream', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const result = db.exec(
      'SELECT therapist_id, client_id, audio_ref FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result[0].values[0];
    const therapistId = row[0];
    const clientId = row[1];
    const audioRef = row[2];

    // Verify therapist owns this session (unless superadmin)
    if (req.user.role !== 'superadmin' && therapistId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify client consent
    if (req.user.role !== 'superadmin' && clientId) {
      const consentCheck = verifyClientConsent(req.user.id, clientId, 'session_stream');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    if (!audioRef) {
      return res.status(404).json({ error: 'No audio file available for this session' });
    }

    const filePath = path.join(UPLOAD_DIR, audioRef);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Audio file not found on disk' });
    }

    // Decrypt the file: read encrypted content, decrypt to get base64, then decode to binary
    const encryptedContent = fs.readFileSync(filePath, 'utf8');
    let decryptedBase64;
    try {
      decryptedBase64 = decrypt(encryptedContent);
    } catch (e) {
      logger.error(`Failed to decrypt audio for session ${sessionId}: ${e.message}`);
      return res.status(500).json({ error: 'Failed to decrypt audio file' });
    }

    const audioBuffer = Buffer.from(decryptedBase64, 'base64');
    const totalSize = audioBuffer.length;

    // Determine Content-Type from audio_ref filename
    const ext = path.extname(audioRef.replace('.enc', '')).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
      '.mp4': 'video/mp4',
      '.mkv': 'video/x-matroska',
      '.mov': 'video/quicktime'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'stream_session_audio', 'session', ?, ?, datetime('now'))",
      [req.user.id, sessionId, JSON.stringify({ client_id: clientId })]
    );
    saveDatabase();

    // Handle range requests for seeking
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        res.status(416).set('Content-Range', `bytes */${totalSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      });
      res.end(audioBuffer.slice(start, end + 1));
    } else {
      res.set({
        'Content-Length': totalSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store'
      });
      res.end(audioBuffer);
    }
  } catch (error) {
    logger.error('Stream session audio error: ' + error.message);
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

// Handle multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err.message === 'Only audio files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
