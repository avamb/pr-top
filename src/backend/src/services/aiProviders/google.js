// Google Gemini Provider
// Supports: gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash
// Uses Google Generative AI REST API

var logger = require('../../utils/logger').logger;

var API_KEY = process.env.GOOGLE_AI_API_KEY;
var API_URL = 'https://generativelanguage.googleapis.com/v1beta';

var SUPPORTED_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro'
];

function isConfigured() {
  return !!(API_KEY && API_KEY !== 'your-google-ai-api-key' && API_KEY.length > 10);
}

/**
 * Send a generate content request to Google Gemini.
 * @param {Array} messages - Array of {role, content} messages
 * @param {object} options - { model, temperature, max_tokens }
 * @returns {Promise<{text: string, input_tokens: number, output_tokens: number, model: string}>}
 */
async function chat(messages, options) {
  options = options || {};
  var model = options.model || 'gemini-1.5-flash';
  var temperature = options.temperature != null ? options.temperature : 0.3;
  var maxTokens = options.max_tokens || 2000;

  // Convert OpenAI-style messages to Gemini format
  var systemInstruction = '';
  var contents = [];

  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (msg.role === 'system') {
      systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content;
    } else {
      var geminiRole = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role: geminiRole,
        parts: [{ text: msg.content }]
      });
    }
  }

  // If no user messages, convert system to user
  if (contents.length === 0 && systemInstruction) {
    contents.push({ role: 'user', parts: [{ text: systemInstruction }] });
    systemInstruction = '';
  }

  logger.info('[Google] Calling Gemini API: model=' + model);

  var body = {
    contents: contents,
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens
    }
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  var url = API_URL + '/models/' + model + ':generateContent?key=' + API_KEY;

  var response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    var errorDetail = '';
    try {
      var errorBody = await response.text();
      errorDetail = ' - ' + errorBody.slice(0, 500);
    } catch (_) {}
    throw new Error('Google Gemini API returned ' + response.status + errorDetail);
  }

  var data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Google Gemini API returned unexpected response format');
  }

  var text = '';
  var parts = data.candidates[0].content.parts;
  for (var j = 0; j < parts.length; j++) {
    if (parts[j].text) {
      text += parts[j].text;
    }
  }
  text = text.trim();

  var inputTokens = 0;
  var outputTokens = 0;
  if (data.usageMetadata) {
    inputTokens = data.usageMetadata.promptTokenCount || 0;
    outputTokens = data.usageMetadata.candidatesTokenCount || 0;
  }

  return {
    text: text,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model: model
  };
}

function listModels() {
  return SUPPORTED_MODELS;
}

module.exports = {
  name: 'google',
  isConfigured: isConfigured,
  chat: chat,
  listModels: listModels
};
