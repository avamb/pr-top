import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * R3 — "Automation helps. Decisions stay with you." control section.
 * Placed after the Features section. This is where AI is introduced on
 * the landing page — not in the hero or feature cards.
 */
export default function ControlSection() {
  const { t } = useTranslation();

  const negations = [
    t('landing.controlNot1'),
    t('landing.controlNot2'),
    t('landing.controlNot3'),
    t('landing.controlNot4'),
  ];

  return (
    <section
      id="therapist-control"
      aria-label={t('landing.controlHeading')}
      className="py-20 bg-background"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
            {/* Balance / scale icon — therapist keeps the scales */}
            <svg
              className="w-7 h-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.02 12.02.707.707M3 12H2m20 0h-1M4.22 19.78l.707-.707M18.364 5.636l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl font-bold text-text text-center leading-tight">
          {t('landing.controlHeading')}
        </h2>

        {/* Lead paragraph — what PR-TOP can do */}
        <p className="mt-6 text-lg text-secondary leading-relaxed text-center max-w-2xl mx-auto">
          {t('landing.controlLead')}
        </p>

        {/* Divider */}
        <div className="mt-10 border-t border-surface" />

        {/* "Does not" list */}
        <ul className="mt-10 grid sm:grid-cols-2 gap-4">
          {negations.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 bg-white rounded-xl px-5 py-4 border border-surface shadow-sm"
            >
              {/* X mark */}
              <span className="mt-0.5 flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <svg
                  className="w-3.5 h-3.5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
              <span className="text-sm text-secondary leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>

        {/* Closing reassurance */}
        <p className="mt-10 text-base font-medium text-text text-center">
          {t('landing.controlClose')}
        </p>
      </div>
    </section>
  );
}
