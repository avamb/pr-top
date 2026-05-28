import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * ConfirmHero — large headline, 1-sentence subheadline, primary CTA (scroll-to-signup).
 */
export default function ConfirmHero({ onCtaClick }) {
  const { t } = useTranslation();

  return (
    <section aria-label="Hero" className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-white to-white py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Telegram Session Reminders
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-text leading-tight tracking-tight">
          {t('landingConfirm.hero.headline')}
        </h1>

        {/* Subheadline */}
        <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-secondary leading-relaxed">
          {t('landingConfirm.hero.subheadline')}
        </p>

        {/* CTA */}
        <div className="mt-10">
          <button
            onClick={onCtaClick}
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-primary text-white font-bold text-base sm:text-lg hover:bg-primary-600 transition-colors shadow-lg shadow-primary/20 min-h-[52px]"
          >
            {t('landingConfirm.hero.ctaBtn')}
            <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>

          {/* Social proof hint */}
          <p className="mt-4 text-sm text-secondary">
            7-day free trial · No credit card required · Cancel anytime
          </p>
        </div>

        {/* Decorative illustration of Telegram reminder */}
        <div className="mt-14 flex justify-center" aria-hidden="true">
          <div className="relative max-w-xs w-full">
            {/* Phone mockup */}
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-4 text-left">
              {/* Telegram top bar */}
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">RT</div>
                <div>
                  <div className="text-xs font-semibold text-text">PR-TOP Reminder</div>
                  <div className="text-[10px] text-secondary">bot</div>
                </div>
              </div>
              {/* Reminder message bubble */}
              <div className="bg-primary/10 rounded-2xl rounded-tl-sm p-3 mb-2">
                <p className="text-xs text-text leading-relaxed">
                  📅 <strong>Session reminder</strong><br />
                  Tomorrow at 3:00 PM<br />
                  <span className="text-secondary">with Dr. Maria Ivanova</span>
                </p>
              </div>
              {/* Inline buttons */}
              <div className="space-y-1.5 mt-2">
                <button className="w-full text-xs py-2 px-3 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium">
                  ✅ Confirm session
                </button>
                <button className="w-full text-xs py-2 px-3 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg font-medium">
                  🔄 Request reschedule
                </button>
                <button className="w-full text-xs py-2 px-3 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg font-medium">
                  🆓 Release slot
                </button>
              </div>
            </div>
            {/* Decorative glow */}
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-primary/5 blur-2xl" />
          </div>
        </div>
      </div>

      {/* Background decorations */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>
    </section>
  );
}
