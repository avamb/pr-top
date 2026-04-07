import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';

/**
 * Email verification result page for leads.
 * Shows success/error/expired status after clicking the email verification link.
 */
export default function VerifyLead() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || 'success';

  const configs = {
    success: {
      icon: '\u2705',
      title: t('verifyLead.successTitle', 'Email verified!'),
      desc: t('verifyLead.successDesc', 'Your email has been confirmed. Return to the chat to continue the conversation with extra messages unlocked!'),
      color: 'green'
    },
    already_verified: {
      icon: '\u2705',
      title: t('verifyLead.alreadyTitle', 'Already verified'),
      desc: t('verifyLead.alreadyDesc', 'Your email was already confirmed. Return to the chat to continue the conversation!'),
      color: 'blue'
    },
    expired: {
      icon: '\u23F3',
      title: t('verifyLead.expiredTitle', 'Link expired'),
      desc: t('verifyLead.expiredDesc', 'This verification link has expired. Please return to the chat and register again.'),
      color: 'amber'
    },
    error: {
      icon: '\u274C',
      title: t('verifyLead.errorTitle', 'Verification failed'),
      desc: t('verifyLead.errorDesc', 'Something went wrong during verification. Please try again later.'),
      color: 'red'
    }
  };

  const config = configs[status] || configs.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-4">{config.icon}</div>
        <h1 className={`text-2xl font-bold mb-3 text-${config.color}-700`}>
          {config.title}
        </h1>
        <p className="text-gray-600 mb-6">
          {config.desc}
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors shadow-md"
        >
          {t('verifyLead.backToChat', 'Return to PR-TOP')}
        </Link>
      </div>
    </div>
  );
}
