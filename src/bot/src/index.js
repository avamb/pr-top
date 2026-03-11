// PsyLink Telegram Bot
// Entry point for the Telegram bot service

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

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

if (!token || token === 'your-telegram-bot-token') {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set. Please configure it in .env');
  console.log('Bot is in MOCK mode - API endpoints still work for testing.');
  // Don't exit - allow the bot module to be imported for testing
} else {
  const bot = new TelegramBot(token, { polling: true });

  console.log('PsyLink Telegram Bot starting...');

  // /start command - role selection
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      // Check if user already exists
      const existingUser = await checkExistingUser(telegramId);
      if (existingUser) {
        const roleLabel = existingUser.role === 'therapist' ? 'Therapist' : 'Client';
        bot.sendMessage(chatId,
          `Welcome back! You are registered as a ${roleLabel}.\n\nUse /help to see available commands.`
        );
        return;
      }
    } catch (err) {
      // User not found - continue with role selection
    }

    bot.sendMessage(chatId, 'Welcome to PsyLink! Please choose your role:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🧑‍⚕️ I am a Therapist', callback_data: 'role_therapist' },
            { text: '🙋 I am a Client', callback_data: 'role_client' }
          ]
        ]
      }
    });
  });

  // Handle role selection callback
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const telegramId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'role_therapist' || data === 'role_client') {
      const role = data === 'role_therapist' ? 'therapist' : 'client';

      try {
        const result = await registerUser(telegramId, role);

        if (result.already_existed) {
          bot.sendMessage(chatId,
            `You are already registered as a ${result.user.role}. Use /help to see available commands.`
          );
        } else if (role === 'therapist') {
          bot.sendMessage(chatId,
            `✅ Welcome, Therapist! Your workspace has been set up.\n\n` +
            `Your invite code: *${result.user.invite_code}*\n` +
            `Share this code with your clients so they can connect with you.\n\n` +
            `Use /help to see available commands.`,
            { parse_mode: 'Markdown' }
          );
        } else {
          bot.sendMessage(chatId,
            `✅ Welcome! You've been registered as a client.\n\n` +
            `Please enter your therapist's invite code to get started:\n` +
            `Use /connect <code> to link with your therapist.`
          );
        }
      } catch (error) {
        console.error('Registration error:', error.message);
        bot.sendMessage(chatId,
          '❌ Sorry, there was an error during registration. Please try again with /start.'
        );
      }

      bot.answerCallbackQuery(callbackQuery.id);
    }
  });

  console.log('PsyLink Telegram Bot is running.');
}

// Helper functions for API communication

async function registerUser(telegramId, role) {
  try {
    const response = await api.post('/api/bot/register', {
      telegram_id: String(telegramId),
      role: role
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
