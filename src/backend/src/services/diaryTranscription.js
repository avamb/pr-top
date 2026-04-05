// Diary Transcription Service
// Handles automatic transcription of voice and video diary entries.
// In development mode, generates a dev transcript from the content.
// In production, integrates with a speech-to-text API (OpenAI Whisper or configured provider).

const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');
const { logUsage, checkSpendingLimit } = require('./aiUsageLogger');

const TRANSCRIPTION_API_KEY = process.env.TRANSCRIPTION_API_KEY;
const DIARY_FILES_DIR = path.resolve(__dirname, '../../data/diary_files');

// Max retry attempts for STT API failures
const MAX_RETRIES = 3;

// Language code mapping from our i18n codes to Whisper ISO-639-1 codes
const LANGUAGE_MAP = {
  'en': 'en',
  'ru': 'ru',
  'es': 'es',
  'uk': 'uk'
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
 * Get the client's language setting from the database.
 * @param {number} clientId
 * @returns {string|undefined} Whisper-compatible language code or undefined for auto-detect
 */
function getClientLanguage(clientId) {
  try {
    const db = getDatabase();
    const result = db.exec('SELECT language FROM users WHERE id = ?', [clientId]);
    if (result.length > 0 && result[0].values.length > 0) {
      const lang = result[0].values[0][0];
      return LANGUAGE_MAP[lang] || undefined;
    }
  } catch (e) {
    logger.warn('Could not get language for client #' + clientId + ': ' + e.message);
  }
  return undefined;
}

/**
 * Get the transcription model from platform_settings or env var.
 * @returns {string} Model name
 */
function getTranscriptionModel() {
  let model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
  try {
    const db = getDatabase();
    const modResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_transcription_model'");
    if (modResult.length > 0 && modResult[0].values.length > 0 && modResult[0].values[0][0]) {
      model = modResult[0].values[0][0];
    }
  } catch (e) {
    // Fall back to env var
  }
  return model;
}

/**
 * Call the STT API to transcribe audio buffer.
 * Builds multipart/form-data request manually (same pattern as session transcription).
 *
 * @param {Buffer} audioBuffer - Raw audio data (decrypted)
 * @param {string} [language] - Optional language hint for STT API
 * @param {string} [fileExt] - File extension for MIME type detection
 * @returns {Promise<{text: string, usage: {model: string, inputTokens: number, outputTokens: number}}>}
 */
async function callDiaryTranscriptionAPI(audioBuffer, language, fileExt) {
  // Check spending limit before making API call
  const spendingCheck = checkSpendingLimit();
  if (!spendingCheck.allowed) {
    throw new Error('AI spending limit reached. Contact admin.');
  }

  const apiBase = process.env.TRANSCRIPTION_API_URL || 'https://api.openai.com/v1';
  const model = getTranscriptionModel();

  // Use provided language, env override, or auto-detect
  const lang = language || process.env.TRANSCRIPTION_LANGUAGE || undefined;

  // Build multipart/form-data body manually (no external dependency needed)
  const boundary = '----FormBoundary' + Date.now().toString(36) + Math.random().toString(36).slice(2);

  const parts = [];

  // model field
  parts.push(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="model"\r\n\r\n' +
    model + '\r\n'
  );

  // language field (optional)
  if (lang) {
    parts.push(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="language"\r\n\r\n' +
      lang + '\r\n'
    );
  }

  // response_format field
  parts.push(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="response_format"\r\n\r\n' +
    'text\r\n'
  );

  // Determine MIME type from file extension
  const mimeTypes = {
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4'
  };
  const mimeType = (fileExt && mimeTypes[fileExt]) || 'audio/ogg';
  const filename = 'diary_audio' + (fileExt || '.ogg');

  // audio file field
  const fileHeader = Buffer.from(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="file"; filename="' + filename + '"\r\n' +
    'Content-Type: ' + mimeType + '\r\n\r\n'
  );
  const fileFooter = Buffer.from('\r\n');
  const ending = Buffer.from('--' + boundary + '--\r\n');

  const textParts = Buffer.from(parts.join(''));
  const body = Buffer.concat([textParts, fileHeader, audioBuffer, fileFooter, ending]);

  logger.info('Calling diary transcription API: ' + apiBase + '/audio/transcriptions (model=' + model + ', lang=' + (lang || 'auto') + ', audio=' + Math.round(audioBuffer.length / 1024) + 'KB)');

  const startTime = Date.now();

  const response = await fetch(apiBase + '/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TRANSCRIPTION_API_KEY,
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    },
    body: body,
    signal: AbortSignal.timeout(300000) // 5 minute timeout for long audio
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = await response.text();
      errorDetail = errorBody.substring(0, 500);
    } catch (e) { /* ignore */ }
    throw new Error('Transcription API returned ' + response.status + ': ' + errorDetail);
  }

  const transcript = await response.text();

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcription API returned empty result');
  }

  logger.info('Diary transcription API returned ' + transcript.length + ' characters in ' + duration + 'ms');

  // Estimate tokens (Whisper doesn't return token counts in text mode)
  const estimatedInputTokens = Math.ceil(audioBuffer.length / 100);
  const estimatedOutputTokens = Math.ceil(transcript.length / 4);

  return {
    text: transcript.trim(),
    duration: duration,
    usage: { model, inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens }
  };
}

/**
 * Transcribe a diary entry's audio with retry logic.
 *
 * @param {Buffer} audioBuffer - Raw decrypted audio data
 * @param {string} [language] - Language hint
 * @param {string} [fileExt] - File extension
 * @returns {Promise<{text: string, duration: number, usage: object}>}
 */
async function transcribeWithRetry(audioBuffer, language, fileExt) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callDiaryTranscriptionAPI(audioBuffer, language, fileExt);
    } catch (error) {
      lastError = error;
      // Don't retry on spending limit errors
      if (error.message.includes('spending limit')) {
        throw error;
      }
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s exponential backoff
        logger.warn('Diary transcription attempt ' + attempt + '/' + MAX_RETRIES + ' failed: ' + error.message + '. Retrying in ' + delay + 'ms...');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Generate a transcript for a voice/video diary entry.
 * In production: loads encrypted audio from disk, decrypts, sends to STT API.
 * In dev mode: creates a development transcript from available content.
 *
 * @param {string} entryType - 'voice' or 'video'
 * @param {string|null} contentText - Decrypted content text (if available)
 * @param {string|null} fileRef - Decrypted file reference (if available)
 * @param {string|null} audioFileRef - Local encrypted audio file reference
 * @param {string|null} language - Client language code
 * @returns {Promise<{text: string, duration?: number, usage?: object}|string>} Transcription result
 */
async function transcribeDiaryEntry(entryType, contentText, fileRef, audioFileRef, language) {
  if (isConfigured() && audioFileRef) {
    // Production path: load and decrypt audio file, send to STT API
    const filePath = path.join(DIARY_FILES_DIR, audioFileRef);

    if (!fs.existsSync(filePath)) {
      throw new Error('Audio file not found on disk: ' + audioFileRef);
    }

    // Decrypt the audio file (stored as encrypted base64)
    const encryptedContent = fs.readFileSync(filePath, 'utf-8');
    const decryptedBase64 = decrypt(encryptedContent);
    const audioBuffer = Buffer.from(decryptedBase64, 'base64');

    logger.info('Loaded diary audio: ' + audioFileRef + ' (' + Math.round(audioBuffer.length / 1024) + 'KB decrypted)');

    // Determine file extension for MIME type
    const fileExt = path.extname(audioFileRef.replace('.enc', '')).toLowerCase() || '.ogg';

    // Call STT API with retry logic
    const result = await transcribeWithRetry(audioBuffer, language, fileExt);
    return result;
  }

  // Development mode: generate a transcript
  var timestamp = new Date().toISOString();
  var mediaType = entryType === 'video' ? 'Video' : 'Voice';
  var sourceInfo = fileRef ? 'file: ' + fileRef : (audioFileRef ? 'audio: ' + audioFileRef : 'inline content');

  if (contentText) {
    // If content was provided with the media, use it as transcript basis
    var transcript = [
      '[DEV MODE - ' + mediaType + ' Diary Transcript - Generated ' + timestamp + ']',
      '[Source: ' + sourceInfo + ']',
      '',
      contentText,
      '',
      '[End of transcript]'
    ].join('\n');

    return transcript;
  }

  // No content provided, generate placeholder transcript for dev mode
  var devTranscript = [
    '[DEV MODE - ' + mediaType + ' Diary Transcript - Generated ' + timestamp + ']',
    '[Source: ' + sourceInfo + ']',
    '',
    'Client diary recording:',
    '',
    'Today I want to talk about how I have been feeling this week.',
    'The exercises from my therapist have been helpful.',
    'I noticed I feel calmer in the mornings after practicing the breathing technique.',
    'I still have some difficulty falling asleep, but it is getting better.',
    '',
    '[End of transcript]'
  ].join('\n');

  return devTranscript;
}

/**
 * Update transcription_status for a diary entry.
 * @param {object} db - Database instance
 * @param {number} entryId - Entry ID
 * @param {string} status - One of: pending, processing, completed, failed
 */
function updateTranscriptionStatus(db, entryId, status) {
  db.run(
    "UPDATE diary_entries SET transcription_status = ?, updated_at = datetime('now') WHERE id = ?",
    [status, entryId]
  );
}

/**
 * Process transcription for a diary entry.
 * Fetches the entry, generates a transcript, encrypts and stores it.
 * Tracks transcription_status and logs AI usage metrics.
 *
 * @param {number} entryId - The diary entry ID to transcribe
 * @param {boolean} [force=false] - If true, re-transcribe even if already transcribed
 * @returns {Promise<{success: boolean, entryId: number, error?: string}>}
 */
async function processDiaryTranscription(entryId, force) {
  var db = getDatabase();

  try {
    // Get diary entry details
    var result = db.exec(
      'SELECT id, client_id, entry_type, content_encrypted, file_ref, encryption_key_id, audio_file_ref FROM diary_entries WHERE id = ?',
      [entryId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error('Diary entry ' + entryId + ' not found');
    }

    var row = result[0].values[0];
    var id = row[0];
    var clientId = row[1];
    var entryType = row[2];
    var contentEncrypted = row[3];
    var fileRefEncrypted = row[4];
    var encKeyId = row[5];
    var audioFileRef = row[6];

    // Only transcribe voice/video entries
    if (entryType !== 'voice' && entryType !== 'video') {
      return { success: false, entryId: entryId, error: 'Entry is not voice/video type' };
    }

    // Check if already transcribed (skip check if force=true)
    if (!force) {
      var existingTranscript = db.exec(
        'SELECT transcript_encrypted FROM diary_entries WHERE id = ? AND transcript_encrypted IS NOT NULL',
        [entryId]
      );
      if (existingTranscript.length > 0 && existingTranscript[0].values.length > 0) {
        logger.info('Diary entry #' + entryId + ' already has a transcript');
        return { success: true, entryId: entryId, already_transcribed: true };
      }
    }

    // Update status to processing
    updateTranscriptionStatus(db, entryId, 'processing');
    saveDatabaseAfterWrite();

    // Decrypt content and file_ref if available
    var contentText = null;
    if (contentEncrypted) {
      try {
        contentText = decrypt(contentEncrypted);
      } catch (e) {
        logger.warn('Could not decrypt content for diary entry #' + entryId + ': ' + e.message);
      }
    }

    var fileRef = null;
    if (fileRefEncrypted) {
      try {
        fileRef = decrypt(fileRefEncrypted);
      } catch (e) {
        logger.warn('Could not decrypt file_ref for diary entry #' + entryId + ': ' + e.message);
      }
    }

    // Get client language for better STT accuracy
    var clientLanguage = getClientLanguage(clientId);

    // Find the therapist_id for this client (for usage logging)
    var therapistId = null;
    try {
      var therapistResult = db.exec(
        'SELECT therapist_id FROM users WHERE id = ?',
        [clientId]
      );
      if (therapistResult.length > 0 && therapistResult[0].values.length > 0) {
        therapistId = therapistResult[0].values[0][0];
      }
    } catch (e) {
      logger.warn('Could not find therapist for client #' + clientId);
    }

    // Generate transcript
    logger.info('Starting transcription for diary entry #' + entryId + ' (type: ' + entryType + ', lang: ' + (clientLanguage || 'auto') + ')');
    var transcriptionResult = await transcribeDiaryEntry(entryType, contentText, fileRef, audioFileRef, clientLanguage);

    // Extract transcript text (result may be string in dev mode or object in production)
    var transcript;
    var usageInfo = null;
    var transcriptionDuration = null;

    if (typeof transcriptionResult === 'object' && transcriptionResult.text) {
      transcript = transcriptionResult.text;
      usageInfo = transcriptionResult.usage || null;
      transcriptionDuration = transcriptionResult.duration || null;
    } else {
      transcript = transcriptionResult;
    }

    // Log AI usage for transcription (only when real API was called)
    if (usageInfo && therapistId) {
      var provider = 'openai'; // Default; could be made configurable
      logUsage(therapistId, provider, usageInfo.model, 'diary_transcription', usageInfo.inputTokens, usageInfo.outputTokens, null, null, JSON.stringify({ diary_entry_id: entryId, duration_ms: transcriptionDuration }));
    }

    // Log transcription duration metric
    if (transcriptionDuration) {
      logger.info('Diary transcription for entry #' + entryId + ': ' + transcript.length + ' chars in ' + transcriptionDuration + 'ms (model: ' + (usageInfo ? usageInfo.model : 'dev') + ')');
    }

    // Encrypt the transcript (Class A data)
    var encResult = encrypt(transcript);

    // Store encrypted transcript and update status to completed
    db.run(
      "UPDATE diary_entries SET transcript_encrypted = ?, transcription_status = 'completed', updated_at = datetime('now') WHERE id = ?",
      [encResult.encrypted, entryId]
    );

    // Update encryption key info if not already set
    db.run(
      "UPDATE diary_entries SET encryption_key_id = COALESCE(encryption_key_id, ?), payload_version = COALESCE(payload_version, ?) WHERE id = ?",
      [encResult.keyId, encResult.keyVersion, entryId]
    );

    saveDatabaseAfterWrite();

    logger.info('Transcription completed for diary entry #' + entryId);

    return { success: true, entryId: entryId };
  } catch (error) {
    logger.error('Diary transcription failed for entry #' + entryId + ': ' + error.message);

    // Update status to failed
    try {
      updateTranscriptionStatus(db, entryId, 'failed');
      saveDatabaseAfterWrite();
    } catch (e) {
      logger.error('Failed to update transcription_status for entry #' + entryId + ': ' + e.message);
    }

    return { success: false, entryId: entryId, error: error.message };
  }
}

module.exports = {
  transcribeDiaryEntry,
  processDiaryTranscription,
  isConfigured
};
