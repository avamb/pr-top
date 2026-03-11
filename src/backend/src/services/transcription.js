// Transcription Service
// Handles audio-to-text transcription for session recordings.
// In development mode without API keys, uses a local placeholder transcription.
// In production, integrates with a speech-to-text service (e.g., OpenAI Whisper API).

const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabase } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');
// Lazy-loaded to avoid circular dependency
let summarizationService = null;
function getSummarizationService() {
  if (!summarizationService) {
    summarizationService = require('./summarization');
  }
  return summarizationService;
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

    return await callTranscriptionAPI(audioBuffer);
  } else {
    // Development mode: generate a development transcript
    // This provides realistic-looking output for testing the pipeline
    const fileSizeKB = Math.round(fileStats.size / 1024);
    const estimatedDurationMin = Math.max(1, Math.round(fileSizeKB / 100));
    const timestamp = new Date().toISOString();

    const transcript = [
      `[Session Transcript - Generated ${timestamp}]`,
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
    return transcript;
  }
}

/**
 * Call external transcription API (production mode).
 * Placeholder for real API integration.
 */
async function callTranscriptionAPI(audioBuffer) {
  // When TRANSCRIPTION_API_KEY is set to a real key, this would call
  // the configured speech-to-text API (e.g., OpenAI Whisper)
  // For now, throw if we somehow get here without proper config
  throw new Error('Real transcription API integration not yet implemented. Set TRANSCRIPTION_API_KEY to a valid key.');
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
    saveDatabase();

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
    const transcript = await transcribeAudio(audioRef);

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

    saveDatabase();

    logger.info(`Transcription complete for session ${sessionId}`);

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

    return { success: true, sessionId };
  } catch (error) {
    logger.error(`Transcription failed for session ${sessionId}: ${error.message}`);

    // Update session status to failed
    db.run(
      "UPDATE sessions SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
      [sessionId]
    );
    saveDatabase();

    return { success: false, sessionId, error: error.message };
  }
}

module.exports = {
  transcribeAudio,
  processSessionTranscription,
  isConfigured
};
