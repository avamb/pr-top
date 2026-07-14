import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * R6 — "Technology inside PR-TOP" section.
 * Placed after Anti-Burnout and before FAQ.
 * Explains the AI/tech stack honestly, without hype,
 * after the practice value has already been established.
 * All 4 locales: EN / RU / ES / UK.
 */

const techIcons = [
  /* Language model — CPU / chip icon */
  <svg key="cpu" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
  </svg>,
  /* Telegram / chat channel icon */
  <svg key="chat" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </svg>,
  /* Encryption / shield-lock icon */
  <svg key="lock" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>,
  /* EU hosting / globe icon */
  <svg key="globe" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>,
];

const TECH_ITEM_KEYS = [
  { titleKey: 'landing.tech1Title', descKey: 'landing.tech1Desc' },
  { titleKey: 'landing.tech2Title', descKey: 'landing.tech2Desc' },
  { titleKey: 'landing.tech3Title', descKey: 'landing.tech3Desc' },
  { titleKey: 'landing.tech4Title', descKey: 'landing.tech4Desc' },
];

export default function TechSection() {
  const { t } = useTranslation();

  return (
    <section
      id="tech-inside"
      aria-label={t('landing.techTitle')}
      className="py-20 bg-surface"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text">
            {t('landing.techTitle')}
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-secondary text-lg">
            {t('landing.techLead')}
          </p>
        </div>

        {/* Tech items grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {TECH_ITEM_KEYS.map((item, i) => (
            <div
              key={i}
              className="flex gap-4 bg-white rounded-xl px-6 py-5 border border-surface shadow-sm"
            >
              <div className="shrink-0 flex items-start justify-center w-10 h-10 rounded-xl bg-primary/10 mt-0.5">
                {techIcons[i]}
              </div>
              <div>
                <h3 className="font-semibold text-text text-base mb-1.5">
                  {t(item.titleKey)}
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  {t(item.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Closing statement */}
        <p className="mt-12 text-base font-medium text-text text-center max-w-2xl mx-auto">
          {t('landing.techClose')}
        </p>
      </div>
    </section>
  );
}
