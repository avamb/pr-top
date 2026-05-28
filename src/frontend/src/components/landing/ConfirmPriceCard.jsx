import React from 'react';
import { useTranslation } from 'react-i18next';

const CHECK_ICON = (
  <svg className="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const CROSS_ICON = (
  <svg className="w-5 h-5 text-secondary/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * ConfirmPriceCard — $9/mo pricing card with included/not-included list.
 */
export default function ConfirmPriceCard({ onCtaClick }) {
  const { t } = useTranslation();

  const included = [
    t('landingConfirm.price.item1'),
    t('landingConfirm.price.item2'),
    t('landingConfirm.price.item3'),
    t('landingConfirm.price.item4'),
    t('landingConfirm.price.item5'),
  ];

  const notIncluded = [
    t('landingConfirm.price.notItem1'),
    t('landingConfirm.price.notItem2'),
    t('landingConfirm.price.notItem3'),
  ];

  return (
    <section id="pricing" aria-label="Pricing" className="py-20 bg-surface">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-text">
            {t('landingConfirm.price.title')}
          </h2>
        </div>

        <div className="max-w-md mx-auto">
          {/* Price card */}
          <div className="bg-white rounded-3xl shadow-xl border border-surface overflow-hidden">
            {/* Header */}
            <div className="bg-primary px-8 py-8 text-white text-center">
              <div className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                Confirm Plan
              </div>
              {/* Price */}
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold">{t('landingConfirm.price.amount')}</span>
                <span className="text-white/70 text-base">{t('landingConfirm.price.period')}</span>
              </div>
              <p className="mt-2 text-white/80 text-sm">{t('landingConfirm.price.trial')}</p>
            </div>

            {/* Body */}
            <div className="px-8 py-6">
              {/* Included */}
              <p className="text-xs font-bold text-text uppercase tracking-wider mb-3">
                {t('landingConfirm.price.includesTitle')}
              </p>
              <ul className="space-y-2.5 mb-6">
                {included.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text">
                    {CHECK_ICON}
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Not included */}
              <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-3">
                {t('landingConfirm.price.notIncludedTitle')}
              </p>
              <ul className="space-y-2.5 mb-8">
                {notIncluded.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-secondary/70">
                    {CROSS_ICON}
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                onClick={onCtaClick}
                className="w-full py-3.5 px-6 bg-primary text-white font-bold rounded-xl hover:bg-primary-600 transition-colors min-h-[48px] text-base shadow-md shadow-primary/20"
              >
                {t('landingConfirm.price.ctaBtn')}
              </button>

              {/* Upgrade note */}
              <p className="mt-4 text-center text-xs text-secondary">
                {t('landingConfirm.price.upgradeNote')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
