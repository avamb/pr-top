import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SecurityPageLayout from '../components/SecurityPageLayout';
import AccordionItem from '../components/AccordionItem';
import Seo from '../components/Seo';

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

const SUMMARY_ITEMS = ['summary1', 'summary2', 'summary3', 'summary4', 'summary5'];

export default function SecurityEncryption() {
  const { t } = useTranslation();
  const [itReviewerOpen, setItReviewerOpen] = useState(false);

  return (
    <SecurityPageLayout titleKey="security.encryptionTitle">
      <Seo
        path="/security/encryption"
        titleKey="seo.securityEncryption.title"
        descriptionKey="seo.securityEncryption.description"
        title="Encryption at Rest & In Transit — PR-TOP Security"
        description="How PR-TOP protects sensitive client data with AES application-layer encryption, TLS transport, and strict key management."
      />

      {/* ── 5-line human summary (above the fold) ── */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 mb-10 not-prose">
        <h2 className="text-base font-semibold text-teal-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          {t('security.enc.summaryTitle')}
        </h2>
        <ol className="space-y-3 list-none m-0 p-0">
          {SUMMARY_ITEMS.map((key, idx) => (
            <li key={key} className="flex items-start gap-3 m-0">
              <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold mt-0.5">
                {idx + 1}
              </span>
              <span className="text-gray-700 text-sm leading-relaxed">
                {t(`security.enc.${key}`)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Technical details — For your IT reviewer ── */}
      <div className="not-prose mb-2">
        <AccordionItem
          id="it-reviewer"
          title={t('security.enc.itReviewerTitle')}
          isOpen={itReviewerOpen}
          onToggle={() => setItReviewerOpen(v => !v)}
        >
          {/* Wrap in a prose div so Section styles render correctly inside the accordion */}
          <div className="prose prose-gray max-w-none pt-4">
            <Section
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
              title={t('security.enc.atRestTitle')}
            >
              <p>{t('security.enc.atRestP1')}</p>
              <p>{t('security.enc.atRestP2')}</p>
            </Section>

            <Section
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
              title={t('security.enc.inTransitTitle')}
            >
              <p>{t('security.enc.inTransitP1')}</p>
              <p>{t('security.enc.inTransitP2')}</p>
            </Section>

            <Section
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>}
              title={t('security.enc.appLayerTitle')}
            >
              <p>{t('security.enc.appLayerP1')}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t('security.enc.appLayerItem1')}</li>
                <li>{t('security.enc.appLayerItem2')}</li>
                <li>{t('security.enc.appLayerItem3')}</li>
                <li>{t('security.enc.appLayerItem4')}</li>
                <li>{t('security.enc.appLayerItem5')}</li>
                <li>{t('security.enc.appLayerItem6')}</li>
              </ul>
            </Section>

            <Section
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>}
              title={t('security.enc.keyMgmtTitle')}
            >
              <p>{t('security.enc.keyMgmtP1')}</p>
              <p>{t('security.enc.keyMgmtP2')}</p>
            </Section>

            <Section
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              title={t('security.enc.zeroKnowledgeTitle')}
            >
              <p>{t('security.enc.zeroKnowledgeP1')}</p>
              <p>{t('security.enc.zeroKnowledgeP2')}</p>
            </Section>
          </div>
        </AccordionItem>
      </div>
    </SecurityPageLayout>
  );
}
