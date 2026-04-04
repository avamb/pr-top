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
    // Production path: call real transcription API
    // First decrypt the audio file to get raw audio data
    const encryptedContent = fs.readFileSync(filePath, 'utf-8');
    const decryptedBase64 = decrypt(encryptedContent);
    const audioBuffer = Buffer.from(decryptedBase64, 'base64');

    const result = await callTranscriptionAPI(audioBuffer);
    return result;
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
 * Call OpenAI Whisper API for speech-to-text transcription.
 * Sends the raw audio buffer as a multipart/form-data upload.
 *
 * @param {Buffer} audioBuffer - Raw audio data (decrypted)
 * @returns {Promise<string>} The transcription text
 */
async function callTranscriptionAPI(audioBuffer) {
  // Check spending limit before making API call
  const spendingCheck = checkSpendingLimit();
  if (!spendingCheck.allowed) {
    throw new Error('AI spending limit reached. Contact admin.');
  }

  const apiBase = process.env.TRANSCRIPTION_API_URL || 'https://api.openai.com/v1';
  let model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
  const language = process.env.TRANSCRIPTION_LANGUAGE || undefined; // auto-detect if not set

  // Read transcription model from platform_settings (DB override)
  try {
    const { getDatabase } = require('../db/connection');
    const db = getDatabase();
    const modResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_transcription_model'");
    if (modResult.length > 0 && modResult[0].values.length > 0 && modResult[0].values[0][0]) {
      model = modResult[0].values[0][0];
    }
  } catch (e) {
    // Fall back to env var
  }

  // Build multipart/form-data body manually (no external dependency needed)
  const boundary = '----FormBoundary' + Date.now().toString(36) + Math.random().toString(36).slice(2);

  const parts = [];

  // model field
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n` +
    `${model}\r\n`
  );

  // language field (optional)
  if (language) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `${language}\r\n`
    );
  }

  // response_format field
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
    `text\r\n`
  );

  // audio file field
  const fileHeader = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="session_audio.webm"\r\n` +
    `Content-Type: audio/webm\r\n\r\n`
  );
  const fileFooter = Buffer.from(`\r\n`);
  const ending = Buffer.from(`--${boundary}--\r\n`);

  const textParts = Buffer.from(parts.join(''));
  const body = Buffer.concat([textParts, fileHeader, audioBuffer, fileFooter, ending]);

  logger.info(`Calling transcription API: ${apiBase}/audio/transcriptions (model=${model}, audio=${Math.round(audioBuffer.length / 1024)}KB)`);

  const response = await fetch(`${apiBase}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRANSCRIPTION_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body,
    signal: AbortSignal.timeout(300000) // 5 minute timeout for long audio
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = await response.text();
      errorDetail = errorBody.substring(0, 500);
    } catch { /* ignore */ }
    throw new Error(`Transcription API returned ${response.status}: ${errorDetail}`);
  }

  const transcript = await response.text();

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcription API returned empty result');
  }

  logger.info(`Transcription API returned ${transcript.length} characters`);

  // Estimate tokens from transcript length (Whisper doesn't return token counts in text mode)
  const estimatedInputTokens = Math.ceil(audioBuffer.length / 100); // rough estimate from audio size
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

    // Get session details
    const result = db.exec(
      'SELECT id, therapist_id, client_id, audio_ref FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const [id, therapistId, clientId, audioRef] = result[0].values[0];

    if (!audioRef) {
      throw new Error(`Session ${sessionId} has no audio file`);
    }

    // Transcribe the audio
    logger.info(`Starting transcription for session ${sessionId}...`);
    const transcriptionResult = await transcribeAudio(audioRef);
    const transcript = transcriptionResult.text;

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

    // Update session status to transcription_failed
    db.run(
      "UPDATE sessions SET status = 'transcription_failed', updated_at = datetime('now') WHERE id = ?",
      [sessionId]
    );
    saveDatabaseAfterWrite();

    return { success: false, sessionId, error: error.message };
  }
}

module.exports = {
  transcribeAudio,
  processSessionTranscription,
  isConfigured
};
