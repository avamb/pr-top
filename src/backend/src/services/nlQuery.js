// Natural Language Query Service
// Provides semantic search across client diary entries, notes, and sessions
// Uses TF-IDF inspired relevance scoring for semantic matching beyond keyword-only search

const { getDatabase } = require('../db/connection');
const { decrypt } = require('./encryption');
const { logger } = require('../utils/logger');

/**
 * Tokenize text into normalized words (lowercased, stripped of punctuation)
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0400-\u04FF]/g, ' ')  // Keep cyrillic + latin + numbers
    .split(/\s+/)
    .filter(w => w.length > 1);  // Remove single-char tokens
}

/**
 * Expand query with related terms for semantic matching.
 * Maps common therapy-related concepts to synonyms/related terms.
 */
function expandQuery(queryTokens) {
  const synonymMap = {
    // Emotions
    'anxiety': ['anxious', 'worried', 'worry', 'nervous', 'panic', 'fear', 'scared', 'tense', 'stress', 'stressed'],
    'anxious': ['anxiety', 'worried', 'worry', 'nervous', 'panic', 'fear'],
    'depression': ['depressed', 'sad', 'sadness', 'hopeless', 'despair', 'low', 'mood', 'unhappy'],
    'depressed': ['depression', 'sad', 'sadness', 'hopeless', 'despair', 'low'],
    'sad': ['sadness', 'depressed', 'unhappy', 'grief', 'crying', 'tears'],
    'angry': ['anger', 'rage', 'furious', 'irritated', 'frustrated', 'annoyed'],
    'anger': ['angry', 'rage', 'furious', 'irritated', 'frustrated'],
    'happy': ['happiness', 'joy', 'joyful', 'pleased', 'content', 'satisfied', 'good'],
    'stress': ['stressed', 'stressful', 'pressure', 'overwhelmed', 'burnout', 'tension'],
    'fear': ['afraid', 'scared', 'frightened', 'phobia', 'terror', 'anxiety'],
    'sleep': ['insomnia', 'sleeping', 'nightmare', 'nightmares', 'rest', 'tired', 'fatigue'],
    'insomnia': ['sleep', 'sleeping', 'sleepless', 'awake'],
    // Therapy concepts
    'progress': ['improvement', 'better', 'improved', 'growth', 'advancing', 'positive'],
    'crisis': ['emergency', 'urgent', 'sos', 'distress', 'breakdown', 'critical'],
    'relationship': ['relationships', 'partner', 'family', 'spouse', 'marriage', 'social'],
    'work': ['job', 'career', 'workplace', 'employment', 'boss', 'colleague'],
    'trauma': ['traumatic', 'ptsd', 'flashback', 'abuse', 'neglect'],
    'coping': ['cope', 'coped', 'managing', 'strategy', 'strategies', 'technique'],
    'goal': ['goals', 'objective', 'objectives', 'target', 'aim'],
    'feeling': ['feelings', 'felt', 'emotion', 'emotions', 'emotional'],
    'session': ['sessions', 'meeting', 'appointment', 'therapy'],
    // Russian common terms
    'тревога': ['тревожность', 'беспокойство', 'волнение', 'паника', 'страх'],
    'депрессия': ['подавленность', 'грусть', 'тоска', 'уныние'],
    'сон': ['бессонница', 'кошмар', 'усталость', 'отдых'],
    'стресс': ['напряжение', 'давление', 'перегрузка'],
  };

  const expanded = new Set(queryTokens);
  for (const token of queryTokens) {
    if (synonymMap[token]) {
      for (const synonym of synonymMap[token]) {
        expanded.add(synonym);
      }
    }
  }
  return Array.from(expanded);
}

/**
 * Calculate relevance score between a query and a document.
 * Uses expanded query matching with position-aware scoring.
 * Returns a score > 0 for relevant documents, 0 for irrelevant.
 */
function calculateRelevance(queryTokens, expandedTokens, docText) {
  if (!docText) return 0;

  const docTokens = tokenize(docText);
  if (docTokens.length === 0) return 0;

  const docTokenSet = new Set(docTokens);

  let score = 0;
  let directMatches = 0;
  let expandedMatches = 0;

  // Direct query token matches (high weight)
  for (const qt of queryTokens) {
    if (docTokenSet.has(qt)) {
      directMatches++;
      // Count occurrences for TF-like scoring
      const count = docTokens.filter(t => t === qt).length;
      score += 3 * Math.log(1 + count); // TF component with log dampening
    }
  }

  // Expanded (synonym) matches (lower weight)
  for (const et of expandedTokens) {
    if (!queryTokens.includes(et) && docTokenSet.has(et)) {
      expandedMatches++;
      const count = docTokens.filter(t => t === et).length;
      score += 1.5 * Math.log(1 + count);
    }
  }

  // Phrase matching bonus: if consecutive query tokens appear together in doc
  for (let i = 0; i < queryTokens.length - 1; i++) {
    const bigram = queryTokens[i] + ' ' + queryTokens[i + 1];
    if (docText.toLowerCase().includes(bigram)) {
      score += 5; // Significant bonus for phrase match
    }
  }

  // Normalize by document length (prefer concise matches)
  if (docTokens.length > 0) {
    const lengthPenalty = Math.log(docTokens.length + 1);
    score = score / Math.sqrt(lengthPenalty);
  }

  // Require at least one direct or expanded match
  if (directMatches === 0 && expandedMatches === 0) return 0;

  // Boost score if high proportion of query terms matched
  const matchRatio = (directMatches + expandedMatches * 0.5) / queryTokens.length;
  score *= (1 + matchRatio);

  return Math.round(score * 100) / 100;
}

/**
 * Execute a natural language query against a client's data.
 * Searches diary entries, therapist notes, and session transcripts/summaries.
 *
 * @param {number} therapistId - The therapist performing the query
 * @param {number} clientId - The client to search
 * @param {string} query - The natural language query text
 * @param {object} options - Optional: { limit: 10 }
 * @returns {{ results: Array, query: string, expanded_terms: string[], total_searched: number }}
 */
function executeNLQuery(therapistId, clientId, query, options = {}) {
  const db = getDatabase();
  const limit = options.limit || 10;

  // Tokenize and expand the query
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return { results: [], query, expanded_terms: [], total_searched: 0 };
  }

  const expandedTokens = expandQuery(queryTokens);

  const results = [];
  let totalSearched = 0;

  // 1. Search diary entries
  const diaryResult = db.exec(
    `SELECT id, entry_type, content_encrypted, transcript_encrypted, created_at
     FROM diary_entries WHERE client_id = ? ORDER BY created_at DESC`,
    [clientId]
  );

  if (diaryResult.length > 0) {
    for (const row of diaryResult[0].values) {
      totalSearched++;
      const [id, entryType, contentEnc, transcriptEnc, createdAt] = row;

      let content = '';
      try {
        if (contentEnc) content = decrypt(contentEnc);
      } catch (e) {
        logger.debug(`Failed to decrypt diary entry ${id}: ${e.message}`);
        continue;
      }

      let transcript = '';
      try {
        if (transcriptEnc) transcript = decrypt(transcriptEnc);
      } catch (e) { /* skip transcript if can't decrypt */ }

      const combinedText = [content, transcript].filter(Boolean).join(' ');
      const relevance = calculateRelevance(queryTokens, expandedTokens, combinedText);

      if (relevance > 0) {
        // Create snippet around matching area
        const snippet = createSnippet(combinedText, queryTokens, expandedTokens);
        results.push({
          type: 'diary',
          entry_type: entryType,
          id,
          content: snippet,
          relevance,
          created_at: createdAt
        });
      }
    }
  }

  // 2. Search therapist notes
  const notesResult = db.exec(
    `SELECT id, note_encrypted, session_date, created_at
     FROM therapist_notes WHERE therapist_id = ? AND client_id = ? ORDER BY created_at DESC`,
    [therapistId, clientId]
  );

  if (notesResult.length > 0) {
    for (const row of notesResult[0].values) {
      totalSearched++;
      const [id, noteEnc, sessionDate, createdAt] = row;

      let noteText = '';
      try {
        if (noteEnc) noteText = decrypt(noteEnc);
      } catch (e) {
        logger.debug(`Failed to decrypt note ${id}: ${e.message}`);
        continue;
      }

      const relevance = calculateRelevance(queryTokens, expandedTokens, noteText);

      if (relevance > 0) {
        const snippet = createSnippet(noteText, queryTokens, expandedTokens);
        results.push({
          type: 'note',
          id,
          content: snippet,
          session_date: sessionDate,
          relevance,
          created_at: createdAt
        });
      }
    }
  }

  // 3. Search session transcripts and summaries
  const sessionsResult = db.exec(
    `SELECT id, transcript_encrypted, summary_encrypted, status, created_at
     FROM sessions WHERE therapist_id = ? AND client_id = ? ORDER BY created_at DESC`,
    [therapistId, clientId]
  );

  if (sessionsResult.length > 0) {
    for (const row of sessionsResult[0].values) {
      totalSearched++;
      const [id, transcriptEnc, summaryEnc, status, createdAt] = row;

      let transcript = '';
      let summary = '';
      try {
        if (transcriptEnc) transcript = decrypt(transcriptEnc);
      } catch (e) { /* skip */ }
      try {
        if (summaryEnc) summary = decrypt(summaryEnc);
      } catch (e) { /* skip */ }

      const combinedText = [transcript, summary].filter(Boolean).join(' ');
      if (!combinedText) continue;

      const relevance = calculateRelevance(queryTokens, expandedTokens, combinedText);

      if (relevance > 0) {
        const snippet = createSnippet(combinedText, queryTokens, expandedTokens);
        results.push({
          type: 'session',
          id,
          content: snippet,
          status,
          relevance,
          created_at: createdAt
        });
      }
    }
  }

  // Sort by relevance (highest first) and limit
  results.sort((a, b) => b.relevance - a.relevance);
  const topResults = results.slice(0, limit);

  return {
    results: topResults,
    query,
    query_tokens: queryTokens,
    expanded_terms: expandedTokens.filter(t => !queryTokens.includes(t)),
    total_searched: totalSearched,
    total_matches: results.length
  };
}

/**
 * Create a relevant snippet from text, centered around matching terms.
 * Returns up to ~300 characters with context around the best match.
 */
function createSnippet(text, queryTokens, expandedTokens) {
  if (!text) return '';

  const maxLength = 300;
  if (text.length <= maxLength) return text;

  // Find the position of the first matching term
  const lowerText = text.toLowerCase();
  let bestPos = -1;

  // Try direct query tokens first
  for (const token of queryTokens) {
    const pos = lowerText.indexOf(token);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
      break;
    }
  }

  // Fall back to expanded tokens
  if (bestPos === -1) {
    for (const token of expandedTokens) {
      const pos = lowerText.indexOf(token);
      if (pos !== -1) {
        bestPos = pos;
        break;
      }
    }
  }

  if (bestPos === -1) {
    return text.substring(0, maxLength) + '...';
  }

  // Center snippet around the match
  const start = Math.max(0, bestPos - 100);
  const end = Math.min(text.length, start + maxLength);

  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

module.exports = {
  executeNLQuery,
  tokenize,
  expandQuery,
  calculateRelevance
};
