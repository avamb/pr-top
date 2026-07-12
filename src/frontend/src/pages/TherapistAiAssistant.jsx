import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /therapist-ai-assistant  —  hub/comparison page (localized EN/RU/UK/ES).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest feature/price comparison table (Category, Pricing, Where it wins,
 *      Where it loses, Best for) — PR-TOP vs Upheal vs Mentalyc vs Supanote
 *   4. FAQ block + FAQPage JSON-LD (5-6 Q&As)
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + ≥2 sibling pages:
 *      /best-ai-assistant-for-therapists, /ai-session-notes-for-therapists,
 *      /compare/upheal, /compare/mentalyc, /therapy-documentation-ai
 *   7. PR-TOP wedge in first two H2 sections:
 *      diary + exercises + crisis alerts + Telegram all named
 *
 * Page angle: Hub page — "what is the best therapist AI assistant?"
 * Positions PR-TOP as the complete solution (notes + between-session channel),
 * not just an AI note-taker. Links to best-of listicle and feature pages.
 *
 * Competitor data verified against upheal.io, mentalyc.com, supanote.ai
 * in July 2026.
 */

const CONTENT = {
  en: {
    seoTitle: 'Therapist AI assistant — what it is and how PR-TOP delivers it (2026)',
    seoDescription:
      'A therapist AI assistant does more than write notes — PR-TOP adds a client diary, exercises and crisis alerts via Telegram. See 2026 comparison.',
    articleHeadline: 'Therapist AI assistant — what it is and how PR-TOP delivers it (2026)',
    articleDescription:
      '2026 hub guide to therapist AI assistants: what the category means, how Upheal, Mentalyc and Supanote compare, and why PR-TOP adds the between-session client channel those tools lack.',
    badge: 'Comparison guide',
    h1: 'Therapist AI assistant — what it is and how PR-TOP delivers it',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    intro:
      'A therapist AI assistant automates session documentation and keeps a between-session client channel open. PR-TOP does both: Whisper transcription and AI summaries for session notes, plus a Telegram diary, exercises, and one-tap crisis alerts between sessions — all in one AES-encrypted workspace. Most tools on this list only do the first part.',

    whatIsTitle: 'What is a therapist AI assistant?',
    whatIsP1:
      'The term "therapist AI assistant" now covers at least three different product types that marketers have collapsed into one label. Understanding the distinctions helps you pick the right tool.',
    whatIsP2:
      'The first type is the AI note-taker: Supanote, AutoNotes, Freed, Quill. These join (or listen to) a session call, transcribe it, and generate a clinical note. The workflow ends when the note is produced. The second type is the AI therapy platform: Upheal, Mentalyc. These add richer analytics — session sentiment, topic tracking, outcome measures — but the data model is still session-centric. The third type — which PR-TOP occupies — extends the assistant role into the between-session space: the client keeps a voice, text or video diary via Telegram, completes assigned exercises, and can trigger a one-tap SOS crisis alert. The therapist sees session notes and the full between-session record in a single encrypted dashboard.',
    whatIsP3:
      'Which type you need depends on your practice. If you only want to cut documentation time, an AI note-taker is sufficient. If you want richer analytics on session content, Upheal or Mentalyc may serve you better. If you want to close the gap between sessions — context that currently lives in scattered messages, phone calls and reconstructed memory — PR-TOP is the tool built for that problem.',

    howPrtopTitle: 'How PR-TOP works as a therapist AI assistant',
    howPrtopP1:
      'On the session side, PR-TOP accepts any audio or video upload (up to 100 MB). OpenAI Whisper transcribes the file; the raw transcript is encrypted as Class A data before storage. An AI summary is generated using your configured provider (OpenAI, Anthropic, Gemini, OpenRouter) against a template you control. The note, transcript and original file appear on the client\'s timeline in your encrypted dashboard.',
    howPrtopP2:
      'Between sessions, the same timeline fills with client-generated content delivered via Telegram: text diary entries, voice notes, short video messages. You assign exercises from a pre-seeded multilingual library or create custom ones; the bot delivers them and logs completion. If the client triggers the SOS button, you receive an immediate alert via Telegram and email. No separate app, no context switching — everything arrives in the same dashboard where the session notes live.',
    howPrtopP3:
      'What PR-TOP does not do: it does not offer the deep clinical analytics dashboards (session emotion tracking, outcome metrics, symptom trend charts) that Upheal and Mentalyc specialise in, and it does not ship named clinical formats (SOAP/DAP/BIRP/GIRP) as locked presets. If you need either of those, the comparison table below will help you decide.',
    howPrtopLead: 'See also: ',
    howPrtopLinkBest: 'best AI assistant for therapists (2026 roundup)',
    howPrtopAnd: ' and ',
    howPrtopLinkDocs: 'therapy documentation AI guide',
    howPrtopTail: '.',

    tableTitle: 'Comparison: PR-TOP vs therapist AI assistants (2026)',
    tableHead: {
      category: 'Category',
      pricing: 'Pricing',
      wins: 'Where it wins',
      loses: 'Where it loses',
      bestFor: 'Best for',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        pricing: 'Free Trial, then €9/mo Basic, €19/mo Pro',
        wins: 'Between-session channel (diary, exercises, SOS) via Telegram, EU/GDPR, 4 languages, single encrypted workspace',
        loses: 'No deep session analytics, simpler note templates, no US-EHR integrations',
        bestFor: 'EU/CIS/LATAM therapists who want session notes AND a between-session client channel',
      },
      {
        label: 'Upheal',
        pricing: 'From ~$49/mo',
        wins: 'Rich session analytics, sentiment tracking, outcome measures, video session integration',
        loses: 'No between-session client channel, no diary or exercises, US-focused compliance',
        bestFor: 'Therapists who want deep quantitative analytics on session content and outcomes',
      },
      {
        label: 'Mentalyc',
        pricing: 'From ~$29/mo',
        wins: 'Strong clinical note quality, good template variety, outcome tracking dashboard',
        loses: 'No client-facing channel, no crisis alerts, no between-session diary',
        bestFor: 'Therapists who want quality AI notes plus basic outcome measurement without complex setup',
      },
      {
        label: 'Supanote',
        pricing: 'From ~$19/mo',
        wins: 'Affordable entry point, clean SOAP/DAP output, easy session upload',
        loses: 'No between-session engagement, no client app, limited language support',
        bestFor: 'Solo therapists on a budget focused purely on cutting note-writing time',
      },
    ],
    tableNote:
      'Pricing verified against each vendor\'s public pricing page in July 2026. Numbers refresh quarterly. PR-TOP pricing is in EUR; competitor prices are in USD.',

    whenOtherTitle: 'When to choose a different therapist AI assistant',
    whenOtherItems: [
      'You need rich quantitative session analytics — sentiment trends, topic clustering, outcome measure dashboards — that go beyond a text summary. (Upheal, Mentalyc.)',
      'You need deeply mature clinical format presets (SOAP/DAP/BIRP/GIRP, treatment-plan generators, DSM/ICD prompts) locked by default. (Supanote, Quill.)',
      'You are a US therapist and need HIPAA-compliant integration with an existing EHR (Epic, SimplePractice, TherapyNotes).',
      'You bill through a US-centric platform and want notes to flow directly into billing — a use case PR-TOP does not cover.',
    ],

    whenPrtopTitle: 'When to choose PR-TOP as your therapist AI assistant',
    whenPrtopItems: [
      'You want session notes AND a real-time between-session record in one encrypted workspace — diary, exercises, SOS alerts — all without a second subscription.',
      'Your clients benefit from keeping a voice, text or video diary between appointments and you want to see it before the next session.',
      'You assign exercises and need to know whether clients completed them — not reconstruct it from memory on the day.',
      'A client in crisis must be able to reach you with one tap from Telegram, not hunt for a phone number.',
      'You are in the EU, Ukraine, Russia or Latin America and want GDPR-first, EU-hosted software with a Data Processing Addendum included by default.',
      'You need your interface and your clients\' Telegram bot in English, Russian, Ukrainian or Spanish.',
    ],

    aiProvidersTitle: 'What AI providers does PR-TOP use?',
    aiProvidersP1:
      'PR-TOP is multi-provider by design: you configure which AI backend handles transcription summaries and other AI tasks. Supported providers are OpenAI (GPT-4o and later models), Anthropic (Claude), Google Gemini, and OpenRouter (which gives access to dozens of third-party models via a single API). Whisper is used exclusively for transcription.',
    aiProvidersP2:
      'This means you are not locked into a single AI vendor\'s pricing or quality trajectory. If a new model outperforms your current choice for clinical summarisation, you switch providers in settings — no migration, no data export. All AI-generated content (summaries, note drafts) is treated as Class A data and encrypted before storage, regardless of which provider generated it.',
    aiProvidersLead: 'Compare specific tools: ',
    aiProvidersLinkUpheal: 'PR-TOP vs Upheal',
    aiProvidersAnd: ', ',
    aiProvidersLinkMentalyc: 'PR-TOP vs Mentalyc',
    aiProvidersTail: '.',

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'What is a "therapist AI assistant"?',
        a: 'The term covers tools that use AI to automate or augment the administrative and clinical support work a therapist does around sessions: transcribing recordings, generating session notes, tracking client progress, and increasingly, keeping a channel open between appointments. PR-TOP spans all of these: Whisper transcription, AI session summaries, and a Telegram-based between-session client channel for diary entries, exercises and crisis alerts.',
      },
      {
        q: 'How is PR-TOP different from Upheal or Mentalyc?',
        a: 'Upheal and Mentalyc are analytics-first platforms: they transcribe sessions and layer on quantitative metrics — sentiment scores, topic tracking, outcome measures. PR-TOP is channel-first: its differentiator is the between-session Telegram layer where clients keep a diary, complete exercises, and can fire SOS alerts. PR-TOP does not currently offer the depth of session-analytics dashboards that Upheal or Mentalyc do. If you need rich quantitative session insight, those tools are stronger. If you need the between-session record, PR-TOP is built for it.',
      },
      {
        q: 'Does PR-TOP replace my EHR?',
        a: 'No. PR-TOP is a complementary tool, not an EHR replacement. It handles session documentation (transcription, AI summary), the between-session client channel (Telegram diary, exercises, SOS), and an encrypted client context store. It does not cover scheduling, insurance billing, prescription management, or the deep compliance integrations (HL7 FHIR, US-EHR APIs) that a full EHR provides. Many therapists run PR-TOP alongside their EHR and copy the session summary across manually — the two tools barely overlap.',
      },
      {
        q: 'What AI providers does PR-TOP use?',
        a: 'PR-TOP is multi-provider: you configure the AI backend in settings. Supported options are OpenAI (GPT-4o and later), Anthropic (Claude), Google Gemini, and OpenRouter (access to dozens of models via one API). Transcription uses OpenAI Whisper specifically. All AI-generated content is encrypted as Class A data before storage, regardless of provider. You can switch providers without migrating data.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes. The free Trial tier includes the encrypted dashboard, the Telegram client bot, diary entries, exercises and one-tap SOS for a limited number of clients. No credit card required and no automatic conversion to a paid plan. You upgrade only when you decide to. Paid plans start at €9/month (Basic) and €19/month (Pro).',
      },
      {
        q: 'Which languages are supported?',
        a: 'The PR-TOP dashboard and the Telegram client bot are available in four languages: English, Russian, Ukrainian and Spanish. Whisper transcription supports over 50 languages, so sessions conducted in other languages (French, German, Portuguese, Arabic, etc.) can still be transcribed — only the app interface and bot menus are limited to the four supported languages. The AI summary quality depends on your configured provider; all major providers handle multilingual sessions well.',
      },
    ],

    ctaTitle: 'The therapist AI assistant that stays open between sessions',
    ctaText:
      'The free Trial takes about ten minutes to set up. No credit card. If PR-TOP does not fit your workflow, you can export all your data and leave — no lock-in.',
    ctaButton: 'Start free trial',
    ctaLinkBest: 'Best AI assistants for therapists',
    ctaLinkNotes: 'AI session notes guide',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'AI-ассистент для психолога — что это и как работает PR-TOP (2026)',
    seoDescription:
      'AI-ассистент для психолога: PR-TOP добавляет дневник клиента, упражнения и SOS-оповещения через Telegram к AI-заметкам сессий. Сравнение 2026.',
    articleHeadline: 'AI-ассистент для психолога — что это и как работает PR-TOP (2026)',
    articleDescription:
      'Обзор AI-ассистентов для психологов в 2026 году: что означает эта категория, как сравниваются Upheal, Mentalyc и Supanote, и почему PR-TOP добавляет канал для клиентов между сессиями.',
    badge: 'Руководство по сравнению',
    h1: 'AI-ассистент для психолога — что это и как работает PR-TOP',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',

    intro:
      'AI-ассистент для психолога автоматизирует документацию сессий и поддерживает канал с клиентом между встречами. PR-TOP делает и то, и другое: транскрипция Whisper и AI-резюме для заметок к сессиям, плюс дневник в Telegram, упражнения и SOS-оповещения между сессиями — всё в одном зашифрованном рабочем пространстве. Большинство инструментов в этом списке делают только первую часть.',

    whatIsTitle: 'Что такое AI-ассистент для психолога?',
    whatIsP1:
      'Термин «AI-ассистент для психолога» сейчас охватывает как минимум три разных типа продуктов, которые маркетологи свели к одному ярлыку. Понимание различий помогает выбрать правильный инструмент.',
    whatIsP2:
      'Первый тип — AI-инструмент для заметок: Supanote, AutoNotes, Freed, Quill. Они подключаются (или слушают) звонок, расшифровывают его и генерируют клиническую заметку. Рабочий процесс заканчивается, когда заметка готова. Второй тип — AI-платформа для терапии: Upheal, Mentalyc. Они добавляют более богатую аналитику — тональность сессии, отслеживание тем, показатели результатов — но модель данных по-прежнему ориентирована на сессию. Третий тип — который занимает PR-TOP — расширяет роль ассистента на пространство между сессиями: клиент ведёт голосовой, текстовый или видео-дневник через Telegram, выполняет назначенные упражнения и может запустить SOS-оповещение одним нажатием. Психолог видит заметки к сессиям и полные записи между сессиями в едином зашифрованном кабинете.',
    whatIsP3:
      'Какой тип вам нужен — зависит от вашей практики. Если вы хотите только сократить время на документацию, AI-инструмент для заметок достаточен. Если вы хотите более богатую аналитику по содержанию сессий, Upheal или Mentalyc могут подойти лучше. Если вы хотите закрыть пробел между сессиями — контекст, который сейчас живёт в разрозненных сообщениях, телефонных звонках и восстановленной памяти — PR-TOP создан именно для этой задачи.',

    howPrtopTitle: 'Как PR-TOP работает как AI-ассистент для психолога',
    howPrtopP1:
      'На стороне сессии PR-TOP принимает любую загрузку аудио или видео (до 100 МБ). OpenAI Whisper расшифровывает файл; необработанный транскрипт шифруется как данные класса A перед сохранением. AI-резюме генерируется с помощью настроенного вами провайдера (OpenAI, Anthropic, Gemini, OpenRouter) по шаблону, который вы контролируете. Заметка, транскрипт и исходный файл появляются на временной шкале клиента в вашем зашифрованном кабинете.',
    howPrtopP2:
      'Между сессиями та же временная шкала пополняется контентом клиента, доставленным через Telegram: текстовые записи дневника, голосовые заметки, короткие видеосообщения. Вы назначаете упражнения из готовой многоязычной библиотеки или создаёте собственные; бот доставляет их и отмечает выполнение. Если клиент нажимает кнопку SOS, вы получаете мгновенное оповещение через Telegram и email. Никакого отдельного приложения, никакого переключения контекста — всё приходит в тот же кабинет, где живут заметки к сессиям.',
    howPrtopP3:
      'Чего PR-TOP не делает: он не предлагает глубоких аналитических панелей по сессиям (отслеживание эмоций, метрики результатов, графики динамики симптомов), на которых специализируются Upheal и Mentalyc, и не поставляется с именованными клиническими форматами (SOAP/DAP/BIRP/GIRP) в виде жёстко заданных пресетов. Если вам нужно любое из этого, сравнительная таблица ниже поможет определиться.',
    howPrtopLead: 'Смотрите также: ',
    howPrtopLinkBest: 'лучшие AI-ассистенты для психологов (обзор 2026)',
    howPrtopAnd: ' и ',
    howPrtopLinkDocs: 'руководство по AI-документации для терапии',
    howPrtopTail: '.',

    tableTitle: 'Сравнение: PR-TOP и AI-ассистенты для психологов (2026)',
    tableHead: {
      category: 'Категория',
      pricing: 'Цена',
      wins: 'Где выигрывает',
      loses: 'Где проигрывает',
      bestFor: 'Кому подходит',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        pricing: 'Бесплатный Trial, далее €9/мес Basic, €19/мес Pro',
        wins: 'Канал между сессиями (дневник, упражнения, SOS) через Telegram, ЕС/GDPR, 4 языка, единое зашифрованное рабочее пространство',
        loses: 'Нет глубокой аналитики по сессиям, более простые шаблоны заметок, нет интеграций с американскими EHR',
        bestFor: 'Психологам из ЕС/СНГ/LATAM, которым нужны заметки к сессиям И канал для клиентов между сессиями',
      },
      {
        label: 'Upheal',
        pricing: 'От ~$49/мес',
        wins: 'Богатая аналитика по сессиям, отслеживание тональности, показатели результатов, интеграция с видеосессиями',
        loses: 'Нет канала для клиентов между сессиями, нет дневника или упражнений, комплаенс с прицелом на США',
        bestFor: 'Психологам, которым нужна глубокая количественная аналитика по содержанию сессий и результатам',
      },
      {
        label: 'Mentalyc',
        pricing: 'От ~$29/мес',
        wins: 'Высокое качество клинических заметок, хорошее разнообразие шаблонов, панель отслеживания результатов',
        loses: 'Нет клиентского канала, нет кризисных оповещений, нет дневника между сессиями',
        bestFor: 'Психологам, которым нужны качественные AI-заметки и базовое измерение результатов без сложной настройки',
      },
      {
        label: 'Supanote',
        pricing: 'От ~$19/мес',
        wins: 'Доступная цена входа, аккуратный вывод SOAP/DAP, простая загрузка сессий',
        loses: 'Нет вовлечения между сессиями, нет клиентского приложения, ограниченная поддержка языков',
        bestFor: 'Сольным практикам с ограниченным бюджетом, ориентированным исключительно на сокращение времени написания заметок',
      },
    ],
    tableNote:
      'Цены сверены с публичными страницами каждого вендора в июле 2026. Обновляются ежеквартально. Цены PR-TOP в EUR, цены конкурентов в USD.',

    whenOtherTitle: 'Когда выбрать другой AI-ассистент для психолога',
    whenOtherItems: [
      'Вам нужна богатая количественная аналитика по сессиям — тенденции тональности, кластеризация тем, панели показателей результатов — выходящая за рамки текстового резюме. (Upheal, Mentalyc.)',
      'Вам нужны глубоко зрелые пресеты клинических форматов (SOAP/DAP/BIRP/GIRP, генераторы планов лечения, подсказки DSM/ICD) по умолчанию. (Supanote, Quill.)',
      'Вы практикуете в США и вам нужна HIPAA-совместимая интеграция с существующей EHR (Epic, SimplePractice, TherapyNotes).',
      'Вы ведёте биллинг через американскую платформу и хотите, чтобы заметки автоматически попадали в счета — PR-TOP этого не поддерживает.',
    ],

    whenPrtopTitle: 'Когда выбрать PR-TOP в качестве AI-ассистента для психолога',
    whenPrtopItems: [
      'Вам нужны заметки к сессиям И записи между сессиями в реальном времени в одном зашифрованном рабочем пространстве — дневник, упражнения, SOS-оповещения — без второй подписки.',
      'Ваши клиенты получают пользу от ведения голосового, текстового или видео-дневника между приёмами, и вы хотите видеть его перед следующей сессией.',
      'Вы назначаете упражнения и должны знать, выполнил ли их клиент — не восстанавливать это из памяти в день приёма.',
      'Клиент в кризисе должен иметь возможность связаться с вами одним нажатием в Telegram без поиска номера телефона.',
      'Вы работаете в ЕС, Украине, России или Латинской Америке и предпочитаете GDPR-first, EU-hosted ПО с DPA по умолчанию.',
      'Вам нужен кабинет и Telegram-бот для клиентов на русском, украинском или испанском языке.',
    ],

    aiProvidersTitle: 'Какие AI-провайдеры использует PR-TOP?',
    aiProvidersP1:
      'PR-TOP изначально многопровайдерный: вы настраиваете AI-бэкенд в настройках. Поддерживаемые провайдеры: OpenAI (GPT-4o и более поздние модели), Anthropic (Claude), Google Gemini и OpenRouter (доступ к десяткам моделей через единый API). Для транскрипции используется исключительно Whisper.',
    aiProvidersP2:
      'Это означает, что вы не привязаны к ценообразованию или качеству одного AI-вендора. Если новая модель превзойдёт вашу текущую для клинического резюмирования, вы меняете провайдера в настройках — без миграции, без экспорта данных. Весь контент, сгенерированный AI (резюме, черновики заметок), обрабатывается как данные класса A и шифруется перед сохранением независимо от провайдера.',
    aiProvidersLead: 'Сравните конкретные инструменты: ',
    aiProvidersLinkUpheal: 'PR-TOP против Upheal',
    aiProvidersAnd: ', ',
    aiProvidersLinkMentalyc: 'PR-TOP против Mentalyc',
    aiProvidersTail: '.',

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'Что такое «AI-ассистент для психолога»?',
        a: 'Этот термин охватывает инструменты, которые используют AI для автоматизации или расширения административной и клинической поддержки психолога вокруг сессий: расшифровка записей, генерация заметок к сессиям, отслеживание прогресса клиентов и, всё чаще, поддержание канала между приёмами. PR-TOP охватывает всё это: транскрипция Whisper, AI-резюме сессий и канал для клиентов между сессиями через Telegram для записей дневника, упражнений и кризисных оповещений.',
      },
      {
        q: 'Чем PR-TOP отличается от Upheal или Mentalyc?',
        a: 'Upheal и Mentalyc — аналитически-ориентированные платформы: они расшифровывают сессии и накладывают количественные метрики — оценки тональности, отслеживание тем, показатели результатов. PR-TOP ориентирован на канал: его отличительная черта — слой Telegram между сессиями, где клиенты ведут дневник, выполняют упражнения и могут отправить SOS-оповещения. PR-TOP в настоящее время не предлагает глубины аналитических панелей по сессиям, которые есть у Upheal или Mentalyc. Если вам нужно богатое количественное понимание сессий, эти инструменты сильнее. Если вам нужна запись между сессиями, PR-TOP создан именно для этого.',
      },
      {
        q: 'Заменяет ли PR-TOP мою EHR?',
        a: 'Нет. PR-TOP — дополнительный инструмент, а не замена EHR. Он обрабатывает документацию сессий (транскрипция, AI-резюме), канал для клиентов между сессиями (дневник Telegram, упражнения, SOS) и зашифрованное хранилище контекста клиентов. Он не охватывает расписание, страховой биллинг, управление рецептами или глубокие интеграции комплаенса (HL7 FHIR, API американских EHR). Многие психологи используют PR-TOP вместе с EHR и вручную копируют резюме сессий — эти инструменты практически не пересекаются.',
      },
      {
        q: 'Какие AI-провайдеры использует PR-TOP?',
        a: 'PR-TOP многопровайдерный: вы настраиваете AI-бэкенд в настройках. Поддерживаются: OpenAI (GPT-4o и более поздние), Anthropic (Claude), Google Gemini и OpenRouter (доступ к десяткам моделей через один API). Для транскрипции используется OpenAI Whisper. Весь сгенерированный AI контент шифруется как данные класса A перед сохранением независимо от провайдера. Вы можете переключать провайдеров без миграции данных.',
      },
      {
        q: 'Есть ли бесплатный пробный период?',
        a: 'Да. Бесплатный тариф Trial включает зашифрованный кабинет, Telegram-бот для клиентов, записи дневника, упражнения и SOS одним нажатием для ограниченного числа клиентов. Карта не нужна, автоматического перехода на платный план нет. Вы переходите на него только по собственному решению. Платные тарифы начинаются от €9/мес (Basic) и €19/мес (Pro).',
      },
      {
        q: 'Какие языки поддерживаются?',
        a: 'Кабинет PR-TOP и Telegram-бот для клиентов доступны на четырёх языках: английском, русском, украинском и испанском. Транскрипция Whisper поддерживает более 50 языков, поэтому сессии на других языках (французском, немецком, португальском, арабском и т. д.) всё равно могут быть расшифрованы — только интерфейс приложения и меню бота ограничены четырьмя поддерживаемыми языками. Качество AI-резюме зависит от вашего провайдера; все ведущие провайдеры хорошо справляются с многоязычными сессиями.',
      },
    ],

    ctaTitle: 'AI-ассистент для психолога, который остаётся открытым между сессиями',
    ctaText:
      'Настройка бесплатного Trial занимает около десяти минут. Без банковской карты. Если PR-TOP не вписывается в ваш рабочий процесс, вы можете выгрузить все данные и уйти без привязки.',
    ctaButton: 'Начать бесплатно',
    ctaLinkBest: 'Лучшие AI-ассистенты для психологов',
    ctaLinkNotes: 'Руководство по AI-заметкам к сессии',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'AI-асистент для психолога — що це та як працює PR-TOP (2026)',
    seoDescription:
      'AI-асистент для психолога: PR-TOP додає щоденник клієнта, вправи та SOS-сповіщення через Telegram до AI-нотаток сесій. Порівняння 2026 року.',
    articleHeadline: 'AI-асистент для психолога — що це та як працює PR-TOP (2026)',
    articleDescription:
      'Огляд AI-асистентів для психологів у 2026 році: що означає ця категорія, як порівнюються Upheal, Mentalyc і Supanote, і чому PR-TOP додає канал для клієнтів між сесіями.',
    badge: 'Посібник із порівняння',
    h1: 'AI-асистент для психолога — що це та як працює PR-TOP',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',

    intro:
      'AI-асистент для психолога автоматизує документацію сесій і підтримує канал із клієнтом між зустрічами. PR-TOP робить і те, й інше: транскрипція Whisper та AI-резюме для нотаток до сесій, плюс щоденник у Telegram, вправи та SOS-сповіщення між сесіями — усе в одному зашифрованому робочому просторі. Більшість інструментів у цьому списку виконують лише першу частину.',

    whatIsTitle: 'Що таке AI-асистент для психолога?',
    whatIsP1:
      'Термін «AI-асистент для психолога» зараз охоплює щонайменше три різних типи продуктів, які маркетологи звели до одного ярлика. Розуміння відмінностей допомагає обрати правильний інструмент.',
    whatIsP2:
      'Перший тип — AI-інструмент для нотаток: Supanote, AutoNotes, Freed, Quill. Вони підключаються (або слухають) дзвінок, транскрибують його й генерують клінічну нотатку. Робочий процес завершується, коли нотатка готова. Другий тип — AI-платформа для терапії: Upheal, Mentalyc. Вони додають більш багату аналітику — тональність сесії, відстеження тем, показники результатів — але модель даних все одно орієнтована на сесію. Третій тип — який займає PR-TOP — розширює роль асистента на простір між сесіями: клієнт веде голосовий, текстовий або відео-щоденник через Telegram, виконує призначені вправи та може запустити SOS-сповіщення одним дотиком. Психолог бачить нотатки до сесій і повні записи між сесіями в єдиному зашифрованому кабінеті.',
    whatIsP3:
      'Який тип вам потрібен — залежить від вашої практики. Якщо ви хочете лише скоротити час на документацію, AI-інструмент для нотаток достатній. Якщо ви хочете більш багату аналітику за змістом сесій, Upheal або Mentalyc можуть підійти краще. Якщо ви хочете закрити прогалину між сесіями — контекст, що зараз живе в розрізнених повідомленнях, телефонних дзвінках і відновленій пам\'яті — PR-TOP створено саме для цієї задачі.',

    howPrtopTitle: 'Як PR-TOP працює як AI-асистент для психолога',
    howPrtopP1:
      'На боці сесії PR-TOP приймає будь-яке завантаження аудіо або відео (до 100 МБ). OpenAI Whisper транскрибує файл; необроблений транскрипт шифрується як дані класу A перед збереженням. AI-резюме генерується за допомогою налаштованого вами провайдера (OpenAI, Anthropic, Gemini, OpenRouter) за шаблоном, який ви контролюєте. Нотатка, транскрипт і вихідний файл з\'являються на часовій шкалі клієнта у вашому зашифрованому кабінеті.',
    howPrtopP2:
      'Між сесіями та сама часова шкала поповнюється контентом клієнта, доставленим через Telegram: текстові записи щоденника, голосові нотатки, короткі відеоповідомлення. Ви призначаєте вправи з готової багатомовної бібліотеки або створюєте власні; бот доставляє їх і відмічає виконання. Якщо клієнт натискає кнопку SOS, ви отримуєте миттєве сповіщення через Telegram та email. Ніякого окремого застосунку, ніякого переключення контексту — усе надходить до того самого кабінету, де живуть нотатки до сесій.',
    howPrtopP3:
      'Чого PR-TOP не робить: він не пропонує глибоких аналітичних панелей по сесіях (відстеження емоцій, метрики результатів, графіки динаміки симптомів), на яких спеціалізуються Upheal і Mentalyc, і не постачається з іменованими клінічними форматами (SOAP/DAP/BIRP/GIRP) у вигляді жорстко заданих пресетів. Якщо вам потрібне будь-яке з цього, порівняльна таблиця нижче допоможе визначитися.',
    howPrtopLead: 'Дивіться також: ',
    howPrtopLinkBest: 'найкращі AI-асистенти для психологів (огляд 2026)',
    howPrtopAnd: ' та ',
    howPrtopLinkDocs: 'посібник з AI-документації для терапії',
    howPrtopTail: '.',

    tableTitle: 'Порівняння: PR-TOP та AI-асистенти для психологів (2026)',
    tableHead: {
      category: 'Категорія',
      pricing: 'Ціна',
      wins: 'Де виграє',
      loses: 'Де програє',
      bestFor: 'Кому підходить',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        pricing: 'Безкоштовний Trial, далі €9/міс Basic, €19/міс Pro',
        wins: 'Канал між сесіями (щоденник, вправи, SOS) через Telegram, ЄС/GDPR, 4 мови, єдиний зашифрований робочий простір',
        loses: 'Немає глибокої аналітики по сесіях, простіші шаблони нотаток, немає інтеграцій з американськими EHR',
        bestFor: 'Психологам з ЄС/СНД/LATAM, яким потрібні нотатки до сесій І канал для клієнтів між сесіями',
      },
      {
        label: 'Upheal',
        pricing: 'Від ~$49/міс',
        wins: 'Багата аналітика по сесіях, відстеження тональності, показники результатів, інтеграція відеосесій',
        loses: 'Немає каналу для клієнтів між сесіями, немає щоденника чи вправ, комплаєнс з прицілом на США',
        bestFor: 'Психологам, яким потрібна глибока кількісна аналітика за змістом сесій і результатами',
      },
      {
        label: 'Mentalyc',
        pricing: 'Від ~$29/міс',
        wins: 'Висока якість клінічних нотаток, хороше різноманіття шаблонів, панель відстеження результатів',
        loses: 'Немає клієнтського каналу, немає кризових сповіщень, немає щоденника між сесіями',
        bestFor: 'Психологам, яким потрібні якісні AI-нотатки та базове вимірювання результатів без складного налаштування',
      },
      {
        label: 'Supanote',
        pricing: 'Від ~$19/міс',
        wins: 'Доступна ціна входу, охайний вивід SOAP/DAP, просте завантаження сесій',
        loses: 'Немає залучення між сесіями, немає клієнтського застосунку, обмежена підтримка мов',
        bestFor: 'Сольним практикам з обмеженим бюджетом, орієнтованим виключно на скорочення часу написання нотаток',
      },
    ],
    tableNote:
      'Ціни звірено з публічними сторінками кожного вендора у липні 2026. Оновлюються щокварталу. Ціни PR-TOP в EUR, ціни конкурентів в USD.',

    whenOtherTitle: 'Коли обрати інший AI-асистент для психолога',
    whenOtherItems: [
      'Вам потрібна багата кількісна аналітика по сесіях — тенденції тональності, кластеризація тем, панелі показників результатів — що виходить за рамки текстового резюме. (Upheal, Mentalyc.)',
      'Вам потрібні глибоко зрілі пресети клінічних форматів (SOAP/DAP/BIRP/GIRP, генератори планів лікування, підказки DSM/ICD) за замовчуванням. (Supanote, Quill.)',
      'Ви практикуєте у США й вам потрібна HIPAA-сумісна інтеграція з наявною EHR (Epic, SimplePractice, TherapyNotes).',
      'Ви ведете білінг через американську платформу й хочете, щоб нотатки автоматично потрапляли до рахунків — PR-TOP цього не підтримує.',
    ],

    whenPrtopTitle: 'Коли обрати PR-TOP як AI-асистент для психолога',
    whenPrtopItems: [
      'Вам потрібні нотатки до сесій І записи між сесіями в реальному часі в одному зашифрованому робочому просторі — щоденник, вправи, SOS-сповіщення — без другої підписки.',
      'Ваші клієнти отримують користь від ведення голосового, текстового або відео-щоденника між прийомами, і ви хочете бачити його перед наступною сесією.',
      'Ви призначаєте вправи й повинні знати, чи клієнт справді їх виконав — а не відновлювати це з пам\'яті в день прийому.',
      'Клієнт у кризі повинен мати можливість зв\'язатися з вами одним дотиком у Telegram без пошуку номера телефону.',
      'Ви працюєте в ЄС, Україні, Росії або Латинській Америці й надаєте перевагу GDPR-first, EU-hosted ПЗ з DPA за замовчуванням.',
      'Вам потрібен кабінет і Telegram-бот для клієнтів українською, російською чи іспанською мовою.',
    ],

    aiProvidersTitle: 'Які AI-провайдери використовує PR-TOP?',
    aiProvidersP1:
      'PR-TOP споконвічно багатопровайдерний: ви налаштовуєте AI-бекенд у налаштуваннях. Підтримувані провайдери: OpenAI (GPT-4o та новіші моделі), Anthropic (Claude), Google Gemini і OpenRouter (доступ до десятків моделей через єдиний API). Для транскрипції використовується виключно Whisper.',
    aiProvidersP2:
      'Це означає, що ви не прив\'язані до ціноутворення або якості одного AI-вендора. Якщо нова модель перевершить вашу поточну для клінічного резюмування, ви змінюєте провайдера в налаштуваннях — без міграції, без експорту даних. Увесь контент, згенерований AI (резюме, чернетки нотаток), обробляється як дані класу A і шифрується перед збереженням незалежно від провайдера.',
    aiProvidersLead: 'Порівняйте конкретні інструменти: ',
    aiProvidersLinkUpheal: 'PR-TOP проти Upheal',
    aiProvidersAnd: ', ',
    aiProvidersLinkMentalyc: 'PR-TOP проти Mentalyc',
    aiProvidersTail: '.',

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'Що таке «AI-асистент для психолога»?',
        a: 'Цей термін охоплює інструменти, які використовують AI для автоматизації або розширення адміністративної та клінічної підтримки психолога навколо сесій: транскрипція записів, генерація нотаток до сесій, відстеження прогресу клієнтів і, дедалі частіше, підтримання каналу між прийомами. PR-TOP охоплює все це: транскрипція Whisper, AI-резюме сесій і канал для клієнтів між сесіями через Telegram для записів щоденника, вправ та кризових сповіщень.',
      },
      {
        q: 'Чим PR-TOP відрізняється від Upheal або Mentalyc?',
        a: 'Upheal і Mentalyc — аналітично орієнтовані платформи: вони транскрибують сесії та накладають кількісні метрики — оцінки тональності, відстеження тем, показники результатів. PR-TOP орієнтований на канал: його відмінність — шар Telegram між сесіями, де клієнти ведуть щоденник, виконують вправи та можуть надіслати SOS-сповіщення. PR-TOP наразі не пропонує глибини аналітичних панелей по сесіях, які є у Upheal або Mentalyc. Якщо вам потрібне багате кількісне розуміння сесій, ці інструменти сильніші. Якщо вам потрібен запис між сесіями, PR-TOP створено для цього.',
      },
      {
        q: 'Чи замінює PR-TOP мою EHR?',
        a: 'Ні. PR-TOP — додатковий інструмент, а не заміна EHR. Він обробляє документацію сесій (транскрипція, AI-резюме), канал для клієнтів між сесіями (щоденник Telegram, вправи, SOS) і зашифроване сховище контексту клієнтів. Він не охоплює розклад, страховий білінг, управління рецептами або глибокі інтеграції комплаєнсу (HL7 FHIR, API американських EHR). Багато психологів використовують PR-TOP поряд з EHR і вручну копіюють резюме сесій — ці інструменти майже не перетинаються.',
      },
      {
        q: 'Які AI-провайдери використовує PR-TOP?',
        a: 'PR-TOP багатопровайдерний: ви налаштовуєте AI-бекенд у налаштуваннях. Підтримуються: OpenAI (GPT-4o та новіші), Anthropic (Claude), Google Gemini і OpenRouter (доступ до десятків моделей через один API). Для транскрипції використовується OpenAI Whisper. Увесь згенерований AI контент шифрується як дані класу A перед збереженням незалежно від провайдера. Ви можете перемикати провайдерів без міграції даних.',
      },
      {
        q: 'Чи є безкоштовний пробний період?',
        a: 'Так. Безкоштовний тариф Trial включає зашифрований кабінет, Telegram-бот для клієнтів, записи щоденника, вправи та SOS одним дотиком для обмеженої кількості клієнтів. Картка не потрібна, автоматичного переходу на платний план немає. Ви переходите на нього лише за власним рішенням. Платні тарифи починаються від €9/міс (Basic) та €19/міс (Pro).',
      },
      {
        q: 'Які мови підтримуються?',
        a: 'Кабінет PR-TOP і Telegram-бот для клієнтів доступні чотирма мовами: англійською, російською, українською та іспанською. Транскрипція Whisper підтримує понад 50 мов, тому сесії на інших мовах (французькій, німецькій, португальській, арабській тощо) все одно можуть бути транскрибовані — лише інтерфейс застосунку та меню бота обмежені чотирма підтримуваними мовами. Якість AI-резюме залежить від вашого провайдера; всі провідні провайдери добре справляються з багатомовними сесіями.',
      },
    ],

    ctaTitle: 'AI-асистент для психолога, який залишається відкритим між сесіями',
    ctaText:
      'Налаштування безкоштовного Trial займає близько десяти хвилин. Без банківської картки. Якщо PR-TOP не вписується у ваш робочий процес, ви можете вивантажити всі дані й піти без прив\'язки.',
    ctaButton: 'Почати безкоштовно',
    ctaLinkBest: 'Найкращі AI-асистенти для психологів',
    ctaLinkNotes: 'Посібник з AI-нотаток до сесії',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Asistente de IA para terapeutas — qué es y cómo lo ofrece PR-TOP (2026)',
    seoDescription:
      'Un asistente de IA para terapeutas va más allá de las notas — PR-TOP añade diario del cliente, ejercicios y alertas SOS vía Telegram. Comparativa 2026.',
    articleHeadline: 'Asistente de IA para terapeutas — qué es y cómo lo ofrece PR-TOP (2026)',
    articleDescription:
      'Guía hub 2026 sobre asistentes de IA para terapeutas: qué significa la categoría, cómo se comparan Upheal, Mentalyc y Supanote, y por qué PR-TOP añade el canal de clientes entre sesiones que esas herramientas no tienen.',
    badge: 'Guía de comparación',
    h1: 'Asistente de IA para terapeutas — qué es y cómo lo ofrece PR-TOP',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',

    intro:
      'Un asistente de IA para terapeutas automatiza la documentación de sesiones y mantiene un canal con el cliente entre consultas. PR-TOP hace ambas cosas: transcripción Whisper y resúmenes con IA para notas de sesión, más un diario de Telegram, ejercicios y alertas SOS entre sesiones — todo en un espacio cifrado. La mayoría de herramientas de esta lista solo hacen la primera parte.',

    whatIsTitle: '¿Qué es un asistente de IA para terapeutas?',
    whatIsP1:
      'El término "asistente de IA para terapeutas" abarca ahora al menos tres tipos de productos distintos que los especialistas de marketing han agrupado bajo una misma etiqueta. Entender las diferencias ayuda a elegir la herramienta correcta.',
    whatIsP2:
      'El primer tipo es el tomador de notas con IA: Supanote, AutoNotes, Freed, Quill. Estos se unen (o escuchan) a la llamada de sesión, la transcriben y generan una nota clínica. El flujo de trabajo termina cuando la nota está lista. El segundo tipo es la plataforma de terapia con IA: Upheal, Mentalyc. Estas añaden analíticas más ricas — sentimiento de la sesión, seguimiento de temas, métricas de resultados — pero el modelo de datos sigue centrado en la sesión. El tercer tipo — que ocupa PR-TOP — extiende el rol de asistente al espacio entre sesiones: el cliente lleva un diario de voz, texto o vídeo vía Telegram, completa ejercicios asignados y puede activar una alerta SOS con un toque. El terapeuta ve las notas de sesión y el registro completo entre sesiones en un único panel cifrado.',
    whatIsP3:
      'El tipo que necesita depende de su práctica. Si solo quiere reducir el tiempo de documentación, un tomador de notas con IA es suficiente. Si quiere analíticas más ricas sobre el contenido de las sesiones, Upheal o Mentalyc pueden servirle mejor. Si quiere cerrar la brecha entre sesiones — contexto que actualmente vive en mensajes dispersos, llamadas telefónicas y memoria reconstruida — PR-TOP es la herramienta construida para ese problema.',

    howPrtopTitle: 'Cómo funciona PR-TOP como asistente de IA para terapeutas',
    howPrtopP1:
      'En el lado de la sesión, PR-TOP acepta cualquier archivo de audio o vídeo (hasta 100 MB). OpenAI Whisper transcribe el archivo; la transcripción sin procesar se cifra como datos de clase A antes del almacenamiento. Un resumen de IA se genera usando el proveedor configurado (OpenAI, Anthropic, Gemini, OpenRouter) según una plantilla que usted controla. La nota, la transcripción y el archivo original aparecen en la línea de tiempo del cliente en su panel cifrado.',
    howPrtopP2:
      'Entre sesiones, esa misma línea de tiempo se llena con contenido generado por el cliente entregado vía Telegram: entradas de diario en texto, notas de voz, vídeos cortos. Usted asigna ejercicios de una biblioteca multilingüe precargada o crea los suyos; el bot los entrega y registra la finalización. Si el cliente activa el botón SOS, usted recibe una alerta inmediata vía Telegram y email. Sin aplicación separada, sin cambio de contexto — todo llega al mismo panel donde viven las notas de sesión.',
    howPrtopP3:
      'Lo que PR-TOP no hace: no ofrece los paneles de analíticas de sesión profundas (seguimiento de emociones, métricas de resultados, gráficos de tendencias de síntomas) en los que se especializan Upheal y Mentalyc, y no incluye formatos clínicos con nombre (SOAP/DAP/BIRP/GIRP) como preajustes fijos. Si necesita cualquiera de esas cosas, la tabla comparativa a continuación le ayudará a decidir.',
    howPrtopLead: 'Consulte también: ',
    howPrtopLinkBest: 'mejores asistentes de IA para terapeutas (resumen 2026)',
    howPrtopAnd: ' y ',
    howPrtopLinkDocs: 'guía de documentación de terapia con IA',
    howPrtopTail: '.',

    tableTitle: 'Comparativa: PR-TOP vs asistentes de IA para terapeutas (2026)',
    tableHead: {
      category: 'Categoría',
      pricing: 'Precio',
      wins: 'Dónde gana',
      loses: 'Dónde pierde',
      bestFor: 'Ideal para',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        pricing: 'Trial gratuito, luego €9/mes Basic, €19/mes Pro',
        wins: 'Canal entre sesiones (diario, ejercicios, SOS) vía Telegram, UE/GDPR, 4 idiomas, espacio de trabajo cifrado único',
        loses: 'Sin analíticas profundas de sesión, plantillas de notas más sencillas, sin integraciones con EHR de EE. UU.',
        bestFor: 'Terapeutas de UE/CEI/LATAM que quieren notas de sesión Y un canal de clientes entre sesiones',
      },
      {
        label: 'Upheal',
        pricing: 'Desde ~$49/mes',
        wins: 'Analíticas de sesión ricas, seguimiento de sentimiento, métricas de resultados, integración de videosesiones',
        loses: 'Sin canal de clientes entre sesiones, sin diario ni ejercicios, cumplimiento centrado en EE. UU.',
        bestFor: 'Terapeutas que quieren analíticas cuantitativas profundas sobre el contenido y resultados de sesiones',
      },
      {
        label: 'Mentalyc',
        pricing: 'Desde ~$29/mes',
        wins: 'Alta calidad de notas clínicas, buena variedad de plantillas, panel de seguimiento de resultados',
        loses: 'Sin canal para clientes, sin alertas de crisis, sin diario entre sesiones',
        bestFor: 'Terapeutas que quieren notas con IA de calidad más medición básica de resultados sin configuración compleja',
      },
      {
        label: 'Supanote',
        pricing: 'Desde ~$19/mes',
        wins: 'Precio de entrada asequible, salida SOAP/DAP limpia, carga de sesiones sencilla',
        loses: 'Sin compromiso entre sesiones, sin app para clientes, soporte de idiomas limitado',
        bestFor: 'Terapeutas en solitario con presupuesto limitado centrados exclusivamente en reducir el tiempo de escritura de notas',
      },
    ],
    tableNote:
      'Precios verificados en las páginas públicas de cada proveedor en julio de 2026. Las cifras se actualizan cada trimestre. Los precios de PR-TOP están en EUR; los de los competidores, en USD.',

    whenOtherTitle: 'Cuándo elegir otro asistente de IA para terapeutas',
    whenOtherItems: [
      'Necesita analíticas de sesión cuantitativas ricas — tendencias de sentimiento, clustering de temas, paneles de métricas de resultados — que van más allá de un resumen de texto. (Upheal, Mentalyc.)',
      'Necesita preajustes de formato clínico profundamente maduros (SOAP/DAP/BIRP/GIRP, generadores de planes de tratamiento, guías DSM/ICD) activos por defecto. (Supanote, Quill.)',
      'Es terapeuta en EE. UU. y necesita integración compatible con HIPAA con un EHR existente (Epic, SimplePractice, TherapyNotes).',
      'Factura a través de una plataforma centrada en EE. UU. y quiere que las notas fluyan directamente a la facturación — un caso de uso que PR-TOP no cubre.',
    ],

    whenPrtopTitle: 'Cuándo elegir PR-TOP como asistente de IA para terapeutas',
    whenPrtopItems: [
      'Quiere notas de sesión Y un registro entre sesiones en tiempo real en un único espacio de trabajo cifrado — diario, ejercicios, alertas SOS — sin una segunda suscripción.',
      'Sus clientes se benefician de llevar un diario de voz, texto o vídeo entre citas, y usted quiere verlo antes de la próxima sesión.',
      'Asigna ejercicios y necesita saber si los clientes los completaron realmente — no reconstruirlo de memoria el día de la cita.',
      'Un cliente en crisis debe poder contactarle con un toque desde Telegram, sin buscar un número de teléfono.',
      'Está en la UE, Ucrania, Rusia o Latinoamérica y prefiere software GDPR-first alojado en la UE con DPA incluido por defecto.',
      'Necesita el panel y el bot de Telegram para clientes en ruso, ucraniano o español.',
    ],

    aiProvidersTitle: '¿Qué proveedores de IA usa PR-TOP?',
    aiProvidersP1:
      'PR-TOP es multiproveedor por diseño: usted configura el backend de IA en los ajustes. Los proveedores admitidos son OpenAI (GPT-4o y modelos posteriores), Anthropic (Claude), Google Gemini y OpenRouter (acceso a decenas de modelos a través de una sola API). Whisper se usa exclusivamente para la transcripción.',
    aiProvidersP2:
      'Esto significa que no está atado a los precios ni a la trayectoria de calidad de un único proveedor de IA. Si un nuevo modelo supera a su elección actual para la síntesis clínica, cambia de proveedor en los ajustes — sin migración, sin exportación de datos. Todo el contenido generado por IA (resúmenes, borradores de notas) se trata como datos de clase A y se cifra antes del almacenamiento, independientemente del proveedor que lo generó.',
    aiProvidersLead: 'Compare herramientas específicas: ',
    aiProvidersLinkUpheal: 'PR-TOP vs Upheal',
    aiProvidersAnd: ', ',
    aiProvidersLinkMentalyc: 'PR-TOP vs Mentalyc',
    aiProvidersTail: '.',

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿Qué es un "asistente de IA para terapeutas"?',
        a: 'El término abarca herramientas que usan IA para automatizar o aumentar el trabajo de apoyo administrativo y clínico que un terapeuta hace alrededor de las sesiones: transcribir grabaciones, generar notas de sesión, hacer seguimiento del progreso del cliente y, cada vez más, mantener un canal abierto entre citas. PR-TOP abarca todo esto: transcripción Whisper, resúmenes de sesión con IA y un canal de clientes entre sesiones vía Telegram para entradas de diario, ejercicios y alertas de crisis.',
      },
      {
        q: '¿En qué se diferencia PR-TOP de Upheal o Mentalyc?',
        a: 'Upheal y Mentalyc son plataformas orientadas a la analítica: transcriben sesiones y añaden métricas cuantitativas — puntuaciones de sentimiento, seguimiento de temas, métricas de resultados. PR-TOP está orientado al canal: su diferenciador es la capa de Telegram entre sesiones donde los clientes llevan un diario, completan ejercicios y pueden activar alertas SOS. PR-TOP actualmente no ofrece la profundidad de paneles de analíticas de sesión que tienen Upheal o Mentalyc. Si necesita información cuantitativa rica sobre las sesiones, esas herramientas son más potentes. Si necesita el registro entre sesiones, PR-TOP está construido para eso.',
      },
      {
        q: '¿PR-TOP reemplaza mi EHR?',
        a: 'No. PR-TOP es una herramienta complementaria, no un reemplazo de EHR. Gestiona la documentación de sesiones (transcripción, resumen con IA), el canal de clientes entre sesiones (diario de Telegram, ejercicios, SOS) y un almacén cifrado de contexto del cliente. No cubre agenda, facturación de seguros, gestión de recetas o las integraciones de cumplimiento profundas (HL7 FHIR, APIs de EHR de EE. UU.) que proporciona un EHR completo. Muchos terapeutas usan PR-TOP junto a su EHR y copian manualmente el resumen de sesión — los dos herramientas apenas se solapan.',
      },
      {
        q: '¿Qué proveedores de IA usa PR-TOP?',
        a: 'PR-TOP es multiproveedor: usted configura el backend de IA en los ajustes. Las opciones admitidas son OpenAI (GPT-4o y posteriores), Anthropic (Claude), Google Gemini y OpenRouter (acceso a decenas de modelos a través de una API). La transcripción usa OpenAI Whisper específicamente. Todo el contenido generado por IA se cifra como datos de clase A antes del almacenamiento, independientemente del proveedor. Puede cambiar de proveedor sin migrar datos.',
      },
      {
        q: '¿Hay prueba gratuita?',
        a: 'Sí. El nivel Trial gratuito incluye el panel cifrado, el bot de Telegram para clientes, entradas de diario, ejercicios y SOS con un toque para un número limitado de clientes. No se requiere tarjeta de crédito y no hay conversión automática a un plan de pago. Solo cambia de plan cuando usted lo decide. Los planes de pago comienzan en €9/mes (Basic) y €19/mes (Pro).',
      },
      {
        q: '¿Qué idiomas son compatibles?',
        a: 'El panel de PR-TOP y el bot de Telegram para clientes están disponibles en cuatro idiomas: inglés, ruso, ucraniano y español. La transcripción de Whisper admite más de 50 idiomas, por lo que las sesiones en otros idiomas (francés, alemán, portugués, árabe, etc.) aún pueden transcribirse — solo la interfaz de la aplicación y los menús del bot están limitados a los cuatro idiomas compatibles. La calidad del resumen de IA depende de su proveedor configurado; todos los principales proveedores manejan bien las sesiones multilingües.',
      },
    ],

    ctaTitle: 'El asistente de IA para terapeutas que permanece abierto entre sesiones',
    ctaText:
      'La versión Trial gratuita se configura en unos diez minutos. Sin tarjeta de crédito. Si PR-TOP no encaja en su flujo de trabajo, puede exportar todos sus datos e irse sin ataduras.',
    ctaButton: 'Empezar gratis',
    ctaLinkBest: 'Mejores asistentes de IA para terapeutas',
    ctaLinkNotes: 'Guía de notas de sesión con IA',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function TherapistAiAssistant() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const c = CONTENT[locale] || CONTENT.en;
  const lp = useLocalePath();
  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : `/${locale}`}/therapist-ai-assistant`;

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
        path="/therapist-ai-assistant"
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
        {/* Header */}
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
          <p className="text-gray-800 leading-relaxed">{c.intro}</p>
        </div>

        {/* Rule 7 — PR-TOP wedge in first H2: category definition with diary + exercises + crisis alerts + Telegram named. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whatIsTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whatIsP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whatIsP2}</p>
          <p className="text-gray-700 leading-relaxed">{c.whatIsP3}</p>
        </section>

        {/* Rule 7 — PR-TOP wedge in second H2: how PR-TOP delivers (diary + exercises + SOS + Telegram named). */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.howPrtopTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.howPrtopP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.howPrtopP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.howPrtopP3}</p>
          {/* Rule 6 — internal links to sibling pages. */}
          <p className="text-gray-700 leading-relaxed">
            {c.howPrtopLead}
            <Link to={lp('/best-ai-assistant-for-therapists')} className="text-primary underline hover:no-underline">
              {c.howPrtopLinkBest}
            </Link>
            {c.howPrtopAnd}
            <Link to={lp('/therapy-documentation-ai')} className="text-primary underline hover:no-underline">
              {c.howPrtopLinkDocs}
            </Link>
            {c.howPrtopTail}
          </p>
        </section>

        {/* Rule 3 — honest comparison table. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.tableTitle}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.category}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.pricing}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.wins}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.loses}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.bestFor}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.tableRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="p-3 border border-gray-200 font-medium whitespace-nowrap">{row.label}</td>
                    <td className="p-3 border border-gray-200">{row.pricing}</td>
                    <td className="p-3 border border-gray-200">{row.wins}</td>
                    <td className="p-3 border border-gray-200">{row.loses}</td>
                    <td className="p-3 border border-gray-200">{row.bestFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">{c.tableNote}</p>
        </section>

        {/* When to choose a different tool */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whenOtherTitle}
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            {c.whenOtherItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* When to choose PR-TOP */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whenPrtopTitle}
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            {c.whenPrtopItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* AI providers section — internal links to /compare/upheal and /compare/mentalyc */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.aiProvidersTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.aiProvidersP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.aiProvidersP2}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.aiProvidersLead}
            <Link to={lp('/compare/upheal')} className="text-primary underline hover:no-underline">
              {c.aiProvidersLinkUpheal}
            </Link>
            {c.aiProvidersAnd}
            <Link to={lp('/compare/mentalyc')} className="text-primary underline hover:no-underline">
              {c.aiProvidersLinkMentalyc}
            </Link>
            {c.aiProvidersTail}
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

        {/* CTA section */}
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
              to={lp('/best-ai-assistant-for-therapists')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkBest}
            </Link>
            <Link
              to={lp('/ai-session-notes-for-therapists')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkNotes}
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
