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

export default function SecurityGDPR() {
  const { t } = useTranslation();

  return (
    <SecurityPageLayout titleKey="security.gdprTitle">
      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>}
        title={t('security.gdpr.minimizationTitle')}
      >
        <p>{t('security.gdpr.minimizationP1')}</p>
        <p>{t('security.gdpr.minimizationP2')}</p>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>}
        title={t('security.gdpr.erasureTitle')}
      >
        <p>{t('security.gdpr.erasureP1')}</p>
        <p>{t('security.gdpr.erasureP2')}</p>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 012.625 1.25" /></svg>}
        title={t('security.gdpr.consentTitle')}
      >
        <p>{t('security.gdpr.consentP1')}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t('security.gdpr.consentItem1')}</li>
          <li>{t('security.gdpr.consentItem2')}</li>
          <li>{t('security.gdpr.consentItem3')}</li>
        </ul>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
        title={t('security.gdpr.dpaTitle')}
      >
        <p>{t('security.gdpr.dpaP1')}</p>
        <p>{t('security.gdpr.dpaP2')}</p>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>}
        title={t('security.gdpr.processingTitle')}
      >
        <p>{t('security.gdpr.processingP1')}</p>
        <p>{t('security.gdpr.processingP2')}</p>
      </Section>
    </SecurityPageLayout>
  );
}
