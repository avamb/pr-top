// Diary Routes - Audio/video streaming for diary entries
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate, requireRole } = require('../middleware/auth');
const { getDatabase, saveDatabase } = require('../db/connection');
const { decrypt } = require('../services/encryption');
const { logger } = require('../utils/logger');
const { verifyClientConsent } = require('../utils/consentCheck');

// Directory for encrypted diary voice/video files
const DIARY_FILES_DIR = path.resolve(__dirname, '../../data/diary_files');

// GET /api/diary/:id/stream - Stream decrypted audio/video file for a diary entry
router.get('/:id/stream', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const entryId = req.params.id;

    const result = db.exec(
      'SELECT client_id, entry_type, audio_file_ref FROM diary_entries WHERE id = ?',
      [entryId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }

    const row = result[0].values[0];
    const clientId = row[0];
    const entryType = row[1];
    const audioFileRef = row[2];

    // Verify therapist owns this client (unless superadmin)
    if (req.user.role !== 'superadmin') {
      const consentCheck = verifyClientConsent(req.user.id, clientId, 'diary_stream');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    if (!audioFileRef) {
      return res.status(404).json({ error: 'No audio file available for this diary entry' });
    }

    const filePath = path.join(DIARY_FILES_DIR, audioFileRef);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Audio file not found on disk' });
    }

    // Decrypt the file: read encrypted content, decrypt to get base64, then decode to binary
    const encryptedContent = fs.readFileSync(filePath, 'utf8');
    let decryptedBase64;
    try {
      decryptedBase64 = decrypt(encryptedContent);
    } catch (e) {
      logger.error(`Failed to decrypt audio for diary entry ${entryId}: ${e.message}`);
      return res.status(500).json({ error: 'Failed to decrypt audio file' });
    }

    const audioBuffer = Buffer.from(decryptedBase64, 'base64');
    const totalSize = audioBuffer.length;

    // Determine Content-Type from audio_file_ref filename
    const ext = path.extname(audioFileRef.replace('.enc', '')).toLowerCase();
    const mimeTypes = {
      '.ogg': 'audio/ogg',
      '.oga': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
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
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'stream_diary_audio', 'diary_entry', ?, ?, datetime('now'))",
      [req.user.id, entryId, JSON.stringify({ client_id: clientId, entry_type: entryType })]
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
    logger.error('Stream diary audio error: ' + error.message);
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

module.exports = router;
