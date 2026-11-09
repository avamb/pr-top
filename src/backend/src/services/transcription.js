// Transcription Service
// Handles audio-to-text transcription for session recordings.
// In development mode without API keys, uses a local placeholder transcription.
// In production, integrates with a speech-to-text service (e.g., OpenAI Whisper API).

const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');
const wsService = require('./websocketService');
const { logUsage, checkSpendingLimit } = require('./aiUsageLogger');
const fileCrypto = require('./fileCrypto');
const { prepareTranscriptionPieces } = require('./audioSplit');
// Lazy-loaded to avoid circular dependency
let summarizationService = null;
function getSummarizationService() {
  if (!summarizationService) {
    summarizationService = require('./summarization');
  }
  return summarizationService;
}
let vectorStoreService = null;
function getVectorStoreService() {
  if (!vectorStoreService) {
    vectorStoreService = require('./vectorStore');
  }
  return vectorStoreService;
}

const TRANSCRIPTION_API_KEY = process.env.TRANSCRIPTION_API_KEY;
const UPLOAD_DIR = path.resolve(__dirname, '../../data/sessions');

// Audit M20: the OpenAI transcription endpoint rejects uploads over 25 MB.
// Larger recordings are cut losslessly (MP3 / WAV) or converted by ffmpeg to
// a speech MP3 and cut (any other format), see services/audioSplit.js. Only
// when that is impossible (no ffmpeg, or ffmpeg cannot read the file) does
// the session end in the explicit status 'transcription_too_long' instead of
// an opaque API failure.
const MAX_TRANSCRIPTION_FILE_BYTES = (() => {
  const v = parseInt(process.env.TRANSCRIPTION_MAX_FILE_BYTES || '', 10);
  return Number.isInteger(v) && v > 2 * 1024 * 1024 ? v : 24 * 1024 * 1024;
})();
const SPLIT_TARGET_BYTES = Math.min(20 * 1024 * 1024, MAX_TRANSCRIPTION_FILE_BYTES - 1024 * 1024);
const TOO_LONG_CODE = 'FILE_TOO_LONG_TO_TRANSCRIBE';

function tooLongError(sizeBytes, mime, reason) {
  const mb = Math.round(sizeBytes / (1024 * 1024));
  const err = new Error(
    `Recording is too long to transcribe (${mb} MB ${mime || 'audio'}; the limit per transcription request is ` +
    `${Math.round(MAX_TRANSCRIPTION_FILE_BYTES / (1024 * 1024))} MB and it could not be converted or split` +
    (reason ? `: ${reason}` : '') + ')'
  );
  err.code = TOO_LONG_CODE;
  return err;
}

// File names the transcription API recognises (it checks the extension).
const API_EXT = {
  '.mp3': '.mp3', '.m4a': '.m4a', '.mp4': '.mp4', '.wav': '.wav', '.webm': '.webm',
  '.ogg': '.ogg', '.oga': '.oga', '.flac': '.flac', '.mpeg': '.mpeg', '.mpga': '.mpga',
  '.mov': '.mp4', '.3gp': '.mp4', '.mkv': '.webm', '.ogv': '.ogg',
};

/**
 * Check if a real transcription service is configured.
 */
function isConfigured() {
  return !!(TRANSCRIPTION_API_KEY &&
    TRANSCRIPTION_API_KEY !== 'your-transcription-api-key' &&
    TRANSCRIPTION_API_KEY.length > 10);
}

/**
 * Transcribe an audio file.
 * In production: calls external transcription API.
 * In dev mode: generates a development transcript from file metadata.
 *
 * @param {string} audioRef - The encrypted audio file reference
 * @returns {Promise<string>} The transcription text
 */
async function transcribeAudio(audioRef) {
  const filePath = path.join(UPLOAD_DIR, audioRef);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${audioRef}`);
  }

  const fileStats = fs.statSync(filePath);

  if (isConfigured()) {
    // Production path: decrypt to a private temp file (0600, never into
    // memory), upload it as a file-backed stream, delete it afterwards.
    const plain = await fileCrypto.decryptToTempFile(filePath);
    try {
      return await transcribePlainFile(plain);
    } finally {
      await plain.cleanup();
    }
  } else {
    // Development mode: generate a development transcript
    // This provides realistic-looking output for testing the pipeline
    const fileSizeKB = Math.round(fileStats.size / 1024);
    const estimatedDurationMin = Math.max(1, Math.round(fileSizeKB / 100));
    const timestamp = new Date().toISOString();

    const transcript = [
      `[DEV MODE - Session Transcript - Generated ${timestamp}]`,
      `[Audio file: ${audioRef}, Size: ${fileSizeKB}KB, Est. duration: ${estimatedDurationMin}min]`,
      ``,
      `Therapist: Welcome to today's session. How have you been feeling since our last meeting?`,
      ``,
      `Client: I've been doing better overall. The exercises you gave me last time really helped with managing my anxiety in the mornings.`,
      ``,
      `Therapist: That's wonderful to hear. Can you tell me more about which specific exercises you found most helpful?`,
      ``,
      `Client: The breathing technique especially. I've been using it every morning before work, and it helps me start the day with less tension.`,
      ``,
      `Therapist: I'm glad the breathing exercises are working well for you. Let's build on that progress today.`,
      ``,
      `[End of transcript]`
    ].join('\n');

    logger.info(`Dev transcription generated for ${audioRef} (${fileSizeKB}KB)`);
    // Estimate tokens for dev mode
    const estimatedTokens = Math.ceil(transcript.length / 4);
    const model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
    return { text: transcript, usage: { model, inputTokens: estimatedTokens, outputTokens: estimatedTokens } };
  }
}

/**
 * Transcribe a decrypted recording on disk. Recordings over the per-request
 * limit are cut (MP3/WAV) or converted to a speech MP3 by ffmpeg and cut;
 * every intermediate file is deleted in finally.
 *
 * @param {{path:string, size:number, contentType:string, ext:string}} plain
 * @returns {Promise<{text:string, usage:object, parts:number, method:string}>}
 */
async function transcribePlainFile(plain) {
  const prep = await prepareTranscriptionPieces(plain, {
    maxBytes: MAX_TRANSCRIPTION_FILE_BYTES,
    targetBytes: SPLIT_TARGET_BYTES,
  });
  if (!prep.pieces) {
    await prep.cleanup();
    throw tooLongError(plain.size, plain.contentType, prep.reason);
  }
  try {
    if (prep.method !== 'direct') {
      logger.info(`Transcription: ${Math.round(plain.size / 1024)}KB ${plain.contentType} -> ${prep.method}, ${prep.pieces.length} part(s)`);
    }
    const texts = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let model = null;
    for (const piece of prep.pieces) {
      const r = await callTranscriptionAPI({ path: piece.path, size: piece.size, mime: piece.mime, ext: piece.ext });
      texts.push(r.text);
      inputTokens += r.usage.inputTokens;
      outputTokens += r.usage.outputTokens;
      model = r.usage.model;
    }
    return { text: texts.join('\n'), usage: { model, inputTokens, outputTokens }, parts: prep.pieces.length, method: prep.method };
  } finally {
    await prep.cleanup();
  }
}

/**
 * Call OpenAI Whisper API for speech-to-text transcription.
 * Sends the audio as multipart/form-data. A file source is uploaded as a
 * file-backed Blob (fs.openAsBlob), so it is streamed from disk instead of
 * being copied into memory.
 *
 * @param {Buffer|{path:string, size:number, mime?:string, ext?:string}} source - decrypted audio
 * @param {{mime?:string, ext?:string}} [meta] - for Buffer sources
 * @returns {Promise<{text:string, usage:object}>}
 */
async function callTranscriptionAPI(source, meta = {}) {
  // Check spending limit before making API call
  const spendingCheck = checkSpendingLimit();
  if (!spendingCheck.allowed) {
    throw new Error('AI spending limit reached. Contact admin.');
  }

  const isBuffer = Buffer.isBuffer(source);
  const size = isBuffer ? source.length : source.size;
  const mime = (isBuffer ? meta.mime : source.mime) || 'audio/webm';
  const ext = (isBuffer ? meta.ext : source.ext) || '.webm';
  if (size > MAX_TRANSCRIPTION_FILE_BYTES) {
    throw tooLongError(size, mime);
  }

  const apiBase = process.env.TRANSCRIPTION_API_URL || 'https://api.openai.com/v1';
  let model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
  const language = process.env.TRANSCRIPTION_LANGUAGE || undefined; // auto-detect if not set

  // Read transcription model from platform_settings (DB override)
  try {
    const db = getDatabase();
    const modResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_transcription_model'");
    if (modResult.length > 0 && modResult[0].values.length > 0 && modResult[0].values[0][0]) {
      model = modResult[0].values[0][0];
    }
  } catch (e) {
    // Fall back to env var
  }

  const blob = isBuffer
    ? new Blob([source], { type: mime })
    : await fs.openAsBlob(source.path, { type: mime });
  const form = new FormData();
  form.append('model', model);
  if (language) form.append('language', language);
  form.append('response_format', 'text');
  form.append('file', blob, 'session_audio' + (API_EXT[ext] || ext));

  logger.info(`Calling transcription API: ${apiBase}/audio/transcriptions (model=${model}, audio=${Math.round(size / 1024)}KB ${mime})`);

  const response = await fetch(`${apiBase}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRANSCRIPTION_API_KEY}`
    },
    body: form,
    signal: AbortSignal.timeout(300000) // 5 minute timeout for long audio
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = await response.text();
      errorDetail = errorBody.substring(0, 500);
    } catch { /* ignore */ }
    if (response.status === 413) throw tooLongError(size, mime);
    throw new Error(`Transcription API returned ${response.status}: ${errorDetail}`);
  }

  const transcript = await response.text();

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcription API returned empty result');
  }

  logger.info(`Transcription API returned ${transcript.length} characters`);

  // Estimate tokens from transcript length (Whisper doesn't return token counts in text mode)
  const estimatedInputTokens = Math.ceil(size / 100); // rough estimate from audio size
  const estimatedOutputTokens = Math.ceil(transcript.length / 4);

  return {
    text: transcript.trim(),
    usage: { model, inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens }
  };
}

/**
 * Process a session: transcribe audio, encrypt and store transcript.
 * This is the main entry point called after audio upload.
 *
 * @param {number} sessionId - The session ID to process
 * @returns {Promise<{success: boolean, sessionId: number}>}
 */
async function processSessionTranscription(sessionId) {
  const db = getDatabase();

  try {
    // Update session status to transcribing
    db.run(
      "UPDATE sessions SET status = 'transcribing', updated_at = datetime('now') WHERE id = ?",
      [sessionId]
    );
    saveDatabaseAfterWrite();

    // Get session details — include T-19 single-track fields so we know
    // whether the transcript needs to be filtered to a single speaker.
    const result = db.exec(
      `SELECT id, therapist_id, client_id, audio_ref, recording_mode, selected_speaker_label
       FROM sessions WHERE id = ?`,
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const rowVals = result[0].values[0];
    const [id, therapistId, clientId, audioRef] = rowVals;
    const recordingMode = rowVals[4] || 'mixed';
    const selectedSpeakerLabel = rowVals[5] || null;

    if (!audioRef) {
      throw new Error(`Session ${sessionId} has no audio file`);
    }

    // Transcribe the audio
    logger.info(
      `Starting transcription for session ${sessionId}` +
      (recordingMode === 'single_track' ? ` (single_track speaker=${selectedSpeakerLabel})` : '')
    );
    const transcriptionResult = await transcribeAudio(audioRef);
    let transcript = transcriptionResult.text;

    // T-19: When the session was uploaded as single_track and the therapist
    // has selected their voice, keep only that speaker's lines. In production
    // with a real diarization provider, the audio itself should be resliced
    // before transcription; in dev mode we filter the placeholder transcript
    // by the "Therapist:"/"Client:" prefix so the rest of the pipeline (vector
    // embeddings, summary, search) only sees the chosen speaker's content.
    if (recordingMode === 'single_track' && selectedSpeakerLabel) {
      try {
        const { filterTranscriptToSpeaker } = require('./diarization');
        const before = transcript.length;
        transcript = filterTranscriptToSpeaker(transcript, selectedSpeakerLabel);
        logger.info(
          `Single-track filter applied to session ${sessionId}: ` +
          `${before} -> ${transcript.length} chars (speaker=${selectedSpeakerLabel})`
        );
      } catch (e) {
        logger.warn(`Single-track filter failed for session ${sessionId}: ${e.message} — using full transcript`);
      }
    }

    // Log AI usage for transcription
    if (transcriptionResult.usage) {
      const u = transcriptionResult.usage;
      logUsage(therapistId, 'openai', u.model, 'transcription', u.inputTokens, u.outputTokens, null, sessionId);
    }

    // Encrypt the transcript (Class A data)
    const { encrypted: transcriptEncrypted, keyVersion, keyId } = encrypt(transcript);

    // Store encrypted transcript in database
    db.run(
      `UPDATE sessions
       SET transcript_encrypted = ?, encryption_key_id = ?, payload_version = ?,
           status = 'complete', updated_at = datetime('now')
       WHERE id = ?`,
      [transcriptEncrypted, keyId, keyVersion, sessionId]
    );

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES (?, 'session_transcribed', 'session', ?)",
      [therapistId, sessionId]
    );

    saveDatabaseAfterWrite();

    logger.info(`Transcription complete for session ${sessionId}`);

    // Generate vector embedding from transcript
    try {
      const vectorStore = getVectorStoreService();
      const embedResult = vectorStore.embedSessionTranscript(sessionId, transcript, clientId, therapistId);
      if (embedResult.success) {
        logger.info(`Vector embedding generated for session ${sessionId} transcript (${embedResult.token_count} tokens)`);
      } else {
        logger.warn(`Vector embedding failed for session ${sessionId}: ${embedResult.error}`);
      }
    } catch (embedErr) {
      logger.warn(`Vector embedding error for session ${sessionId}: ${embedErr.message}`);
      // Don't fail the transcription if embedding fails
    }

    // Chain summary generation after transcription
    try {
      const { processSessionSummary } = getSummarizationService();
      const summaryResult = await processSessionSummary(sessionId);
      if (summaryResult.success) {
        logger.info(`Auto-summary generated for session ${sessionId}`);
      } else {
        logger.warn(`Auto-summary failed for session ${sessionId}: ${summaryResult.error}`);
      }
    } catch (summaryErr) {
      logger.warn(`Summary generation error for session ${sessionId}: ${summaryErr.message}`);
      // Don't fail the transcription if summary fails
    }

    // Push real-time session status to therapist
    try {
      wsService.emitSessionStatus(therapistId, { sessionId, clientId, status: 'complete' });
    } catch (wsErr) {
      logger.warn(`[WS] Failed to emit session status: ${wsErr.message}`);
    }

    return { success: true, sessionId };
  } catch (error) {
    logger.error(`Transcription failed for session ${sessionId}: ${error.message}`);

    // Update session status: 'transcription_too_long' when the recording is
    // over the API limit and cannot be split, else 'transcription_failed'.
    const tooLong = !!error && error.code === TOO_LONG_CODE;
    db.run(
      "UPDATE sessions SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [tooLong ? 'transcription_too_long' : 'transcription_failed', sessionId]
    );
    saveDatabaseAfterWrite();

    if (tooLong) {
      try {
        const r = db.exec('SELECT therapist_id, client_id FROM sessions WHERE id = ?', [sessionId]);
        if (r.length && r[0].values.length) {
          const [tId, cId] = r[0].values[0];
          wsService.emitSessionStatus(tId, { sessionId, clientId: cId, status: 'transcription_too_long' });
        }
      } catch (wsErr) {
        logger.warn(`[WS] Failed to emit session status: ${wsErr.message}`);
      }
    }

    return { success: false, sessionId, error: error.message, code: tooLong ? TOO_LONG_CODE : undefined };
  }
}

/**
 * Transcribe a raw audio buffer (bypasses the on-disk encrypted-file flow).
 * Used for short ad-hoc voice inputs (e.g. T-15 post-session voice notes)
 * where we don't want to persist the audio — only the resulting transcript.
 *
 * In dev mode this returns a deterministic placeholder so the UI flow still
 * works without a Whisper key configured.
 *
 * @param {Buffer} audioBuffer - Raw audio bytes (e.g. webm/ogg from MediaRecorder)
 * @param {{mime?:string, ext?:string}} [meta] - detected content type (magic bytes)
 * @returns {Promise<{text: string, usage: {model: string, inputTokens: number, outputTokens: number}}>}
 */
async function transcribeAudioBuffer(audioBuffer, meta = {}) {
  if (isConfigured()) {
    return await callTranscriptionAPI(audioBuffer, meta);
  }
  // Dev fallback — produce a deterministic, recognisable transcript so the
  // therapist can verify the voice -> text wiring without external services.
  const sizeKB = Math.round(audioBuffer.length / 1024);
  const text =
    `[DEV MODE voice transcript ~${sizeKB}KB] ` +
    `Pay attention next session: client mentioned sleep was better, ` +
    `revisit anxiety triggers around work, and follow up on the ` +
    `breathing exercise homework.`;
  const model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
  return {
    text,
    usage: {
      model,
      inputTokens: Math.ceil(audioBuffer.length / 100),
      outputTokens: Math.ceil(text.length / 4)
    }
  };
}

module.exports = {
  transcribeAudio,
  transcribeAudioBuffer,
  transcribePlainFile,
  processSessionTranscription,
  isConfigured,
  MAX_TRANSCRIPTION_FILE_BYTES,
  TOO_LONG_CODE
};
