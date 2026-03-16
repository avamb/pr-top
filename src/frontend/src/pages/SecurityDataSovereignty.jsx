import React from 'react';
import { useTranslation } from 'react-i18next';
import SecurityPageLayout from '../components/SecurityPageLayout';

function Section({ icon, title, children }) {
  return (
    <div className="mb-10">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
          {icon}
        </div>
        <h2 className="text-xl font-semibold text-gray-900 pt-1.5">{title}</h2>
      </div>
      <div className="pl-13 text-gray-600 leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  );
}

export default function SecurityDataSovereignty() {
  const { t } = useTranslation();

  return (
    <SecurityPageLayout titleKey="security.dataSovereigntyTitle">
      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>}
        title={t('security.ds.residencyTitle')}
      >
        <p>{t('security.ds.residencyP1')}</p>
        <p>{t('security.ds.residencyP2')}</p>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" /></svg>}
        title={t('security.ds.selfHostedTitle')}
      >
        <p>{t('security.ds.selfHostedP1')}</p>
        <p>{t('security.ds.selfHostedP2')}</p>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
        title={t('security.ds.noThirdPartyTitle')}
      >
        <p>{t('security.ds.noThirdPartyP1')}</p>
        <p>{t('security.ds.noThirdPartyP2')}</p>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
        title={t('security.ds.clientOwnershipTitle')}
      >
        <p>{t('security.ds.clientOwnershipP1')}</p>
        <p>{t('security.ds.clientOwnershipP2')}</p>
      </Section>
    </SecurityPageLayout>
  );
}
