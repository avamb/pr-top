// OpenRouter Provider
// Supports any model via OpenRouter's unified API (OpenAI-compatible)
// Including: deepseek-chat, qwen-turbo, mistral, llama, and hundreds more

var logger = require('../../utils/logger').logger;

var API_KEY = process.env.OPENROUTER_API_KEY;
var API_URL = 'https://openrouter.ai/api/v1';

var POPULAR_MODELS = [
  'deepseek/deepseek-chat-v3',
  'deepseek/deepseek-r1',
  'qwen/qwen-2.5-72b',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-4-sonnet',
  'google/gemini-2.0-flash',
  'google/gemini-2.5-pro',
  'meta-llama/llama-3-70b-instruct'
];

function isConfigured() {
  return !!(API_KEY && API_KEY !== 'your-openrouter-api-key' && API_KEY.length > 10);
}

/**
 * Send a chat completion request via OpenRouter (OpenAI-compatible).
 * @param {Array} messages - Array of {role, content} messages
 * @param {object} options - { model, temperature, max_tokens }
 * @returns {Promise<{text: string, input_tokens: number, output_tokens: number, model: string}>}
 */
async function chat(messages, options) {
  options = options || {};
  var model = options.model || 'openai/gpt-4o-mini';
  var temperature = options.temperature != null ? options.temperature : 0.3;
  var maxTokens = options.max_tokens || 2000;

  logger.info('[OpenRouter] Calling chat completions: model=' + model);

  var response = await fetch(API_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.PUBLIC_URL || 'http://localhost:3000',
      'X-Title': 'PR-TOP'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    var errorDetail = '';
    try {
      var errorBody = await response.text();
      errorDetail = ' - ' + errorBody.slice(0, 500);
    } catch (_) {}
    throw new Error('OpenRouter API returned ' + response.status + errorDetail);
  }

  var data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('OpenRouter API returned unexpected response format');
  }

  var text = data.choices[0].message.content.trim();
  var inputTokens = (data.usage && data.usage.prompt_tokens) || 0;
  var outputTokens = (data.usage && data.usage.completion_tokens) || 0;

  return {
    text: text,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model: data.model || model
  };
}

function listModels() {
  return POPULAR_MODELS;
}

module.exports = {
  name: 'openrouter',
  isConfigured: isConfigured,
  chat: chat,
  listModels: listModels
};
