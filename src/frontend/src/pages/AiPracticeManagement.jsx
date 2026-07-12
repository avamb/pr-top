import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /ai-practice-management  —  AI practice management for therapists (SEO landing page).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest comparison table — PR-TOP vs SimplePractice, Jane App, generic EHR.
 *      PR-TOP is light practice support (clients, sessions, notes, analytics), NOT a
 *      US-insurance EHR. Honest about gaps: no billing/invoicing, no scheduling,
 *      no insurance claims, no US EHR integrations.
 *   4. FAQ block + FAQPage JSON-LD (5-6 items)
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + /ai-session-notes-for-therapists,
 *      /secure-practice-management, /security/gdpr
 *   7. PR-TOP wedge in first two H2s: diary + exercises + crisis alerts + Telegram
 *
 * Page angle: PR-TOP is the BETWEEN-SESSION layer that full-suite EHRs like
 * SimplePractice / Jane App lack: a Telegram client channel with voice/text/video
 * diary, guided exercises, SOS alerts. Honest about what PR-TOP does NOT replace.
 */

const CONTENT = {
  en: {
    seoTitle: 'AI Practice Management for Therapists — PR-TOP (2026)',
    seoDescription:
      'AI practice management for therapists: PR-TOP manages clients, sessions, notes and analytics, plus a Telegram bot for diary, exercises and SOS. GDPR-first.',
    articleHeadline: 'AI Practice Management for Therapists — What PR-TOP Does (and Does Not Do)',
    articleDescription:
      'Honest 2026 guide to AI practice management: what PR-TOP manages (clients, sessions, notes, analytics, between-session bot), and where SimplePractice or Jane App is a better fit.',
    badge: 'Practice management',
    h1: 'AI practice management for therapists',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    intro:
      'PR-TOP manages your client list, session records, AI-drafted notes and basic practice analytics — then adds a layer no EHR provides: a Telegram bot your clients use daily for voice/text diary, exercises and one-tap crisis alerts. It is not a billing suite, scheduler or US insurance EHR; it is the between-session layer.',

    whatManagesTitle: 'What PR-TOP manages for your practice',
    whatManagesP1:
      'Most practice-management tools were designed around billing cycles and insurance codes. PR-TOP is designed around the therapeutic relationship — specifically the 167 hours per week your clients spend outside your office. Here is what the platform handles:',
    whatManagesList: [
      'Client roster — unlimited encrypted client profiles, consent tracking, and timeline view of all sessions, diary entries and exercises in one place.',
      'Session records — upload audio or video (up to 100 MB), transcribe via Whisper, generate an AI summary and draft a progress note. All Class A data (transcripts, notes, diary) is encrypted at the application layer; the database never holds plaintext.',
      'Between-session Telegram bot — clients connect via invite link or deep link. They send voice messages, text entries and short videos directly from Telegram. Every entry lands in the encrypted dashboard for you to review before the next session.',
      'Exercise library — pre-seeded multilingual exercises (EN/RU/UK/ES) plus custom exercises you create. Assign with one click; the bot tracks completion and surfaces the status on the client timeline.',
      'Crisis / SOS channel — clients trigger a one-tap SOS inside Telegram. You receive a multi-channel alert (Telegram + email) immediately, with a structured lifecycle so nothing falls through the cracks.',
      'Basic analytics — session count, diary frequency, exercise completion rates, activity feed and exportable reports (PDF/JSON/CSV on Pro and above).',
      'Four languages — the full dashboard and the client bot run in English, Russian, Ukrainian and Spanish with no switching cost.',
    ],
    whatManagesP2:
      'All of this is therapist-controlled. Clients can only see their own data. You decide what the bot sends, which exercises are assigned and when the SOS workflow escalates.',

    betweenSessionTitle: 'The between-session layer: where PR-TOP earns its place',
    betweenSessionP1a:
      'SimplePractice and Jane App are excellent scheduling and billing platforms. They end when the session ends. PR-TOP exists in the ',
    betweenSessionP1em: 'space between sessions',
    betweenSessionP1b:
      ' — the 95% of a client\'s week that traditional practice management software ignores. The Telegram bot is the delivery mechanism: clients already use Telegram daily, so adoption friction is near zero. The therapist\'s dashboard is the control layer: every diary entry, completed exercise and SOS event is logged, encrypted and visible on the client timeline before the next session.',
    betweenSessionP2:
      'This is the wedge. If your pain point is billing, scheduling or insurance claims, use SimplePractice or Jane App. If your pain point is losing client context between sessions, double-documenting what clients reported verbally at the start of each session, or not having a structured crisis channel, PR-TOP is built for exactly that — and it runs alongside any EHR you already use.',
    betweenSessionSee: 'See also: ',
    betweenSessionLinkNotes: 'how PR-TOP drafts AI session notes',
    betweenSessionAnd: ' and ',
    betweenSessionLinkSecure: 'secure practice management',
    betweenSessionDot: '.',

    notReplaceTitle: 'What PR-TOP does NOT replace',
    notReplaceIntro:
      'Honesty matters. PR-TOP is not a full-suite EHR and does not pretend to be. Before you sign up, make sure you have a separate solution for:',
    notReplaceList: [
      'Scheduling and calendar management — PR-TOP has no appointment booking or calendar sync. Use SimplePractice, Jane App, Calendly or your existing scheduler.',
      'Billing and invoicing — PR-TOP does not generate invoices, process insurance claims or handle superbills. If you bill insurance (particularly US payers), you need a dedicated billing platform.',
      'Insurance claims and ERA processing — US-specific EHR workflows (CMS-1500, ERA, ERA remittance) are not in scope.',
      'US EHR integrations — PR-TOP does not connect to Epic, Cerner, TherapyNotes or other US EHR systems.',
      'Telehealth video infrastructure — PR-TOP is not a video call platform. Conduct sessions via Zoom, Doxy.me, or your EHR\'s built-in telehealth and use PR-TOP for documentation and the between-session channel.',
    ],
    notReplaceClose:
      'The honest position: PR-TOP replaces a paper client notebook, a WhatsApp group chat with clients, and the habit of asking "how was your week?" at the start of every session. It does not replace your EHR, your scheduler or your billing software.',

    tableTitle: 'Comparison: PR-TOP vs SimplePractice vs Jane App vs generic EHR (2026)',
    tableHead: { feature: 'Feature', prtop: 'PR-TOP', sp: 'SimplePractice', jane: 'Jane App', ehr: 'Generic EHR' },
    tableRows: [
      {
        label: 'Category',
        p: 'Light practice management + between-session bot',
        sp: 'Full-suite US EHR (scheduling, billing, notes)',
        jane: 'Full-suite EHR (scheduling, billing, telehealth)',
        ehr: 'Clinical records, billing, compliance',
      },
      {
        label: 'Pricing (from)',
        p: 'Free Trial, then €9/mo Basic, €19/mo Pro',
        sp: '~$29/mo Solo, scales per client volume',
        jane: '~CAD $39/mo base + per-practitioner fee',
        ehr: 'Varies widely; often $100–400/mo',
      },
      {
        label: 'Client-facing Telegram bot',
        p: 'Yes — diary, exercises, SOS',
        sp: 'No',
        jane: 'No',
        ehr: 'No (rare add-ons exist)',
      },
      {
        label: 'Between-session diary',
        p: 'Yes — voice / text / video, encrypted',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Crisis / SOS alerts',
        p: 'One-tap SOS with multi-channel therapist notify',
        sp: 'No',
        jane: 'No',
        ehr: 'Rarely; requires custom workflow',
      },
      {
        label: 'AI session notes (Whisper)',
        p: 'Yes (upload + transcribe + summarize)',
        sp: 'Yes (AutoNote add-on)',
        jane: 'Limited (third-party integrations)',
        ehr: 'Varies by platform',
      },
      {
        label: 'Exercise library',
        p: 'Yes — pre-seeded + custom, bot-delivered',
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
        label: 'Insurance claims (US)',
        p: 'No',
        sp: 'Yes — US-centric',
        jane: 'Canada-primary; US add-on',
        ehr: 'Depends on country focus',
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
        p: 'EU/CIS/LATAM therapists needing between-session continuity + a client channel',
        sp: 'US therapists needing a full EHR with billing and scheduling',
        jane: 'Canadian therapists needing scheduling, billing and telehealth',
        ehr: 'Clinics needing regulated clinical records + billing compliance',
      },
    ],
    tableNote:
      'SimplePractice and Jane App figures verified against public pricing pages in July 2026. Numbers may change; check each vendor before purchasing.',

    euVsUsTitle: 'EU practices vs US EHR tools: why the fit matters',
    euVsUsP1:
      'SimplePractice is a US product built around US insurance workflows, US HIPAA compliance and English-language use. Jane App is a Canadian product built around Canadian billing codes and scheduling. Both are excellent within their target market. Both are awkward fits for a solo psychologist in Berlin, Warsaw, Kyiv or Buenos Aires who does not bill insurance, works in Russian or Spanish, and needs GDPR documentation by default.',
    euVsUsP2:
      'PR-TOP is built EU-first. Data never leaves Hetzner\'s EU infrastructure. A Data Processing Addendum is included by default with every account — you do not have to negotiate it. Application-layer AES encryption means even a database administrator with direct server access cannot read a client\'s diary entries or session transcripts.',
    euVsUsP3:
      'If you are an EU therapist currently using a US EHR primarily because it has an AI notes feature, consider splitting the stack: keep your scheduler/biller if you need one, run PR-TOP for session documentation and the between-session client channel, and save on a full EHR license you do not fully use.',
    euVsUsLinkGdpr: 'Read the full GDPR compliance page',
    euVsUsDot: '.',

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'Is PR-TOP a full practice management system?',
        a: 'No — and we say so clearly. PR-TOP is light practice management (client roster, session records, AI notes, analytics) plus the between-session layer that full-suite EHRs lack: a Telegram bot for diary, exercises and crisis alerts. It does not include scheduling, billing, invoicing, insurance claims or US EHR integrations. If you need those features, use SimplePractice, Jane App or a local EHR alongside PR-TOP.',
      },
      {
        q: 'Can PR-TOP replace SimplePractice?',
        a: 'For US therapists who bill insurance: no. SimplePractice is a full EHR with claims management, ERA processing, scheduling and a mature US compliance posture. PR-TOP does none of those things. For EU or CIS therapists who do not bill insurance and want a GDPR-first tool with a client-facing Telegram bot, PR-TOP covers the overlap (client records, session notes, analytics) and adds significant between-session functionality that SimplePractice does not have.',
      },
      {
        q: 'How does the Telegram diary work in practice?',
        a: 'You invite a client by sending them a deep link or an invite code. They open it in Telegram, which connects their account to your dashboard. From that point, they can send voice messages, text entries and short video clips directly in Telegram — no separate app to download. Every entry is encrypted before it touches the database and appears on the client\'s timeline in your dashboard within seconds. You review it before the next session; the AI can also summarize the week\'s diary entries to speed up session prep.',
      },
      {
        q: 'What happens when a client triggers an SOS?',
        a: 'The client taps the SOS button inside the Telegram bot. PR-TOP immediately sends you a multi-channel alert (Telegram message + email). The SOS event is logged on the client timeline with a timestamp, creating an auditable record. The platform tracks the lifecycle: alert sent, acknowledged, resolved. You can configure escalation paths (e.g., notify a supervisor if you do not acknowledge within N minutes) on Pro and Premium plans.',
      },
      {
        q: 'Does PR-TOP work for group practice or only solo therapists?',
        a: 'Both. A solo therapist on the Basic plan gets the full feature set for a small client list. A group practice on Pro or Premium can add multiple therapist accounts, each with their own client roster and dashboard. Superadmin access lets a clinic director view aggregate stats, manage therapist accounts and configure AI providers without accessing individual client data.',
      },
      {
        q: 'How is PR-TOP priced compared to a full EHR?',
        a: 'PR-TOP starts at €9/month (Basic) and €19/month (Pro) after a free Trial, with no per-client or per-session fees. A full EHR like SimplePractice starts at around $29/month but rises with volume; Jane App charges a per-practitioner fee on top of the base plan. PR-TOP is intentionally lighter and cheaper because it does not include billing or scheduling infrastructure — it is the complementary between-session layer, not a replacement for your entire clinical stack.',
      },
    ],

    ctaTitle: 'Try PR-TOP free — no credit card required',
    ctaText:
      'The free Trial takes about ten minutes to set up: create an account, add your first client, connect the Telegram bot. No card required, no automatic upgrade. Export your data and leave at any time with no lock-in.',
    ctaButton: 'Start free trial',
    ctaLinkNotes: 'How AI session notes work',
    ctaLinkGdpr: 'GDPR compliance',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'AI-управление практикой для психологов — PR-TOP (2026)',
    seoDescription:
      'PR-TOP — лёгкое AI-управление практикой: клиенты, сессии, заметки, аналитика и Telegram-бот для клиентов с дневником, упражнениями и SOS. Хостинг в ЕС, GDPR.',
    articleHeadline: 'AI-управление практикой для психологов — что делает PR-TOP (и чего не делает)',
    articleDescription:
      'Честный обзор 2026 года: что PR-TOP управляет в практике (клиенты, сессии, заметки, аналитика, бот между сессиями) и где лучше подойдёт SimplePractice или Jane App.',
    badge: 'Управление практикой',
    h1: 'AI-управление практикой для психологов',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',

    intro:
      'PR-TOP управляет списком клиентов, записями сессий, AI-заметками и базовой аналитикой практики — и добавляет слой, которого нет ни в одной EHR: Telegram-бот для голосового/текстового дневника, упражнений и SOS в одно касание. Это не система биллинга, не планировщик и не американская страховая EHR — это слой работы между сессиями.',

    whatManagesTitle: 'Чем PR-TOP управляет в вашей практике',
    whatManagesP1:
      'Большинство систем управления практикой созданы вокруг циклов выставления счётов и страховых кодов. PR-TOP создан вокруг терапевтических отношений — прежде всего 167 часов в неделю, которые ваши клиенты проводят вне кабинета. Вот что платформа берёт на себя:',
    whatManagesList: [
      'Список клиентов — неограниченное количество зашифрованных профилей, отслеживание согласий и хронология всех сессий, записей дневника и упражнений в одном месте.',
      'Записи сессий — загружайте аудио или видео (до 100 МБ), транскрибируйте через Whisper, получайте AI-резюме и черновик заметки. Все данные класса A (транскрипты, заметки, дневник) шифруются на уровне приложения; база данных не хранит открытый текст.',
      'Telegram-бот между сессиями — клиенты подключаются по ссылке-приглашению или deep link. Они отправляют голосовые сообщения, текст и короткие видео прямо в Telegram. Каждая запись попадает в зашифрованный кабинет — вы просматриваете их перед следующей сессией.',
      'Библиотека упражнений — предустановленные многоязычные упражнения (EN/RU/UK/ES) плюс созданные вами. Назначайте в один клик; бот отслеживает выполнение, статус виден в хронологии клиента.',
      'Кризисный канал / SOS — клиент нажимает SOS внутри Telegram-бота. Вы получаете многоканальное оповещение (Telegram + email) немедленно, с журналом жизненного цикла события.',
      'Базовая аналитика — количество сессий, частота записей дневника, выполнение упражнений, лента активности и отчёты для экспорта (PDF/JSON/CSV на тарифах Pro и выше).',
      'Четыре языка — полный кабинет и бот для клиентов работают на английском, русском, украинском и испанском.',
    ],
    whatManagesP2:
      'Всё это под контролем психолога. Клиенты видят только свои данные. Вы решаете, что отправляет бот, какие упражнения назначены и когда срабатывает эскалация SOS.',

    betweenSessionTitle: 'Слой между сессиями: почему PR-TOP занимает своё место',
    betweenSessionP1a:
      'SimplePractice и Jane App — отличные платформы для расписания и биллинга. Они заканчиваются, когда заканчивается сессия. PR-TOP существует в ',
    betweenSessionP1em: 'пространстве между сессиями',
    betweenSessionP1b:
      ' — в тех 95% недели клиента, которые традиционные системы управления практикой игнорируют. Telegram-бот — это канал доставки: клиенты уже используют Telegram каждый день, поэтому порог входа минимален. Кабинет психолога — это управляющий слой: каждая запись дневника, выполненное упражнение и событие SOS фиксируются, шифруются и видны в хронологии клиента до следующей сессии.',
    betweenSessionP2:
      'Это и есть конкурентное преимущество. Если ваша проблема — биллинг, расписание или страховые требования, используйте SimplePractice или Jane App. Если ваша проблема — потеря контекста клиента между сессиями, двойная документация или отсутствие структурированного кризисного канала, PR-TOP создан именно для этого — и работает параллельно с любой EHR.',
    betweenSessionSee: 'Смотрите также: ',
    betweenSessionLinkNotes: 'как PR-TOP составляет AI-заметки сессий',
    betweenSessionAnd: ' и ',
    betweenSessionLinkSecure: 'безопасное управление практикой',
    betweenSessionDot: '.',

    notReplaceTitle: 'Что PR-TOP НЕ заменяет',
    notReplaceIntro:
      'Честность важна. PR-TOP — не полнофункциональная EHR и не претендует на это. Перед регистрацией убедитесь, что у вас есть отдельное решение для:',
    notReplaceList: [
      'Расписания и управления календарём — в PR-TOP нет записи на приём или синхронизации с календарём. Используйте SimplePractice, Jane App, Calendly или имеющийся планировщик.',
      'Биллинга и выставления счётов — PR-TOP не создаёт счета, не обрабатывает страховые требования и не работает со суперсчетами.',
      'Страховых требований и обработки ERA — американские рабочие процессы EHR (CMS-1500, ERA) не входят в рамки платформы.',
      'Интеграций с американскими EHR — PR-TOP не подключается к Epic, Cerner, TherapyNotes и другим системам.',
      'Инфраструктуры телемедицины — PR-TOP не является видеоплатформой. Проводите сессии через Zoom, Doxy.me или встроенный телемедицинский модуль вашей EHR, а PR-TOP используйте для документации и канала между сессиями.',
    ],
    notReplaceClose:
      'Честная позиция: PR-TOP заменяет бумажный блокнот с заметками о клиентах, чат в WhatsApp с клиентами и привычку спрашивать «как прошла неделя?» в начале каждой сессии. Он не заменяет вашу EHR, планировщик или биллинговое ПО.',

    tableTitle: 'Сравнение: PR-TOP vs SimplePractice vs Jane App vs типичная EHR (2026)',
    tableHead: { feature: 'Функция', prtop: 'PR-TOP', sp: 'SimplePractice', jane: 'Jane App', ehr: 'Типичная EHR' },
    tableRows: [
      {
        label: 'Категория',
        p: 'Лёгкое управление практикой + бот между сессиями',
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
        label: 'Telegram-бот для клиентов',
        p: 'Да — дневник, упражнения, SOS',
        sp: 'Нет',
        jane: 'Нет',
        ehr: 'Нет',
      },
      {
        label: 'Дневник между сессиями',
        p: 'Да — голос / текст / видео, с шифрованием',
        sp: 'Нет',
        jane: 'Нет',
        ehr: 'Нет',
      },
      {
        label: 'Кризисные / SOS-оповещения',
        p: 'SOS в одно касание с мультиканальным уведомлением',
        sp: 'Нет',
        jane: 'Нет',
        ehr: 'Редко; требует кастомного процесса',
      },
      {
        label: 'AI-заметки (Whisper)',
        p: 'Да (загрузка + транскрипция + резюме)',
        sp: 'Да (дополнение AutoNote)',
        jane: 'Ограниченно (интеграции сторонних сервисов)',
        ehr: 'Зависит от платформы',
      },
      {
        label: 'Библиотека упражнений',
        p: 'Да — предустановленные + кастомные, через бот',
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
        label: 'Страховые требования (США)',
        p: 'Нет',
        sp: 'Да — ориентация на США',
        jane: 'Канада — основной рынок; США — дополнение',
        ehr: 'Зависит от страны фокуса',
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
        p: 'Психологам из ЕС/СНГ/LATAM, которым нужна работа между сессиями',
        sp: 'Психологам из США, которым нужна полная EHR с биллингом',
        jane: 'Психологам из Канады с расписанием и биллингом',
        ehr: 'Клиникам с регулируемыми записями и биллинговым комплаенсом',
      },
    ],
    tableNote:
      'Данные SimplePractice и Jane App сверены с публичными страницами цен в июле 2026. Цифры могут меняться.',

    euVsUsTitle: 'Практики в ЕС vs американские EHR: почему это важно',
    euVsUsP1:
      'SimplePractice — американский продукт, созданный вокруг страховых процессов США, американского HIPAA и англоязычного использования. Jane App — канадский продукт, созданный вокруг канадских кодов биллинга и расписания. Оба отлично работают на своём целевом рынке. Оба плохо подходят частнопрактикующему психологу в Берлине, Варшаве, Киеве или Буэнос-Айресе, который не работает со страховкой, ведёт приём на русском или испанском и нуждается в GDPR-документации по умолчанию.',
    euVsUsP2:
      'PR-TOP создан ЕС-first. Данные никогда не покидают инфраструктуру Hetzner в ЕС. Соглашение об обработке данных (DPA) включено по умолчанию с каждым аккаунтом — его не нужно отдельно согласовывать. Шифрование на уровне приложения (AES) означает, что даже администратор базы данных с прямым доступом к серверу не сможет прочитать записи дневника клиента или транскрипты сессий.',
    euVsUsP3:
      'Если вы психолог из ЕС, который сейчас использует американскую EHR только ради функции AI-заметок, рассмотрите разделение стека: оставьте планировщик/биллинг, если они нужны, и используйте PR-TOP для документации сессий и канала между сессиями.',
    euVsUsLinkGdpr: 'Читать полную страницу о соответствии GDPR',
    euVsUsDot: '.',

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'Является ли PR-TOP полноценной системой управления практикой?',
        a: 'Нет — и мы говорим об этом прямо. PR-TOP — это лёгкое управление практикой (список клиентов, записи сессий, AI-заметки, аналитика) плюс слой между сессиями, которого нет у полнофункциональных EHR: Telegram-бот для дневника, упражнений и кризисных оповещений. Расписания, биллинга, выставления счётов, страховых требований и интеграций с американскими EHR нет. Если вам нужны эти функции, используйте SimplePractice, Jane App или местную EHR вместе с PR-TOP.',
      },
      {
        q: 'Может ли PR-TOP заменить SimplePractice?',
        a: 'Для психологов из США, работающих со страховками — нет. SimplePractice — полноценная EHR с управлением требованиями, обработкой ERA, расписанием и зрелым комплаенсом для США. PR-TOP этого не делает. Для психологов из ЕС или СНГ, которые не работают со страховками и хотят GDPR-first инструмент с Telegram-ботом для клиентов, PR-TOP покрывает пересечение (записи клиентов, заметки сессий, аналитика) и добавляет функциональность между сессиями, которой у SimplePractice нет.',
      },
      {
        q: 'Как работает Telegram-дневник на практике?',
        a: 'Вы приглашаете клиента по ссылке или invite-коду. Клиент открывает её в Telegram — это связывает его аккаунт с вашим кабинетом. После этого он отправляет голосовые сообщения, текст и короткие видео прямо в Telegram, без отдельного приложения. Каждая запись шифруется перед сохранением в базе и появляется в хронологии клиента в вашем кабинете через несколько секунд.',
      },
      {
        q: 'Что происходит, когда клиент нажимает SOS?',
        a: 'Клиент нажимает кнопку SOS внутри Telegram-бота. PR-TOP немедленно отправляет вам многоканальное оповещение (Telegram + email). Событие SOS записывается в хронологию клиента с временной меткой. Платформа отслеживает жизненный цикл: оповещение отправлено, подтверждено, закрыто. На тарифах Pro и Premium можно настроить эскалацию.',
      },
      {
        q: 'Работает ли PR-TOP для групповой практики или только для одного специалиста?',
        a: 'Для обоих вариантов. Одиночный специалист на тарифе Basic получает полный набор функций для небольшого списка клиентов. Групповая практика на Pro или Premium может добавлять несколько аккаунтов психологов, каждый со своим списком клиентов и кабинетом.',
      },
      {
        q: 'Как соотносятся цены PR-TOP и полноценной EHR?',
        a: 'PR-TOP начинается с €9/мес (Basic) и €19/мес (Pro) после бесплатного Trial, без поклиентской или посессионной оплаты. Полноценная EHR, как SimplePractice, начинается от ~$29/мес и растёт с объёмом. PR-TOP намеренно легче и дешевле — он не включает инфраструктуру биллинга или расписания, а является дополнительным слоем между сессиями, а не заменой всего клинического стека.',
      },
    ],

    ctaTitle: 'Попробуйте PR-TOP бесплатно — карта не нужна',
    ctaText:
      'Настройка бесплатного Trial занимает около десяти минут: создайте аккаунт, добавьте первого клиента, подключите Telegram-бот. Карта не нужна, автоматического перехода на платный план нет. Выгрузите данные и уйдите в любой момент без привязки.',
    ctaButton: 'Начать бесплатно',
    ctaLinkNotes: 'Как работают AI-заметки сессий',
    ctaLinkGdpr: 'Соответствие GDPR',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'AI-управління практикою для психологів — PR-TOP (2026)',
    seoDescription:
      'PR-TOP — легке AI-управління практикою: клієнти, сесії, нотатки, аналітика та Telegram-бот для клієнтів зі щоденником, вправами та SOS. Хостинг у ЄС, GDPR.',
    articleHeadline: 'AI-управління практикою для психологів — що робить PR-TOP (і чого не робить)',
    articleDescription:
      'Чесний огляд 2026 року: що PR-TOP управляє в практиці (клієнти, сесії, нотатки, аналітика, бот між сесіями) і де краще підійде SimplePractice або Jane App.',
    badge: 'Управління практикою',
    h1: 'AI-управління практикою для психологів',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',

    intro:
      'PR-TOP керує списком клієнтів, записами сесій, AI-нотатками та базовою аналітикою практики — і додає шар, якого немає в жодній EHR: Telegram-бот для голосового/текстового щоденника, вправ та SOS в один дотик. Це не система білінгу, не планувальник і не американська страхова EHR — це шар роботи між сесіями.',

    whatManagesTitle: 'Чим PR-TOP управляє у вашій практиці',
    whatManagesP1:
      'Більшість систем управління практикою створені навколо циклів виставлення рахунків і страхових кодів. PR-TOP створено навколо терапевтичних відносин — насамперед 167 годин на тиждень, які ваші клієнти проводять поза кабінетом. Ось що платформа бере на себе:',
    whatManagesList: [
      'Список клієнтів — необмежена кількість зашифрованих профілів, відстеження згод та хронологія всіх сесій, записів щоденника і вправ в одному місці.',
      'Записи сесій — завантажуйте аудіо або відео (до 100 МБ), транскрибуйте через Whisper, отримуйте AI-резюме та чернетку нотатки. Усі дані класу A (транскрипти, нотатки, щоденник) шифруються на рівні застосунку.',
      'Telegram-бот між сесіями — клієнти підключаються за посиланням-запрошенням або deep link. Вони надсилають голосові повідомлення, текст і короткі відео прямо в Telegram. Кожен запис потрапляє до зашифрованого кабінету перед наступною сесією.',
      'Бібліотека вправ — попередньо завантажені багатомовні вправи (EN/RU/UK/ES) плюс власні. Призначайте одним кліком; бот відстежує виконання, статус видно в хронології клієнта.',
      'Кризовий канал / SOS — клієнт натискає SOS у Telegram-боті. Ви отримуєте багатоканальне сповіщення (Telegram + email) негайно, з журналом життєвого циклу події.',
      'Базова аналітика — кількість сесій, частота записів щоденника, виконання вправ, стрічка активності та звіти для експорту (PDF/JSON/CSV на тарифах Pro і вище).',
      'Чотири мови — повний кабінет і бот для клієнтів працюють англійською, російською, українською та іспанською.',
    ],
    whatManagesP2:
      'Усе це під контролем психолога. Клієнти бачать лише свої дані. Ви вирішуєте, що надсилає бот, які вправи призначені і коли спрацьовує ескалація SOS.',

    betweenSessionTitle: 'Шар між сесіями: чому PR-TOP займає своє місце',
    betweenSessionP1a:
      'SimplePractice і Jane App — відмінні платформи для розкладу та білінгу. Вони закінчуються, коли закінчується сесія. PR-TOP існує в ',
    betweenSessionP1em: 'просторі між сесіями',
    betweenSessionP1b:
      ' — у тих 95% тижня клієнта, які традиційні системи управління практикою ігнорують. Telegram-бот — це канал доставки: клієнти вже використовують Telegram щодня, тому поріг входу мінімальний. Кабінет психолога — це управляючий шар: кожен запис щоденника, виконана вправа та подія SOS фіксуються, шифруються і видні в хронології клієнта до наступної сесії.',
    betweenSessionP2:
      'Якщо ваша проблема — білінг, розклад або страхові вимоги, використовуйте SimplePractice або Jane App. Якщо ваша проблема — втрата контексту клієнта між сесіями або відсутність структурованого кризового каналу, PR-TOP створено саме для цього — і він працює паралельно з будь-якою EHR.',
    betweenSessionSee: 'Дивіться також: ',
    betweenSessionLinkNotes: 'як PR-TOP складає AI-нотатки сесій',
    betweenSessionAnd: ' та ',
    betweenSessionLinkSecure: 'безпечне управління практикою',
    betweenSessionDot: '.',

    notReplaceTitle: 'Що PR-TOP НЕ замінює',
    notReplaceIntro:
      'Чесність важлива. PR-TOP — не повнофункціональна EHR і не претендує на це. Перед реєстрацією переконайтеся, що у вас є окреме рішення для:',
    notReplaceList: [
      'Розкладу та управління календарем — у PR-TOP немає запису на прийом або синхронізації з календарем. Використовуйте SimplePractice, Jane App, Calendly або наявний планувальник.',
      'Білінгу та виставлення рахунків — PR-TOP не створює рахунків і не обробляє страхові вимоги.',
      'Страхових вимог і обробки ERA — американські робочі процеси EHR (CMS-1500, ERA) не входять до рамок платформи.',
      'Інтеграцій з американськими EHR — PR-TOP не підключається до Epic, Cerner, TherapyNotes та інших систем.',
      'Інфраструктури телемедицини — PR-TOP не є відеоплатформою. Проводьте сесії через Zoom або Doxy.me, а PR-TOP використовуйте для документації та каналу між сесіями.',
    ],
    notReplaceClose:
      'Чесна позиція: PR-TOP замінює паперовий блокнот із нотатками про клієнтів, чат у WhatsApp з клієнтами та звичку запитувати «як минув тиждень?» на початку кожної сесії. Він не замінює вашу EHR, планувальник або програмне забезпечення для білінгу.',

    tableTitle: 'Порівняння: PR-TOP vs SimplePractice vs Jane App vs типова EHR (2026)',
    tableHead: { feature: 'Функція', prtop: 'PR-TOP', sp: 'SimplePractice', jane: 'Jane App', ehr: 'Типова EHR' },
    tableRows: [
      {
        label: 'Категорія',
        p: 'Легке управління практикою + бот між сесіями',
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
        label: 'Telegram-бот для клієнтів',
        p: 'Так — щоденник, вправи, SOS',
        sp: 'Ні',
        jane: 'Ні',
        ehr: 'Ні',
      },
      {
        label: 'Щоденник між сесіями',
        p: 'Так — голос / текст / відео, із шифруванням',
        sp: 'Ні',
        jane: 'Ні',
        ehr: 'Ні',
      },
      {
        label: 'Кризові / SOS-сповіщення',
        p: 'SOS в один дотик із мультиканальним сповіщенням',
        sp: 'Ні',
        jane: 'Ні',
        ehr: 'Рідко; потребує окремого процесу',
      },
      {
        label: 'AI-нотатки (Whisper)',
        p: 'Так (завантаження + транскрипція + резюме)',
        sp: 'Так (доповнення AutoNote)',
        jane: 'Обмежено (інтеграції сторонніх сервісів)',
        ehr: 'Залежить від платформи',
      },
      {
        label: 'Бібліотека вправ',
        p: 'Так — попередньо завантажені + власні, через бот',
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
        label: 'Страхові вимоги (США)',
        p: 'Ні',
        sp: 'Так — орієнтація на США',
        jane: 'Канада — основний ринок; США — доповнення',
        ehr: 'Залежить від країни фокусу',
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
        p: 'Психологам з ЄС/СНД/LATAM, яким потрібна робота між сесіями',
        sp: 'Психологам зі США, яким потрібна повна EHR з білінгом',
        jane: 'Психологам з Канади з розкладом і білінгом',
        ehr: 'Клінікам з регульованими записами та білінговим комплаєнсом',
      },
    ],
    tableNote:
      'Дані SimplePractice і Jane App звірено з публічними сторінками цін у липні 2026. Цифри можуть змінюватися.',

    euVsUsTitle: 'Практики в ЄС vs американські EHR: чому відповідність важлива',
    euVsUsP1:
      'SimplePractice — американський продукт, створений навколо страхових процесів США, американського HIPAA та англомовного використання. Jane App — канадський продукт, створений навколо канадських кодів білінгу та розкладу. Обидва чудово працюють на своєму цільовому ринку. Обидва погано підходять приватнопрактикуючому психологу в Берліні, Варшаві, Києві або Буенос-Айресі.',
    euVsUsP2:
      'PR-TOP створено ЄС-first. Дані ніколи не залишають інфраструктуру Hetzner в ЄС. Угода про обробку даних (DPA) включена за замовчуванням з кожним акаунтом. Шифрування на рівні застосунку (AES) означає, що навіть адміністратор бази даних з прямим доступом до сервера не зможе прочитати записи щоденника клієнта або транскрипти сесій.',
    euVsUsP3:
      'Якщо ви психолог з ЄС, який зараз використовує американську EHR лише заради функції AI-нотаток, розгляньте розділення стека: залиште планувальник/білінг, якщо вони потрібні, і використовуйте PR-TOP для документації сесій та каналу між сесіями.',
    euVsUsLinkGdpr: 'Читати повну сторінку про відповідність GDPR',
    euVsUsDot: '.',

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'Чи є PR-TOP повноцінною системою управління практикою?',
        a: 'Ні — і ми говоримо про це відкрито. PR-TOP — це легке управління практикою (список клієнтів, записи сесій, AI-нотатки, аналітика) плюс шар між сесіями, якого немає у повнофункціональних EHR: Telegram-бот для щоденника, вправ і кризових сповіщень. Розкладу, білінгу, виставлення рахунків, страхових вимог та інтеграцій з американськими EHR немає.',
      },
      {
        q: 'Чи може PR-TOP замінити SimplePractice?',
        a: 'Для психологів зі США, які працюють зі страховками — ні. SimplePractice — повноцінна EHR з управлінням вимогами, обробкою ERA, розкладом і зрілим комплаєнсом для США. PR-TOP цього не робить. Для психологів з ЄС або СНД, які не працюють зі страховками і хочуть GDPR-first інструмент із Telegram-ботом для клієнтів, PR-TOP покриває перетин і додає функціональність між сесіями, якої у SimplePractice немає.',
      },
      {
        q: 'Як працює Telegram-щоденник на практиці?',
        a: 'Ви запрошуєте клієнта за посиланням або invite-кодом. Клієнт відкриває його в Telegram — це пов\'язує його акаунт із вашим кабінетом. Після цього він надсилає голосові повідомлення, текст і короткі відео прямо в Telegram, без окремого застосунку. Кожен запис шифрується перед збереженням і з\'являється в хронології клієнта у вашому кабінеті через кілька секунд.',
      },
      {
        q: 'Що відбувається, коли клієнт натискає SOS?',
        a: 'Клієнт натискає кнопку SOS у Telegram-боті. PR-TOP негайно надсилає вам багатоканальне сповіщення (Telegram + email). Подія SOS записується в хронологію клієнта з часовою міткою. Платформа відстежує життєвий цикл: сповіщення надіслано, підтверджено, закрито.',
      },
      {
        q: 'Чи працює PR-TOP для групової практики або лише для одного спеціаліста?',
        a: 'Для обох варіантів. Одиночний спеціаліст на тарифі Basic отримує повний набір функцій для невеликого списку клієнтів. Групова практика на Pro або Premium може додавати кілька акаунтів психологів, кожен зі своїм списком клієнтів і кабінетом.',
      },
      {
        q: 'Як співвідносяться ціни PR-TOP і повноцінної EHR?',
        a: 'PR-TOP починається з €9/міс (Basic) і €19/міс (Pro) після безкоштовного Trial, без поклієнтської або посесійної оплати. Повноцінна EHR, як SimplePractice, починається від ~$29/міс і зростає з обсягом. PR-TOP навмисно легший і дешевший — він не включає інфраструктуру білінгу або розкладу.',
      },
    ],

    ctaTitle: 'Спробуйте PR-TOP безкоштовно — картка не потрібна',
    ctaText:
      'Налаштування безкоштовного Trial займає близько десяти хвилин: створіть акаунт, додайте першого клієнта, підключіть Telegram-бот. Картка не потрібна, автоматичного переходу на платний план немає.',
    ctaButton: 'Почати безкоштовно',
    ctaLinkNotes: 'Як працюють AI-нотатки сесій',
    ctaLinkGdpr: 'Відповідність GDPR',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Gestión de consulta con IA para terapeutas — PR-TOP (2026)',
    seoDescription:
      'PR-TOP: gestión de consulta con IA para terapeutas — clientes, sesiones, notas y analítica más Telegram para diario, ejercicios y SOS. UE, GDPR-first.',
    articleHeadline: 'Gestión de consulta con IA para terapeutas — qué hace PR-TOP (y qué no hace)',
    articleDescription:
      'Guía honesta 2026 sobre gestión de consulta con IA: qué gestiona PR-TOP (clientes, sesiones, notas, analítica, bot entre sesiones) y cuándo SimplePractice o Jane App encajan mejor.',
    badge: 'Gestión de consulta',
    h1: 'Gestión de consulta con IA para terapeutas',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',

    intro:
      'PR-TOP gestiona su lista de clientes, registros de sesiones, notas con IA y analítica básica de la consulta — y añade una capa que ningún EHR ofrece: un bot de Telegram que sus clientes usan a diario para diario de voz/texto, ejercicios y alertas de crisis con un toque. No es una suite de facturación, ni un planificador, ni un EHR de seguros de EE. UU.; es la capa entre sesiones.',

    whatManagesTitle: 'Qué gestiona PR-TOP en su consulta',
    whatManagesP1:
      'La mayoría de los sistemas de gestión de consulta están diseñados en torno a ciclos de facturación y códigos de seguros. PR-TOP está diseñado en torno a la relación terapéutica — específicamente las 167 horas semanales que sus clientes pasan fuera de su consulta. Esto es lo que la plataforma se encarga de gestionar:',
    whatManagesList: [
      'Lista de clientes — perfiles cifrados ilimitados, seguimiento de consentimientos y vista de cronología de todas las sesiones, entradas del diario y ejercicios en un solo lugar.',
      'Registros de sesiones — suba audio o vídeo (hasta 100 MB), transcriba con Whisper, genere un resumen con IA y redacte una nota de progreso. Todos los datos de clase A (transcripciones, notas, diario) se cifran en la capa de aplicación.',
      'Bot de Telegram entre sesiones — los clientes se conectan mediante un enlace de invitación o deep link. Envían mensajes de voz, texto y vídeos cortos directamente en Telegram. Cada entrada llega al panel cifrado antes de la próxima sesión.',
      'Biblioteca de ejercicios — ejercicios multilingües preinstalados (EN/RU/UK/ES) y ejercicios propios. Asigne con un clic; el bot hace seguimiento del cumplimiento y muestra el estado en la cronología del cliente.',
      'Canal de crisis / SOS — el cliente activa un SOS con un toque dentro del bot de Telegram. Usted recibe una alerta multicanal (Telegram + email) de inmediato, con un ciclo de vida estructurado.',
      'Analítica básica — número de sesiones, frecuencia del diario, cumplimiento de ejercicios, actividad y reportes exportables (PDF/JSON/CSV en Pro y superior).',
      'Cuatro idiomas — el panel completo y el bot de clientes funcionan en inglés, ruso, ucraniano y español.',
    ],
    whatManagesP2:
      'Todo esto está bajo el control del terapeuta. Los clientes solo ven sus propios datos. Usted decide qué envía el bot, qué ejercicios se asignan y cuándo escala el flujo de SOS.',

    betweenSessionTitle: 'La capa entre sesiones: donde PR-TOP gana su lugar',
    betweenSessionP1a:
      'SimplePractice y Jane App son excelentes plataformas de agenda y facturación. Terminan cuando termina la sesión. PR-TOP existe en el ',
    betweenSessionP1em: 'espacio entre sesiones',
    betweenSessionP1b:
      ' — el 95 % de la semana del cliente que el software tradicional de gestión de consulta ignora. El bot de Telegram es el mecanismo de entrega: los clientes ya usan Telegram a diario, por lo que la fricción de adopción es mínima. El panel del terapeuta es la capa de control: cada entrada del diario, ejercicio completado y evento de SOS queda registrado, cifrado y visible en la cronología del cliente antes de la próxima sesión.',
    betweenSessionP2:
      'Si su problema es la facturación, la agenda o los seguros, use SimplePractice o Jane App. Si su problema es perder el contexto del cliente entre sesiones o no tener un canal de crisis estructurado, PR-TOP está hecho exactamente para eso — y funciona junto a cualquier EHR que ya use.',
    betweenSessionSee: 'Consulte también: ',
    betweenSessionLinkNotes: 'cómo PR-TOP redacta notas de sesión con IA',
    betweenSessionAnd: ' y ',
    betweenSessionLinkSecure: 'gestión segura de consulta',
    betweenSessionDot: '.',

    notReplaceTitle: 'Lo que PR-TOP NO sustituye',
    notReplaceIntro:
      'La honestidad importa. PR-TOP no es un EHR completo y no pretende serlo. Antes de registrarse, asegúrese de tener una solución separada para:',
    notReplaceList: [
      'Agenda y gestión del calendario — PR-TOP no tiene reserva de citas ni sincronización con calendarios. Use SimplePractice, Jane App, Calendly o su planificador actual.',
      'Facturación e invoicing — PR-TOP no genera facturas, no procesa reclamaciones de seguros ni gestiona superbills.',
      'Reclamaciones de seguros y procesamiento ERA — los flujos de trabajo específicos de EHR de EE. UU. (CMS-1500, ERA) están fuera del alcance.',
      'Integraciones con EHR de EE. UU. — PR-TOP no se conecta a Epic, Cerner, TherapyNotes ni otros sistemas.',
      'Infraestructura de telemedicina — PR-TOP no es una plataforma de videollamadas. Realice sesiones por Zoom o Doxy.me y use PR-TOP para la documentación y el canal entre sesiones.',
    ],
    notReplaceClose:
      'La posición honesta: PR-TOP sustituye la libreta de notas de clientes, el chat de WhatsApp con clientes y el hábito de preguntar "¿cómo estuvo tu semana?" al inicio de cada sesión. No sustituye su EHR, su planificador ni su software de facturación.',

    tableTitle: 'Comparativa: PR-TOP vs SimplePractice vs Jane App vs EHR genérico (2026)',
    tableHead: { feature: 'Función', prtop: 'PR-TOP', sp: 'SimplePractice', jane: 'Jane App', ehr: 'EHR genérico' },
    tableRows: [
      {
        label: 'Categoría',
        p: 'Gestión de consulta ligera + bot entre sesiones',
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
        label: 'Bot de Telegram para clientes',
        p: 'Sí — diario, ejercicios, SOS',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Diario entre sesiones',
        p: 'Sí — voz / texto / vídeo, cifrado',
        sp: 'No',
        jane: 'No',
        ehr: 'No',
      },
      {
        label: 'Alertas de crisis / SOS',
        p: 'SOS con un toque y aviso multicanal al terapeuta',
        sp: 'No',
        jane: 'No',
        ehr: 'Raramente; requiere flujo personalizado',
      },
      {
        label: 'Notas con IA (Whisper)',
        p: 'Sí (subida + transcripción + resumen)',
        sp: 'Sí (complemento AutoNote)',
        jane: 'Limitado (integraciones de terceros)',
        ehr: 'Depende de la plataforma',
      },
      {
        label: 'Biblioteca de ejercicios',
        p: 'Sí — preinstalados + propios, entregados por el bot',
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
        label: 'Reclamaciones de seguros (EE. UU.)',
        p: 'No',
        sp: 'Sí — centrado en EE. UU.',
        jane: 'Canadá — mercado principal; EE. UU. como complemento',
        ehr: 'Depende del país de enfoque',
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
        p: 'Terapeutas de UE/CEI/LATAM que necesitan continuidad entre sesiones',
        sp: 'Terapeutas de EE. UU. que necesitan un EHR completo con facturación',
        jane: 'Terapeutas de Canadá con agenda y facturación',
        ehr: 'Clínicas con registros clínicos regulados y cumplimiento de facturación',
      },
    ],
    tableNote:
      'Datos de SimplePractice y Jane App verificados en sus páginas de precios públicas en julio de 2026. Las cifras pueden cambiar.',

    euVsUsTitle: 'Consultas en la UE vs herramientas EHR de EE. UU.: por qué importa el ajuste',
    euVsUsP1:
      'SimplePractice es un producto estadounidense diseñado en torno a los flujos de seguros de EE. UU., el cumplimiento HIPAA y el uso en inglés. Jane App es un producto canadiense diseñado en torno a los códigos de facturación canadienses. Ambos son excelentes dentro de su mercado objetivo. Ambos encajan mal para un psicólogo independiente en Berlín, Varsovia, Kyiv o Buenos Aires que no factura seguros, trabaja en ruso o español y necesita documentación GDPR por defecto.',
    euVsUsP2:
      'PR-TOP está construido con la UE como prioridad. Los datos nunca salen de la infraestructura de Hetzner en la UE. Un Acuerdo de Procesamiento de Datos (DPA) se incluye por defecto en cada cuenta. El cifrado en la capa de aplicación (AES) significa que incluso un administrador de base de datos con acceso directo al servidor no puede leer las entradas del diario del cliente ni las transcripciones de sesiones.',
    euVsUsP3:
      'Si es un terapeuta de la UE que actualmente usa un EHR de EE. UU. principalmente por la función de notas con IA, considere dividir el stack: conserve su planificador/facturador si lo necesita y use PR-TOP para la documentación de sesiones y el canal entre sesiones.',
    euVsUsLinkGdpr: 'Leer la página completa sobre cumplimiento del GDPR',
    euVsUsDot: '.',

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿PR-TOP es un sistema completo de gestión de consulta?',
        a: 'No — y lo decimos claramente. PR-TOP es gestión de consulta ligera (lista de clientes, registros de sesiones, notas con IA, analítica) más la capa entre sesiones que los EHR completos no tienen: un bot de Telegram para diario, ejercicios y alertas de crisis. No incluye agenda, facturación, invoicing, reclamaciones de seguros ni integraciones con EHR de EE. UU. Si necesita esas funciones, use SimplePractice, Jane App o un EHR local junto a PR-TOP.',
      },
      {
        q: '¿Puede PR-TOP sustituir a SimplePractice?',
        a: 'Para terapeutas de EE. UU. que facturan seguros: no. SimplePractice es un EHR completo con gestión de reclamaciones, procesamiento ERA, agenda y un cumplimiento maduro para EE. UU. PR-TOP no hace nada de eso. Para terapeutas de la UE o la CEI que no facturan seguros y quieren una herramienta GDPR-first con un bot de Telegram para clientes, PR-TOP cubre la intersección (registros de clientes, notas de sesión, analítica) y añade funcionalidad entre sesiones que SimplePractice no tiene.',
      },
      {
        q: '¿Cómo funciona el diario de Telegram en la práctica?',
        a: 'Usted invita a un cliente mediante un enlace o código de invitación. El cliente lo abre en Telegram, lo que vincula su cuenta con su panel. A partir de ese momento, envía mensajes de voz, texto y vídeos cortos directamente en Telegram — sin descargar ninguna app adicional. Cada entrada se cifra antes de guardarse y aparece en la cronología del cliente en su panel en segundos.',
      },
      {
        q: '¿Qué ocurre cuando un cliente activa el SOS?',
        a: 'El cliente pulsa el botón SOS dentro del bot de Telegram. PR-TOP le envía inmediatamente una alerta multicanal (Telegram + email). El evento SOS queda registrado en la cronología del cliente con una marca de tiempo. La plataforma sigue el ciclo de vida: alerta enviada, confirmada, resuelta.',
      },
      {
        q: '¿PR-TOP funciona para una consulta grupal o solo para profesionales individuales?',
        a: 'Para ambos. Un profesional individual en el plan Basic obtiene el conjunto completo de funciones para una lista de clientes pequeña. Una consulta grupal en Pro o Premium puede añadir varias cuentas de terapeuta, cada una con su propia lista de clientes y panel.',
      },
      {
        q: '¿Cómo se comparan los precios de PR-TOP con los de un EHR completo?',
        a: 'PR-TOP empieza en €9/mes (Basic) y €19/mes (Pro) tras un Trial gratuito, sin tarifas por cliente ni por sesión. Un EHR completo como SimplePractice empieza en ~$29/mes y sube con el volumen. PR-TOP es intencionadamente más ligero y barato porque no incluye infraestructura de facturación ni agenda — es la capa complementaria entre sesiones, no un sustituto de todo su stack clínico.',
      },
    ],

    ctaTitle: 'Pruebe PR-TOP gratis — sin tarjeta de crédito',
    ctaText:
      'El Trial gratuito se configura en unos diez minutos: cree una cuenta, añada su primer cliente, conecte el bot de Telegram. Sin tarjeta, sin conversión automática a pago. Exporte sus datos y márchese cuando quiera, sin ataduras.',
    ctaButton: 'Empezar gratis',
    ctaLinkNotes: 'Cómo funcionan las notas de sesión con IA',
    ctaLinkGdpr: 'Cumplimiento del GDPR',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function AiPracticeManagement() {
  const { i18n } = useTranslation();
  const locale = ['ru', 'uk', 'es'].includes(i18n.language) ? i18n.language : 'en';
  const c = CONTENT[locale];
  const lp = useLocalePath();
  const pageUrl = 'https://pr-top.com/ai-practice-management';

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
        path="/ai-practice-management"
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

        {/* Rule 1 — direct-answer block, 40-60 words, hedge-free. */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">
            {c.intro}
          </p>
        </div>

        {/* Rule 7 — wedge in first H2: name diary + exercises + crisis alerts + Telegram. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whatManagesTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">{c.whatManagesP1}</p>
          <ul className="list-disc pl-5 space-y-3 text-gray-700 leading-relaxed mb-4">
            {c.whatManagesList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-gray-700 leading-relaxed">{c.whatManagesP2}</p>
        </section>

        {/* Rule 7 — wedge in second H2. */}
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

        {/* Rule 3 — honest comparison table with 4 columns. */}
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

        {/* EU vs US EHR section. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.euVsUsTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.euVsUsP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.euVsUsP2}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.euVsUsP3}{' '}
            <Link
              to={lp('/security/gdpr')}
              className="text-primary underline hover:no-underline"
            >
              {c.euVsUsLinkGdpr}
            </Link>
            {c.euVsUsDot}
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

        {/* CTA block. */}
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
              to={lp('/security/gdpr')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkGdpr}
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
