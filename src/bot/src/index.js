// PR-TOP Telegram Bot
// Entry point for the Telegram bot service

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { t } = require('./i18n');

const token = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BOT_API_KEY = process.env.BOT_API_KEY || 'dev-bot-api-key';

// Create axios instance for backend API calls
const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-bot-api-key': BOT_API_KEY
  },
  timeout: 10000
});

// Cache for user language preferences
const userLangCache = {};

// Get user language from cache or API
async function getUserLang(telegramId) {
  if (userLangCache[telegramId]) return userLangCache[telegramId];
  try {
    const response = await api.get(`/api/bot/user/${telegramId}`);
    const lang = response.data.user?.language || 'en';
    userLangCache[telegramId] = lang;
    return lang;
  } catch {
    return 'en';
  }
}

// Detect language from Telegram user's language_code
function detectLang(msg) {
  const code = msg.from?.language_code || 'en';
  if (code.startsWith('es')) return 'es';
  if (code.startsWith('ru')) return 'ru';
  return 'en';
}

if (!token || token === 'your-telegram-bot-token') {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set. Please configure it in .env');
  console.log('Bot is in MOCK mode - API endpoints still work for testing.');
  // Don't exit - allow the bot module to be imported for testing
} else {
  const bot = new TelegramBot(token, { polling: true });

  console.log('PR-TOP Telegram Bot starting...');

  // /start command - role selection
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      // Check if user already exists
      const existingUser = await checkExistingUser(telegramId);
      if (existingUser) {
        const lang = existingUser.language || 'en';
        userLangCache[telegramId] = lang;
        const welcomeBack = t(lang, 'welcomeBack');
        bot.sendMessage(chatId, welcomeBack(existingUser.role));
        return;
      }
    } catch (err) {
      // User not found - continue with role selection
    }

    // For new users, detect language from Telegram settings
    const lang = detectLang(msg);
    const msgs = {
      chooseRole: t(lang, 'chooseRole'),
      roleTherapist: t(lang, 'roleTherapist'),
      roleClient: t(lang, 'roleClient')
    };

    bot.sendMessage(chatId, msgs.chooseRole, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: msgs.roleTherapist, callback_data: 'role_therapist' },
            { text: msgs.roleClient, callback_data: 'role_client' }
          ]
        ]
      }
    });
  });

  // /connect command - client enters invite code to connect with therapist
  bot.onText(/\/connect\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const inviteCode = match[1].trim();
    const lang = await getUserLang(telegramId);

    try {
      // Step 1: Look up therapist by invite code
      const connectResult = await api.post('/api/bot/connect', {
        telegram_id: String(telegramId),
        invite_code: inviteCode
      });

      const { therapist } = connectResult.data;
      const foundTherapist = t(lang, 'foundTherapist');

      // Step 2: Show consent prompt
      bot.sendMessage(chatId,
        foundTherapist(therapist.display_name),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: t(lang, 'consentYes'), callback_data: `consent_yes_${therapist.id}` },
                { text: t(lang, 'consentNo'), callback_data: `consent_no_${therapist.id}` }
              ]
            ]
          }
        }
      );
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'failedInviteCode');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  });

  // /connect without code - show usage
  bot.onText(/^\/connect$/, async (msg) => {
    const lang = await getUserLang(msg.from.id);
    bot.sendMessage(msg.chat.id,
      t(lang, 'connectUsage'),
      { parse_mode: 'Markdown' }
    );
  });

  // Handle callback queries (role selection + consent)
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const telegramId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Handle consent callbacks
    if (data.startsWith('consent_yes_') || data.startsWith('consent_no_')) {
      const consent = data.startsWith('consent_yes_');
      const therapistId = data.split('_').pop();
      const lang = await getUserLang(telegramId);

      try {
        const result = await api.post('/api/bot/consent', {
          telegram_id: String(telegramId),
          therapist_id: parseInt(therapistId),
          consent: consent
        });

        if (consent && result.data.linked) {
          bot.sendMessage(chatId, t(lang, 'connected'));
        } else {
          bot.sendMessage(chatId, t(lang, 'connectionCancelled'));
        }
      } catch (error) {
        const errorMsg = error.response?.data?.error || t(lang, 'failedConsent');
        bot.sendMessage(chatId, `❌ ${errorMsg}`);
      }

      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Handle role selection callbacks
    if (data === 'role_therapist' || data === 'role_client') {
      const role = data === 'role_therapist' ? 'therapist' : 'client';
      // Detect language from Telegram user for new registrations
      const lang = detectLang(callbackQuery);

      try {
        const result = await registerUser(telegramId, role, lang);
        userLangCache[telegramId] = lang;

        if (result.already_existed) {
          const alreadyRegistered = t(lang, 'alreadyRegistered');
          bot.sendMessage(chatId, alreadyRegistered(result.user.role));
        } else if (role === 'therapist') {
          const welcomeTherapist = t(lang, 'welcomeTherapist');
          bot.sendMessage(chatId,
            welcomeTherapist(result.user.invite_code),
            { parse_mode: 'Markdown' }
          );
        } else {
          bot.sendMessage(chatId, t(lang, 'welcomeClient'));
        }
      } catch (error) {
        console.error('Registration error:', error.message);
        bot.sendMessage(chatId, t(lang, 'registrationError'));
      }

      bot.answerCallbackQuery(callbackQuery.id);
    }
  });

  // Handle voice messages - save as diary entries
  bot.on('voice', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    try {
      // Get file info from Telegram
      const fileId = msg.voice.file_id;
      const duration = msg.voice.duration;

      // Submit voice diary entry via backend API
      const result = await api.post('/api/bot/diary', {
        telegram_id: String(telegramId),
        entry_type: 'voice',
        content: `[Voice message, duration: ${duration}s]`,
        file_ref: fileId
      });

      bot.sendMessage(chatId, t(lang, 'voiceSaved'));
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'failedVoiceDiary');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  });

  // Handle text messages as diary entries (non-command messages)
  bot.on('message', async (msg) => {
    // Skip commands and non-text messages
    if (!msg.text || msg.text.startsWith('/') || msg.voice || msg.video) return;

    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    try {
      await api.post('/api/bot/diary', {
        telegram_id: String(telegramId),
        entry_type: 'text',
        content: msg.text
      });

      bot.sendMessage(chatId, t(lang, 'diarySaved'));
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'failedDiary');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  });

  console.log('PR-TOP Telegram Bot is running.');
}

// Helper functions for API communication

async function registerUser(telegramId, role, language) {
  try {
    const response = await api.post('/api/bot/register', {
      telegram_id: String(telegramId),
      role: role,
      language: language || 'en'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to register user via API:', error.message);
    throw error;
  }
}

async function checkExistingUser(telegramId) {
  try {
    const response = await api.get(`/api/bot/user/${telegramId}`);
    return response.data.user;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
}

// Export for testing
module.exports = { registerUser, checkExistingUser, api };
