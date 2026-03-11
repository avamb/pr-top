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
const { logger } = require('../utils/logger');

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
    // Allow common audio formats
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
      'audio/webm', 'audio/aac', 'audio/flac', 'audio/m4a',
      'audio/x-m4a', 'audio/mp4', 'application/octet-stream'
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
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
      'SELECT id, therapist_id, audio_ref, transcript_encrypted FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = result[0].values[0];
    if (req.user.role !== 'superadmin' && row[1] !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
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
