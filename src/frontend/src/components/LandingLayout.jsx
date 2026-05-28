import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * LandingLayout — minimal wrapper used ONLY by standalone landing routes.
 *
 * Renders:
 *  • Small top bar: logo on the left + language switcher on the right
 *  • Main content slot (children)
 *  • Minimal footer: privacy, terms, pr-top.com link
 *
 * NO sidebar, NO app nav, NO user menu.
 */
export default function LandingLayout({ children }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-primary tracking-tight hover:opacity-80 transition-opacity">
            {t('brand')}
          </Link>
          <LanguageSwitcher compact />
        </div>
      </header>

      {/* ─── Main content ─── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ─── Minimal footer ─── */}
      <footer className="bg-surface border-t border-gray-200 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-secondary">
          <span>© {new Date().getFullYear()} PR-TOP</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-text transition-colors">{t('landing.privacyPolicy')}</Link>
            <Link to="/terms" className="hover:text-text transition-colors">{t('landing.termsOfService')}</Link>
            <a href="https://pr-top.com" target="_blank" rel="noopener noreferrer" className="hover:text-text transition-colors">pr-top.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
