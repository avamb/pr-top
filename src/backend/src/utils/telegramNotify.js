// Telegram notification utility for outbound messages
// Sends real Telegram messages when BOT_TOKEN is available,
// falls back to logging in development mode.
// Failures are non-fatal — they never break the calling flow.

// logger.js exports `{ logger, getSystemLogs }`, so destructure it.
// Without the destructure, calls like `logger.info(...)` throw
// "logger.info is not a function" which silently breaks the dev-mode
// notify path used by T-05 accept/return pushes.
const { logger } = require('./logger');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * Check if real Telegram notifications are available
 */
function isEnabled() {
  return !!(TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'your-telegram-bot-token');
}

/**
 * Strip the Markdown (v1) markers this module's templates add, for the
 * plain-text retry. Only '*' and backticks are removed; '_' is kept because
 * it commonly appears in user text (usernames) and is not used by templates.
 */
function stripMarkdown(text) {
  return String(text).replace(/[*`]/g, '');
}

/**
 * POST one sendMessage call to the Bot API.
 * @returns {Promise<{ok: boolean, status: number, result: object}>}
 */
async function postSendMessage(body) {
  const url = `${TELEGRAM_API_BASE}${TELEGRAM_BOT_TOKEN}/sendMessage`;
  // Global fetch (Node 18+)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000) // 10s timeout
  });
  let result = {};
  try { result = await response.json(); } catch (_) { result = {}; }
  return { ok: !!(result && result.ok), status: response.status, result: result || {} };
}

/**
 * Send a Telegram message to a chat/user
 *
 * Messages default to parse_mode 'Markdown'. Interpolated user text (SOS
 * message, names, titles) can contain unbalanced '*' / '_' so Telegram answers
 * 400 "can't parse entities"; on a 400 the message is retried once WITHOUT
 * parse_mode, using options.plainText when given, otherwise the text with the
 * Markdown markers stripped. Other options (reply_markup, ...) are kept.
 *
 * @param {string|number} chatId - Telegram chat ID or user ID
 * @param {string} text - Message text (supports Markdown)
 * @param {object} [options] - Additional Bot API options (parse_mode,
 *   reply_markup, ...). Module-only: plainText (fallback text for the
 *   plain-text retry; never sent to Telegram).
 * @returns {Promise<{sent: boolean, messageId?: number, message_id?: number, plainTextFallback?: boolean, error?: string}>}
 */
async function sendMessage(chatId, text, options = {}) {
  if (!chatId) {
    logger.warn('telegramNotify.sendMessage: No chatId provided, skipping');
    return { sent: false, error: 'No chatId provided' };
  }

  if (!isEnabled()) {
    // Dev mode - log the message that would be sent
    logger.info(`[TELEGRAM NOTIFY] Would send to ${chatId}: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    return { sent: false, error: 'Telegram bot token not configured' };
  }

  const { plainText, ...apiOptions } = options || {};

  try {
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: apiOptions.parse_mode || 'Markdown',
      ...apiOptions
    };
    if (!body.parse_mode) delete body.parse_mode;

    let attempt = await postSendMessage(body);
    let plainTextFallback = false;

    // Markdown rejected (typically "can't parse entities") -> one plain retry
    const badRequest = attempt.status === 400 || attempt.result.error_code === 400;
    if (!attempt.ok && badRequest && body.parse_mode) {
      logger.warn(`[TELEGRAM NOTIFY] Telegram rejected message to ${chatId} (${attempt.result.description || 'HTTP 400'}); retrying once as plain text`);
      const plainBody = { ...body, text: typeof plainText === 'string' ? plainText : stripMarkdown(text) };
      delete plainBody.parse_mode;
      attempt = await postSendMessage(plainBody);
      plainTextFallback = true;
    }

    const result = attempt.result;

    if (attempt.ok) {
      const messageId = result.result && result.result.message_id;
      logger.info(`[TELEGRAM NOTIFY] Sent message to ${chatId} successfully (message_id: ${messageId}${plainTextFallback ? ', plain-text fallback' : ''})`);
      const out = { sent: true, messageId: messageId, message_id: messageId };
      if (plainTextFallback) out.plainTextFallback = true;
      return out;
    } else {
      logger.warn(`[TELEGRAM NOTIFY] Failed to send to ${chatId}: ${result.description || 'Unknown error'}`);
      return { sent: false, error: result.description || 'Telegram API error' };
    }
  } catch (error) {
    logger.error(`[TELEGRAM NOTIFY] Error sending to ${chatId}: ${error.message}`);
    return { sent: false, error: error.message };
  }
}

/**
 * Send SOS alert notification to therapist
 * @param {string} therapistTelegramId - Therapist's Telegram ID
 * @param {string} clientIdentifier - Client identifier for display
 * @param {string} [sosMessage] - Optional SOS message excerpt
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendSosAlert(therapistTelegramId, clientIdentifier, sosMessage) {
  let text = `🚨 *SOS ALERT*\n\nYour client ${clientIdentifier} has triggered an emergency alert.`;
  if (sosMessage) {
    text += `\n\nMessage: ${sosMessage}`;
  }
  text += '\n\nPlease check on them immediately.';

  // Plain-text twin for the 400 retry: keeps the client's message verbatim.
  let plainText = `🚨 SOS ALERT\n\nYour client ${clientIdentifier} has triggered an emergency alert.`;
  if (sosMessage) {
    plainText += `\n\nMessage: ${sosMessage}`;
  }
  plainText += '\n\nPlease check on them immediately.';

  return sendMessage(therapistTelegramId, text, { plainText });
}

/**
 * Send exercise assignment notification to client
 * @param {string} clientTelegramId - Client's Telegram ID
 * @param {string} exerciseTitle - Title of the assigned exercise
 * @param {string} [lang] - Language code (en/ru/es)
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendExerciseNotification(clientTelegramId, exerciseTitle, lang) {
  // Build with a marker function so the plain-text retry keeps the title as-is.
  const build = (b) => {
    if (lang === 'ru') {
      return `📋 ${b('Новое упражнение')}\n\nВаш терапевт назначил вам упражнение: ${b(exerciseTitle)}\n\nИспользуйте /exercises чтобы просмотреть и начать его.`;
    } else if (lang === 'es') {
      return `📋 ${b('Nuevo ejercicio')}\n\nTu terapeuta te ha asignado un ejercicio: ${b(exerciseTitle)}\n\nUsa /exercises para verlo y comenzar.`;
    }
    return `📋 ${b('New Exercise')}\n\nYour therapist has assigned you an exercise: ${b(exerciseTitle)}\n\nUse /exercises to view and start it.`;
  };
  const text = build((s) => `*${s}*`);
  const plainText = build((s) => s);

  return sendMessage(clientTelegramId, text, { plainText });
}

module.exports = {
  isEnabled,
  sendMessage,
  sendSosAlert,
  sendExerciseNotification
};
