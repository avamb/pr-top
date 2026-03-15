// AI Usage Logger Service
// Tracks every AI API call with model, tokens, calculated cost, therapist_id, and timestamp.
// Foundation for the cost dashboard.

const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');

// Model pricing per 1M tokens (input/output) in USD
// Updated as of 2026 pricing
const MODEL_PRICING = {
  // OpenAI models
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'o4-mini': { input: 1.10, output: 4.40 },
  'whisper-1': { input: 0.006, output: 0 }, // per minute, approximated per 1M tokens

  // Anthropic models
  'claude-3.5-haiku': { input: 0.80, output: 4.00 },
  'claude-3-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-4-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },

  // Google Gemini models
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },

  // OpenRouter / Chinese models
  'deepseek/deepseek-chat-v3': { input: 0.27, output: 1.10 },
  'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
  'qwen/qwen-2.5-72b': { input: 0.30, output: 0.30 },
  'deepseek-v3': { input: 0.27, output: 1.10 },
  'deepseek-r1': { input: 0.55, output: 2.19 },
  'qwen-2.5-72b': { input: 0.30, output: 0.30 },

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

/**
 * Check if AI spending limit has been reached or is at warning level.
 * Reads ai_monthly_limit_usd and ai_limit_warning_percent from platform_settings.
 * Returns { allowed, warning, limitReached, currentSpend, limit, warningThreshold, percentUsed }
 */
function checkSpendingLimit() {
  try {
    const db = getDatabase();

    // Read limit settings
    const limitResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_monthly_limit_usd'");
    const limitUsd = limitResult.length > 0 && limitResult[0].values.length > 0
      ? parseFloat(limitResult[0].values[0][0]) : 0;

    // 0 means unlimited
    if (!limitUsd || limitUsd <= 0) {
      return { allowed: true, warning: false, limitReached: false, currentSpend: 0, limit: 0, warningThreshold: 0, percentUsed: 0 };
    }

    const warnResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_limit_warning_percent'");
    const warningPercent = warnResult.length > 0 && warnResult[0].values.length > 0
      ? parseInt(warnResult[0].values[0][0], 10) : 80;

    // Calculate current month spend
    const now = new Date();
    const monthStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
    const spendResult = db.exec(
      "SELECT COALESCE(SUM(cost_usd), 0) as total FROM ai_usage_log WHERE timestamp >= ?",
      [monthStart]
    );
    const currentSpend = spendResult.length > 0 && spendResult[0].values.length > 0
      ? spendResult[0].values[0][0] : 0;

    const percentUsed = (currentSpend / limitUsd) * 100;
    const warningThreshold = limitUsd * (warningPercent / 100);
    const warning = currentSpend >= warningThreshold && currentSpend < limitUsd;
    const limitReached = currentSpend >= limitUsd;

    // Update flags in platform_settings
    if (warning && !limitReached) {
      const warnSentResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_limit_warning_sent'");
      const alreadySent = warnSentResult.length > 0 && warnSentResult[0].values.length > 0 && warnSentResult[0].values[0][0] === 'true';
      if (!alreadySent) {
        db.run(
          "INSERT INTO platform_settings (key, value, updated_at) VALUES ('ai_limit_warning_sent', 'true', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = datetime('now')"
        );
        saveDatabase();
        logger.warn(`[AI Spending] Warning threshold reached: $${currentSpend.toFixed(4)} of $${limitUsd} limit (${percentUsed.toFixed(1)}%)`);
      }
    }

    if (limitReached) {
      db.run(
        "INSERT INTO platform_settings (key, value, updated_at) VALUES ('ai_limit_reached', 'true', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = datetime('now')"
      );
      saveDatabase();
      logger.warn(`[AI Spending] Monthly limit REACHED: $${currentSpend.toFixed(4)} of $${limitUsd} limit`);
    }

    return {
      allowed: !limitReached,
      warning,
      limitReached,
      currentSpend,
      limit: limitUsd,
      warningThreshold,
      percentUsed: Math.min(percentUsed, 100)
    };
  } catch (err) {
    logger.error(`[AI Spending] Failed to check spending limit: ${err.message}`);
    // On error, allow the call (fail-open for spending checks)
    return { allowed: true, warning: false, limitReached: false, currentSpend: 0, limit: 0, warningThreshold: 0, percentUsed: 0 };
  }
}

/**
 * Get current spending limit status for display.
 */
function getSpendingLimitStatus() {
  const db = getDatabase();

  const getSetting = (key, fallback) => {
    const r = db.exec("SELECT value FROM platform_settings WHERE key = ?", [key]);
    return (r.length > 0 && r[0].values.length > 0) ? r[0].values[0][0] : fallback;
  };

  const limitUsd = parseFloat(getSetting('ai_monthly_limit_usd', '0'));
  const warningPercent = parseInt(getSetting('ai_limit_warning_percent', '80'), 10);

  // Current month spend
  const now = new Date();
  const monthStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  const spendResult = db.exec(
    "SELECT COALESCE(SUM(cost_usd), 0) as total FROM ai_usage_log WHERE timestamp >= ?",
    [monthStart]
  );
  const currentSpend = spendResult.length > 0 && spendResult[0].values.length > 0
    ? spendResult[0].values[0][0] : 0;

  const percentUsed = limitUsd > 0 ? Math.min((currentSpend / limitUsd) * 100, 100) : 0;

  return {
    limit_usd: limitUsd,
    warning_percent: warningPercent,
    current_spend: currentSpend,
    percent_used: percentUsed,
    unlimited: limitUsd <= 0,
    warning: limitUsd > 0 && currentSpend >= (limitUsd * warningPercent / 100) && currentSpend < limitUsd,
    limit_reached: limitUsd > 0 && currentSpend >= limitUsd
  };
}

module.exports = {
  logUsage,
  calculateCost,
  getUsageStats,
  getUsageByTherapist,
  getTotalUsage,
  checkSpendingLimit,
  getSpendingLimitStatus,
  MODEL_PRICING
};
