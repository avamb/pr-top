import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * R5 — "A week in practice" scenario section.
 * Replaces the generic features-listing block with a narrative walkthrough
 * of one real week in a therapist's practice using PR-TOP.
 * All 4 locales: EN / RU / ES / UK.
 */

const stepIcons = [
  /* Monday morning — calendar */
  <svg key="cal" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>,
  /* After session — document check */
  <svg key="doc" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
  /* Wednesday midday — shield / boundary */
  <svg key="shield" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>,
  /* Thursday evening — microphone */
  <svg key="mic" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
  </svg>,
  /* Friday — home / door closed */
  <svg key="home" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>,
];

const STEP_KEYS = [
  { label: 'landing.week.step1.label', title: 'landing.week.step1.title', body: 'landing.week.step1.body' },
  { label: 'landing.week.step2.label', title: 'landing.week.step2.title', body: 'landing.week.step2.body' },
  { label: 'landing.week.step3.label', title: 'landing.week.step3.title', body: 'landing.week.step3.body' },
  { label: 'landing.week.step4.label', title: 'landing.week.step4.title', body: 'landing.week.step4.body' },
  { label: 'landing.week.step5.label', title: 'landing.week.step5.title', body: 'landing.week.step5.body' },
];

export default function WeekInPracticeSection() {
  const { t } = useTranslation();

  return (
    <section
      id="week-in-practice"
      aria-label={t('landing.week.heading')}
      className="py-20 bg-surface"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text">
            {t('landing.week.heading')}
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-secondary text-lg">
            {t('landing.week.lead')}
          </p>
        </div>

        {/* Timeline */}
        <ol className="relative">
          {STEP_KEYS.map((sk, i) => (
            <li key={i} className="flex gap-6 mb-10 last:mb-0 group">
              {/* Left: icon + connecting line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm group-hover:bg-primary/15 transition-colors">
                  {stepIcons[i]}
                </div>
                {i < STEP_KEYS.length - 1 && (
                  <div className="mt-2 w-px flex-1 bg-surface border-l-2 border-dashed border-primary/20 min-h-[2rem]" />
                )}
              </div>

              {/* Right: content card */}
              <div className="pb-2 flex-1">
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary mb-1">
                  {t(sk.label)}
                </span>
                <h3 className="text-lg font-semibold text-text mb-2">
                  {t(sk.title)}
                </h3>
                <p className="text-secondary text-sm leading-relaxed">
                  {t(sk.body)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
