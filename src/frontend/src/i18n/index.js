import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

// Only English (the fallback language) is bundled eagerly. ru/es/uk are
// separate chunks that are fetched on demand, the first time that language
// becomes active (initial load or runtime language switch).
const LOADERS = {
  ru: () => import('./ru.json'),
  es: () => import('./es.json'),
  uk: () => import('./uk.json')
};

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

  // 1. URL locale prefix (e.g. /ru, /ru/, /ru/privacy, /ru/confirm → 'ru').
  //    Matches both the /confirm signup funnel (F411) and the public marketing
  //    locale tree (F11 — /ru/, /uk/security/*, /es/privacy, ...).
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const urlLocaleMatch = path.match(/^\/(ru|es|uk)(\/|$)/);
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
      en: { translation: en }
    },
    // Start in the fallback language synchronously; the detected language is
    // activated below once its bundle is in memory, so no component ever
    // renders a half-translated page.
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

async function ensureBundle(lng) {
  const base = typeof lng === 'string' ? lng.split('-')[0] : lng;
  if (!LOADERS[base] || i18n.hasResourceBundle(base, 'translation')) return;
  const mod = await LOADERS[base]();
  i18n.addResourceBundle(base, 'translation', mod.default, true, true);
}

// Every language switch (LocaleSync, LanguageSwitcher, confirm funnel, ...)
// goes through changeLanguage(); load the bundle first so the switch is atomic.
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng, ...rest) => {
  try {
    await ensureBundle(lng);
  } catch (err) {
    // Network failure: fall back to English rather than failing the switch.
    console.warn('[i18n] could not load language bundle', lng, err);
  }
  return originalChangeLanguage(lng, ...rest);
};

/**
 * Resolves once the initially detected language is active. main.jsx awaits it
 * before hydrating/rendering so the first paint is already translated.
 */
export const i18nReady = i18n.changeLanguage(getInitialLanguage());

export default i18n;
