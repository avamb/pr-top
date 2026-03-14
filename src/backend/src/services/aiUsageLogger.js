// AI Usage Logger Service
// Tracks every AI API call with model, tokens, calculated cost, therapist_id, and timestamp.
// Foundation for the cost dashboard.

const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');

// Model pricing per 1M tokens (input/output) in USD
// Updated as of 2024-2025 pricing
const MODEL_PRICING = {
  // OpenAI models
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'whisper-1': { input: 0.006, output: 0 }, // per second, approximated per 1M tokens

  // Anthropic models
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },

  // Google models
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },

  // Default fallback
  '_default': { input: 1.00, output: 3.00 }
};

/**
 * Calculate cost in USD for a given model and token counts.
 * @param {string} model - The model name
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Cost in USD
 */
function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['_default'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // Round to 6 decimal places
}

/**
 * Log an AI API usage event to the database.
 * @param {number} therapistId - The therapist who triggered the call
 * @param {string} provider - AI provider (openai, anthropic, google, openrouter)
 * @param {string} model - Model name
 * @param {string} operation - Operation type (summarization, transcription)
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @param {number} costUsd - Cost in USD (if not provided, will be calculated)
 * @param {number|null} sessionId - Optional session ID
 * @param {object|null} metadata - Optional metadata JSON
 */
function logUsage(therapistId, provider, model, operation, inputTokens, outputTokens, costUsd, sessionId = null, metadata = null) {
  try {
    const db = getDatabase();
    const totalTokens = inputTokens + outputTokens;
    const cost = costUsd != null ? costUsd : calculateCost(model, inputTokens, outputTokens);
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    db.run(
      `INSERT INTO ai_usage_log (therapist_id, timestamp, provider, model, operation, input_tokens, output_tokens, total_tokens, cost_usd, session_id, metadata)
       VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [therapistId, provider, model, operation, inputTokens, outputTokens, totalTokens, cost, sessionId, metadataJson]
    );
    saveDatabase();

    logger.info(`[AI Usage] ${operation} | model=${model} | tokens=${inputTokens}+${outputTokens}=${totalTokens} | cost=$${cost.toFixed(6)} | therapist=${therapistId}${sessionId ? ` | session=${sessionId}` : ''}`);
  } catch (err) {
    logger.error(`[AI Usage] Failed to log usage: ${err.message}`);
    // Don't throw - logging failure should not break the main operation
  }
}

/**
 * Get aggregated usage statistics with optional filters.
 * @param {object} filters - Optional filters
 * @param {string} filters.period - Aggregation period: 'day', 'week', 'month'
 * @param {string} filters.groupBy - Group by: 'model', 'therapist', 'operation'
 * @param {string} filters.dateFrom - Start date (ISO string)
 * @param {string} filters.dateTo - End date (ISO string)
 * @param {number} filters.therapistId - Filter by therapist
 * @returns {Array} Aggregated stats
 */
function getUsageStats(filters = {}) {
  const db = getDatabase();
  const params = [];
  const conditions = [];

  if (filters.dateFrom) {
    conditions.push('timestamp >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('timestamp <= ?');
    params.push(filters.dateTo);
  }
  if (filters.therapistId) {
    conditions.push('therapist_id = ?');
    params.push(filters.therapistId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let groupByExpr = '';
  let selectExtra = '';

  if (filters.groupBy === 'model') {
    groupByExpr = 'GROUP BY model';
    selectExtra = 'model,';
  } else if (filters.groupBy === 'therapist') {
    groupByExpr = 'GROUP BY therapist_id';
    selectExtra = 'therapist_id,';
  } else if (filters.groupBy === 'operation') {
    groupByExpr = 'GROUP BY operation';
    selectExtra = 'operation,';
  } else if (filters.period === 'day') {
    groupByExpr = "GROUP BY date(timestamp)";
    selectExtra = "date(timestamp) as period,";
  } else if (filters.period === 'week') {
    groupByExpr = "GROUP BY strftime('%Y-W%W', timestamp)";
    selectExtra = "strftime('%Y-W%W', timestamp) as period,";
  } else if (filters.period === 'month') {
    groupByExpr = "GROUP BY strftime('%Y-%m', timestamp)";
    selectExtra = "strftime('%Y-%m', timestamp) as period,";
  }

  const query = `SELECT ${selectExtra}
    COUNT(*) as call_count,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(total_tokens) as total_tokens,
    SUM(cost_usd) as total_cost_usd
    FROM ai_usage_log ${whereClause} ${groupByExpr}
    ORDER BY total_cost_usd DESC`;

  const result = db.exec(query, params);

  if (!result.length || !result[0].values.length) {
    return [];
  }

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

/**
 * Get usage for a specific therapist within a date range.
 * @param {number} therapistId
 * @param {string} dateFrom - ISO date string
 * @param {string} dateTo - ISO date string
 * @returns {Array} Usage records
 */
function getUsageByTherapist(therapistId, dateFrom, dateTo) {
  const db = getDatabase();
  const params = [therapistId];
  let dateCondition = '';

  if (dateFrom) {
    dateCondition += ' AND timestamp >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    dateCondition += ' AND timestamp <= ?';
    params.push(dateTo);
  }

  const query = `SELECT id, therapist_id, timestamp, provider, model, operation,
    input_tokens, output_tokens, total_tokens, cost_usd, session_id, metadata
    FROM ai_usage_log WHERE therapist_id = ?${dateCondition}
    ORDER BY timestamp DESC`;

  const result = db.exec(query, params);

  if (!result.length || !result[0].values.length) {
    return [];
  }

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

/**
 * Get total usage across all therapists within a date range.
 * @param {string} dateFrom - ISO date string
 * @param {string} dateTo - ISO date string
 * @returns {object} Totals: { total_calls, total_tokens, total_cost_usd }
 */
function getTotalUsage(dateFrom, dateTo) {
  const db = getDatabase();
  const params = [];
  const conditions = [];

  if (dateFrom) {
    conditions.push('timestamp >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('timestamp <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `SELECT
    COUNT(*) as total_calls,
    COALESCE(SUM(input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(cost_usd), 0) as total_cost_usd
    FROM ai_usage_log ${whereClause}`;

  const result = db.exec(query, params);

  if (!result.length || !result[0].values.length) {
    return { total_calls: 0, total_input_tokens: 0, total_output_tokens: 0, total_tokens: 0, total_cost_usd: 0 };
  }

  const columns = result[0].columns;
  const row = result[0].values[0];
  const obj = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

module.exports = {
  logUsage,
  calculateCost,
  getUsageStats,
  getUsageByTherapist,
  getTotalUsage,
  MODEL_PRICING
};
