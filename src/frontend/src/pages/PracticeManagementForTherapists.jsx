import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /practice-management-for-therapists  —  Routine-intent SEO landing page.
 *
 * Feature R8 — targets non-AI queries: "practice management for therapists",
 * "reduce admin private practice", "how to organize therapy clients".
 *
 * Follows docs/seo/CONTENT_RULES.md (all 7 rules):
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy — H1 has NO "AI"/"bot"
 *   3. Honest comparison table: PR-TOP vs SimplePractice, Jane App, generic EHR
 *   4. FAQ block + FAQPage JSON-LD (6 items)
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + /secure-practice-management + /ai-session-notes-for-therapists
 *   7. PR-TOP wedge in first two H2s: diary + exercises + crisis alerts + Telegram
 *
 * Meta title/description use routine-intent keywords only — no AI in title.
 * AI mentioned in body as implementation detail, not selling point.
 */

const CONTENT = {
  en: {
    seoTitle: 'Practice Management for Therapists — PR-TOP Workspace (2026)',
    seoDescription:
      'Practice management for therapists: PR-TOP organizes client records, session notes, analytics and a between-session channel for diary and exercises. GDPR-first.',
    articleHeadline: 'Practice Management for Therapists — How PR-TOP Organizes Your Practice',
    articleDescription:
      'How PR-TOP helps therapists manage their practice: organized client records, session documentation, notes workflow and a between-session client channel — without billing or scheduling overhead.',
    badge: 'Practice management',
    h1: 'Practice management for therapists',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    intro:
      'PR-TOP organizes your therapy practice around the therapeutic relationship, not billing cycles. Manage your client roster, session records, notes and analytics in one encrypted workspace — then add the between-session layer: a client channel for voice diary, exercises and crisis alerts, delivered through Telegram with no separate app needed.',

    coreWorkflowTitle: 'The core practice workflow PR-TOP handles',
    coreWorkflowP1:
      'A well-run private practice needs four things working together: organized client records, reliable session documentation, a way to stay in contact between appointments, and a clear picture of how clients are progressing. Most tools cover one or two of these. PR-TOP is designed to cover all four without the billing, scheduling and insurance overhead of a full EHR.',
    coreWorkflowList: [
      'Client roster — unlimited encrypted profiles, consent tracking, and a timeline view of all sessions, diary entries and exercises in chronological order. Nothing falls between the cracks.',
      'Session records — upload an audio or video recording (up to 100 MB), transcribe it automatically, receive a structured summary and draft a progress note. The full record is encrypted at the application layer before it touches the database.',
      'Between-session client channel — clients connect via an invite link or deep link. They send voice messages, text entries and short video clips from an app they already use every day. Every entry lands in your encrypted dashboard before the next session.',
      'Exercise library — pre-seeded multilingual exercises (EN/RU/UK/ES) and custom exercises you build yourself. Assign in one click; the client channel tracks completion and surfaces the status on their timeline.',
      'Crisis and urgency protocol — clients signal urgency inside the client channel. You receive a multi-channel notification immediately, with a structured lifecycle so the signal is never missed.',
      'Practice analytics — session counts, diary frequency, exercise completion, activity feed and exportable reports (PDF/JSON/CSV on Pro and above).',
      'Four languages — the full dashboard and the client channel run in English, Russian, Ukrainian and Spanish with no switching cost.',
    ],
    coreWorkflowP2:
      'Everything is therapist-controlled. Clients see only their own data. You decide what the client channel sends, which exercises are assigned and how urgency signals reach you.',

    betweenSessionTitle: 'Why the space between sessions matters for practice management',
    betweenSessionP1a:
      'Traditional practice-management tools end when the session ends. The client closes the door, and the next record you have is the brief note you typed immediately afterwards. PR-TOP extends the practice workspace into the ',
    betweenSessionP1em: '167 hours between sessions',
    betweenSessionP1b:
      ': the client keeps a structured diary, completes assigned exercises and can signal urgency — all through a channel they already use. When you open the session record on Thursday afternoon, you have the full picture: what the client wrote on Monday, which exercise they completed on Tuesday, any signal they sent on Wednesday. You review it once; it replaces the "how was your week?" debrief.',
    betweenSessionP2:
      'This is the between-session layer. It does not replace a scheduling system or a billing platform — PR-TOP has neither. It replaces the scattered voice memos, informal message threads and manual session prep that currently consume the first ten minutes of every appointment.',
    betweenSessionSee: 'See also: ',
    betweenSessionLinkNotes: 'how session notes work in PR-TOP',
    betweenSessionAnd: ' and ',
    betweenSessionLinkSecure: 'how PR-TOP protects client data',
    betweenSessionDot: '.',

    notReplaceTitle: 'What PR-TOP is not built for',
    notReplaceIntro:
      'Being honest about scope matters in a clinical-adjacent tool. PR-TOP is not a full-suite EHR and does not aim to be. Before you register, confirm you have a separate solution for:',
    notReplaceList: [
      'Scheduling and appointment booking — PR-TOP has no calendar, no appointment reminders, no online booking page. Use SimplePractice, Jane App, Calendly or your existing scheduler.',
      'Billing and invoicing — PR-TOP does not generate invoices, process payments or handle insurance claims. If you need billing, use a dedicated billing platform alongside PR-TOP.',
      'Insurance claims and US-specific EHR workflows — CMS-1500 forms, ERA processing and US insurance integrations are not in scope.',
      'Telehealth video calls — PR-TOP is not a video call platform. Conduct sessions via Zoom, Doxy.me or your EHR\'s telehealth module and use PR-TOP for documentation and the between-session channel.',
      'US-integrated EHR systems — PR-TOP does not connect to Epic, Cerner or TherapyNotes.',
    ],
    notReplaceClose:
      'The honest framing: PR-TOP replaces a paper client notebook, an informal messaging thread with clients, and the habit of spending the first ten minutes of every session asking what happened since last time. It does not replace your scheduler or your billing software.',

    tableTitle: 'Comparison: PR-TOP vs SimplePractice vs Jane App vs generic EHR (2026)',
    tableHead: { feature: 'Feature', prtop: 'PR-TOP', sp: 'SimplePractice', jane: 'Jane App', ehr: 'Generic EHR' },
    tableRows: [
      {
        label: 'Category',
        p: 'Encrypted practice workspace + between-session client channel',
        sp: 'Full-suite US EHR (scheduling, billing, notes)',
        jane: 'Full-suite EHR (scheduling, billing, telehealth)',
        ehr: 'Clinical records, billing, compliance',
      },
      {
        label: 'Pricing (from)',
        p: 'Free Trial, then €9/mo Basic, €19/mo Pro',
        sp: '~$29/mo Solo, scales per client volume',
        jane: '~CAD $39/mo base + per-practitioner fee',
        ehr: 'Varies; often $100–400/mo',
      },
      {
        label: 'Client-facing channel (diary, exercises)',
        p: 'Yes — voice / text / video, encrypted, via Telegram',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Between-session diary',
        p: 'Yes — structured, searchable, on client timeline',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Crisis / urgency protocol',
        p: 'Yes — structured signal with multi-channel therapist notify',
        sp: 'No',
        jane: 'No',
        ehr: 'Rarely; requires custom workflow',
      },
      {
        label: 'Session notes (transcription + summary)',
        p: 'Yes — Whisper transcription + AI-assisted summary',
        sp: 'Yes (AutoNote add-on)',
        jane: 'Limited (third-party integrations)',
        ehr: 'Varies by platform',
      },
      {
        label: 'Exercise library',
        p: 'Yes — pre-seeded + custom, delivered via client channel',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Scheduling',
        p: 'No',
        sp: 'Yes — core feature',
        jane: 'Yes — core feature',
        ehr: 'Usually yes',
      },
      {
        label: 'Billing / invoicing',
        p: 'No',
        sp: 'Yes — insurance claims, superbills, ERA',
        jane: 'Yes — invoicing, insurance, online payments',
        ehr: 'Yes (core EHR function)',
      },
      {
        label: 'GDPR / EU hosting',
        p: 'Yes — EU-only (Hetzner), DPA by default',
        sp: 'US-hosted; SCCs for EU',
        jane: 'Canada-hosted; limited EU posture',
        ehr: 'Varies; check contract',
      },
      {
        label: 'Languages',
        p: 'EN, RU, UK, ES',
        sp: 'English (primary)',
        jane: 'English (primary)',
        ehr: 'Varies',
      },
      {
        label: 'Best for',
        p: 'EU/CIS/LATAM therapists who need organized records and a between-session client channel',
        sp: 'US therapists needing a full EHR with billing and scheduling',
        jane: 'Canadian therapists needing scheduling, billing and telehealth',
        ehr: 'Clinics needing regulated clinical records + billing compliance',
      },
    ],
    tableNote:
      'SimplePractice and Jane App figures verified against public pricing pages in July 2026. Numbers may change; check each vendor before purchasing.',

    adminLoadTitle: 'Reducing administrative load in a private practice',
    adminLoadP1:
      'Administrative overhead in a solo or small-group practice falls into three categories: documentation (session notes, progress records), communication (client contact between sessions) and organization (knowing where every client stands at any given moment). PR-TOP is designed to compress all three.',
    adminLoadP2:
      'Session documentation is the most time-intensive. Uploading a recording and receiving a structured draft note typically takes less than five minutes of active therapist time — the rest is the transcription and summarization running in the background. The draft is yours to edit, approve or discard; the technology assists, it does not decide.',
    adminLoadP3:
      'Between-session communication is the most fragmented. Most therapists currently manage it across informal message threads, voice memos and their own memory. PR-TOP consolidates it into a single encrypted channel per client, visible on the client timeline, searchable and structured.',
    adminLoadP4:
      'Organization is the least visible but most corrosive. Not knowing which client was assigned which exercise three weeks ago, or not having a summary of the last four diary entries before a session starts, adds mental overhead that accumulates across a full week of appointments. The client timeline and weekly digest features exist specifically to eliminate that overhead.',
    adminLoadLinkSecure: 'Read about how client data is protected',

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'What does practice management for therapists actually mean?',
        a: 'In the PR-TOP context it means: an organized client roster with consent tracking; structured session records with transcription and note drafting; a between-session client channel for diary entries, exercises and urgency signals; practice analytics; and four-language support. It does not include scheduling, billing or insurance claims — those require a dedicated EHR or billing platform.',
      },
      {
        q: 'How is PR-TOP different from SimplePractice for practice management?',
        a: 'SimplePractice is a full US EHR built around scheduling, billing, insurance claims and US compliance. It is excellent for those workflows. PR-TOP does none of those things. Instead, it adds a between-session client channel (diary, exercises, urgency protocol) that SimplePractice does not have. For EU or CIS therapists who do not bill insurance and want a GDPR-first encrypted workspace with a structured between-session layer, PR-TOP covers what SimplePractice leaves out.',
      },
      {
        q: 'How much time does managing clients in PR-TOP actually take?',
        a: 'Adding a client takes about two minutes: create a profile, set consent, send an invite link. Session documentation — uploading a recording and reviewing the draft note — typically takes five to ten minutes per session. The between-session channel runs passively: diary entries arrive automatically and are visible on the timeline whenever you open it. There is no manual data entry required from the client.',
      },
      {
        q: 'Can I use PR-TOP alongside my current EHR or scheduling tool?',
        a: 'Yes — that is the recommended setup for most therapists. Keep your scheduler for appointments and your biller for invoices. Run PR-TOP for session documentation and the between-session client channel. PR-TOP does not integrate with external systems, but it also does not require replacing them. The two parts of the stack do different things and do not overlap.',
      },
      {
        q: 'Is client data safe if it all lives in one platform?',
        a: 'All Class A data — diary entries, session transcripts, progress notes — is encrypted at the application layer before it touches the database. This means that even with direct server access, the raw database contains only ciphertext. Hosting is EU-only (Hetzner), a Data Processing Addendum is included with every account by default, and there is an immutable audit log of every access to client data. See the full security pages for the technical detail.',
      },
      {
        q: 'Does the between-session channel work for group practices as well as solo therapists?',
        a: 'Both. A solo therapist on the Basic plan gets the full feature set for a small client list. A group practice on Pro or Premium can add multiple therapist accounts, each with their own client roster and between-session channels. A superadmin account lets a clinic director view aggregate practice statistics and manage therapist accounts without accessing individual client data.',
      },
    ],

    ctaTitle: 'Set up your practice workspace — free trial, no credit card',
    ctaText:
      'Getting started takes about ten minutes: create an account, add your first client, send an invite link so they can connect their client channel. No credit card required, no automatic plan upgrade. You can export your data and close the account at any time.',
    ctaButton: 'Start free trial',
    ctaLinkNotes: 'How session notes work',
    ctaLinkSecure: 'Security and encryption',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'Управление практикой психолога — рабочее пространство PR-TOP (2026)',
    seoDescription:
      'Управление практикой психолога: PR-TOP — картотека клиентов, заметки к сессиям, аналитика и зашифрованный канал с дневником и упражнениями. Хостинг в ЕС, GDPR.',
    articleHeadline: 'Управление практикой психолога — как PR-TOP организует вашу практику',
    articleDescription:
      'Как PR-TOP помогает психологам управлять практикой: организованные записи клиентов, документация сессий, рабочий процесс заметок и канал между сессиями — без биллинга и расписания.',
    badge: 'Управление практикой',
    h1: 'Управление практикой психолога',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',

    intro:
      'PR-TOP организует практику психолога вокруг терапевтических отношений, а не циклов биллинга. Ведите картотеку клиентов, записи сессий, заметки и аналитику в одном зашифрованном пространстве — плюс слой между сессиями: канал для голосового дневника, упражнений и сигналов SOS, без отдельного приложения.',

    coreWorkflowTitle: 'Основной рабочий процесс практики в PR-TOP',
    coreWorkflowP1:
      'Хорошо организованная частная практика требует четырёх вещей: упорядоченных записей клиентов, надёжной документации сессий, способа поддерживать контакт между встречами и чёткого понимания прогресса. Большинство инструментов покрывают одно-два из этих требований. PR-TOP разработан для всех четырёх — без биллинга, расписания и страховой нагрузки полноценной EHR.',
    coreWorkflowList: [
      'Картотека клиентов — неограниченное количество зашифрованных профилей, отслеживание согласий и хронологический просмотр всех сессий, записей дневника и упражнений. Ничего не теряется.',
      'Записи сессий — загружайте аудио или видео (до 100 МБ), автоматически транскрибируйте, получайте структурированное резюме и черновик заметки. Всё шифруется на уровне приложения до попадания в базу данных.',
      'Канал между сессиями — клиенты подключаются по ссылке-приглашению или deep link. Они отправляют голосовые сообщения, текст и короткие видео из Telegram, которым уже пользуются. Каждая запись попадает в зашифрованный кабинет до следующей сессии.',
      'Библиотека упражнений — предустановленные многоязычные упражнения (EN/RU/UK/ES) и созданные вами. Назначайте в один клик; канал отслеживает выполнение, статус виден в хронологии.',
      'Протокол кризиса и срочности — клиент подаёт сигнал внутри канала. Вы получаете многоканальное уведомление немедленно, с журналом жизненного цикла.',
      'Аналитика практики — количество сессий, частота дневника, выполнение упражнений, лента активности и отчёты для экспорта (PDF/JSON/CSV на тарифах Pro и выше).',
      'Четыре языка — кабинет и клиентский канал работают на английском, русском, украинском и испанском.',
    ],
    coreWorkflowP2:
      'Всё под контролем психолога. Клиенты видят только свои данные. Вы решаете, что отправляет канал, какие упражнения назначены и как сигналы срочности вас достигают.',

    betweenSessionTitle: 'Почему пространство между сессиями важно для управления практикой',
    betweenSessionP1a:
      'Традиционные инструменты управления практикой заканчиваются, когда заканчивается сессия. Следующая запись — краткая заметка сразу после приёма. PR-TOP расширяет рабочее пространство практики на ',
    betweenSessionP1em: '167 часов между сессиями',
    betweenSessionP1b:
      ': клиент ведёт структурированный дневник, выполняет назначенные упражнения и может подать сигнал — через канал, которым уже пользуется. Когда вы открываете запись в четверг, у вас есть полная картина: что клиент написал в понедельник, какое упражнение выполнил во вторник, какой сигнал прислал в среду. Это заменяет стандартный дебриф "как прошла неделя?".',
    betweenSessionP2:
      'Это и есть слой между сессиями. Он не заменяет систему расписания или биллинга — в PR-TOP их нет. Он заменяет разрозненные голосовые заметки, неформальные переписки с клиентами и ручную подготовку к сессии, которая сейчас занимает первые десять минут каждого приёма.',
    betweenSessionSee: 'Смотрите также: ',
    betweenSessionLinkNotes: 'как работают заметки к сессиям в PR-TOP',
    betweenSessionAnd: ' и ',
    betweenSessionLinkSecure: 'как PR-TOP защищает данные клиентов',
    betweenSessionDot: '.',

    notReplaceTitle: 'Для чего PR-TOP не предназначен',
    notReplaceIntro:
      'Честность по поводу области применения важна для клинически-связанного инструмента. PR-TOP — не полноценная EHR и не стремится ею быть. Перед регистрацией убедитесь, что у вас есть отдельное решение для:',
    notReplaceList: [
      'Расписания и записи на приём — в PR-TOP нет календаря, напоминаний и страницы онлайн-записи. Используйте SimplePractice, Jane App, Calendly или имеющийся планировщик.',
      'Биллинга и выставления счётов — PR-TOP не создаёт счета, не обрабатывает платежи и не работает со страховыми требованиями.',
      'Страховых требований и американских рабочих процессов EHR — CMS-1500, обработка ERA и интеграции с US-страховками не входят в рамки платформы.',
      'Видеозвонков для телемедицины — PR-TOP не является платформой для видеоконференций. Проводите сессии через Zoom или Doxy.me, а PR-TOP используйте для документации и канала между сессиями.',
      'Американских EHR-систем — PR-TOP не подключается к Epic, Cerner или TherapyNotes.',
    ],
    notReplaceClose:
      'Честная позиция: PR-TOP заменяет бумажный блокнот с записями о клиентах, неформальные переписки с клиентами и привычку тратить первые десять минут сессии на выяснение того, что произошло. Он не заменяет планировщик или биллинговое ПО.',

    tableTitle: 'Сравнение: PR-TOP vs SimplePractice vs Jane App vs типичная EHR (2026)',
    tableHead: { feature: 'Функция', prtop: 'PR-TOP', sp: 'SimplePractice', jane: 'Jane App', ehr: 'Типичная EHR' },
    tableRows: [
      {
        label: 'Категория',
        p: 'Зашифрованное рабочее пространство + канал между сессиями',
        sp: 'Полная EHR для США (расписание, биллинг, заметки)',
        jane: 'Полная EHR (расписание, биллинг, телемедицина)',
        ehr: 'Клинические записи, биллинг, комплаенс',
      },
      {
        label: 'Цена (от)',
        p: 'Бесплатный Trial, далее €9/мес Basic, €19/мес Pro',
        sp: '~$29/мес Solo, растёт с объёмом',
        jane: '~CAD $39/мес базово + оплата за специалиста',
        ehr: 'Варьируется; часто $100–400/мес',
      },
      {
        label: 'Клиентский канал (дневник, упражнения)',
        p: 'Да — голос / текст / видео, зашифровано, через Telegram',
        sp: 'Нет',
        jane: 'Нет',
        ehr: 'Нет',
      },
      {
        label: 'Дневник между сессиями',
        p: 'Да — структурированный, доступный для поиска',
        sp: 'Нет',
        jane: 'Нет',
        ehr: 'Нет',
      },
      {
        label: 'Протокол кризиса / срочности',
        p: 'Да — сигнал с многоканальным уведомлением психологу',
        sp: 'Нет',
        jane: 'Нет',
        ehr: 'Редко; требует кастомного процесса',
      },
      {
        label: 'Заметки к сессиям (транскрипция + резюме)',
        p: 'Да — транскрипция Whisper + резюме',
        sp: 'Да (дополнение AutoNote)',
        jane: 'Ограниченно (интеграции сторонних сервисов)',
        ehr: 'Зависит от платформы',
      },
      {
        label: 'Библиотека упражнений',
        p: 'Да — предустановленные + кастомные, через канал',
        sp: 'Нет',
        jane: 'Нет',
        ehr: 'Нет',
      },
      {
        label: 'Расписание',
        p: 'Нет',
        sp: 'Да — ключевая функция',
        jane: 'Да — ключевая функция',
        ehr: 'Обычно да',
      },
      {
        label: 'Биллинг / выставление счётов',
        p: 'Нет',
        sp: 'Да — страховые требования, суперсчета, ERA',
        jane: 'Да — счета, страхование, онлайн-платежи',
        ehr: 'Да (основная функция EHR)',
      },
      {
        label: 'GDPR / хостинг в ЕС',
        p: 'Да — только ЕС (Hetzner), DPA по умолчанию',
        sp: 'Хостинг в США; SCC для ЕС',
        jane: 'Хостинг в Канаде; ограниченная позиция по ЕС',
        ehr: 'Варьируется; проверяйте договор',
      },
      {
        label: 'Языки',
        p: 'EN, RU, UK, ES',
        sp: 'Английский (основной)',
        jane: 'Английский (основной)',
        ehr: 'Варьируется',
      },
      {
        label: 'Кому подходит',
        p: 'Психологам из ЕС/СНГ/LATAM, которым нужен организованный рабочий процесс и канал между сессиями',
        sp: 'Психологам из США с полной EHR, биллингом и расписанием',
        jane: 'Психологам из Канады с расписанием, биллингом и телемедициной',
        ehr: 'Клиникам с регулируемыми записями и биллинговым комплаенсом',
      },
    ],
    tableNote:
      'Данные SimplePractice и Jane App сверены с публичными страницами цен в июле 2026. Цифры могут меняться; проверяйте актуальность у каждого вендора перед покупкой.',

    adminLoadTitle: 'Снижение административной нагрузки в частной практике',
    adminLoadP1:
      'Административная нагрузка в частной или небольшой групповой практике делится на три части: документация (заметки к сессиям, записи прогресса), коммуникация (контакт с клиентом между встречами) и организация (понимание статуса каждого клиента в любой момент). Большинство инструментов покрывают одну из частей. PR-TOP разработан для всех трёх.',
    adminLoadP2:
      'Документация сессий — самая трудоёмкая. Загрузка записи и получение структурированного черновика заметки обычно занимает менее пяти минут активного времени психолога — всё остальное делается в фоне. Черновик принадлежит вам: его можно отредактировать, одобрить или удалить; технологии помогают, но не решают.',
    adminLoadP3:
      'Коммуникация между сессиями — самая фрагментированная. Сейчас большинство специалистов управляют ею через разрозненные переписки, голосовые заметки и собственную память. PR-TOP объединяет это в один зашифрованный канал на клиента, видимый в хронологии, доступный для поиска и структурированный.',
    adminLoadP4:
      'Организация — наименее заметная, но самая разрушительная нагрузка. Незнание, какое упражнение было назначено три недели назад, или отсутствие резюме последних четырёх записей дневника перед началом сессии добавляет ментальную нагрузку, которая накапливается за полную рабочую неделю. Хронология клиента и еженедельный дайджест существуют именно для устранения этой нагрузки.',
    adminLoadLinkSecure: 'Читать о защите данных клиентов',

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'Что на практике означает "управление практикой психолога"?',
        a: 'В контексте PR-TOP это: организованная картотека клиентов с отслеживанием согласий; структурированные записи сессий с транскрипцией и черновиком заметки; канал между сессиями для дневников, упражнений и сигналов срочности; аналитика практики; поддержка четырёх языков. Расписание, биллинг и страховые требования не включены — для этого нужна отдельная EHR или биллинговая платформа.',
      },
      {
        q: 'Чем PR-TOP отличается от SimplePractice в управлении практикой?',
        a: 'SimplePractice — полноценная US EHR, созданная вокруг расписания, биллинга, страховых требований и американского комплаенса. Это отличное решение для этих задач. PR-TOP ни одной из них не выполняет. Вместо этого он добавляет канал между сессиями (дневник, упражнения, протокол срочности), которого у SimplePractice нет. Для психологов из ЕС или СНГ, которые не работают со страховкой и хотят GDPR-first зашифрованное пространство со структурированным слоем между сессиями, PR-TOP закрывает то, чего не хватает у SimplePractice.',
      },
      {
        q: 'Сколько времени занимает ведение клиентов в PR-TOP?',
        a: 'Добавление клиента занимает около двух минут: создать профиль, установить согласие, отправить ссылку-приглашение. Документация сессии — загрузка записи и проверка черновика заметки — обычно занимает пять-десять минут на сессию. Канал между сессиями работает пассивно: записи дневника поступают автоматически и видны в хронологии всякий раз, когда вы открываете приложение.',
      },
      {
        q: 'Можно ли использовать PR-TOP параллельно с существующей EHR или планировщиком?',
        a: 'Да — это рекомендуемая схема для большинства специалистов. Оставьте планировщик для записи на приём и биллинговое ПО для счетов. Запускайте PR-TOP для документации сессий и канала между сессиями. PR-TOP не интегрируется с внешними системами, но и не требует их замены. Две части стека делают разные вещи и не пересекаются.',
      },
      {
        q: 'Безопасно ли хранить все данные клиентов в одной платформе?',
        a: 'Все данные класса A — записи дневника, транскрипты сессий, заметки — шифруются на уровне приложения до попадания в базу данных. Даже при прямом доступе к серверу база содержит только зашифрованные данные. Хостинг только в ЕС (Hetzner), соглашение об обработке данных (DPA) включено с каждым аккаунтом по умолчанию, а неизменяемый журнал аудита фиксирует каждый доступ к данным клиента.',
      },
      {
        q: 'Работает ли канал между сессиями для групповой практики?',
        a: 'Да, для обоих вариантов. Одиночный специалист на тарифе Basic получает полный набор функций для небольшой картотеки. Групповая практика на Pro или Premium может добавлять несколько аккаунтов психологов, каждый со своим списком клиентов и каналами. Суперадмин позволяет директору клиники видеть агрегированную статистику без доступа к данным отдельных клиентов.',
      },
    ],

    ctaTitle: 'Настройте рабочее пространство практики — бесплатный Trial, карта не нужна',
    ctaText:
      'Начало работы занимает около десяти минут: создайте аккаунт, добавьте первого клиента, отправьте ссылку-приглашение для подключения канала. Карта не нужна, автоматического перехода на платный план нет. Выгрузите данные и закройте аккаунт в любое время.',
    ctaButton: 'Начать бесплатно',
    ctaLinkNotes: 'Как работают заметки к сессиям',
    ctaLinkSecure: 'Безопасность и шифрование',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'Управління практикою психолога — робочий простір PR-TOP (2026)',
    seoDescription:
      'Управління практикою психолога: PR-TOP — картотека клієнтів, нотатки до сесій, аналітика та зашифрований канал зі щоденником і вправами. Хостинг у ЄС, GDPR.',
    articleHeadline: 'Управління практикою психолога — як PR-TOP організовує вашу практику',
    articleDescription:
      'Як PR-TOP допомагає психологам керувати практикою: організовані записи клієнтів, документація сесій, робочий процес нотаток і канал між сесіями — без білінгу й розкладу.',
    badge: 'Управління практикою',
    h1: 'Управління практикою психолога',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',

    intro:
      'PR-TOP організовує практику психолога навколо терапевтичних відносин, а не циклів білінгу. Ведіть картотеку клієнтів, записи сесій, нотатки та аналітику в одному зашифрованому просторі — плюс шар між сесіями: канал для голосового щоденника, вправ і сигналів SOS, без окремого застосунку.',

    coreWorkflowTitle: 'Основний робочий процес практики в PR-TOP',
    coreWorkflowP1:
      'Добре організована приватна практика потребує чотирьох речей: впорядкованих записів клієнтів, надійної документації сесій, способу підтримувати контакт між зустрічами та чіткого розуміння прогресу. Більшість інструментів охоплюють одне-два з цих завдань. PR-TOP розроблено для всіх чотирьох — без білінгу, розкладу та страхового навантаження повноцінної EHR.',
    coreWorkflowList: [
      'Картотека клієнтів — необмежена кількість зашифрованих профілів, відстеження згод та хронологічний перегляд усіх сесій, записів щоденника і вправ. Нічого не губиться.',
      'Записи сесій — завантажуйте аудіо або відео (до 100 МБ), автоматично транскрибуйте, отримуйте структуроване резюме та чернетку нотатки. Усе шифрується на рівні застосунку до потрапляння в базу даних.',
      'Канал між сесіями — клієнти підключаються за посиланням-запрошенням або deep link. Вони надсилають голосові повідомлення, текст і короткі відео з Telegram, яким вже користуються. Кожен запис потрапляє до зашифрованого кабінету до наступної сесії.',
      'Бібліотека вправ — попередньо завантажені багатомовні вправи (EN/RU/UK/ES) і власні. Призначайте одним кліком; канал відстежує виконання, статус видно в хронології.',
      'Протокол кризи й терміновості — клієнт подає сигнал у каналі. Ви отримуєте багатоканальне сповіщення негайно, з журналом життєвого циклу.',
      'Аналітика практики — кількість сесій, частота щоденника, виконання вправ, стрічка активності та звіти для експорту (PDF/JSON/CSV на тарифах Pro і вище).',
      'Чотири мови — кабінет і клієнтський канал працюють англійською, російською, українською та іспанською.',
    ],
    coreWorkflowP2:
      'Усе під контролем психолога. Клієнти бачать лише свої дані. Ви вирішуєте, що надсилає канал, які вправи призначені і як сигнали терміновості вас досягають.',

    betweenSessionTitle: 'Чому простір між сесіями важливий для управління практикою',
    betweenSessionP1a:
      'Традиційні інструменти управління практикою закінчуються, коли закінчується сесія. Наступний запис — коротка нотатка одразу після прийому. PR-TOP розширює робочий простір практики на ',
    betweenSessionP1em: '167 годин між сесіями',
    betweenSessionP1b:
      ': клієнт веде структурований щоденник, виконує призначені вправи та може подати сигнал — через канал, яким вже користується. Коли ви відкриваєте запис у четвер, у вас є повна картина: що клієнт написав у понеділок, яку вправу виконав у вівторок, який сигнал надіслав у середу. Це замінює стандартний дебриф «як минув тиждень?».',
    betweenSessionP2:
      'Це і є шар між сесіями. Він не замінює систему розкладу або білінгу — в PR-TOP їх немає. Він замінює розрізнені голосові нотатки, неформальні переписки з клієнтами та ручну підготовку до сесії, яка зараз займає перші десять хвилин кожного прийому.',
    betweenSessionSee: 'Дивіться також: ',
    betweenSessionLinkNotes: 'як працюють нотатки до сесій у PR-TOP',
    betweenSessionAnd: ' та ',
    betweenSessionLinkSecure: 'як PR-TOP захищає дані клієнтів',
    betweenSessionDot: '.',

    notReplaceTitle: 'Для чого PR-TOP не призначено',
    notReplaceIntro:
      'Чесність щодо сфери застосування важлива для клінічно-пов\'язаного інструменту. PR-TOP — не повнофункціональна EHR і не прагне нею бути. Перед реєстрацією переконайтеся, що у вас є окреме рішення для:',
    notReplaceList: [
      'Розкладу та запису на прийом — у PR-TOP немає календаря, нагадувань і сторінки онлайн-запису. Використовуйте SimplePractice, Jane App, Calendly або наявний планувальник.',
      'Білінгу та виставлення рахунків — PR-TOP не створює рахунків, не обробляє платежі та не працює зі страховими вимогами.',
      'Страхових вимог і американських робочих процесів EHR — CMS-1500, обробка ERA та інтеграції з US-страховками не входять до рамок платформи.',
      'Відеодзвінків для телемедицини — PR-TOP не є відеоплатформою. Проводьте сесії через Zoom або Doxy.me, а PR-TOP використовуйте для документації та каналу між сесіями.',
      'Американських EHR-систем — PR-TOP не підключається до Epic, Cerner або TherapyNotes.',
    ],
    notReplaceClose:
      'Чесна позиція: PR-TOP замінює паперовий блокнот із нотатками про клієнтів, неформальні переписки з клієнтами та звичку витрачати перші десять хвилин сесії на з\'ясування того, що відбулося. Він не замінює планувальник або програмне забезпечення для білінгу.',

    tableTitle: 'Порівняння: PR-TOP vs SimplePractice vs Jane App vs типова EHR (2026)',
    tableHead: { feature: 'Функція', prtop: 'PR-TOP', sp: 'SimplePractice', jane: 'Jane App', ehr: 'Типова EHR' },
    tableRows: [
      {
        label: 'Категорія',
        p: 'Зашифрований робочий простір + канал між сесіями',
        sp: 'Повна EHR для США (розклад, білінг, нотатки)',
        jane: 'Повна EHR (розклад, білінг, телемедицина)',
        ehr: 'Клінічні записи, білінг, комплаєнс',
      },
      {
        label: 'Ціна (від)',
        p: 'Безкоштовний Trial, далі €9/міс Basic, €19/міс Pro',
        sp: '~$29/міс Solo, зростає з обсягом',
        jane: '~CAD $39/міс базово + оплата за спеціаліста',
        ehr: 'Варіюється; часто $100–400/міс',
      },
      {
        label: 'Клієнтський канал (щоденник, вправи)',
        p: 'Так — голос / текст / відео, зашифровано, через Telegram',
        sp: 'Ні',
        jane: 'Ні',
        ehr: 'Ні',
      },
      {
        label: 'Щоденник між сесіями',
        p: 'Так — структурований, доступний для пошуку',
        sp: 'Ні',
        jane: 'Ні',
        ehr: 'Ні',
      },
      {
        label: 'Протокол кризи / терміновості',
        p: 'Так — сигнал з багатоканальним сповіщенням психологу',
        sp: 'Ні',
        jane: 'Ні',
        ehr: 'Рідко; потребує окремого процесу',
      },
      {
        label: 'Нотатки до сесій (транскрипція + резюме)',
        p: 'Так — транскрипція Whisper + резюме',
        sp: 'Так (доповнення AutoNote)',
        jane: 'Обмежено (інтеграції сторонніх сервісів)',
        ehr: 'Залежить від платформи',
      },
      {
        label: 'Бібліотека вправ',
        p: 'Так — попередньо завантажені + власні, через канал',
        sp: 'Ні',
        jane: 'Ні',
        ehr: 'Ні',
      },
      {
        label: 'Розклад',
        p: 'Ні',
        sp: 'Так — ключова функція',
        jane: 'Так — ключова функція',
        ehr: 'Зазвичай так',
      },
      {
        label: 'Білінг / виставлення рахунків',
        p: 'Ні',
        sp: 'Так — страхові вимоги, суперрахунки, ERA',
        jane: 'Так — рахунки, страхування, онлайн-платежі',
        ehr: 'Так (основна функція EHR)',
      },
      {
        label: 'GDPR / хостинг у ЄС',
        p: 'Так — лише ЄС (Hetzner), DPA за замовчуванням',
        sp: 'Хостинг у США; SCC для ЄС',
        jane: 'Хостинг у Канаді; обмежена позиція щодо ЄС',
        ehr: 'Варіюється; перевіряйте договір',
      },
      {
        label: 'Мови',
        p: 'EN, RU, UK, ES',
        sp: 'Англійська (основна)',
        jane: 'Англійська (основна)',
        ehr: 'Варіюється',
      },
      {
        label: 'Кому підходить',
        p: 'Психологам з ЄС/СНД/LATAM, яким потрібен організований робочий процес і канал між сесіями',
        sp: 'Психологам зі США з повною EHR, білінгом і розкладом',
        jane: 'Психологам з Канади з розкладом, білінгом і телемедициною',
        ehr: 'Клінікам з регульованими записами та білінговим комплаєнсом',
      },
    ],
    tableNote:
      'Дані SimplePractice і Jane App звірено з публічними сторінками цін у липні 2026. Цифри можуть змінюватися; перевіряйте актуальність у кожного вендора перед покупкою.',

    adminLoadTitle: 'Зниження адміністративного навантаження в приватній практиці',
    adminLoadP1:
      'Адміністративне навантаження в приватній або невеликій груповій практиці ділиться на три частини: документація (нотатки до сесій, записи прогресу), комунікація (контакт з клієнтом між зустрічами) та організація (розуміння статусу кожного клієнта в будь-який момент). PR-TOP розроблено для всіх трьох.',
    adminLoadP2:
      'Документація сесій — найбільш трудомістка. Завантаження запису та отримання структурованої чернетки нотатки зазвичай займає менше п\'яти хвилин активного часу психолога — решта виконується у фоні. Чернетка ваша: її можна відредагувати, затвердити або видалити; технології допомагають, але не вирішують.',
    adminLoadP3:
      'Комунікація між сесіями — найбільш фрагментована. Зараз більшість фахівців управляють нею через розрізнені переписки, голосові нотатки та власну пам\'ять. PR-TOP об\'єднує це в один зашифрований канал на клієнта, видимий у хронології, доступний для пошуку і структурований.',
    adminLoadP4:
      'Організація — найменш помітне, але найбільш виснажливе навантаження. Незнання, яку вправу було призначено три тижні тому, або відсутність резюме останніх чотирьох записів щоденника перед початком сесії додає ментальне навантаження, яке накопичується за повний робочий тиждень. Хронологія клієнта та щотижневий дайджест існують саме для усунення цього навантаження.',
    adminLoadLinkSecure: 'Читати про захист даних клієнтів',

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'Що на практиці означає «управління практикою психолога»?',
        a: 'У контексті PR-TOP це: організована картотека клієнтів з відстеженням згод; структуровані записи сесій з транскрипцією та чернеткою нотатки; канал між сесіями для щоденників, вправ і сигналів терміновості; аналітика практики; підтримка чотирьох мов. Розклад, білінг і страхові вимоги не включені — для цього потрібна окрема EHR або білінгова платформа.',
      },
      {
        q: 'Чим PR-TOP відрізняється від SimplePractice в управлінні практикою?',
        a: 'SimplePractice — повноцінна US EHR, створена навколо розкладу, білінгу, страхових вимог і американського комплаєнсу. Це відмінне рішення для цих завдань. PR-TOP жодного з них не виконує. Натомість він додає канал між сесіями (щоденник, вправи, протокол терміновості), якого у SimplePractice немає. Для психологів з ЄС або СНД, які не працюють зі страховками і хочуть GDPR-first зашифрований простір зі структурованим шаром між сесіями, PR-TOP закриває те, чого не вистачає у SimplePractice.',
      },
      {
        q: 'Скільки часу займає ведення клієнтів у PR-TOP?',
        a: 'Додавання клієнта займає близько двох хвилин: створити профіль, встановити згоду, надіслати посилання-запрошення. Документація сесії — завантаження запису та перевірка чернетки нотатки — зазвичай займає п\'ять-десять хвилин на сесію. Канал між сесіями працює пасивно: записи щоденника надходять автоматично і видні в хронології щоразу, коли ви відкриваєте застосунок.',
      },
      {
        q: 'Чи можна використовувати PR-TOP паралельно з наявною EHR або планувальником?',
        a: 'Так — це рекомендована схема для більшості фахівців. Залиште планувальник для запису на прийом і білінгове ПЗ для рахунків. Запускайте PR-TOP для документації сесій і каналу між сесіями. PR-TOP не інтегрується із зовнішніми системами, але й не вимагає їх заміни. Дві частини стека виконують різні функції і не перетинаються.',
      },
      {
        q: 'Чи безпечно зберігати всі дані клієнтів на одній платформі?',
        a: 'Усі дані класу A — записи щоденника, транскрипти сесій, нотатки — шифруються на рівні застосунку до потрапляння в базу даних. Навіть при прямому доступі до сервера база містить лише зашифровані дані. Хостинг лише в ЄС (Hetzner), угода про обробку даних (DPA) включена з кожним акаунтом за замовчуванням, а незмінний журнал аудиту фіксує кожен доступ до даних клієнта.',
      },
      {
        q: 'Чи працює канал між сесіями для групової практики?',
        a: 'Так, для обох варіантів. Одиночний фахівець на тарифі Basic отримує повний набір функцій для невеликої картотеки. Групова практика на Pro або Premium може додавати кілька акаунтів психологів, кожен зі своїм списком клієнтів і каналами. Суперадмін дозволяє директору клініки бачити агреговану статистику без доступу до даних окремих клієнтів.',
      },
    ],

    ctaTitle: 'Налаштуйте робочий простір практики — безкоштовний Trial, картка не потрібна',
    ctaText:
      'Початок роботи займає близько десяти хвилин: створіть акаунт, додайте першого клієнта, надішліть посилання-запрошення для підключення каналу. Картка не потрібна, автоматичного переходу на платний план немає. Виведіть дані та закрийте акаунт у будь-який час.',
    ctaButton: 'Почати безкоштовно',
    ctaLinkNotes: 'Як працюють нотатки до сесій',
    ctaLinkSecure: 'Безпека та шифрування',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Gestión de consulta para terapeutas — espacio de trabajo PR-TOP (2026)',
    seoDescription:
      'Gestión de consulta para terapeutas: PR-TOP organiza registros cifrados, notas de sesión, analítica y canal entre sesiones con diario y ejercicios. GDPR, UE.',
    articleHeadline: 'Gestión de consulta para terapeutas — cómo PR-TOP organiza su práctica',
    articleDescription:
      'Cómo PR-TOP ayuda a los terapeutas a gestionar su consulta: registros organizados, documentación de sesiones, flujo de notas y canal entre sesiones — sin facturación ni agenda.',
    badge: 'Gestión de consulta',
    h1: 'Gestión de consulta para terapeutas',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',

    intro:
      'PR-TOP organiza su consulta en torno a la relación terapéutica, no a los ciclos de facturación. Gestione su fichero de clientes, registros de sesiones, notas y analítica en un espacio cifrado — más la capa entre sesiones: un canal de voz, diario, ejercicios y alertas de crisis, entregado a través de Telegram sin necesidad de otra aplicación.',

    coreWorkflowTitle: 'El flujo de trabajo central de la consulta en PR-TOP',
    coreWorkflowP1:
      'Una consulta privada bien gestionada necesita cuatro cosas que funcionen a la vez: registros organizados de clientes, documentación fiable de sesiones, una forma de mantenerse en contacto entre citas y una visión clara del progreso. La mayoría de las herramientas cubren una o dos. PR-TOP está diseñado para cubrir las cuatro sin la facturación, la agenda y la carga de seguros de un EHR completo.',
    coreWorkflowList: [
      'Fichero de clientes — perfiles cifrados ilimitados, seguimiento de consentimientos y vista de cronología de todas las sesiones, entradas del diario y ejercicios en orden cronológico.',
      'Registros de sesiones — suba una grabación de audio o vídeo (hasta 100 MB), transcríbala automáticamente, reciba un resumen estructurado y redacte una nota de progreso. Todo se cifra en la capa de aplicación antes de llegar a la base de datos.',
      'Canal entre sesiones — los clientes se conectan mediante un enlace de invitación o deep link. Envían mensajes de voz, texto y vídeos cortos desde Telegram, que ya usan a diario. Cada entrada llega a su panel cifrado antes de la próxima sesión.',
      'Biblioteca de ejercicios — ejercicios multilingües preinstalados (EN/RU/UK/ES) y ejercicios propios. Asigne con un clic; el canal hace seguimiento del cumplimiento y muestra el estado en la cronología del cliente.',
      'Protocolo de crisis y urgencia — el cliente señala urgencia dentro del canal. Usted recibe una notificación multicanal de inmediato, con un ciclo de vida estructurado.',
      'Analítica de consulta — número de sesiones, frecuencia del diario, cumplimiento de ejercicios, actividad y reportes exportables (PDF/JSON/CSV en Pro y superior).',
      'Cuatro idiomas — el panel completo y el canal de clientes funcionan en inglés, ruso, ucraniano y español.',
    ],
    coreWorkflowP2:
      'Todo está bajo el control del terapeuta. Los clientes solo ven sus propios datos. Usted decide qué envía el canal, qué ejercicios se asignan y cómo las señales de urgencia le llegan.',

    betweenSessionTitle: 'Por qué el espacio entre sesiones importa para la gestión de la consulta',
    betweenSessionP1a:
      'Las herramientas de gestión de consulta tradicionales terminan cuando termina la sesión. El siguiente registro es la breve nota escrita inmediatamente después. PR-TOP extiende el espacio de trabajo de la consulta a las ',
    betweenSessionP1em: '167 horas entre sesiones',
    betweenSessionP1b:
      ': el cliente mantiene un diario estructurado, completa ejercicios asignados y puede señalar urgencia — todo a través de un canal que ya usa. Cuando usted abre el registro el jueves por la tarde, tiene el panorama completo: qué escribió el cliente el lunes, qué ejercicio completó el martes, qué señal envió el miércoles. Lo revisa una vez; sustituye el debrief habitual de "¿cómo estuvo tu semana?".',
    betweenSessionP2:
      'Esta es la capa entre sesiones. No sustituye un sistema de agenda ni una plataforma de facturación — PR-TOP no tiene ninguno. Sustituye los mensajes de voz dispersos, los hilos informales con clientes y la preparación manual de sesiones que actualmente consume los primeros diez minutos de cada cita.',
    betweenSessionSee: 'Consulte también: ',
    betweenSessionLinkNotes: 'cómo funcionan las notas de sesión en PR-TOP',
    betweenSessionAnd: ' y ',
    betweenSessionLinkSecure: 'cómo PR-TOP protege los datos de los clientes',
    betweenSessionDot: '.',

    notReplaceTitle: 'Para qué no está diseñado PR-TOP',
    notReplaceIntro:
      'La honestidad sobre el alcance importa en una herramienta clínica adyacente. PR-TOP no es un EHR completo y no pretende serlo. Antes de registrarse, confirme que tiene una solución separada para:',
    notReplaceList: [
      'Agenda y reserva de citas — PR-TOP no tiene calendario, recordatorios de citas ni página de reserva online. Use SimplePractice, Jane App, Calendly o su planificador actual.',
      'Facturación e invoicing — PR-TOP no genera facturas, no procesa pagos ni gestiona reclamaciones de seguros.',
      'Reclamaciones de seguros y flujos de trabajo EHR específicos de EE. UU. — los formularios CMS-1500, el procesamiento ERA y las integraciones con seguros estadounidenses están fuera del alcance.',
      'Videollamadas de telemedicina — PR-TOP no es una plataforma de vídeo. Realice sesiones por Zoom o Doxy.me y use PR-TOP para la documentación y el canal entre sesiones.',
      'Sistemas EHR de EE. UU. — PR-TOP no se conecta a Epic, Cerner ni TherapyNotes.',
    ],
    notReplaceClose:
      'El encuadre honesto: PR-TOP sustituye la libreta de apuntes de clientes, los hilos informales de mensajes con clientes y el hábito de pasar los primeros diez minutos de cada sesión preguntando qué pasó. No sustituye su planificador ni su software de facturación.',

    tableTitle: 'Comparativa: PR-TOP vs SimplePractice vs Jane App vs EHR genérico (2026)',
    tableHead: { feature: 'Función', prtop: 'PR-TOP', sp: 'SimplePractice', jane: 'Jane App', ehr: 'EHR genérico' },
    tableRows: [
      {
        label: 'Categoría',
        p: 'Espacio de trabajo cifrado + canal entre sesiones',
        sp: 'EHR completo para EE. UU. (agenda, facturación, notas)',
        jane: 'EHR completo (agenda, facturación, telemedicina)',
        ehr: 'Registros clínicos, facturación, cumplimiento',
      },
      {
        label: 'Precio (desde)',
        p: 'Trial gratuito, luego €9/mes Basic, €19/mes Pro',
        sp: '~$29/mes Solo, escala con el volumen',
        jane: '~CAD $39/mes base + tarifa por profesional',
        ehr: 'Variable; a menudo $100–400/mes',
      },
      {
        label: 'Canal de cliente (diario, ejercicios)',
        p: 'Sí — voz / texto / vídeo, cifrado, vía Telegram',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Diario entre sesiones',
        p: 'Sí — estructurado, con búsqueda',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Protocolo de crisis / urgencia',
        p: 'Sí — señal con notificación multicanal al terapeuta',
        sp: 'No',
        jane: 'No',
        ehr: 'Raramente; requiere flujo personalizado',
      },
      {
        label: 'Notas de sesión (transcripción + resumen)',
        p: 'Sí — transcripción Whisper + resumen',
        sp: 'Sí (complemento AutoNote)',
        jane: 'Limitado (integraciones de terceros)',
        ehr: 'Depende de la plataforma',
      },
      {
        label: 'Biblioteca de ejercicios',
        p: 'Sí — preinstalados + propios, entregados por el canal',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Agenda',
        p: 'No',
        sp: 'Sí — función principal',
        jane: 'Sí — función principal',
        ehr: 'Generalmente sí',
      },
      {
        label: 'Facturación / invoicing',
        p: 'No',
        sp: 'Sí — reclamaciones de seguros, superbills, ERA',
        jane: 'Sí — facturas, seguros, pagos online',
        ehr: 'Sí (función principal del EHR)',
      },
      {
        label: 'GDPR / alojamiento en la UE',
        p: 'Sí — solo UE (Hetzner), DPA por defecto',
        sp: 'Alojado en EE. UU.; CCT para la UE',
        jane: 'Alojado en Canadá; postura limitada ante la UE',
        ehr: 'Variable; revise el contrato',
      },
      {
        label: 'Idiomas',
        p: 'EN, RU, UK, ES',
        sp: 'Inglés (principal)',
        jane: 'Inglés (principal)',
        ehr: 'Variable',
      },
      {
        label: 'Ideal para',
        p: 'Terapeutas de UE/CEI/LATAM que necesitan registros organizados y un canal entre sesiones',
        sp: 'Terapeutas de EE. UU. con EHR completo, facturación y agenda',
        jane: 'Terapeutas de Canadá con agenda, facturación y telemedicina',
        ehr: 'Clínicas con registros clínicos regulados y cumplimiento de facturación',
      },
    ],
    tableNote:
      'Datos de SimplePractice y Jane App verificados en sus páginas de precios públicas en julio de 2026. Las cifras pueden cambiar; consulte a cada proveedor antes de comprar.',

    adminLoadTitle: 'Reducir la carga administrativa en una consulta privada',
    adminLoadP1:
      'La carga administrativa en una consulta privada o de pequeño grupo se divide en tres categorías: documentación (notas de sesión, registros de progreso), comunicación (contacto con el cliente entre citas) y organización (saber en qué punto está cada cliente en cualquier momento). La mayoría de las herramientas cubren una de las tres. PR-TOP está diseñado para las tres.',
    adminLoadP2:
      'La documentación de sesiones es la más laboriosa. Subir una grabación y recibir un borrador estructurado de nota suele llevar menos de cinco minutos de tiempo activo del terapeuta — el resto lo hace la transcripción y el resumen en segundo plano. El borrador es suyo: puede editarlo, aprobarlo o descartarlo; la tecnología asiste, no decide.',
    adminLoadP3:
      'La comunicación entre sesiones es la más fragmentada. La mayoría de los terapeutas la gestionan actualmente entre hilos informales, notas de voz y su propia memoria. PR-TOP lo consolida en un canal cifrado por cliente, visible en la cronología, con búsqueda y estructurado.',
    adminLoadP4:
      'La organización es la menos visible pero la más corrosiva. No saber qué ejercicio se asignó hace tres semanas, o no tener un resumen de las últimas cuatro entradas del diario antes de empezar la sesión, añade carga mental que se acumula a lo largo de una semana completa de citas. La cronología del cliente y el resumen semanal existen precisamente para eliminar esa carga.',
    adminLoadLinkSecure: 'Leer sobre cómo se protegen los datos de los clientes',

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿Qué significa en la práctica «gestión de consulta para terapeutas»?',
        a: 'En el contexto de PR-TOP significa: un fichero organizado de clientes con seguimiento de consentimientos; registros estructurados de sesiones con transcripción y borrador de nota; un canal entre sesiones para entradas del diario, ejercicios y señales de urgencia; analítica de consulta; y soporte de cuatro idiomas. No incluye agenda, facturación ni reclamaciones de seguros — eso requiere un EHR dedicado o una plataforma de facturación.',
      },
      {
        q: '¿En qué se diferencia PR-TOP de SimplePractice para la gestión de consulta?',
        a: 'SimplePractice es un EHR completo para EE. UU. construido en torno a la agenda, la facturación, las reclamaciones de seguros y el cumplimiento estadounidense. Es excelente para esos flujos de trabajo. PR-TOP no hace nada de eso. En cambio, añade un canal entre sesiones (diario, ejercicios, protocolo de urgencia) que SimplePractice no tiene. Para terapeutas de la UE o la CEI que no facturan seguros y quieren un espacio cifrado GDPR-first con una capa estructurada entre sesiones, PR-TOP cubre lo que SimplePractice no ofrece.',
      },
      {
        q: '¿Cuánto tiempo lleva gestionar clientes en PR-TOP?',
        a: 'Añadir un cliente tarda unos dos minutos: crear un perfil, establecer el consentimiento, enviar un enlace de invitación. La documentación de la sesión — subir una grabación y revisar el borrador de nota — suele llevar de cinco a diez minutos por sesión. El canal entre sesiones funciona de forma pasiva: las entradas del diario llegan automáticamente y son visibles en la cronología cuando la abre.',
      },
      {
        q: '¿Puedo usar PR-TOP junto a mi EHR o planificador actual?',
        a: 'Sí — esa es la configuración recomendada para la mayoría de los terapeutas. Conserve su planificador para las citas y su programa de facturación para las facturas. Use PR-TOP para la documentación de sesiones y el canal entre sesiones. PR-TOP no se integra con sistemas externos, pero tampoco requiere reemplazarlos. Las dos partes del stack hacen cosas distintas y no se solapan.',
      },
      {
        q: '¿Es seguro tener todos los datos de los clientes en una sola plataforma?',
        a: 'Todos los datos de clase A — entradas del diario, transcripciones de sesiones, notas de progreso — se cifran en la capa de aplicación antes de llegar a la base de datos. Incluso con acceso directo al servidor, la base de datos solo contiene texto cifrado. El alojamiento es exclusivamente en la UE (Hetzner), un Acuerdo de Procesamiento de Datos (DPA) se incluye con cada cuenta por defecto, y hay un registro de auditoría inmutable de cada acceso a los datos del cliente.',
      },
      {
        q: '¿El canal entre sesiones funciona para una consulta grupal?',
        a: 'Sí, para ambos casos. Un profesional individual en el plan Basic obtiene el conjunto completo de funciones para un fichero pequeño. Una consulta grupal en Pro o Premium puede añadir varias cuentas de terapeuta, cada una con su propio fichero de clientes y canales. Una cuenta de superadmin permite al director de la clínica ver estadísticas agregadas sin acceder a los datos de clientes individuales.',
      },
    ],

    ctaTitle: 'Configure su espacio de trabajo — prueba gratuita, sin tarjeta de crédito',
    ctaText:
      'Empezar lleva unos diez minutos: cree una cuenta, añada su primer cliente, envíe un enlace de invitación para que conecten su canal. Sin tarjeta, sin conversión automática a pago. Exporte sus datos y cierre la cuenta cuando quiera, sin ataduras.',
    ctaButton: 'Empezar gratis',
    ctaLinkNotes: 'Cómo funcionan las notas de sesión',
    ctaLinkSecure: 'Seguridad y cifrado',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function PracticeManagementForTherapists() {
  const { i18n } = useTranslation();
  const locale = ['ru', 'uk', 'es'].includes(i18n.language) ? i18n.language : 'en';
  const c = CONTENT[locale];
  const lp = useLocalePath();
  const pageUrl = 'https://pr-top.com/practice-management-for-therapists';

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.articleHeadline,
    description: c.articleDescription,
    inLanguage: locale,
    datePublished: '2026-07-14',
    dateModified: '2026-07-14',
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
        path="/practice-management-for-therapists"
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
          {/* Rule 2 — single H1, no "AI" or "bot" in text */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
            {c.h1}
          </h1>
          {/* Rule 5 — visible freshness stamp */}
          <p className="text-sm text-gray-500">{c.stamp}</p>
        </header>

        {/* Rule 1 — direct-answer block, 40-60 words, hedge-free. */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">
            {c.intro}
          </p>
        </div>

        {/* Rule 7 — wedge in first H2: name diary + exercises + crisis alerts + Telegram. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.coreWorkflowTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">{c.coreWorkflowP1}</p>
          <ul className="list-disc pl-5 space-y-3 text-gray-700 leading-relaxed mb-4">
            {c.coreWorkflowList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-gray-700 leading-relaxed">{c.coreWorkflowP2}</p>
        </section>

        {/* Rule 7 — wedge in second H2: between-session layer. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.betweenSessionTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            {c.betweenSessionP1a}
            <em>{c.betweenSessionP1em}</em>
            {c.betweenSessionP1b}
          </p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.betweenSessionP2}</p>
          {/* Rule 6 — internal links to sibling pages */}
          <p className="text-gray-700 leading-relaxed">
            {c.betweenSessionSee}
            <Link
              to={lp('/ai-session-notes-for-therapists')}
              className="text-primary underline hover:no-underline"
            >
              {c.betweenSessionLinkNotes}
            </Link>
            {c.betweenSessionAnd}
            <Link
              to={lp('/secure-practice-management')}
              className="text-primary underline hover:no-underline"
            >
              {c.betweenSessionLinkSecure}
            </Link>
            {c.betweenSessionDot}
          </p>
        </section>

        {/* Honest limitations section. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.notReplaceTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">{c.notReplaceIntro}</p>
          <ul className="list-disc pl-5 space-y-3 text-gray-700 leading-relaxed mb-4">
            {c.notReplaceList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-gray-700 leading-relaxed">{c.notReplaceClose}</p>
        </section>

        {/* Rule 3 — honest comparison table. */}
        {/* <!-- SimplePractice pricing verified at simplepractice.com/pricing July 2026 -->
            <!-- Jane App pricing verified at janeapp.com/pricing July 2026 --> */}
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
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.sp}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.jane}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.ehr}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.tableRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="p-3 border border-gray-200 font-medium">{row.label}</td>
                    <td className="p-3 border border-gray-200">{row.p}</td>
                    <td className="p-3 border border-gray-200">{row.sp}</td>
                    <td className="p-3 border border-gray-200">{row.jane}</td>
                    <td className="p-3 border border-gray-200">{row.ehr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">{c.tableNote}</p>
        </section>

        {/* Administrative load reduction section. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.adminLoadTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.adminLoadP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.adminLoadP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.adminLoadP3}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.adminLoadP4}{' '}
            <Link
              to={lp('/security/encryption')}
              className="text-primary underline hover:no-underline"
            >
              {c.adminLoadLinkSecure}
            </Link>.
          </p>
        </section>

        {/* Rule 4 — FAQ block. */}
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

        {/* CTA block — Rule 6: link to / and sibling pages. */}
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
              to={lp('/ai-session-notes-for-therapists')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkNotes}
            </Link>
            <Link
              to={lp('/security/encryption')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkSecure}
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
