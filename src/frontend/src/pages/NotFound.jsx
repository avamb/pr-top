import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import Seo from '../components/Seo';

export default function NotFound() {
  const { t } = useTranslation();
  const location = useLocation();
  // Read after mount (localStorage is browser-only) so the first render
  // matches the prerendered 404.html that nginx serves with a real 404 status
  // (see nginx.conf). The JWT lives in an HttpOnly cookie; the cached profile
  // is only a hint that decides which link to show.
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    try {
      setHasSession(!!localStorage.getItem('user'));
    } catch (_) { /* storage blocked */ }
  }, []);
  const homeLink = hasSession ? '/dashboard' : '/';
  const homeLinkText = hasSession ? t('notFound.goDashboard') : t('notFound.goHome');

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <Seo title={t('notFound.seoTitle')} description={t('notFound.seoDescription')} noindex />
      <div className="text-center max-w-md">
        <h1 className="text-8xl font-bold text-teal-600 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-stone-800 mb-4">{t('notFound.title')}</h2>
        <p className="text-stone-600 mb-2">
          <Trans
            i18nKey="notFound.message"
            values={{ path: location.pathname }}
            components={{ code: <code className="bg-stone-200 px-2 py-0.5 rounded text-sm" /> }}
          />
        </p>
        <p className="text-stone-500 mb-8">
          {t('notFound.hint')}
        </p>
        <Link
          to={homeLink}
          className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          {homeLinkText}
        </Link>
      </div>
    </div>
  );
}
