// Sessions Routes - Audio upload, transcript, summary management
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate, requireRole } = require('../middleware/auth');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { encrypt, decrypt } = require('../services/encryption');
const { processSessionTranscription, transcribeAudio, isConfigured: isTranscriptionConfigured } = require('../services/transcription');
const { processSessionSummary } = require('../services/summarization');
const { processSessionDiarization } = require('../services/diarization');
const { checkSessionLimit } = require('../utils/planLimits');
const { logger } = require('../utils/logger');
const { verifyClientConsent } = require('../utils/consentCheck');
const assignmentsService = require('../services/assignments');

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
    // Optional metadata coming from the New Session admin form (T-07).
    // - scheduled_at maps to the existing sessions.scheduled_at column (meeting_date, T-02 compatible)
    // - title is a short free-form label for the session
    // - inquiry_id (T-01) optionally links the session to a client inquiry/work thread
    const rawScheduledAt = typeof req.body.scheduled_at === 'string' ? req.body.scheduled_at.trim() : '';
    const rawTitle = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const rawInquiryId = req.body.inquiry_id;
    const scheduledAt = rawScheduledAt ? rawScheduledAt : null;
    const title = rawTitle ? rawTitle.slice(0, 200) : null;
    const inquiryId = rawInquiryId !== undefined && rawInquiryId !== null && rawInquiryId !== ''
      ? parseInt(rawInquiryId, 10)
      : null;

    // T-19: Single-track recording mode. When the client did not consent to
    // being recorded but the therapist still wants AI summary, the upload is
    // marked recording_mode='single_track'. The system then runs speaker
    // diarization and waits for the therapist to confirm which detected
    // speaker is their own voice; only that track is transcribed/summarised.
    // Default 'mixed' preserves the original behaviour for consented sessions.
    const rawRecordingMode = typeof req.body.recording_mode === 'string'
      ? req.body.recording_mode.trim().toLowerCase()
      : 'mixed';
    const recordingMode = rawRecordingMode === 'single_track' ? 'single_track' : 'mixed';

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

    if (inquiryId !== null && (Number.isNaN(inquiryId) || inquiryId <= 0)) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'inquiry_id must be a positive integer' });
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

    // If an inquiry_id was provided, verify it belongs to this therapist+client pair.
    if (inquiryId !== null) {
      const inquiryCheck = db.exec(
        'SELECT id FROM inquiries WHERE id = ? AND therapist_id = ? AND client_id = ?',
        [inquiryId, therapistId, clientId]
      );
      if (inquiryCheck.length === 0 || inquiryCheck[0].values.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'inquiry_id not found for this client' });
      }
    }

    // Encrypt the uploaded audio file on disk
    const { encryptedPath, keyVersion, keyId } = encryptFileOnDisk(req.file.path);

    // Store relative path as audio_ref (opaque ID based)
    const audioRef = path.basename(encryptedPath);

    // Create session record in database (T-07: optional title/scheduled_at/inquiry_id; T-19: recording_mode)
    // For single_track mode, status starts as 'diarizing' so the UI can show a
    // distinct waiting state ("detecting speakers…") until the therapist picks
    // their voice. The mixed flow keeps the legacy 'pending' status.
    const initialStatus = recordingMode === 'single_track' ? 'diarizing' : 'pending';
    db.run(
      `INSERT INTO sessions (therapist_id, client_id, audio_ref, encryption_key_id, payload_version, status, scheduled_at, title, inquiry_id, recording_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [therapistId, clientId, audioRef, keyId, keyVersion, initialStatus, scheduledAt, title, inquiryId, recordingMode]
    );

    // Get the created session ID
    const result = db.exec('SELECT last_insert_rowid()');
    const sessionId = result[0].values[0][0];

    // Create audit log entry — mode included so we can audit who used single-track
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'session_audio_upload', 'session', ?, ?, datetime('now'))",
      [therapistId, sessionId, JSON.stringify({ recording_mode: recordingMode })]
    );

    saveDatabaseAfterWrite();

    logger.info(`Session audio uploaded: session_id=${sessionId}, therapist=${therapistId}, client=${clientId}, mode=${recordingMode}`);

    // Trigger downstream processing asynchronously (don't block the response).
    // - mixed:        run transcription → summary chain (legacy behaviour)
    // - single_track: run diarization first; the therapist must then call
    //                 POST /api/sessions/:id/select-speaker, which kicks off
    //                 transcription with the chosen speaker filter.
    if (recordingMode === 'single_track') {
      processSessionDiarization(sessionId).then(r => {
        if (r && r.success) {
          logger.info(`Diarization completed for session ${sessionId} (${r.speakerCount} speakers detected)`);
        } else {
          logger.warn(`Diarization failed for session ${sessionId}: ${r && r.error}`);
        }
      }).catch(err => {
        logger.error(`Diarization error for session ${sessionId}: ${err.message}`);
      });
    } else {
      processSessionTranscription(sessionId).then(result => {
        if (result.success) {
          logger.info(`Auto-transcription completed for session ${sessionId}`);
        } else {
          logger.warn(`Auto-transcription failed for session ${sessionId}: ${result.error}`);
        }
      }).catch(err => {
        logger.error(`Auto-transcription error for session ${sessionId}: ${err.message}`);
      });
    }

    res.status(201).json({
      id: sessionId,
      therapist_id: therapistId,
      client_id: parseInt(clientId),
      audio_ref: audioRef,
      scheduled_at: scheduledAt,
      title: title,
      inquiry_id: inquiryId,
      recording_mode: recordingMode,
      status: initialStatus,
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
              encryption_key_id, payload_version, status, scheduled_at, created_at, updated_at,
              title, inquiry_id, post_session_notes_encrypted,
              recording_mode, selected_speaker_label, speaker_segments_json
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
      // T-02: meeting_date is the canonical name for scheduled_at in the
      // PR-TOP product. We expose both keys so older callers keep working
      // and the new calendar widget can read meeting_date directly.
      meeting_date: row[9],
      created_at: row[10],
      updated_at: row[11],
      title: row[12] || null,
      inquiry_id: row[13] != null ? row[13] : null,
      post_session_notes: null,
      // T-19: single-track recording fields. `speakers` is only populated while
      // the session is awaiting speaker-selection (status='awaiting_speaker_selection').
      // Once the therapist picks a speaker we clear `speaker_segments_json` so
      // the other-speaker timing data is not retained on disk.
      recording_mode: row[15] || 'mixed',
      selected_speaker_label: row[16] || null,
      speakers: null
    };

    // Parse speaker_segments_json into a typed array for the UI. We only expose
    // it while the therapist still needs to choose a speaker. After selection
    // the column is cleared, so older completed sessions never leak speaker data.
    if (row[17]) {
      try {
        const parsed = JSON.parse(row[17]);
        if (parsed && Array.isArray(parsed.speakers)) {
          session.speakers = parsed.speakers;
          session.audio_total_duration_sec = parsed.totalDurationSec || null;
        } else if (Array.isArray(parsed)) {
          // Tolerate the bare-array variant in case an earlier worker wrote it that way.
          session.speakers = parsed;
        }
      } catch (e) {
        logger.warn(`Failed to parse speaker_segments_json for session ${sessionId}: ${e.message}`);
      }
    }

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

    // Decrypt post-session therapist notes (T-15) — therapist-only field, never
    // exposed to client surfaces. The role gate above already restricts /api/sessions
    // to therapist + superadmin, so any client calling this endpoint never reaches
    // here in the first place.
    if (row[14]) {
      try {
        session.post_session_notes = decrypt(row[14]);
      } catch (e) {
        session.post_session_notes = null;
        session.post_session_notes_error = 'Decryption failed';
      }
    }

    // Audit log: reading session data (Class A - transcript, summary)
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'read_session', 'session', ?, ?, datetime('now'))",
      [req.user.id, sessionId, JSON.stringify({ client_id: row[2], has_transcript: !!row[4], has_summary: !!row[5] })]
    );
    saveDatabaseAfterWrite();

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

// PATCH /api/sessions/:id - Update therapist-only fields on a session.
// T-15: post_session_notes — short note ("на что обратить внимание в следующий раз").
// The note is Class A encrypted on save and never returned to clients (the route
// is already gated to therapist/superadmin). Other PATCHable fields can be added
// here in the future without changing the API surface.
router.patch('/:id', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const result = db.exec(
      'SELECT id, therapist_id, client_id FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const row = result[0].values[0];

    if (req.user.role !== 'superadmin' && row[1] !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role !== 'superadmin' && row[2]) {
      const consentCheck = verifyClientConsent(req.user.id, row[2], 'session_update');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    // Supported PATCH fields:
    //   - post_session_notes (T-15) — Class A encrypted, string or null
    //   - title              (T-02) — short label, string or null (≤200 chars)
    //   - meeting_date /
    //     scheduled_at       (T-02) — ISO date (YYYY-MM-DD) or full datetime
    //                                 string, or null to clear
    //   - inquiry_id         (T-02) — positive int (must belong to same
    //                                 therapist+client) or null to detach
    // At least one of those keys must be present.
    const body = req.body || {};
    const hasPostNotes  = Object.prototype.hasOwnProperty.call(body, 'post_session_notes');
    const hasTitle      = Object.prototype.hasOwnProperty.call(body, 'title');
    const hasMeeting    = Object.prototype.hasOwnProperty.call(body, 'meeting_date')
                       || Object.prototype.hasOwnProperty.call(body, 'scheduled_at');
    const hasInquiry    = Object.prototype.hasOwnProperty.call(body, 'inquiry_id');

    if (!hasPostNotes && !hasTitle && !hasMeeting && !hasInquiry) {
      return res.status(400).json({
        error: 'No supported fields to update. Pass post_session_notes, title, meeting_date, or inquiry_id.'
      });
    }

    // ---- Validate each field upfront so we never half-update on bad input ----
    let postNotesCapped = null;
    if (hasPostNotes) {
      const raw = body.post_session_notes;
      if (raw !== null && typeof raw !== 'string') {
        return res.status(400).json({ error: 'post_session_notes must be a string or null' });
      }
      const value = raw === null ? '' : raw.toString().trim();
      postNotesCapped = value.slice(0, 10000);
    }

    let titleCapped = undefined;
    if (hasTitle) {
      const raw = body.title;
      if (raw !== null && typeof raw !== 'string') {
        return res.status(400).json({ error: 'title must be a string or null' });
      }
      const value = raw === null ? '' : raw.toString().trim();
      titleCapped = value === '' ? null : value.slice(0, 200);
    }

    let meetingDateValue = undefined;
    if (hasMeeting) {
      const raw = Object.prototype.hasOwnProperty.call(body, 'meeting_date')
        ? body.meeting_date
        : body.scheduled_at;
      if (raw === null || raw === '') {
        meetingDateValue = null;
      } else if (typeof raw !== 'string') {
        return res.status(400).json({ error: 'meeting_date must be an ISO date string or null' });
      } else {
        const trimmed = raw.trim();
        // Accept YYYY-MM-DD or full ISO timestamp; reject anything Date can't parse.
        const isShortDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
        const parsed = new Date(trimmed);
        if (!isShortDate && Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'meeting_date must be a valid date (YYYY-MM-DD or ISO 8601)' });
        }
        meetingDateValue = trimmed;
      }
    }

    let inquiryIdValue = undefined;
    if (hasInquiry) {
      const raw = body.inquiry_id;
      if (raw === null || raw === '') {
        inquiryIdValue = null;
      } else {
        const inqId = typeof raw === 'number' ? raw : parseInt(raw, 10);
        if (!Number.isInteger(inqId) || inqId <= 0) {
          return res.status(400).json({ error: 'inquiry_id must be a positive integer or null' });
        }
        // Must belong to the same therapist + client pair.
        const inqCheck = db.exec(
          'SELECT id FROM inquiries WHERE id = ? AND therapist_id = ? AND client_id = ?',
          [inqId, row[1], row[2]]
        );
        if (inqCheck.length === 0 || inqCheck[0].values.length === 0) {
          return res.status(400).json({ error: 'inquiry_id not found for this client' });
        }
        inquiryIdValue = inqId;
      }
    }

    // ---- Apply updates ----
    if (hasPostNotes) {
      if (postNotesCapped === '') {
        db.run(
          "UPDATE sessions SET post_session_notes_encrypted = NULL, updated_at = datetime('now') WHERE id = ?",
          [sessionId]
        );
      } else {
        const { encrypted, keyVersion, keyId } = encrypt(postNotesCapped);
        db.run(
          `UPDATE sessions
           SET post_session_notes_encrypted = ?, encryption_key_id = ?, payload_version = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [encrypted, keyId, keyVersion, sessionId]
        );
      }
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'session_update_post_notes', 'session', ?, ?, datetime('now'))",
        [req.user.id, sessionId, JSON.stringify({ length: postNotesCapped.length, cleared: postNotesCapped.length === 0 })]
      );
    }

    if (hasTitle) {
      db.run(
        "UPDATE sessions SET title = ?, updated_at = datetime('now') WHERE id = ?",
        [titleCapped, sessionId]
      );
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'session_update_title', 'session', ?, ?, datetime('now'))",
        [req.user.id, sessionId, JSON.stringify({ length: titleCapped ? titleCapped.length : 0, cleared: titleCapped === null })]
      );
    }

    if (hasMeeting) {
      db.run(
        "UPDATE sessions SET scheduled_at = ?, updated_at = datetime('now') WHERE id = ?",
        [meetingDateValue, sessionId]
      );
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'session_update_meeting_date', 'session', ?, ?, datetime('now'))",
        [req.user.id, sessionId, JSON.stringify({ meeting_date: meetingDateValue })]
      );
    }

    if (hasInquiry) {
      db.run(
        "UPDATE sessions SET inquiry_id = ?, updated_at = datetime('now') WHERE id = ?",
        [inquiryIdValue, sessionId]
      );
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'session_update_inquiry', 'session', ?, ?, datetime('now'))",
        [req.user.id, sessionId, JSON.stringify({ inquiry_id: inquiryIdValue })]
      );
    }

    saveDatabaseAfterWrite();

    // Re-read the canonical row so the response reflects exactly what is in the DB.
    const after = db.exec(
      'SELECT scheduled_at, title, inquiry_id FROM sessions WHERE id = ?',
      [sessionId]
    );
    const afterRow = (after.length > 0 && after[0].values.length > 0) ? after[0].values[0] : [null, null, null];

    res.json({
      success: true,
      session_id: parseInt(sessionId),
      post_session_notes: hasPostNotes ? (postNotesCapped || null) : undefined,
      title: afterRow[1] || null,
      meeting_date: afterRow[0] || null,
      scheduled_at: afterRow[0] || null,
      inquiry_id: afterRow[2] != null ? afterRow[2] : null
    });
  } catch (error) {
    logger.error('Patch session error: ' + error.message);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// POST /api/sessions/:id/transcribe-voice-note - T-15: short ad-hoc voice note
// for the post-session notes field. Accepts a small audio blob (multipart),
// runs it through the transcription service, and returns the resulting text
// WITHOUT persisting the audio. The therapist then decides whether to commit
// the text to post_session_notes via PATCH.
router.post('/:id/transcribe-voice-note', authenticate, requireRole('therapist', 'superadmin'), upload.single('audio'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const result = db.exec(
      'SELECT id, therapist_id, client_id FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      // Clean up uploaded temp file
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(404).json({ error: 'Session not found' });
    }
    const row = result[0].values[0];

    if (req.user.role !== 'superadmin' && row[1] !== req.user.id) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role !== 'superadmin' && row[2]) {
      const consentCheck = verifyClientConsent(req.user.id, row[2], 'session_voice_note');
      if (!consentCheck.allowed) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    // Read raw audio and transcribe. We never encrypt or persist this audio —
    // it is processed once and the temp file is unlinked.
    let transcript = '';
    try {
      const audioBuffer = fs.readFileSync(req.file.path);
      const { transcribeAudioBuffer } = require('../services/transcription');
      const result = await transcribeAudioBuffer(audioBuffer);
      transcript = (result && result.text) ? result.text : '';
    } finally {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }

    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'session_voice_note_transcribed', 'session', ?, ?, datetime('now'))",
      [req.user.id, sessionId, JSON.stringify({ length: transcript.length })]
    );
    saveDatabaseAfterWrite();

    res.json({ session_id: parseInt(sessionId), transcript });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    logger.error('Voice note transcription error: ' + error.message);
    res.status(500).json({ error: 'Failed to transcribe voice note' });
  }
});

// POST /api/sessions/:id/select-speaker - T-19 single-track flow.
// After diarization, the therapist confirms which detected speaker is their
// own voice (via the audio-preview UI). Only the selected speaker's transcript
// is generated; the other speakers' segment metadata is cleared from disk so
// the unselected tracks are NOT retained.
router.post('/:id/select-speaker', authenticate, requireRole('therapist', 'superadmin'), async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const speakerLabel = typeof req.body.speaker_label === 'string'
      ? req.body.speaker_label.trim()
      : '';
    if (!/^speaker_\d+$/.test(speakerLabel)) {
      return res.status(400).json({ error: 'speaker_label must be like "speaker_0"' });
    }

    const result = db.exec(
      `SELECT id, therapist_id, client_id, status, recording_mode,
              selected_speaker_label, speaker_segments_json
       FROM sessions WHERE id = ?`,
      [sessionId]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const row = result[0].values[0];
    const [, therapistId, clientId, status, recordingMode, alreadySelected, segmentsJson] = row;

    if (req.user.role !== 'superadmin' && therapistId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role !== 'superadmin' && clientId) {
      const consentCheck = verifyClientConsent(req.user.id, clientId, 'session_select_speaker');
      if (!consentCheck.allowed) {
        return res.status(consentCheck.status).json({ error: consentCheck.error });
      }
    }

    if (recordingMode !== 'single_track') {
      return res.status(400).json({ error: 'Speaker selection only applies to single_track recordings' });
    }

    // Idempotent: if a speaker has already been chosen, just acknowledge it.
    // Don't re-trigger transcription on a second click.
    if (alreadySelected) {
      return res.json({
        success: true,
        session_id: parseInt(sessionId),
        selected_speaker_label: alreadySelected,
        status,
        already_selected: true
      });
    }

    if (!segmentsJson) {
      return res.status(400).json({
        error: 'Speaker segments not available. Diarization may still be running or has failed.'
      });
    }

    let parsedSegments = null;
    try {
      parsedSegments = JSON.parse(segmentsJson);
    } catch (_) {
      return res.status(500).json({ error: 'Stored speaker segments are corrupt' });
    }

    const speakers = (parsedSegments && Array.isArray(parsedSegments.speakers))
      ? parsedSegments.speakers
      : (Array.isArray(parsedSegments) ? parsedSegments : []);
    const matched = speakers.find(s => s && s.label === speakerLabel);
    if (!matched) {
      return res.status(400).json({ error: `speaker_label '${speakerLabel}' not found in detected speakers` });
    }

    // Persist the selection AND clear speaker_segments_json so the other-speaker
    // timing data is not retained on disk. Move status to 'transcribing' so the
    // UI shows the right spinner while the transcription chain runs.
    db.run(
      `UPDATE sessions
       SET selected_speaker_label = ?, speaker_segments_json = NULL,
           status = 'transcribing', updated_at = datetime('now')
       WHERE id = ?`,
      [speakerLabel, sessionId]
    );
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'session_speaker_selected', 'session', ?, ?, datetime('now'))",
      [req.user.id, sessionId, JSON.stringify({ speaker_label: speakerLabel })]
    );
    saveDatabaseAfterWrite();

    logger.info(`Session ${sessionId}: therapist ${req.user.id} selected ${speakerLabel}; kicking off transcription`);

    // Fire transcription asynchronously. The transcription service inspects
    // selected_speaker_label and runs filterTranscriptToSpeaker before
    // encrypting, so only the chosen speaker's text reaches the DB.
    processSessionTranscription(parseInt(sessionId)).then(r => {
      if (r && r.success) {
        logger.info(`Single-track transcription complete for session ${sessionId}`);
      } else {
        logger.warn(`Single-track transcription failed for session ${sessionId}: ${r && r.error}`);
      }
    }).catch(err => {
      logger.error(`Single-track transcription error for session ${sessionId}: ${err.message}`);
    });

    res.json({
      success: true,
      session_id: parseInt(sessionId),
      selected_speaker_label: speakerLabel,
      status: 'transcribing'
    });
  } catch (error) {
    logger.error('Select speaker error: ' + error.message);
    res.status(500).json({ error: 'Failed to select speaker' });
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

    // T-03: Detach (but don't delete) any assignments hanging off this
    // session — the homework thread for the client should survive even if
    // the parent session recording is removed. The FK uses ON DELETE SET
    // NULL but we do it explicitly so the behavior holds even if FK PRAGMA
    // state shifts in the future.
    try {
      db.run('UPDATE assignments SET session_id = NULL WHERE session_id = ?', [sessionId]);
    } catch (e) {
      logger.warn('T-03: failed to detach assignments before session delete: ' + e.message);
    }

    // Delete the session record
    db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
    saveDatabaseAfterWrite();

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'delete_session', 'session', ?, ?, datetime('now'))",
      [req.user.id, sessionId, JSON.stringify({ client_id: row[2] })]
    );
    saveDatabaseAfterWrite();

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
    saveDatabaseAfterWrite();

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

// T-20: Auto-link audio by date/metadata.
//
// Bulk-upload helper used by the new "Bulk Upload" UI. The therapist drops
// 3+ recordings at once; the browser sends file metadata (filename + the
// File.lastModified timestamp) here. We parse a date out of each filename
// (or fall back to the lastModified mtime), then look at the therapist's
// existing session.scheduled_at slots (T-02) to suggest which client each
// recording belongs to.
//
// Behaviour per file:
//   - exactly one client with a same-day session  -> auto_match populated
//   - multiple clients with same-day sessions     -> conflict=true (UI dropdown)
//   - no client with a same-day session           -> needs_new_session=true
//                                                    (UI offers the T-07 form)
//
// This endpoint never touches files on disk and never creates DB rows; it
// only returns matching hints. The actual upload still goes through
// POST /api/sessions for each file (which already enforces consent +
// plan-limit + encryption). That keeps the audit/security model intact and
// lets the UI run uploads in parallel with per-file progress bars.
//
// Request body: { files: [{ filename, last_modified_ms? }, ...] }   (max 20)
// Response:     { matches: [{ filename, parsed_date, parsed_method,
//                             candidates: [...], auto_match, conflict,
//                             needs_new_session }, ...] }
function parseDateFromFilename(filename) {
  // Try a handful of common date patterns produced by Zoom, OBS, phone
  // recorders, dictaphones, and macOS/Windows screen recorders.
  // Returns { isoDate: 'YYYY-MM-DD', method } or null when nothing matched.
  if (!filename || typeof filename !== 'string') return null;
  const name = filename;

  const patterns = [
    // ISO-ish: 2026-04-19, 2026_04_19, 2026.04.19, 20260419
    { re: /(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/, order: 'YMD' },
    // Zoom-style: Recording 2026-04-19 14_30_00 — already covered above.
    // US-style: 04-19-2026, 04_19_2026, 04.19.2026
    { re: /(\d{2})[-_.](\d{2})[-_.](20\d{2})/, order: 'MDY' },
    // EU-style: 19-04-2026
    { re: /(\d{2})[-_.](\d{2})[-_.](20\d{2})/, order: 'DMY' }
  ];

  for (const pat of patterns) {
    const m = name.match(pat.re);
    if (!m) continue;
    let year, month, day;
    if (pat.order === 'YMD') {
      year = parseInt(m[1], 10);
      month = parseInt(m[2], 10);
      day = parseInt(m[3], 10);
    } else if (pat.order === 'MDY') {
      month = parseInt(m[1], 10);
      day = parseInt(m[2], 10);
      year = parseInt(m[3], 10);
    } else {
      day = parseInt(m[1], 10);
      month = parseInt(m[2], 10);
      year = parseInt(m[3], 10);
    }
    if (!year || !month || !day) continue;
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    // Sanity: build a Date and verify components round-trip.
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month - 1 ||
      dt.getUTCDate() !== day
    ) {
      continue;
    }
    const isoDate = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return { isoDate, method: 'filename' };
  }
  return null;
}

function isoDateFromMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear().toString().padStart(4, '0')}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}`;
}

function buildClientDisplayName(row) {
  // row keys: first_name, last_name, email, telegram_username, telegram_id, id
  const fn = (row.first_name || '').trim();
  const ln = (row.last_name || '').trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  if (row.email) return row.email;
  if (row.telegram_username) return `@${row.telegram_username}`;
  if (row.telegram_id) return `tg:${row.telegram_id}`;
  return `Client #${row.id}`;
}

router.post('/auto-match', authenticate, requireRole('therapist', 'superadmin'), (req, res) => {
  try {
    const therapistId = req.user.id;
    const files = Array.isArray(req.body && req.body.files) ? req.body.files : null;
    if (!files) {
      return res.status(400).json({ error: 'files (array) is required' });
    }
    if (files.length === 0) {
      return res.json({ matches: [] });
    }
    if (files.length > 20) {
      return res.status(400).json({ error: 'Too many files (max 20 per call)' });
    }

    const db = getDatabase();

    // Pre-load this therapist's connected, consenting clients once. We will
    // use this map both to render display names and to enforce that the
    // suggested candidates are in fact linked to this therapist.
    const clientsRes = db.exec(
      `SELECT id, email, first_name, last_name, telegram_username, telegram_id, language
         FROM users
        WHERE role = 'client' AND therapist_id = ? AND consent_therapist_access = 1`,
      [therapistId]
    );
    const clientsById = new Map();
    if (clientsRes.length > 0) {
      for (const row of clientsRes[0].values) {
        clientsById.set(row[0], {
          id: row[0],
          email: row[1],
          first_name: row[2],
          last_name: row[3],
          telegram_username: row[4],
          telegram_id: row[5],
          language: row[6]
        });
      }
    }

    // Collect every distinct date we'll need to query, then load the matching
    // sessions in a single SQL pass per date. (Worst case 20 dates -> 20 cheap
    // queries; usually 1-3 distinct dates for a real bulk drop.)
    const matches = [];
    const sessionsByDate = new Map();
    const queryForDate = (isoDate) => {
      if (sessionsByDate.has(isoDate)) return sessionsByDate.get(isoDate);
      const result = db.exec(
        `SELECT s.id, s.client_id, s.scheduled_at, s.audio_ref, s.title
           FROM sessions s
          WHERE s.therapist_id = ? AND DATE(s.scheduled_at) = ?
          ORDER BY s.id DESC`,
        [therapistId, isoDate]
      );
      const rows = result.length > 0
        ? result[0].values.map(r => ({
            id: r[0],
            client_id: r[1],
            scheduled_at: r[2],
            audio_ref: r[3],
            title: r[4] || null
          }))
        : [];
      sessionsByDate.set(isoDate, rows);
      return rows;
    };

    for (let i = 0; i < files.length; i++) {
      const f = files[i] || {};
      const filename = typeof f.filename === 'string' ? f.filename : '';
      const lastModifiedMs = Number.isFinite(f.last_modified_ms) ? f.last_modified_ms : null;

      // Parse a date out of the filename first; fall back to the file mtime.
      let parsed = parseDateFromFilename(filename);
      if (!parsed && lastModifiedMs !== null) {
        const iso = isoDateFromMs(lastModifiedMs);
        if (iso) parsed = { isoDate: iso, method: 'mtime' };
      }

      const matchEntry = {
        file_index: i,
        filename,
        parsed_date: parsed ? parsed.isoDate : null,
        parsed_method: parsed ? parsed.method : null,
        candidates: [],
        auto_match: null,
        conflict: false,
        needs_new_session: false
      };

      if (!parsed) {
        // No date at all — therapist must pick a client + date manually.
        matchEntry.needs_new_session = true;
        matches.push(matchEntry);
        continue;
      }

      const dateSessions = queryForDate(parsed.isoDate);
      // Build per-client candidate list (one entry per distinct client_id).
      const seenClient = new Map();
      for (const sess of dateSessions) {
        if (!clientsById.has(sess.client_id)) continue; // ignore disconnected clients
        if (seenClient.has(sess.client_id)) continue;
        const c = clientsById.get(sess.client_id);
        seenClient.set(sess.client_id, true);
        matchEntry.candidates.push({
          client_id: c.id,
          display_name: buildClientDisplayName(c),
          existing_session_id: sess.audio_ref ? null : sess.id, // only suggest reusing slots that have no audio yet
          existing_session_title: sess.title,
          match_reason: 'session_on_date'
        });
      }

      if (matchEntry.candidates.length === 1) {
        matchEntry.auto_match = matchEntry.candidates[0];
      } else if (matchEntry.candidates.length > 1) {
        matchEntry.conflict = true;
      } else {
        matchEntry.needs_new_session = true;
      }

      matches.push(matchEntry);
    }

    // Audit: log the auto-match request (no Class A data leaves the server).
    try {
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, 'session_auto_match', 'session', NULL, ?, datetime('now'))",
        [therapistId, JSON.stringify({ file_count: files.length })]
      );
      saveDatabaseAfterWrite();
    } catch (auditErr) {
      logger.warn('T-20 auto-match audit log failed: ' + auditErr.message);
    }

    res.json({ matches });
  } catch (error) {
    logger.error('Auto-match error: ' + error.message);
    res.status(500).json({ error: 'Failed to compute auto-match suggestions' });
  }
});

// =====================================================================
// ASSIGNMENTS (T-03) — homework attached to a specific session
// =====================================================================

// GET /api/sessions/:id/assignments — list all assignments attached to a session
router.get('/:id/assignments', authenticate, requireRole('therapist', 'superadmin'), (req, res) => {
  try {
    const therapistId = req.user.id;
    const sessionId = parseInt(req.params.id, 10);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const result = assignmentsService.listAssignmentsForSession(therapistId, sessionId);
    if (result.notFound) return res.status(404).json({ error: 'Session not found' });
    if (result.forbidden) return res.status(403).json({ error: 'You do not own this session' });

    // Consent check on the client the session belongs to.
    const consentCheck = verifyClientConsent(therapistId, result.clientId, 'list_session_assignments');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    res.json({ assignments: result.assignments, total: result.assignments.length, session_id: sessionId, client_id: result.clientId });
  } catch (error) {
    logger.error('List session assignments error: ' + error.message);
    res.status(500).json({ error: 'Failed to list session assignments' });
  }
});

// POST /api/sessions/:id/assignments — create assignment attached to a session
router.post('/:id/assignments', authenticate, requireRole('therapist', 'superadmin'), (req, res) => {
  try {
    const therapistId = req.user.id;
    const sessionId = parseInt(req.params.id, 10);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    // Resolve client_id from the session itself so the caller doesn't have to
    // supply it — the session already knows which client it belongs to.
    const db = getDatabase();
    const sessRows = db.exec(
      'SELECT therapist_id, client_id FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (sessRows.length === 0 || sessRows[0].values.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const [sessTherapistId, clientId] = sessRows[0].values[0];
    if (Number(sessTherapistId) !== Number(therapistId)) {
      return res.status(403).json({ error: 'You do not own this session' });
    }

    const consentCheck = verifyClientConsent(therapistId, clientId, 'create_session_assignment');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const body = req.body || {};
    const assignment = assignmentsService.createAssignment({
      therapistId,
      clientId,
      sessionId,
      exerciseId: body.exercise_id,
      title: body.title,
      description: body.description || '',
      reportFrequency: body.report_frequency || 'on_demand',
      reportFrequencyN: body.report_frequency_n,
      deadline: body.deadline,
      status: body.status || 'active',
    });

    logger.info(`Therapist ${therapistId} created assignment ${assignment.id} on session ${sessionId} for client ${clientId}`);
    if (assignment.status === 'active') assignmentsService.notifyClientOfNewAssignment(assignment);
    res.status(201).json(assignment);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Create session assignment error: ' + error.message);
    res.status(500).json({ error: 'Failed to create session assignment' });
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
