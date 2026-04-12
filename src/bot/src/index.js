// PR-TOP Telegram Bot
// Entry point for the Telegram bot service

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { t } = require('./i18n');
const { getClientKeyboard, getTherapistKeyboard, getKeyboardForRole, BUTTON_ACTION_MAP } = require('./keyboards');

const token = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://pr-top.com';
const BOT_API_KEY = process.env.BOT_API_KEY || 'dev-bot-api-key';

// Create axios instance for backend API calls
const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-bot-api-key': BOT_API_KEY
  },
  timeout: 30000, // Increased for voice/video file uploads
  maxContentLength: 50 * 1024 * 1024, // 50MB for base64-encoded files
  maxBodyLength: 50 * 1024 * 1024
});

// Cache for user language preferences
const userLangCache = {};

// Track active exercise sessions (telegramId -> deliveryId)
const activeExercises = {};

// Track active profile edit sessions (telegramId -> 'name' | 'phone')
const activeProfileEdits = {};

// Track pending phone sharing requests after therapist registration (telegramId -> lang)
const pendingPhoneShares = {};

// Track pending email input after phone step (telegramId -> lang)
const pendingEmailInputs = {};

// Track pending other_info input after email step (telegramId -> lang)
const pendingOtherInfoInputs = {};

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
  if (code.startsWith('uk')) return 'uk';
  if (code.startsWith('es')) return 'es';
  if (code.startsWith('ru')) return 'ru';
  return 'en';
}

// Auto-detect timezone from Telegram language_code (best-effort heuristic)
// Since Telegram API doesn't provide timezone directly, we map language codes to likely timezones
const LANGUAGE_TIMEZONE_MAP = {
  'ru': 'Europe/Moscow',
  'uk': 'Europe/Kyiv',
  'es': 'Europe/Madrid',
  'en': 'UTC',
  'de': 'Europe/Berlin',
  'fr': 'Europe/Paris',
  'it': 'Europe/Rome',
  'pt': 'America/Sao_Paulo',
  'pt-br': 'America/Sao_Paulo',
  'ja': 'Asia/Tokyo',
  'ko': 'Asia/Seoul',
  'zh': 'Asia/Shanghai',
  'zh-hans': 'Asia/Shanghai',
  'zh-hant': 'Asia/Taipei',
  'ar': 'Asia/Riyadh',
  'hi': 'Asia/Kolkata',
  'tr': 'Europe/Istanbul',
  'pl': 'Europe/Warsaw',
  'nl': 'Europe/Amsterdam',
  'sv': 'Europe/Stockholm',
  'da': 'Europe/Copenhagen',
  'fi': 'Europe/Helsinki',
  'no': 'Europe/Oslo',
  'nb': 'Europe/Oslo',
  'cs': 'Europe/Prague',
  'sk': 'Europe/Bratislava',
  'ro': 'Europe/Bucharest',
  'hu': 'Europe/Budapest',
  'bg': 'Europe/Sofia',
  'hr': 'Europe/Zagreb',
  'sr': 'Europe/Belgrade',
  'he': 'Asia/Jerusalem',
  'th': 'Asia/Bangkok',
  'vi': 'Asia/Ho_Chi_Minh',
  'id': 'Asia/Jakarta',
  'ms': 'Asia/Kuala_Lumpur',
  'ka': 'Asia/Tbilisi',
  'az': 'Asia/Baku',
  'uz': 'Asia/Tashkent',
  'kk': 'Asia/Almaty',
  'be': 'Europe/Minsk',
  'et': 'Europe/Tallinn',
  'lv': 'Europe/Riga',
  'lt': 'Europe/Vilnius',
};

function detectTimezone(msg) {
  const code = (msg.from?.language_code || 'en').toLowerCase();
  // Try exact match first, then prefix match
  if (LANGUAGE_TIMEZONE_MAP[code]) return LANGUAGE_TIMEZONE_MAP[code];
  const prefix = code.split('-')[0];
  if (LANGUAGE_TIMEZONE_MAP[prefix]) return LANGUAGE_TIMEZONE_MAP[prefix];
  return 'UTC';
}

if (!token || token === 'your-telegram-bot-token') {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set. Please configure it in .env');
  console.log('Bot is in MOCK mode - API endpoints still work for testing.');
  // Don't exit - allow the bot module to be imported for testing
} else {
  const bot = new TelegramBot(token, { polling: true });

  console.log('PR-TOP Telegram Bot starting...');

  // Set BotFather About and Description via Telegram API on startup
  async function setBotDescriptions() {
    const languages = ['en', 'ru', 'es', 'uk'];

    for (const lang of languages) {
      try {
        const about = t(lang, 'botAbout');
        const description = t(lang, 'botDescription');

        // setMyShortDescription = About (shown in profile, 120 chars)
        await bot.setMyShortDescription({ short_description: about, language_code: lang });
        // setMyDescription = Description (shown before /start)
        await bot.setMyDescription({ description: description, language_code: lang });

        console.log(`BotFather descriptions set for language: ${lang}`);
      } catch (err) {
        console.warn(`Failed to set BotFather descriptions for ${lang}:`, err.message);
      }
    }
  }

  // Set bot menu commands (≡ button) with scoped commands
  async function setBotMenuCommands() {
    try {
      // Client commands (default for all private chats)
      await bot.setMyCommands([
        { command: 'exercises', description: 'My exercises' },
        { command: 'history', description: 'Diary history' },
        { command: 'sos', description: 'Emergency contact' },
        { command: 'profile', description: 'My profile' },
        { command: 'timezone', description: 'View or change timezone' },
        { command: 'help', description: 'Help' },
        { command: 'disconnect', description: 'Disconnect from therapist' }
      ], { scope: { type: 'all_private_chats' } });
      console.log('Bot menu commands set for all_private_chats');
    } catch (err) {
      console.warn('Failed to set bot menu commands:', err.message);
    }
  }

  // Run on startup (non-blocking)
  setBotDescriptions().catch(err => console.warn('BotFather setup failed:', err.message));
  setBotMenuCommands().catch(err => console.warn('Bot menu commands setup failed:', err.message));

  // === Extracted handler functions (shared by slash commands and keyboard buttons) ===

  async function handleHelp(chatId, telegramId, lang) {
    try {
      const user = await checkExistingUser(telegramId);
      if (!user) {
        bot.sendMessage(chatId, t(lang, 'helpUnregistered'), { parse_mode: 'Markdown' });
        return;
      }
      if (user.role === 'therapist') {
        bot.sendMessage(chatId, t(lang, 'helpTherapist'), { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, t(lang, 'helpClient'), { parse_mode: 'Markdown' });
      }
    } catch (error) {
      bot.sendMessage(chatId, t(lang, 'helpClient'), { parse_mode: 'Markdown' });
    }
  }

  async function handleProfile(chatId, telegramId, lang) {
    try {
      const user = await checkExistingUser(telegramId);
      if (!user) {
        bot.sendMessage(chatId, t(lang, 'helpUnregistered'), { parse_mode: 'Markdown' });
        return;
      }
      const profileText = t(lang, 'profileView');
      bot.sendMessage(chatId, profileText(user.first_name || '', user.last_name || '', user.phone || '', user.telegram_username || ''), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: t(lang, 'profileEditName'), callback_data: 'profile_edit_name' }],
            [{ text: t(lang, 'profileEditPhone'), callback_data: 'profile_edit_phone' }]
          ]
        }
      });
    } catch (error) {
      bot.sendMessage(chatId, `❌ ${t(lang, 'profileFailed')}`);
    }
  }

  async function handleSos(chatId, telegramId, lang, sosMessage) {
    try {
      await api.post('/api/bot/sos', {
        telegram_id: String(telegramId),
        message: sosMessage || undefined
      });
      bot.sendMessage(chatId, t(lang, 'sosConfirmed'));
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'sosFailed');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  }

  async function handleHistory(chatId, telegramId, lang) {
    try {
      const result = await api.get(`/api/bot/diary/${telegramId}?limit=10`);
      const entries = result.data.entries;

      if (!entries || entries.length === 0) {
        bot.sendMessage(chatId, t(lang, 'historyEmpty'));
        return;
      }

      // Fetch user timezone for date formatting
      let userTimezone = 'UTC';
      try {
        const userInfo = await checkExistingUser(telegramId);
        if (userInfo && userInfo.timezone) {
          userTimezone = userInfo.timezone;
        }
      } catch { /* fallback to UTC */ }

      const locale = lang === 'ru' ? 'ru-RU' : lang === 'es' ? 'es-ES' : lang === 'uk' ? 'uk-UA' : 'en-US';

      let text = t(lang, 'historyHeader') + '\n\n';
      entries.forEach((entry, i) => {
        // Treat created_at as UTC: append 'Z' if not already present
        const createdAt = entry.created_at && !entry.created_at.endsWith('Z') ? entry.created_at + 'Z' : entry.created_at;
        const date = new Date(createdAt).toLocaleDateString(locale, {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          timeZone: userTimezone
        });
        const typeIcon = entry.entry_type === 'voice' ? '🎤' : entry.entry_type === 'video' ? '🎥' : '📝';
        let preview;
        if ((entry.entry_type === 'voice' || entry.entry_type === 'video') && entry.transcript) {
          const transcriptPreview = entry.transcript.substring(0, 100) + (entry.transcript.length > 100 ? '...' : '');
          preview = transcriptPreview;
        } else if ((entry.entry_type === 'voice' || entry.entry_type === 'video') && entry.transcription_status === 'pending') {
          preview = t(lang, 'transcribing');
        } else {
          preview = entry.content ? entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '') : '[no content]';
        }
        text += `${i + 1}. ${typeIcon} ${date}\n${preview}\n\n`;
      });

      bot.sendMessage(chatId, text);
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'historyFailed');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  }

  async function handleExercises(chatId, telegramId, lang) {
    try {
      const result = await api.get(`/api/bot/exercises/${telegramId}`);
      const exercises = result.data.exercises;

      if (!exercises || exercises.length === 0) {
        bot.sendMessage(chatId, t(lang, 'exercisesEmpty'));
        return;
      }

      let text = t(lang, 'exercisesHeader') + '\n';
      const inlineButtons = [];

      exercises.forEach((ex, i) => {
        const title = lang === 'ru' ? (ex.title_ru || ex.title_en || 'Exercise') :
                      lang === 'es' ? (ex.title_es || ex.title_en || 'Exercise') :
                      (ex.title_en || 'Exercise');

        let statusLabel;
        if (ex.status === 'completed') {
          statusLabel = t(lang, 'exerciseStatusCompleted');
        } else if (ex.status === 'acknowledged') {
          statusLabel = t(lang, 'exerciseStatusAcknowledged');
        } else {
          statusLabel = t(lang, 'exerciseStatusSent');
        }

        text += `${i + 1}. ${statusLabel} *${title}*\n`;

        if (ex.status !== 'completed') {
          inlineButtons.push([{
            text: `${i + 1}. ${title}`,
            callback_data: `exercise_view_${ex.delivery_id}`
          }]);
        }
      });

      const opts = { parse_mode: 'Markdown' };
      if (inlineButtons.length > 0) {
        opts.reply_markup = { inline_keyboard: inlineButtons };
      }

      bot.sendMessage(chatId, text, opts);
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'exercisesFailed');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  }

  // /start command - role selection or deep link connect
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const deepLinkCode = match[1] ? match[1].trim() : null;

    // Deep link: /start CODE — treat as invite code connect flow
    if (deepLinkCode) {
      const lang = await getUserLang(telegramId).catch(() => detectLang(msg));

      try {
        // Check if user exists; if not, auto-register as client first
        let existingUser = null;
        try {
          existingUser = await checkExistingUser(telegramId);
        } catch {
          // Not registered — auto-register as client
        }

        let isNewRegistration = false;
        let detectedTz = 'UTC';
        if (!existingUser) {
          try {
            detectedTz = detectTimezone(msg);
            console.log(`[Timezone] Auto-detected timezone for deep-link client telegram_id=${telegramId}: ${detectedTz} (language_code=${msg.from?.language_code || 'unknown'})`);
            await api.post('/api/bot/register', {
              telegram_id: String(telegramId),
              role: 'client',
              language: detectLang(msg),
              first_name: msg.from.first_name || '',
              last_name: msg.from.last_name || '',
              username: msg.from.username || '',
              timezone: detectedTz
            });
            userLangCache[telegramId] = detectLang(msg);
            isNewRegistration = true;
          } catch (regErr) {
            // Registration may fail if already exists — continue anyway
          }
        }

        // Now attempt connect with the invite code
        const connectResult = await api.post('/api/bot/connect', {
          telegram_id: String(telegramId),
          invite_code: deepLinkCode
        });

        const { therapist } = connectResult.data;
        const foundTherapist = t(lang, 'foundTherapist');

        // Send deep link welcome (no "enter code" — client came via link)
        await bot.sendMessage(chatId, t(lang, 'deepLinkClientWelcome'));

        // Show consent prompt (same as /connect flow)
        await bot.sendMessage(chatId,
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

        // Show timezone confirmation for newly registered clients
        if (isNewRegistration) {
          sendTimezoneConfirmation(chatId, lang, detectedTz);
        }
      } catch (error) {
        const errorMsg = error.response?.data?.error || t(lang, 'deepLinkInvalidCode');
        bot.sendMessage(chatId, `❌ ${errorMsg}\n\n${t(lang, 'deepLinkFallbackHint')}`);
      }
      return;
    }

    // Normal /start without deep link code
    try {
      // Check if user already exists
      const existingUser = await checkExistingUser(telegramId);
      if (existingUser) {
        const lang = existingUser.language || 'en';
        userLangCache[telegramId] = lang;
        const welcomeBack = t(lang, 'welcomeBack');
        bot.sendMessage(chatId, welcomeBack(existingUser.role), {
          reply_markup: getKeyboardForRole(existingUser.role, lang)
        });
        return;
      }
    } catch (err) {
      // User not found - continue with role selection
    }

    // For new users, detect language from Telegram settings
    const lang = detectLang(msg);
    const msgs = {
      chooseRoleIntro: t(lang, 'chooseRoleIntro'),
      roleTherapist: t(lang, 'roleTherapist'),
      roleClient: t(lang, 'roleClient')
    };

    bot.sendMessage(chatId, msgs.chooseRoleIntro, {
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

  // /profile command - view/edit client profile
  bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleProfile(chatId, telegramId, lang);
  });

  // /help command - role-aware command list
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleHelp(chatId, telegramId, lang);
  });

  // /sos command - client emergency alert
  bot.onText(/\/sos(?:\s+(.*))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    const sosMessage = match[1] ? match[1].trim() : '';
    await handleSos(chatId, telegramId, lang, sosMessage);
  });

  // /history command - show recent diary entries
  bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleHistory(chatId, telegramId, lang);
  });

  // /exercises command - client views assigned exercises
  bot.onText(/\/exercises/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleExercises(chatId, telegramId, lang);
  });

  // /timezone command - view and change timezone
  bot.onText(/\/timezone/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleTimezone(chatId, telegramId, lang);
  });

  async function handleTimezone(chatId, telegramId, lang) {
    try {
      const user = await checkExistingUser(telegramId);
      if (!user) {
        bot.sendMessage(chatId, t(lang, 'helpUnregistered'), { parse_mode: 'Markdown' });
        return;
      }
      const currentTz = user.timezone || 'UTC';
      const now = new Date();
      let localTime;
      try {
        localTime = now.toLocaleString('en-GB', { timeZone: currentTz, hour: '2-digit', minute: '2-digit', hour12: false });
      } catch {
        localTime = now.toUTCString().slice(17, 22);
      }
      const timezoneMsg = t(lang, 'timezoneCurrentAndChoose');
      bot.sendMessage(chatId, timezoneMsg(currentTz, localTime), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌍 ' + t(lang, 'tzRegionEurope'), callback_data: 'tz_region_europe' }],
            [{ text: '🌏 ' + t(lang, 'tzRegionAsia'), callback_data: 'tz_region_asia' }],
            [{ text: '🌎 ' + t(lang, 'tzRegionAmerica'), callback_data: 'tz_region_america' }],
            [{ text: '🌍 ' + t(lang, 'tzRegionAfrica'), callback_data: 'tz_region_africa' }],
            [{ text: '🌏 ' + t(lang, 'tzRegionPacific'), callback_data: 'tz_region_pacific' }],
            [{ text: '🕐 UTC', callback_data: 'tz_set_UTC' }]
          ]
        }
      });
    } catch (error) {
      console.error('Timezone command error:', error.message);
      bot.sendMessage(chatId, '❌ ' + t(lang, 'timezoneFailed'));
    }
  }

  // /settings command - therapist settings (voice forwarding, etc.)
  bot.onText(/\/settings/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleBotSettings(chatId, telegramId, lang);
  });

  async function handleBotSettings(chatId, telegramId, lang, editMessageId) {
    try {
      const user = await checkExistingUser(telegramId);
      if (!user || (user.role !== 'therapist' && user.role !== 'superadmin')) {
        bot.sendMessage(chatId, t(lang, 'settingsTherapistOnly'));
        return;
      }

      const prefs = user.escalation_preferences || {};
      const forwardEnabled = !!prefs.forward_voice_to_telegram;

      const statusEmoji = forwardEnabled ? '✅' : '❌';
      const settingsText = `⚙️ *${t(lang, 'settingsTitle')}*\n\n` +
        `🎤 ${t(lang, 'settingsForwardVoice')}: ${statusEmoji}\n\n` +
        `${t(lang, 'settingsForwardVoiceDesc')}`;

      const keyboard = {
        inline_keyboard: [
          [{
            text: forwardEnabled ?
              `🔴 ${t(lang, 'settingsDisableForward')}` :
              `🟢 ${t(lang, 'settingsEnableForward')}`,
            callback_data: forwardEnabled ? 'settings_fwd_off' : 'settings_fwd_on'
          }]
        ]
      };

      if (editMessageId) {
        // Edit existing message
        bot.editMessageText(settingsText, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }).catch(() => {});
      } else {
        bot.sendMessage(chatId, settingsText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } catch (error) {
      console.error('Settings command error:', error.message);
      bot.sendMessage(chatId, '❌ Failed to load settings');
    }
  }

  // Send timezone confirmation after client registration (shown once)
  function sendTimezoneConfirmation(chatId, lang, tz) {
    const tzMsg = t(lang, 'timezoneDetectedAfterReg');
    bot.sendMessage(chatId, tzMsg(tz), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: t(lang, 'tzChangeButton'), callback_data: 'tz_change_after_reg' }]
        ]
      }
    });
  }

  // Timezone region definitions
  const TIMEZONE_REGIONS = {
    europe: [
      { tz: 'Europe/London', label: '🇬🇧 London (GMT)' },
      { tz: 'Europe/Paris', label: '🇫🇷 Paris (CET)' },
      { tz: 'Europe/Berlin', label: '🇩🇪 Berlin (CET)' },
      { tz: 'Europe/Madrid', label: '🇪🇸 Madrid (CET)' },
      { tz: 'Europe/Rome', label: '🇮🇹 Rome (CET)' },
      { tz: 'Europe/Warsaw', label: '🇵🇱 Warsaw (CET)' },
      { tz: 'Europe/Kyiv', label: '🇺🇦 Kyiv (EET)' },
      { tz: 'Europe/Bucharest', label: '🇷🇴 Bucharest (EET)' },
      { tz: 'Europe/Istanbul', label: '🇹🇷 Istanbul (TRT)' },
      { tz: 'Europe/Moscow', label: '🇷🇺 Moscow (MSK)' },
      { tz: 'Europe/Minsk', label: '🇧🇾 Minsk (MSK)' },
    ],
    asia: [
      { tz: 'Asia/Jerusalem', label: '🇮🇱 Jerusalem (IST)' },
      { tz: 'Asia/Dubai', label: '🇦🇪 Dubai (GST)' },
      { tz: 'Asia/Tbilisi', label: '🇬🇪 Tbilisi (GET)' },
      { tz: 'Asia/Almaty', label: '🇰🇿 Almaty (ALMT)' },
      { tz: 'Asia/Tashkent', label: '🇺🇿 Tashkent (UZT)' },
      { tz: 'Asia/Kolkata', label: '🇮🇳 Kolkata (IST)' },
      { tz: 'Asia/Bangkok', label: '🇹🇭 Bangkok (ICT)' },
      { tz: 'Asia/Shanghai', label: '🇨🇳 Shanghai (CST)' },
      { tz: 'Asia/Tokyo', label: '🇯🇵 Tokyo (JST)' },
      { tz: 'Asia/Seoul', label: '🇰🇷 Seoul (KST)' },
    ],
    america: [
      { tz: 'America/New_York', label: '🇺🇸 New York (EST)' },
      { tz: 'America/Chicago', label: '🇺🇸 Chicago (CST)' },
      { tz: 'America/Denver', label: '🇺🇸 Denver (MST)' },
      { tz: 'America/Los_Angeles', label: '🇺🇸 Los Angeles (PST)' },
      { tz: 'America/Toronto', label: '🇨🇦 Toronto (EST)' },
      { tz: 'America/Mexico_City', label: '🇲🇽 Mexico City (CST)' },
      { tz: 'America/Sao_Paulo', label: '🇧🇷 São Paulo (BRT)' },
      { tz: 'America/Buenos_Aires', label: '🇦🇷 Buenos Aires (ART)' },
      { tz: 'America/Bogota', label: '🇨🇴 Bogotá (COT)' },
      { tz: 'America/Lima', label: '🇵🇪 Lima (PET)' },
    ],
    africa: [
      { tz: 'Africa/Cairo', label: '🇪🇬 Cairo (EET)' },
      { tz: 'Africa/Lagos', label: '🇳🇬 Lagos (WAT)' },
      { tz: 'Africa/Nairobi', label: '🇰🇪 Nairobi (EAT)' },
      { tz: 'Africa/Johannesburg', label: '🇿🇦 Johannesburg (SAST)' },
      { tz: 'Africa/Casablanca', label: '🇲🇦 Casablanca (WET)' },
    ],
    pacific: [
      { tz: 'Pacific/Auckland', label: '🇳🇿 Auckland (NZST)' },
      { tz: 'Australia/Sydney', label: '🇦🇺 Sydney (AEST)' },
      { tz: 'Australia/Melbourne', label: '🇦🇺 Melbourne (AEST)' },
      { tz: 'Pacific/Honolulu', label: '🇺🇸 Honolulu (HST)' },
      { tz: 'Pacific/Fiji', label: '🇫🇯 Fiji (FJT)' },
    ],
  };

  // /disconnect command - client revokes therapist access
  bot.onText(/\/disconnect/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    // Show confirmation prompt
    bot.sendMessage(chatId, t(lang, 'disconnectConfirm'), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: t(lang, 'disconnectYes'), callback_data: 'disconnect_yes' },
            { text: t(lang, 'disconnectNo'), callback_data: 'disconnect_no' }
          ]
        ]
      }
    });
  });

  // Handle callback queries (role selection + consent + disconnect)
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const telegramId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Handle settings toggle callbacks
    if (data === 'settings_fwd_on' || data === 'settings_fwd_off') {
      const lang = await getUserLang(telegramId);
      const newValue = data === 'settings_fwd_on';
      try {
        await api.put(`/api/bot/settings/${telegramId}`, {
          key: 'forward_voice_to_telegram',
          value: newValue
        });
        // Refresh the settings message
        await handleBotSettings(chatId, telegramId, lang, callbackQuery.message.message_id);
        bot.answerCallbackQuery(callbackQuery.id, {
          text: newValue ? t(lang, 'settingsForwardEnabled') : t(lang, 'settingsForwardDisabled')
        });
      } catch (err) {
        console.error('Failed to update forward setting:', err.message);
        bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Failed to update' });
      }
      return;
    }

    // Handle "Change timezone" button shown after registration
    if (data === 'tz_change_after_reg') {
      const lang = await getUserLang(telegramId);
      await handleTimezone(chatId, telegramId, lang);
      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Handle timezone region selection callbacks
    if (data.startsWith('tz_region_')) {
      const region = data.replace('tz_region_', '');
      const lang = await getUserLang(telegramId);
      const timezones = TIMEZONE_REGIONS[region];
      if (timezones) {
        const buttons = timezones.map(tz => [{ text: tz.label, callback_data: `tz_set_${tz.tz}` }]);
        buttons.push([{ text: '⬅️ ' + t(lang, 'tzBack'), callback_data: 'tz_back' }]);
        bot.editMessageReplyMarkup({ inline_keyboard: buttons }, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id
        }).catch(() => {});
      }
      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Handle timezone back button
    if (data === 'tz_back') {
      const lang = await getUserLang(telegramId);
      const buttons = [
        [{ text: '🌍 ' + t(lang, 'tzRegionEurope'), callback_data: 'tz_region_europe' }],
        [{ text: '🌏 ' + t(lang, 'tzRegionAsia'), callback_data: 'tz_region_asia' }],
        [{ text: '🌎 ' + t(lang, 'tzRegionAmerica'), callback_data: 'tz_region_america' }],
        [{ text: '🌍 ' + t(lang, 'tzRegionAfrica'), callback_data: 'tz_region_africa' }],
        [{ text: '🌏 ' + t(lang, 'tzRegionPacific'), callback_data: 'tz_region_pacific' }],
        [{ text: '🕐 UTC', callback_data: 'tz_set_UTC' }]
      ];
      bot.editMessageReplyMarkup({ inline_keyboard: buttons }, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      }).catch(() => {});
      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Handle timezone selection callbacks
    if (data.startsWith('tz_set_')) {
      const selectedTz = data.replace('tz_set_', '');
      const lang = await getUserLang(telegramId);
      try {
        await api.put(`/api/bot/profile/${telegramId}`, { timezone: selectedTz });
        const now = new Date();
        let localTime;
        try {
          localTime = now.toLocaleString('en-GB', { timeZone: selectedTz, hour: '2-digit', minute: '2-digit', hour12: false });
        } catch {
          localTime = now.toUTCString().slice(17, 22);
        }
        const confirmMsg = t(lang, 'timezoneUpdated');
        bot.editMessageText(confirmMsg(selectedTz, localTime), {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        }).catch(() => {});
        console.log(`[Timezone] User telegram_id=${telegramId} changed timezone to ${selectedTz}`);
      } catch (error) {
        console.error('Timezone update error:', error.message);
        bot.sendMessage(chatId, '❌ ' + t(lang, 'timezoneFailed'));
      }
      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Handle disconnect callbacks
    if (data === 'disconnect_yes' || data === 'disconnect_no') {
      const lang = await getUserLang(telegramId);

      if (data === 'disconnect_no') {
        bot.sendMessage(chatId, t(lang, 'disconnectCancelled'));
      } else {
        try {
          await api.post('/api/bot/revoke-consent', {
            telegram_id: String(telegramId)
          });
          bot.sendMessage(chatId, t(lang, 'disconnected'));
        } catch (error) {
          const errorMsg = error.response?.data?.error || t(lang, 'disconnectFailed');
          bot.sendMessage(chatId, `❌ ${errorMsg}`);
        }
      }

      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Handle exercise view callbacks
    if (data.startsWith('exercise_view_')) {
      const deliveryId = data.replace('exercise_view_', '');
      const lang = await getUserLang(telegramId);

      try {
        // Fetch exercises to get detail for this delivery
        const result = await api.get(`/api/bot/exercises/${telegramId}`);
        const exercise = result.data.exercises.find(e => String(e.delivery_id) === deliveryId);

        if (!exercise || exercise.status === 'completed') {
          bot.sendMessage(chatId, t(lang, 'exerciseNotFound'));
          bot.answerCallbackQuery(callbackQuery.id);
          return;
        }

        const title = lang === 'ru' ? (exercise.title_ru || exercise.title_en || 'Exercise') :
                      lang === 'es' ? (exercise.title_es || exercise.title_en || 'Exercise') :
                      (exercise.title_en || 'Exercise');
        const instructions = lang === 'ru' ? (exercise.instructions_ru || exercise.instructions_en) :
                             (exercise.instructions_en || '');

        const detailMsg = t(lang, 'exerciseDetail');
        bot.sendMessage(chatId, detailMsg(title, exercise.category, instructions), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: t(lang, 'exerciseStartBtn'), callback_data: `exercise_start_${deliveryId}` }
            ]]
          }
        });
      } catch (error) {
        bot.sendMessage(chatId, `❌ ${t(lang, 'exercisesFailed')}`);
      }

      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Handle exercise start callbacks
    if (data.startsWith('exercise_start_')) {
      const deliveryId = data.replace('exercise_start_', '');
      const lang = await getUserLang(telegramId);

      try {
        await api.post(`/api/bot/exercises/${deliveryId}/acknowledge`, {
          telegram_id: String(telegramId)
        });

        // Track active exercise for this user so next text message is captured as response
        activeExercises[telegramId] = deliveryId;

        bot.sendMessage(chatId, t(lang, 'exerciseStarted'));
      } catch (error) {
        const errorMsg = error.response?.data?.error || t(lang, 'exerciseStartFailed');
        bot.sendMessage(chatId, `❌ ${errorMsg}`);
      }

      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Handle profile edit callbacks
    if (data === 'profile_edit_name') {
      const lang = await getUserLang(telegramId);
      activeProfileEdits[telegramId] = 'name';
      bot.sendMessage(chatId, t(lang, 'profileEnterName'), { parse_mode: 'Markdown' });
      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    if (data === 'profile_edit_phone') {
      const lang = await getUserLang(telegramId);
      activeProfileEdits[telegramId] = 'phone';
      bot.sendMessage(chatId, t(lang, 'profileEnterPhone'), { parse_mode: 'Markdown' });
      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

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
          bot.sendMessage(chatId, t(lang, 'connected'), {
            reply_markup: getClientKeyboard(lang)
          });
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
      const tz = detectTimezone(callbackQuery);
      console.log(`[Timezone] Auto-detected timezone for telegram_id=${telegramId}: ${tz} (language_code=${callbackQuery.from?.language_code || 'unknown'})`);

      try {
        const result = await registerUser(telegramId, role, lang, callbackQuery.from, tz);
        userLangCache[telegramId] = lang;

        if (result.already_existed) {
          const alreadyRegistered = t(lang, 'alreadyRegistered');
          bot.sendMessage(chatId, alreadyRegistered(result.user.role), {
            reply_markup: getKeyboardForRole(result.user.role, lang)
          });
        } else if (role === 'therapist') {
          const welcomeTherapist = t(lang, 'welcomeTherapist');
          await bot.sendMessage(chatId,
            welcomeTherapist(result.user.invite_code),
            { parse_mode: 'Markdown' }
          );
          // Prompt therapist to share phone number via contact button
          pendingPhoneShares[telegramId] = lang;
          bot.sendMessage(chatId, t(lang, 'sharePhonePrompt'), {
            reply_markup: {
              keyboard: [
                [{ text: t(lang, 'sharePhoneButton'), request_contact: true }],
                [{ text: t(lang, 'sharePhoneSkip') }]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          });
        } else if (role === 'client') {
          await bot.sendMessage(chatId, t(lang, 'welcomeClient'), {
            reply_markup: getClientKeyboard(lang)
          });
          // Show timezone confirmation for newly registered clients
          sendTimezoneConfirmation(chatId, lang, tz);
        }
      } catch (error) {
        console.error('Registration error:', error.message);
        bot.sendMessage(chatId, t(lang, 'registrationError'));
      }

      bot.answerCallbackQuery(callbackQuery.id);
    }
  });

  // Helper: send email prompt during registration
  function sendEmailPrompt(chatId, telegramId, lang) {
    pendingEmailInputs[telegramId] = lang;
    bot.sendMessage(chatId, t(lang, 'shareEmailPrompt'), {
      reply_markup: {
        keyboard: [
          [{ text: t(lang, 'shareEmailSkip') }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  // Helper: send other info prompt during registration (after email step)
  function sendOtherInfoPrompt(chatId, telegramId, lang) {
    pendingOtherInfoInputs[telegramId] = lang;
    bot.sendMessage(chatId, t(lang, 'shareOtherInfoPrompt'), {
      reply_markup: {
        keyboard: [
          [{ text: t(lang, 'shareOtherInfoSkip') }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  // Handle contact messages - phone sharing during therapist registration
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = pendingPhoneShares[telegramId] || await getUserLang(telegramId);

    if (!pendingPhoneShares[telegramId]) {
      // Not expecting a contact share, ignore
      return;
    }

    try {
      const phoneNumber = msg.contact.phone_number;
      // Save phone number via profile update API
      await api.put(`/api/bot/profile/${telegramId}`, { phone: phoneNumber });
      delete pendingPhoneShares[telegramId];

      await bot.sendMessage(chatId, t(lang, 'sharePhoneSaved'));
      // Proceed to email step
      sendEmailPrompt(chatId, telegramId, lang);
    } catch (error) {
      console.error('Failed to save shared phone:', error.message);
      delete pendingPhoneShares[telegramId];
      await bot.sendMessage(chatId, t(lang, 'profileSaveFailed'));
      // Still proceed to email step
      sendEmailPrompt(chatId, telegramId, lang);
    }
  });

  // Rate limiting for voice forwarding (max 10 messages per minute per therapist)
  const voiceForwardRateLimit = new Map(); // therapistTgId -> [timestamps]
  const FORWARD_RATE_LIMIT = 10;
  const FORWARD_RATE_WINDOW_MS = 60000;

  /**
   * Check if a therapist is within quiet hours.
   */
  function isQuietHours(quietHoursConfig) {
    if (!quietHoursConfig || !quietHoursConfig.enabled) return false;
    const now = new Date();
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const [startH, startM] = (quietHoursConfig.start || '22:00').split(':').map(Number);
    const [endH, endM] = (quietHoursConfig.end || '08:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Same day range (e.g., 08:00 to 18:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight range (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /**
   * Check rate limit for voice forwarding.
   */
  function checkForwardRateLimit(therapistTgId) {
    const now = Date.now();
    let timestamps = voiceForwardRateLimit.get(therapistTgId) || [];
    timestamps = timestamps.filter(t => now - t < FORWARD_RATE_WINDOW_MS);
    if (timestamps.length >= FORWARD_RATE_LIMIT) {
      voiceForwardRateLimit.set(therapistTgId, timestamps);
      return false; // Rate limited
    }
    timestamps.push(now);
    voiceForwardRateLimit.set(therapistTgId, timestamps);
    return true; // Allowed
  }

  /**
   * Forward voice/video message to therapist's Telegram chat.
   */
  async function forwardVoiceToTherapist(forwardInfo, fileId, entryType, chatIdOriginal) {
    try {
      if (!forwardInfo || !forwardInfo.therapist_telegram_id) return;

      // Check quiet hours
      if (isQuietHours(forwardInfo.quiet_hours)) {
        console.log('Skipping voice forward - therapist in quiet hours');
        return;
      }

      // Check rate limit
      if (!checkForwardRateLimit(forwardInfo.therapist_telegram_id)) {
        console.log('Skipping voice forward - rate limited');
        return;
      }

      const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'UTC' });
      const caption = `📨 ${forwardInfo.client_name} | ${entryType === 'video' ? 'Video' : 'Voice'} diary | ${timestamp} UTC`;

      if (entryType === 'voice') {
        await bot.sendVoice(forwardInfo.therapist_telegram_id, fileId, { caption });
      } else {
        // Video or video_note
        await bot.sendVideo(forwardInfo.therapist_telegram_id, fileId, { caption });
      }

      console.log(`Forwarded ${entryType} message to therapist ${forwardInfo.therapist_telegram_id}`);
    } catch (err) {
      console.error('Failed to forward voice to therapist:', err.message);
      // Non-fatal: don't affect client's diary saving
    }
  }

  /**
   * Download a file from Telegram servers by file_id.
   * Returns { buffer, filePath } or null on failure.
   */
  async function downloadTelegramFile(fileId, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get file path from Telegram Bot API
        const fileInfo = await bot.getFile(fileId);
        if (!fileInfo || !fileInfo.file_path) {
          console.error(`Could not get file path for file_id: ${fileId} (attempt ${attempt}/${maxRetries})`);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          return null;
        }
        // Download the file bytes
        const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const buffer = Buffer.from(response.data);
        console.log(`Downloaded Telegram file: ${buffer.length} bytes (attempt ${attempt}/${maxRetries})`);
        return {
          buffer,
          filePath: fileInfo.file_path
        };
      } catch (err) {
        console.error(`Failed to download Telegram file (attempt ${attempt}/${maxRetries}):`, err.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return null;
      }
    }
    return null;
  }

  // Handle voice messages - save as diary entries (clients only)
  bot.on('voice', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    try {
      // Check user role - only clients can create diary entries
      const user = await checkExistingUser(telegramId);
      if (user && user.role !== 'client') {
        bot.sendMessage(chatId, t(lang, 'therapistVoiceText'));
        return;
      }

      // Get file info from Telegram
      const fileId = msg.voice.file_id;
      const duration = msg.voice.duration;

      // Download actual voice file from Telegram servers
      let fileData = null;
      let fileExt = '.ogg'; // Telegram voice messages are always .ogg (opus)
      try {
        const downloaded = await downloadTelegramFile(fileId);
        if (downloaded) {
          fileData = downloaded.buffer.toString('base64');
          console.log(`Downloaded voice file: ${downloaded.buffer.length} bytes`);
        } else {
          console.warn('Voice file download failed for file_id:', fileId, '- entry will be saved without audio');
        }
      } catch (dlErr) {
        console.error('Voice file download failed, saving file_ref only:', dlErr.message);
      }

      // Submit voice diary entry via backend API (auto-transcription is triggered server-side)
      const result = await api.post('/api/bot/diary', {
        telegram_id: String(telegramId),
        entry_type: 'voice',
        content: `[Voice message, duration: ${duration}s]`,
        file_ref: fileId,
        file_data: fileData,
        file_ext: fileExt
      });

      // Check if audio file was stored successfully
      if (result.data && result.data.entry && !result.data.entry.has_audio_file) {
        console.warn(`Audio file was not stored for voice entry ${result.data.entry.id}`);
      }

      // Notify user that transcription is in progress
      bot.sendMessage(chatId, t(lang, 'voiceSavedTranscribing'));

      // Forward voice to therapist if enabled
      if (result.data && result.data.forward_voice) {
        forwardVoiceToTherapist(result.data.forward_voice, fileId, 'voice', chatId);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'failedVoiceDiary');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  });

  // Handle video messages - save as diary entries (clients only)
  bot.on('video', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    try {
      // Check user role - only clients can create diary entries
      const user = await checkExistingUser(telegramId);
      if (user && user.role !== 'client') {
        bot.sendMessage(chatId, t(lang, 'therapistVideoText'));
        return;
      }

      // Get file info from Telegram
      const fileId = msg.video.file_id;
      const duration = msg.video.duration;

      // Download actual video file from Telegram servers
      let fileData = null;
      let fileExt = '.mp4'; // Telegram video messages are typically .mp4
      try {
        const downloaded = await downloadTelegramFile(fileId);
        if (downloaded) {
          fileData = downloaded.buffer.toString('base64');
          // Determine extension from file path
          if (downloaded.filePath) {
            const ext = downloaded.filePath.split('.').pop();
            if (ext && ext.length <= 5) fileExt = '.' + ext;
          }
          console.log(`Downloaded video file: ${downloaded.buffer.length} bytes`);
        } else {
          console.warn('Video file download failed for file_id:', fileId, '- entry will be saved without audio');
        }
      } catch (dlErr) {
        console.error('Video file download failed, saving file_ref only:', dlErr.message);
      }

      // Submit video diary entry via backend API (auto-transcription is triggered server-side)
      const result = await api.post('/api/bot/diary', {
        telegram_id: String(telegramId),
        entry_type: 'video',
        content: `[Video message, duration: ${duration}s]`,
        file_ref: fileId,
        file_data: fileData,
        file_ext: fileExt
      });

      // Check if audio file was stored successfully
      if (result.data && result.data.entry && !result.data.entry.has_audio_file) {
        console.warn(`Audio file was not stored for video entry ${result.data.entry.id}`);
      }

      // Notify user that transcription is in progress
      bot.sendMessage(chatId, t(lang, 'videoSavedTranscribing'));

      // Forward video to therapist if enabled
      if (result.data && result.data.forward_voice) {
        forwardVoiceToTherapist(result.data.forward_voice, fileId, 'video', chatId);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'failedVideoDiary');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  });

  // Handle video note (round video) messages - save as diary entries (clients only)
  bot.on('video_note', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    try {
      // Check user role - only clients can create diary entries
      const user = await checkExistingUser(telegramId);
      if (user && user.role !== 'client') {
        bot.sendMessage(chatId, t(lang, 'therapistVideoText'));
        return;
      }

      // Get file info from Telegram
      const fileId = msg.video_note.file_id;
      const duration = msg.video_note.duration;

      // Download actual video note file from Telegram servers
      let fileData = null;
      let fileExt = '.mp4'; // Telegram video notes are .mp4
      try {
        const downloaded = await downloadTelegramFile(fileId);
        if (downloaded) {
          fileData = downloaded.buffer.toString('base64');
          console.log(`Downloaded video note: ${downloaded.buffer.length} bytes`);
        } else {
          console.warn('Video note download failed for file_id:', fileId, '- entry will be saved without audio');
        }
      } catch (dlErr) {
        console.error('Video note download failed, saving file_ref only:', dlErr.message);
      }

      // Submit video diary entry via backend API (auto-transcription is triggered server-side)
      const result = await api.post('/api/bot/diary', {
        telegram_id: String(telegramId),
        entry_type: 'video',
        content: `[Video note, duration: ${duration}s]`,
        file_ref: fileId,
        file_data: fileData,
        file_ext: fileExt
      });

      // Check if audio file was stored successfully
      if (result.data && result.data.entry && !result.data.entry.has_audio_file) {
        console.warn(`Audio file was not stored for video note entry ${result.data.entry.id}`);
      }

      // Notify user that transcription is in progress
      bot.sendMessage(chatId, t(lang, 'videoSavedTranscribing'));

      // Forward video note to therapist if enabled
      if (result.data && result.data.forward_voice) {
        forwardVoiceToTherapist(result.data.forward_voice, fileId, 'video', chatId);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'failedVideoDiary');
      bot.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  });

  // Handle text messages as diary entries, exercise responses, or keyboard button presses
  bot.on('message', async (msg) => {
    // Skip commands and non-text messages
    if (!msg.text || msg.text.startsWith('/') || msg.voice || msg.video || msg.video_note) return;

    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    // Check if this is a "Skip" response for phone sharing
    if (pendingPhoneShares[telegramId]) {
      const skipTexts = ['en', 'ru', 'es', 'uk'].map(l => t(l, 'sharePhoneSkip'));
      if (skipTexts.includes(msg.text)) {
        delete pendingPhoneShares[telegramId];
        await bot.sendMessage(chatId, t(lang, 'sharePhoneSkipped'));
        // Proceed to email step
        sendEmailPrompt(chatId, telegramId, lang);
        return;
      }
    }

    // Check if this is an email input or skip during registration
    if (pendingEmailInputs[telegramId]) {
      const emailSkipTexts = ['en', 'ru', 'es', 'uk'].map(l => t(l, 'shareEmailSkip'));
      if (emailSkipTexts.includes(msg.text)) {
        delete pendingEmailInputs[telegramId];
        await bot.sendMessage(chatId, t(lang, 'shareEmailSkipped'));
        // Proceed to other info step
        sendOtherInfoPrompt(chatId, telegramId, lang);
        return;
      }
      // Validate email format
      const emailText = msg.text.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailText)) {
        bot.sendMessage(chatId, t(lang, 'shareEmailInvalid'), {
          reply_markup: {
            keyboard: [[{ text: t(lang, 'shareEmailSkip') }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
        return;
      }
      // Try to save email
      try {
        await api.put(`/api/bot/profile/${telegramId}`, { email: emailText });
        delete pendingEmailInputs[telegramId];
        await bot.sendMessage(chatId, t(lang, 'shareEmailSaved'));
        // Proceed to other info step
        sendOtherInfoPrompt(chatId, telegramId, lang);
      } catch (error) {
        if (error.response && error.response.status === 409) {
          bot.sendMessage(chatId, t(lang, 'shareEmailTaken'), {
            reply_markup: {
              keyboard: [[{ text: t(lang, 'shareEmailSkip') }]],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          });
        } else {
          console.error('Failed to save email:', error.message);
          delete pendingEmailInputs[telegramId];
          await bot.sendMessage(chatId, t(lang, 'profileSaveFailed'));
          // Still proceed to other info step
          sendOtherInfoPrompt(chatId, telegramId, lang);
        }
      }
      return;
    }

    // Check if this is an other_info input or skip during registration
    if (pendingOtherInfoInputs[telegramId]) {
      const otherInfoSkipTexts = ['en', 'ru', 'es', 'uk'].map(l => t(l, 'shareOtherInfoSkip'));
      if (otherInfoSkipTexts.includes(msg.text)) {
        delete pendingOtherInfoInputs[telegramId];
        bot.sendMessage(chatId, t(lang, 'shareOtherInfoSkipped'), {
          reply_markup: getTherapistKeyboard(lang)
        });
        return;
      }
      // Save other_info text
      try {
        const otherInfoText = msg.text.trim();
        if (otherInfoText.length > 1000) {
          bot.sendMessage(chatId, '❌ Text too long (max 1000 characters). Please try again:', {
            reply_markup: {
              keyboard: [[{ text: t(lang, 'shareOtherInfoSkip') }]],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          });
          return;
        }
        await api.put(`/api/bot/profile/${telegramId}`, { other_info: otherInfoText });
        delete pendingOtherInfoInputs[telegramId];
        bot.sendMessage(chatId, t(lang, 'shareOtherInfoSaved'), {
          reply_markup: getTherapistKeyboard(lang)
        });
      } catch (error) {
        console.error('Failed to save other_info:', error.message);
        delete pendingOtherInfoInputs[telegramId];
        bot.sendMessage(chatId, t(lang, 'profileSaveFailed'), {
          reply_markup: getTherapistKeyboard(lang)
        });
      }
      return;
    }

    // Check if message matches a persistent keyboard button
    const buttonAction = BUTTON_ACTION_MAP[msg.text];
    if (buttonAction) {
      try {
        const user = await checkExistingUser(telegramId);
        switch (buttonAction) {
          case 'diary':
            bot.sendMessage(chatId, t(lang, 'diaryHint'), {
              reply_markup: getKeyboardForRole(user?.role || 'client', lang)
            });
            return;
          case 'exercises':
            await handleExercises(chatId, telegramId, lang);
            return;
          case 'history':
            await handleHistory(chatId, telegramId, lang);
            return;
          case 'sos':
            await handleSos(chatId, telegramId, lang, '');
            return;
          case 'profile':
            await handleProfile(chatId, telegramId, lang);
            return;
          case 'help':
            await handleHelp(chatId, telegramId, lang);
            return;
          case 'open_dashboard':
            bot.sendMessage(chatId, t(lang, 'dashboardLink'), {
              reply_markup: {
                inline_keyboard: [[
                  { text: t(lang, 'btnOpenDashboard'), url: `${FRONTEND_URL}/dashboard` }
                ]]
              }
            });
            return;
        }
      } catch (err) {
        // If user check fails, fall through to normal processing
      }
    }

    try {
      // Check user role - only clients can create diary entries
      const user = await checkExistingUser(telegramId);
      if (user && user.role !== 'client') {
        bot.sendMessage(chatId, t(lang, 'therapistFreeText'));
        return;
      }

      // Check if user has an active profile edit
      if (activeProfileEdits[telegramId]) {
        const editType = activeProfileEdits[telegramId];
        delete activeProfileEdits[telegramId];

        try {
          if (editType === 'name') {
            // Parse "First Last" format
            const parts = msg.text.trim().split(/\s+/);
            const firstName = parts[0] || '';
            const lastName = parts.slice(1).join(' ') || '';
            await api.put(`/api/bot/profile/${telegramId}`, { first_name: firstName, last_name: lastName });
            bot.sendMessage(chatId, t(lang, 'profileNameSaved'));
          } else if (editType === 'phone') {
            await api.put(`/api/bot/profile/${telegramId}`, { phone: msg.text.trim() });
            bot.sendMessage(chatId, t(lang, 'profilePhoneSaved'));
          }
        } catch (error) {
          bot.sendMessage(chatId, `❌ ${t(lang, 'profileSaveFailed')}`);
        }
        return;
      }

      // Check if user has an active exercise - route text as exercise response
      if (activeExercises[telegramId]) {
        const deliveryId = activeExercises[telegramId];
        try {
          await api.post(`/api/bot/exercises/${deliveryId}/respond`, {
            telegram_id: String(telegramId),
            response_text: msg.text
          });
          delete activeExercises[telegramId];
          bot.sendMessage(chatId, t(lang, 'exerciseCompleted'));
          return;
        } catch (error) {
          delete activeExercises[telegramId];
          const errorMsg = error.response?.data?.error || t(lang, 'exerciseCompleteFailed');
          bot.sendMessage(chatId, `❌ ${errorMsg}`);
          return;
        }
      }

      // Default: save as diary entry
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

  bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code, error.message);
  });

  console.log('PR-TOP Telegram Bot is running.');
}

// Helper functions for API communication

async function registerUser(telegramId, role, language, fromUser, timezone) {
  try {
    const response = await api.post('/api/bot/register', {
      telegram_id: String(telegramId),
      role: role,
      language: language || 'en',
      first_name: fromUser?.first_name || '',
      last_name: fromUser?.last_name || '',
      username: fromUser?.username || '',
      timezone: timezone || 'UTC'
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
