import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ru from './ru.json';
import es from './es.json';
import uk from './uk.json';

/**
 * Detect the initial language for i18n.
 * Priority: URL locale prefix > localStorage > browser language
 *
 * The /ru/confirm, /es/confirm, /uk/confirm routes carry the locale in the URL.
 * We read the URL synchronously at module-load time so i18n initializes in the
 * correct language before any React component renders.
 */
function getInitialLanguage() {
  const supported = ['en', 'ru', 'es', 'uk'];

  // 1. URL locale prefix (e.g. /ru/confirm → 'ru')
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const urlLocaleMatch = path.match(/^\/(ru|es|uk)\//);
  if (urlLocaleMatch && supported.includes(urlLocaleMatch[1])) {
    return urlLocaleMatch[1];
  }

  // 2. localStorage preference
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('app_language') : null;
  if (stored && supported.includes(stored)) {
    return stored;
  }

  // 3. Browser language detection
  const browserLang = (
    (typeof navigator !== 'undefined' ? (navigator.language || navigator.userLanguage) : '') || 'en'
  ).split('-')[0];
  return supported.includes(browserLang) ? browserLang : 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      es: { translation: es },
      uk: { translation: uk }
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
