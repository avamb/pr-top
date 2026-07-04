import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackUmamiEvent } from '../utils/umami';
import { PUBLIC_MARKETING_PATHS, LOCALES } from '../seo/routes.mjs';

/**
 * F12 - Strip any /ru, /uk, /es prefix from a pathname, returning the
 * canonical English base path ("/", "/privacy", "/security/gdpr", ...).
 */
function stripLocalePrefix(pathname) {
  const m = (pathname || '/').match(/^\/(ru|uk|es)(\/(.*))?$/);
  if (!m) return pathname || '/';
  return m[3] !== undefined ? `/${m[3]}` : '/';
}

/**
 * F12 - Build the locale-prefixed URL for a given base path and target
 * locale. English ('en') lives at the root; other locales get a /<code>
 * prefix.
 */
function localeHref(basePath, code) {
  const normalized = basePath || '/';
  if (code === 'en') return normalized;
  if (!LOCALES.includes(code)) return normalized;
  return normalized === '/' ? `/${code}` : `/${code}${normalized}`;
}

/**
 * F12 - Detect whether the given pathname is a public marketing page
 * (English root or one of the locale-prefixed mirrors). Used to decide
 * whether the switcher should render crawlable <a href> URL links vs
 * the legacy onClick-based localStorage flip used inside the app.
 */
function isPublicMarketingPath(pathname) {
  const base = stripLocalePrefix(pathname);
  return PUBLIC_MARKETING_PATHS.has(base);
}

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'es', label: 'Espa\u00F1ol', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'uk', label: '\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430', flag: '\u{1F1FA}\u{1F1E6}' }
];

/**
 * Compact language switcher dropdown.
 *
 * Two modes:
 *   1. Public marketing pages (default when the current URL is a public
 *      marketing route, or forced via `useLocaleUrls`): each option renders
 *      as a react-router <Link>, which emits a real <a href="/ru/privacy">
 *      anchor. Crawlers can discover locale alternates without executing JS,
 *      and the URL itself is the source of truth for i18n (LocaleSync in
 *      App.jsx switches i18n on navigation).
 *   2. Authenticated app (Sidebar) and auth pages: keeps the legacy
 *      onClick behavior - flips i18n, updates localStorage, and (optionally)
 *      PATCHes the server-side preference.
 *
 * @param {object} props
 * @param {'light'|'dark'} props.variant - 'light' for dark backgrounds, 'dark' for light backgrounds
 * @param {boolean} props.compact - if true, shows only flag + code
 * @param {boolean} props.persistToServer - if true, sends PATCH to save language in DB
 * @param {boolean} [props.useLocaleUrls] - force URL-anchor mode regardless of current path
 */
export default function LanguageSwitcher({ variant = 'dark', compact = false, persistToServer = false, dropUp = false, useLocaleUrls }) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  // F12: Auto-detect URL-anchor mode when the current URL is a public
  // marketing route (or a locale-prefixed mirror of one). Callers can
  // override via `useLocaleUrls` — Sidebar / dashboard explicitly opt out.
  const urlMode = useLocaleUrls !== undefined
    ? useLocaleUrls
    : isPublicMarketingPath(location.pathname);
  const basePath = stripLocalePrefix(location.pathname);

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

    // Track language switch event
    trackUmamiEvent('language-switch', { from: i18n.language, to: langCode });

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
          {LANGUAGES.map(lang => {
            const isSelected = lang.code === i18n.language;
            const optionClass = `w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
              isSelected
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-stone-700 hover:bg-stone-50'
            }`;
            const optionInner = (
              <>
                <span className="text-base">{lang.flag}</span>
                <span>{lang.label}</span>
                {isSelected && (
                  <svg className="w-4 h-4 ml-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </>
            );

            if (urlMode) {
              // F12: crawlable <a href> via react-router <Link>. Full path is
              // the locale-prefixed equivalent of the current URL, so
              // /privacy -> /ru/privacy and /ru/privacy -> /privacy.
              const to = localeHref(basePath, lang.code);
              return (
                <li key={lang.code}>
                  <Link
                    to={to}
                    role="option"
                    aria-selected={isSelected}
                    hrefLang={lang.code}
                    onClick={() => {
                      trackUmamiEvent('language-switch', {
                        from: i18n.language,
                        to: lang.code,
                        mode: 'url',
                      });
                      setIsOpen(false);
                    }}
                    className={optionClass}
                  >
                    {optionInner}
                  </Link>
                </li>
              );
            }

            return (
              <li key={lang.code}>
                <button
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(lang.code)}
                  className={optionClass}
                >
                  {optionInner}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
