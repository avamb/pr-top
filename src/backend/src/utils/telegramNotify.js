// Telegram notification utility for outbound messages
// Sends real Telegram messages when BOT_TOKEN is available,
// falls back to logging in development mode.
// Failures are non-fatal — they never break the calling flow.

const logger = require('./logger');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * Check if real Telegram notifications are available
 */
function isEnabled() {
  return !!(TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'your-telegram-bot-token');
}

/**
 * Send a Telegram message to a chat/user
 * @param {string|number} chatId - Telegram chat ID or user ID
 * @param {string} text - Message text (supports Markdown)
 * @param {object} [options] - Additional options (parse_mode, etc.)
 * @returns {Promise<{sent: boolean, error?: string}>}
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

  try {
    const url = `${TELEGRAM_API_BASE}${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: options.parse_mode || 'Markdown',
      ...options
    };

    // Use dynamic import for fetch (Node 18+)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    const result = await response.json();

    if (result.ok) {
      logger.info(`[TELEGRAM NOTIFY] Sent message to ${chatId} successfully (message_id: ${result.result?.message_id})`);
      return { sent: true };
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

  return sendMessage(therapistTelegramId, text);
}

/**
 * Send exercise assignment notification to client
 * @param {string} clientTelegramId - Client's Telegram ID
 * @param {string} exerciseTitle - Title of the assigned exercise
 * @param {string} [lang] - Language code (en/ru/es)
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendExerciseNotification(clientTelegramId, exerciseTitle, lang) {
  let text;
  if (lang === 'ru') {
    text = `📋 *Новое упражнение*\n\nВаш терапевт назначил вам упражнение: *${exerciseTitle}*\n\nИспользуйте /exercises чтобы просмотреть и начать его.`;
  } else if (lang === 'es') {
    text = `📋 *Nuevo ejercicio*\n\nTu terapeuta te ha asignado un ejercicio: *${exerciseTitle}*\n\nUsa /exercises para verlo y comenzar.`;
  } else {
    text = `📋 *New Exercise*\n\nYour therapist has assigned you an exercise: *${exerciseTitle}*\n\nUse /exercises to view and start it.`;
  }

  return sendMessage(clientTelegramId, text);
}

module.exports = {
  isEnabled,
  sendMessage,
  sendSosAlert,
  sendExerciseNotification
};
