import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'es', label: 'Espa\u00F1ol', flag: '\u{1F1EA}\u{1F1F8}' }
];

/**
 * Compact language switcher dropdown.
 * On change: updates i18n, localStorage, and optionally PATCHes /api/profile/language.
 *
 * @param {object} props
 * @param {'light'|'dark'} props.variant - 'light' for dark backgrounds, 'dark' for light backgrounds
 * @param {boolean} props.compact - if true, shows only flag + code
 * @param {boolean} props.persistToServer - if true, sends PATCH to save language in DB
 */
export default function LanguageSwitcher({ variant = 'dark', compact = false, persistToServer = false, dropUp = false }) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (langCode) => {
    if (langCode === i18n.language) {
      setIsOpen(false);
      return;
    }

    // Update i18n and localStorage immediately
    i18n.changeLanguage(langCode);
    localStorage.setItem('app_language', langCode);
    setIsOpen(false);

    // Persist to server if user is logged in
    if (persistToServer) {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await fetch('/api/profile/language', {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language: langCode })
          });
          // Update stored user object
          try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            storedUser.language = langCode;
            localStorage.setItem('user', JSON.stringify(storedUser));
          } catch (e) { /* ignore */ }
        }
      } catch (e) {
        // Silently fail - language is already updated in UI
      }
    }
  };

  const isLight = variant === 'light';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
          isLight
            ? 'text-white/80 hover:text-white hover:bg-white/10'
            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
        }`}
        aria-label="Change language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-base">{currentLang.flag}</span>
        <span>{compact ? currentLang.code.toUpperCase() : currentLang.label}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Available languages"
          className={`absolute z-50 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 right-0 ${dropUp ? 'bottom-full mb-1' : 'mt-1'}`}
        >
          {LANGUAGES.map(lang => (
            <li key={lang.code}>
              <button
                role="option"
                aria-selected={lang.code === i18n.language}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  lang.code === i18n.language
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.label}</span>
                {lang.code === i18n.language && (
                  <svg className="w-4 h-4 ml-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
