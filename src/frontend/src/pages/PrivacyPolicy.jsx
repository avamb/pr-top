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

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('');

  const sections = [
    { id: 'data-collection', key: 'dataCollection' },
    { id: 'data-usage', key: 'dataUsage' },
    { id: 'data-storage', key: 'dataStorage' },
    { id: 'third-parties', key: 'thirdParties' },
    { id: 'data-retention', key: 'dataRetention' },
    { id: 'cookies', key: 'cookies' },
    { id: 'children', key: 'children' },
    { id: 'contact', key: 'contact' },
    { id: 'updates', key: 'updates' },
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
            {t('privacy.title')}
          </h1>
          <p className="text-gray-500 text-sm">
            {t('privacy.lastUpdated', { date: '2026-03-16' })}
          </p>
        </div>
      </div>

      {/* Content with TOC */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex gap-10">
          {/* TOC sidebar - hidden on mobile */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {t('privacy.tableOfContents')}
              </h3>
              <nav className="space-y-0.5">
                {sections.map((s, i) => (
                  <TOCItem
                    key={s.id}
                    number={i + 1}
                    label={t(`privacy.${s.key}.title`)}
                    id={s.id}
                    activeSection={activeSection}
                  />
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <Section id="data-collection" number={1} title={t('privacy.dataCollection.title')}>
              <p>{t('privacy.dataCollection.intro')}</p>
              <h3 className="font-medium text-gray-800 mt-4 mb-1">{t('privacy.dataCollection.personalTitle')}</h3>
              <p>{t('privacy.dataCollection.personalDesc')}</p>
              <h3 className="font-medium text-gray-800 mt-4 mb-1">{t('privacy.dataCollection.clinicalTitle')}</h3>
              <p>{t('privacy.dataCollection.clinicalDesc')}</p>
              <h3 className="font-medium text-gray-800 mt-4 mb-1">{t('privacy.dataCollection.usageTitle')}</h3>
              <p>{t('privacy.dataCollection.usageDesc')}</p>
            </Section>

            <Section id="data-usage" number={2} title={t('privacy.dataUsage.title')}>
              <p>{t('privacy.dataUsage.intro')}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t('privacy.dataUsage.item1')}</li>
                <li>{t('privacy.dataUsage.item2')}</li>
                <li>{t('privacy.dataUsage.item3')}</li>
                <li>{t('privacy.dataUsage.item4')}</li>
              </ul>
              <p className="font-medium text-gray-800">{t('privacy.dataUsage.noAds')}</p>
            </Section>

            <Section id="data-storage" number={3} title={t('privacy.dataStorage.title')}>
              <p>{t('privacy.dataStorage.intro')}</p>
              <h3 className="font-medium text-gray-800 mt-4 mb-1">{t('privacy.dataStorage.classATitle')}</h3>
              <p>{t('privacy.dataStorage.classADesc')}</p>
              <h3 className="font-medium text-gray-800 mt-4 mb-1">{t('privacy.dataStorage.classBTitle')}</h3>
              <p>{t('privacy.dataStorage.classBDesc')}</p>
              <p>{t('privacy.dataStorage.transit')}</p>
            </Section>

            <Section id="third-parties" number={4} title={t('privacy.thirdParties.title')}>
              <p>{t('privacy.thirdParties.intro')}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Stripe</strong> — {t('privacy.thirdParties.stripe')}</li>
                <li><strong>{t('privacy.thirdParties.aiLabel')}</strong> — {t('privacy.thirdParties.aiDesc')}</li>
                <li><strong>Telegram</strong> — {t('privacy.thirdParties.telegram')}</li>
              </ul>
              <p className="font-medium text-gray-800">{t('privacy.thirdParties.noSale')}</p>
            </Section>

            <Section id="data-retention" number={5} title={t('privacy.dataRetention.title')}>
              <p>{t('privacy.dataRetention.intro')}</p>
              <p>{t('privacy.dataRetention.deletion')}</p>
              <p>{t('privacy.dataRetention.backups')}</p>
            </Section>

            <Section id="cookies" number={6} title={t('privacy.cookies.title')}>
              <p>{t('privacy.cookies.intro')}</p>
              <p>{t('privacy.cookies.umami')}</p>
              <p>{t('privacy.cookies.essential')}</p>
            </Section>

            <Section id="children" number={7} title={t('privacy.children.title')}>
              <p>{t('privacy.children.desc')}</p>
            </Section>

            <Section id="contact" number={8} title={t('privacy.contact.title')}>
              <p>{t('privacy.contact.desc')}</p>
              <p>
                <a href="mailto:support@pr-top.app" className="text-primary hover:underline">
                  support@pr-top.app
                </a>
              </p>
            </Section>

            <Section id="updates" number={9} title={t('privacy.updates.title')}>
              <p>{t('privacy.updates.desc')}</p>
              <p>{t('privacy.updates.notification')}</p>
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
