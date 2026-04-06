// OpenAI Provider
// Supports: gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo
// Uses OpenAI Chat Completions API

var logger = require('../../utils/logger').logger;

var API_KEY = process.env.AI_API_KEY;
var API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1';

var SUPPORTED_MODELS = [
  'gpt-4o-mini',
  'gpt-4.1-nano',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'o4-mini'
];

function isConfigured() {
  return !!(API_KEY && API_KEY !== 'your-ai-api-key' && API_KEY.length > 10);
}

/**
 * Send a chat completion request to OpenAI.
 * @param {Array} messages - Array of {role, content} messages
 * @param {object} options - { model, temperature, max_tokens }
 * @returns {Promise<{text: string, input_tokens: number, output_tokens: number, model: string}>}
 */
async function chat(messages, options) {
  options = options || {};
  var model = options.model || process.env.AI_MODEL || 'gpt-4o-mini';
  var temperature = options.temperature != null ? options.temperature : 0.3;
  var maxTokens = options.max_tokens || 2000;

  logger.info('[OpenAI] Calling chat completions: model=' + model);

  var response = await fetch(API_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json'
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
    throw new Error('OpenAI API returned ' + response.status + errorDetail);
  }

  var data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('OpenAI API returned unexpected response format');
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

/**
 * Send a streaming chat completion request to OpenAI.
 * Returns an async generator that yields text chunks.
 * @param {Array} messages - Array of {role, content} messages
 * @param {object} options - { model, temperature, max_tokens }
 * @returns {AsyncGenerator<{text: string, done: boolean, input_tokens?: number, output_tokens?: number, model?: string}>}
 */
async function* chatStream(messages, options) {
  options = options || {};
  var model = options.model || process.env.AI_MODEL || 'gpt-4o-mini';
  var temperature = options.temperature != null ? options.temperature : 0.3;
  var maxTokens = options.max_tokens || 2000;

  logger.info('[OpenAI] Calling streaming chat completions: model=' + model);

  var response = await fetch(API_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      stream: true
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    var errorDetail = '';
    try {
      var errorBody = await response.text();
      errorDetail = ' - ' + errorBody.slice(0, 500);
    } catch (_) {}
    throw new Error('OpenAI API returned ' + response.status + errorDetail);
  }

  var reader = response.body.getReader();
  var decoder = new TextDecoder();
  var buffer = '';
  var fullText = '';

  try {
    while (true) {
      var readResult = await reader.read();
      if (readResult.done) break;

      buffer += decoder.decode(readResult.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || !line.startsWith('data: ')) continue;
        var data = line.slice(6);
        if (data === '[DONE]') {
          yield { text: '', done: true, fullText: fullText, model: model };
          return;
        }
        try {
          var parsed = JSON.parse(data);
          var content = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content;
          if (content) {
            fullText += content;
            yield { text: content, done: false };
          }
        } catch (e) {
          // Skip unparseable chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { text: '', done: true, fullText: fullText, model: model };
}

function listModels() {
  return SUPPORTED_MODELS;
}

module.exports = {
  name: 'openai',
  isConfigured: isConfigured,
  chat: chat,
  chatStream: chatStream,
  listModels: listModels
};
