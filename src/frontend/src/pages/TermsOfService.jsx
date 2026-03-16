import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

function TOCItem({ number, label, id, activeSection }) {
  const isActive = activeSection === id;
  return (
    <a
      href={`#${id}`}
      className={`block py-1.5 pl-3 border-l-2 text-sm transition-colors ${
        isActive
          ? 'border-primary text-primary font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {number}. {label}
    </a>
  );
}

function Section({ id, number, title, children }) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">
        {number}. {title}
      </h2>
      <div className="text-gray-600 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

export default function TermsOfService() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('');

  const sections = [
    { id: 'acceptance', key: 'acceptance' },
    { id: 'service', key: 'service' },
    { id: 'accounts', key: 'accounts' },
    { id: 'acceptable-use', key: 'acceptableUse' },
    { id: 'subscriptions', key: 'subscriptions' },
    { id: 'intellectual-property', key: 'ip' },
    { id: 'data-privacy', key: 'dataPrivacy' },
    { id: 'disclaimers', key: 'disclaimers' },
    { id: 'liability', key: 'liability' },
    { id: 'indemnification', key: 'indemnification' },
    { id: 'termination', key: 'termination' },
    { id: 'governing-law', key: 'governingLaw' },
    { id: 'changes', key: 'changes' },
    { id: 'contact', key: 'contact' },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            PR-TOP
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/" className="text-sm text-gray-600 hover:text-primary transition-colors">
              ← {t('security.backToHome')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            {t('terms.title')}
          </h1>
          <p className="text-gray-500 text-sm">
            {t('terms.lastUpdated', { date: '2026-03-16' })}
          </p>
        </div>
      </div>

      {/* Content with TOC */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex gap-10">
          {/* TOC sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {t('terms.tableOfContents')}
              </h3>
              <nav className="space-y-0.5">
                {sections.map((s, i) => (
                  <TOCItem
                    key={s.id}
                    number={i + 1}
                    label={t(`terms.${s.key}.title`)}
                    id={s.id}
                    activeSection={activeSection}
                  />
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <Section id="acceptance" number={1} title={t('terms.acceptance.title')}>
              <p>{t('terms.acceptance.p1')}</p>
              <p>{t('terms.acceptance.p2')}</p>
            </Section>

            <Section id="service" number={2} title={t('terms.service.title')}>
              <p>{t('terms.service.p1')}</p>
              <p>{t('terms.service.p2')}</p>
              <p>{t('terms.service.p3')}</p>
            </Section>

            <Section id="accounts" number={3} title={t('terms.accounts.title')}>
              <p>{t('terms.accounts.p1')}</p>
              <p>{t('terms.accounts.p2')}</p>
              <p>{t('terms.accounts.p3')}</p>
            </Section>

            <Section id="acceptable-use" number={4} title={t('terms.acceptableUse.title')}>
              <p>{t('terms.acceptableUse.intro')}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t('terms.acceptableUse.item1')}</li>
                <li>{t('terms.acceptableUse.item2')}</li>
                <li>{t('terms.acceptableUse.item3')}</li>
                <li>{t('terms.acceptableUse.item4')}</li>
                <li>{t('terms.acceptableUse.item5')}</li>
              </ul>
            </Section>

            <Section id="subscriptions" number={5} title={t('terms.subscriptions.title')}>
              <p>{t('terms.subscriptions.p1')}</p>
              <p>{t('terms.subscriptions.p2')}</p>
              <p>{t('terms.subscriptions.p3')}</p>
              <p>{t('terms.subscriptions.p4')}</p>
            </Section>

            <Section id="intellectual-property" number={6} title={t('terms.ip.title')}>
              <p>{t('terms.ip.p1')}</p>
              <p>{t('terms.ip.p2')}</p>
              <p>{t('terms.ip.p3')}</p>
            </Section>

            <Section id="data-privacy" number={7} title={t('terms.dataPrivacy.title')}>
              <p>{t('terms.dataPrivacy.p1')}</p>
              <p>
                {t('terms.dataPrivacy.p2')}{' '}
                <Link to="/privacy" className="text-primary hover:underline">
                  {t('terms.dataPrivacy.privacyLink')}
                </Link>.
              </p>
            </Section>

            <Section id="disclaimers" number={8} title={t('terms.disclaimers.title')}>
              <p className="font-medium text-gray-800">{t('terms.disclaimers.p1')}</p>
              <p>{t('terms.disclaimers.p2')}</p>
              <p>{t('terms.disclaimers.p3')}</p>
              <p>{t('terms.disclaimers.p4')}</p>
            </Section>

            <Section id="liability" number={9} title={t('terms.liability.title')}>
              <p>{t('terms.liability.p1')}</p>
              <p>{t('terms.liability.p2')}</p>
            </Section>

            <Section id="indemnification" number={10} title={t('terms.indemnification.title')}>
              <p>{t('terms.indemnification.p1')}</p>
            </Section>

            <Section id="termination" number={11} title={t('terms.termination.title')}>
              <p>{t('terms.termination.p1')}</p>
              <p>{t('terms.termination.p2')}</p>
              <p>{t('terms.termination.p3')}</p>
            </Section>

            <Section id="governing-law" number={12} title={t('terms.governingLaw.title')}>
              <p>{t('terms.governingLaw.p1')}</p>
            </Section>

            <Section id="changes" number={13} title={t('terms.changes.title')}>
              <p>{t('terms.changes.p1')}</p>
              <p>{t('terms.changes.p2')}</p>
            </Section>

            <Section id="contact" number={14} title={t('terms.contact.title')}>
              <p>{t('terms.contact.desc')}</p>
              <p>
                <a href="mailto:support@pr-top.app" className="text-primary hover:underline">
                  support@pr-top.app
                </a>
              </p>
            </Section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white/60 text-center py-6 text-xs">
        {t('landing.copyright', { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
