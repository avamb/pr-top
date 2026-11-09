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
const DEV_BOT_API_KEY = 'dev-bot-api-key';
const BOT_API_KEY = process.env.BOT_API_KEY || DEV_BOT_API_KEY;

// Fail closed: never run in production with the well-known development key
// (it would let anyone who guesses it call the /api/bot/* routes).
if (process.env.NODE_ENV === 'production' && (!process.env.BOT_API_KEY || process.env.BOT_API_KEY === DEV_BOT_API_KEY)) {
  console.error('FATAL: BOT_API_KEY is not set (or equals the development default) while NODE_ENV=production. Refusing to start.');
  process.exit(1);
}

// === Crash safety helpers (module level) ===

// Remove secrets (bot token, bot API key) from anything we are about to log.
function redact(value) {
  let str = String(value === undefined || value === null ? '' : value);
  if (token) str = str.split(token).join('[REDACTED_TOKEN]');
  if (BOT_API_KEY) str = str.split(BOT_API_KEY).join('[REDACTED_KEY]');
  return str.replace(/bot\d{5,}:[A-Za-z0-9_-]{20,}/g, 'bot[REDACTED_TOKEN]');
}

// Escape user-controlled text for Telegram legacy "Markdown" parse mode.
// Legacy Markdown only treats _ * ` [ as special; a backslash before them
// makes them literal. Always apply to names/titles/descriptions that are
// interpolated into a parse_mode: 'Markdown' message.
function escapeMd(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/([_*`\[])/g, '\\$1');
}

// User text placed INSIDE a Markdown entity (e.g. *bold*). Legacy Markdown does
// not allow backslash escapes inside entities (Bot API: "Escaping inside
// entities is not allowed"), so escapeMd() would show literal backslashes
// there. Swap the four special characters for look-alikes that Telegram does
// not parse: the entity stays valid and nothing odd is visible.
function mdInEntity(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/_/g, '＿')
    .replace(/\*/g, '∗')
    .replace(/`/g, 'ˋ')
    .replace(/\[/g, '［');
}

// Plain-text fallback for a Markdown message: drop the markers so the text
// is readable when Telegram rejects the entities (escaped chars become literal).
function stripMd(text) {
  const ESC = { '_': '', '*': '', '`': '', '[': '' };
  const UNESC = { '': '_', '': '*', '': '`', '': '[' };
  return String(text === undefined || text === null ? '' : text)
    .replace(/\\([_*`\[])/g, (m, ch) => ESC[ch])
    .replace(/[*`]/g, '')
    .replace(/(^|[\s(])_(?=\S)/g, '$1')
    .replace(/(\S)_(?=[\s).,!?:;]|$)/g, '$1')
    .replace(/[-]/g, (ch) => UNESC[ch]);
}

// Build an anchored regex for a bot command: "/cmd", "/cmd@BotName",
// "/cmd args..." — and NOT "he said /cmd" (the old unanchored regexes
// matched anywhere in the text, so a diary line could trigger a real SOS).
// Capture group 1 = the (possibly empty/undefined) argument string.
function commandRegex(name) {
  return new RegExp('^\\/' + name + '(?:@\\w+)?(?:\\s+([\\s\\S]*))?$');
}

function isTelegramParseError(err) {
  const desc = (err && err.response && err.response.body && err.response.body.description) || '';
  return /can't parse entities|can't find end of|unsupported start tag|unclosed/i.test(`${desc} ${err && err.message}`);
}

function isTelegramRateLimitError(err) {
  const code = err && ((err.response && err.response.statusCode) || (err.response && err.response.body && err.response.body.error_code));
  return code === 429 || /ETELEGRAM: 429|Too Many Requests/i.test(String(err && err.message));
}

function telegramRetryAfterSeconds(err) {
  const ra = err && err.response && err.response.body && err.response.body.parameters && err.response.body.parameters.retry_after;
  const n = Number(ra);
  if (Number.isFinite(n) && n > 0) return n;
  const m = /retry after (\d+)/i.exec(String(err && err.message));
  return m ? Number(m[1]) : 1;
}

function isTelegramBlockedError(err) {
  const code = err && ((err.response && err.response.statusCode) || (err.response && err.response.body && err.response.body.error_code));
  return code === 403 || /ETELEGRAM: 403|bot was blocked by the user|user is deactivated/i.test(String(err && err.message));
}

// Process-level safety nets. A rejected promise (e.g. Telegram 400 on a
// message nobody awaited) must never take the bot down.
process.on('unhandledRejection', (reason) => {
  const msg = reason && reason.message ? reason.message : reason;
  console.error('[unhandledRejection]', redact(msg));
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] FATAL:', redact(err && err.stack ? err.stack : err));
  // State may be inconsistent; exit and let the supervisor (Docker) restart us.
  process.exit(1);
});

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

// === Bounded in-memory state (audit M22) ===
// Every per-user state map below expires entries after a TTL and holds at
// most `maxEntries` keys (oldest dropped first); a periodic sweep removes
// expired entries. The returned Proxy keeps plain-object syntax working
// (state[id] = v, state[id], delete state[id]); keys are strings, like on a
// plain object. Values are returned as stored (mutating a stored object does
// not refresh its TTL; assigning does). With { touchOnRead: true } every read
// of a live entry also extends it (sliding expiry while the user is active).
const STATE_REGISTRY = [];
const STATE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const STATE_MAX_ENTRIES = 10000;

function createTtlState(name, opts) {
  const ttlMs = (opts && opts.ttlMs) || STATE_TTL_MS;
  const maxEntries = (opts && opts.maxEntries) || STATE_MAX_ENTRIES;
  const touchOnRead = !!(opts && opts.touchOnRead);
  const store = new Map(); // key -> { value, expiresAt }

  function read(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    if (touchOnRead) entry.expiresAt = Date.now() + ttlMs;
    return entry.value;
  }

  const proxy = new Proxy({}, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      return read(prop);
    },
    set(target, prop, value) {
      if (typeof prop === 'symbol') return false;
      store.delete(prop); // re-insert so Map order = age order
      store.set(prop, { value, expiresAt: Date.now() + ttlMs });
      while (store.size > maxEntries) store.delete(store.keys().next().value);
      return true;
    },
    deleteProperty(target, prop) {
      if (typeof prop !== 'symbol') store.delete(prop);
      return true;
    },
    has(target, prop) {
      return typeof prop !== 'symbol' && read(prop) !== undefined;
    }
  });

  STATE_REGISTRY.push({
    name,
    size: () => store.size,
    sweep: (now) => {
      const t0 = now || Date.now();
      let removed = 0;
      for (const [key, entry] of store) {
        if (entry.expiresAt <= t0) { store.delete(key); removed++; }
      }
      return removed;
    }
  });
  return proxy;
}

function sweepAllStates(now) {
  let removed = 0;
  for (const state of STATE_REGISTRY) removed += state.sweep(now);
  return removed;
}
setInterval(() => { sweepAllStates(); }, 5 * 60 * 1000).unref();

// Cache for user language preferences (L: TTL so a language change made
// elsewhere is picked up within 10 minutes)
const userLangCache = createTtlState('userLangCache', { ttlMs: 10 * 60 * 1000 });

// === Media limits (audit M24) ===
// Telegram's Bot API only lets bots download files up to 20 MB.
const MAX_TELEGRAM_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MAX_CONCURRENT_MEDIA = 2;

function isFileTooLarge(fileSize) {
  const n = Number(fileSize);
  return Number.isFinite(n) && n > MAX_TELEGRAM_DOWNLOAD_BYTES;
}

// Backend size rejection: 413 (body over BOT_JSON_BODY_LIMIT) or any error
// code containing TOO_LARGE (e.g. PAYLOAD_TOO_LARGE / FILE_TOO_LARGE).
function isPayloadTooLargeError(err) {
  const res = err && err.response;
  if (!res) return false;
  if (res.status === 413) return true;
  const code = res.data && res.data.code;
  return typeof code === 'string' && /TOO_LARGE/i.test(code);
}

// Tiny semaphore: at most `limit` media downloads/uploads in flight, so a
// burst of 20 MB files cannot hold many base64 copies in memory at once.
function createSemaphore(limit) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= limit || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); });
  };
  return {
    run(fn) {
      return new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
    },
    get active() { return active; },
    get queued() { return queue.length; }
  };
}

// Localized exercise field with English fallback (title/description/instructions).
function localizedField(obj, base, lang) {
  if (!obj) return '';
  return obj[`${base}_${lang}`] || obj[`${base}_en`] || '';
}

// Bot menu commands (≡ button), localized per Telegram language_code.
const MENU_COMMANDS = ['assignments', 'report', 'exercises', 'sessions', 'history', 'sos', 'profile', 'timezone', 'help', 'disconnect'];
function buildMenuCommands(lang) {
  return MENU_COMMANDS.map((command) => ({
    command,
    description: t(lang, 'cmd' + command.charAt(0).toUpperCase() + command.slice(1))
  }));
}

// Liveness file for the container healthcheck: touched every 30 s while
// Telegram polling is healthy (see startHeartbeat in the bot block below).
const HEARTBEAT_FILE = process.env.BOT_HEARTBEAT_FILE || '/tmp/bot-heartbeat';
function writeHeartbeat(file) {
  require('fs').writeFileSync(file || HEARTBEAT_FILE, String(Date.now()));
}

// T-18: Extended consent disclaimer.
// Bump CONSENT_TEXT_VERSION any time the disclaimer text changes — existing
// connected clients whose stored consent_version is lower will be forced to
// re-consent on their next bot interaction. Version 1 is the first version
// of the extended (5-checkbox) consent flow; legacy single-Yes/No clients
// are stored as version 0 and re-prompted automatically.
// Version 2 (T-399): added sessionReminders checkbox (6th point, conceptually
// "consent_session_reminders"). Using camelCase because the callback_data
// format "consent_chk_<tid>_<point>" is parsed with lastIndexOf('_'), so
// point names must not contain underscores.
const CONSENT_TEXT_VERSION = 2;
const CONSENT_POINTS = ['storage', 'ai', 'supervision', 'revoke', 'encryption', 'sessionReminders'];
// Points that are pre-checked by default (client can still un-tick them).
const CONSENT_POINTS_PRECHECKED = new Set(['sessionReminders']);

// In-memory state for the multi-checkbox consent flow.
// Keyed by telegramId. Cleared on completion / cancel / timeout (30 min TTL).
//   { therapistId, therapistName, checked: { storage, ai, ... }, mode: 'connect' | 'reconsent' | 'linked', messageId }
// After a restart (or the TTL) the state is gone; a press on an old consent
// button then answers "please send /start again" (consentStale).
const pendingConsents = createTtlState('pendingConsents');

// Track active exercise sessions (telegramId -> deliveryId)
// 3 h sliding TTL: answering an exercise can take a while (wave 3 review).
const activeExercises = createTtlState('activeExercises', { ttlMs: 3 * 60 * 60 * 1000, touchOnRead: true });

// T-04: Track active assignment-report sessions. When the client taps
// "Write report" on an assignment, we set activeReports[telegramId] = assignmentId
// so that the next text OR voice message is routed to the report endpoint
// instead of the diary endpoint. Cleared after one message (single-shot).
// M22: expires 3 h after the last use (sliding), so a forgotten "Write
// report" no longer swallows a diary entry days later.
const activeReports = createTtlState('activeReports', { ttlMs: 3 * 60 * 60 * 1000, touchOnRead: true });

// Track active profile edit sessions (telegramId -> 'name' | 'phone')
const activeProfileEdits = createTtlState('activeProfileEdits');

// Track pending phone sharing requests after therapist registration (telegramId -> lang)
const pendingPhoneShares = createTtlState('pendingPhoneShares');

// Track pending email input after phone step (telegramId -> lang)
const pendingEmailInputs = createTtlState('pendingEmailInputs');

// M8: waiting for the 6-digit code mailed to the entered address (telegramId -> lang)
const pendingEmailCodes = createTtlState('pendingEmailCodes');

// Track pending other_info input after email step (telegramId -> lang)
const pendingOtherInfoInputs = createTtlState('pendingOtherInfoInputs');

// Get user language from cache or API
async function getUserLang(telegramId) {
  const cached = userLangCache[telegramId];
  if (cached) return cached;
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
  console.log('Bot token not configured - API endpoints still work for testing.');
  // Don't exit - allow the bot module to be imported for testing
} else {
  const bot = new TelegramBot(token, { polling: true });

  console.log('PR-TOP Telegram Bot starting...');

  // === Safe Telegram wrappers ===

  // Send a message without ever rejecting.
  //  - 400 "can't parse entities" with parse_mode set: retry once as plain text
  //    (Markdown markers stripped) so a stray _ or * in user content cannot drop the message.
  //  - 403 (user blocked the bot / deactivated): log at info level, return null.
  //  - anything else: log (redacted), return null.
  // Returns the sent Message (callers use .message_id) or null.
  // extra.retryOnRateLimit: for critical messages (SOS replies) — on 429 wait
  // retry_after (capped at 5s) and try once more.
  async function safeSend(chatId, text, options, extra) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (err) {
      if (extra && extra.retryOnRateLimit && isTelegramRateLimitError(err)) {
        const waitMs = Math.min(Math.max(telegramRetryAfterSeconds(err), 1), 5) * 1000;
        console.warn(`[safeSend] 429 for chat ${chatId}, retrying once in ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return safeSend(chatId, text, options);
      }
      if (isTelegramBlockedError(err)) {
        console.info(`[safeSend] chat ${chatId} unreachable (blocked/deactivated), message dropped`);
        return null;
      }
      if (options && options.parse_mode && isTelegramParseError(err)) {
        console.warn(`[safeSend] Markdown parse error for chat ${chatId}, retrying as plain text`);
        const { parse_mode, ...plainOptions } = options;
        try {
          return await bot.sendMessage(chatId, stripMd(text), plainOptions);
        } catch (err2) {
          if (isTelegramBlockedError(err2)) {
            console.info(`[safeSend] chat ${chatId} unreachable (blocked/deactivated), message dropped`);
          } else {
            console.error(`[safeSend] plain-text retry failed for chat ${chatId}:`, redact(err2 && err2.message));
          }
          return null;
        }
      }
      console.error(`[safeSend] sendMessage failed for chat ${chatId}:`, redact(err && err.message));
      return null;
    }
  }

  // editMessageText with the same fallbacks as safeSend. Never rejects.
  async function safeEdit(text, options) {
    try {
      return await bot.editMessageText(text, options);
    } catch (err) {
      if (isTelegramBlockedError(err)) return null;
      if (options && options.parse_mode && isTelegramParseError(err)) {
        const { parse_mode, ...plainOptions } = options;
        try {
          return await bot.editMessageText(stripMd(text), plainOptions);
        } catch (err2) {
          // "message is not modified" etc. — best-effort
          return null;
        }
      }
      // "message is not modified" / message too old — best-effort
      return null;
    }
  }

  // answerCallbackQuery that cannot reject (expired queries return 400).
  async function safeAnswer(callbackQueryId, options) {
    try {
      await bot.answerCallbackQuery(callbackQueryId, options);
    } catch (err) {
      console.warn('[safeAnswer] answerCallbackQuery failed:', redact(err && err.message));
    }
  }

  function isPrivateChat(chat) {
    return !!chat && chat.type === 'private';
  }

  // In-flight handler tracking so a graceful shutdown (deploy) can let a running
  // handler — notably an SOS — finish before the process exits.
  const inFlight = new Set();
  function track(promise) {
    inFlight.add(promise);
    const done = () => inFlight.delete(promise);
    promise.then(done, done);
    return promise;
  }

  // Register a text command handler. Only private chats; errors are logged,
  // never left as unhandled rejections.
  function onCmd(regex, handler) {
    bot.onText(regex, (msg, match) => {
      if (!msg || !msg.from || !isPrivateChat(msg.chat)) {
        console.debug(`[bot] ignoring command in non-private chat type=${msg && msg.chat && msg.chat.type}`);
        return;
      }
      track(Promise.resolve()
        .then(() => handler(msg, match))
        .catch((err) => console.error('[bot] command handler error:', redact(err && err.message))));
    });
  }

  // Register an event handler (message, voice, callback_query, ...). Only
  // private chats; errors are logged, never left as unhandled rejections.
  function onEvent(event, handler) {
    bot.on(event, (payload) => {
      const chat = payload && (payload.chat || (payload.message && payload.message.chat));
      if (!payload || !payload.from || (chat && !isPrivateChat(chat))) {
        console.debug(`[bot] ignoring ${event} in non-private chat type=${chat && chat.type}`);
        return;
      }
      track(Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => console.error(`[bot] ${event} handler error:`, redact(err && err.message))));
    });
  }

  // === Graceful shutdown ===
  let shuttingDown = false;
  // Docker's default stop grace period is 10s (SIGKILL after that), so stay below it.
  const SHUTDOWN_MAX_WAIT_MS = 9000;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = Date.now() + SHUTDOWN_MAX_WAIT_MS;
    console.log(`[bot] ${signal} received, stopping polling...`);
    try {
      await Promise.race([
        bot.stopPolling(),
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
    } catch (err) {
      console.warn('[bot] stopPolling failed:', redact(err && err.message));
    }
    // Let handlers that are already running (e.g. an SOS being delivered)
    // finish; no new updates arrive once polling is stopped.
    if (inFlight.size > 0) {
      console.log(`[bot] waiting for ${inFlight.size} in-flight handler(s) to finish...`);
      await Promise.race([
        Promise.allSettled([...inFlight]),
        new Promise((resolve) => setTimeout(resolve, Math.max(deadline - Date.now(), 0)))
      ]);
      if (inFlight.size > 0) console.warn(`[bot] exiting with ${inFlight.size} handler(s) still running`);
    }
    process.exit(0);
  }
  process.on('SIGTERM', () => { shutdown('SIGTERM'); });
  process.on('SIGINT', () => { shutdown('SIGINT'); });

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
    // Client commands for all private chats: English as the default, plus one
    // localized set per supported Telegram language_code.
    try {
      await bot.setMyCommands(buildMenuCommands('en'), { scope: { type: 'all_private_chats' } });
      console.log('Bot menu commands set for all_private_chats (default)');
    } catch (err) {
      console.warn('Failed to set bot menu commands:', err.message);
    }
    for (const lang of ['en', 'ru', 'es', 'uk']) {
      try {
        await bot.setMyCommands(buildMenuCommands(lang), { scope: { type: 'all_private_chats' }, language_code: lang });
      } catch (err) {
        console.warn(`Failed to set bot menu commands for ${lang}:`, err.message);
      }
    }
  }

  // Run on startup (non-blocking)
  setBotDescriptions().catch(err => console.warn('BotFather setup failed:', err.message));
  setBotMenuCommands().catch(err => console.warn('Bot menu commands setup failed:', err.message));

  // === Extracted handler functions (shared by slash commands and keyboard buttons) ===

  // T-18: Build the full consent disclaimer body shown before the 6 checkboxes.
  // This is one Telegram message (Markdown). The body string is *also* hashed
  // via SHA-256 so the audit log can store an integrity hash of exactly what
  // the client agreed to (`consent_text_hash` column on users).
  // T-399: added consentDisclaimerSessionReminders as point 6.
  function buildConsentBodyText(lang, therapistName) {
    const headerFn = t(lang, 'consentDisclaimerHeader');
    // therapistName is user-controlled and sits inside a *bold* entity (no escapes allowed there).
    const head = typeof headerFn === 'function' ? headerFn(mdInEntity(therapistName), CONSENT_TEXT_VERSION) : headerFn;
    const lines = [
      head,
      '',
      t(lang, 'consentDisclaimerStorage'),
      '',
      t(lang, 'consentDisclaimerAi'),
      '',
      t(lang, 'consentDisclaimerSupervision'),
      '',
      t(lang, 'consentDisclaimerRevoke'),
      '',
      t(lang, 'consentDisclaimerEncryption'),
      '',
      t(lang, 'consentDisclaimerSessionReminders'),
      '',
      t(lang, 'consentDisclaimerFooter')
    ];
    return lines.join('\n');
  }

  // T-18: Compute a stable sha256 hex digest of the disclaimer body (as
  // shown to the user) for audit-trail forensics. Best-effort: failure is
  // non-fatal — the bot just stores `null` in that case.
  function computeConsentHash(text) {
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    } catch {
      return null;
    }
  }

  // T-18: Build the 5-checkbox + Continue/Cancel inline keyboard.
  function buildConsentKeyboard(lang, therapistId, checked) {
    const rows = CONSENT_POINTS.map(pt => {
      const on = !!checked[pt];
      const labelKey = 'consentCheckbox' + pt.charAt(0).toUpperCase() + pt.slice(1);
      const text = (on ? '✅ ' : '⬜ ') + t(lang, labelKey);
      return [{ text, callback_data: `consent_chk_${therapistId}_${pt}` }];
    });
    rows.push([{ text: t(lang, 'consentBtnContinue'), callback_data: `consent_continue_${therapistId}` }]);
    rows.push([{ text: t(lang, 'consentBtnCancel'), callback_data: `consent_cancel_${therapistId}` }]);
    return { inline_keyboard: rows };
  }

  // T-18: Send the disclaimer + checkbox keyboard. Tracks per-user state in
  // `pendingConsents` so callback toggles can update the keyboard. `mode` is
  // 'connect' for first-time consent (post /connect) or 'reconsent' for
  // version-bump re-consent on existing connections.
  async function sendConsentPrompt(chatId, telegramId, lang, therapistId, therapistName, mode) {
    const checked = {};
    // T-399: session_reminders is pre-checked by default (opt-out model).
    CONSENT_POINTS.forEach(pt => { checked[pt] = CONSENT_POINTS_PRECHECKED.has(pt); });
    pendingConsents[telegramId] = {
      therapistId: parseInt(therapistId, 10),
      therapistName,
      checked,
      mode: mode || 'connect',
      lang
    };
    if (mode === 'reconsent') {
      try { await safeSend(chatId, t(lang, 'consentReprompt'), { parse_mode: 'Markdown' }); } catch { /* ignore */ }
    } else if (mode === 'linked') {
      try { await safeSend(chatId, t(lang, 'consentLinkedIntro'), { parse_mode: 'Markdown' }); } catch { /* ignore */ }
    }
    const body = buildConsentBodyText(lang, therapistName);
    // safeSend retries as plain text if Telegram rejects the Markdown (e.g. a
    // therapist display name with special characters).
    const sent = await safeSend(chatId, body, {
      parse_mode: 'Markdown',
      reply_markup: buildConsentKeyboard(lang, therapistId, checked)
    });
    if (sent && sent.message_id) {
      pendingConsents[telegramId].messageId = sent.message_id;
      pendingConsents[telegramId].chatId = chatId;
    }
  }

  // The therapist's account is blocked, so no new consent can be given.
  // `offerDisconnect`: the client is linked to that therapist (admin link
  // without consent) — offer the same "Yes, disconnect" action.
  async function sendTherapistUnavailable(chatId, lang, therapistId, offerDisconnect) {
    const opts = offerDisconnect ? {
      reply_markup: {
        inline_keyboard: [[
          { text: t(lang, 'linkedDisconnectYes'), callback_data: `linked_disconnect_yes_${therapistId}` }
        ]]
      }
    } : {};
    await safeSend(chatId, t(lang, offerDisconnect ? 'linkedTherapistUnavailable' : 'therapistUnavailable'), opts);
  }

  // T-18: Returns true if the user is allowed to proceed (not a connected
  // client OR consent_version is up-to-date). If the user is a connected
  // client whose consent_version < CONSENT_TEXT_VERSION, this triggers the
  // re-consent prompt and returns false. Callers should early-return when
  // false. `user` is optional — if omitted, fetched via checkExistingUser.
  // Audit wave 3: a client LINKED to a therapist (e.g. by an admin) who never
  // gave consent (consent_therapist_access = 0) gets the full consent prompt
  // for that therapist (mode 'linked') — previously the only way out was
  // /disconnect followed by /connect.
  async function requireConsentUpToDate(chatId, telegramId, lang, user) {
    try {
      let u = user;
      if (!u) u = await checkExistingUser(telegramId);
      if (!u) return true; // Not registered yet — let the normal flow handle it
      if (u.role !== 'client') return true; // Therapists/superadmin not gated
      if (!u.therapist_id) return true; // Unconnected client — nothing to gate
      let mode;
      if (!u.consent_therapist_access) {
        mode = 'linked';
      } else {
        const v = (u.consent_version === undefined || u.consent_version === null) ? 0 : u.consent_version;
        if (v >= CONSENT_TEXT_VERSION) return true;
        mode = 'reconsent';
      }
      // If a prompt for the same purpose is already in flight, just remind
      // the user to complete it instead of spamming a new copy.
      const inFlight = pendingConsents[telegramId];
      if (inFlight && inFlight.mode === mode && String(inFlight.therapistId) === String(u.therapist_id)) {
        try { await safeSend(chatId, t(lang, 'consentBlockedText')); } catch { /* ignore */ }
        return false;
      }
      // Look up therapist display name for the disclaimer header.
      let therapistName = t(lang, 'therapistFallbackName')(u.therapist_id);
      let therapistAvailable = true;
      try {
        const tres = await api.get(`/api/bot/therapist-display/${u.therapist_id}`);
        if (tres.data && tres.data.display_name) therapistName = tres.data.display_name;
        if (tres.data && tres.data.available === false) therapistAvailable = false;
      } catch { /* fallback to ID label */ }
      // A first consent to a blocked therapist would be refused by the
      // backend (THERAPIST_UNAVAILABLE): say so and offer to disconnect
      // instead of showing a prompt that cannot succeed.
      if (mode === 'linked' && !therapistAvailable) {
        await sendTherapistUnavailable(chatId, lang, u.therapist_id, true);
        return false;
      }
      await sendConsentPrompt(chatId, telegramId, lang, u.therapist_id, therapistName, mode);
      return false;
    } catch (err) {
      console.error('requireConsentUpToDate error:', err.message);
      return true; // Fail-open so the bot doesn't lock up on transient errors
    }
  }

  async function handleHelp(chatId, telegramId, lang) {
    try {
      const user = await checkExistingUser(telegramId);
      if (!user) {
        safeSend(chatId, t(lang, 'helpUnregistered'), { parse_mode: 'Markdown' });
        return;
      }
      if (user.role === 'therapist') {
        safeSend(chatId, t(lang, 'helpTherapist'), { parse_mode: 'Markdown' });
      } else {
        safeSend(chatId, t(lang, 'helpClient'), { parse_mode: 'Markdown' });
      }
    } catch (error) {
      safeSend(chatId, t(lang, 'helpClient'), { parse_mode: 'Markdown' });
    }
  }

  async function handleProfile(chatId, telegramId, lang) {
    try {
      const user = await checkExistingUser(telegramId);
      if (!user) {
        safeSend(chatId, t(lang, 'helpUnregistered'), { parse_mode: 'Markdown' });
        return;
      }
      const profileText = t(lang, 'profileView');
      // Names/usernames are user-controlled (telegram usernames often contain "_").
      safeSend(chatId, profileText(escapeMd(user.first_name), escapeMd(user.last_name), escapeMd(user.phone), escapeMd(user.telegram_username)), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: t(lang, 'profileEditName'), callback_data: 'profile_edit_name' }],
            [{ text: t(lang, 'profileEditPhone'), callback_data: 'profile_edit_phone' }]
          ]
        }
      });
    } catch (error) {
      safeSend(chatId, `❌ ${t(lang, 'profileFailed')}`);
    }
  }

  async function handleSos(chatId, telegramId, lang, sosMessage) {
    // SOS must NEVER be gated: a client in crisis must not be bounced to a
    // consent screen. Send the alert first; only afterwards (if the consent
    // text version is outdated) show the re-consent prompt.
    let delivered = true;
    try {
      const response = await api.post('/api/bot/sos', {
        telegram_id: String(telegramId),
        message: sosMessage || undefined
      });
      // Backend reports whether any therapist notification actually went out.
      // Field missing (older backend) is treated as delivered.
      if (response && response.data && response.data.notification_delivered === false) {
        delivered = false;
      }
    } catch (error) {
      // Never show the raw backend error in a crisis flow — always the fixed
      // text that carries the emergency numbers.
      console.error(`[SOS] request failed for telegram_id=${telegramId}: status=${error.response && error.response.status} ${redact(error.message)}`);
      await safeSend(chatId, `❌ ${t(lang, 'sosFailed')}`, undefined, { retryOnRateLimit: true });
      return;
    }

    await safeSend(chatId, t(lang, delivered ? 'sosConfirmed' : 'sosNotDelivered'), { parse_mode: 'Markdown' }, { retryOnRateLimit: true });

    // T-18: re-consent is requested AFTER the SOS went out (never before).
    try {
      await requireConsentUpToDate(chatId, telegramId, lang);
    } catch (err) {
      console.error('[SOS] post-SOS consent check failed:', redact(err && err.message));
    }
  }

  async function handleHistory(chatId, telegramId, lang) {
    try {
      const result = await api.get(`/api/bot/diary/${telegramId}?limit=10`);
      const entries = result.data.entries;

      if (!entries || entries.length === 0) {
        safeSend(chatId, t(lang, 'historyEmpty'));
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
          preview = entry.content ? entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '') : t(lang, 'diaryNoContent');
        }
        text += `${i + 1}. ${typeIcon} ${date}\n${preview}\n\n`;
      });

      safeSend(chatId, text);
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'historyFailed');
      safeSend(chatId, `❌ ${errorMsg}`);
    }
  }

  // T-02: list the client's last 5 sessions by meeting_date.
  async function handleSessions(chatId, telegramId, lang) {
    try {
      const result = await api.get(`/api/bot/sessions/${telegramId}?limit=5`);
      const sessions = result.data && result.data.sessions ? result.data.sessions : [];

      if (!sessions || sessions.length === 0) {
        safeSend(chatId, t(lang, 'sessionsEmpty'));
        return;
      }

      // Resolve user's timezone to format meeting_date sensibly.
      let userTimezone = 'UTC';
      try {
        const userInfo = await checkExistingUser(telegramId);
        if (userInfo && userInfo.timezone) userTimezone = userInfo.timezone;
      } catch (_) { /* fallback to UTC */ }

      const locale = lang === 'ru' ? 'ru-RU'
                   : lang === 'es' ? 'es-ES'
                   : lang === 'uk' ? 'uk-UA'
                   : 'en-US';

      let text = t(lang, 'sessionsHeader') + '\n\n';
      sessions.forEach((s, i) => {
        const rawDate = s.meeting_date || s.created_at;
        // Treat naked datetimes as UTC (matches the DB convention used elsewhere).
        const utcSafe = rawDate && typeof rawDate === 'string' && !rawDate.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(rawDate)
          ? rawDate + 'Z'
          : rawDate;
        let dateStr = '—';
        if (utcSafe) {
          try {
            dateStr = new Date(utcSafe).toLocaleDateString(locale, {
              day: 'numeric', month: 'short', year: 'numeric',
              timeZone: userTimezone
            });
          } catch (_) {
            dateStr = String(rawDate || '—');
          }
        }
        const titlePart = s.title ? ` — ${escapeMd(s.title)}` : '';
        const statusPart = s.status ? ` (${escapeMd(s.status)})` : '';
        text += `${i + 1}. 🎧 ${dateStr}${titlePart}${statusPart}\n`;
      });

      safeSend(chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'sessionsFailed');
      safeSend(chatId, `❌ ${errorMsg}`);
    }
  }

  async function handleExercises(chatId, telegramId, lang) {
    try {
      // Exercises come from the linked therapist: consent gate first.
      if (!(await requireConsentUpToDate(chatId, telegramId, lang))) return;
      const result = await api.get(`/api/bot/exercises/${telegramId}`);
      const exercises = result.data.exercises;

      if (!exercises || exercises.length === 0) {
        safeSend(chatId, t(lang, 'exercisesEmpty'));
        return;
      }

      let text = t(lang, 'exercisesHeader') + '\n';
      const inlineButtons = [];

      exercises.forEach((ex, i) => {
        const title = localizedField(ex, 'title', lang) || t(lang, 'exerciseFallbackTitle');

        let statusLabel;
        if (ex.status === 'completed') {
          statusLabel = t(lang, 'exerciseStatusCompleted');
        } else if (ex.status === 'acknowledged') {
          statusLabel = t(lang, 'exerciseStatusAcknowledged');
        } else {
          statusLabel = t(lang, 'exerciseStatusSent');
        }

        text += `${i + 1}. ${statusLabel} *${mdInEntity(title)}*\n`;

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

      safeSend(chatId, text, opts);
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'exercisesFailed');
      safeSend(chatId, `❌ ${errorMsg}`);
    }
  }

  // /start command - role selection or deep link connect
  onCmd(commandRegex('start'), async (msg, match) => {
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

        // Send deep link welcome (no "enter code" — client came via link)
        await safeSend(chatId, t(lang, 'deepLinkClientWelcome'));

        // T-18: Show extended consent disclaimer + 5-checkbox flow.
        await sendConsentPrompt(chatId, telegramId, lang, therapist.id, therapist.display_name, 'connect');

        // Show timezone confirmation for newly registered clients
        if (isNewRegistration) {
          sendTimezoneConfirmation(chatId, lang, detectedTz);
        }
      } catch (error) {
        const errorMsg = error.response?.data?.error || t(lang, 'deepLinkInvalidCode');
        safeSend(chatId, `❌ ${errorMsg}\n\n${t(lang, 'deepLinkFallbackHint')}`);
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
        safeSend(chatId, welcomeBack(existingUser.role), {
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

    safeSend(chatId, msgs.chooseRoleIntro, {
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
  onCmd(/^\/connect(?:@\w+)?\s+(\S[\s\S]*)$/, async (msg, match) => {
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

      // T-18: Step 2 — Show extended consent disclaimer + 5-checkbox flow.
      await sendConsentPrompt(chatId, telegramId, lang, therapist.id, therapist.display_name, 'connect');
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'failedInviteCode');
      safeSend(chatId, `❌ ${errorMsg}`);
    }
  });

  // /connect without code - show usage
  onCmd(/^\/connect(?:@\w+)?\s*$/, async (msg) => {
    const lang = await getUserLang(msg.from.id);
    safeSend(msg.chat.id,
      t(lang, 'connectUsage'),
      { parse_mode: 'Markdown' }
    );
  });

  // /profile command - view/edit client profile
  onCmd(commandRegex('profile'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleProfile(chatId, telegramId, lang);
  });

  // /help command - role-aware command list
  onCmd(commandRegex('help'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleHelp(chatId, telegramId, lang);
  });

  // /sos command - client emergency alert
  onCmd(commandRegex('sos'), async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    const sosMessage = match[1] ? match[1].trim() : '';
    await handleSos(chatId, telegramId, lang, sosMessage);
  });

  // /history command - show recent diary entries
  onCmd(commandRegex('history'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleHistory(chatId, telegramId, lang);
  });

  // T-02: /sessions — client sees their last 5 sessions with meeting dates.
  // Class A material (transcripts/summaries) is intentionally NOT exposed via
  // the bot — only the meeting date, an optional therapist-assigned title,
  // and the processing status are returned.
  onCmd(commandRegex('sessions'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleSessions(chatId, telegramId, lang);
  });

  // /exercises command - client views assigned exercises
  onCmd(commandRegex('exercises'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleExercises(chatId, telegramId, lang);
  });

  // T-03: /assignments — client lists active homework set by therapist + can
  // open an assignment to write a freeform report (text message). Voice/video
  // diary entries are NOT auto-attached as reports here — the client must use
  // a text reply, the same way exercise responses work today.
  onCmd(commandRegex('assignments'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleAssignments(chatId, telegramId, lang);
  });

  async function handleAssignments(chatId, telegramId, lang) {
    try {
      // Assignments come from the linked therapist: consent gate first.
      if (!(await requireConsentUpToDate(chatId, telegramId, lang))) return;
      const result = await api.get(`/api/bot/assignments/${telegramId}`);
      const assignments = (result.data && result.data.assignments) || [];

      if (assignments.length === 0) {
        safeSend(chatId, t(lang, 'assignmentsEmpty'));
        return;
      }

      let text = t(lang, 'assignmentsHeader') + '\n\n';
      const inlineButtons = [];
      assignments.forEach((a, i) => {
        const exerciseTitle = a.exercise
          ? (lang === 'ru' ? (a.exercise.title_ru || a.exercise.title_en)
            : lang === 'es' ? (a.exercise.title_es || a.exercise.title_en)
            : lang === 'uk' ? (a.exercise.title_uk || a.exercise.title_en)
            : a.exercise.title_en)
          : null;
          // Prefer therapist-supplied title; fall back to library exercise title.
        const displayTitle = (a.title && a.title.trim()) ? a.title : (exerciseTitle || t(lang, 'assignmentFallbackTitle')(a.id));
        const freqLabel = t(lang, `assignmentFrequency_${a.report_frequency}`);
        text += `${i + 1}. *${mdInEntity(displayTitle)}*\n   ⏱ ${freqLabel}\n`;
        inlineButtons.push([{
          text: `${i + 1}. ${displayTitle}`,
          callback_data: `assignment_view_${a.id}`,
        }]);
      });

      const opts = { parse_mode: 'Markdown' };
      if (inlineButtons.length > 0) {
        opts.reply_markup = { inline_keyboard: inlineButtons };
      }
      safeSend(chatId, text, opts);
    } catch (error) {
      const errorMsg = (error.response && error.response.data && error.response.data.error)
        || t(lang, 'assignmentsFailed');
      safeSend(chatId, `❌ ${errorMsg}`);
    }
  }

  // T-04: /report [assignment_id] — shortcut to start writing a freeform
  // progress report for an active assignment without going through
  // /assignments → tap → tap.
  //
  //   /report                      → list active assignments, each as an
  //                                  inline button that arms the report flow.
  //   /report <assignment_id>      → arm the flow immediately for that id.
  onCmd(/^\/report(?:@\w+)?(?:\s+(\S+))?\s*$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    const explicitId = match && match[1] ? parseInt(match[1], 10) : null;

    try {
      if (!(await requireConsentUpToDate(chatId, telegramId, lang))) return;
      const result = await api.get(`/api/bot/assignments/${telegramId}`);
      const assignments = (result.data && result.data.assignments) || [];

      if (assignments.length === 0) {
        safeSend(chatId, t(lang, 'reportNoAssignments'));
        return;
      }

      // If the user passed an id, validate it and arm immediately.
      if (Number.isInteger(explicitId) && explicitId > 0) {
        const target = assignments.find((a) => Number(a.id) === explicitId);
        if (!target) {
          safeSend(chatId, t(lang, 'reportAssignmentNotActive'));
          return;
        }
        activeReports[telegramId] = explicitId;
        safeSend(chatId, t(lang, 'assignmentReportPrompt')(explicitId));
        return;
      }

      // No id provided — show inline picker.
      let text = t(lang, 'reportPickHeader') + '\n\n';
      const inlineButtons = [];
      assignments.forEach((a, i) => {
        const exerciseTitle = a.exercise
          ? (lang === 'ru' ? (a.exercise.title_ru || a.exercise.title_en)
            : lang === 'es' ? (a.exercise.title_es || a.exercise.title_en)
            : lang === 'uk' ? (a.exercise.title_uk || a.exercise.title_en)
            : a.exercise.title_en)
          : null;
        const displayTitle = (a.title && a.title.trim()) ? a.title : (exerciseTitle || t(lang, 'assignmentFallbackTitle')(a.id));
        text += `${i + 1}. *${mdInEntity(displayTitle)}*\n`;
        inlineButtons.push([{
          text: `${i + 1}. ${displayTitle}`,
          callback_data: `assignment_report_${a.id}`,
        }]);
      });

      safeSend(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineButtons },
      });
    } catch (error) {
      const errorMsg = (error.response && error.response.data && error.response.data.error)
        || t(lang, 'assignmentsFailed');
      safeSend(chatId, `❌ ${errorMsg}`);
    }
  });

  // /timezone command - view and change timezone
  onCmd(commandRegex('timezone'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleTimezone(chatId, telegramId, lang);
  });

  async function handleTimezone(chatId, telegramId, lang) {
    try {
      const user = await checkExistingUser(telegramId);
      if (!user) {
        safeSend(chatId, t(lang, 'helpUnregistered'), { parse_mode: 'Markdown' });
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
      safeSend(chatId, timezoneMsg(escapeMd(currentTz), localTime), {
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
      safeSend(chatId, '❌ ' + t(lang, 'timezoneFailed'));
    }
  }

  // /settings command - therapist settings (voice forwarding, etc.)
  onCmd(commandRegex('settings'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);
    await handleBotSettings(chatId, telegramId, lang);
  });

  async function handleBotSettings(chatId, telegramId, lang, editMessageId) {
    try {
      const user = await checkExistingUser(telegramId);
      if (!user || (user.role !== 'therapist' && user.role !== 'superadmin')) {
        safeSend(chatId, t(lang, 'settingsTherapistOnly'));
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
        safeEdit(settingsText, {
          chat_id: chatId,
          message_id: editMessageId,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        safeSend(chatId, settingsText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } catch (error) {
      console.error('Settings command error:', error.message);
      safeSend(chatId, t(lang, 'settingsLoadFailed'));
    }
  }

  // Send timezone confirmation after client registration (shown once)
  function sendTimezoneConfirmation(chatId, lang, tz) {
    const tzMsg = t(lang, 'timezoneDetectedAfterReg');
    safeSend(chatId, tzMsg(escapeMd(tz)), {
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
  onCmd(commandRegex('disconnect'), async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    // Show confirmation prompt
    safeSend(chatId, t(lang, 'disconnectConfirm'), {
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

  // Handle callback queries (role selection + consent + disconnect).
  // `answer(options)` answers the callback query without ever rejecting;
  // the onEvent('callback_query') wrapper below answers it if no branch did.
  async function processCallbackQuery(callbackQuery, answer) {
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
        answer({
          text: newValue ? t(lang, 'settingsForwardEnabled') : t(lang, 'settingsForwardDisabled')
        });
      } catch (err) {
        console.error('Failed to update forward setting:', err.message);
        answer({ text: t(lang, 'settingsUpdateFailed') });
      }
      return;
    }

    // Handle "Change timezone" button shown after registration
    if (data === 'tz_change_after_reg') {
      const lang = await getUserLang(telegramId);
      await handleTimezone(chatId, telegramId, lang);
      answer();
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
      answer();
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
      answer();
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
        // Timezone ids like America/New_York contain "_" — escape for Markdown.
        safeEdit(confirmMsg(escapeMd(selectedTz), localTime), {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        });
        console.log(`[Timezone] User telegram_id=${telegramId} changed timezone to ${selectedTz}`);
      } catch (error) {
        console.error('Timezone update error:', error.message);
        safeSend(chatId, '❌ ' + t(lang, 'timezoneFailed'));
      }
      answer();
      return;
    }

    // Handle disconnect callbacks
    if (data === 'disconnect_yes' || data === 'disconnect_no') {
      const lang = await getUserLang(telegramId);

      if (data === 'disconnect_no') {
        safeSend(chatId, t(lang, 'disconnectCancelled'));
      } else {
        try {
          await api.post('/api/bot/revoke-consent', {
            telegram_id: String(telegramId)
          });
          safeSend(chatId, t(lang, 'disconnected'));
        } catch (error) {
          const errorMsg = error.response?.data?.error || t(lang, 'disconnectFailed');
          safeSend(chatId, `❌ ${errorMsg}`);
        }
      }

      answer();
      return;
    }

    // T-03: Show assignment details + actions (mark done | report).
    if (data.startsWith('assignment_view_')) {
      const assignmentId = data.replace('assignment_view_', '');
      const lang = await getUserLang(telegramId);
      try {
        const result = await api.get(`/api/bot/assignments/${telegramId}`);
        const a = (result.data.assignments || []).find(x => String(x.id) === String(assignmentId));
        if (!a) {
          safeSend(chatId, t(lang, 'assignmentNotFound'));
          answer();
          return;
        }
        const exerciseTitle = a.exercise
          ? (lang === 'ru' ? (a.exercise.title_ru || a.exercise.title_en)
            : lang === 'es' ? (a.exercise.title_es || a.exercise.title_en)
            : lang === 'uk' ? (a.exercise.title_uk || a.exercise.title_en)
            : a.exercise.title_en)
          : null;
        const displayTitle = (a.title && a.title.trim()) ? a.title : (exerciseTitle || t(lang, 'assignmentFallbackTitle')(a.id));
        const freqLabel = t(lang, `assignmentFrequency_${a.report_frequency}`);
        const detailFn = t(lang, 'assignmentDetail');
        const body = detailFn(mdInEntity(displayTitle), escapeMd(a.description), freqLabel, escapeMd(a.deadline));
        safeSend(chatId, body, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: t(lang, 'assignmentReportBtn'), callback_data: `assignment_report_${a.id}` }],
              [{ text: t(lang, 'assignmentCompleteBtn'), callback_data: `assignment_complete_${a.id}` }],
            ],
          },
        });
      } catch (error) {
        const errorMsg = (error.response && error.response.data && error.response.data.error) || t(lang, 'assignmentsFailed');
        safeSend(chatId, `❌ ${errorMsg}`);
      }
      answer();
      return;
    }

    if (data.startsWith('assignment_report_')) {
      const assignmentId = data.replace('assignment_report_', '');
      const lang = await getUserLang(telegramId);
      // T-04: Mark this assignment as "active for the next message" so the
      // next text OR voice message from this client is captured as a
      // progress report tied to the assignment (instead of a diary entry).
      const aidInt = parseInt(assignmentId, 10);
      if (Number.isInteger(aidInt) && aidInt > 0) {
        activeReports[telegramId] = aidInt;
      }
      safeSend(chatId, t(lang, 'assignmentReportPrompt')(assignmentId));
      answer();
      return;
    }

    if (data.startsWith('assignment_complete_')) {
      const assignmentId = data.replace('assignment_complete_', '');
      const lang = await getUserLang(telegramId);
      try {
        await api.post(`/api/bot/assignments/${assignmentId}/complete`, {
          telegram_id: String(telegramId),
        });
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: chatId, message_id: callbackQuery.message.message_id,
          });
        } catch (_) { /* keyboard edit is best-effort */ }
        answer({ text: t(lang, 'assignmentCompletedToast') });
        safeSend(chatId, t(lang, 'assignmentCompletedMsg'));
      } catch (error) {
        const errorMsg = (error.response && error.response.data && error.response.data.error) || t(lang, 'assignmentCompleteFailed');
        answer({ text: errorMsg, show_alert: true });
      }
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
          safeSend(chatId, t(lang, 'exerciseNotFound'));
          answer();
          return;
        }

        const title = localizedField(exercise, 'title', lang) || t(lang, 'exerciseFallbackTitle');
        const instructions = localizedField(exercise, 'instructions', lang);

        const detailMsg = t(lang, 'exerciseDetail');
        safeSend(chatId, detailMsg(mdInEntity(title), escapeMd(exercise.category), escapeMd(instructions)), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: t(lang, 'exerciseStartBtn'), callback_data: `exercise_start_${deliveryId}` }
            ]]
          }
        });
      } catch (error) {
        safeSend(chatId, `❌ ${t(lang, 'exercisesFailed')}`);
      }

      answer();
      return;
    }

    // T-12: Handle "Make private" callback for a freshly-saved diary entry.
    // The therapist will not see entries flagged is_private = 1, so this lets
    // the client retroactively redact a diary entry without deleting it.
    if (data.startsWith('diary_make_private_')) {
      const lang = await getUserLang(telegramId);
      const entryIdStr = data.replace('diary_make_private_', '');
      const entryId = parseInt(entryIdStr, 10);
      if (!Number.isInteger(entryId) || entryId <= 0) {
        answer({ text: t(lang, 'commentMakePrivateFailed') });
        return;
      }
      try {
        const r = await api.post(`/api/bot/diary/${entryId}/make-private`, {
          telegram_id: String(telegramId)
        });
        // Strip the inline keyboard so the client can't tap it twice and to
        // visually confirm the action took effect.
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id
          });
        } catch (e) { /* keyboard edit is best-effort */ }

        const wasAlready = !!(r.data && r.data.already_private);
        const toastKey = wasAlready ? 'commentAlreadyPrivate' : 'commentMadePrivate';
        // Toast confirmation on the inline button itself.
        answer({ text: t(lang, toastKey), show_alert: false });
        // Plus a chat-message confirmation so it's visible after scroll.
        safeSend(chatId, t(lang, toastKey));
      } catch (error) {
        const errorMsg = (error.response && error.response.data && error.response.data.error) || t(lang, 'commentMakePrivateFailed');
        answer({ text: errorMsg, show_alert: true });
      }
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

        safeSend(chatId, t(lang, 'exerciseStarted'));
      } catch (error) {
        const errorMsg = error.response?.data?.error || t(lang, 'exerciseStartFailed');
        safeSend(chatId, `❌ ${errorMsg}`);
      }

      answer();
      return;
    }

    // Handle profile edit callbacks
    if (data === 'profile_edit_name') {
      const lang = await getUserLang(telegramId);
      activeProfileEdits[telegramId] = 'name';
      safeSend(chatId, t(lang, 'profileEnterName'), { parse_mode: 'Markdown' });
      answer();
      return;
    }
    if (data === 'profile_edit_phone') {
      const lang = await getUserLang(telegramId);
      activeProfileEdits[telegramId] = 'phone';
      safeSend(chatId, t(lang, 'profileEnterPhone'), { parse_mode: 'Markdown' });
      answer();
      return;
    }

    // T-18: Handle multi-checkbox consent flow callbacks.
    // - consent_chk_<tid>_<point>: toggle one of the 6 checkboxes
    // - consent_continue_<tid>: submit consent if all 6 are ticked
    // - consent_cancel_<tid>: cancel and clear pending state
    // M22: when the in-memory prompt state is gone (bot restart, 30-min TTL)
    // or belongs to another prompt, the press is answered with consentStale
    // ("send /start again") instead of being silently ignored.
    async function replyConsentStale(lang) {
      try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: chatId, message_id: callbackQuery.message.message_id
        });
      } catch { /* keyboard edit is best-effort */ }
      answer({ text: t(lang, 'consentStale'), show_alert: true });
      await safeSend(chatId, t(lang, 'consentStale'));
    }

    if (data.startsWith('consent_chk_')) {
      const lang = await getUserLang(telegramId);
      // Parse: consent_chk_<therapistId>_<point>
      const rest = data.slice('consent_chk_'.length);
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore < 0) {
        answer();
        return;
      }
      const therapistId = rest.slice(0, lastUnderscore);
      const point = rest.slice(lastUnderscore + 1);
      if (!CONSENT_POINTS.includes(point)) {
        answer();
        return;
      }
      const state = pendingConsents[telegramId];
      if (!state || String(state.therapistId) !== String(therapistId)) {
        await replyConsentStale(lang);
        return;
      }
      state.checked[point] = !state.checked[point];
      try {
        await bot.editMessageReplyMarkup(
          buildConsentKeyboard(lang, therapistId, state.checked),
          { chat_id: chatId, message_id: callbackQuery.message.message_id }
        );
      } catch (e) {
        // Telegram returns "message is not modified" if same markup — ignore.
      }
      answer();
      return;
    }

    if (data.startsWith('consent_continue_')) {
      const lang = await getUserLang(telegramId);
      const therapistId = data.slice('consent_continue_'.length);
      const state = pendingConsents[telegramId];
      if (!state || String(state.therapistId) !== String(therapistId)) {
        await replyConsentStale(lang);
        return;
      }
      const allChecked = CONSENT_POINTS.every(pt => !!state.checked[pt]);
      if (!allChecked) {
        answer({ text: t(lang, 'consentNotAllChecked'), show_alert: true });
        return;
      }
      const isReconsent = state.mode === 'reconsent';
      const body = buildConsentBodyText(lang, state.therapistName);
      const textHash = computeConsentHash(body);
      try {
        // 'linked' (admin link without consent) is a first consent for the
        // therapist the client is already linked to: backend mode 'connect'.
        const result = await api.post('/api/bot/consent', {
          telegram_id: String(telegramId),
          therapist_id: parseInt(therapistId, 10),
          consent: true,
          consent_version: CONSENT_TEXT_VERSION,
          consent_text_hash: textHash,
          mode: isReconsent ? 'reconsent' : 'connect'
        });
        delete pendingConsents[telegramId];
        // Strip the inline keyboard so the user can't double-click checkboxes.
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: chatId, message_id: callbackQuery.message.message_id
          });
        } catch { /* ignore */ }
        if (isReconsent) {
          safeSend(chatId, t(lang, 'consentReconfirmed'), {
            reply_markup: getClientKeyboard(lang)
          });
        } else if (result.data && result.data.linked) {
          safeSend(chatId, t(lang, 'connected'), {
            reply_markup: getClientKeyboard(lang)
          });
        } else {
          safeSend(chatId, t(lang, 'connectionCancelled'));
        }
      } catch (error) {
        // M7: the backend only links to the therapist from this client's own
        // /connect (or the existing link); an expired lookup is "start again".
        if (error.response && error.response.status === 403 && error.response.data && error.response.data.code === 'CONSENT_NOT_PENDING') {
          delete pendingConsents[telegramId];
          await replyConsentStale(lang);
          return;
        }
        // The therapist's account was blocked after the prompt was shown.
        if (error.response && error.response.status === 403 && error.response.data && error.response.data.code === 'THERAPIST_UNAVAILABLE') {
          delete pendingConsents[telegramId];
          try {
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
              chat_id: chatId, message_id: callbackQuery.message.message_id
            });
          } catch { /* ignore */ }
          await sendTherapistUnavailable(chatId, lang, therapistId, state.mode === 'linked');
          answer();
          return;
        }
        const errorMsg = error.response?.data?.error
          || (isReconsent ? t(lang, 'consentReconsentFailed') : t(lang, 'failedConsent'));
        safeSend(chatId, `❌ ${errorMsg}`);
      }
      answer();
      return;
    }

    if (data.startsWith('consent_cancel_')) {
      const lang = await getUserLang(telegramId);
      const therapistId = data.slice('consent_cancel_'.length);
      const state = pendingConsents[telegramId];
      if (!state || String(state.therapistId) !== String(therapistId)) {
        // Unknown prompt (restart / TTL) or an older prompt for another
        // therapist: nothing was linked by it. The CURRENT prompt's state (if
        // any) belongs to another therapist and is left alone.
        await replyConsentStale(lang);
        return;
      }
      try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: chatId, message_id: callbackQuery.message.message_id
        });
      } catch { /* ignore */ }

      if (state.mode === 'linked') {
        // Admin link without consent: Cancel means "I don't want this
        // therapist". Ask before unlinking; only "Yes, disconnect" calls
        // revoke-consent. The prompt state stays so "Back" can reopen it.
        await safeSend(chatId, t(lang, 'linkedDisconnectConfirm')(mdInEntity(state.therapistName)), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: t(lang, 'linkedDisconnectYes'), callback_data: `linked_disconnect_yes_${therapistId}` },
              { text: t(lang, 'linkedDisconnectBack'), callback_data: `linked_disconnect_back_${therapistId}` }
            ]]
          }
        });
        answer();
        return;
      }

      delete pendingConsents[telegramId];
      // Record the decline in audit log via the existing endpoint.
      try {
        await api.post('/api/bot/consent', {
          telegram_id: String(telegramId),
          therapist_id: parseInt(therapistId, 10),
          consent: false,
          consent_version: CONSENT_TEXT_VERSION
        });
      } catch { /* best-effort */ }
      if (state.mode === 'reconsent') {
        // New consent version declined: the link stays, the client stays
        // gated (requireConsentUpToDate re-prompts on the next diary or
        // exercise action) and can /disconnect if they want to leave.
        safeSend(chatId, t(lang, 'consentReconsentDeclined'));
      } else {
        safeSend(chatId, t(lang, 'connectionCancelled'));
      }
      answer();
      return;
    }

    // Admin-linked consent declined -> confirmation answers.
    if (data.startsWith('linked_disconnect_back_')) {
      const lang = await getUserLang(telegramId);
      const therapistId = data.slice('linked_disconnect_back_'.length);
      try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: chatId, message_id: callbackQuery.message.message_id
        });
      } catch { /* ignore */ }
      const user = await checkExistingUser(telegramId).catch(() => null);
      if (!user || String(user.therapist_id) !== String(therapistId) || user.consent_therapist_access) {
        await replyConsentStale(lang);
        return;
      }
      // Reopen the consent prompt for the linked therapist.
      delete pendingConsents[telegramId];
      await requireConsentUpToDate(chatId, telegramId, lang, user);
      answer();
      return;
    }

    if (data.startsWith('linked_disconnect_yes_')) {
      const lang = await getUserLang(telegramId);
      const therapistId = data.slice('linked_disconnect_yes_'.length);
      try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: chatId, message_id: callbackQuery.message.message_id
        });
      } catch { /* ignore */ }
      // Works after a restart too: the decision is checked against the
      // backend, not in-memory state. Only a link to THIS therapist that is
      // still waiting for consent is removed.
      const user = await checkExistingUser(telegramId).catch(() => null);
      if (!user || user.role !== 'client' || String(user.therapist_id) !== String(therapistId) || user.consent_therapist_access) {
        await replyConsentStale(lang);
        return;
      }
      const state = pendingConsents[telegramId];
      if (!state || String(state.therapistId) === String(therapistId)) delete pendingConsents[telegramId];
      try {
        await api.post('/api/bot/consent', {
          telegram_id: String(telegramId),
          therapist_id: parseInt(therapistId, 10),
          consent: false,
          consent_version: CONSENT_TEXT_VERSION
        });
      } catch { /* best-effort audit */ }
      try {
        await api.post('/api/bot/revoke-consent', { telegram_id: String(telegramId) });
        safeSend(chatId, t(lang, 'consentDeclinedUnlinked'));
      } catch (error) {
        safeSend(chatId, `❌ ${t(lang, 'disconnectFailed')}`);
      }
      answer();
      return;
    }

    // Legacy single-button consent callbacks (consent_yes_/consent_no_) from
    // messages sent before the T-18 multi-checkbox flow. Audit M7: they are no
    // longer honoured (consent_yes_<id> could link to any therapist id) —
    // the client is asked to start again, which shows the current flow.
    if (data.startsWith('consent_yes_') || data.startsWith('consent_no_')) {
      const lang = await getUserLang(telegramId);
      await replyConsentStale(lang);
      return;
    }

    // T-405: Handle session reminder confirmation/reschedule/release callbacks
    // Prefixes: confirm_session_<sid>, reschedule_session_<sid>, release_session_<sid>
    if (data.startsWith('confirm_session_') || data.startsWith('reschedule_session_') || data.startsWith('release_session_')) {
      const lang = await getUserLang(telegramId);
      let action, sessionId, footerKey;

      if (data.startsWith('confirm_session_')) {
        sessionId = data.replace('confirm_session_', '');
        action = 'confirm';
        footerKey = 'reminderBotConfirmFooter';
      } else if (data.startsWith('reschedule_session_')) {
        sessionId = data.replace('reschedule_session_', '');
        action = 'request_reschedule';
        footerKey = 'reminderBotRescheduleFooter';
      } else {
        sessionId = data.replace('release_session_', '');
        action = 'release';
        footerKey = 'reminderBotReleaseFooter';
      }

      try {
        await api.post('/api/bot/session-attendance', {
          telegram_user_id: String(telegramId),
          session_id: sessionId,
          action
        });

        const footer = t(lang, footerKey);

        // Remove inline buttons from the reminder message (best-effort)
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id
          });
        } catch (editMarkupErr) {
          // 400 = message not modified or can't be edited — acceptable
        }

        // Append confirmation footer to the original message
        try {
          const originalText = callbackQuery.message.text || '';
          await bot.editMessageText(originalText + '\n\n' + footer, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id
          });
        } catch (editTextErr) {
          // If message can't be edited (e.g. too old), send a new message instead
          await safeSend(chatId, footer);
        }
      } catch (err) {
        console.error(`[SessionReminder] ${action} session_id=${sessionId} failed:`, err.message);
        const errMsg = (err.response && err.response.data && err.response.data.error) || t(lang, 'actionFailedRetry');
        safeSend(chatId, '❌ ' + errMsg);
      }

      answer();
      return;
    }

    // T-405: Handle session reminders opt-in / opt-out callbacks
    if (data === 'optin_session_reminders_ok' || data === 'optin_session_reminders_no') {
      const lang = await getUserLang(telegramId);
      const optIn = data === 'optin_session_reminders_ok';
      const footerKey = optIn ? 'reminderBotOptinOkFooter' : 'reminderBotOptinNoFooter';

      try {
        await api.post('/api/bot/session-reminders-optin', {
          telegram_user_id: String(telegramId),
          action: optIn ? 'opt_in' : 'opt_out'
        });

        const footer = t(lang, footerKey);

        // Remove inline buttons (best-effort)
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id
          });
        } catch (editMarkupErr) {
          // acceptable
        }

        // Append confirmation footer to the original message
        try {
          const originalText = callbackQuery.message.text || '';
          await bot.editMessageText(originalText + '\n\n' + footer, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id
          });
        } catch (editTextErr) {
          // Fall back to a fresh message
          await safeSend(chatId, footer);
        }
      } catch (err) {
        console.error(`[SessionReminder] optin ${data} failed:`, err.message);
        const errMsg = (err.response && err.response.data && err.response.data.error) || t(lang, 'actionFailedRetry');
        safeSend(chatId, '❌ ' + errMsg);
      }

      answer();
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
          safeSend(chatId, alreadyRegistered(result.user.role), {
            reply_markup: getKeyboardForRole(result.user.role, lang)
          });
        } else if (role === 'therapist') {
          const welcomeTherapist = t(lang, 'welcomeTherapist');
          await safeSend(chatId,
            welcomeTherapist(result.user.invite_code),
            { parse_mode: 'Markdown' }
          );
          // Prompt therapist to share phone number via contact button
          pendingPhoneShares[telegramId] = lang;
          safeSend(chatId, t(lang, 'sharePhonePrompt'), {
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
          await safeSend(chatId, t(lang, 'welcomeClient'), {
            reply_markup: getClientKeyboard(lang)
          });
          // Show timezone confirmation for newly registered clients
          sendTimezoneConfirmation(chatId, lang, tz);
        }
      } catch (error) {
        console.error('Registration error:', error.message);
        safeSend(chatId, t(lang, 'registrationError'));
      }

      answer();
    }
  }

  // Entry point for every inline-button press. Guards malformed updates,
  // contains any thrown error, and ALWAYS answers the callback query exactly
  // once (so the Telegram client never shows a spinner forever).
  onEvent('callback_query', async (callbackQuery) => {
    let answered = false;
    const answer = (options) => {
      answered = true;
      return safeAnswer(callbackQuery.id, options);
    };
    try {
      if (!callbackQuery || !callbackQuery.id || typeof callbackQuery.data !== 'string' || !callbackQuery.data) return;
      if (!callbackQuery.message || !callbackQuery.message.chat || !isPrivateChat(callbackQuery.message.chat)) return;
      await processCallbackQuery(callbackQuery, answer);
    } catch (err) {
      console.error('[callback_query] handler error:', redact(err && err.message));
    } finally {
      if (!answered && callbackQuery && callbackQuery.id) {
        await safeAnswer(callbackQuery.id);
      }
    }
  });

  // Helper: send email prompt during registration
  function sendEmailPrompt(chatId, telegramId, lang) {
    pendingEmailInputs[telegramId] = lang;
    safeSend(chatId, t(lang, 'shareEmailPrompt'), {
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
    safeSend(chatId, t(lang, 'shareOtherInfoPrompt'), {
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
  onEvent('contact', async (msg) => {
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

      await safeSend(chatId, t(lang, 'sharePhoneSaved'));
      // Proceed to email step
      sendEmailPrompt(chatId, telegramId, lang);
    } catch (error) {
      console.error('Failed to save shared phone:', error.message);
      delete pendingPhoneShares[telegramId];
      await safeSend(chatId, t(lang, 'profileSaveFailed'));
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
   * T-12: Build the inline keyboard offering "Make private" right after the
   * client saves a diary entry. The therapist will not see entries the client
   * marks private. Returns null when no entry id is available.
   */
  function makePrivateKeyboard(entryId, lang) {
    if (!entryId) return null;
    return {
      inline_keyboard: [[
        {
          text: t(lang, 'commentMakePrivate'),
          callback_data: 'diary_make_private_' + entryId
        }
      ]]
    };
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
      // Caption in the THERAPIST's language (getUserLang takes a Telegram id).
      const therapistLang = await getUserLang(forwardInfo.therapist_telegram_id);
      const caption = t(therapistLang, entryType === 'video' ? 'forwardCaptionVideo' : 'forwardCaptionVoice')(forwardInfo.client_name, timestamp);

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
        // M24: never buffer more than Telegram's 20 MB bot download limit.
        const response = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          maxContentLength: MAX_TELEGRAM_DOWNLOAD_BYTES
        });
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

  // Voice / video / video-note diary entries (clients only). One shared
  // handler; per-kind settings below.
  // Audit M24:
  //  - file_size is checked BEFORE downloading (Telegram bots cannot fetch
  //    files over 20 MB) -> localized mediaTooLarge;
  //  - a failed download is reported as a failure (it used to be saved as an
  //    audio-less entry and answered "saved, transcribing");
  //  - a backend size rejection (413 / *_TOO_LARGE code) -> mediaTooLarge;
  //  - at most MAX_CONCURRENT_MEDIA downloads+uploads run at once.
  const mediaSlots = createSemaphore(MAX_CONCURRENT_MEDIA);
  const MEDIA_KINDS = {
    voice: {
      field: 'voice', entryType: 'voice', defaultExt: '.ogg', extFromPath: false,
      label: 'Voice message', therapistKey: 'therapistVoiceText',
      savedKey: 'voiceSavedTranscribing', failedKey: 'failedVoiceDiary', reportable: true
    },
    video: {
      field: 'video', entryType: 'video', defaultExt: '.mp4', extFromPath: true,
      label: 'Video message', therapistKey: 'therapistVideoText',
      savedKey: 'videoSavedTranscribing', failedKey: 'failedVideoDiary', reportable: false
    },
    video_note: {
      field: 'video_note', entryType: 'video', defaultExt: '.mp4', extFromPath: false,
      label: 'Video note', therapistKey: 'therapistVideoText',
      savedKey: 'videoSavedTranscribing', failedKey: 'failedVideoDiary', reportable: false
    }
  };

  async function handleMediaDiary(msg, kindName) {
    const kind = MEDIA_KINDS[kindName];
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    try {
      // Check user role - only clients can create diary entries
      const user = await checkExistingUser(telegramId);
      if (user && user.role !== 'client') {
        safeSend(chatId, t(lang, kind.therapistKey));
        return;
      }
      // T-18: Block diary intake if the client's consent is outdated/missing.
      // requireConsentUpToDate() sends the consent prompt + returns false.
      if (!(await requireConsentUpToDate(chatId, telegramId, lang, user))) return;

      const media = msg[kind.field] || {};
      const fileId = media.file_id;
      const duration = media.duration;

      if (isFileTooLarge(media.file_size)) {
        console.warn(`[media] ${kindName} from ${telegramId} rejected before download: ${media.file_size} bytes`);
        safeSend(chatId, t(lang, 'mediaTooLarge'));
        return;
      }

      await mediaSlots.run(async () => {
        const downloaded = await downloadTelegramFile(fileId);
        if (!downloaded || !downloaded.buffer) {
          console.warn(`[media] ${kindName} download failed for file_id ${fileId} - nothing saved`);
          safeSend(chatId, `❌ ${t(lang, 'mediaDownloadFailed')}`);
          return;
        }
        if (isFileTooLarge(downloaded.buffer.length)) {
          safeSend(chatId, t(lang, 'mediaTooLarge'));
          return;
        }
        console.log(`Downloaded ${kindName} file: ${downloaded.buffer.length} bytes`);

        let fileExt = kind.defaultExt;
        if (kind.extFromPath && downloaded.filePath) {
          const ext = downloaded.filePath.split('.').pop();
          if (ext && ext.length <= 5) fileExt = '.' + ext;
        }
        const fileData = downloaded.buffer.toString('base64');
        const content = `[${kind.label}, duration: ${duration}s]`;

        // T-04: If the client is in "writing report" mode, route the voice
        // message to the assignment-report endpoint instead of saving as a
        // diary entry. The server will run the same Whisper pipeline.
        if (kind.reportable && activeReports[telegramId]) {
          const assignmentId = activeReports[telegramId];
          delete activeReports[telegramId];
          try {
            await api.post(`/api/bot/assignments/${assignmentId}/reports`, {
              telegram_id: String(telegramId),
              report_type: 'voice',
              content,
              file_ref: fileId,
              file_data: fileData,
              file_ext: fileExt,
            });
            safeSend(chatId, t(lang, 'reportVoiceSaved'));
          } catch (error) {
            if (isPayloadTooLargeError(error)) {
              safeSend(chatId, t(lang, 'mediaTooLarge'));
              return;
            }
            const errorMsg = error.response?.data?.error || t(lang, 'reportFailed');
            safeSend(chatId, `❌ ${errorMsg}`);
          }
          return;
        }

        // Submit diary entry via backend API (auto-transcription is triggered server-side)
        const result = await api.post('/api/bot/diary', {
          telegram_id: String(telegramId),
          entry_type: kind.entryType,
          content,
          file_ref: fileId,
          file_data: fileData,
          file_ext: fileExt
        });

        // Check if audio file was stored successfully
        if (result.data && result.data.entry && !result.data.entry.has_audio_file) {
          console.warn(`Audio file was not stored for ${kindName} entry ${result.data.entry.id}`);
        }

        // Notify user that transcription is in progress + offer T-12 "Make private"
        const entryId = result.data && result.data.entry ? result.data.entry.id : null;
        const kb = makePrivateKeyboard(entryId, lang);
        safeSend(chatId, t(lang, kind.savedKey), kb ? { reply_markup: kb } : {});

        // Forward to therapist if enabled
        if (result.data && result.data.forward_voice) {
          forwardVoiceToTherapist(result.data.forward_voice, fileId, kind.entryType, chatId);
        }
      });
    } catch (error) {
      if (isPayloadTooLargeError(error)) {
        safeSend(chatId, t(lang, 'mediaTooLarge'));
        return;
      }
      const errorMsg = error.response?.data?.error || t(lang, kind.failedKey);
      safeSend(chatId, `❌ ${errorMsg}`);
    }
  }

  onEvent('voice', (msg) => handleMediaDiary(msg, 'voice'));
  onEvent('video', (msg) => handleMediaDiary(msg, 'video'));
  onEvent('video_note', (msg) => handleMediaDiary(msg, 'video_note'));

  // T-21: Handle photo messages (feature #379)
  // ------------------------------------------
  // Clients can attach photos to a freeform progress report by entering
  // the report flow first (`/report` or tapping the "Write report" button)
  // and then sending a photo. The handler:
  //   1. Looks up the assignment armed in activeReports[telegramId]
  //   2. Finds the most recent report on that assignment (created by the
  //      client when they sent a text/voice message), OR creates a stub
  //      text report if none exists yet, then attaches the photo.
  //   3. Posts the encrypted photo bytes via the bot API.
  //
  // Outside of the /report context, we politely tell the client what to do.
  onEvent('photo', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    try {
      const user = await checkExistingUser(telegramId);
      if (user && user.role !== 'client') {
        safeSend(chatId, t(lang, 'reportPhotoTherapist'));
        return;
      }
      if (!(await requireConsentUpToDate(chatId, telegramId, lang, user))) return;

      // Only handle photos when the client is in the report flow.
      const armedAssignmentId = activeReports[telegramId];
      if (!armedAssignmentId) {
        safeSend(chatId, t(lang, 'reportPhotoIdleHint'));
        return;
      }

      // Telegram sends an array of photo sizes — pick the largest (last).
      const photos = Array.isArray(msg.photo) ? msg.photo : [];
      if (photos.length === 0) {
        safeSend(chatId, t(lang, 'reportPhotoMissing'));
        return;
      }
      const largest = photos[photos.length - 1];
      const fileId = largest.file_id;

      // Download the bytes from Telegram.
      let downloaded = null;
      try {
        downloaded = await downloadTelegramFile(fileId);
      } catch (dlErr) {
        console.error('[T-21] Photo download failed:', dlErr.message);
      }
      if (!downloaded || !downloaded.buffer) {
        safeSend(chatId, `❌ ${t(lang, 'reportPhotoFailed')}`);
        return;
      }
      // Telegram resizes/converts photos to JPEG.
      let fileExt = '.jpg';
      if (downloaded.filePath) {
        const guessed = downloaded.filePath.split('.').pop();
        if (guessed && guessed.length <= 5) fileExt = '.' + guessed.toLowerCase();
      }
      const mimeByExt = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      };
      const mimeType = mimeByExt[fileExt] || 'image/jpeg';

      // Find an existing report on the armed assignment to attach to. If
      // none exists yet (the client armed the flow but hasn't sent text
      // or voice first), create a small stub text report so the photo has
      // a parent. We keep the assignment armed so the next text/voice
      // message becomes a proper report on the same parent assignment.
      let reportId = null;
      try {
        const list = await api.get(`/api/bot/assignments/${armedAssignmentId}/reports`, {
          params: { telegram_id: String(telegramId) },
        });
        const reports = (list.data && list.data.reports) || [];
        if (reports.length > 0) {
          // Newest first (the GET returns ASC; pick the last one).
          reportId = reports[reports.length - 1].id;
        }
      } catch (listErr) {
        console.error('[T-21] Failed to list reports for attachment:', listErr.message);
      }

      if (!reportId) {
        // Create a stub text report to hang the photo on.
        try {
          const created = await api.post(`/api/bot/assignments/${armedAssignmentId}/reports`, {
            telegram_id: String(telegramId),
            report_type: 'text',
            content: t(lang, 'reportPhotoStubContent'),
          });
          reportId = created.data && created.data.report && created.data.report.id;
        } catch (createErr) {
          const errorMsg = createErr.response?.data?.error || t(lang, 'reportPhotoFailed');
          safeSend(chatId, `❌ ${errorMsg}`);
          return;
        }
      }

      if (!reportId) {
        safeSend(chatId, `❌ ${t(lang, 'reportPhotoFailed')}`);
        return;
      }

      // Upload the photo bytes (encrypted server-side, opaque file_ref).
      try {
        await api.post(
          `/api/bot/assignments/${armedAssignmentId}/reports/${reportId}/attachments`,
          {
            telegram_id: String(telegramId),
            file_data: downloaded.buffer.toString('base64'),
            file_ext: fileExt,
            mime_type: mimeType,
          }
        );
        safeSend(chatId, t(lang, 'reportPhotoSaved'));
      } catch (uploadErr) {
        const errorMsg = uploadErr.response?.data?.error || t(lang, 'reportPhotoFailed');
        safeSend(chatId, `❌ ${errorMsg}`);
      }
    } catch (error) {
      console.error('[T-21] Photo handler error:', error.message);
      safeSend(chatId, `❌ ${t(lang, 'reportPhotoFailed')}`);
    }
  });

  // Handle text messages as diary entries, exercise responses, or keyboard button presses
  onEvent('message', async (msg) => {
    // Skip commands and non-text messages
    if (!msg.text || msg.text.startsWith('/') || msg.voice || msg.video || msg.video_note || msg.photo) return;

    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const lang = await getUserLang(telegramId);

    // SOS keyboard button: handled FIRST, before any backend lookup, exactly
    // like /sos. If the backend is slow/down the user must still get either
    // the confirmation or sosFailed (with emergency numbers) — never fall
    // through to the diary path. handleSos needs no user lookup. The button
    // label itself tells us the language if the cached/looked-up one is unreliable.
    if (BUTTON_ACTION_MAP[msg.text] === 'sos') {
      const labelLang = ['en', 'ru', 'es', 'uk'].find((l) => t(l, 'btnSOS') === msg.text);
      await handleSos(chatId, telegramId, userLangCache[telegramId] || labelLang || lang, '');
      return;
    }

    // Check if this is a "Skip" response for phone sharing
    if (pendingPhoneShares[telegramId]) {
      const skipTexts = ['en', 'ru', 'es', 'uk'].map(l => t(l, 'sharePhoneSkip'));
      if (skipTexts.includes(msg.text)) {
        delete pendingPhoneShares[telegramId];
        await safeSend(chatId, t(lang, 'sharePhoneSkipped'));
        // Proceed to email step
        sendEmailPrompt(chatId, telegramId, lang);
        return;
      }
    }

    // Check if this is an email input or skip during registration.
    // Audit M8: the address is only PENDING on the backend until the 6-digit
    // code mailed to it is typed back here (pendingEmailCodes step below).
    const emailSkipKeyboard = {
      reply_markup: {
        keyboard: [[{ text: t(lang, 'shareEmailSkip') }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
    const emailSkipTexts = ['en', 'ru', 'es', 'uk'].map(l => t(l, 'shareEmailSkip'));

    if (pendingEmailInputs[telegramId]) {
      if (emailSkipTexts.includes(msg.text)) {
        delete pendingEmailInputs[telegramId];
        await safeSend(chatId, t(lang, 'shareEmailSkipped'));
        // Proceed to other info step
        sendOtherInfoPrompt(chatId, telegramId, lang);
        return;
      }
      // Validate email format
      const emailText = msg.text.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailText)) {
        safeSend(chatId, t(lang, 'shareEmailInvalid'), emailSkipKeyboard);
        return;
      }
      // Ask the backend to mail a confirmation code to the address
      try {
        const res = await api.put(`/api/bot/profile/${telegramId}`, { email: emailText });
        delete pendingEmailInputs[telegramId];
        pendingEmailCodes[telegramId] = lang;
        const ttl = (res.data && res.data.ttl_min) || 15;
        safeSend(chatId, t(lang, 'shareEmailCodeSent')(emailText, ttl), emailSkipKeyboard);
      } catch (error) {
        const status = error.response && error.response.status;
        if (status === 400) {
          safeSend(chatId, t(lang, 'shareEmailInvalid'), emailSkipKeyboard);
        } else if (status === 429) {
          delete pendingEmailInputs[telegramId];
          await safeSend(chatId, t(lang, 'shareEmailCodeRateLimited'));
          sendOtherInfoPrompt(chatId, telegramId, lang);
        } else {
          console.error('Failed to save email:', error.message);
          delete pendingEmailInputs[telegramId];
          await safeSend(chatId, t(lang, 'profileSaveFailed'));
          // Still proceed to other info step
          sendOtherInfoPrompt(chatId, telegramId, lang);
        }
      }
      return;
    }

    // M8: waiting for the 6-digit code from the confirmation email
    if (pendingEmailCodes[telegramId]) {
      if (emailSkipTexts.includes(msg.text)) {
        delete pendingEmailCodes[telegramId];
        await safeSend(chatId, t(lang, 'shareEmailSkipped'));
        sendOtherInfoPrompt(chatId, telegramId, lang);
        return;
      }
      const codeText = msg.text.trim();
      if (!/^\d{6}$/.test(codeText)) {
        safeSend(chatId, t(lang, 'shareEmailCodeReminder'), emailSkipKeyboard);
        return;
      }
      try {
        await api.post(`/api/bot/profile/${telegramId}/confirm-email`, {
          telegram_id: String(telegramId),
          code: codeText
        });
        delete pendingEmailCodes[telegramId];
        await safeSend(chatId, t(lang, 'shareEmailSaved'));
        sendOtherInfoPrompt(chatId, telegramId, lang);
      } catch (error) {
        const data = (error.response && error.response.data) || {};
        if (data.code === 'CODE_INVALID') {
          safeSend(chatId, t(lang, 'shareEmailCodeInvalid')(data.attempts_left), emailSkipKeyboard);
        } else if (data.code === 'EMAIL_TAKEN') {
          delete pendingEmailCodes[telegramId];
          pendingEmailInputs[telegramId] = lang;
          safeSend(chatId, t(lang, 'shareEmailTaken'), emailSkipKeyboard);
        } else if (data.code === 'CODE_EXPIRED' || data.code === 'CODE_ATTEMPTS_EXCEEDED') {
          delete pendingEmailCodes[telegramId];
          pendingEmailInputs[telegramId] = lang;
          safeSend(chatId, t(lang, 'shareEmailCodeExpired'), emailSkipKeyboard);
        } else {
          console.error('Failed to confirm email:', error.message);
          delete pendingEmailCodes[telegramId];
          await safeSend(chatId, t(lang, 'profileSaveFailed'));
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
        safeSend(chatId, t(lang, 'shareOtherInfoSkipped'), {
          reply_markup: getTherapistKeyboard(lang)
        });
        return;
      }
      // Save other_info text
      try {
        const otherInfoText = msg.text.trim();
        if (otherInfoText.length > 1000) {
          safeSend(chatId, t(lang, 'otherInfoTooLong'), {
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
        safeSend(chatId, t(lang, 'shareOtherInfoSaved'), {
          reply_markup: getTherapistKeyboard(lang)
        });
      } catch (error) {
        console.error('Failed to save other_info:', error.message);
        delete pendingOtherInfoInputs[telegramId];
        safeSend(chatId, t(lang, 'profileSaveFailed'), {
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
            safeSend(chatId, t(lang, 'diaryHint'), {
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
            safeSend(chatId, t(lang, 'dashboardLink'), {
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
        safeSend(chatId, t(lang, 'therapistFreeText'));
        return;
      }
      // T-18: Re-consent gate. If the client's stored consent_version is
      // below CONSENT_TEXT_VERSION, this sends the re-consent disclaimer
      // and aborts the current text handling. Skipped for therapists by
      // role check above and for unconnected clients by the helper itself.
      if (!(await requireConsentUpToDate(chatId, telegramId, lang, user))) return;

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
            safeSend(chatId, t(lang, 'profileNameSaved'));
          } else if (editType === 'phone') {
            await api.put(`/api/bot/profile/${telegramId}`, { phone: msg.text.trim() });
            safeSend(chatId, t(lang, 'profilePhoneSaved'));
          }
        } catch (error) {
          safeSend(chatId, `❌ ${t(lang, 'profileSaveFailed')}`);
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
          safeSend(chatId, t(lang, 'exerciseCompleted'));
          return;
        } catch (error) {
          delete activeExercises[telegramId];
          // M23: consent revoked / moved to another therapist since the
          // exercise was sent — the backend stored and forwarded nothing.
          if (error.response && error.response.data && error.response.data.code === 'CONSENT_REVOKED') {
            safeSend(chatId, t(lang, 'exerciseConsentRevoked'));
            return;
          }
          const errorMsg = error.response?.data?.error || t(lang, 'exerciseCompleteFailed');
          safeSend(chatId, `❌ ${errorMsg}`);
          return;
        }
      }

      // T-04: If user is in "writing a report" mode, route this text to the
      // assignment report endpoint instead of saving as a diary entry. One-shot.
      if (activeReports[telegramId]) {
        const assignmentId = activeReports[telegramId];
        delete activeReports[telegramId];
        try {
          await api.post(`/api/bot/assignments/${assignmentId}/reports`, {
            telegram_id: String(telegramId),
            report_type: 'text',
            content: msg.text,
          });
          safeSend(chatId, t(lang, 'reportSaved'));
          return;
        } catch (error) {
          const errorMsg = error.response?.data?.error || t(lang, 'reportFailed');
          safeSend(chatId, `❌ ${errorMsg}`);
          return;
        }
      }

      // Default: save as diary entry
      const diaryResult = await api.post('/api/bot/diary', {
        telegram_id: String(telegramId),
        entry_type: 'text',
        content: msg.text
      });

      // T-12: offer "Make private" inline keyboard right next to "Saved!"
      const textEntryId = diaryResult.data && diaryResult.data.entry ? diaryResult.data.entry.id : null;
      const textKb = makePrivateKeyboard(textEntryId, lang);
      safeSend(chatId, t(lang, 'diarySaved'), textKb ? { reply_markup: textKb } : {});
    } catch (error) {
      const errorMsg = error.response?.data?.error || t(lang, 'failedDiary');
      safeSend(chatId, `❌ ${errorMsg}`);
    }
  });

  // 409 Conflict = another instance is polling with the same token (e.g. an
  // overlapping deploy or a local dev bot). Retrying immediately just makes
  // both instances fight in a tight loop, so pause polling and retry later.
  const POLLING_CONFLICT_BACKOFF_MS = 30000;
  let pollingConflictBackoff = false;
  bot.on('polling_error', (error) => {
    const message = redact(error && error.message);
    const isConflict = /ETELEGRAM: 409/.test(message) || (error && error.response && error.response.statusCode === 409);
    if (!isConflict) {
      console.error('Polling error:', error && error.code, message);
      return;
    }
    if (pollingConflictBackoff || shuttingDown) return;
    pollingConflictBackoff = true;
    console.warn(`[bot] 409 Conflict: another bot instance is polling with this token. ` +
      `Pausing polling for ${POLLING_CONFLICT_BACKOFF_MS / 1000}s; make sure only one instance runs.`);
    Promise.resolve(bot.stopPolling()).catch(() => {}).then(() => {
      setTimeout(() => {
        pollingConflictBackoff = false;
        if (shuttingDown) return;
        console.log('[bot] Resuming polling after 409 backoff...');
        Promise.resolve(bot.startPolling()).catch((err) => {
          console.error('[bot] Failed to resume polling:', redact(err && err.message));
        });
      }, POLLING_CONFLICT_BACKOFF_MS);
    });
  });

  // === Heartbeat for the container healthcheck ===
  // Every 30 s, while polling is healthy, rewrite HEARTBEAT_FILE
  // (BOT_HEARTBEAT_FILE, default /tmp/bot-heartbeat). "Healthy" = polling is
  // on and a getUpdates long-poll (10 s timeout) succeeded within the last
  // 90 s (node-telegram-bot-api stamps _polling._lastUpdate on every
  // successful getUpdates). A stale file means the bot is stuck or cannot
  // reach Telegram; the healthcheck only compares the file's mtime.
  const HEARTBEAT_INTERVAL_MS = 30000;
  const HEARTBEAT_MAX_POLL_AGE_MS = 90000;
  let heartbeatErrorLogged = false;
  function pollingHealthy() {
    if (shuttingDown) return false;
    const poller = bot._polling;
    const lastUpdate = poller && typeof poller._lastUpdate === 'number' ? poller._lastUpdate : null;
    if (lastUpdate !== null) {
      return lastUpdate > 0 && (Date.now() - lastUpdate) < HEARTBEAT_MAX_POLL_AGE_MS;
    }
    return typeof bot.isPolling === 'function' ? bot.isPolling() : false;
  }
  function heartbeatTick() {
    if (!pollingHealthy()) return;
    try {
      writeHeartbeat(HEARTBEAT_FILE);
      heartbeatErrorLogged = false;
    } catch (err) {
      if (!heartbeatErrorLogged) {
        console.warn(`[bot] heartbeat write to ${HEARTBEAT_FILE} failed:`, redact(err && err.message));
        heartbeatErrorLogged = true;
      }
    }
  }
  setTimeout(heartbeatTick, 15000).unref();
  setInterval(heartbeatTick, HEARTBEAT_INTERVAL_MS).unref();

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
module.exports = {
  registerUser, checkExistingUser, api, escapeMd, mdInEntity, stripMd, commandRegex, redact,
  // Audit wave 3 (track N) helpers, exported for unit tests
  createTtlState, sweepAllStates, isFileTooLarge, isPayloadTooLargeError, createSemaphore,
  localizedField, buildMenuCommands, writeHeartbeat, HEARTBEAT_FILE, MAX_TELEGRAM_DOWNLOAD_BYTES
};
