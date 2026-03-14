import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AccordionItem from '../components/AccordionItem';

function GuideImage({ src, alt }) {
  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-200">
      <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
    </div>
  );
}

function HighlightText({ text, query }) {
  if (!query || query.length < 2) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function TherapistGuide() {
  const { t } = useTranslation();
  const [openSection, setOpenSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (id) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  // Build sections data
  const sections = useMemo(() => [
    {
      id: 'dashboard',
      title: t('guide.section1Title'),
      searchText: t('guide.section1Title') + ' ' + t('guide.section1Body'),
      content: (
        <>
          <p>{t('guide.section1Body')}</p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>{t('guide.section1Stat1')}</li>
            <li>{t('guide.section1Stat2')}</li>
            <li>{t('guide.section1Stat3')}</li>
            <li>{t('guide.section1Stat4')}</li>
          </ul>
          <p className="mt-3">{t('guide.section1Activity')}</p>
          <p className="mt-2">{t('guide.section1Invite')}</p>
          <p className="mt-2">{t('guide.section1Badge')}</p>
          <GuideImage src="/images/guide/dashboard.svg" alt={t('guide.section1ImgAlt')} />
        </>
      ),
    },
    {
      id: 'clients',
      title: t('guide.section2Title'),
      searchText: t('guide.section2Title') + ' ' + t('guide.section2Body'),
      content: (
        <>
          <p>{t('guide.section2Body')}</p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>{t('guide.section2Dot1')}</li>
            <li>{t('guide.section2Dot2')}</li>
            <li>{t('guide.section2Dot3')}</li>
            <li>{t('guide.section2Dot4')}</li>
          </ul>
          <p className="mt-3">{t('guide.section2Consent')}</p>
          <p className="mt-2">{t('guide.section2Open')}</p>
          <GuideImage src="/images/guide/clients.svg" alt={t('guide.section2ImgAlt')} />
        </>
      ),
    },
    {
      id: 'profile',
      title: t('guide.section3Title'),
      searchText: t('guide.section3Title') + ' ' + t('guide.section3Body'),
      content: (
        <>
          <p>{t('guide.section3Body')}</p>
          <div className="mt-3 space-y-3">
            <div>
              <h4 className="font-semibold text-stone-700">{t('guide.section3Tab1')}</h4>
              <p className="text-sm">{t('guide.section3Tab1Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">{t('guide.section3Tab2')}</h4>
              <p className="text-sm">{t('guide.section3Tab2Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">{t('guide.section3Tab3')}</h4>
              <p className="text-sm">{t('guide.section3Tab3Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">{t('guide.section3Tab4')}</h4>
              <p className="text-sm">{t('guide.section3Tab4Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">{t('guide.section3Tab5')}</h4>
              <p className="text-sm">{t('guide.section3Tab5Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">{t('guide.section3Tab6')}</h4>
              <p className="text-sm">{t('guide.section3Tab6Desc')}</p>
            </div>
          </div>
          <GuideImage src="/images/guide/profile.svg" alt={t('guide.section3ImgAlt')} />
        </>
      ),
    },
    {
      id: 'sessions',
      title: t('guide.section4Title'),
      searchText: t('guide.section4Title') + ' ' + t('guide.section4Body'),
      content: (
        <>
          <p>{t('guide.section4Body')}</p>
          <ol className="list-decimal pl-5 mt-3 space-y-1">
            <li>{t('guide.section4Step1')}</li>
            <li>{t('guide.section4Step2')}</li>
            <li>{t('guide.section4Step3')}</li>
          </ol>
          <p className="mt-3">{t('guide.section4Statuses')}</p>
          <GuideImage src="/images/guide/sessions.svg" alt={t('guide.section4ImgAlt')} />
        </>
      ),
    },
    {
      id: 'exercises',
      title: t('guide.section5Title'),
      searchText: t('guide.section5Title') + ' ' + t('guide.section5Body'),
      content: (
        <>
          <p>{t('guide.section5Body')}</p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>{t('guide.section5Cat1')}</li>
            <li>{t('guide.section5Cat2')}</li>
            <li>{t('guide.section5Cat3')}</li>
            <li>{t('guide.section5Cat4')}</li>
            <li>{t('guide.section5Cat5')}</li>
            <li>{t('guide.section5Cat6')}</li>
          </ul>
          <p className="mt-3">{t('guide.section5Assign')}</p>
          <GuideImage src="/images/guide/exercises.svg" alt={t('guide.section5ImgAlt')} />
        </>
      ),
    },
    {
      id: 'myExercises',
      title: t('guide.section5bTitle'),
      searchText: t('guide.section5bTitle') + ' ' + t('guide.section5bBody') + ' ' + t('guide.section5bStep1Desc') + ' ' + t('guide.section5bStep2Desc') + ' ' + t('guide.section5bStep3Desc') + ' ' + t('guide.section5bStep4Desc') + ' ' + t('guide.section5bStep5Desc'),
      content: (
        <>
          <p>{t('guide.section5bBody')}</p>
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="font-semibold text-stone-700">1. {t('guide.section5bStep1Title')}</h4>
              <p className="text-sm mt-1">{t('guide.section5bStep1Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">2. {t('guide.section5bStep2Title')}</h4>
              <p className="text-sm mt-1">{t('guide.section5bStep2Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">3. {t('guide.section5bStep3Title')}</h4>
              <p className="text-sm mt-1">{t('guide.section5bStep3Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">4. {t('guide.section5bStep4Title')}</h4>
              <p className="text-sm mt-1">{t('guide.section5bStep4Desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-700">5. {t('guide.section5bStep5Title')}</h4>
              <p className="text-sm mt-1">{t('guide.section5bStep5Desc')}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
            <p className="text-sm text-teal-800">{t('guide.section5bTip')}</p>
          </div>
        </>
      ),
    },
    {
      id: 'sos',
      title: t('guide.section6Title'),
      searchText: t('guide.section6Title') + ' ' + t('guide.section6Body'),
      content: (
        <>
          <p>{t('guide.section6Body')}</p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>{t('guide.section6Channel1')}</li>
            <li>{t('guide.section6Channel2')}</li>
            <li>{t('guide.section6Channel3')}</li>
            <li>{t('guide.section6Channel4')}</li>
          </ul>
          <p className="mt-3">{t('guide.section6Quiet')}</p>
          <p className="mt-2">{t('guide.section6Recommend')}</p>
          <GuideImage src="/images/guide/sos.svg" alt={t('guide.section6ImgAlt')} />
        </>
      ),
    },
    {
      id: 'analytics',
      title: t('guide.section7Title'),
      searchText: t('guide.section7Title') + ' ' + t('guide.section7Body'),
      content: (
        <>
          <p>{t('guide.section7Body')}</p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>{t('guide.section7Chart1')}</li>
            <li>{t('guide.section7Chart2')}</li>
            <li>{t('guide.section7Chart3')}</li>
          </ul>
          <p className="mt-3">{t('guide.section7DateRange')}</p>
          <GuideImage src="/images/guide/analytics.svg" alt={t('guide.section7ImgAlt')} />
        </>
      ),
    },
    {
      id: 'settings',
      title: t('guide.section8Title'),
      searchText: t('guide.section8Title') + ' ' + t('guide.section8Body'),
      content: (
        <>
          <p>{t('guide.section8Body')}</p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>{t('guide.section8Lang')}</li>
            <li>{t('guide.section8Tz')}</li>
            <li>{t('guide.section8Plans')}</li>
            <li>{t('guide.section8Upgrade')}</li>
            <li>{t('guide.section8History')}</li>
          </ul>
          <GuideImage src="/images/guide/settings.svg" alt={t('guide.section8ImgAlt')} />
        </>
      ),
    },
    {
      id: 'faq',
      title: t('guide.section9Title'),
      searchText: t('guide.section9Title') + ' ' + t('guide.faq1Q') + ' ' + t('guide.faq2Q') + ' ' + t('guide.faq3Q') + ' ' + t('guide.faq4Q') + ' ' + t('guide.faq5Q') + ' ' + t('guide.faq6Q') + ' ' + t('guide.faq7Q') + ' ' + t('guide.faq8Q') + ' ' + t('guide.faq9Q') + ' ' + t('guide.faq10Q'),
      content: (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <div key={i} className="border-b border-gray-100 pb-3 last:border-b-0">
              <h4 className="font-semibold text-stone-700 mb-1">
                <HighlightText text={t(`guide.faq${i}Q`)} query={searchQuery} />
              </h4>
              <p className="text-sm text-stone-600">
                <HighlightText text={t(`guide.faq${i}A`)} query={searchQuery} />
              </p>
            </div>
          ))}
        </div>
      ),
    },
  ], [t, searchQuery]);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(s => s.searchText.toLowerCase().includes(q));
  }, [sections, searchQuery]);

  return (
    <div>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-primary">{t('guide.title')}</h1>
          <p className="text-sm text-secondary mt-1">{t('guide.subtitle')}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Search / filter */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('guide.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              aria-label={t('guide.searchPlaceholder')}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                aria-label={t('common.close')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && searchQuery.length >= 2 && (
            <p className="text-xs text-stone-400 mt-2">
              {t('guide.searchResults', { count: filteredSections.length })}
            </p>
          )}
        </div>

        {/* Accordion sections */}
        {filteredSections.length > 0 ? (
          <div>
            {filteredSections.map(section => (
              <AccordionItem
                key={section.id}
                id={section.id}
                title={section.title}
                isOpen={openSection === section.id}
                onToggle={() => toggleSection(section.id)}
              >
                {section.content}
              </AccordionItem>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-stone-400">
            <p className="text-lg">{t('guide.noResults')}</p>
          </div>
        )}
      </main>
    </div>
  );
}
