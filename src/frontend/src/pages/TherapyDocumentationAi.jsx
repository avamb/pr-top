import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /therapy-documentation-ai  —  feature guide + wedge page (localized EN/RU/UK/ES).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest feature/price comparison table (Category, Pricing, Where it wins,
 *      Where it loses, Best for) — PR-TOP vs Heidi vs Freed vs Eleos
 *   4. FAQ block + FAQPage JSON-LD (5-6 Q&As)
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + ≥2 sibling pages:
 *      /ai-session-notes-for-therapists, /client-diary-for-therapists,
 *      /ai-practice-management
 *   7. PR-TOP wedge in first two H2 sections:
 *      diary + exercises + crisis alerts + Telegram all named
 *
 * Page angle: Heidi, Freed, Eleos end at the session note. PR-TOP extends
 * documentation into the space between sessions with a Telegram client diary,
 * exercises, and crisis alerts — all in one encrypted workspace.
 *
 * Competitor data verified against heidishealth.com, freed.ai, eleos.health
 * in July 2026.
 */

const CONTENT = {
  en: {
    seoTitle: 'Therapy documentation AI — guide for therapists (2026)',
    seoDescription:
      'Reduce therapy documentation time with AI session notes, Whisper transcription and an encrypted client diary between sessions. Try PR-TOP free.',
    articleHeadline: 'Therapy documentation AI — guide for therapists (2026)',
    articleDescription:
      'How therapy documentation AI tools compare in 2026: Heidi, Freed and Eleos stop at the session note. PR-TOP adds Whisper transcription and a between-session encrypted client diary.',
    badge: 'Feature guide',
    h1: 'Therapy documentation AI — guide for therapists',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    intro:
      'Therapy documentation AI tools transcribe your sessions and generate structured notes so you spend minutes, not an hour, on paperwork. PR-TOP does that with Whisper transcription and configurable AI summaries — and uniquely stays open between sessions as a Telegram diary, exercise channel, and one-tap crisis alert for your clients, all encrypted.',

    whyNotEnoughTitle: 'Why session-note tools leave a documentation gap',
    whyNotEnoughP1:
      'Heidi, Freed and Eleos represent the current state-of-the-art in AI clinical documentation: you join a call, the AI listens, and a SOAP or DAP note appears minutes later. The time saving is real and the formats are mature. These are genuinely good tools for what they do.',
    whyNotEnoughP2a:
      'The problem is that clinical documentation does not end at the session note. The space ',
    whyNotEnoughP2em: 'between',
    whyNotEnoughP2b:
      ' sessions generates its own documentation burden: what did the client report in their diary this week, did they complete the exercise you assigned, did a crisis event occur on Tuesday that you only hear about on Friday? Reconstructing that context before the next session — from scattered messages, email threads, or memory — is itself a form of double documentation, and none of the dedicated note-takers address it.',
    whyNotEnoughP3:
      'PR-TOP closes that gap. It handles session-side documentation (Whisper transcription, AI summary, streaming session playback, encrypted storage) and then keeps a real-time client channel open via Telegram: clients keep a voice, text or video diary, complete assigned exercises, and can fire a one-tap SOS that lands straight in your inbox. All content is AES-encrypted at the application layer. When you sit down before the next session, the full picture — notes plus between-session record — is in one dashboard.',

    howPrtopTitle: 'How PR-TOP handles therapy documentation from session to client record',
    howPrtopP1:
      'On the session side, you upload an audio or video file (up to 100 MB) from any source — Zoom, a local recorder, a phone voice memo. OpenAI Whisper transcribes it; the raw transcript is encrypted immediately as Class A data, meaning the database never holds client content in plaintext. Your chosen AI provider (OpenAI, Anthropic, Gemini, OpenRouter) then generates a summary against a configurable template. The note and the transcript land on the client timeline in your encrypted dashboard.',
    howPrtopP2:
      'Between sessions, the same client timeline fills with diary entries — text, voice notes or short videos sent by the client via Telegram. You can assign exercises from a pre-seeded multilingual library or write custom ones; the bot delivers them and tracks completion. If a client triggers the SOS button, you receive an immediate multi-channel alert (Telegram + email). Nothing requires you to switch to a separate app: documentation and the between-session record are one workspace.',
    howPrtopP3:
      'Where PR-TOP trades depth for breadth: it does not ship the mature, locked clinical formats (SOAP/DAP/BIRP/GIRP presets, treatment-plan generators, DSM/ICD prompts) that dedicated documentation tools have spent years refining. If your practice runs on a strict US EHR clinical format, a specialist tool may still be better for that layer. See the comparison table below.',
    howPrtopLead: 'See also: ',
    howPrtopLinkNotes: 'AI session notes for therapists',
    howPrtopAnd: ' and ',
    howPrtopLinkDiary: 'client diary for therapists',
    howPrtopTail: '.',

    tableTitle: 'Comparison: PR-TOP vs dedicated documentation tools (2026)',
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
        wins: 'Notes + between-session diary + exercises + SOS + Telegram, EU/GDPR, 4 languages, single encrypted dashboard',
        loses: 'Simpler note templates, no US-EHR integrations, no scheduling or billing',
        bestFor: 'EU/CIS/LATAM therapists who want documentation AND a between-session client channel in one tool',
      },
      {
        label: 'Heidi',
        pricing: 'From ~$0 (limited free) / ~$29/mo paid',
        wins: 'Fast, polished AI notes, many clinical templates, easy browser-based recording',
        loses: 'No client-facing channel, no between-session diary or exercises, no crisis alerts',
        bestFor: 'Therapists who want a slick, low-friction note-writer with good template depth',
      },
      {
        label: 'Freed',
        pricing: 'From ~$99/mo',
        wins: 'High-quality ambient recording, accurate notes, strong US-market integrations',
        loses: 'No client channel, no diary or exercises, expensive for solo practice',
        bestFor: 'US therapists in larger practices who need premium ambient documentation',
      },
      {
        label: 'Eleos',
        pricing: 'Enterprise pricing (contact)',
        wins: 'Deep clinical analytics, outcome tracking, EHR integrations, enterprise-grade compliance',
        loses: 'No direct client diary channel, complex setup, US-focused, no Telegram bot',
        bestFor: 'Group practices and clinics that need analytics-driven documentation at scale',
      },
    ],
    tableNote:
      'Pricing verified against each vendor\'s public pricing page in July 2026. Numbers refresh quarterly. PR-TOP pricing is in EUR; competitor prices are in USD.',

    whenSpecialistTitle: 'When to choose a dedicated documentation tool',
    whenSpecialistItems: [
      'Your practice runs entirely on session documentation — you have no need to track between-session activity or communicate via a client channel.',
      'You need deep clinical template parity (SOAP/DAP/BIRP/GIRP variants, DSM/ICD prompts, treatment-plan generators) locked in by default.',
      'You are a US therapist and require HIPAA-compliant integrations with an existing EHR (Epic, SimplePractice, TherapyNotes).',
      'You work in a large group practice and need enterprise analytics or outcome-tracking features tied to session documentation.',
    ],

    whenPrtopTitle: 'When to choose PR-TOP for therapy documentation',
    whenPrtopItems: [
      'You want session notes AND a real-time between-session record in one encrypted workspace — not two separate subscriptions.',
      'Your clients benefit from keeping a voice, text or video diary between appointments, and you want to see it before the next session.',
      'You assign exercises and need to know whether clients actually completed them — not reconstruct it from memory.',
      'A client in crisis must be able to reach you with one tap from Telegram, not hunt for a phone number.',
      'You are in the EU, Ukraine, Russia or Latin America and want GDPR-first, EU-hosted software with a Data Processing Addendum included by default.',
      'You need the dashboard and client bot in English, Russian, Ukrainian or Spanish.',
    ],

    encryptionTitle: 'Encryption and GDPR in therapy documentation AI',
    encryptionP1:
      'PR-TOP separates all data into two classes before anything reaches the database. Class A data — diary entries, session transcripts, AI summaries, private therapist notes — is encrypted with AES at the application layer, so the database holds ciphertext, not plaintext client content. Class B data — timestamps, metadata, client IDs — is access-controlled plaintext. A server compromise does not expose your clients\' words.',
    encryptionP2:
      'All processing runs on EU infrastructure (Hetzner). Analytics run on self-hosted Umami — no third-party trackers. A Data Processing Addendum is provided by default. Clients can exercise GDPR data rights (access, rectification, erasure) through your dashboard, and you can export or permanently delete an entire client record in one action.',
    encryptionLead: 'See also: ',
    encryptionLinkPractice: 'AI practice management with PR-TOP',
    encryptionTail: '.',

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'What is "therapy documentation AI" and how does it help with clinical documentation?',
        a: 'Therapy documentation AI uses speech-to-text (typically OpenAI Whisper or similar) to transcribe session recordings, then passes the transcript to a large language model to generate a structured clinical note. The output can be formatted as a SOAP note, a session summary, or a custom template. The time saving is substantial: what used to take 30–60 minutes of post-session writing typically takes 2–5 minutes of review and editing. PR-TOP adds a second layer: a between-session Telegram channel where clients keep a diary, complete exercises, and trigger SOS alerts, so documentation covers the full week, not just the session hour.',
      },
      {
        q: 'How does PR-TOP\'s Whisper transcription work?',
        a: 'You upload an audio or video file (up to 100 MB) from any source — a Zoom recording, a local voice recorder, a phone memo. PR-TOP sends it to OpenAI Whisper for transcription. Whisper supports over 50 languages and handles accented speech well. The raw transcript is encrypted as Class A data immediately after transcription and never stored in plaintext. An AI summary is then generated using your configured provider (OpenAI, Anthropic, Gemini, OpenRouter) against a customisable template. The original file is also available for streaming playback with a signed, expiring URL.',
      },
      {
        q: 'Does PR-TOP produce clinical note formats like SOAP or DAP?',
        a: 'PR-TOP generates session summaries against a configurable template — you can shape the prompt to produce SOAP-style, DAP-style or narrative outputs. It does not ship named clinical formats as locked presets the way specialist tools like Heidi or Freed do. If your practice requires strict adherence to a specific US clinical format, or deep EHR integration with format enforcement, a dedicated documentation tool will serve that layer better. PR-TOP\'s strength is combining notes with a full between-session client channel.',
      },
      {
        q: 'Is my client data encrypted in PR-TOP?',
        a: 'Yes. All Class A data (diary entries, transcripts, AI summaries, therapist notes) is encrypted with AES at the application layer before storage — the database holds ciphertext, not plaintext. File storage uses opaque IDs and signed streaming URLs that expire. All processing happens on EU infrastructure. A Data Processing Addendum is available by default, making GDPR compliance straightforward.',
      },
      {
        q: 'Can I use PR-TOP alongside a dedicated documentation tool like Heidi or Freed?',
        a: 'Yes. If you rely on Heidi or Freed for mature clinical template depth or US EHR integration, you can run PR-TOP for the between-session client channel — diary, exercises, SOS alerts — without conflict. Many EU therapists use a dedicated note-taker for the session note and PR-TOP for everything that happens in the six days between appointments. The scopes barely overlap.',
      },
      {
        q: 'Can I try PR-TOP free?',
        a: 'Yes. The free Trial tier gives you the encrypted dashboard, the Telegram client bot, diary entries, exercises and SOS for a limited number of clients. No credit card required, and no automatic conversion to a paid plan. You upgrade only when you decide to.',
      },
    ],

    ctaTitle: 'Therapy documentation AI — start with the full picture',
    ctaText:
      'The free Trial takes about ten minutes to set up. No credit card. If PR-TOP does not fit your workflow, you can export all your data and leave — no lock-in.',
    ctaButton: 'Start free trial',
    ctaLinkNotes: 'AI session notes',
    ctaLinkDiary: 'Client diary for therapists',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'AI-документация для психологов — руководство 2026',
    seoDescription:
      'AI-документация для психологов: транскрипция Whisper, зашифрованные заметки и дневник клиента между сессиями. Попробуйте PR-TOP бесплатно сегодня.',
    articleHeadline: 'AI-документация для психологов — руководство 2026',
    articleDescription:
      'Сравнение инструментов AI-документации для психологов в 2026 году: Heidi, Freed и Eleos останавливаются на заметке к сессии. PR-TOP добавляет транскрипцию Whisper и зашифрованный дневник клиента между сессиями.',
    badge: 'Руководство по функции',
    h1: 'AI-документация для психологов',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',

    intro:
      'Инструменты AI-документации для психологов расшифровывают ваши сессии и генерируют структурированные заметки, чтобы вы тратили минуты, а не час на бумажную работу. PR-TOP делает это с транскрипцией Whisper — и уникально остаётся открытым между сессиями как дневник в Telegram, канал упражнений и SOS-оповещения для клиентов, всё зашифровано.',

    whyNotEnoughTitle: 'Почему инструменты для заметок оставляют пробел в документации',
    whyNotEnoughP1:
      'Heidi, Freed и Eleos представляют современный уровень AI-клинической документации: вы подключаетесь к звонку, AI слушает, и через несколько минут появляется заметка SOAP или DAP. Экономия времени реальна, а форматы зрелые. Это действительно хорошие инструменты для своей задачи.',
    whyNotEnoughP2a:
      'Проблема в том, что клиническая документация не заканчивается заметкой к сессии. Пространство ',
    whyNotEnoughP2em: 'между',
    whyNotEnoughP2b:
      ' сессиями создаёт собственную документационную нагрузку: что клиент записал в дневник на этой неделе, выполнил ли он назначенное упражнение, произошёл ли кризис во вторник, о котором вы узнаёте только в пятницу? Восстановление этого контекста перед следующей сессией — из разрозненных сообщений, переписки или памяти — само по себе двойная документация, и ни один из специализированных инструментов для заметок этого не решает.',
    whyNotEnoughP3:
      'PR-TOP закрывает этот пробел. Он обрабатывает документацию сессии (транскрипция Whisper, AI-резюме, потоковое воспроизведение, зашифрованное хранение) и затем поддерживает канал с клиентом в Telegram: клиенты ведут голосовой, текстовый или видео-дневник, выполняют назначенные упражнения и могут отправить SOS одним нажатием прямо вам. Всё зашифровано AES на уровне приложения. Когда вы садитесь перед следующей сессией, полная картина — заметки и записи между сессиями — в одном кабинете.',

    howPrtopTitle: 'Как PR-TOP ведёт документацию терапии: от сессии до карты клиента',
    howPrtopP1:
      'На стороне сессии вы загружаете аудио- или видеофайл (до 100 МБ) из любого источника — Zoom, местный диктофон, голосовое сообщение с телефона. OpenAI Whisper расшифровывает его; необработанный транскрипт сразу шифруется как данные класса A — база данных никогда не хранит контент клиентов в открытом виде. Выбранный вами AI-провайдер (OpenAI, Anthropic, Gemini, OpenRouter) затем генерирует резюме по настраиваемому шаблону. Заметка и транскрипт попадают на временную шкалу клиента в вашем зашифрованном кабинете.',
    howPrtopP2:
      'Между сессиями та же временная шкала пополняется записями дневника — текстом, голосовыми заметками или короткими видео, которые клиент отправляет через Telegram. Вы можете назначать упражнения из готовой многоязычной библиотеки или создавать собственные; бот доставляет их и отслеживает выполнение. Если клиент нажимает SOS, вы получаете мгновенное многоканальное оповещение (Telegram + email). Нет необходимости переключаться между приложениями: документация и записи между сессиями — одно рабочее пространство.',
    howPrtopP3:
      'Где PR-TOP жертвует глубиной ради широты: он не поставляется со зрелыми, жёстко заданными клиническими форматами (пресеты SOAP/DAP/BIRP/GIRP, генераторы планов лечения, подсказки DSM/ICD), которые специализированные документационные инструменты оттачивают годами. Если ваша практика строится на строгом американском клиническом формате EHR, специализированный инструмент для этого слоя может подойти лучше. Смотрите сравнительную таблицу ниже.',
    howPrtopLead: 'Смотрите также: ',
    howPrtopLinkNotes: 'AI-заметки к сессии для психологов',
    howPrtopAnd: ' и ',
    howPrtopLinkDiary: 'дневник клиента для психологов',
    howPrtopTail: '.',

    tableTitle: 'Сравнение: PR-TOP и специализированные инструменты документации (2026)',
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
        wins: 'Заметки + дневник между сессиями + упражнения + SOS + Telegram, ЕС/GDPR, 4 языка, единый зашифрованный кабинет',
        loses: 'Более простые шаблоны заметок, нет интеграций с американскими EHR, нет расписания и биллинга',
        bestFor: 'Психологам из ЕС/СНГ/LATAM, которым нужна документация И канал для клиентов между сессиями в одном инструменте',
      },
      {
        label: 'Heidi',
        pricing: 'От ~$0 (ограниченный бесплатный) / ~$29/мес платный',
        wins: 'Быстрые и качественные AI-заметки, множество клинических шаблонов, простая запись в браузере',
        loses: 'Нет клиентского канала, нет дневника или упражнений между сессиями, нет кризисных оповещений',
        bestFor: 'Психологам, которым нужен удобный инструмент для заметок с хорошей глубиной шаблонов',
      },
      {
        label: 'Freed',
        pricing: 'От ~$99/мес',
        wins: 'Высококачественная фоновая запись, точные заметки, сильные интеграции для рынка США',
        loses: 'Нет клиентского канала, нет дневника или упражнений, дорого для частной практики',
        bestFor: 'Психологам в США в крупных практиках, которым нужна премиальная фоновая документация',
      },
      {
        label: 'Eleos',
        pricing: 'Корпоративные цены (по запросу)',
        wins: 'Глубокая клиническая аналитика, отслеживание результатов, интеграции с EHR, корпоративный комплаенс',
        loses: 'Нет прямого канала дневника клиента, сложная настройка, ориентирован на США, нет Telegram-бота',
        bestFor: 'Групповым практикам и клиникам, которым нужна масштабная документация с аналитикой',
      },
    ],
    tableNote:
      'Цены сверены с публичными страницами каждого вендора в июле 2026. Обновляются ежеквартально. Цены PR-TOP в EUR, цены конкурентов в USD.',

    whenSpecialistTitle: 'Когда выбрать специализированный инструмент документации',
    whenSpecialistItems: [
      'Ваша практика полностью сосредоточена на документации сессий — отслеживать активность между сессиями или вести клиентский канал вам не нужно.',
      'Вам нужна глубокая совместимость клинических шаблонов (варианты SOAP/DAP/BIRP/GIRP, подсказки DSM/ICD, генераторы планов лечения) из коробки.',
      'Вы практикуете в США и требуются HIPAA-совместимые интеграции с существующей EHR (Epic, SimplePractice, TherapyNotes).',
      'Вы работаете в крупной групповой практике и вам нужны корпоративная аналитика или отслеживание результатов, привязанное к документации сессий.',
    ],

    whenPrtopTitle: 'Когда выбрать PR-TOP для документации терапии',
    whenPrtopItems: [
      'Вам нужны заметки к сессиям И записи между сессиями в одном зашифрованном рабочем пространстве — не две отдельные подписки.',
      'Ваши клиенты получают пользу от ведения голосового, текстового или видео-дневника между приёмами, и вы хотите видеть его перед следующей сессией.',
      'Вы назначаете упражнения и должны знать, выполнил ли их клиент — не восстанавливать это из памяти.',
      'Клиент в кризисе должен иметь возможность связаться с вами одним нажатием в Telegram без поиска номера телефона.',
      'Вы работаете в ЕС, Украине, России или Латинской Америке и предпочитаете GDPR-first, EU-hosted ПО с DPA по умолчанию.',
      'Вам нужен кабинет и бот для клиентов на русском, украинском или испанском языке.',
    ],

    encryptionTitle: 'Шифрование и GDPR в AI-документации для терапии',
    encryptionP1:
      'PR-TOP разделяет все данные на два класса до того, как они попадают в базу данных. Данные класса A — записи дневника, транскрипты сессий, AI-резюме, приватные заметки психолога — шифруются с AES на уровне приложения перед сохранением: база данных хранит шифротекст, а не открытый контент клиентов. Данные класса B — временные метки, метаданные, идентификаторы клиентов — хранятся в открытом виде с контролем доступа. Взлом сервера не раскроет слова ваших клиентов.',
    encryptionP2:
      'Вся обработка происходит на инфраструктуре ЕС (Hetzner). Аналитика работает на self-hosted Umami — без сторонних трекеров. DPA предоставляется по умолчанию. Клиенты могут реализовать права субъектов данных по GDPR (доступ, исправление, удаление) через ваш кабинет, а вы можете экспортировать или навсегда удалить всю запись клиента одним действием.',
    encryptionLead: 'Смотрите также: ',
    encryptionLinkPractice: 'AI-управление практикой с PR-TOP',
    encryptionTail: '.',

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'Что такое AI-документация для психологов и как AI помогает с клинической документацией?',
        a: 'Инструменты AI-документации используют распознавание речи (как правило, OpenAI Whisper) для транскрипции записей сессий, затем передают транскрипт языковой модели для генерации структурированной клинической заметки. Результат может быть отформатирован как SOAP-заметка, резюме сессии или по пользовательскому шаблону. Экономия времени существенная: то, что раньше занимало 30–60 минут написания, теперь требует 2–5 минут проверки и редактирования. PR-TOP добавляет второй уровень: канал в Telegram между сессиями, где клиенты ведут дневник, выполняют упражнения и отправляют SOS-оповещения, охватывая документацией всю неделю, а не только час сессии.',
      },
      {
        q: 'Как работает транскрипция Whisper в PR-TOP?',
        a: 'Вы загружаете аудио- или видеофайл (до 100 МБ) из любого источника — запись Zoom, местный диктофон, голосовое сообщение с телефона. PR-TOP отправляет его в OpenAI Whisper для транскрипции. Whisper поддерживает более 50 языков и хорошо справляется с акцентированной речью. Необработанный транскрипт сразу шифруется как данные класса A и никогда не хранится в открытом виде. Затем AI-провайдер (OpenAI, Anthropic, Gemini, OpenRouter) генерирует резюме по настраиваемому шаблону. Исходный файл также доступен для потокового воспроизведения по подписанному URL с ограниченным сроком действия.',
      },
      {
        q: 'PR-TOP создаёт клинические форматы заметок — SOAP, DAP?',
        a: 'PR-TOP генерирует резюме сессий по настраиваемому шаблону — вы можете задать промпт для SOAP-подобного, DAP-подобного или нарративного вывода. Он не поставляется с именованными клиническими форматами в виде жёстко заданных пресетов, как специализированные инструменты Heidi или Freed. Если вашей практике требуется строгое соблюдение конкретного американского клинического формата или глубокая интеграция с EHR, специализированный инструмент для этого слоя подойдёт лучше. Сила PR-TOP — в сочетании заметок с полным каналом для клиентов между сессиями.',
      },
      {
        q: 'Данные моих клиентов зашифрованы в PR-TOP?',
        a: 'Да. Все данные класса A (записи дневника, транскрипты, AI-резюме, заметки психолога) шифруются с AES на уровне приложения перед хранением — база данных содержит шифротекст, а не открытый текст. Файловое хранилище использует непрозрачные идентификаторы и подписанные потоковые URL с ограниченным сроком действия. Вся обработка происходит на инфраструктуре ЕС. DPA предоставляется по умолчанию, упрощая соблюдение GDPR.',
      },
      {
        q: 'Можно ли использовать PR-TOP вместе со специализированным инструментом документации — Heidi или Freed?',
        a: 'Да. Если вы полагаетесь на Heidi или Freed для глубоких клинических шаблонов или интеграций с американскими EHR, вы можете использовать PR-TOP для канала между сессиями — дневника, упражнений, SOS-оповещений — без каких-либо конфликтов. Многие психологи в ЕС используют специализированный инструмент для заметок и PR-TOP для всего, что происходит в шесть дней между приёмами. Области применения почти не пересекаются.',
      },
      {
        q: 'Можно ли попробовать PR-TOP бесплатно?',
        a: 'Да. Бесплатный тариф Trial включает зашифрованный кабинет, Telegram-бот для клиентов, дневник, упражнения и SOS для ограниченного числа клиентов. Карта не нужна, автоматического перехода на платный план нет. Вы переходите на него только по собственному решению.',
      },
    ],

    ctaTitle: 'AI-документация для терапии — начните с полной картиной',
    ctaText:
      'Настройка бесплатного Trial занимает около десяти минут. Без банковской карты. Если PR-TOP не вписывается в ваш рабочий процесс, вы можете выгрузить все данные и уйти без привязки.',
    ctaButton: 'Начать бесплатно',
    ctaLinkNotes: 'AI-заметки к сессии',
    ctaLinkDiary: 'Дневник клиента для психологов',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'AI-документація для психологів — посібник 2026',
    seoDescription:
      'AI-документація для психологів: транскрипція Whisper, зашифровані нотатки та щоденник клієнта між сесіями. Спробуйте PR-TOP безкоштовно сьогодні.',
    articleHeadline: 'AI-документація для психологів — посібник 2026',
    articleDescription:
      'Порівняння інструментів AI-документації для психологів у 2026 році: Heidi, Freed і Eleos зупиняються на нотатці до сесії. PR-TOP додає транскрипцію Whisper і зашифрований щоденник клієнта між сесіями.',
    badge: 'Посібник з функції',
    h1: 'AI-документація для психологів',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',

    intro:
      'Інструменти AI-документації для психологів транскрибують ваші сесії та генерують структуровані нотатки, щоб ви витрачали хвилини, а не годину на паперову роботу. PR-TOP робить це з транскрипцією Whisper — і унікально залишається відкритим між сесіями як щоденник у Telegram, канал вправ та SOS-сповіщення для клієнтів, усе зашифровано.',

    whyNotEnoughTitle: 'Чому інструменти для нотаток залишають прогалину в документації',
    whyNotEnoughP1:
      'Heidi, Freed і Eleos представляють сучасний рівень AI-клінічної документації: ви підключаєтесь до дзвінка, AI слухає, і через кілька хвилин з\'являється нотатка SOAP або DAP. Економія часу реальна, а формати зрілі. Це справді хороші інструменти для своєї задачі.',
    whyNotEnoughP2a:
      'Проблема в тому, що клінічна документація не завершується нотаткою до сесії. Простір ',
    whyNotEnoughP2em: 'між',
    whyNotEnoughP2b:
      ' сесіями створює власне документаційне навантаження: що клієнт записав у щоденник цього тижня, чи виконав він призначену вправу, чи стався кризовий епізод у вівторок, про який ви дізнаєтесь лише в п\'ятницю? Відновлення цього контексту перед наступною сесією — з розрізнених повідомлень, листування або пам\'яті — само по собі є подвійною документацією, і жоден зі спеціалізованих інструментів для нотаток цього не вирішує.',
    whyNotEnoughP3:
      'PR-TOP закриває цю прогалину. Він обробляє документацію сесії (транскрипція Whisper, AI-резюме, потокове відтворення, зашифроване зберігання) і потім підтримує канал із клієнтом у Telegram: клієнти ведуть голосовий, текстовий або відео-щоденник, виконують призначені вправи та можуть надіслати SOS одним дотиком просто вам. Усе зашифровано AES на рівні застосунку. Коли ви сідаєте перед наступною сесією, повна картина — нотатки та записи між сесіями — в одному кабінеті.',

    howPrtopTitle: 'Як PR-TOP веде документацію терапії: від сесії до картки клієнта',
    howPrtopP1:
      'На боці сесії ви завантажуєте аудіо- або відеофайл (до 100 МБ) з будь-якого джерела — Zoom, місцевий диктофон, голосове повідомлення з телефону. OpenAI Whisper транскрибує його; необроблений транскрипт одразу шифрується як дані класу A — база даних ніколи не зберігає контент клієнтів у відкритому вигляді. Обраний вами AI-провайдер (OpenAI, Anthropic, Gemini, OpenRouter) генерує резюме за налаштовуваним шаблоном. Нотатка та транскрипт потрапляють на часову шкалу клієнта у вашому зашифрованому кабінеті.',
    howPrtopP2:
      'Між сесіями та сама часова шкала поповнюється записами щоденника — текстом, голосовими нотатками або короткими відео, які клієнт надсилає через Telegram. Ви можете призначати вправи з готової багатомовної бібліотеки або створювати власні; бот доставляє їх і відстежує виконання. Якщо клієнт натискає SOS, ви отримуєте миттєве багатоканальне сповіщення (Telegram + email). Немає необхідності перемикатися між застосунками: документація та записи між сесіями — один робочий простір.',
    howPrtopP3:
      'Де PR-TOP поступається глибиною заради широти: він не постачається зі зрілими, жорстко заданими клінічними форматами (пресети SOAP/DAP/BIRP/GIRP, генератори планів лікування, підказки DSM/ICD), які спеціалізовані документаційні інструменти роками вдосконалюють. Якщо ваша практика будується на суворому американському клінічному форматі EHR, спеціалізований інструмент для цього шару може підійти краще. Дивіться порівняльну таблицю нижче.',
    howPrtopLead: 'Дивіться також: ',
    howPrtopLinkNotes: 'AI-нотатки до сесії для психологів',
    howPrtopAnd: ' та ',
    howPrtopLinkDiary: 'щоденник клієнта для психологів',
    howPrtopTail: '.',

    tableTitle: 'Порівняння: PR-TOP та спеціалізовані інструменти документації (2026)',
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
        wins: 'Нотатки + щоденник між сесіями + вправи + SOS + Telegram, ЄС/GDPR, 4 мови, єдиний зашифрований кабінет',
        loses: 'Простіші шаблони нотаток, немає інтеграцій з американськими EHR, немає розкладу та білінгу',
        bestFor: 'Психологам з ЄС/СНД/LATAM, яким потрібна документація І канал для клієнтів між сесіями в одному інструменті',
      },
      {
        label: 'Heidi',
        pricing: 'Від ~$0 (обмежений безкоштовний) / ~$29/міс платний',
        wins: 'Швидкі та якісні AI-нотатки, багато клінічних шаблонів, простий запис у браузері',
        loses: 'Немає клієнтського каналу, немає щоденника чи вправ між сесіями, немає кризових сповіщень',
        bestFor: 'Психологам, яким потрібен зручний інструмент для нотаток з хорошою глибиною шаблонів',
      },
      {
        label: 'Freed',
        pricing: 'Від ~$99/міс',
        wins: 'Високоякісний фоновий запис, точні нотатки, сильні інтеграції для ринку США',
        loses: 'Немає клієнтського каналу, немає щоденника чи вправ, дорого для приватної практики',
        bestFor: 'Психологам у США у великих практиках, яким потрібна преміальна фонова документація',
      },
      {
        label: 'Eleos',
        pricing: 'Корпоративні ціни (за запитом)',
        wins: 'Глибока клінічна аналітика, відстеження результатів, інтеграції з EHR, корпоративний комплаєнс',
        loses: 'Немає прямого каналу щоденника клієнта, складне налаштування, орієнтований на США, немає Telegram-бота',
        bestFor: 'Груповим практикам і клінікам, яким потрібна масштабна документація з аналітикою',
      },
    ],
    tableNote:
      'Ціни звірено з публічними сторінками кожного вендора у липні 2026. Оновлюються щокварталу. Ціни PR-TOP в EUR, ціни конкурентів в USD.',

    whenSpecialistTitle: 'Коли обрати спеціалізований інструмент документації',
    whenSpecialistItems: [
      'Ваша практика повністю зосереджена на документації сесій — відстежувати активність між сесіями або вести клієнтський канал вам не потрібно.',
      'Вам потрібна глибока сумісність клінічних шаблонів (варіанти SOAP/DAP/BIRP/GIRP, підказки DSM/ICD, генератори планів лікування) з коробки.',
      'Ви практикуєте у США й потрібні HIPAA-сумісні інтеграції з наявною EHR (Epic, SimplePractice, TherapyNotes).',
      'Ви працюєте у великій груповій практиці й вам потрібна корпоративна аналітика або відстеження результатів, прив\'язане до документації сесій.',
    ],

    whenPrtopTitle: 'Коли обрати PR-TOP для документації терапії',
    whenPrtopItems: [
      'Вам потрібні нотатки до сесій І записи між сесіями в одному зашифрованому робочому просторі — не дві окремі підписки.',
      'Ваші клієнти отримують користь від ведення голосового, текстового або відео-щоденника між прийомами, і ви хочете бачити його перед наступною сесією.',
      'Ви призначаєте вправи й повинні знати, чи клієнт справді їх виконав — а не відновлювати це з пам\'яті.',
      'Клієнт у кризі повинен мати можливість зв\'язатися з вами одним дотиком у Telegram без пошуку номера телефону.',
      'Ви працюєте в ЄС, Україні, Росії або Латинській Америці й надаєте перевагу GDPR-first, EU-hosted ПЗ з DPA за замовчуванням.',
      'Вам потрібен кабінет і бот для клієнтів українською, російською чи іспанською мовою.',
    ],

    encryptionTitle: 'Шифрування та GDPR в AI-документації для терапії',
    encryptionP1:
      'PR-TOP розділяє всі дані на два класи до того, як вони потрапляють до бази даних. Дані класу A — записи щоденника, транскрипти сесій, AI-резюме, приватні нотатки психолога — шифруються з AES на рівні застосунку перед збереженням: база даних зберігає шифротекст, а не відкритий контент клієнтів. Дані класу B — часові мітки, метадані, ідентифікатори клієнтів — зберігаються у відкритому вигляді з контролем доступу. Злом сервера не розкриє слова ваших клієнтів.',
    encryptionP2:
      'Вся обробка відбувається на інфраструктурі ЄС (Hetzner). Аналітика працює на self-hosted Umami — без сторонніх трекерів. DPA надається за замовчуванням. Клієнти можуть реалізувати права суб\'єктів даних за GDPR (доступ, виправлення, видалення) через ваш кабінет, а ви можете експортувати або назавжди видалити весь запис клієнта однією дією.',
    encryptionLead: 'Дивіться також: ',
    encryptionLinkPractice: 'AI-управління практикою з PR-TOP',
    encryptionTail: '.',

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'Що таке AI-документація для психологів і як AI допомагає з клінічною документацією?',
        a: 'Інструменти AI-документації використовують розпізнавання мовлення (зазвичай OpenAI Whisper) для транскрипції записів сесій, потім передають транскрипт мовній моделі для генерації структурованої клінічної нотатки. Результат може бути відформатований як SOAP-нотатка, резюме сесії або за користувацьким шаблоном. Економія часу суттєва: те, що раніше займало 30–60 хвилин написання, тепер потребує 2–5 хвилин перевірки та редагування. PR-TOP додає другий рівень: канал у Telegram між сесіями, де клієнти ведуть щоденник, виконують вправи та надсилають SOS-сповіщення, охоплюючи документацією весь тиждень, а не лише годину сесії.',
      },
      {
        q: 'Як працює транскрипція Whisper у PR-TOP?',
        a: 'Ви завантажуєте аудіо- або відеофайл (до 100 МБ) з будь-якого джерела — запис Zoom, місцевий диктофон, голосове повідомлення з телефону. PR-TOP надсилає його в OpenAI Whisper для транскрипції. Whisper підтримує понад 50 мов і добре справляється з акцентованим мовленням. Необроблений транскрипт одразу шифрується як дані класу A і ніколи не зберігається у відкритому вигляді. Потім AI-провайдер (OpenAI, Anthropic, Gemini, OpenRouter) генерує резюме за налаштовуваним шаблоном. Вихідний файл також доступний для потокового відтворення за підписаним URL з обмеженим терміном дії.',
      },
      {
        q: 'PR-TOP створює клінічні формати нотаток — SOAP, DAP?',
        a: 'PR-TOP генерує резюме сесій за налаштовуваним шаблоном — ви можете задати промпт для SOAP-подібного, DAP-подібного або наративного виводу. Він не постачається з іменованими клінічними форматами у вигляді жорстко заданих пресетів, як спеціалізовані інструменти Heidi або Freed. Якщо вашій практиці потрібне суворе дотримання конкретного американського клінічного формату або глибока інтеграція з EHR, спеціалізований інструмент для цього шару підійде краще. Сила PR-TOP — у поєднанні нотаток з повним каналом для клієнтів між сесіями.',
      },
      {
        q: 'Дані моїх клієнтів зашифровані в PR-TOP?',
        a: 'Так. Усі дані класу A (записи щоденника, транскрипти, AI-резюме, нотатки психолога) шифруються з AES на рівні застосунку перед зберіганням — база даних містить шифротекст, а не відкритий текст. Файлове сховище використовує непрозорі ідентифікатори та підписані потокові URL з обмеженим терміном дії. Вся обробка відбувається на інфраструктурі ЄС. DPA надається за замовчуванням, спрощуючи дотримання GDPR.',
      },
      {
        q: 'Чи можна використовувати PR-TOP разом зі спеціалізованим інструментом документації — Heidi або Freed?',
        a: 'Так. Якщо ви покладаєтесь на Heidi або Freed для глибоких клінічних шаблонів або інтеграцій з американськими EHR, ви можете використовувати PR-TOP для каналу між сесіями — щоденника, вправ, SOS-сповіщень — без будь-яких конфліктів. Багато психологів у ЄС використовують спеціалізований інструмент для нотаток і PR-TOP для всього, що відбувається в шість днів між прийомами. Сфери застосування майже не перетинаються.',
      },
      {
        q: 'Чи можна спробувати PR-TOP безкоштовно?',
        a: 'Так. Безкоштовний тариф Trial включає зашифрований кабінет, Telegram-бот для клієнтів, щоденник, вправи та SOS для обмеженої кількості клієнтів. Картка не потрібна, автоматичного переходу на платний план немає. Ви переходите на нього лише за власним рішенням.',
      },
    ],

    ctaTitle: 'AI-документація для терапії — починайте з повною картиною',
    ctaText:
      'Налаштування безкоштовного Trial займає близько десяти хвилин. Без банківської картки. Якщо PR-TOP не вписується у ваш робочий процес, ви можете вивантажити всі дані й піти без прив\'язки.',
    ctaButton: 'Почати безкоштовно',
    ctaLinkNotes: 'AI-нотатки до сесії',
    ctaLinkDiary: 'Щоденник клієнта для психологів',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Documentación de terapia con IA — guía para terapeutas (2026)',
    seoDescription:
      'Reduce el tiempo de documentación de terapia con IA: transcripción Whisper, notas cifradas y un diario del cliente entre sesiones. Prueba PR-TOP gratis.',
    articleHeadline: 'Documentación de terapia con IA — guía para terapeutas (2026)',
    articleDescription:
      'Comparativa de herramientas de documentación de terapia con IA en 2026: Heidi, Freed y Eleos se detienen en la nota de sesión. PR-TOP añade transcripción Whisper y un diario cifrado del cliente entre sesiones.',
    badge: 'Guía de funciones',
    h1: 'Documentación de terapia con IA — guía para terapeutas',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',

    intro:
      'Las herramientas de documentación de terapia con IA transcriben sus sesiones y generan notas estructuradas para que dedique minutos, no una hora, al papeleo. PR-TOP hace eso con transcripción Whisper — y de forma única permanece abierto entre sesiones como diario de Telegram, canal de ejercicios y alertas SOS para sus clientes, todo cifrado.',

    whyNotEnoughTitle: 'Por qué las herramientas de notas dejan una brecha en la documentación',
    whyNotEnoughP1:
      'Heidi, Freed y Eleos representan el estado del arte en documentación clínica con IA: se conecta a la llamada, la IA escucha y minutos después aparece una nota SOAP o DAP. El ahorro de tiempo es real y los formatos son maduros. Son genuinamente buenas herramientas para lo que hacen.',
    whyNotEnoughP2a:
      'El problema es que la documentación clínica no termina con la nota de sesión. El espacio ',
    whyNotEnoughP2em: 'entre',
    whyNotEnoughP2b:
      ' sesiones genera su propia carga documental: qué registró el cliente en su diario esta semana, si completó el ejercicio que usted asignó, si ocurrió una crisis el martes que usted solo escucha el viernes. Reconstruir ese contexto antes de la próxima cita — a partir de mensajes dispersos, hilos de correo o la memoria — es en sí mismo una doble documentación, y ninguna de las herramientas dedicadas a notas lo aborda.',
    whyNotEnoughP3:
      'PR-TOP cierra esa brecha. Gestiona la documentación de la sesión (transcripción Whisper, resumen con IA, reproducción en streaming, almacenamiento cifrado) y luego mantiene un canal de cliente en tiempo real vía Telegram: los clientes llevan un diario de voz, texto o vídeo, completan ejercicios asignados y pueden enviar un SOS con un toque directamente a su bandeja. Todo está cifrado con AES en la capa de aplicación. Cuando se sienta antes de la próxima sesión, el cuadro completo — notas más registro entre sesiones — está en un solo panel.',

    howPrtopTitle: 'Cómo gestiona PR-TOP la documentación de terapia, de la sesión al expediente',
    howPrtopP1:
      'En el lado de la sesión, usted carga un archivo de audio o vídeo (hasta 100 MB) de cualquier fuente — Zoom, grabadora local, nota de voz del teléfono. OpenAI Whisper lo transcribe; la transcripción sin procesar se cifra inmediatamente como datos de clase A, de modo que la base de datos nunca almacena el contenido del cliente en texto claro. Su proveedor de IA elegido (OpenAI, Anthropic, Gemini, OpenRouter) genera un resumen según una plantilla configurable. La nota y la transcripción aparecen en la línea de tiempo del cliente en su panel cifrado.',
    howPrtopP2:
      'Entre sesiones, esa misma línea de tiempo se llena con entradas del diario — texto, notas de voz o vídeos cortos enviados por el cliente vía Telegram. Puede asignar ejercicios de una biblioteca multilingüe precargada o escribir los suyos; el bot los entrega y hace seguimiento de la finalización. Si un cliente activa el botón SOS, usted recibe una alerta multicanal inmediata (Telegram + email). No necesita cambiar a otra aplicación: la documentación y el registro entre sesiones son un único espacio de trabajo.',
    howPrtopP3:
      'Donde PR-TOP sacrifica profundidad por amplitud: no incluye los formatos clínicos maduros y predefinidos (preajustes SOAP/DAP/BIRP/GIRP, generadores de planes de tratamiento, guías DSM/ICD) que las herramientas de documentación especializadas han refinado durante años. Si su consulta opera con un formato clínico EHR estadounidense estricto, una herramienta especializada puede servirle mejor para esa capa. Consulte la tabla comparativa a continuación.',
    howPrtopLead: 'Consulte también: ',
    howPrtopLinkNotes: 'notas de sesión con IA para terapeutas',
    howPrtopAnd: ' y ',
    howPrtopLinkDiary: 'diario del cliente para terapeutas',
    howPrtopTail: '.',

    tableTitle: 'Comparativa: PR-TOP vs herramientas de documentación dedicadas (2026)',
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
        wins: 'Notas + diario entre sesiones + ejercicios + SOS + Telegram, UE/GDPR, 4 idiomas, panel cifrado único',
        loses: 'Plantillas de notas más sencillas, sin integraciones con EHR de EE. UU., sin agenda ni facturación',
        bestFor: 'Terapeutas de UE/CEI/LATAM que quieren documentación Y un canal de clientes entre sesiones en una sola herramienta',
      },
      {
        label: 'Heidi',
        pricing: 'Desde ~$0 (gratuito limitado) / ~$29/mes de pago',
        wins: 'Notas con IA rápidas y pulidas, muchas plantillas clínicas, grabación fácil en el navegador',
        loses: 'Sin canal para clientes, sin diario ni ejercicios entre sesiones, sin alertas de crisis',
        bestFor: 'Terapeutas que quieren un tomador de notas ágil con buena profundidad de plantillas',
      },
      {
        label: 'Freed',
        pricing: 'Desde ~$99/mes',
        wins: 'Grabación ambiental de alta calidad, notas precisas, sólidas integraciones para el mercado de EE. UU.',
        loses: 'Sin canal para clientes, sin diario ni ejercicios, caro para consulta individual',
        bestFor: 'Terapeutas en EE. UU. en prácticas más grandes que necesitan documentación ambiental premium',
      },
      {
        label: 'Eleos',
        pricing: 'Precios empresariales (contactar)',
        wins: 'Analíticas clínicas profundas, seguimiento de resultados, integraciones con EHR, cumplimiento empresarial',
        loses: 'Sin canal directo de diario del cliente, configuración compleja, centrado en EE. UU., sin bot de Telegram',
        bestFor: 'Consultas grupales y clínicas que necesitan documentación a escala impulsada por analíticas',
      },
    ],
    tableNote:
      'Precios verificados en las páginas públicas de cada proveedor en julio de 2026. Las cifras se actualizan cada trimestre. Los precios de PR-TOP están en EUR; los de los competidores, en USD.',

    whenSpecialistTitle: 'Cuándo elegir una herramienta de documentación dedicada',
    whenSpecialistItems: [
      'Su consulta se centra por completo en la documentación de sesiones — no necesita rastrear la actividad entre sesiones ni mantener un canal con clientes.',
      'Necesita paridad profunda de plantillas clínicas (variantes SOAP/DAP/BIRP/GIRP, guías DSM/ICD, generadores de planes de tratamiento) lista para usar.',
      'Es terapeuta en EE. UU. y requiere integraciones compatibles con HIPAA con un EHR existente (Epic, SimplePractice, TherapyNotes).',
      'Trabaja en una gran práctica grupal y necesita analíticas empresariales o seguimiento de resultados vinculado a la documentación de sesiones.',
    ],

    whenPrtopTitle: 'Cuándo elegir PR-TOP para documentación de terapia',
    whenPrtopItems: [
      'Quiere notas de sesión Y un registro entre sesiones en tiempo real en un único espacio de trabajo cifrado — no dos suscripciones separadas.',
      'Sus clientes se benefician de llevar un diario de voz, texto o vídeo entre citas, y usted quiere verlo antes de la próxima sesión.',
      'Asigna ejercicios y necesita saber si los clientes los completaron realmente — no reconstruirlo de memoria.',
      'Un cliente en crisis debe poder contactarle con un toque desde Telegram, sin buscar un número de teléfono.',
      'Está en la UE, Ucrania, Rusia o Latinoamérica y prefiere software GDPR-first alojado en la UE con DPA incluido por defecto.',
      'Necesita el panel y el bot para clientes en ruso, ucraniano o español.',
    ],

    encryptionTitle: 'Cifrado y GDPR en documentación de terapia con IA',
    encryptionP1:
      'PR-TOP separa todos los datos en dos clases antes de que lleguen a la base de datos. Los datos de clase A — entradas de diario, transcripciones de sesiones, resúmenes de IA, notas privadas del terapeuta — se cifran con AES en la capa de aplicación antes de almacenarse: la base de datos guarda texto cifrado, no el contenido del cliente en texto claro. Los datos de clase B — marcas de tiempo, metadatos, identificadores de clientes — son texto claro con control de acceso. Una brecha en el servidor no expone las palabras de sus clientes.',
    encryptionP2:
      'Todo el procesamiento se ejecuta en infraestructura de la UE (Hetzner). Las analíticas funcionan en Umami autoalojado — sin rastreadores de terceros. Un Addendum de Procesamiento de Datos está disponible por defecto. Los clientes pueden ejercer los derechos GDPR de los interesados (acceso, rectificación, supresión) a través de su panel, y usted puede exportar o eliminar de forma permanente el registro completo de un cliente en una sola acción.',
    encryptionLead: 'Consulte también: ',
    encryptionLinkPractice: 'gestión de consulta con IA en PR-TOP',
    encryptionTail: '.',

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿Qué es la "documentación de terapia con IA" y cómo ayuda con la documentación clínica?',
        a: 'Las herramientas de documentación de terapia con IA usan reconocimiento de voz (normalmente OpenAI Whisper) para transcribir las grabaciones de sesiones y luego pasan la transcripción a un modelo de lenguaje para generar una nota clínica estructurada. El resultado puede formatearse como una nota SOAP, un resumen de sesión o una plantilla personalizada. El ahorro de tiempo es sustancial: lo que antes llevaba 30–60 minutos de escritura ahora requiere 2–5 minutos de revisión y edición. PR-TOP añade una segunda capa: un canal de Telegram entre sesiones donde los clientes llevan un diario, completan ejercicios y envían alertas SOS, cubriendo la documentación de toda la semana, no solo de la hora de sesión.',
      },
      {
        q: '¿Cómo funciona la transcripción Whisper de PR-TOP?',
        a: 'Usted carga un archivo de audio o vídeo (hasta 100 MB) de cualquier fuente — grabación de Zoom, grabadora local, nota de voz del teléfono. PR-TOP lo envía a OpenAI Whisper para la transcripción. Whisper admite más de 50 idiomas y maneja bien el habla con acento. La transcripción sin procesar se cifra como datos de clase A inmediatamente después de la transcripción y nunca se almacena en texto claro. Luego el proveedor de IA (OpenAI, Anthropic, Gemini, OpenRouter) genera un resumen según una plantilla personalizable. El archivo original también está disponible para reproducción en streaming con una URL firmada y con expiración.',
      },
      {
        q: '¿PR-TOP produce formatos de notas clínicas como SOAP o DAP?',
        a: 'PR-TOP genera resúmenes de sesiones según una plantilla configurable — puede moldear el prompt para producir salidas tipo SOAP, tipo DAP o narrativas. No incluye formatos clínicos con nombre como preajustes fijos, a diferencia de herramientas especializadas como Heidi o Freed. Si su consulta requiere adhesión estricta a un formato clínico estadounidense específico, o integración profunda con EHR con aplicación de formato, una herramienta de documentación dedicada servirá mejor para esa capa. La fortaleza de PR-TOP es combinar notas con un canal completo de clientes entre sesiones.',
      },
      {
        q: '¿Están cifrados los datos de mis clientes en PR-TOP?',
        a: 'Sí. Todos los datos de clase A (entradas de diario, transcripciones, resúmenes de IA, notas del terapeuta) se cifran con AES en la capa de aplicación antes del almacenamiento — la base de datos guarda texto cifrado, no texto claro. El almacenamiento de archivos usa identificadores opacos y URLs de streaming firmadas que caducan. Todo el procesamiento ocurre en infraestructura de la UE. Un Addendum de Procesamiento de Datos está disponible por defecto, facilitando el cumplimiento del GDPR.',
      },
      {
        q: '¿Puedo usar PR-TOP junto a una herramienta de documentación dedicada como Heidi o Freed?',
        a: 'Sí. Si depende de Heidi o Freed por la profundidad de sus plantillas clínicas o integraciones con EHR de EE. UU., puede ejecutar PR-TOP para el canal entre sesiones — diario, ejercicios, alertas SOS — sin ningún conflicto. Muchos terapeutas de la UE usan un tomador de notas dedicado para la nota de sesión y PR-TOP para todo lo que ocurre en los seis días entre citas. Los ámbitos apenas se solapan.',
      },
      {
        q: '¿Puedo probar PR-TOP gratis?',
        a: 'Sí. El nivel Trial gratuito incluye el panel cifrado, el bot de Telegram para clientes, el diario, los ejercicios y el SOS para un número limitado de clientes. No se requiere tarjeta de crédito y no hay conversión automática a un plan de pago. Solo cambia de plan cuando usted lo decide.',
      },
    ],

    ctaTitle: 'Documentación de terapia con IA — empiece con el cuadro completo',
    ctaText:
      'La versión Trial gratuita se configura en unos diez minutos. Sin tarjeta de crédito. Si PR-TOP no encaja en su flujo de trabajo, puede exportar todos sus datos e irse sin ataduras.',
    ctaButton: 'Empezar gratis',
    ctaLinkNotes: 'Notas de sesión con IA',
    ctaLinkDiary: 'Diario del cliente para terapeutas',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function TherapyDocumentationAi() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const c = CONTENT[locale] || CONTENT.en;
  const lp = useLocalePath();
  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : `/${locale}`}/therapy-documentation-ai`;

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
        path="/therapy-documentation-ai"
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

        {/* Rule 7 — PR-TOP wedge in first H2: documentation gap framing (diary + exercises + crisis alerts + Telegram named). */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whyNotEnoughTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whyNotEnoughP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">
            {c.whyNotEnoughP2a}
            <em>{c.whyNotEnoughP2em}</em>
            {c.whyNotEnoughP2b}
          </p>
          <p className="text-gray-700 leading-relaxed">{c.whyNotEnoughP3}</p>
        </section>

        {/* Rule 7 — PR-TOP wedge in second H2: session-to-record coverage (diary + exercises + SOS + Telegram named again). */}
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
            <Link to={lp('/ai-session-notes-for-therapists')} className="text-primary underline hover:no-underline">
              {c.howPrtopLinkNotes}
            </Link>
            {c.howPrtopAnd}
            <Link to={lp('/client-diary-for-therapists')} className="text-primary underline hover:no-underline">
              {c.howPrtopLinkDiary}
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

        {/* When to choose a dedicated documentation tool */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whenSpecialistTitle}
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            {c.whenSpecialistItems.map((item) => (
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

        {/* Encryption section — internal link to /ai-practice-management */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.encryptionTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.encryptionP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.encryptionP2}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.encryptionLead}
            <Link to={lp('/ai-practice-management')} className="text-primary underline hover:no-underline">
              {c.encryptionLinkPractice}
            </Link>
            {c.encryptionTail}
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
              to={lp('/ai-session-notes-for-therapists')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkNotes}
            </Link>
            <Link
              to={lp('/client-diary-for-therapists')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkDiary}
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
