// Backend i18n - Translation helper for API responses
// Supports: en, ru, es
// Usage: const { t } = require('./i18n'); t('auth.invalidCredentials', 'ru')

const en = require('./en.json');
const ru = require('./ru.json');
const es = require('./es.json');

const translations = { en, ru, es };
const SUPPORTED_LANGUAGES = ['en', 'ru', 'es'];
const DEFAULT_LANGUAGE = 'en';

/**
 * Get a translated message for a given key and locale
 * @param {string} key - Dot-separated key path (e.g., 'auth.invalidCredentials')
 * @param {string} locale - Language code ('en', 'ru', 'es')
 * @param {object} params - Optional interpolation parameters (e.g., { count: 5 })
 * @returns {string} Translated message, falls back to English if key not found
 */
function t(key, locale, params) {
  const lang = SUPPORTED_LANGUAGES.includes(locale) ? locale : DEFAULT_LANGUAGE;

  // Navigate the key path
  const keys = key.split('.');
  let value = translations[lang];
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }

  // Fallback to English
  if (value === undefined) {
    value = translations[DEFAULT_LANGUAGE];
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }
  }

  // If still not found, return the key itself
  if (value === undefined) return key;

  // Simple parameter interpolation: {{paramName}}
  if (params && typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
      return params[paramName] !== undefined ? String(params[paramName]) : match;
    });
  }

  return value;
}

module.exports = { t, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
