// Persistent reply keyboard layouts for PR-TOP Telegram bot
// Client: 6 buttons (3 rows x 2), Therapist: 2 buttons (1 row)

const { t } = require('./i18n');

/**
 * Get persistent reply keyboard for client role
 * @param {string} lang - Language code (en, ru, es, uk)
 * @returns {object} reply_markup object for Telegram API
 */
function getClientKeyboard(lang) {
  return {
    keyboard: [
      [t(lang, 'btnDiary'), t(lang, 'btnExercises')],
      [t(lang, 'btnHistory'), t(lang, 'btnSOS')],
      [t(lang, 'btnProfile'), t(lang, 'btnHelp')]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

/**
 * Get persistent reply keyboard for therapist role
 * @param {string} lang - Language code (en, ru, es, uk)
 * @returns {object} reply_markup object for Telegram API
 */
function getTherapistKeyboard(lang) {
  return {
    keyboard: [
      [t(lang, 'btnOpenDashboard'), t(lang, 'btnHelp')]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

/**
 * Get the appropriate keyboard based on user role
 * @param {string} role - 'client' or 'therapist'
 * @param {string} lang - Language code
 * @returns {object} reply_markup object
 */
function getKeyboardForRole(role, lang) {
  return role === 'therapist' ? getTherapistKeyboard(lang) : getClientKeyboard(lang);
}

/**
 * Build a map of all possible button texts (across all languages) to their action identifiers.
 * Used to match incoming reply keyboard button presses to actions.
 */
function buildButtonActionMap() {
  const languages = ['en', 'ru', 'es', 'uk'];
  const map = {};

  for (const lang of languages) {
    map[t(lang, 'btnDiary')] = 'diary';
    map[t(lang, 'btnExercises')] = 'exercises';
    map[t(lang, 'btnHistory')] = 'history';
    map[t(lang, 'btnSOS')] = 'sos';
    map[t(lang, 'btnProfile')] = 'profile';
    map[t(lang, 'btnHelp')] = 'help';
    map[t(lang, 'btnOpenDashboard')] = 'open_dashboard';
  }

  return map;
}

// Pre-build the action map at module load
const BUTTON_ACTION_MAP = buildButtonActionMap();

module.exports = {
  getClientKeyboard,
  getTherapistKeyboard,
  getKeyboardForRole,
  BUTTON_ACTION_MAP
};
