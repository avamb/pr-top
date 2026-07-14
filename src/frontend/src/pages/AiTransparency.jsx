import React from 'react';
import { useTranslation } from 'react-i18next';
import SecurityPageLayout from '../components/SecurityPageLayout';
import Seo from '../components/Seo';

/**
 * R27 — AI Transparency page (/security/ai-processing)
 *
 * 7 disclosure blocks anchored to real code and provider DPA links:
 *   1. Which AI models are used
 *   2. What data leaves PR-TOP
 *   3. For what tasks AI is used
 *   4. Where providers store data
 *   5. Data Processing Agreements
 *   6. Data retention at providers
 *   7. Disabling or limiting AI
 *
 * Code refs:
 *   - src/backend/src/services/aiProviders/openai.js
 *   - src/backend/src/services/aiProviders/anthropic.js
 *   - src/backend/src/services/aiProviders/google.js
 *   - src/backend/src/services/aiProviders/openrouter.js
 *   - src/backend/src/services/aiUsageLogger.js
 */

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

function CodeRef({ label }) {
  return (
    <span className="inline-block text-xs font-mono bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 ml-1">
      {label}
    </span>
  );
}

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline font-medium"
    >
      {children}
    </a>
  );
}

const IconCpu = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
  </svg>
);

const IconShare = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const IconTask = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconServer = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v.75a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25v-.75m19.5 0a2.25 2.25 0 00-2.25-2.25H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 19.409a2.25 2.25 0 01-1.07-1.916V17.25m19.5-7.5a2.25 2.25 0 00-2.25-2.25H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 11.409a2.25 2.25 0 01-1.07-1.916V9.75z" />
  </svg>
);

const IconDoc = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const IconClock = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconToggle = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
  </svg>
);

export default function AiTransparency() {
  const { t } = useTranslation();

  return (
    <SecurityPageLayout titleKey="security.aiTransparencyTitle">
      <Seo
        path="/security/ai-processing"
        titleKey="seo.securityAiProcessing.title"
        descriptionKey="seo.securityAiProcessing.description"
        title="How AI Processing Works — PR-TOP Transparency"
        description="Full transparency: which AI models PR-TOP uses, what data leaves the platform, for which tasks, provider DPAs, retention periods, and how to disable AI."
      />

      {/* Subtitle banner */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
        {t('security.aiTrans.subtitle')}
      </div>

      {/* Block 1: Which models */}
      <Section icon={<IconCpu />} title={t('security.aiTrans.modelsTitle')}>
        <p>{t('security.aiTrans.modelsP1')}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {t('security.aiTrans.modelsOpenAI')}
            <CodeRef label="aiProviders/openai.js:10" />
          </li>
          <li>
            {t('security.aiTrans.modelsAnthropic')}
            <CodeRef label="aiProviders/anthropic.js:11" />
          </li>
          <li>
            {t('security.aiTrans.modelsGoogle')}
            <CodeRef label="aiProviders/google.js:10" />
          </li>
          <li>
            {t('security.aiTrans.modelsOpenRouter')}
            <CodeRef label="aiProviders/openrouter.js:11" />
          </li>
        </ul>
        <p className="text-sm text-gray-500 italic">{t('security.aiTrans.modelsNote')}</p>
      </Section>

      {/* Block 2: What data leaves */}
      <Section icon={<IconShare />} title={t('security.aiTrans.dataTitle')}>
        <p>{t('security.aiTrans.dataP1')}</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t('security.aiTrans.dataTranscription')}</li>
          <li>{t('security.aiTrans.dataSummarization')}</li>
          <li>{t('security.aiTrans.dataExercise')}</li>
          <li>{t('security.aiTrans.dataSearch')}</li>
          <li>{t('security.aiTrans.dataChatbot')}</li>
        </ul>
      </Section>

      {/* Block 3: Tasks */}
      <Section icon={<IconTask />} title={t('security.aiTrans.tasksTitle')}>
        <p>{t('security.aiTrans.tasksP1')}</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>{t('security.aiTrans.tasksItem1')}</li>
          <li>
            {t('security.aiTrans.tasksItem2')}
            <CodeRef label="aiUsageLogger.js" />
          </li>
          <li>{t('security.aiTrans.tasksItem3')}</li>
          <li>{t('security.aiTrans.tasksItem4')}</li>
          <li>{t('security.aiTrans.tasksItem5')}</li>
          <li>{t('security.aiTrans.tasksItem6')}</li>
        </ol>
      </Section>

      {/* Block 4: Where stored */}
      <Section icon={<IconServer />} title={t('security.aiTrans.storageTitle')}>
        <p>{t('security.aiTrans.storageP1')}</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t('security.aiTrans.storageOpenAI')}</li>
          <li>{t('security.aiTrans.storageAnthropic')}</li>
          <li>{t('security.aiTrans.storageGoogle')}</li>
          <li>{t('security.aiTrans.storageOpenRouter')}</li>
        </ul>
        <p className="text-sm bg-amber-50 border border-amber-100 rounded p-3 text-amber-700">
          {t('security.aiTrans.storageNote')}
        </p>
      </Section>

      {/* Block 5: DPAs */}
      <Section icon={<IconDoc />} title={t('security.aiTrans.dpaTitle')}>
        <p>{t('security.aiTrans.dpaP1')}</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <ExternalLink href={t('security.aiTrans.dpaOpenAIUrl')}>
              {t('security.aiTrans.dpaOpenAI')}
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href={t('security.aiTrans.dpaAnthropicUrl')}>
              {t('security.aiTrans.dpaAnthropic')}
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href={t('security.aiTrans.dpaGoogleUrl')}>
              {t('security.aiTrans.dpaGoogle')}
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href={t('security.aiTrans.dpaOpenRouterUrl')}>
              {t('security.aiTrans.dpaOpenRouter')}
            </ExternalLink>
          </li>
        </ul>
        <p className="text-sm text-gray-500 italic">{t('security.aiTrans.dpaNote')}</p>
      </Section>

      {/* Block 6: Retention */}
      <Section icon={<IconClock />} title={t('security.aiTrans.retentionTitle')}>
        <p>{t('security.aiTrans.retentionP1')}</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t('security.aiTrans.retentionOpenAI')}</li>
          <li>{t('security.aiTrans.retentionAnthropic')}</li>
          <li>{t('security.aiTrans.retentionGoogle')}</li>
          <li>{t('security.aiTrans.retentionOpenRouter')}</li>
        </ul>
        <p className="text-sm text-gray-500 italic">{t('security.aiTrans.retentionNote')}</p>
      </Section>

      {/* Block 7: Opt-out */}
      <Section icon={<IconToggle />} title={t('security.aiTrans.optOutTitle')}>
        <p>{t('security.aiTrans.optOutP1')}</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t('security.aiTrans.optOutItem1')}</li>
          <li>{t('security.aiTrans.optOutItem2')}</li>
          <li>{t('security.aiTrans.optOutItem3')}</li>
          <li>{t('security.aiTrans.optOutItem4')}</li>
          <li>{t('security.aiTrans.optOutItem5')}</li>
        </ul>
        <p className="text-sm bg-green-50 border border-green-100 rounded p-3 text-green-800">
          {t('security.aiTrans.optOutP2')}
        </p>
      </Section>
    </SecurityPageLayout>
  );
}
