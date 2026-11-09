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
const fileCrypto = require('./fileCrypto');

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

// Per-request limit of the transcription API (25 MB; keep a margin).
// Telegram limits bot downloads to 20 MB, so diary media normally fits.
const MAX_DIARY_TRANSCRIPTION_BYTES = (() => {
  const v = parseInt(process.env.TRANSCRIPTION_MAX_FILE_BYTES || '', 10);
  return Number.isInteger(v) && v > 2 * 1024 * 1024 ? v : 24 * 1024 * 1024;
})();

// File names the transcription API recognises (it checks the extension).
const API_EXT = {
  '.mp3': '.mp3', '.m4a': '.m4a', '.mp4': '.mp4', '.wav': '.wav', '.webm': '.webm',
  '.ogg': '.ogg', '.oga': '.oga', '.flac': '.flac',
  '.mov': '.mp4', '.3gp': '.mp4', '.mkv': '.webm', '.ogv': '.ogg',
};

/**
 * Call the STT API to transcribe a decrypted audio file.
 * The file is uploaded as a file-backed Blob (streamed from disk).
 *
 * @param {{path:string, size:number, contentType:string, ext:string}} audio - decrypted temp file
 * @param {string} [language] - Optional language hint for STT API
 * @returns {Promise<{text: string, duration: number, usage: {model: string, inputTokens: number, outputTokens: number}}>}
 */
async function callDiaryTranscriptionAPI(audio, language) {
  // Check spending limit before making API call
  const spendingCheck = checkSpendingLimit();
  if (!spendingCheck.allowed) {
    throw new Error('AI spending limit reached. Contact admin.');
  }

  const apiBase = process.env.TRANSCRIPTION_API_URL || 'https://api.openai.com/v1';
  const model = getTranscriptionModel();

  // Use provided language, env override, or auto-detect
  const lang = language || process.env.TRANSCRIPTION_LANGUAGE || undefined;

  const mimeType = audio.contentType || 'audio/ogg';
  const ext = audio.ext || '.ogg';
  const form = new FormData();
  form.append('model', model);
  if (lang) form.append('language', lang);
  form.append('response_format', 'text');
  form.append('file', await fs.openAsBlob(audio.path, { type: mimeType }), 'diary_audio' + (API_EXT[ext] || ext));

  logger.info('Calling diary transcription API: ' + apiBase + '/audio/transcriptions (model=' + model + ', lang=' + (lang || 'auto') + ', audio=' + Math.round(audio.size / 1024) + 'KB ' + mimeType + ')');

  const startTime = Date.now();

  const response = await fetch(apiBase + '/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TRANSCRIPTION_API_KEY
    },
    body: form,
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
  const estimatedInputTokens = Math.ceil(audio.size / 100);
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
 * @param {{path:string, size:number, contentType:string, ext:string}} audio - decrypted temp file
 * @param {string} [language] - Language hint
 * @returns {Promise<{text: string, duration: number, usage: object}>}
 */
async function transcribeWithRetry(audio, language) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callDiaryTranscriptionAPI(audio, language);
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

    // Decrypt to a private temp file (0600) instead of memory; removed in
    // finally. The content type comes from the encrypted file's header
    // (validated at upload) or, for pre-wave-3 files, from the extension.
    const audio = await fileCrypto.decryptToTempFile(filePath);
    try {
      logger.info('Loaded diary audio: ' + audioFileRef + ' (' + Math.round(audio.size / 1024) + 'KB decrypted, ' + audio.contentType + ')');
      if (audio.size > MAX_DIARY_TRANSCRIPTION_BYTES) {
        throw new Error('Recording is too long to transcribe (' + Math.round(audio.size / (1024 * 1024)) + ' MB; limit ' +
          Math.round(MAX_DIARY_TRANSCRIPTION_BYTES / (1024 * 1024)) + ' MB)');
      }
      // Call STT API with retry logic
      return await transcribeWithRetry(audio, language);
    } finally {
      await audio.cleanup();
    }
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
