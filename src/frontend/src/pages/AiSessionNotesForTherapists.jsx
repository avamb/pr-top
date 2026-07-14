import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /ai-session-notes-for-therapists  —  feature guide + wedge page (localized EN/RU/UK/ES).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest feature/price comparison table (Category, Pricing, Where it wins,
 *      Where it loses, Best for) — PR-TOP vs Quill, Supanote, AutoNotes
 *   4. FAQ block + FAQPage JSON-LD (5-6 Q&As)
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + ≥2 sibling pages:
 *      /ai-practice-management, /best-ai-assistant-for-therapists,
 *      /security/encryption, /security/gdpr
 *   7. PR-TOP wedge in first two H2 sections:
 *      diary + exercises + crisis alerts + Telegram all named
 *
 * Page angle: specialist AI note-takers (Quill/Supanote/AutoNotes) end at the
 * session note. PR-TOP does notes AND adds the between-session channel those
 * tools lack.
 *
 * Competitor data verified against quill.chat, supanote.ai, autonotes.ai
 * in July 2026.
 */

const CONTENT = {
  en: {
    seoTitle: 'AI session notes for therapists (2026) — full guide',
    seoDescription:
      'Compare AI session note tools for therapists: Quill, Supanote, AutoNotes vs PR-TOP. PR-TOP adds the between-session layer note-takers miss. Try free.',
    articleHeadline: 'AI session notes for therapists (2026) — the full guide',
    articleDescription:
      'Honest 2026 guide to AI session notes for therapists: how Quill, Supanote and AutoNotes compare, and why PR-TOP adds the between-session channel those tools lack.',
    badge: 'Feature guide',
    h1: 'AI session notes for therapists',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    intro:
      'AI session notes transcribe and summarize your sessions so you can write progress notes in seconds instead of minutes. PR-TOP does that — and unlike pure note-takers it also keeps a real-time client channel open between sessions: Telegram diary, exercises and one-tap crisis alerts, all encrypted.',

    whyNotEnoughTitle: 'Why session notes alone are not enough',
    whyNotEnoughP1:
      'The AI note-taker market — Quill, Supanote, AutoNotes, Heidi, Freed — solves one problem cleanly: reducing documentation time after a session. You join a call, the AI listens, and you get a clean SOAP or DAP note in your inbox. That is genuinely valuable.',
    whyNotEnoughP2a:
      'The gap is the space ',
    whyNotEnoughP2em: 'between',
    whyNotEnoughP2b:
      ' sessions. A client who spirals on a Wednesday night, misses the homework you assigned, or needs a nudge before Friday — none of that context reaches you through a note-taking app. Therapists in private practice increasingly report that the biggest source of double documentation is not writing the session note; it is reconstructing what happened in the six days before the next appointment.',
    whyNotEnoughP3:
      'PR-TOP is built around that gap. It handles session notes (Whisper transcription, configurable AI providers, summary templates) and then stays open as a Telegram channel where clients keep a voice, text or video diary, receive exercises, and can send a one-tap SOS straight to your inbox. All of it is AES-encrypted at the application layer. The session note and the between-session record arrive in the same dashboard.',

    howPrtopTitle: 'How PR-TOP handles session notes',
    howPrtopP1:
      'Session recording is the starting point. You upload an audio or video file (up to 100 MB) from any source — Zoom, local recorder, phone — and Whisper transcribes it. The transcript is immediately encrypted as Class A data, meaning the database never holds plaintext client content. An AI summary is generated using your choice of provider (OpenAI, Anthropic, Gemini, OpenRouter) against a configurable template.',
    howPrtopP2:
      'The result lands on the client\'s timeline in your encrypted dashboard alongside their diary entries for that week. Instead of flipping between a note-taking app and a separate folder of client messages, you see the session note and the between-session record in one place. When you prepare for the next appointment, the context is already there.',
    howPrtopP3:
      'Templates are provider-configurable rather than locked to SOAP/DAP/BIRP/GIRP presets. That is a trade-off: specialist note-takers offer more mature clinical formats out of the box. If your practice runs on a specific clinical model and you need deep template parity with a US EHR, a dedicated note-taker may serve you better. See the comparison table below.',
    howPrtopLead: 'See also: ',
    howPrtopLinkPractice: 'AI practice management with PR-TOP',
    howPrtopAnd: ' and ',
    howPrtopLinkBest: 'best AI assistant for therapists (2026 roundup)',
    howPrtopTail: '.',

    tableTitle: 'Comparison: PR-TOP vs specialist AI note-takers (2026)',
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
        wins: 'Between-session channel (diary, exercises, SOS), EU/GDPR, 4 languages, single encrypted dashboard',
        loses: 'Simpler note templates, no US-EHR integrations, no scheduling/billing',
        bestFor: 'EU/CIS/LATAM therapists who want notes AND a between-session client channel',
      },
      {
        label: 'Quill',
        pricing: 'From ~$29/mo',
        wins: 'Fast, clean AI notes, good template library, US-market integrations',
        loses: 'No client-facing channel, no diary or exercises, US-hosted',
        bestFor: 'US therapists who want to cut note-writing time with minimal setup',
      },
      {
        label: 'Supanote',
        pricing: 'From ~$19/mo',
        wins: 'Affordable entry point, clean SOAP/DAP output, easy session upload',
        loses: 'No between-session engagement, no client app, limited language support',
        bestFor: 'Solo therapists on a budget focused purely on session documentation',
      },
      {
        label: 'AutoNotes',
        pricing: 'From ~$25/mo',
        wins: 'Automated note generation, customisable templates, no manual upload needed',
        loses: 'No client channel, no crisis alerts, US-focused compliance',
        bestFor: 'Therapists who want hands-off AI note generation during sessions',
      },
    ],
    tableNote:
      'Pricing verified against each vendor\'s public pricing page in July 2026. Numbers refresh quarterly. PR-TOP pricing is in EUR; competitor prices are in USD.',

    whenSpecialistTitle: 'When to choose a specialist note-taker',
    whenSpecialistItems: [
      'Your entire workflow is session documentation — you have no need to track between-session activity.',
      'You need deep clinical template parity (SOAP/DAP/BIRP/GIRP variants, treatment-plan generators, DSM/ICD prompts) out of the box.',
      'You are a US therapist and need HIPAA-compliant integrations with your existing EHR (Epic, SimplePractice, TherapyNotes).',
      'You bill through a US-centric platform and want notes to flow directly into billing — a use case PR-TOP does not cover.',
    ],

    whenPrtopTitle: 'When to choose PR-TOP',
    whenPrtopItems: [
      'You want session notes AND a real-time between-session record — not two separate tools.',
      'Your clients benefit from keeping a voice, text or video diary between appointments and you want to see it.',
      'You want to assign exercises and know whether your client actually completed them before the next session.',
      'A client in crisis should be able to reach you with one tap from Telegram — not hunt for a phone number.',
      'You are in the EU, Ukraine, Russia or Latin America and want GDPR-first, EU-hosted software with a Data Processing Addendum included by default.',
      'You need your interface (and your clients\' interface) in Russian, Ukrainian or Spanish, not English only.',
    ],

    privacyTitle: 'Privacy and encryption: what "encrypted session notes" actually means',
    privacyP1:
      'PR-TOP separates data into two classes at the application layer before anything reaches the database. Class A data — diary entries, session transcripts, AI summaries, private therapist notes — is encrypted with AES before storage, so the database itself holds ciphertext, not plaintext client content. Class B data — timestamps, metadata, IDs — is access-controlled plaintext. A server breach does not expose your clients\' words.',
    privacyP2:
      'All processing happens on EU infrastructure (Hetzner). There are no third-party analytics trackers — analytics run on self-hosted Umami. A Data Processing Addendum is available by default, not on request. Clients can exercise GDPR data rights (access, rectification, erasure) through your dashboard, and you can export or wipe an entire client record in one action.',
    privacyLead: 'Details: ',
    privacyLinkEncryption: 'encryption architecture',
    privacyAnd: ' and ',
    privacyLinkGdpr: 'GDPR compliance',
    privacyTail: '.',

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'Does PR-TOP produce SOAP, DAP or BIRP notes?',
        a: 'PR-TOP generates session summaries using configurable AI providers (OpenAI, Anthropic, Gemini, OpenRouter) against a template you can customise. It does not ship named clinical formats (SOAP, DAP, BIRP, GIRP) as locked presets the way specialist note-takers do. If your practice depends on strict adherence to a specific clinical format, a dedicated tool like Quill or Supanote will serve you better for note templates. PR-TOP\'s value is the combination of notes and the between-session client channel.',
      },
      {
        q: 'How does Whisper transcription work in PR-TOP?',
        a: 'You upload an audio or video file (up to 100 MB) from any source — Zoom recording, a local recorder, a phone voice memo. PR-TOP sends it to OpenAI Whisper for transcription, then passes the transcript to your chosen AI provider for summarization. The raw transcript is encrypted as Class A data immediately after transcription and never stored in plaintext. Streaming playback of the original file is also available from the session detail view.',
      },
      {
        q: 'Can I use PR-TOP alongside a specialist note-taker like Quill or Supanote?',
        a: 'Yes, and many EU therapists do. If you rely on a specialist note-taker for its clinical template depth or EHR integrations, you can run PR-TOP for the client-facing channel — diary, exercises, SOS alerts — without any conflict. The two tools solve different problems and their scopes barely overlap.',
      },
      {
        q: 'Is the session recording stored permanently?',
        a: 'Session files are stored as encrypted binary assets with opaque IDs and signed-access streaming URLs that expire. You control retention: you can delete a session file (and its transcript and summary) from the dashboard at any time, and the delete is permanent. There is no long-term audio retention by default.',
      },
      {
        q: 'What languages does AI note generation support?',
        a: 'Whisper transcription supports over 50 languages. The AI summary quality depends on the provider you configure — all major providers (OpenAI, Anthropic, Google Gemini) handle multilingual sessions well. The PR-TOP dashboard and the Telegram client bot are available in English, Russian, Ukrainian and Spanish.',
      },
      {
        q: 'Can I try PR-TOP without a credit card?',
        a: 'Yes. The free Trial tier includes the encrypted dashboard, Telegram client bot, diary, exercises and SOS for a limited number of clients. No card required, no automatic conversion to a paid plan. You upgrade only when you decide to.',
      },
    ],

    ctaTitle: 'Start with AI session notes — stay for the between-session layer',
    ctaText:
      'The free Trial takes about ten minutes to set up. No credit card. If PR-TOP does not fit your workflow, you can export all your data and leave — no lock-in.',
    ctaButton: 'Start free trial',
    ctaLinkPractice: 'AI practice management',
    ctaLinkBest: 'Best AI assistants for therapists',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'AI-заметки к сессии для психологов (2026) — полное руководство',
    seoDescription:
      'Сравнение AI-инструментов для заметок сессий: Quill, Supanote, AutoNotes против PR-TOP. PR-TOP добавляет работу между сессиями. Попробуйте бесплатно.',
    articleHeadline: 'AI-заметки к сессии для психологов (2026) — полное руководство',
    articleDescription:
      'Честное руководство 2026 года по AI-заметкам к сессиям: сравнение Quill, Supanote и AutoNotes и почему PR-TOP добавляет канал между сессиями, которого лишены другие инструменты.',
    badge: 'Руководство по функции',
    h1: 'AI-заметки к сессии для психологов',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',

    intro:
      'AI-заметки к сессии расшифровывают и резюмируют ваши сессии, чтобы вы могли составлять прогресс-заметки за секунды, а не минуты. PR-TOP делает это — и в отличие от чистых инструментов для заметок он также поддерживает канал с клиентом между сессиями: дневник в Telegram, упражнения и SOS в одно касание, всё с шифрованием.',

    whyNotEnoughTitle: 'Почему одних заметок к сессии недостаточно',
    whyNotEnoughP1:
      'Рынок AI-инструментов для заметок — Quill, Supanote, AutoNotes, Heidi, Freed — решает одну задачу чётко: сокращение времени на документацию после сессии. Вы подключаетесь к звонку, AI слушает, и вы получаете аккуратную заметку в формате SOAP или DAP. Это реально ценно.',
    whyNotEnoughP2a:
      'Пробел — это пространство ',
    whyNotEnoughP2em: 'между',
    whyNotEnoughP2b:
      ' сессиями. Клиент, у которого всё рушится в среду вечером, пропустивший домашнее задание или которому нужна поддержка перед пятницей — всё это не доходит до вас через приложение для заметок. Психологи в частной практике всё чаще отмечают, что главный источник двойной документации — не написание заметки к сессии, а восстановление того, что произошло за шесть дней до следующего приёма.',
    whyNotEnoughP3:
      'PR-TOP создан именно для этого пробела. Он обрабатывает заметки к сессиям (транскрипция Whisper, настраиваемые AI-провайдеры, шаблоны резюме) и затем остаётся открытым как Telegram-канал, где клиенты ведут голосовой, текстовый или видео-дневник, получают упражнения и могут отправить SOS прямо вам. Всё это зашифровано на уровне приложения с AES. Заметка к сессии и записи между сессиями попадают в один кабинет.',

    howPrtopTitle: 'Как PR-TOP работает с заметками к сессиям',
    howPrtopP1:
      'Запись сессии — отправная точка. Вы загружаете аудио- или видеофайл (до 100 МБ) из любого источника — Zoom, локальный диктофон, телефон — и Whisper расшифровывает его. Транскрипт сразу шифруется как данные класса A: база данных никогда не хранит контент клиентов в открытом виде. AI-резюме генерируется с помощью выбранного вами провайдера (OpenAI, Anthropic, Gemini, OpenRouter) по настраиваемому шаблону.',
    howPrtopP2:
      'Результат появляется на временной шкале клиента в вашем зашифрованном кабинете рядом с записями его дневника за эту неделю. Вместо переключения между приложением для заметок и отдельной папкой с сообщениями клиентов вы видите заметку к сессии и записи между сессиями в одном месте. Когда вы готовитесь к следующему приёму, контекст уже здесь.',
    howPrtopP3:
      'Шаблоны настраиваются провайдером, а не привязаны к форматам SOAP/DAP/BIRP/GIRP. Это компромисс: специализированные инструменты для заметок предлагают более зрелые клинические форматы из коробки. Если ваша практика строится на конкретной клинической модели и вам нужна глубокая совместимость с американской EHR, специализированный инструмент может подойти лучше. Смотрите сравнительную таблицу ниже.',
    howPrtopLead: 'Смотрите также: ',
    howPrtopLinkPractice: 'AI-управление практикой с PR-TOP',
    howPrtopAnd: ' и ',
    howPrtopLinkBest: 'лучшие AI-ассистенты для психологов (обзор 2026)',
    howPrtopTail: '.',

    tableTitle: 'Сравнение: PR-TOP и специализированные AI-инструменты для заметок (2026)',
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
        wins: 'Канал между сессиями (дневник, упражнения, SOS), ЕС/GDPR, 4 языка, единый зашифрованный кабинет',
        loses: 'Более простые шаблоны заметок, нет интеграций с американскими EHR, нет расписания и биллинга',
        bestFor: 'Психологам из ЕС/СНГ/LATAM, которым нужны заметки И канал для клиентов между сессиями',
      },
      {
        label: 'Quill',
        pricing: 'От ~$29/мес',
        wins: 'Быстрые и аккуратные AI-заметки, хорошая библиотека шаблонов, интеграции для рынка США',
        loses: 'Нет клиентского канала, нет дневника или упражнений, хостинг в США',
        bestFor: 'Психологам из США, которые хотят сократить время на написание заметок с минимальной настройкой',
      },
      {
        label: 'Supanote',
        pricing: 'От ~$19/мес',
        wins: 'Доступная цена входа, аккуратный вывод SOAP/DAP, простая загрузка сессий',
        loses: 'Нет вовлечения между сессиями, нет клиентского приложения, ограниченная поддержка языков',
        bestFor: 'Сольным практикам с ограниченным бюджетом, ориентированным исключительно на документацию сессий',
      },
      {
        label: 'AutoNotes',
        pricing: 'От ~$25/мес',
        wins: 'Автоматическая генерация заметок, настраиваемые шаблоны, не требует ручной загрузки',
        loses: 'Нет клиентского канала, нет кризисных оповещений, комплаенс с прицелом на США',
        bestFor: 'Психологам, которые хотят автоматической генерации AI-заметок во время сессий без лишних действий',
      },
    ],
    tableNote:
      'Цены сверены с публичными страницами каждого вендора в июле 2026. Обновляются ежеквартально. Цены PR-TOP в EUR, цены конкурентов в USD.',

    whenSpecialistTitle: 'Когда выбрать специализированный инструмент для заметок',
    whenSpecialistItems: [
      'Ваш рабочий процесс полностью посвящён документации сессий — отслеживать активность между сессиями вам не нужно.',
      'Вам нужна глубокая совместимость клинических шаблонов (варианты SOAP/DAP/BIRP/GIRP, генераторы планов терапии, подсказки DSM/ICD) из коробки.',
      'Вы практикуете в США и вам нужны HIPAA-совместимые интеграции с вашей EHR (Epic, SimplePractice, TherapyNotes).',
      'Вы ведёте биллинг через американскую платформу и хотите, чтобы заметки автоматически попадали в счета — PR-TOP этого не поддерживает.',
    ],

    whenPrtopTitle: 'Когда выбрать PR-TOP',
    whenPrtopItems: [
      'Вам нужны заметки к сессиям И записи между сессиями в реальном времени — не два отдельных инструмента.',
      'Ваши клиенты получают пользу от ведения голосового, текстового или видео-дневника между приёмами, и вы хотите его видеть.',
      'Вы хотите назначать упражнения и знать, выполнил ли их клиент до следующей сессии.',
      'Клиент в кризисе должен иметь возможность связаться с вами одним нажатием в Telegram — без поиска номера телефона.',
      'Вы работаете в ЕС, Украине, России или Латинской Америке и предпочитаете GDPR-first, EU-hosted программное обеспечение с DPA по умолчанию.',
      'Вам нужен интерфейс (и интерфейс ваших клиентов) на русском, украинском или испанском, а не только на английском.',
    ],

    privacyTitle: 'Конфиденциальность и шифрование: что значит «зашифрованные заметки сессий»',
    privacyP1:
      'PR-TOP разделяет данные на два класса на уровне приложения до того, как они попадают в базу данных. Данные класса A — записи дневника, транскрипты сессий, AI-резюме, приватные заметки психолога — шифруются с помощью AES перед сохранением: база данных хранит шифротекст, а не открытый контент клиентов. Данные класса B — временные метки, метаданные, идентификаторы — хранятся в открытом виде с контролем доступа. Взлом сервера не раскроет слова ваших клиентов.',
    privacyP2:
      'Вся обработка происходит на инфраструктуре ЕС (Hetzner). Сторонних аналитических трекеров нет — аналитика работает на self-hosted Umami. DPA включён по умолчанию, а не по запросу. Клиенты могут реализовать права субъектов данных по GDPR (доступ, исправление, удаление) через ваш кабинет, а вы можете экспортировать или удалить всю запись клиента одним действием.',
    privacyLead: 'Подробности: ',
    privacyLinkEncryption: 'архитектура шифрования',
    privacyAnd: ' и ',
    privacyLinkGdpr: 'соответствие GDPR',
    privacyTail: '.',

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'PR-TOP создаёт заметки в форматах SOAP, DAP или BIRP?',
        a: 'PR-TOP генерирует резюме сессий с помощью настраиваемых AI-провайдеров (OpenAI, Anthropic, Gemini, OpenRouter) по шаблону, который вы можете изменить. В отличие от специализированных инструментов, он не поставляется с именованными клиническими форматами (SOAP, DAP, BIRP, GIRP) в виде жёстко заданных пресетов. Если ваша практика требует строгого соблюдения конкретного клинического формата, специализированный инструмент вроде Quill или Supanote лучше подойдёт для шаблонов заметок. Ценность PR-TOP — в сочетании заметок и канала для клиентов между сессиями.',
      },
      {
        q: 'Как работает транскрипция Whisper в PR-TOP?',
        a: 'Вы загружаете аудио- или видеофайл (до 100 МБ) из любого источника — запись Zoom, местный диктофон, голосовое сообщение с телефона. PR-TOP отправляет его в OpenAI Whisper для транскрипции, затем передаёт транскрипт выбранному AI-провайдеру для создания резюме. Необработанный транскрипт немедленно шифруется как данные класса A и никогда не хранится в открытом виде. Потоковое воспроизведение исходного файла также доступно из представления деталей сессии.',
      },
      {
        q: 'Можно ли использовать PR-TOP вместе со специализированным инструментом для заметок?',
        a: 'Да, и многие психологи в ЕС так и делают. Если вы полагаетесь на специализированный инструмент для глубины клинических шаблонов или интеграций с EHR, вы можете использовать PR-TOP для клиентского канала — дневника, упражнений, SOS-оповещений — без каких-либо конфликтов. Эти инструменты решают разные задачи, и их области применения почти не пересекаются.',
      },
      {
        q: 'Хранится ли запись сессии постоянно?',
        a: 'Файлы сессий хранятся как зашифрованные бинарные объекты с непрозрачными идентификаторами и подписанными URL для потокового доступа с ограниченным сроком действия. Вы контролируете хранение: вы можете удалить файл сессии (и её транскрипт и резюме) из кабинета в любое время, и удаление необратимо. По умолчанию долгосрочного хранения аудио нет.',
      },
      {
        q: 'Какие языки поддерживает генерация AI-заметок?',
        a: 'Транскрипция Whisper поддерживает более 50 языков. Качество AI-резюме зависит от настроенного провайдера — все ведущие провайдеры (OpenAI, Anthropic, Google Gemini) хорошо справляются с многоязычными сессиями. Кабинет PR-TOP и Telegram-бот для клиентов доступны на английском, русском, украинском и испанском языках.',
      },
      {
        q: 'Можно ли попробовать PR-TOP без банковской карты?',
        a: 'Да. Бесплатный тариф Trial включает зашифрованный кабинет, Telegram-бот для клиентов, дневник, упражнения и SOS для ограниченного числа клиентов. Карта не нужна, автоматического перехода на платный план нет. Вы переходите на него только по собственному решению.',
      },
    ],

    ctaTitle: 'Начните с AI-заметок к сессиям — останьтесь ради работы между сессиями',
    ctaText:
      'Настройка бесплатного Trial занимает около десяти минут. Без банковской карты. Если PR-TOP не вписывается в ваш рабочий процесс, вы можете выгрузить все данные и уйти без привязки.',
    ctaButton: 'Начать бесплатно',
    ctaLinkPractice: 'AI-управление практикой',
    ctaLinkBest: 'Лучшие AI-ассистенты для психологов',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'AI-нотатки до сесії для психологів (2026) — повний посібник',
    seoDescription:
      'Порівняння AI-інструментів для нотаток сесій: Quill, Supanote, AutoNotes проти PR-TOP. PR-TOP додає роботу між сесіями. Спробуйте безкоштовно.',
    articleHeadline: 'AI-нотатки до сесії для психологів (2026) — повний посібник',
    articleDescription:
      'Чесний посібник 2026 року з AI-нотаток до сесій: порівняння Quill, Supanote і AutoNotes та чому PR-TOP додає канал між сесіями, якого бракує іншим інструментам.',
    badge: 'Посібник з функції',
    h1: 'AI-нотатки до сесії для психологів',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',

    intro:
      'AI-нотатки до сесії транскрибують і резюмують ваші сесії, щоб ви могли складати прогрес-нотатки за секунди, а не хвилини. PR-TOP робить це — і на відміну від чистих інструментів для нотаток він також підтримує канал із клієнтом між сесіями: щоденник у Telegram, вправи та SOS в один дотик, усе із шифруванням.',

    whyNotEnoughTitle: 'Чому лише нотаток до сесії недостатньо',
    whyNotEnoughP1:
      'Ринок AI-інструментів для нотаток — Quill, Supanote, AutoNotes, Heidi, Freed — вирішує одне завдання чітко: скорочення часу на документацію після сесії. Ви підключаєтесь до дзвінка, AI слухає, і ви отримуєте охайну нотатку у форматі SOAP або DAP. Це справді цінно.',
    whyNotEnoughP2a:
      'Прогалина — це простір ',
    whyNotEnoughP2em: 'між',
    whyNotEnoughP2b:
      ' сесіями. Клієнт, у якого все рушиться в середу ввечері, який пропустив домашнє завдання або якому потрібна підтримка перед п\'ятницею — усе це не доходить до вас через застосунок для нотаток. Психологи в приватній практиці дедалі частіше зазначають, що головне джерело подвійної документації — не написання нотатки до сесії, а відновлення того, що відбувалося протягом шести днів до наступного прийому.',
    whyNotEnoughP3:
      'PR-TOP створено саме для цієї прогалини. Він обробляє нотатки до сесій (транскрипція Whisper, налаштовувані AI-провайдери, шаблони резюме) і потім залишається відкритим як Telegram-канал, де клієнти ведуть голосовий, текстовий або відео-щоденник, отримують вправи й можуть надіслати SOS просто вам. Усе це зашифровано на рівні застосунку з AES. Нотатка до сесії та записи між сесіями потрапляють в один кабінет.',

    howPrtopTitle: 'Як PR-TOP працює з нотатками до сесій',
    howPrtopP1:
      'Запис сесії — відправна точка. Ви завантажуєте аудіо- або відеофайл (до 100 МБ) з будь-якого джерела — Zoom, місцевий диктофон, телефон — і Whisper транскрибує його. Транскрипт одразу шифрується як дані класу A: база даних ніколи не зберігає контент клієнтів у відкритому вигляді. AI-резюме генерується за допомогою обраного вами провайдера (OpenAI, Anthropic, Gemini, OpenRouter) за налаштовуваним шаблоном.',
    howPrtopP2:
      'Результат з\'являється на часовій шкалі клієнта у вашому зашифрованому кабінеті поряд із записами його щоденника за цей тиждень. Замість перемикання між застосунком для нотаток і окремою папкою з повідомленнями клієнтів ви бачите нотатку до сесії та записи між сесіями в одному місці. Коли ви готуєтеся до наступного прийому, контекст вже тут.',
    howPrtopP3:
      'Шаблони налаштовуються провайдером, а не прив\'язані до форматів SOAP/DAP/BIRP/GIRP. Це компроміс: спеціалізовані інструменти для нотаток пропонують більш зрілі клінічні формати з коробки. Якщо ваша практика будується на конкретній клінічній моделі й вам потрібна глибока сумісність з американською EHR, спеціалізований інструмент може підійти краще. Дивіться порівняльну таблицю нижче.',
    howPrtopLead: 'Дивіться також: ',
    howPrtopLinkPractice: 'AI-управління практикою з PR-TOP',
    howPrtopAnd: ' та ',
    howPrtopLinkBest: 'найкращі AI-асистенти для психологів (огляд 2026)',
    howPrtopTail: '.',

    tableTitle: 'Порівняння: PR-TOP та спеціалізовані AI-інструменти для нотаток (2026)',
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
        wins: 'Канал між сесіями (щоденник, вправи, SOS), ЄС/GDPR, 4 мови, єдиний зашифрований кабінет',
        loses: 'Простіші шаблони нотаток, немає інтеграцій з американськими EHR, немає розкладу та білінгу',
        bestFor: 'Психологам з ЄС/СНД/LATAM, яким потрібні нотатки І канал для клієнтів між сесіями',
      },
      {
        label: 'Quill',
        pricing: 'Від ~$29/міс',
        wins: 'Швидкі та охайні AI-нотатки, хороша бібліотека шаблонів, інтеграції для ринку США',
        loses: 'Немає клієнтського каналу, немає щоденника чи вправ, хостинг у США',
        bestFor: 'Психологам зі США, які хочуть скоротити час на написання нотаток з мінімальним налаштуванням',
      },
      {
        label: 'Supanote',
        pricing: 'Від ~$19/міс',
        wins: 'Доступна ціна входу, охайний вивід SOAP/DAP, простесте завантаження сесій',
        loses: 'Немає залучення між сесіями, немає клієнтського застосунку, обмежена підтримка мов',
        bestFor: 'Сольним практикам з обмеженим бюджетом, орієнтованим виключно на документацію сесій',
      },
      {
        label: 'AutoNotes',
        pricing: 'Від ~$25/міс',
        wins: 'Автоматична генерація нотаток, налаштовувані шаблони, не потребує ручного завантаження',
        loses: 'Немає клієнтського каналу, немає кризових сповіщень, комплаєнс із прицілом на США',
        bestFor: 'Психологам, які хочуть автоматичної генерації AI-нотаток під час сесій без зайвих дій',
      },
    ],
    tableNote:
      'Ціни звірено з публічними сторінками кожного вендора у липні 2026. Оновлюються щокварталу. Ціни PR-TOP в EUR, ціни конкурентів в USD.',

    whenSpecialistTitle: 'Коли обрати спеціалізований інструмент для нотаток',
    whenSpecialistItems: [
      'Ваш робочий процес повністю присвячений документації сесій — відстежувати активність між сесіями вам не потрібно.',
      'Вам потрібна глибока сумісність клінічних шаблонів (варіанти SOAP/DAP/BIRP/GIRP, генератори планів терапії, підказки DSM/ICD) з коробки.',
      'Ви практикуєте у США й вам потрібні HIPAA-сумісні інтеграції з вашою EHR (Epic, SimplePractice, TherapyNotes).',
      'Ви ведете білінг через американську платформу й хочете, щоб нотатки автоматично потрапляли до рахунків — PR-TOP цього не підтримує.',
    ],

    whenPrtopTitle: 'Коли обрати PR-TOP',
    whenPrtopItems: [
      'Вам потрібні нотатки до сесій І записи між сесіями в реальному часі — не два окремі інструменти.',
      'Ваші клієнти отримують користь від ведення голосового, текстового або відео-щоденника між прийомами, і ви хочете його бачити.',
      'Ви хочете призначати вправи й знати, чи клієнт справді їх виконав до наступної сесії.',
      'Клієнт у кризі повинен мати можливість зв\'язатися з вами одним дотиком у Telegram — без пошуку номера телефону.',
      'Ви працюєте в ЄС, Україні, Росії або Латинській Америці й надаєте перевагу GDPR-first, EU-hosted програмному забезпеченню з DPA за замовчуванням.',
      'Вам потрібен інтерфейс (і інтерфейс ваших клієнтів) українською, російською чи іспанською, а не лише англійською.',
    ],

    privacyTitle: 'Конфіденційність і шифрування: що означають «зашифровані нотатки сесій»',
    privacyP1:
      'PR-TOP розділяє дані на два класи на рівні застосунку до того, як вони потрапляють до бази даних. Дані класу A — записи щоденника, транскрипти сесій, AI-резюме, приватні нотатки психолога — шифруються з AES перед збереженням: база даних зберігає шифротекст, а не відкритий контент клієнтів. Дані класу B — часові мітки, метадані, ідентифікатори — зберігаються у відкритому вигляді з контролем доступу. Злом сервера не розкриє слова ваших клієнтів.',
    privacyP2:
      'Вся обробка відбувається на інфраструктурі ЄС (Hetzner). Сторонніх аналітичних трекерів немає — аналітика працює на self-hosted Umami. DPA включено за замовчуванням, а не за запитом. Клієнти можуть реалізувати права суб\'єктів даних за GDPR (доступ, виправлення, видалення) через ваш кабінет, а ви можете експортувати або видалити весь запис клієнта однією дією.',
    privacyLead: 'Докладніше: ',
    privacyLinkEncryption: 'архітектура шифрування',
    privacyAnd: ' та ',
    privacyLinkGdpr: 'відповідність GDPR',
    privacyTail: '.',

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'PR-TOP створює нотатки у форматах SOAP, DAP або BIRP?',
        a: 'PR-TOP генерує резюме сесій за допомогою налаштовуваних AI-провайдерів (OpenAI, Anthropic, Gemini, OpenRouter) за шаблоном, який ви можете змінити. На відміну від спеціалізованих інструментів, він не постачається з іменованими клінічними форматами (SOAP, DAP, BIRP, GIRP) у вигляді жорстко заданих пресетів. Якщо ваша практика вимагає суворого дотримання конкретного клінічного формату, спеціалізований інструмент на кшталт Quill або Supanote краще підійде для шаблонів нотаток. Цінність PR-TOP — у поєднанні нотаток і каналу для клієнтів між сесіями.',
      },
      {
        q: 'Як працює транскрипція Whisper у PR-TOP?',
        a: 'Ви завантажуєте аудіо- або відеофайл (до 100 МБ) з будь-якого джерела — запис Zoom, місцевий диктофон, голосове повідомлення з телефону. PR-TOP надсилає його в OpenAI Whisper для транскрипції, потім передає транскрипт обраному AI-провайдеру для створення резюме. Необроблений транскрипт одразу шифрується як дані класу A і ніколи не зберігається у відкритому вигляді. Потокове відтворення вихідного файлу також доступне з представлення деталей сесії.',
      },
      {
        q: 'Чи можна використовувати PR-TOP разом зі спеціалізованим інструментом для нотаток?',
        a: 'Так, і багато психологів у ЄС так і роблять. Якщо ви покладаєтесь на спеціалізований інструмент для глибини клінічних шаблонів або інтеграцій з EHR, ви можете використовувати PR-TOP для клієнтського каналу — щоденника, вправ, SOS-сповіщень — без будь-яких конфліктів. Ці інструменти вирішують різні завдання, і їхні сфери застосування майже не перетинаються.',
      },
      {
        q: 'Чи зберігається запис сесії постійно?',
        a: 'Файли сесій зберігаються як зашифровані бінарні об\'єкти з непрозорими ідентифікаторами та підписаними URL для потокового доступу з обмеженим терміном дії. Ви контролюєте зберігання: ви можете видалити файл сесії (і її транскрипт та резюме) з кабінету будь-коли, і видалення є незворотнім. За замовчуванням довгострокового зберігання аудіо немає.',
      },
      {
        q: 'Які мови підтримує генерація AI-нотаток?',
        a: 'Транскрипція Whisper підтримує понад 50 мов. Якість AI-резюме залежить від налаштованого провайдера — всі провідні провайдери (OpenAI, Anthropic, Google Gemini) добре справляються з багатомовними сесіями. Кабінет PR-TOP і Telegram-бот для клієнтів доступні англійською, російською, українською та іспанською мовами.',
      },
      {
        q: 'Чи можна спробувати PR-TOP без банківської картки?',
        a: 'Так. Безкоштовний тариф Trial включає зашифрований кабінет, Telegram-бот для клієнтів, щоденник, вправи та SOS для обмеженої кількості клієнтів. Картка не потрібна, автоматичного переходу на платний план немає. Ви переходите на нього лише за власним рішенням.',
      },
    ],

    ctaTitle: 'Почніть з AI-нотаток до сесій — залишайтеся заради роботи між сесіями',
    ctaText:
      'Налаштування безкоштовного Trial займає близько десяти хвилин. Без банківської картки. Якщо PR-TOP не вписується у ваш робочий процес, ви можете вивантажити всі дані й піти без прив\'язки.',
    ctaButton: 'Почати безкоштовно',
    ctaLinkPractice: 'AI-управління практикою',
    ctaLinkBest: 'Найкращі AI-асистенти для психологів',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Notas de sesión con IA para terapeutas (2026) — guía completa',
    seoDescription:
      'Compara herramientas de notas de sesión con IA: Quill, Supanote, AutoNotes vs PR-TOP. PR-TOP añade la capa entre sesiones que otros pierden. Prueba gratis.',
    articleHeadline: 'Notas de sesión con IA para terapeutas (2026) — la guía completa',
    articleDescription:
      'Guía honesta de 2026 sobre notas de sesión con IA para terapeutas: cómo se comparan Quill, Supanote y AutoNotes, y por qué PR-TOP añade el canal entre sesiones que esas herramientas no tienen.',
    badge: 'Guía de funciones',
    h1: 'Notas de sesión con IA para terapeutas',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',

    intro:
      'Las notas de sesión con IA transcriben y resumen sus sesiones para que pueda escribir notas de progreso en segundos, no en minutos. PR-TOP hace eso — y a diferencia de los tomadores de notas puros también mantiene un canal de cliente en tiempo real entre sesiones: diario de Telegram, ejercicios y alertas de crisis con un toque, todo cifrado.',

    whyNotEnoughTitle: 'Por qué las notas de sesión solas no son suficientes',
    whyNotEnoughP1:
      'El mercado de asistentes de notas con IA — Quill, Supanote, AutoNotes, Heidi, Freed — resuelve un problema con claridad: reducir el tiempo de documentación tras una sesión. Se conecta a la llamada, la IA escucha y usted recibe una nota SOAP o DAP limpia en su bandeja. Eso es genuinamente valioso.',
    whyNotEnoughP2a:
      'La brecha está en el espacio ',
    whyNotEnoughP2em: 'entre',
    whyNotEnoughP2b:
      ' sesiones. Un cliente que se desmorona un miércoles por la noche, que no hizo la tarea que usted asignó, o que necesita un empuje antes del viernes — nada de eso le llega a través de una aplicación de toma de notas. Los terapeutas en práctica privada reportan cada vez más que la mayor fuente de doble documentación no es escribir la nota de sesión; es reconstruir lo que ocurrió durante los seis días anteriores a la próxima cita.',
    whyNotEnoughP3:
      'PR-TOP está construido alrededor de esa brecha. Gestiona las notas de sesión (transcripción Whisper, proveedores de IA configurables, plantillas de resumen) y luego permanece abierto como un canal de Telegram donde los clientes llevan un diario de voz, texto o vídeo, reciben ejercicios y pueden enviar un SOS directamente a su bandeja. Todo está cifrado con AES en la capa de aplicación. La nota de sesión y el registro entre sesiones llegan al mismo panel.',

    howPrtopTitle: 'Cómo gestiona PR-TOP las notas de sesión',
    howPrtopP1:
      'La grabación de la sesión es el punto de partida. Usted carga un archivo de audio o vídeo (hasta 100 MB) de cualquier fuente — Zoom, grabadora local, teléfono — y Whisper lo transcribe. La transcripción se cifra inmediatamente como datos de clase A, lo que significa que la base de datos nunca almacena el contenido del cliente en texto claro. Un resumen de IA se genera usando el proveedor de su elección (OpenAI, Anthropic, Gemini, OpenRouter) sobre una plantilla configurable.',
    howPrtopP2:
      'El resultado aparece en la línea de tiempo del cliente en su panel cifrado junto a las entradas de su diario de esa semana. En lugar de alternar entre una aplicación de notas y una carpeta separada de mensajes de clientes, usted ve la nota de sesión y el registro entre sesiones en un solo lugar. Cuando se prepara para la próxima cita, el contexto ya está ahí.',
    howPrtopP3:
      'Las plantillas son configurables por el proveedor en lugar de estar bloqueadas a los preajustes SOAP/DAP/BIRP/GIRP. Eso es una compensación: los tomadores de notas especializados ofrecen formatos clínicos más maduros de serie. Si su práctica depende de la adhesión estricta a un formato clínico específico y necesita paridad profunda de plantillas con un EHR estadounidense, una herramienta dedicada puede servirle mejor. Consulte la tabla comparativa a continuación.',
    howPrtopLead: 'Consulte también: ',
    howPrtopLinkPractice: 'gestión de consulta con IA en PR-TOP',
    howPrtopAnd: ' y ',
    howPrtopLinkBest: 'mejores asistentes de IA para terapeutas (resumen 2026)',
    howPrtopTail: '.',

    tableTitle: 'Comparativa: PR-TOP vs tomadores de notas con IA especializados (2026)',
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
        wins: 'Canal entre sesiones (diario, ejercicios, SOS), UE/GDPR, 4 idiomas, panel cifrado único',
        loses: 'Plantillas de notas más sencillas, sin integraciones con EHR de EE. UU., sin agenda ni facturación',
        bestFor: 'Terapeutas de UE/CEI/LATAM que quieren notas Y un canal de clientes entre sesiones',
      },
      {
        label: 'Quill',
        pricing: 'Desde ~$29/mes',
        wins: 'Notas con IA rápidas y limpias, buena biblioteca de plantillas, integraciones para el mercado de EE. UU.',
        loses: 'Sin canal para clientes, sin diario ni ejercicios, alojado en EE. UU.',
        bestFor: 'Terapeutas de EE. UU. que quieren reducir el tiempo de escritura de notas con mínima configuración',
      },
      {
        label: 'Supanote',
        pricing: 'Desde ~$19/mes',
        wins: 'Precio de entrada asequible, salida SOAP/DAP limpia, carga de sesiones sencilla',
        loses: 'Sin compromiso entre sesiones, sin app para clientes, soporte de idiomas limitado',
        bestFor: 'Terapeutas en solitario con presupuesto limitado centrados exclusivamente en la documentación de sesiones',
      },
      {
        label: 'AutoNotes',
        pricing: 'Desde ~$25/mes',
        wins: 'Generación automática de notas, plantillas personalizables, no requiere carga manual',
        loses: 'Sin canal para clientes, sin alertas de crisis, cumplimiento centrado en EE. UU.',
        bestFor: 'Terapeutas que quieren generación de notas con IA de forma automática durante las sesiones',
      },
    ],
    tableNote:
      'Precios verificados en las páginas públicas de cada proveedor en julio de 2026. Las cifras se actualizan cada trimestre. Los precios de PR-TOP están en EUR; los de los competidores, en USD.',

    whenSpecialistTitle: 'Cuándo elegir un tomador de notas especializado',
    whenSpecialistItems: [
      'Su flujo de trabajo se centra por completo en la documentación de sesiones — no necesita rastrear la actividad entre sesiones.',
      'Necesita paridad profunda de plantillas clínicas (variantes SOAP/DAP/BIRP/GIRP, generadores de planes de tratamiento, guías DSM/ICD) lista para usar.',
      'Es terapeuta en EE. UU. y necesita integraciones compatibles con HIPAA con su EHR existente (Epic, SimplePractice, TherapyNotes).',
      'Factura a través de una plataforma centrada en EE. UU. y quiere que las notas fluyan directamente a la facturación — un caso de uso que PR-TOP no cubre.',
    ],

    whenPrtopTitle: 'Cuándo elegir PR-TOP',
    whenPrtopItems: [
      'Quiere notas de sesión Y un registro entre sesiones en tiempo real — no dos herramientas separadas.',
      'Sus clientes se benefician de llevar un diario de voz, texto o vídeo entre citas y usted quiere verlo.',
      'Quiere asignar ejercicios y saber si su cliente realmente los completó antes de la próxima sesión.',
      'Un cliente en crisis debe poder contactarle con un toque desde Telegram — sin buscar un número de teléfono.',
      'Está en la UE, Ucrania, Rusia o Latinoamérica y prefiere software GDPR-first alojado en la UE con DPA incluido por defecto.',
      'Necesita su interfaz (y la de sus clientes) en ruso, ucraniano o español, no solo en inglés.',
    ],

    privacyTitle: 'Privacidad y cifrado: qué significa realmente «notas de sesión cifradas»',
    privacyP1:
      'PR-TOP separa los datos en dos clases en la capa de aplicación antes de que lleguen a la base de datos. Los datos de clase A — entradas de diario, transcripciones de sesiones, resúmenes de IA, notas privadas del terapeuta — se cifran con AES antes de almacenarse, de modo que la base de datos guarda texto cifrado, no el contenido del cliente en texto claro. Los datos de clase B — marcas de tiempo, metadatos, identificadores — son texto claro con control de acceso. Una brecha en el servidor no expone las palabras de sus clientes.',
    privacyP2:
      'Todo el procesamiento ocurre en infraestructura de la UE (Hetzner). No hay rastreadores de análisis de terceros: el análisis se ejecuta en Umami autoalojado. Un Addendum de Procesamiento de Datos está disponible por defecto, no bajo petición. Los clientes pueden ejercer los derechos GDPR de los interesados (acceso, rectificación, supresión) a través de su panel, y usted puede exportar o borrar un registro completo de cliente en una sola acción.',
    privacyLead: 'Detalles: ',
    privacyLinkEncryption: 'arquitectura de cifrado',
    privacyAnd: ' y ',
    privacyLinkGdpr: 'cumplimiento del GDPR',
    privacyTail: '.',

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿PR-TOP produce notas en formato SOAP, DAP o BIRP?',
        a: 'PR-TOP genera resúmenes de sesiones usando proveedores de IA configurables (OpenAI, Anthropic, Gemini, OpenRouter) sobre una plantilla que puede personalizar. No incluye formatos clínicos con nombre (SOAP, DAP, BIRP, GIRP) como preajustes fijos, a diferencia de los tomadores de notas especializados. Si su práctica depende de la adhesión estricta a un formato clínico específico, una herramienta dedicada como Quill o Supanote le servirá mejor para las plantillas de notas. El valor de PR-TOP es la combinación de notas y el canal de clientes entre sesiones.',
      },
      {
        q: '¿Cómo funciona la transcripción de Whisper en PR-TOP?',
        a: 'Usted carga un archivo de audio o vídeo (hasta 100 MB) de cualquier fuente — grabación de Zoom, grabadora local, nota de voz del teléfono. PR-TOP lo envía a OpenAI Whisper para la transcripción, luego pasa la transcripción al proveedor de IA elegido para el resumen. La transcripción sin procesar se cifra como datos de clase A inmediatamente después de la transcripción y nunca se almacena en texto claro. La reproducción en streaming del archivo original también está disponible desde la vista de detalles de la sesión.',
      },
      {
        q: '¿Puedo usar PR-TOP junto a un tomador de notas especializado como Quill o Supanote?',
        a: 'Sí, y muchos terapeutas de la UE lo hacen. Si depende de un tomador de notas especializado por la profundidad de sus plantillas clínicas o integraciones con EHR, puede ejecutar PR-TOP para el canal de clientes — diario, ejercicios, alertas SOS — sin ningún conflicto. Las dos herramientas resuelven problemas diferentes y sus ámbitos apenas se solapan.',
      },
      {
        q: '¿Se almacena la grabación de la sesión de forma permanente?',
        a: 'Los archivos de sesión se almacenan como activos binarios cifrados con identificadores opacos y URLs de acceso firmado para streaming que caducan. Usted controla la retención: puede eliminar un archivo de sesión (y su transcripción y resumen) desde el panel en cualquier momento, y la eliminación es permanente. No hay retención de audio a largo plazo por defecto.',
      },
      {
        q: '¿Qué idiomas admite la generación de notas con IA?',
        a: 'La transcripción de Whisper admite más de 50 idiomas. La calidad del resumen de IA depende del proveedor que configure: todos los principales proveedores (OpenAI, Anthropic, Google Gemini) manejan bien las sesiones multilingües. El panel de PR-TOP y el bot de Telegram para clientes están disponibles en inglés, ruso, ucraniano y español.',
      },
      {
        q: '¿Puedo probar PR-TOP sin tarjeta de crédito?',
        a: 'Sí. El nivel Trial gratuito incluye el panel cifrado, el bot de Telegram para clientes, el diario, los ejercicios y el SOS para un número limitado de clientes. No se requiere tarjeta y no hay conversión automática a un plan de pago. Solo cambia de plan cuando usted lo decide.',
      },
    ],

    ctaTitle: 'Empiece con notas de sesión con IA — quédese por la capa entre sesiones',
    ctaText:
      'La versión Trial gratuita se configura en unos diez minutos. Sin tarjeta de crédito. Si PR-TOP no encaja en su flujo de trabajo, puede exportar todos sus datos e irse sin ataduras.',
    ctaButton: 'Empezar gratis',
    ctaLinkPractice: 'Gestión de consulta con IA',
    ctaLinkBest: 'Mejores asistentes de IA para terapeutas',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function AiSessionNotesForTherapists() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const c = CONTENT[locale] || CONTENT.en;
  const lp = useLocalePath();
  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : `/${locale}`}/ai-session-notes-for-therapists`;

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
        path="/ai-session-notes-for-therapists"
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

        {/* Rule 7 — PR-TOP wedge in first H2: between-session gap framing. */}
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

        {/* Rule 7 — PR-TOP wedge in second H2: how notes+channel works. */}
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
            <Link to={lp('/ai-practice-management')} className="text-primary underline hover:no-underline">
              {c.howPrtopLinkPractice}
            </Link>
            {c.howPrtopAnd}
            <Link to={lp('/best-ai-assistant-for-therapists')} className="text-primary underline hover:no-underline">
              {c.howPrtopLinkBest}
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

        {/* When to choose a specialist note-taker */}
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

        {/* Privacy section — internal links to /security/encryption and /security/gdpr */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.privacyTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.privacyP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.privacyP2}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.privacyLead}
            <Link to={lp('/security/encryption')} className="text-primary underline hover:no-underline">
              {c.privacyLinkEncryption}
            </Link>
            {c.privacyAnd}
            <Link to={lp('/security/gdpr')} className="text-primary underline hover:no-underline">
              {c.privacyLinkGdpr}
            </Link>
            {c.privacyTail}
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
              to={lp('/ai-practice-management')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkPractice}
            </Link>
            <Link
              to={lp('/best-ai-assistant-for-therapists')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkBest}
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
