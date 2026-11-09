// Diary Routes - Audio/video streaming for diary entries
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate, requireRole } = require('../middleware/auth');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { decrypt } = require('../services/encryption');
const { logger } = require('../utils/logger');
const { verifyClientConsent } = require('../utils/consentCheck');
const fileCrypto = require('../services/fileCrypto');
const { mimeFromRef } = require('../utils/mediaSniff');
const { createMediaUrl, mediaAuth } = require('../utils/mediaLinks');

// Directory for encrypted diary voice/video files
const DIARY_FILES_DIR = path.resolve(__dirname, '../../data/diary_files');

// Audit rule (one row per access path; HEAD never audits):
//   - GET /media-url writes the row: every signed link issued = one row,
//     even if the player then makes many Range requests with it;
//   - a stream request authenticated by cookie / Bearer (not a signed link)
//     writes one row per request, whatever its Range.
// So no download — full or ranged — can bypass the audit trail.
function auditDiaryStream(req, entryId, media, via) {
  const db = getDatabase();
  db.run(
    "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'stream_diary_audio', 'diary_entry', ?, ?, datetime('now'))",
    [req.user.id, entryId, JSON.stringify({ client_id: media.clientId, entry_type: media.entryType, via })]
  );
  saveDatabaseAfterWrite();
}

// Shared authorization for a diary entry's media (stream + media-url).
// Unchanged from the pre-wave-3 stream route: private entries are invisible
// (404, no superadmin bypass), the caller must be the client's linked
// therapist with consent in force.
function authorizeDiaryMedia(req) {
  const db = getDatabase();
  const result = db.exec(
    'SELECT client_id, entry_type, audio_file_ref, is_private FROM diary_entries WHERE id = ?',
    [req.params.id]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return { status: 404, error: 'Diary entry not found' };
  }

  const [clientId, entryType, audioFileRef, isPrivateRaw] = result[0].values[0];

  // T-12: client-private diary entries are invisible to therapists; don't even
  // confirm existence to avoid information leak.
  // Audit H5: no superadmin bypass — superadmin is a platform role and
  // must not read client clinical content (private entries included).
  if (isPrivateRaw) {
    return { status: 404, error: 'Diary entry not found' };
  }

  // Verify the caller is the client's linked therapist and consent is granted
  const consentCheck = verifyClientConsent(req.user.id, clientId, 'diary_stream');
  if (!consentCheck.allowed) {
    return { status: consentCheck.status, error: consentCheck.error };
  }

  if (!audioFileRef || path.basename(audioFileRef) !== audioFileRef) {
    return { status: 404, error: 'No audio file available for this diary entry' };
  }

  const filePath = path.join(DIARY_FILES_DIR, audioFileRef);
  if (!fs.existsSync(filePath)) {
    return { status: 404, error: 'Audio file not found on disk' };
  }
  return { clientId, entryType, audioFileRef, filePath };
}

// GET /api/diary/:id/media-url - short-lived signed URL for <audio>/<video src>.
router.get('/:id/media-url', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }
    const media = authorizeDiaryMedia(req);
    if (media.error) return res.status(media.status).json({ error: media.error });

    let contentType = mimeFromRef(media.audioFileRef);
    try {
      const info = await fileCrypto.readFileInfo(media.filePath);
      if (info.contentType) contentType = info.contentType;
      if (info.format === 'legacy') {
        fileCrypto.upgradeLegacyFile(media.filePath, { contentTypeHint: contentType })
          .catch((e) => logger.warn(`Legacy upgrade of diary ${req.params.id} media failed: ${e.code || e.message}`));
      }
    } catch (e) {
      logger.warn(`Diary ${req.params.id} media info failed: ${e.message}`);
    }

    const entryId = parseInt(req.params.id, 10);
    auditDiaryStream(req, entryId, media, 'media_url');
    const { url, expiresAt } = createMediaUrl({
      kind: 'diary',
      resourceId: entryId,
      userId: req.user.id,
      streamPath: `/api/diary/${entryId}/stream`,
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({ url, expires_at: expiresAt, content_type: contentType, is_video: contentType.startsWith('video/') });
  } catch (error) {
    logger.error('Diary media-url error: ' + error.message);
    res.status(500).json({ error: 'Failed to prepare audio' });
  }
});

// GET /api/diary/:id/stream - Stream decrypted audio/video file for a diary entry.
// Auth: session cookie / Bearer, or a signed link from /media-url. Range
// requests get 206 and only the covering chunks are decrypted.
router.get('/:id/stream', mediaAuth('diary'), requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const entryId = req.params.id;
    const media = authorizeDiaryMedia(req);
    if (media.error) return res.status(media.status).json({ error: media.error });

    await fileCrypto.serveEncryptedFile(req, res, media.filePath, {
      contentTypeHint: mimeFromRef(media.audioFileRef),
      notFoundMessage: 'Audio file not found on disk',
      decryptErrorMessage: 'Failed to decrypt audio file',
      // See the audit rule above: signed-link requests were audited when
      // the link was issued; HEAD never transfers content.
      onServe: () => {
        if (req.mediaLink || req.method === 'HEAD') return;
        auditDiaryStream(req, entryId, media, 'direct');
      },
    });
  } catch (error) {
    logger.error('Stream diary audio error: ' + error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to stream audio' });
    else res.destroy();
  }
});

// POST /api/diary/:id/retranscribe - Retry transcription for a diary entry (linked therapist only)
router.post('/:id/retranscribe', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const entryId = req.params.id;

    const result = db.exec(
      'SELECT client_id, entry_type, audio_file_ref, is_private FROM diary_entries WHERE id = ?',
      [entryId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }

    const row = result[0].values[0];
    const clientId = row[0];
    const entryType = row[1];
    const audioFileRef = row[2];
    const isPrivate = !!row[3];

    // T-12: client-private diary entries are invisible to therapists.
    // Audit H5: no superadmin bypass — superadmin is a platform role and
    // must not read client clinical content (private entries included).
    if (isPrivate) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }

    // Verify the caller is the client's linked therapist and consent is granted
    const consentCheck = verifyClientConsent(req.user.id, clientId, 'diary_retranscribe');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    if (entryType !== 'voice' && entryType !== 'video') {
      return res.status(400).json({ error: 'Only voice and video entries can be transcribed' });
    }

    // Check if transcription is possible: need audio file or content (for dev mode fallback)
    const { isConfigured, processDiaryTranscription } = require('../services/diaryTranscription');
    if (!audioFileRef && isConfigured()) {
      return res.status(400).json({ error: 'No audio file available for transcription' });
    }
    if (!audioFileRef) {
      // In dev mode, check if there's at least content to work with
      const contentCheck = db.exec('SELECT content_encrypted FROM diary_entries WHERE id = ?', [entryId]);
      const hasContent = contentCheck.length > 0 && contentCheck[0].values.length > 0 && contentCheck[0].values[0][0];
      if (!hasContent) {
        return res.status(400).json({ error: 'No audio file or content available for transcription' });
      }
    }
    const txResult = await processDiaryTranscription(parseInt(entryId), true); // force=true to re-transcribe

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'retranscribe_diary', 'diary_entry', ?, ?, datetime('now'))",
      [req.user.id, entryId, JSON.stringify({ client_id: clientId, entry_type: entryType, success: txResult.success })]
    );
    saveDatabaseAfterWrite();

    if (txResult.success) {
      // Return the new transcript (decrypted)
      const updated = db.exec(
        'SELECT transcript_encrypted FROM diary_entries WHERE id = ?',
        [entryId]
      );
      let transcript = null;
      if (updated.length > 0 && updated[0].values.length > 0 && updated[0].values[0][0]) {
        try { transcript = decrypt(updated[0].values[0][0]); } catch (e) { transcript = '[decryption error]'; }
      }
      res.json({ success: true, transcript });
    } else {
      res.status(400).json({ error: txResult.error || 'Transcription failed' });
    }
  } catch (error) {
    logger.error('Retranscribe diary error: ' + error.message);
    res.status(500).json({ error: 'Transcription failed: ' + error.message });
  }
});

module.exports = router;
