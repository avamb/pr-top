// Anthropic Provider
// Supports: claude-3-haiku, claude-3.5-sonnet, claude-3-sonnet, claude-3-opus
// Uses Anthropic Messages API

var logger = require('../../utils/logger').logger;

var API_KEY = process.env.ANTHROPIC_API_KEY;
var API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1';

var SUPPORTED_MODELS = [
  'claude-3.5-haiku',
  'claude-4-sonnet'
];

// Aliases for convenience
var MODEL_ALIASES = {
  'claude-3-haiku': 'claude-3-haiku-20241022',
  'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-sonnet': 'claude-3-sonnet-20240229',
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-haiku-20241022': 'claude-3-haiku-20241022',
  'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022'
};

function isConfigured() {
  return !!(API_KEY && API_KEY !== 'your-anthropic-api-key' && API_KEY.length > 10);
}

/**
 * Send a messages request to Anthropic.
 * @param {Array} messages - Array of {role, content} messages
 * @param {object} options - { model, temperature, max_tokens }
 * @returns {Promise<{text: string, input_tokens: number, output_tokens: number, model: string}>}
 */
async function chat(messages, options) {
  options = options || {};
  var model = options.model || 'claude-3-haiku-20241022';

  // Resolve alias
  if (MODEL_ALIASES[model]) {
    model = MODEL_ALIASES[model];
  }

  var temperature = options.temperature != null ? options.temperature : 0.3;
  var maxTokens = options.max_tokens || 2000;

  // Anthropic uses a different message format: system goes as top-level param
  var systemMessage = '';
  var userMessages = [];
  for (var i = 0; i < messages.length; i++) {
    if (messages[i].role === 'system') {
      systemMessage += (systemMessage ? '\n\n' : '') + messages[i].content;
    } else {
      userMessages.push({ role: messages[i].role, content: messages[i].content });
    }
  }

  // Ensure alternating user/assistant messages
  if (userMessages.length === 0) {
    userMessages.push({ role: 'user', content: systemMessage });
    systemMessage = '';
  }

  logger.info('[Anthropic] Calling messages API: model=' + model);

  var body = {
    model: model,
    messages: userMessages,
    temperature: temperature,
    max_tokens: maxTokens
  };

  if (systemMessage) {
    body.system = systemMessage;
  }

  var response = await fetch(API_URL + '/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    var errorDetail = '';
    try {
      var errorBody = await response.text();
      errorDetail = ' - ' + errorBody.slice(0, 500);
    } catch (_) {}
    throw new Error('Anthropic API returned ' + response.status + errorDetail);
  }

  var data = await response.json();

  if (!data.content || !data.content[0]) {
    throw new Error('Anthropic API returned unexpected response format');
  }

  var text = data.content[0].text.trim();
  var inputTokens = (data.usage && data.usage.input_tokens) || 0;
  var outputTokens = (data.usage && data.usage.output_tokens) || 0;

  return {
    text: text,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model: data.model || model
  };
}

function listModels() {
  return SUPPORTED_MODELS;
}

module.exports = {
  name: 'anthropic',
  isConfigured: isConfigured,
  chat: chat,
  listModels: listModels
};
