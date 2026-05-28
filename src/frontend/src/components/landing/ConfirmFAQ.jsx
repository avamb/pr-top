import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const faqKeys = [
  { q: 'landingConfirm.faq.q1', a: 'landingConfirm.faq.a1' },
  { q: 'landingConfirm.faq.q2', a: 'landingConfirm.faq.a2' },
  { q: 'landingConfirm.faq.q3', a: 'landingConfirm.faq.a3' },
  { q: 'landingConfirm.faq.q4', a: 'landingConfirm.faq.a4' },
  { q: 'landingConfirm.faq.q5', a: 'landingConfirm.faq.a5' },
  { q: 'landingConfirm.faq.q6', a: 'landingConfirm.faq.a6' },
];

/**
 * ConfirmFAQ — 6 Q&A accordion items covering required topics.
 */
export default function ConfirmFAQ() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq" aria-label="FAQ" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-text text-center mb-12">
          {t('landingConfirm.faq.title')}
        </h2>

        <div className="space-y-2">
          {faqKeys.map((fk, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`border rounded-xl transition-colors ${isOpen ? 'border-primary/30 bg-primary/5' : 'border-surface bg-white'}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left min-h-[52px]"
                  aria-expanded={isOpen}
                >
                  <span className={`text-sm font-medium ${isOpen ? 'text-primary' : 'text-text'}`}>
                    {t(fk.q)}
                  </span>
                  <svg
                    className={`w-5 h-5 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : 'text-secondary'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-secondary leading-relaxed">{t(fk.a)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
