import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import Seo from '../components/Seo';

/**
 * VerifyEmail — result page for the therapist email-verification link.
 *
 * Success and "already verified" never land here — the backend redirects a
 * valid token straight to /dashboard?verified=1 (or ?verified=already) after
 * issuing a session (see routes/emailVerification.js, GET /verify-email).
 * This page only handles the failure paths: an expired or otherwise invalid
 * token redirects here with ?status=expired|error.
 *
 * Modelled on VerifyLead.jsx (spec: SPEC_ANTIBOT_WAVES.md, Трек 2D, п.4).
 */
export default function VerifyEmail() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || 'error';

  // Only the failure statuses land here - a valid token redirects straight
  // to /dashboard?verified=1|already after issuing a session. Both message
  // keys (statusExpired, statusError) are seeded by Трек 2C; the fallback
  // strings below only apply if that i18n pass hasn't landed yet.
  const configs = {
    expired: {
      icon: '⏳',
      color: 'amber',
      message: t('verifyEmail.statusExpired', 'This verification link has expired.')
    },
    error: {
      icon: '❌',
      color: 'red',
      message: t('verifyEmail.statusError', 'We couldn’t confirm your email. Please try again.')
    }
  };

  const config = configs[status] || configs.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 flex items-center justify-center p-4">
      <Seo path="/verify-email" title="Verify email — PR-TOP" description="Email verification." noindex />
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-4">{config.icon}</div>
        <h1 className={`text-2xl font-bold mb-3 text-${config.color}-700`}>
          {t('verifyEmail.title', 'Email verification')}
        </h1>
        <p className="text-gray-600 mb-6">
          {config.message}
        </p>
        <Link
          to="/login"
          className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors shadow-md"
        >
          {t('verifyEmail.signInToResend', 'Sign in to resend')}
        </Link>
      </div>
    </div>
  );
}
