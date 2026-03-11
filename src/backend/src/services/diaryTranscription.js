// Diary Transcription Service
// Handles automatic transcription of voice and video diary entries.
// In development mode, generates a dev transcript from the content.
// In production, would integrate with a speech-to-text API.

const { getDatabase, saveDatabase } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');

const TRANSCRIPTION_API_KEY = process.env.TRANSCRIPTION_API_KEY;

/**
 * Check if a real transcription service is configured.
 */
function isConfigured() {
  return !!(TRANSCRIPTION_API_KEY &&
    TRANSCRIPTION_API_KEY !== 'your-transcription-api-key' &&
    TRANSCRIPTION_API_KEY.length > 10);
}

/**
 * Generate a transcript for a voice/video diary entry.
 * In dev mode: creates a development transcript from available content.
 * In production: would call external transcription API with the file.
 *
 * @param {string} entryType - 'voice' or 'video'
 * @param {string|null} contentText - Decrypted content text (if available)
 * @param {string|null} fileRef - Decrypted file reference (if available)
 * @returns {Promise<string>} The transcription text
 */
async function transcribeDiaryEntry(entryType, contentText, fileRef) {
  if (isConfigured()) {
    // Production path: would call real transcription API with the file
    // For now, if we have content text, use that as the basis
    if (contentText) {
      return contentText;
    }
    throw new Error('Real transcription API integration not yet implemented for diary entries.');
  }

  // Development mode: generate a transcript
  var timestamp = new Date().toISOString();
  var mediaType = entryType === 'video' ? 'Video' : 'Voice';
  var sourceInfo = fileRef ? 'file: ' + fileRef : 'inline content';

  if (contentText) {
    // If content was provided with the media, use it as transcript basis
    var transcript = [
      '[' + mediaType + ' Diary Transcript - Generated ' + timestamp + ']',
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
    '[' + mediaType + ' Diary Transcript - Generated ' + timestamp + ']',
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
 * Process transcription for a diary entry.
 * Fetches the entry, generates a transcript, encrypts and stores it.
 *
 * @param {number} entryId - The diary entry ID to transcribe
 * @returns {Promise<{success: boolean, entryId: number, error?: string}>}
 */
async function processDiaryTranscription(entryId) {
  var db = getDatabase();

  try {
    // Get diary entry details
    var result = db.exec(
      'SELECT id, client_id, entry_type, content_encrypted, file_ref, encryption_key_id FROM diary_entries WHERE id = ?',
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

    // Only transcribe voice/video entries
    if (entryType !== 'voice' && entryType !== 'video') {
      return { success: false, entryId: entryId, error: 'Entry is not voice/video type' };
    }

    // Check if already transcribed
    var existingTranscript = db.exec(
      'SELECT transcript_encrypted FROM diary_entries WHERE id = ? AND transcript_encrypted IS NOT NULL',
      [entryId]
    );
    if (existingTranscript.length > 0 && existingTranscript[0].values.length > 0) {
      logger.info('Diary entry #' + entryId + ' already has a transcript');
      return { success: true, entryId: entryId, already_transcribed: true };
    }

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

    // Generate transcript
    logger.info('Starting transcription for diary entry #' + entryId + ' (type: ' + entryType + ')');
    var transcript = await transcribeDiaryEntry(entryType, contentText, fileRef);

    // Encrypt the transcript (Class A data)
    var encResult = encrypt(transcript);

    // Store encrypted transcript
    db.run(
      "UPDATE diary_entries SET transcript_encrypted = ?, updated_at = datetime('now') WHERE id = ?",
      [encResult.encrypted, entryId]
    );

    // Update encryption key info if not already set
    db.run(
      "UPDATE diary_entries SET encryption_key_id = COALESCE(encryption_key_id, ?), payload_version = COALESCE(payload_version, ?) WHERE id = ?",
      [encResult.keyId, encResult.keyVersion, entryId]
    );

    saveDatabase();

    logger.info('Transcription completed for diary entry #' + entryId);

    return { success: true, entryId: entryId };
  } catch (error) {
    logger.error('Diary transcription failed for entry #' + entryId + ': ' + error.message);
    return { success: false, entryId: entryId, error: error.message };
  }
}

module.exports = {
  transcribeDiaryEntry,
  processDiaryTranscription,
  isConfigured
};
