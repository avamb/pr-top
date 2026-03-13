// i18n Middleware - Attaches locale to request based on user preference or Accept-Language header
// Usage: app.use(i18nMiddleware) then access req.locale in route handlers

const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../i18n');

/**
 * Middleware that determines the user's preferred language and attaches it to req.locale
 * Priority order:
 * 1. User's DB language preference (if authenticated and available via req.user)
 * 2. Accept-Language header
 * 3. Default language ('en')
 */
function i18nMiddleware(req, res, next) {
  let locale = DEFAULT_LANGUAGE;

  // Check authenticated user's language preference first
  if (req.user && req.user.language && SUPPORTED_LANGUAGES.includes(req.user.language)) {
    locale = req.user.language;
  }
  // Fall back to Accept-Language header
  else {
    const acceptLang = req.headers['accept-language'];
    if (acceptLang) {
      // Parse Accept-Language: e.g., "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
      const parsed = acceptLang
        .split(',')
        .map(part => {
          const [lang, qPart] = part.trim().split(';');
          const q = qPart ? parseFloat(qPart.split('=')[1]) : 1;
          const code = lang.split('-')[0].toLowerCase();
          return { code, q };
        })
        .filter(item => SUPPORTED_LANGUAGES.includes(item.code))
        .sort((a, b) => b.q - a.q);

      if (parsed.length > 0) {
        locale = parsed[0].code;
      }
    }
  }

  req.locale = locale;
  next();
}

module.exports = { i18nMiddleware };
