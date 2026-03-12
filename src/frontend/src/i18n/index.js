import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ru from './ru.json';
import es from './es.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      es: { translation: es }
    },
    lng: localStorage.getItem('app_language') || (() => {
      // Detect browser locale and map to supported language
      const browserLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
      return ['en', 'ru', 'es'].includes(browserLang) ? browserLang : 'en';
    })(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
