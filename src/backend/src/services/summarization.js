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
let vectorStoreService = null;
function getVectorStoreService() {
  if (!vectorStoreService) {
    vectorStoreService = require('./vectorStore');
  }
  return vectorStoreService;
}

const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

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
  const summaryParts = [
    `[DEV MODE] Session Summary`,
    `Generated: ${timestamp}`,
    `Transcript length: ${wordCount} words, ${lineCount} lines`,
    ``
  ];

  // Include AI instructions/boundaries if provided by therapist
  if (options.ai_instructions) {
    summaryParts.push(
      `AI Instructions Applied:`,
      `  ${options.ai_instructions}`,
      ``
    );
  }

  // Include contraindications if set
  if (options.contraindications) {
    summaryParts.push(
      `Contraindications Noted:`,
      `  ${options.contraindications}`,
      ``
    );
  }

  summaryParts.push(
    `Key Topics Discussed:`,
    ...topics.map(t => `  - ${t}`),
    ``,
    `Session Observations:`,
    `  - Client reported on their experiences since the previous session`,
    `  - Discussion covered ${topics.slice(0, 3).join(', ')}`,
    topics.length > 1
      ? `  - Multiple areas of focus addressed during the session`
      : `  - Session maintained focus on a single area`,
    ``
  );

  // Include client goals context if available
  if (options.goals) {
    summaryParts.push(
      `Current Goals Context:`,
      `  ${options.goals}`,
      ``
    );
  }

  summaryParts.push(
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
  );

  const summary = summaryParts.join('\n');

  logger.info(`Dev summary generated (${wordCount} words transcript -> summary)`);
  return summary;
}

/**
 * Call external AI API for summarization (production mode).
 * Uses OpenAI-compatible chat completions endpoint.
 *
 * @param {string} transcript - Decrypted transcript text
 * @param {object} options - Client context (anamnesis, goals, contraindications, ai_instructions)
 * @returns {Promise<string>} The AI-generated summary
 */
async function callAIAPI(transcript, options = {}) {
  const systemPrompt = buildSystemPrompt(options);

  // Truncate very long transcripts to stay within token limits (~60k chars ≈ 15k tokens)
  const maxTranscriptLength = 60000;
  const truncatedTranscript = transcript.length > maxTranscriptLength
    ? transcript.slice(0, maxTranscriptLength) + '\n\n[Transcript truncated due to length]'
    : transcript;

  const userMessage = `Please summarize the following therapy session transcript:\n\n${truncatedTranscript}`;

  logger.info(`Calling AI API for summarization: ${AI_API_URL}/chat/completions (model=${AI_MODEL}, transcript=${transcript.length} chars)`);

  const response = await fetch(`${AI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 2000
    }),
    signal: AbortSignal.timeout(120000) // 2 minute timeout
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = await response.text();
      errorDetail = ` - ${errorBody.slice(0, 500)}`;
    } catch (_) {}
    throw new Error(`AI API returned ${response.status}${errorDetail}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('AI API returned unexpected response format');
  }

  const summary = data.choices[0].message.content.trim();

  if (!summary || summary.length < 20) {
    throw new Error('AI API returned empty or too-short summary');
  }

  logger.info(`AI summary generated successfully (${summary.length} chars, model=${data.model || AI_MODEL})`);
  return summary;
}

/**
 * Build the system prompt for session summarization.
 * Includes therapist-supportive instructions and client context.
 */
function buildSystemPrompt(options = {}) {
  const parts = [
    `You are a clinical documentation assistant supporting a practicing psychologist/therapist.`,
    `Your task is to summarize a therapy session transcript for the therapist's records.`,
    ``,
    `## Guidelines`,
    `- Write from a professional, observational perspective`,
    `- Highlight key themes, client concerns, and progress indicators`,
    `- Note any significant emotional shifts or breakthroughs`,
    `- Identify action items, homework assignments, or follow-up areas discussed`,
    `- NEVER use diagnostic language or make clinical diagnoses`,
    `- NEVER label the client with disorders, conditions, or pathologies`,
    `- Use supportive, observational language (e.g., "client reported...", "client expressed...", "themes of... were explored")`,
    `- Keep the summary concise but comprehensive (300-600 words)`,
    `- Structure the summary with clear sections: Key Themes, Session Observations, Client-Reported Progress, Follow-up Areas`,
    ``
  ];

  // Add client context if available
  if (options.anamnesis || options.goals || options.contraindications || options.ai_instructions) {
    parts.push(`## Client Context (provided by therapist)`);

    if (options.anamnesis) {
      parts.push(`### Background/Anamnesis`, options.anamnesis, ``);
    }
    if (options.goals) {
      parts.push(`### Current Goals`, options.goals, ``);
    }
    if (options.contraindications) {
      parts.push(`### Contraindications`, `The following topics or approaches should be avoided or handled with care:`, options.contraindications, ``);
    }
    if (options.ai_instructions) {
      parts.push(`### Therapist Instructions for AI`, options.ai_instructions, ``);
    }

    parts.push(`Use this context to provide more relevant and tailored observations in the summary.`, ``);
  }

  return parts.join('\n');
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
      'SELECT anamnesis_encrypted, current_goals_encrypted, contraindications_encrypted, ai_instructions_encrypted FROM client_context WHERE therapist_id = ? AND client_id = ?',
      [therapistId, clientId]
    );
    if (ctxResult.length > 0 && ctxResult[0].values.length > 0) {
      try {
        if (ctxResult[0].values[0][0]) context.anamnesis = decrypt(ctxResult[0].values[0][0]);
        if (ctxResult[0].values[0][1]) context.goals = decrypt(ctxResult[0].values[0][1]);
        if (ctxResult[0].values[0][2]) context.contraindications = decrypt(ctxResult[0].values[0][2]);
        if (ctxResult[0].values[0][3]) context.ai_instructions = decrypt(ctxResult[0].values[0][3]);
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

    // Generate vector embedding from summary
    try {
      const vectorStore = getVectorStoreService();
      const embedResult = vectorStore.embedSessionSummary(sessionId, summary, clientId, therapistId);
      if (embedResult.success) {
        logger.info(`Vector embedding generated for session ${sessionId} summary (${embedResult.token_count} tokens)`);
      }
    } catch (embedErr) {
      logger.warn(`Vector embedding error for session ${sessionId} summary: ${embedErr.message}`);
    }

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
