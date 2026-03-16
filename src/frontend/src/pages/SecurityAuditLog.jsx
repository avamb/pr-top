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

export default function SecurityAuditLog() {
  const { t } = useTranslation();

  return (
    <SecurityPageLayout titleKey="security.auditLogTitle">
      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>}
        title={t('security.audit.eventsTitle')}
      >
        <p>{t('security.audit.eventsP1')}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t('security.audit.eventsItem1')}</li>
          <li>{t('security.audit.eventsItem2')}</li>
          <li>{t('security.audit.eventsItem3')}</li>
          <li>{t('security.audit.eventsItem4')}</li>
          <li>{t('security.audit.eventsItem5')}</li>
        </ul>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        title={t('security.audit.retentionTitle')}
      >
        <p>{t('security.audit.retentionP1')}</p>
        <p>{t('security.audit.retentionP2')}</p>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>}
        title={t('security.audit.tamperProofTitle')}
      >
        <p>{t('security.audit.tamperProofP1')}</p>
        <p>{t('security.audit.tamperProofP2')}</p>
      </Section>

      <Section
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        title={t('security.audit.transparencyTitle')}
      >
        <p>{t('security.audit.transparencyP1')}</p>
        <p>{t('security.audit.transparencyP2')}</p>
      </Section>
    </SecurityPageLayout>
  );
}
