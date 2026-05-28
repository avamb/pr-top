import React from 'react';
import { useTranslation } from 'react-i18next';

const steps = [
  {
    number: '01',
    titleKey: 'landingConfirm.howItWorks.step1Title',
    bodyKey: 'landingConfirm.howItWorks.step1Body',
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    number: '02',
    titleKey: 'landingConfirm.howItWorks.step2Title',
    bodyKey: 'landingConfirm.howItWorks.step2Body',
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
  },
  {
    number: '03',
    titleKey: 'landingConfirm.howItWorks.step3Title',
    bodyKey: 'landingConfirm.howItWorks.step3Body',
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

/**
 * ConfirmHowItWorks — 3 numbered steps explaining the reminder flow.
 */
export default function ConfirmHowItWorks() {
  const { t } = useTranslation();

  return (
    <section aria-label="How it works" className="py-20 bg-surface">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-text text-center mb-16">
          {t('landingConfirm.howItWorks.title')}
        </h2>

        <div className="relative">
          {/* Connecting line on desktop */}
          <div className="hidden sm:block absolute top-8 left-1/6 right-1/6 h-0.5 bg-primary/20" aria-hidden="true" />

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                {/* Step circle */}
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white font-bold text-lg shadow-md shadow-primary/20 mb-5 z-10">
                  {step.icon}
                </div>
                {/* Step number badge */}
                <span className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-2">
                  Step {step.number}
                </span>
                <h3 className="text-base font-semibold text-text mb-2">
                  {t(step.titleKey)}
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  {t(step.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
