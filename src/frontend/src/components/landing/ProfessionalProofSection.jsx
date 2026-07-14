/**
 * ProfessionalProofSection — R19
 *
 * Renders only when docs/TRUST_FACTS.md has been filled and the data has been
 * copied to src/frontend/src/data/trustFacts.js. If every array is empty, this
 * component returns null (section omitted from the HTML entirely).
 *
 * MANDATE: All content must come from trustFacts.js which is populated
 * exclusively from docs/TRUST_FACTS.md (owner-supplied, consent-approved facts).
 * No placeholder testimonials, fabricated logos, or invented numbers are permitted.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { hasTrustFacts, numbers, associations, advisors, testimonials } from '../../data/trustFacts';

/**
 * Reads the locale-aware string from a LocaleString object.
 * Falls back to EN if the current locale key is not present.
 *
 * @param {{ en: string; ru: string; uk: string; es: string }} localeObj
 * @param {string} lang — active i18next language code (e.g. "en", "ru")
 */
function ls(localeObj, lang) {
  return localeObj[lang] || localeObj.en || '';
}

export default function ProfessionalProofSection() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.slice(0, 2) || 'en';

  // Conditional rendering: section is hidden until the owner supplies real facts.
  if (!hasTrustFacts()) {
    return null;
  }

  return (
    <section
      id="professional-proof"
      aria-label={t('landing.proof.heading')}
      className="py-20 bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text">
            {t('landing.proof.heading')}
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-secondary text-lg">
            {t('landing.proof.subheading')}
          </p>
        </div>

        {/* Numbers / Traction */}
        {numbers.length > 0 && (
          <div className="mb-14">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {numbers.map((n, i) => (
                <div
                  key={i}
                  className="text-center rounded-2xl bg-surface p-6 border border-surface"
                >
                  <p className="text-4xl font-bold text-primary">{n.value}</p>
                  <p className="mt-2 text-sm text-secondary">{ls(n.label, lang)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Professional Associations */}
        {associations.length > 0 && (
          <div className="mb-14">
            <h3 className="text-sm font-semibold text-secondary uppercase tracking-widest text-center mb-6">
              {t('landing.proof.associationsTitle')}
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {associations.map((a, i) => (
                <div key={i} className="px-5 py-3 rounded-xl border border-surface bg-surface text-sm text-secondary font-medium">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      {a.name}
                    </a>
                  ) : (
                    a.name
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expert Advisors */}
        {advisors.length > 0 && (
          <div className="mb-14">
            <h3 className="text-sm font-semibold text-secondary uppercase tracking-widest text-center mb-8">
              {t('landing.proof.advisorsTitle')}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {advisors.map((adv, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-surface border border-surface p-6 flex flex-col gap-4"
                >
                  <blockquote className="text-secondary text-sm leading-relaxed italic">
                    &ldquo;{ls(adv.quote, lang)}&rdquo;
                  </blockquote>
                  <footer className="mt-auto">
                    <p className="font-semibold text-text text-sm">{adv.name}</p>
                    <p className="text-xs text-secondary">{adv.credential}</p>
                  </footer>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-secondary uppercase tracking-widest text-center mb-8">
              {t('landing.proof.testimonialsTitle')}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((tm, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-surface border border-surface p-6 flex flex-col gap-4"
                >
                  {/* Quote mark */}
                  <svg
                    className="w-6 h-6 text-primary/30 shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                  <blockquote className="text-secondary text-sm leading-relaxed flex-1">
                    {ls(tm.quote, lang)}
                  </blockquote>
                  <footer>
                    <p className="font-semibold text-text text-sm">{tm.author}</p>
                    <p className="text-xs text-secondary">{tm.credential}</p>
                  </footer>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
