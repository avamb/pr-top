// AI Provider Registry and Factory
// Manages multiple AI providers and provides a unified interface.

var logger = require('../../utils/logger').logger;
var openaiProvider = require('./openai');
var anthropicProvider = require('./anthropic');
var googleProvider = require('./google');
var openrouterProvider = require('./openrouter');

// Provider registry
var providers = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
  openrouter: openrouterProvider
};

/**
 * Get a provider by name.
 * @param {string} name - Provider name
 * @returns {object|null} Provider module or null
 */
function getProvider(name) {
  return providers[name] || null;
}

/**
 * Detect the best provider for a given model name.
 * @param {string} model - Model name/slug
 * @returns {string} Provider name
 */
function detectProviderForModel(model) {
  if (!model) return 'openai';

  // Check for explicit provider prefix (e.g., "openai/gpt-4o")
  if (model.indexOf('/') !== -1) {
    var prefix = model.split('/')[0];
    if (providers[prefix]) return prefix;
    // OpenRouter style prefixes
    if (prefix === 'meta-llama' || prefix === 'mistralai' || prefix === 'deepseek' || prefix === 'qwen') {
      return 'openrouter';
    }
    return 'openrouter'; // Default to OpenRouter for prefixed models
  }

  // GPT models -> OpenAI
  if (model.indexOf('gpt-') === 0) return 'openai';

  // Claude models -> Anthropic
  if (model.indexOf('claude-') === 0) return 'anthropic';

  // Gemini models -> Google
  if (model.indexOf('gemini-') === 0) return 'google';

  // DeepSeek, Qwen, etc. -> OpenRouter
  if (model.indexOf('deepseek') === 0 || model.indexOf('qwen') === 0 ||
      model.indexOf('llama') === 0 || model.indexOf('mistral') === 0) {
    return 'openrouter';
  }

  // Default to OpenAI
  return 'openai';
}

/**
 * Get the active provider based on settings.
 * Checks DB settings first, then env vars, then falls back.
 * @param {object} db - Database instance (optional)
 * @returns {{provider: object, providerName: string, model: string}}
 */
function getActiveProvider(db) {
  var providerName = process.env.AI_PROVIDER || 'openai';
  var model = process.env.AI_MODEL || 'gpt-4o-mini';

  // Try to read from DB settings
  if (db) {
    try {
      var providerResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_provider'");
      if (providerResult.length > 0 && providerResult[0].values.length > 0) {
        providerName = providerResult[0].values[0][0];
      }

      var modelResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_model'");
      if (modelResult.length > 0 && modelResult[0].values.length > 0) {
        model = modelResult[0].values[0][0];
      }
    } catch (e) {
      logger.warn('[AI Provider] Could not read settings from DB: ' + e.message);
    }
  }

  // Auto-detect provider from model name if not explicitly set
  if (!process.env.AI_PROVIDER && providerName === 'openai') {
    providerName = detectProviderForModel(model);
  }

  var provider = providers[providerName];
  if (!provider) {
    logger.warn('[AI Provider] Unknown provider: ' + providerName + ', falling back to openai');
    provider = providers.openai;
    providerName = 'openai';
  }

  return { provider: provider, providerName: providerName, model: model };
}

/**
 * Get the active assistant provider based on settings.
 * Falls back to summarization settings, then env vars.
 * @param {object} db - Database instance (optional)
 * @returns {{provider: object, providerName: string, model: string}}
 */
function getActiveAssistantProvider(db) {
  var providerName = process.env.AI_PROVIDER || 'openai';
  var model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (db) {
    try {
      // First try assistant-specific settings
      var assistProvResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_assistant_provider'");
      if (assistProvResult.length > 0 && assistProvResult[0].values.length > 0) {
        providerName = assistProvResult[0].values[0][0];
        var assistModelResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_assistant_model'");
        if (assistModelResult.length > 0 && assistModelResult[0].values.length > 0) {
          model = assistModelResult[0].values[0][0];
        }
      } else {
        // Fall back to summarization settings
        var sumProvResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_summarization_provider'");
        if (sumProvResult.length > 0 && sumProvResult[0].values.length > 0) {
          providerName = sumProvResult[0].values[0][0];
        }
        var sumModelResult = db.exec("SELECT value FROM platform_settings WHERE key = 'ai_summarization_model'");
        if (sumModelResult.length > 0 && sumModelResult[0].values.length > 0) {
          model = sumModelResult[0].values[0][0];
        }
      }
    } catch (e) {
      logger.warn('[AI Provider] Could not read assistant settings from DB: ' + e.message);
    }
  }

  var provider = providers[providerName];
  if (!provider) {
    logger.warn('[AI Provider] Unknown assistant provider: ' + providerName + ', falling back to openai');
    provider = providers.openai;
    providerName = 'openai';
  }

  return { provider: provider, providerName: providerName, model: model };
}

/**
 * Check if any AI provider is configured.
 * @returns {boolean}
 */
function isAnyConfigured() {
  for (var name in providers) {
    if (providers[name].isConfigured()) return true;
  }
  return false;
}

/**
 * Get list of all configured providers.
 * @returns {Array<string>}
 */
function getConfiguredProviders() {
  var configured = [];
  for (var name in providers) {
    if (providers[name].isConfigured()) {
      configured.push(name);
    }
  }
  return configured;
}

/**
 * Get all available models across all configured providers.
 * @returns {Array<{provider: string, models: Array<string>}>}
 */
function getAllModels() {
  var result = [];
  for (var name in providers) {
    result.push({
      provider: name,
      configured: providers[name].isConfigured(),
      models: providers[name].listModels()
    });
  }
  return result;
}

/**
 * Unified chat function - uses the active provider.
 * @param {Array} messages - Array of {role, content} messages
 * @param {object} options - { model, temperature, max_tokens, provider }
 * @param {object} db - Database instance (optional, for reading settings)
 * @returns {Promise<{text: string, input_tokens: number, output_tokens: number, model: string, provider: string}>}
 */
async function chat(messages, options, db) {
  options = options || {};

  var providerName, provider, model;

  if (options.provider) {
    providerName = options.provider;
    provider = providers[providerName];
    model = options.model;
    if (!provider) throw new Error('Unknown AI provider: ' + providerName);
  } else {
    var active = getActiveProvider(db);
    provider = active.provider;
    providerName = active.providerName;
    model = options.model || active.model;
  }

  if (!provider.isConfigured()) {
    throw new Error('AI provider ' + providerName + ' is not configured (missing API key)');
  }

  var result = await provider.chat(messages, { model: model, temperature: options.temperature, max_tokens: options.max_tokens });
  result.provider = providerName;
  return result;
}

module.exports = {
  getProvider: getProvider,
  getActiveProvider: getActiveProvider,
  getActiveAssistantProvider: getActiveAssistantProvider,
  detectProviderForModel: detectProviderForModel,
  isAnyConfigured: isAnyConfigured,
  getConfiguredProviders: getConfiguredProviders,
  getAllModels: getAllModels,
  chat: chat,
  providers: providers
};
