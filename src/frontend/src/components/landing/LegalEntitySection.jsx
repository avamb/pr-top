/**
 * LegalEntitySection — R21a
 *
 * Renders the approved company facts between the Pricing section and the footer.
 * All displayed facts come exclusively from src/frontend/src/data/trustFacts.js,
 * which is populated from docs/seo/TRUST_FACTS.md (owner-approved, publish: yes rows).
 *
 * Hard rules enforced by source data:
 *   - No personal surnames
 *   - No personal identification codes
 *   - No testimonials (none available)
 *   - Company name, address, and registry code are NOT translated
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { legalEntity } from '../../data/trustFacts';

export default function LegalEntitySection() {
  const { t } = useTranslation();

  if (!legalEntity) return null;

  return (
    <section
      id="legal-entity"
      aria-label={t('landing.legalEntity.heading')}
      className="py-10 bg-surface"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto rounded-2xl border border-surface bg-white p-8 shadow-sm">
          <h2 className="text-base font-semibold text-text mb-5">
            {t('landing.legalEntity.heading')}
          </h2>
          <p className="text-sm text-secondary mb-6">
            {t('landing.legalEntity.intro')}{' '}
            <span className="font-semibold text-text">{legalEntity.name}</span>
            {' '}—{' '}
            {t('landing.legalEntity.operatingSinceLabel')} {legalEntity.operatingSince}.
          </p>
          <dl className="grid sm:grid-cols-2 gap-x-10 gap-y-4 text-sm">
            {/* Registry code + link */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-secondary mb-1">
                {t('landing.legalEntity.registryCodeLabel')}
              </dt>
              <dd className="text-text font-medium">
                {legalEntity.registryCode}
                <span className="mx-2 text-surface-dark">·</span>
                <a
                  href={legalEntity.registryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs font-normal"
                >
                  {t('landing.legalEntity.registerLink')} ↗
                </a>
              </dd>
            </div>

            {/* Jurisdiction */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-secondary mb-1">
                {t('landing.legalEntity.jurisdictionLabel')}
              </dt>
              <dd className="text-text font-medium">{legalEntity.jurisdiction}</dd>
            </div>

            {/* Registered address */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-secondary mb-1">
                {t('landing.legalEntity.addressLabel')}
              </dt>
              <dd className="text-text font-medium">{legalEntity.address}</dd>
            </div>

            {/* Privacy & support contact */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-secondary mb-1">
                {t('landing.legalEntity.contactLabel')}
              </dt>
              <dd className="text-text font-medium">
                <a
                  href={`mailto:${legalEntity.contact}`}
                  className="hover:text-primary transition-colors"
                >
                  {legalEntity.contact}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
