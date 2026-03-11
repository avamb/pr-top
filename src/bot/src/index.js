// PsyLink Telegram Bot
// Entry point for the Telegram bot service

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token || token === 'your-telegram-bot-token') {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set. Please configure it in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('PsyLink Telegram Bot starting...');

// /start command - role selection
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to PsyLink! Please choose your role:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'I am a Therapist', callback_data: 'role_therapist' },
          { text: 'I am a Client', callback_data: 'role_client' }
        ]
      ]
    }
  });
});

// Handle role selection callback
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'role_therapist') {
    bot.sendMessage(chatId, 'Welcome, Therapist! Your workspace is being set up...');
    // TODO: Create therapist record, generate invite code
  } else if (data === 'role_client') {
    bot.sendMessage(chatId, 'Welcome! Please enter your therapist\'s invite code to get started:');
    // TODO: Set up client onboarding flow
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

console.log('PsyLink Telegram Bot is running.');
