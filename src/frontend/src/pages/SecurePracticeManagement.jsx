import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /secure-practice-management  —  Secure practice management for therapists (localized en/ru/uk/es).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Comparison table — PR-TOP vs non-secure alternatives
 *   4. FAQ block + FAQPage JSON-LD
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + all four security pages:
 *      /security/encryption, /security/gdpr, /security/audit-log,
 *      /security/data-sovereignty, plus /ai-practice-management
 *   7. PR-TOP wedge in first two H2 sections — diary, exercises, crisis
 *      alerts and Telegram named alongside the security story
 *
 * Both Article and FAQPage JSON-LD included, dateModified: '2026-07-12'.
 */

const CONTENT = {
  en: {
    seoTitle: 'Secure practice management for therapists — PR-TOP',
    seoDescription:
      'Secure practice management for therapists: EU-hosted AES encryption, consent enforcement and audit log. Includes Telegram diary, exercises and SOS. GDPR-first.',
    articleHeadline: 'Secure practice management for therapists — how PR-TOP protects client data',
    articleDescription:
      'How PR-TOP delivers secure practice management for therapists: application-layer AES encryption, EU hosting, consent enforcement, immutable audit log, and a Telegram client channel for diary, exercises and SOS.',
    badge: 'Security',
    h1: 'Secure practice management for therapists — how PR-TOP protects client data',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',
    intro:
      'PR-TOP encrypts all client data at the application layer before it reaches the database, stores everything on EU servers, enforces client consent on every data route, and logs every access in an immutable audit trail. Diary, sessions, notes, exercises and SOS alerts are managed from one encrypted workspace — never a generic cloud folder.',

    whatSecureMeansTitle: 'What "secure" means in practice management',
    whatSecureMeansP1:
      'Most note-taking and EHR tools rely on database-level or transport-level encryption. That means your cloud provider — and anyone who gains access to the database — can read client records in plain text. PR-TOP takes a different approach: every piece of Class A data (client diary entries, session transcripts, private therapist notes, AI summaries) is encrypted at the application layer using AES before it is written to the database. The database itself holds only ciphertext.',
    whatSecureMeansP2:
      'Beyond encryption, "secure" in PR-TOP means consent enforcement on every API route. A client\'s diary cannot be read — even by the therapist who created the workspace — unless the client has explicitly consented via the Telegram bot. Consent can be withdrawn at any time, and withdrawal immediately blocks access. This design reflects Article 9 GDPR requirements for sensitive health data.',
    whatSecureMeansP3:
      'Every read, write and delete action on client data is written to an append-only audit log. Therapists can review the full history of who accessed what, when, and from which IP — a requirement for many EU supervisory bodies and professional indemnity insurers.',
    whatSecureMeansSeeEncryption: 'See the full ',
    whatSecureMeansLinkEncryption: 'encryption architecture',
    whatSecureMeansSeeAudit: ' and ',
    whatSecureMeansLinkAudit: 'audit log documentation',
    whatSecureMeansTail: '.',

    clientChannelTitle: 'The client channel: diary, exercises and SOS in Telegram',
    clientChannelP1:
      'A secure practice management platform is only useful if clients can interact with it safely. PR-TOP\'s client interface is a Telegram bot — an app most EU, CIS and LATAM clients already have on their phones. Clients send voice messages, text entries and short video clips between sessions. All diary content is encrypted before storage; the therapist sees it in the dashboard only after the client has consented.',
    clientChannelP2:
      'Therapists assign exercises from a multilingual library directly through the dashboard or by messaging the bot. The bot delivers assignments to clients, tracks completion, and surfaces results back in the therapist\'s session timeline. There is no separate client-facing web app to maintain, no password reset flow to support, and no sensitive data sitting in a standard email thread.',
    clientChannelP3:
      'Crisis management is built in. A client can trigger a one-tap SOS from Telegram; PR-TOP routes the alert through all configured channels (dashboard notification, email, secondary SMS if configured) and opens a tracked escalation lifecycle so nothing falls through the cracks. The full SOS history is part of the encrypted, audited client record.',

    encryptionTitle: 'Encryption and data protection',
    encryptionP1:
      'PR-TOP separates data into two classes. Class A data — diary entries, session transcripts, AI summaries, private therapist notes — is encrypted at the application layer with AES before being written to SQLite. Class B data — timestamps, session IDs, metadata — is stored as access-controlled plaintext to allow efficient querying without exposing content.',
    encryptionP2:
      'Uploaded session audio and video files are stored with opaque, randomised IDs. Streaming playback requires a signed access token that expires after a short window, so guessing a file URL does not grant access. Whisper transcription jobs run on the same EU infrastructure; audio is not forwarded to third-party transcription services unless explicitly configured by the operator.',
    encryptionP3:
      'The AI layer is configurable: therapists can choose which LLM provider generates session summaries. No client content is sent to any AI provider until the therapist explicitly requests a summary, and the request is logged in the audit trail.',
    encryptionSee: 'Full technical details: ',
    encryptionLink: 'encryption architecture →',

    consentTitle: 'Consent and audit controls',
    consentP1:
      'Consent is a first-class concept in PR-TOP. Each client has a consent record stored alongside their profile. Before any Class A data route returns data, the API checks whether current consent exists. If the client has withdrawn consent — or if consent was never given — the route returns an empty response, not an error. This makes consent enforcement testable and auditable.',
    consentP2:
      'The audit log captures every data access event: which therapist, which client record, which action (read/write/delete), timestamp, and originating IP. Logs are append-only — they cannot be modified or deleted through the normal application flow. Therapists can export the full audit trail for a client as part of a GDPR Subject Access Request response.',
    consentP3:
      'Account deletion is a full wipe: all encrypted Class A data, consent records, audit entries and uploaded files are deleted from the server. A deletion receipt with a cryptographic hash is generated so the therapist has proof of erasure for regulatory purposes.',
    consentSee: 'See also: ',
    consentLinkAudit: 'audit log →',
    consentLinkGdpr: 'GDPR compliance →',

    sovereigntyTitle: 'EU hosting and data sovereignty',
    sovereigntyP1:
      'PR-TOP is hosted exclusively on Hetzner infrastructure within the European Union. No client data transits to US-based cloud providers, US-hosted CDNs or US analytics services. The analytics layer uses a self-hosted Umami instance — GDPR-compliant, cookieless, and under the operator\'s control — rather than Google Analytics or Mixpanel.',
    sovereigntyP2:
      'A Data Processing Addendum is available by default for all paying plans. Therapists in EU member states can reference the DPA in their own data processing documentation for clients. The operator can also choose to self-host the entire PR-TOP stack on their own EU server, in which case no data leaves their infrastructure at all.',
    sovereigntyP3:
      'This matters for therapists working under national health authority contracts, school counsellors subject to local authority data governance rules, and any practice registered with a EU supervisory body that audits data residency.',
    sovereigntySee: 'Full details: ',
    sovereigntyLink: 'data sovereignty and EU hosting →',

    tableTitle: 'PR-TOP vs non-secure alternatives',
    tableHead: { feature: 'Feature', prtop: 'PR-TOP', genericNote: 'Generic note app', usEhr: 'US EHR (US-hosted)', gDrive: 'Google/Dropbox storage' },
    tableRows: [
      {
        label: 'Hosting',
        p: 'EU-only (Hetzner)',
        g: 'Varies — often US or mixed',
        u: 'US data centres',
        d: 'US data centres',
      },
      {
        label: 'Encryption model',
        p: 'Application-layer AES for Class A data',
        g: 'Transport (TLS) only',
        u: 'Database-level or TLS only',
        d: 'At-rest (provider holds keys)',
      },
      {
        label: 'Client diary / Telegram bot',
        p: 'Built in — voice, text, video',
        g: 'Not in scope',
        u: 'Rare; no Telegram integration',
        d: 'Not in scope',
      },
      {
        label: 'Exercises',
        p: 'Multilingual library + custom; assigned via bot',
        g: 'Not in scope',
        u: 'Some; separate module',
        d: 'Not in scope',
      },
      {
        label: 'SOS / crisis alerts',
        p: 'One-tap client SOS → multi-channel notify',
        g: 'Not in scope',
        u: 'Some; phone/pager only',
        d: 'Not in scope',
      },
      {
        label: 'Consent enforcement',
        p: 'API-level — blocks reads if consent absent',
        g: 'Manual at best',
        u: 'Varies; form-based',
        d: 'None',
      },
      {
        label: 'Audit log',
        p: 'Immutable, append-only, exportable',
        g: 'None or basic activity log',
        u: 'Usually present; varies',
        d: 'Activity log only (Google Workspace)',
      },
      {
        label: 'GDPR DPA',
        p: 'Included by default (paid plans)',
        g: 'Rarely provided',
        u: 'SCCs only (US-registered entity)',
        d: 'Standard terms; EU SCCs',
      },
      {
        label: 'AI session notes',
        p: 'Yes — configurable providers, Whisper transcription',
        g: 'Sometimes',
        u: 'Yes — US-hosted LLMs',
        d: 'No',
      },
      {
        label: 'Self-hostable',
        p: 'Yes — full stack on your EU server',
        g: 'Rarely',
        u: 'No',
        d: 'No',
      },
      {
        label: 'Languages',
        p: 'EN / RU / UK / ES',
        g: 'Usually English only',
        u: 'Usually English only',
        d: 'UI only; no clinical i18n',
      },
      {
        label: 'Analytics tracker',
        p: 'Self-hosted Umami — no cookies, GDPR-compliant',
        g: 'Google Analytics or similar',
        u: 'Varies',
        d: 'Google',
      },
    ],
    tableNote:
      'Comparison based on publicly available information as of July 2026. "Generic note app" refers to tools like Notion, Bear, or Obsidian repurposed for clinical notes. "US EHR" refers to typical US-registered EHR/practice-management platforms.',

    securityLinksTitle: 'Dive deeper into PR-TOP security',
    securityLinks: [
      {
        path: '/security/encryption',
        title: 'Encryption architecture',
        desc: 'How AES application-layer encryption protects Class A data from database exposure.',
      },
      {
        path: '/security/gdpr',
        title: 'GDPR compliance',
        desc: 'Lawful basis, data subject rights, DPA, consent flows and erasure receipts.',
      },
      {
        path: '/security/audit-log',
        title: 'Immutable audit log',
        desc: 'Append-only access log, exportable for Subject Access Requests and indemnity audits.',
      },
      {
        path: '/security/data-sovereignty',
        title: 'EU hosting & data sovereignty',
        desc: 'Hetzner EU-only hosting, self-hosting option, no US data transfers, cookieless analytics.',
      },
    ],

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'How is PR-TOP more secure than keeping notes in Google Drive or Notion?',
        a: 'Google Drive and Notion use at-rest encryption where the cloud provider holds the keys — a subpoena, a breach, or a misconfigured share can expose plain-text content. PR-TOP encrypts Class A data (diary entries, transcripts, notes, summaries) at the application layer before writing to the database, so the server itself never holds decrypted client content. Access is also consent-gated and every read is logged in an immutable audit trail. Neither Google Drive nor Notion provides GDPR-compliant consent enforcement or an audit log suitable for health data.',
      },
      {
        q: 'Is PR-TOP compliant with GDPR for EU therapists?',
        a: 'PR-TOP is designed GDPR-first: EU-only hosting (Hetzner), a Data Processing Addendum available by default on paid plans, consent enforcement at the API level, full data export and erasure on request, and cookieless self-hosted analytics (Umami). The platform does not use Google Analytics, Facebook Pixel or any other third-party tracker. Therapists in EU member states can reference the DPA in their own controller documentation. Self-hosting is also supported for practices under strict national health authority data governance rules.',
      },
      {
        q: 'What data does PR-TOP encrypt, and what is left unencrypted?',
        a: 'PR-TOP splits data into Class A and Class B. Class A data — client diary entries, session audio/video, transcripts, AI summaries, and private therapist notes — is encrypted at the application layer with AES before it is written to the database. Class B data — session IDs, timestamps, plan metadata, and routing information — is stored as access-controlled plaintext to support efficient queries. No Class A content is ever written to the database in plain text.',
      },
      {
        q: 'What happens when a client withdraws consent?',
        a: 'Consent withdrawal takes effect immediately. Every API route that returns Class A data checks for a valid, current consent record before responding. If consent has been withdrawn, the route returns an empty response — no error, no data. The audit log records the withdrawal event. The therapist can still see that a client record exists and access Class B metadata, but all encrypted content is inaccessible until consent is re-granted.',
      },
      {
        q: 'Can I use PR-TOP\'s Telegram bot without storing data in the cloud?',
        a: 'Yes, through self-hosting. PR-TOP\'s full stack — the React dashboard, Node.js API, SQLite database, and Telegram bot — can be deployed on your own EU server. In self-hosted mode, no data leaves your infrastructure. Telegram message payloads pass through Telegram\'s servers (as with any Telegram bot), but all storage and processing happens on your host. The PR-TOP team provides deployment guides for Dokploy and standard VPS setups.',
      },
      {
        q: 'Does PR-TOP send client data to OpenAI or other AI providers?',
        a: 'Only on explicit request. AI-generated session summaries and note drafts are produced when the therapist clicks "Generate summary" — no automatic background processing happens. The request, the provider used, and the response are logged in the audit trail. The AI provider is configurable: practices with strict data residency requirements can configure a locally-hosted model or a EU-resident provider instead of the default. No client diary content is ever forwarded to an AI provider without a deliberate therapist action.',
      },
    ],

    ctaTitle: 'Start managing your practice securely',
    ctaText:
      'The free Trial takes about ten minutes to set up. No credit card required. You get the encrypted dashboard, the Telegram client bot, diary, exercises and SOS for a limited number of clients. Export your data and leave at any time — no lock-in.',
    ctaButton: 'Start free trial',
    ctaAi: 'See AI practice management features',
    ctaGdpr: 'Read the GDPR compliance page',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'Безопасное ведение практики для психологов — PR-TOP',
    seoDescription:
      'PR-TOP: зашифрованное управление практикой в ЕС — дневник клиента, упражнения, SOS и заметки сессий. AES-шифрование, GDPR-first, журнал аудита.',
    articleHeadline: 'Безопасное ведение практики для психологов — как PR-TOP защищает данные клиентов',
    articleDescription:
      'Как PR-TOP обеспечивает безопасное ведение практики: шифрование AES на уровне приложения, хостинг в ЕС, контроль согласий, неизменяемый журнал аудита и канал для клиентов в Telegram.',
    badge: 'Безопасность',
    h1: 'Безопасное ведение практики для психологов — как PR-TOP защищает данные клиентов',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',
    intro:
      'PR-TOP шифрует все данные клиентов на уровне приложения до записи в базу данных, хранит всё на серверах в ЕС, проверяет согласие клиента на каждом маршруте API и фиксирует все действия в неизменяемом журнале аудита. Дневник, сессии, заметки, упражнения и SOS-оповещения — в едином зашифрованном пространстве.',

    whatSecureMeansTitle: 'Что «безопасность» значит на практике',
    whatSecureMeansP1:
      'Большинство приложений для заметок и EHR используют шифрование на уровне базы данных или транспорта. Это означает, что ваш облачный провайдер — и любой, кто получил доступ к базе данных, — может читать записи клиентов в открытом виде. PR-TOP использует другой подход: каждый фрагмент данных класса A (записи дневника клиента, транскрипты сессий, приватные заметки психолога, AI-резюме) шифруется на уровне приложения с помощью AES перед записью в базу данных. Сама база хранит только зашифрованный текст.',
    whatSecureMeansP2:
      'Помимо шифрования, «безопасность» в PR-TOP означает обязательную проверку согласия клиента на каждом маршруте API. Дневник клиента нельзя прочитать — даже психологу, создавшему рабочее пространство, — если клиент явно не дал согласие через Telegram-бот. Согласие можно отозвать в любой момент, и после отзыва доступ блокируется немедленно. Эта архитектура соответствует требованиям статьи 9 GDPR к чувствительным данным о здоровье.',
    whatSecureMeansP3:
      'Каждое действие чтения, записи и удаления клиентских данных фиксируется в журнале аудита только для добавления. Психологи могут просмотреть полную историю: кто, к каким данным, когда и с какого IP-адреса обращался — это требование многих надзорных органов в ЕС и страховщиков профессиональной ответственности.',
    whatSecureMeansSeeEncryption: 'Подробнее: ',
    whatSecureMeansLinkEncryption: 'архитектура шифрования',
    whatSecureMeansSeeAudit: ' и ',
    whatSecureMeansLinkAudit: 'документация журнала аудита',
    whatSecureMeansTail: '.',

    clientChannelTitle: 'Канал для клиентов: дневник, упражнения и SOS в Telegram',
    clientChannelP1:
      'Безопасная платформа для ведения практики полезна только тогда, когда клиенты могут взаимодействовать с ней в защищённой среде. Клиентский интерфейс PR-TOP — Telegram-бот: приложение, которым большинство клиентов в ЕС, СНГ и LATAM и так пользуются ежедневно. Клиенты отправляют голосовые сообщения, текстовые записи и короткие видеоклипы между сессиями. Всё содержимое дневника шифруется перед сохранением; психолог видит его в кабинете только после того, как клиент дал согласие.',
    clientChannelP2:
      'Психологи назначают упражнения из многоязычной библиотеки прямо через кабинет или через бот. Бот доставляет задания клиентам, отслеживает выполнение и отображает результаты в хронологии сессий психолога. Не нужно отдельного веб-приложения для клиентов, процедур сброса паролей и чувствительных данных в обычной электронной почте.',
    clientChannelP3:
      'Кризисное реагирование встроено в платформу. Клиент может отправить SOS в одно касание из Telegram; PR-TOP маршрутизирует оповещение по всем настроенным каналам (уведомление в кабинете, email, SMS при необходимости) и открывает отслеживаемый жизненный цикл эскалации, чтобы ничего не было упущено. Полная история SOS является частью зашифрованной и проаудированной записи клиента.',

    encryptionTitle: 'Шифрование и защита данных',
    encryptionP1:
      'PR-TOP разделяет данные на два класса. Данные класса A — записи дневника, транскрипты сессий, AI-резюме, приватные заметки психолога — шифруются на уровне приложения с помощью AES перед записью в SQLite. Данные класса B — временны́е метки, идентификаторы сессий, метаданные — хранятся в виде контролируемого открытого текста для эффективных запросов без раскрытия содержимого.',
    encryptionP2:
      'Загружённые аудио- и видеофайлы сессий хранятся с непрозрачными случайными идентификаторами. Потоковое воспроизведение требует подписанного токена доступа с ограниченным сроком действия, поэтому угадывание URL файла не даёт доступа. Задания по транскрипции Whisper выполняются на той же инфраструктуре в ЕС; аудио не передаётся сторонним сервисам транскрипции, если только оператор не настроил это явно.',
    encryptionP3:
      'Уровень AI настраивается: психологи могут выбрать, какой LLM-провайдер генерирует резюме сессий. Контент клиентов не отправляется ни одному AI-провайдеру до тех пор, пока психолог явно не запросит резюме, и этот запрос фиксируется в журнале аудита.',
    encryptionSee: 'Технические подробности: ',
    encryptionLink: 'архитектура шифрования →',

    consentTitle: 'Управление согласиями и контроль аудита',
    consentP1:
      'Согласие — ключевое понятие в PR-TOP. У каждого клиента есть запись о согласии, хранящаяся вместе с его профилем. Прежде чем маршрут API класса A вернёт данные, API проверяет наличие действующего согласия. Если клиент отозвал согласие — или если оно никогда не было дано — маршрут возвращает пустой ответ, а не ошибку. Это делает проверку согласия тестируемой и проверяемой.',
    consentP2:
      'Журнал аудита фиксирует каждое событие доступа к данным: какой психолог, к какой записи клиента, какое действие (чтение/запись/удаление), временна́я метка и IP-адрес источника. Логи доступны только для добавления — они не могут быть изменены или удалены через стандартный поток приложения. Психологи могут экспортировать полный журнал аудита по клиенту в рамках ответа на запрос субъекта данных по GDPR.',
    consentP3:
      'Удаление аккаунта — это полное стирание: все зашифрованные данные класса A, записи о согласиях, записи аудита и загруженные файлы удаляются с сервера. Генерируется квитанция об удалении с криптографическим хешем, чтобы у психолога было доказательство уничтожения данных для регуляторных целей.',
    consentSee: 'Смотрите также: ',
    consentLinkAudit: 'журнал аудита →',
    consentLinkGdpr: 'соответствие GDPR →',

    sovereigntyTitle: 'Хостинг в ЕС и суверенитет данных',
    sovereigntyP1:
      'PR-TOP размещён исключительно на инфраструктуре Hetzner в Европейском союзе. Данные клиентов не передаются облачным провайдерам в США, CDN с хостингом в США или аналитическим сервисам в США. Аналитический уровень использует self-hosted экземпляр Umami — без cookies, GDPR-совместимый и под контролем оператора — вместо Google Analytics или Mixpanel.',
    sovereigntyP2:
      'Дополнение к договору об обработке данных (DPA) доступно по умолчанию для всех платных планов. Психологи в государствах — членах ЕС могут ссылаться на DPA в собственной документации по обработке данных для клиентов. Оператор также может разместить весь стек PR-TOP на собственном сервере в ЕС, и тогда данные вообще не покинут его инфраструктуру.',
    sovereigntyP3:
      'Это важно для психологов, работающих по контрактам национальных органов здравоохранения, школьных консультантов, подпадающих под правила управления данными местных органов власти, и любых практик, зарегистрированных в надзорных органах ЕС, проверяющих резиденцию данных.',
    sovereigntySee: 'Подробнее: ',
    sovereigntyLink: 'суверенитет данных и хостинг в ЕС →',

    tableTitle: 'PR-TOP vs незащищённые альтернативы',
    tableHead: { feature: 'Функция', prtop: 'PR-TOP', genericNote: 'Обычное приложение для заметок', usEhr: 'US EHR (хостинг в США)', gDrive: 'Google/Dropbox' },
    tableRows: [
      { label: 'Хостинг', p: 'Только ЕС (Hetzner)', g: 'Варьируется — часто США или смешанный', u: 'Дата-центры в США', d: 'Дата-центры в США' },
      { label: 'Модель шифрования', p: 'AES на уровне приложения для данных класса A', g: 'Только транспорт (TLS)', u: 'Уровень БД или только TLS', d: 'At-rest (ключи у провайдера)' },
      { label: 'Дневник клиента / Telegram-бот', p: 'Встроен — голос, текст, видео', g: 'Не предусмотрено', u: 'Редко; без интеграции с Telegram', d: 'Не предусмотрено' },
      { label: 'Упражнения', p: 'Многоязычная библиотека + кастомные; назначаются через бот', g: 'Не предусмотрено', u: 'Иногда; отдельный модуль', d: 'Не предусмотрено' },
      { label: 'SOS / кризисные оповещения', p: 'SOS клиента в одно касание → мультиканальное уведомление', g: 'Не предусмотрено', u: 'Иногда; только телефон/пейджер', d: 'Не предусмотрено' },
      { label: 'Контроль согласий', p: 'На уровне API — блокирует чтение без согласия', g: 'В лучшем случае вручную', u: 'Варьируется; на основе форм', d: 'Нет' },
      { label: 'Журнал аудита', p: 'Неизменяемый, только для добавления, экспортируемый', g: 'Нет или базовый журнал активности', u: 'Обычно есть; варьируется', d: 'Только журнал активности (Google Workspace)' },
      { label: 'GDPR DPA', p: 'Включён по умолчанию (платные планы)', g: 'Редко предоставляется', u: 'Только SCC (юрлицо в США)', d: 'Стандартные условия; EU SCC' },
      { label: 'AI-заметки сессий', p: 'Да — настраиваемые провайдеры, транскрипция Whisper', g: 'Иногда', u: 'Да — LLM с хостингом в США', d: 'Нет' },
      { label: 'Self-hosting', p: 'Да — весь стек на вашем сервере в ЕС', g: 'Редко', u: 'Нет', d: 'Нет' },
      { label: 'Языки', p: 'EN / RU / UK / ES', g: 'Обычно только английский', u: 'Обычно только английский', d: 'Только UI; без клинической i18n' },
      { label: 'Аналитика', p: 'Self-hosted Umami — без cookies, GDPR-совместимо', g: 'Google Analytics или аналог', u: 'Варьируется', d: 'Google' },
    ],
    tableNote:
      'Сравнение основано на публично доступной информации по состоянию на июль 2026 года. «Обычное приложение для заметок» — Notion, Bear, Obsidian и аналоги, используемые для клинических заметок.',

    securityLinksTitle: 'Подробнее о безопасности PR-TOP',
    securityLinks: [
      { path: '/security/encryption', title: 'Архитектура шифрования', desc: 'Как AES на уровне приложения защищает данные класса A от раскрытия через базу данных.' },
      { path: '/security/gdpr', title: 'Соответствие GDPR', desc: 'Правовые основания, права субъектов данных, DPA, потоки согласий и квитанции об удалении.' },
      { path: '/security/audit-log', title: 'Неизменяемый журнал аудита', desc: 'Журнал доступа только для добавления, экспортируемый для запросов субъектов данных и аудитов.' },
      { path: '/security/data-sovereignty', title: 'Хостинг в ЕС и суверенитет данных', desc: 'Хостинг только на Hetzner в ЕС, self-hosting, никаких передач данных в США, аналитика без cookies.' },
    ],

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'Чем PR-TOP безопаснее хранения заметок в Google Drive или Notion?',
        a: 'Google Drive и Notion используют шифрование at-rest, при котором ключи хранятся у облачного провайдера — судебный запрос, утечка или неправильно настроенный доступ могут раскрыть данные в открытом виде. PR-TOP шифрует данные класса A (записи дневника, транскрипты, заметки, резюме) на уровне приложения до записи в базу данных, поэтому сам сервер никогда не хранит расшифрованный контент клиентов. Доступ также ограничен согласиями, и каждое чтение фиксируется в неизменяемом журнале аудита. Ни Google Drive, ни Notion не обеспечивают GDPR-совместимого контроля согласий или журнала аудита, подходящего для медицинских данных.',
      },
      {
        q: 'Соответствует ли PR-TOP GDPR для психологов в ЕС?',
        a: 'PR-TOP создан с приоритетом GDPR: хостинг только в ЕС (Hetzner), DPA доступно по умолчанию на платных планах, проверка согласий на уровне API, полный экспорт данных и удаление по запросу, аналитика без cookies на self-hosted Umami. Платформа не использует Google Analytics, Facebook Pixel или иные сторонние трекеры. Психологи в государствах — членах ЕС могут ссылаться на DPA в собственной документации контроллёра. Self-hosting также поддерживается для практик, работающих под строгими правилами управления данными национальных органов здравоохранения.',
      },
      {
        q: 'Какие данные PR-TOP шифрует, а какие — нет?',
        a: 'PR-TOP делит данные на класс A и класс B. Данные класса A — записи дневника клиента, аудио/видео сессий, транскрипты, AI-резюме и приватные заметки психолога — шифруются на уровне приложения с помощью AES перед записью в базу данных. Данные класса B — идентификаторы сессий, временны́е метки, метаданные плана и маршрутизации — хранятся в виде контролируемого открытого текста для эффективных запросов. Контент класса A никогда не записывается в базу данных в открытом виде.',
      },
      {
        q: 'Что происходит, когда клиент отзывает согласие?',
        a: 'Отзыв согласия вступает в силу немедленно. Каждый маршрут API, возвращающий данные класса A, перед ответом проверяет наличие действующей записи о согласии. Если согласие отозвано, маршрут возвращает пустой ответ — без ошибки, без данных. Событие отзыва фиксируется в журнале аудита. Психолог по-прежнему видит, что запись клиента существует, и может получить доступ к метаданным класса B, но весь зашифрованный контент недоступен до повторного предоставления согласия.',
      },
      {
        q: 'Отправляет ли PR-TOP данные клиентов в OpenAI или другие AI-провайдеры?',
        a: 'Только по явному запросу. AI-резюме сессий и черновики заметок генерируются, когда психолог нажимает «Создать резюме» — никакой автоматической фоновой обработки не происходит. Запрос, использованный провайдер и ответ фиксируются в журнале аудита. AI-провайдер настраивается: практики со строгими требованиями к резиденции данных могут настроить локально развёрнутую модель или провайдера из ЕС вместо провайдера по умолчанию. Контент дневника клиента никогда не передаётся AI-провайдеру без намеренного действия психолога.',
      },
      {
        q: 'Можно ли попробовать PR-TOP без банковской карты?',
        a: 'Да. У PR-TOP есть бесплатный тариф Trial: зашифрованный кабинет, Telegram-бот для клиентов, дневник, упражнения и SOS доступны для ограниченного числа клиентов. Карта не нужна, автоматического перехода на платный план нет — вы переходите на него только по собственному решению. В любой момент можно экспортировать данные и уйти без привязки.',
      },
    ],

    ctaTitle: 'Начните вести практику безопасно',
    ctaText:
      'Настройка бесплатного Trial занимает около десяти минут. Без банковской карты. Вы получаете зашифрованный кабинет, Telegram-бот для клиентов, дневник, упражнения и SOS для ограниченного числа клиентов. Выгрузите данные и уйдите в любой момент — без привязки.',
    ctaButton: 'Начать бесплатно',
    ctaAi: 'AI-функции для ведения практики',
    ctaGdpr: 'Страница соответствия GDPR',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'Безпечне ведення практики для психологів — PR-TOP',
    seoDescription:
      'PR-TOP: зашифроване управління практикою у ЄС — щоденник клієнта, вправи, SOS та нотатки сесій. AES-шифрування, GDPR-first, журнал аудиту. Спробуйте.',
    articleHeadline: 'Безпечне ведення практики для психологів — як PR-TOP захищає дані клієнтів',
    articleDescription:
      'Як PR-TOP забезпечує безпечне ведення практики: шифрування AES на рівні застосунку, хостинг у ЄС, контроль згод, незмінний журнал аудиту та канал для клієнтів у Telegram.',
    badge: 'Безпека',
    h1: 'Безпечне ведення практики для психологів — як PR-TOP захищає дані клієнтів',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',
    intro:
      'PR-TOP шифрує всі дані клієнтів на рівні застосунку до запису в базу даних, зберігає все на серверах у ЄС, перевіряє згоду клієнта на кожному маршруті API та фіксує всі дії в незмінному журналі аудиту. Щоденник, сесії, нотатки, вправи та SOS-сповіщення — в єдиному зашифрованому просторі.',

    whatSecureMeansTitle: 'Що «безпека» означає у веденні практики',
    whatSecureMeansP1:
      'Більшість застосунків для нотаток і EHR покладаються на шифрування на рівні бази даних або транспорту. Це означає, що ваш хмарний провайдер — і будь-хто, хто отримав доступ до бази даних, — може читати записи клієнтів у відкритому вигляді. PR-TOP використовує інший підхід: кожен фрагмент даних класу A (записи щоденника клієнта, транскрипти сесій, приватні нотатки психолога, AI-резюме) шифрується на рівні застосунку за допомогою AES перед записом у базу даних. Сама база зберігає лише зашифрований текст.',
    whatSecureMeansP2:
      'Окрім шифрування, «безпека» в PR-TOP означає обов\'язкову перевірку згоди клієнта на кожному маршруті API. Щоденник клієнта не можна прочитати — навіть психологу, що створив робочий простір, — якщо клієнт явно не надав згоду через Telegram-бот. Згоду можна відкликати будь-якої миті, і після відкликання доступ блокується негайно. Ця архітектура відповідає вимогам статті 9 GDPR до чутливих даних про здоров\'я.',
    whatSecureMeansP3:
      'Кожна дія читання, запису та видалення клієнтських даних фіксується в журналі аудиту, доступному лише для додавання. Психологи можуть переглянути повну історію: хто, до яких даних, коли і з якої IP-адреси звертався — це вимога багатьох наглядових органів у ЄС та страховиків професійної відповідальності.',
    whatSecureMeansSeeEncryption: 'Докладніше: ',
    whatSecureMeansLinkEncryption: 'архітектура шифрування',
    whatSecureMeansSeeAudit: ' та ',
    whatSecureMeansLinkAudit: 'документація журналу аудиту',
    whatSecureMeansTail: '.',

    clientChannelTitle: 'Канал для клієнтів: щоденник, вправи та SOS у Telegram',
    clientChannelP1:
      'Безпечна платформа для ведення практики корисна лише тоді, коли клієнти можуть взаємодіяти з нею в захищеному середовищі. Клієнтський інтерфейс PR-TOP — Telegram-бот: застосунок, яким більшість клієнтів у ЄС, СНД та LATAM і так користуються щодня. Клієнти надсилають голосові повідомлення, текстові записи та короткі відеокліпи між сесіями. Весь вміст щоденника шифрується перед збереженням; психолог бачить його в кабінеті лише після того, як клієнт надав згоду.',
    clientChannelP2:
      'Психологи призначають вправи з багатомовної бібліотеки прямо через кабінет або через бот. Бот доставляє завдання клієнтам, відстежує виконання та відображає результати в хронології сесій психолога. Не потрібен окремий вебзастосунок для клієнтів, процедур скидання паролів і чутливих даних у звичайній електронній пошті.',
    clientChannelP3:
      'Кризове реагування вбудоване в платформу. Клієнт може надіслати SOS в один дотик із Telegram; PR-TOP маршрутизує сповіщення через усі налаштовані канали (сповіщення в кабінеті, email, SMS за потреби) та відкриває відстежуваний життєвий цикл ескалації, щоб нічого не було втрачено. Повна історія SOS є частиною зашифрованого та проаудованого запису клієнта.',

    encryptionTitle: 'Шифрування та захист даних',
    encryptionP1:
      'PR-TOP поділяє дані на два класи. Дані класу A — записи щоденника, транскрипти сесій, AI-резюме, приватні нотатки психолога — шифруються на рівні застосунку за допомогою AES перед записом у SQLite. Дані класу B — часові мітки, ідентифікатори сесій, метадані — зберігаються у вигляді контрольованого відкритого тексту для ефективних запитів без розкриття вмісту.',
    encryptionP2:
      'Завантажені аудіо- та відеофайли сесій зберігаються з непрозорими випадковими ідентифікаторами. Потокове відтворення потребує підписаного токена доступу з обмеженим терміном дії, тому вгадування URL файлу не надає доступу. Завдання транскрипції Whisper виконуються на тій самій інфраструктурі в ЄС; аудіо не передається стороннім сервісам транскрипції, якщо тільки оператор не налаштував це явно.',
    encryptionP3:
      'Рівень AI налаштовується: психологи можуть обрати, який LLM-провайдер генерує резюме сесій. Контент клієнтів не надсилається жодному AI-провайдеру, доки психолог явно не запросить резюме, і цей запит фіксується в журналі аудиту.',
    encryptionSee: 'Технічні подробиці: ',
    encryptionLink: 'архітектура шифрування →',

    consentTitle: 'Управління згодами та контроль аудиту',
    consentP1:
      'Згода — ключове поняття в PR-TOP. У кожного клієнта є запис про згоду, що зберігається разом із його профілем. Перш ніж маршрут API класу A поверне дані, API перевіряє наявність чинної згоди. Якщо клієнт відкликав згоду — або якщо вона ніколи не була надана — маршрут повертає порожню відповідь, а не помилку. Це робить перевірку згоди тестованою та перевіряємою.',
    consentP2:
      'Журнал аудиту фіксує кожну подію доступу до даних: який психолог, до якого запису клієнта, яка дія (читання/запис/видалення), часова мітка та IP-адреса джерела. Логи доступні лише для додавання — їх не можна змінити або видалити через стандартний потік застосунку. Психологи можуть експортувати повний журнал аудиту по клієнту в рамках відповіді на запит суб\'єкта даних за GDPR.',
    consentP3:
      'Видалення акаунту — це повне стирання: всі зашифровані дані класу A, записи про згоди, записи аудиту та завантажені файли видаляються з сервера. Генерується квитанція про видалення з криптографічним хешем, щоб у психолога був доказ знищення даних для регуляторних цілей.',
    consentSee: 'Дивіться також: ',
    consentLinkAudit: 'журнал аудиту →',
    consentLinkGdpr: 'відповідність GDPR →',

    sovereigntyTitle: 'Хостинг у ЄС та суверенітет даних',
    sovereigntyP1:
      'PR-TOP розміщений виключно на інфраструктурі Hetzner в Європейському союзі. Дані клієнтів не передаються хмарним провайдерам у США, CDN з хостингом у США або аналітичним сервісам у США. Аналітичний рівень використовує self-hosted екземпляр Umami — без cookies, GDPR-сумісний і під контролем оператора — замість Google Analytics або Mixpanel.',
    sovereigntyP2:
      'Доповнення до договору про обробку даних (DPA) доступне за замовчуванням для всіх платних планів. Психологи в державах — членах ЄС можуть посилатися на DPA у власній документації з обробки даних для клієнтів. Оператор також може розмістити весь стек PR-TOP на власному сервері в ЄС, і тоді дані взагалі не залишать його інфраструктуру.',
    sovereigntyP3:
      'Це важливо для психологів, що працюють за контрактами національних органів охорони здоров\'я, шкільних консультантів, що підпадають під правила управління даними місцевих органів влади, та будь-яких практик, зареєстрованих у наглядових органах ЄС, які перевіряють резиденцію даних.',
    sovereigntySee: 'Докладніше: ',
    sovereigntyLink: 'суверенітет даних та хостинг у ЄС →',

    tableTitle: 'PR-TOP vs незахищені альтернативи',
    tableHead: { feature: 'Функція', prtop: 'PR-TOP', genericNote: 'Звичайний застосунок для нотаток', usEhr: 'US EHR (хостинг у США)', gDrive: 'Google/Dropbox' },
    tableRows: [
      { label: 'Хостинг', p: 'Лише ЄС (Hetzner)', g: 'Варіюється — часто США або змішаний', u: 'Дата-центри у США', d: 'Дата-центри у США' },
      { label: 'Модель шифрування', p: 'AES на рівні застосунку для даних класу A', g: 'Лише транспорт (TLS)', u: 'Рівень БД або лише TLS', d: 'At-rest (ключі у провайдера)' },
      { label: 'Щоденник клієнта / Telegram-бот', p: 'Вбудовано — голос, текст, відео', g: 'Поза межами продукту', u: 'Рідко; без інтеграції з Telegram', d: 'Поза межами продукту' },
      { label: 'Вправи', p: 'Багатомовна бібліотека + кастомні; призначаються через бот', g: 'Поза межами продукту', u: 'Іноді; окремий модуль', d: 'Поза межами продукту' },
      { label: 'SOS / кризові сповіщення', p: 'SOS клієнта в один дотик → мультиканальне сповіщення', g: 'Поза межами продукту', u: 'Іноді; лише телефон/пейджер', d: 'Поза межами продукту' },
      { label: 'Контроль згод', p: 'На рівні API — блокує читання без згоди', g: 'У кращому разі вручну', u: 'Варіюється; на основі форм', d: 'Немає' },
      { label: 'Журнал аудиту', p: 'Незмінний, лише для додавання, що експортується', g: 'Немає або базовий журнал активності', u: 'Зазвичай є; варіюється', d: 'Лише журнал активності (Google Workspace)' },
      { label: 'GDPR DPA', p: 'Включено за замовчуванням (платні плани)', g: 'Рідко надається', u: 'Лише SCC (юрособа у США)', d: 'Стандартні умови; EU SCC' },
      { label: 'AI-нотатки сесій', p: 'Так — налаштовувані провайдери, транскрипція Whisper', g: 'Іноді', u: 'Так — LLM з хостингом у США', d: 'Ні' },
      { label: 'Self-hosting', p: 'Так — весь стек на вашому сервері у ЄС', g: 'Рідко', u: 'Ні', d: 'Ні' },
      { label: 'Мови', p: 'EN / RU / UK / ES', g: 'Зазвичай лише англійська', u: 'Зазвичай лише англійська', d: 'Лише UI; без клінічної i18n' },
      { label: 'Аналітика', p: 'Self-hosted Umami — без cookies, GDPR-сумісно', g: 'Google Analytics або аналог', u: 'Варіюється', d: 'Google' },
    ],
    tableNote:
      'Порівняння засноване на публічно доступній інформації станом на липень 2026 року. «Звичайний застосунок для нотаток» — Notion, Bear, Obsidian та аналоги, що використовуються для клінічних нотаток.',

    securityLinksTitle: 'Докладніше про безпеку PR-TOP',
    securityLinks: [
      { path: '/security/encryption', title: 'Архітектура шифрування', desc: 'Як AES на рівні застосунку захищає дані класу A від розкриття через базу даних.' },
      { path: '/security/gdpr', title: 'Відповідність GDPR', desc: 'Правові підстави, права суб\'єктів даних, DPA, потоки згод та квитанції про видалення.' },
      { path: '/security/audit-log', title: 'Незмінний журнал аудиту', desc: 'Журнал доступу лише для додавання, що експортується для запитів суб\'єктів даних та аудитів.' },
      { path: '/security/data-sovereignty', title: 'Хостинг у ЄС та суверенітет даних', desc: 'Хостинг лише на Hetzner у ЄС, self-hosting, жодних передач даних у США, аналітика без cookies.' },
    ],

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'Чим PR-TOP безпечніший за зберігання нотаток у Google Drive або Notion?',
        a: 'Google Drive і Notion використовують шифрування at-rest, при якому ключі зберігаються у хмарного провайдера — судовий запит, витік або неправильно налаштований доступ можуть розкрити дані у відкритому вигляді. PR-TOP шифрує дані класу A (записи щоденника, транскрипти, нотатки, резюме) на рівні застосунку до запису в базу даних, тому сам сервер ніколи не зберігає розшифрований контент клієнтів. Доступ також обмежений згодами, і кожне читання фіксується в незмінному журналі аудиту. Ні Google Drive, ні Notion не забезпечують GDPR-сумісного контролю згод або журналу аудиту, придатного для медичних даних.',
      },
      {
        q: 'Чи відповідає PR-TOP GDPR для психологів у ЄС?',
        a: 'PR-TOP створений з пріоритетом GDPR: хостинг лише у ЄС (Hetzner), DPA доступне за замовчуванням на платних планах, перевірка згод на рівні API, повний експорт даних і видалення на запит, аналітика без cookies на self-hosted Umami. Платформа не використовує Google Analytics, Facebook Pixel або інші сторонні трекери. Психологи в державах — членах ЄС можуть посилатися на DPA у власній документації контролера. Self-hosting також підтримується для практик, що працюють під суворими правилами управління даними національних органів охорони здоров\'я.',
      },
      {
        q: 'Які дані PR-TOP шифрує, а які — ні?',
        a: 'PR-TOP ділить дані на клас A і клас B. Дані класу A — записи щоденника клієнта, аудіо/відео сесій, транскрипти, AI-резюме та приватні нотатки психолога — шифруються на рівні застосунку за допомогою AES перед записом у базу даних. Дані класу B — ідентифікатори сесій, часові мітки, метадані плану та маршрутизації — зберігаються у вигляді контрольованого відкритого тексту для ефективних запитів. Контент класу A ніколи не записується в базу даних у відкритому вигляді.',
      },
      {
        q: 'Що відбувається, коли клієнт відкликає згоду?',
        a: 'Відкликання згоди набирає чинності негайно. Кожен маршрут API, що повертає дані класу A, перед відповіддю перевіряє наявність чинного запису про згоду. Якщо згоду відкликано, маршрут повертає порожню відповідь — без помилки, без даних. Подія відкликання фіксується в журналі аудиту. Психолог усе ще бачить, що запис клієнта існує, і може отримати доступ до метаданих класу B, але весь зашифрований контент недоступний до повторного надання згоди.',
      },
      {
        q: 'Чи надсилає PR-TOP дані клієнтів до OpenAI або інших AI-провайдерів?',
        a: 'Лише за явним запитом. AI-резюме сесій та чернетки нотаток генеруються, коли психолог натискає «Створити резюме» — жодного автоматичного фонового оброблення не відбувається. Запит, використаний провайдер і відповідь фіксуються в журналі аудиту. AI-провайдер налаштовується: практики з суворими вимогами до резиденції даних можуть налаштувати локально розгорнуту модель або провайдера з ЄС замість провайдера за замовчуванням. Контент щоденника клієнта ніколи не передається AI-провайдеру без навмисної дії психолога.',
      },
      {
        q: 'Чи можна спробувати PR-TOP без банківської картки?',
        a: 'Так. PR-TOP має безкоштовний тариф Trial: зашифрований кабінет, Telegram-бот для клієнтів, щоденник, вправи та SOS доступні для обмеженої кількості клієнтів. Картка не потрібна, автоматичного переходу на платний план немає — ви переходите на нього лише за власним рішенням. У будь-який момент можна вивантажити дані й піти без прив\'язки.',
      },
    ],

    ctaTitle: 'Почніть вести практику безпечно',
    ctaText:
      'Налаштування безкоштовного Trial займає близько десяти хвилин. Без банківської картки. Ви отримуєте зашифрований кабінет, Telegram-бот для клієнтів, щоденник, вправи та SOS для обмеженої кількості клієнтів. Вивантажте дані й підіть будь-коли — без прив\'язки.',
    ctaButton: 'Почати безкоштовно',
    ctaAi: 'AI-функції для ведення практики',
    ctaGdpr: 'Сторінка відповідності GDPR',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Gestión de consulta segura para terapeutas — PR-TOP',
    seoDescription:
      'Gestión de consulta segura para terapeutas: PR-TOP cifra datos con AES, aloja en la UE y cumple el GDPR. Telegram para diario, ejercicios y SOS.',
    articleHeadline: 'Gestión de consulta segura para terapeutas — cómo PR-TOP protege los datos de los clientes',
    articleDescription:
      'Cómo PR-TOP proporciona gestión de consulta segura: cifrado AES en la capa de aplicación, alojamiento en la UE, control de consentimiento, registro de auditoría inmutable y canal de cliente en Telegram.',
    badge: 'Seguridad',
    h1: 'Gestión de consulta segura para terapeutas — cómo PR-TOP protege los datos de los clientes',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',
    intro:
      'PR-TOP cifra todos los datos de los clientes en la capa de aplicación antes de escribirlos en la base de datos, los almacena en servidores de la UE, verifica el consentimiento del cliente en cada ruta de API y registra cada acción en un registro de auditoría inmutable. Diario, sesiones, notas, ejercicios y alertas SOS se gestionan desde un único espacio de trabajo cifrado.',

    whatSecureMeansTitle: 'Qué significa "seguro" en la gestión de consulta',
    whatSecureMeansP1:
      'La mayoría de las herramientas de notas y EHR dependen del cifrado a nivel de base de datos o de transporte. Esto significa que su proveedor en la nube — y cualquiera que obtenga acceso a la base de datos — puede leer los registros de clientes en texto claro. PR-TOP adopta un enfoque diferente: cada fragmento de datos de clase A (entradas del diario del cliente, transcripciones de sesiones, notas privadas del terapeuta, resúmenes de IA) se cifra en la capa de aplicación con AES antes de escribirse en la base de datos. La base de datos en sí solo almacena texto cifrado.',
    whatSecureMeansP2:
      'Más allá del cifrado, "seguro" en PR-TOP significa control de consentimiento en cada ruta de API. El diario de un cliente no puede leerse — ni siquiera por el terapeuta que creó el espacio de trabajo — a menos que el cliente haya consentido explícitamente a través del bot de Telegram. El consentimiento puede retirarse en cualquier momento, y la retirada bloquea el acceso de inmediato. Este diseño refleja los requisitos del artículo 9 del GDPR para datos de salud sensibles.',
    whatSecureMeansP3:
      'Cada acción de lectura, escritura y eliminación sobre datos de clientes se registra en un log de solo adjunción. Los terapeutas pueden revisar el historial completo de quién accedió a qué, cuándo y desde qué IP — un requisito de muchos organismos supervisores de la UE y aseguradoras de responsabilidad profesional.',
    whatSecureMeansSeeEncryption: 'Más información: ',
    whatSecureMeansLinkEncryption: 'arquitectura de cifrado',
    whatSecureMeansSeeAudit: ' y ',
    whatSecureMeansLinkAudit: 'documentación del registro de auditoría',
    whatSecureMeansTail: '.',

    clientChannelTitle: 'El canal de clientes: diario, ejercicios y SOS en Telegram',
    clientChannelP1:
      'Una plataforma de gestión de consulta segura solo es útil si los clientes pueden interactuar con ella de forma segura. La interfaz de cliente de PR-TOP es un bot de Telegram — una aplicación que la mayoría de los clientes en la UE, la CEI y LATAM ya tienen en sus teléfonos. Los clientes envían mensajes de voz, entradas de texto y videoclips cortos entre sesiones. Todo el contenido del diario se cifra antes de almacenarse; el terapeuta lo ve en el panel solo después de que el cliente haya dado su consentimiento.',
    clientChannelP2:
      'Los terapeutas asignan ejercicios de una biblioteca multilingüe directamente desde el panel o mediante el bot. El bot entrega las tareas a los clientes, hace seguimiento de su realización y muestra los resultados en la cronología de sesiones del terapeuta. No hay una aplicación web separada para clientes que mantener, ni flujos de restablecimiento de contraseña que gestionar, ni datos sensibles en un hilo de correo electrónico estándar.',
    clientChannelP3:
      'La gestión de crisis está integrada. Un cliente puede activar un SOS con un toque desde Telegram; PR-TOP enruta la alerta por todos los canales configurados (notificación en el panel, correo electrónico, SMS secundario si está configurado) y abre un ciclo de vida de escalada rastreado para que nada se pierda. El historial completo de SOS forma parte del registro cifrado y auditado del cliente.',

    encryptionTitle: 'Cifrado y protección de datos',
    encryptionP1:
      'PR-TOP separa los datos en dos clases. Los datos de clase A — entradas del diario, transcripciones de sesiones, resúmenes de IA, notas privadas del terapeuta — se cifran en la capa de aplicación con AES antes de escribirse en SQLite. Los datos de clase B — marcas de tiempo, ID de sesión, metadatos — se almacenan como texto claro con control de acceso para permitir consultas eficientes sin exponer el contenido.',
    encryptionP2:
      'Los archivos de audio y vídeo de sesiones subidos se almacenan con IDs opacos y aleatorios. La reproducción en streaming requiere un token de acceso firmado que expira después de una ventana corta, por lo que adivinar una URL de archivo no otorga acceso. Los trabajos de transcripción de Whisper se ejecutan en la misma infraestructura de la UE; el audio no se reenvía a servicios de transcripción de terceros a menos que el operador lo configure explícitamente.',
    encryptionP3:
      'La capa de IA es configurable: los terapeutas pueden elegir qué proveedor de LLM genera los resúmenes de sesiones. Ningún contenido de clientes se envía a ningún proveedor de IA hasta que el terapeuta solicite explícitamente un resumen, y la solicitud queda registrada en el registro de auditoría.',
    encryptionSee: 'Detalles técnicos completos: ',
    encryptionLink: 'arquitectura de cifrado →',

    consentTitle: 'Control de consentimiento y auditoría',
    consentP1:
      'El consentimiento es un concepto de primer nivel en PR-TOP. Cada cliente tiene un registro de consentimiento almacenado junto a su perfil. Antes de que cualquier ruta de API de clase A devuelva datos, la API comprueba si existe consentimiento vigente. Si el cliente ha retirado el consentimiento — o si nunca se concedió — la ruta devuelve una respuesta vacía, no un error. Esto hace que el control de consentimiento sea testeable y auditable.',
    consentP2:
      'El registro de auditoría captura cada evento de acceso a datos: qué terapeuta, qué registro de cliente, qué acción (lectura/escritura/eliminación), marca de tiempo e IP de origen. Los registros son de solo adjunción — no pueden modificarse ni eliminarse mediante el flujo normal de la aplicación. Los terapeutas pueden exportar el registro de auditoría completo de un cliente como parte de una respuesta a una Solicitud de Acceso de Sujeto según el GDPR.',
    consentP3:
      'La eliminación de cuenta es un borrado completo: todos los datos cifrados de clase A, registros de consentimiento, entradas de auditoría y archivos subidos se eliminan del servidor. Se genera un recibo de eliminación con un hash criptográfico para que el terapeuta tenga prueba de borrado a efectos regulatorios.',
    consentSee: 'Véase también: ',
    consentLinkAudit: 'registro de auditoría →',
    consentLinkGdpr: 'cumplimiento del GDPR →',

    sovereigntyTitle: 'Alojamiento en la UE y soberanía de datos',
    sovereigntyP1:
      'PR-TOP está alojado exclusivamente en la infraestructura de Hetzner dentro de la Unión Europea. Ningún dato de clientes transita hacia proveedores de nube en EE. UU., CDN alojadas en EE. UU. ni servicios de análisis en EE. UU. La capa de análisis utiliza una instancia autoalojada de Umami — compatible con el GDPR, sin cookies y bajo el control del operador — en lugar de Google Analytics o Mixpanel.',
    sovereigntyP2:
      'Un Adendum de Procesamiento de Datos (DPA) está disponible por defecto en todos los planes de pago. Los terapeutas en estados miembros de la UE pueden hacer referencia al DPA en su propia documentación de procesamiento de datos para clientes. El operador también puede autoalojar todo el stack de PR-TOP en su propio servidor de la UE, en cuyo caso ningún dato abandona su infraestructura.',
    sovereigntyP3:
      'Esto es importante para terapeutas que trabajan bajo contratos de autoridades sanitarias nacionales, orientadores escolares sujetos a normas de gobernanza de datos de autoridades locales, y cualquier consulta registrada ante un organismo supervisor de la UE que audite la residencia de datos.',
    sovereigntySee: 'Detalles completos: ',
    sovereigntyLink: 'soberanía de datos y alojamiento en la UE →',

    tableTitle: 'PR-TOP vs alternativas no seguras',
    tableHead: { feature: 'Función', prtop: 'PR-TOP', genericNote: 'App de notas genérica', usEhr: 'EHR de EE. UU. (alojado en EE. UU.)', gDrive: 'Google/Dropbox' },
    tableRows: [
      { label: 'Alojamiento', p: 'Solo UE (Hetzner)', g: 'Variable — a menudo EE. UU. o mixto', u: 'Centros de datos en EE. UU.', d: 'Centros de datos en EE. UU.' },
      { label: 'Modelo de cifrado', p: 'AES en la capa de aplicación para datos de clase A', g: 'Solo transporte (TLS)', u: 'Nivel BD o solo TLS', d: 'At-rest (proveedor tiene las claves)' },
      { label: 'Diario del cliente / bot de Telegram', p: 'Integrado — voz, texto, vídeo', g: 'Fuera de su alcance', u: 'Poco común; sin integración con Telegram', d: 'Fuera de su alcance' },
      { label: 'Ejercicios', p: 'Biblioteca multilingüe + personalizados; asignados por el bot', g: 'Fuera de su alcance', u: 'Algunos; módulo separado', d: 'Fuera de su alcance' },
      { label: 'Alertas SOS / crisis', p: 'SOS del cliente con un toque → aviso multicanal', g: 'Fuera de su alcance', u: 'Algunos; solo teléfono/buscapersonas', d: 'Fuera de su alcance' },
      { label: 'Control de consentimiento', p: 'A nivel de API — bloquea lecturas sin consentimiento', g: 'Manual en el mejor caso', u: 'Variable; basado en formularios', d: 'Ninguno' },
      { label: 'Registro de auditoría', p: 'Inmutable, solo adjunción, exportable', g: 'Ninguno o log básico de actividad', u: 'Generalmente presente; variable', d: 'Solo log de actividad (Google Workspace)' },
      { label: 'GDPR DPA', p: 'Incluido por defecto (planes de pago)', g: 'Raramente disponible', u: 'Solo SCCs (entidad registrada en EE. UU.)', d: 'Términos estándar; EU SCCs' },
      { label: 'Notas de sesión con IA', p: 'Sí — proveedores configurables, transcripción Whisper', g: 'A veces', u: 'Sí — LLMs alojados en EE. UU.', d: 'No' },
      { label: 'Autoalojable', p: 'Sí — stack completo en su servidor de la UE', g: 'Raramente', u: 'No', d: 'No' },
      { label: 'Idiomas', p: 'EN / RU / UK / ES', g: 'Generalmente solo inglés', u: 'Generalmente solo inglés', d: 'Solo UI; sin i18n clínica' },
      { label: 'Análisis', p: 'Umami autoalojado — sin cookies, compatible con GDPR', g: 'Google Analytics o similar', u: 'Variable', d: 'Google' },
    ],
    tableNote:
      'Comparativa basada en información disponible públicamente a julio de 2026. "App de notas genérica" se refiere a herramientas como Notion, Bear u Obsidian reutilizadas para notas clínicas.',

    securityLinksTitle: 'Profundice en la seguridad de PR-TOP',
    securityLinks: [
      { path: '/security/encryption', title: 'Arquitectura de cifrado', desc: 'Cómo el cifrado AES en la capa de aplicación protege los datos de clase A de la exposición en base de datos.' },
      { path: '/security/gdpr', title: 'Cumplimiento del GDPR', desc: 'Base jurídica, derechos de los interesados, DPA, flujos de consentimiento y recibos de borrado.' },
      { path: '/security/audit-log', title: 'Registro de auditoría inmutable', desc: 'Log de acceso de solo adjunción, exportable para Solicitudes de Acceso de Sujeto y auditorías.' },
      { path: '/security/data-sovereignty', title: 'Alojamiento en la UE y soberanía de datos', desc: 'Alojamiento exclusivo en Hetzner (UE), opción de autoalojamiento, sin transferencias de datos a EE. UU., análisis sin cookies.' },
    ],

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿En qué es más seguro PR-TOP que guardar notas en Google Drive o Notion?',
        a: 'Google Drive y Notion usan cifrado at-rest donde el proveedor en la nube tiene las claves — una citación judicial, una brecha o un recurso compartido mal configurado puede exponer el contenido en texto claro. PR-TOP cifra los datos de clase A (entradas del diario, transcripciones, notas, resúmenes) en la capa de aplicación antes de escribirlos en la base de datos, por lo que el servidor en sí nunca almacena contenido de clientes descifrado. El acceso también está controlado por consentimiento y cada lectura se registra en un registro de auditoría inmutable. Ni Google Drive ni Notion proporcionan control de consentimiento compatible con el GDPR ni un registro de auditoría adecuado para datos de salud.',
      },
      {
        q: '¿Es PR-TOP conforme con el GDPR para terapeutas de la UE?',
        a: 'PR-TOP está diseñado con el GDPR como prioridad: alojamiento exclusivo en la UE (Hetzner), DPA disponible por defecto en los planes de pago, control de consentimiento a nivel de API, exportación completa de datos y borrado bajo petición, y análisis sin cookies con Umami autoalojado. La plataforma no usa Google Analytics, Facebook Pixel ni ningún otro rastreador de terceros. Los terapeutas en estados miembros de la UE pueden referenciar el DPA en su propia documentación de responsable del tratamiento. El autoalojamiento también está disponible para consultas sujetas a estrictas normas de gobernanza de datos de autoridades sanitarias nacionales.',
      },
      {
        q: '¿Qué datos cifra PR-TOP y qué queda sin cifrar?',
        a: 'PR-TOP divide los datos en clase A y clase B. Los datos de clase A — entradas del diario del cliente, audio/vídeo de sesiones, transcripciones, resúmenes de IA y notas privadas del terapeuta — se cifran en la capa de aplicación con AES antes de escribirse en la base de datos. Los datos de clase B — IDs de sesión, marcas de tiempo, metadatos de plan e información de enrutamiento — se almacenan como texto claro con control de acceso para consultas eficientes. Ningún contenido de clase A se escribe jamás en la base de datos en texto claro.',
      },
      {
        q: '¿Qué ocurre cuando un cliente retira el consentimiento?',
        a: 'La retirada del consentimiento surte efecto de inmediato. Cada ruta de API que devuelve datos de clase A comprueba si existe un registro de consentimiento válido y vigente antes de responder. Si el consentimiento ha sido retirado, la ruta devuelve una respuesta vacía — sin error, sin datos. El registro de auditoría registra el evento de retirada. El terapeuta aún puede ver que existe un registro del cliente y acceder a los metadatos de clase B, pero todo el contenido cifrado es inaccesible hasta que se vuelva a conceder el consentimiento.',
      },
      {
        q: '¿Envía PR-TOP datos de clientes a OpenAI u otros proveedores de IA?',
        a: 'Solo bajo petición explícita. Los resúmenes de sesiones generados por IA y los borradores de notas se producen cuando el terapeuta hace clic en "Generar resumen" — no se produce ningún procesamiento automático en segundo plano. La solicitud, el proveedor utilizado y la respuesta quedan registrados en el registro de auditoría. El proveedor de IA es configurable: las consultas con requisitos estrictos de residencia de datos pueden configurar un modelo alojado localmente o un proveedor con sede en la UE en lugar del predeterminado. Ningún contenido del diario del cliente se reenvía jamás a un proveedor de IA sin una acción deliberada del terapeuta.',
      },
      {
        q: '¿Puedo probar PR-TOP sin tarjeta de crédito?',
        a: 'Sí. PR-TOP tiene un nivel Trial gratuito con el panel cifrado, el bot de Telegram, el diario, los ejercicios y el SOS activados para un número limitado de clientes. No se requiere tarjeta y no hay conversión automática a un plan de pago: solo cambia de plan cuando usted lo decide. Puede exportar sus datos e irse en cualquier momento sin ataduras.',
      },
    ],

    ctaTitle: 'Empiece a gestionar su consulta de forma segura',
    ctaText:
      'La versión Trial gratuita se configura en unos diez minutos. Sin tarjeta de crédito. Obtiene el panel cifrado, el bot de Telegram para clientes, el diario, los ejercicios y el SOS para un número limitado de clientes. Exporte sus datos y váyase en cualquier momento sin ataduras.',
    ctaButton: 'Empezar gratis',
    ctaAi: 'Ver funciones de gestión con IA',
    ctaGdpr: 'Leer la página de cumplimiento del GDPR',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function SecurePracticeManagement() {
  const { i18n } = useTranslation();
  const lp = useLocalePath();
  const locale = ['ru', 'uk', 'es'].includes(i18n.language) ? i18n.language : 'en';
  const c = CONTENT[locale];
  const pageUrl = 'https://pr-top.com/secure-practice-management';

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.articleHeadline,
    description: c.articleDescription,
    inLanguage: locale,
    datePublished: '2026-07-12',
    dateModified: '2026-07-12',
    author: { '@type': 'Organization', name: 'PR-TOP' },
    publisher: { '@type': 'Organization', name: 'PR-TOP' },
    mainEntityOfPage: pageUrl,
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: c.faqItems.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <Seo
        path="/secure-practice-management"
        title={c.seoTitle}
        description={c.seoDescription}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to={lp('/')} className="flex items-center gap-2 text-primary font-bold text-lg">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            PR-TOP
          </Link>
          <Link to={lp('/')} className="text-sm text-gray-600 hover:text-primary transition-colors">
            &larr; {c.backHome}
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-3">
            {c.badge}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
            {c.h1}
          </h1>
          <p className="text-sm text-gray-500">{c.stamp}</p>
        </header>

        {/* Rule 1 — direct-answer block, 40-60 words. */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">{c.intro}</p>
        </div>

        {/* Rule 7 — wedge in first H2: encryption + Telegram channel named together. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whatSecureMeansTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whatSecureMeansP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whatSecureMeansP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whatSecureMeansP3}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.whatSecureMeansSeeEncryption}
            <Link to={lp('/security/encryption')} className="text-primary underline hover:no-underline">
              {c.whatSecureMeansLinkEncryption}
            </Link>
            {c.whatSecureMeansSeeAudit}
            <Link to={lp('/security/audit-log')} className="text-primary underline hover:no-underline">
              {c.whatSecureMeansLinkAudit}
            </Link>
            {c.whatSecureMeansTail}
          </p>
        </section>

        {/* Rule 7 — wedge in second H2: diary + exercises + crisis alerts + Telegram. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.clientChannelTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.clientChannelP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.clientChannelP2}</p>
          <p className="text-gray-700 leading-relaxed">{c.clientChannelP3}</p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.encryptionTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.encryptionP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.encryptionP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.encryptionP3}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.encryptionSee}
            <Link to={lp('/security/encryption')} className="text-primary underline hover:no-underline">
              {c.encryptionLink}
            </Link>
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.consentTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.consentP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.consentP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.consentP3}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.consentSee}
            <Link to={lp('/security/audit-log')} className="text-primary underline hover:no-underline">
              {c.consentLinkAudit}
            </Link>
            {' '}
            <Link to={lp('/security/gdpr')} className="text-primary underline hover:no-underline">
              {c.consentLinkGdpr}
            </Link>
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.sovereigntyTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.sovereigntyP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.sovereigntyP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.sovereigntyP3}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.sovereigntySee}
            <Link to={lp('/security/data-sovereignty')} className="text-primary underline hover:no-underline">
              {c.sovereigntyLink}
            </Link>
          </p>
        </section>

        {/* Rule 3 — comparison table */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.tableTitle}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.feature}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.prtop}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.genericNote}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.usEhr}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.gDrive}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.tableRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="p-3 border border-gray-200 font-medium">{row.label}</td>
                    <td className="p-3 border border-gray-200">{row.p}</td>
                    <td className="p-3 border border-gray-200">{row.g}</td>
                    <td className="p-3 border border-gray-200">{row.u}</td>
                    <td className="p-3 border border-gray-200">{row.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">{c.tableNote}</p>
        </section>

        {/* Security quick-links grid — links to all 4 security pages */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.securityLinksTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {c.securityLinks.map((link) => (
              <Link
                key={link.path}
                to={lp(link.path)}
                className="block p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group"
              >
                <p className="font-semibold text-gray-900 group-hover:text-primary transition-colors mb-1">
                  {link.title}
                </p>
                <p className="text-sm text-gray-600 leading-snug">{link.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Rule 4 — FAQ block */}
        <section className="mb-10" id="faq">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.faqTitle}
          </h2>
          <div className="space-y-6">
            {c.faqItems.map((item) => (
              <div key={item.q}>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-700 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA bottom — Rule 6: links to /, /ai-practice-management, /security/gdpr */}
        <section className="mb-4 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {c.ctaTitle}
          </h2>
          <p className="text-gray-700 mb-4">{c.ctaText}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={lp('/')}
              className="inline-flex items-center px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {c.ctaButton}
            </Link>
            <Link
              to={lp('/ai-practice-management')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaAi}
            </Link>
            <Link
              to={lp('/security/gdpr')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaGdpr}
            </Link>
          </div>
        </section>
      </article>

      <footer className="bg-gray-900 text-white/60 text-center py-6 text-xs">
        &copy; {new Date().getFullYear()} {c.footer}
      </footer>
    </div>
  );
}
