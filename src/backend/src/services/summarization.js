// Summarization Service
// Generates AI summaries from session transcripts.
// In development mode without API keys, uses a structured template summarization.
// In production, integrates with AI service (e.g., OpenAI GPT, Claude API).
//
// IMPORTANT: Summaries must avoid diagnosis language per product principles.
// AI summaries are therapist-supportive tools, not clinical judgments.

const { getDatabase, saveDatabase } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const { logger } = require('../utils/logger');

const AI_API_KEY = process.env.AI_API_KEY;

/**
 * Check if a real AI service is configured.
 */
function isConfigured() {
  return !!(AI_API_KEY &&
    AI_API_KEY !== 'your-ai-api-key' &&
    AI_API_KEY.length > 10);
}

/**
 * Generate a summary from transcript text.
 * In production: calls external AI API.
 * In dev mode: generates a structured development summary.
 *
 * @param {string} transcript - The plaintext transcript
 * @param {object} options - Optional context (client goals, anamnesis)
 * @returns {Promise<string>} The summary text
 */
async function generateSummary(transcript, options = {}) {
  if (isConfigured()) {
    return await callAIAPI(transcript, options);
  } else {
    return generateDevSummary(transcript, options);
  }
}

/**
 * Generate a structured development summary from a transcript.
 * Follows the product principle: no diagnosis language, therapist-supportive.
 */
function generateDevSummary(transcript, options = {}) {
  const timestamp = new Date().toISOString();
  const wordCount = transcript.split(/\s+/).length;
  const lineCount = transcript.split('\n').filter(l => l.trim()).length;

  // Extract key topics from transcript (simple keyword extraction for dev mode)
  const topics = [];
  const topicPatterns = [
    { pattern: /anxiety/i, topic: 'anxiety management' },
    { pattern: /breath|breathing/i, topic: 'breathing exercises' },
    { pattern: /sleep/i, topic: 'sleep patterns' },
    { pattern: /relationship/i, topic: 'interpersonal relationships' },
    { pattern: /work|job|career/i, topic: 'work-related concerns' },
    { pattern: /exercise/i, topic: 'therapeutic exercises' },
    { pattern: /progress|better|improvement/i, topic: 'progress and improvements' },
    { pattern: /stress/i, topic: 'stress management' },
    { pattern: /family/i, topic: 'family dynamics' },
    { pattern: /mood/i, topic: 'mood patterns' }
  ];

  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(transcript)) {
      topics.push(topic);
    }
  }

  if (topics.length === 0) {
    topics.push('general session discussion');
  }

  // Build summary - avoiding diagnosis language per product principles
  const summary = [
    `Session Summary`,
    `Generated: ${timestamp}`,
    `Transcript length: ${wordCount} words, ${lineCount} lines`,
    ``,
    `Key Topics Discussed:`,
    ...topics.map(t => `  - ${t}`),
    ``,
    `Session Observations:`,
    `  - Client reported on their experiences since the previous session`,
    `  - Discussion covered ${topics.slice(0, 3).join(', ')}`,
    topics.length > 1
      ? `  - Multiple areas of focus addressed during the session`
      : `  - Session maintained focus on a single area`,
    ``,
    `Client-Reported Progress:`,
    `  - Client described engagement with previously assigned exercises`,
    `  - Noted areas where they observed changes in their daily experience`,
    ``,
    `Suggested Follow-up Areas:`,
    `  - Continue monitoring the topics discussed`,
    `  - Review effectiveness of current therapeutic approach`,
    `  - Consider adjusting exercise assignments based on client feedback`,
    ``,
    `Note: This summary is a supportive tool for session preparation.`,
    `It reflects observed themes and client-reported experiences only.`
  ].join('\n');

  logger.info(`Dev summary generated (${wordCount} words transcript -> summary)`);
  return summary;
}

/**
 * Call external AI API for summarization (production mode).
 */
async function callAIAPI(transcript, options = {}) {
  throw new Error('Real AI API integration not yet implemented. Set AI_API_KEY to a valid key.');
}

/**
 * Process a session: generate summary from transcript, encrypt and store.
 * Should be called after transcription is complete.
 *
 * @param {number} sessionId - The session ID to process
 * @returns {Promise<{success: boolean, sessionId: number}>}
 */
async function processSessionSummary(sessionId) {
  const db = getDatabase();

  try {
    // Get session details
    const result = db.exec(
      'SELECT id, therapist_id, client_id, transcript_encrypted, summary_encrypted FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const [id, therapistId, clientId, transcriptEncrypted, existingSummary] = result[0].values[0];

    if (!transcriptEncrypted) {
      throw new Error(`Session ${sessionId} has no transcript to summarize`);
    }

    // Update status to summarizing
    db.run(
      "UPDATE sessions SET status = 'summarizing', updated_at = datetime('now') WHERE id = ?",
      [sessionId]
    );
    saveDatabase();

    // Decrypt the transcript
    const transcript = decrypt(transcriptEncrypted);

    // Get client context if available (for richer summaries)
    let context = {};
    const ctxResult = db.exec(
      'SELECT anamnesis_encrypted, current_goals_encrypted FROM client_context WHERE therapist_id = ? AND client_id = ?',
      [therapistId, clientId]
    );
    if (ctxResult.length > 0 && ctxResult[0].values.length > 0) {
      try {
        if (ctxResult[0].values[0][0]) context.anamnesis = decrypt(ctxResult[0].values[0][0]);
        if (ctxResult[0].values[0][1]) context.goals = decrypt(ctxResult[0].values[0][1]);
      } catch (e) {
        logger.warn(`Could not decrypt client context for summary: ${e.message}`);
      }
    }

    // Generate summary
    logger.info(`Generating summary for session ${sessionId}...`);
    const summary = await generateSummary(transcript, context);

    // Encrypt the summary (Class A data)
    const { encrypted: summaryEncrypted, keyVersion, keyId } = encrypt(summary);

    // Store encrypted summary
    db.run(
      `UPDATE sessions
       SET summary_encrypted = ?, encryption_key_id = ?, payload_version = ?,
           status = 'complete', updated_at = datetime('now')
       WHERE id = ?`,
      [summaryEncrypted, keyId, keyVersion, sessionId]
    );

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES (?, 'session_summarized', 'session', ?)",
      [therapistId, sessionId]
    );

    saveDatabase();

    logger.info(`Summary generated for session ${sessionId}`);

    return { success: true, sessionId };
  } catch (error) {
    logger.error(`Summary generation failed for session ${sessionId}: ${error.message}`);

    db.run(
      "UPDATE sessions SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
      [sessionId]
    );
    saveDatabase();

    return { success: false, sessionId, error: error.message };
  }
}

module.exports = {
  generateSummary,
  processSessionSummary,
  isConfigured
};
