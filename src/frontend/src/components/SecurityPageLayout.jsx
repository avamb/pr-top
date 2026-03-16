import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * Shared layout for /security/* pages.
 * Hero with shield icon + title, content sections, back-to-home link.
 */
export default function SecurityPageLayout({ titleKey, children }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            PR-TOP
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/" className="text-sm text-gray-600 hover:text-primary transition-colors">
              ← {t('security.backToHome')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero section */}
      <div className="bg-gradient-to-br from-primary/5 via-white to-teal-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          {/* Shield icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <svg className="w-9 h-9 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {t(titleKey)}
          </h1>
          <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
            {t('security.heroSubtitle')}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="prose prose-gray max-w-none">
          {children}
        </div>
      </div>

      {/* Related pages */}
      <div className="bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            {t('security.relatedPages')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link to="/security/encryption" className="p-3 rounded-lg border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-gray-700 hover:text-primary text-center">
              {t('security.encryptionTitle')}
            </Link>
            <Link to="/security/gdpr" className="p-3 rounded-lg border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-gray-700 hover:text-primary text-center">
              {t('security.gdprTitle')}
            </Link>
            <Link to="/security/audit-log" className="p-3 rounded-lg border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-gray-700 hover:text-primary text-center">
              {t('security.auditLogTitle')}
            </Link>
            <Link to="/security/data-sovereignty" className="p-3 rounded-lg border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-gray-700 hover:text-primary text-center">
              {t('security.dataSovereigntyTitle')}
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white/60 text-center py-6 text-xs">
        {t('landing.copyright', { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
