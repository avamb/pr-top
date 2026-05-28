import React from 'react';
import { useTranslation } from 'react-i18next';

const painCards = [
  {
    icon: (
      <svg className="w-7 h-7 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
      </svg>
    ),
    titleKey: 'landingConfirm.pain.card1Title',
    bodyKey: 'landingConfirm.pain.card1Body',
    bg: 'bg-red-50',
    border: 'border-red-100',
  },
  {
    icon: (
      <svg className="w-7 h-7 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    titleKey: 'landingConfirm.pain.card2Title',
    bodyKey: 'landingConfirm.pain.card2Body',
    bg: 'bg-yellow-50',
    border: 'border-yellow-100',
  },
  {
    icon: (
      <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
    titleKey: 'landingConfirm.pain.card3Title',
    bodyKey: 'landingConfirm.pain.card3Body',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
];

/**
 * ConfirmPainHooks — 3 pain-point cards: no-show, late cancellation, manual reminders.
 */
export default function ConfirmPainHooks() {
  const { t } = useTranslation();

  return (
    <section aria-label="Pain points" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-text text-center mb-12">
          {t('landingConfirm.pain.title')}
        </h2>

        <div className="grid sm:grid-cols-3 gap-6">
          {painCards.map((card, i) => (
            <div
              key={i}
              className={`${card.bg} ${card.border} border rounded-2xl p-6`}
            >
              <div className="mb-4">{card.icon}</div>
              <h3 className="text-base font-semibold text-text mb-2">
                {t(card.titleKey)}
              </h3>
              <p className="text-sm text-secondary leading-relaxed">
                {t(card.bodyKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
