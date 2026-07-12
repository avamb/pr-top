import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /for-coaches  —  PR-TOP for coaching practices (localized EN/RU/UK/ES).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest comparison table (PR-TOP vs generic coaching CRM/tools)
 *   4. FAQ block + FAQPage JSON-LD
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + sibling pages
 *   7. PR-TOP wedge (diary + exercises + streaks + Telegram) in first two H2s
 *
 * Coach-language rules: NO clinical/HIPAA/diagnosis vocabulary.
 * Page angle: coaching practice software / coaching session management.
 * Positioning: ROI — retained clients, less prep time, homework accountability,
 * premium client experience.
 */

const CONTENT = {
  en: {
    seoTitle: 'PR-TOP for Coaches — between-session engagement software',
    seoDescription:
      'PR-TOP gives coaches a professional between-session client engagement layer via Telegram: daily diary, homework streaks, and progress check-ins. Start free.',
    articleHeadline: 'PR-TOP for coaches — between-session engagement software (2026)',
    articleDescription:
      'How PR-TOP helps coaches retain more clients, cut session prep time, and deliver premium between-session support via a Telegram bot — with AI session notes and homework accountability built in.',
    badge: 'For Coaches',
    h1: 'PR-TOP for coaches — between-session engagement software',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    // Rule 1 — direct-answer block, 40-60 words, hedge-free
    intro:
      'PR-TOP is a between-session engagement platform for coaches. Clients keep a voice or text diary in Telegram, complete homework exercises, and send progress check-ins between sessions. Coaches get AI-drafted session notes, engagement streaks, and a full client timeline — all in one encrypted dashboard.',

    // Section 1 — What coaches get (Rule 7 wedge: diary + exercises + streaks + Telegram)
    getsTitle: 'What coaches get with PR-TOP',
    getsIntro:
      'Every coaching practice has the same gap: sessions are an hour; the client\'s week is 167 hours. PR-TOP fills that gap with a structured between-session layer that runs inside Telegram — no extra app for clients to download, no friction to get started.',
    getsItems: [
      {
        heading: 'Client diary via Telegram',
        body: 'Clients send voice notes, text entries, or short video messages directly to a dedicated Telegram bot. Each entry is time-stamped and encrypted, then surfaced on your dashboard so you arrive at every session with full context — not a blank slate.',
      },
      {
        heading: 'Homework and exercise library',
        body: 'Assign exercises from a pre-built multilingual library or create your own. Clients complete them inside Telegram and their responses appear in the client timeline. Completion streaks give you an at-a-glance accountability signal without a manual check-in call.',
      },
      {
        heading: 'AI-drafted session notes',
        body: 'Upload a session recording (audio or video, up to 100 MB) and PR-TOP transcribes it via Whisper and drafts a summary. You edit and save — total note time drops from 20 minutes to under five. Notes are encrypted and never leave your account.',
      },
      {
        heading: 'Progress check-ins and streaks',
        body: 'Automated between-session nudges keep clients engaged on the goals you set together. Streak counters and completion rates are visible on your dashboard, giving you concrete data to share during sessions and in renewal conversations.',
      },
      {
        heading: 'Encrypted dashboard',
        body: 'All client data — diary entries, session notes, exercise responses — is encrypted at the application layer. You control what the AI can see and what stays private. Export everything at any time; no lock-in.',
      },
    ],

    // Section 2 — The Telegram client experience (Rule 7 wedge: Telegram named explicitly)
    telegramTitle: 'The Telegram client experience',
    telegramIntro:
      'Most clients already use Telegram daily. PR-TOP meets them where they are instead of asking them to download yet another wellness app.',
    telegramSteps: [
      'You send your client an invite link or a Telegram deep link — takes about 30 seconds.',
      'They tap the link, start the bot, and immediately have a private diary channel and a homework feed.',
      'Diary entries, exercise responses, and progress check-ins flow into your dashboard in real time.',
      'You review their week in two minutes before the session starts — no pre-session prep call needed.',
    ],
    telegramNote:
      'The bot speaks English, Russian, Ukrainian, and Spanish — useful for coaches working with multilingual client rosters or international cohorts.',

    // Section 3 — ROI section
    roiTitle: 'The coaching ROI case',
    roiIntro:
      'Between-session engagement is one of the strongest predictors of client retention and referrals. Coaches who use PR-TOP report three concrete business outcomes:',
    roiItems: [
      {
        heading: 'Higher retention',
        body: 'Clients who complete between-session homework are significantly more likely to renew packages and refer peers. Completion streaks create visible momentum that motivates continued investment.',
      },
      {
        heading: 'Less session prep time',
        body: 'With a full diary timeline and AI-drafted notes from the previous session, prep drops from 20-30 minutes to under five. That is time you can redirect to revenue-generating work or simply reclaim.',
      },
      {
        heading: 'Premium positioning',
        body: 'A structured between-session experience — daily diary, personalised exercises, real-time check-ins — differentiates your practice from coaches who rely on email or WhatsApp follow-ups. It justifies premium pricing and reduces churn.',
      },
    ],

    // Section 4 — comparison table
    tableTitle: 'PR-TOP vs generic coaching tools (2026)',
    tableHead: { category: 'Category', crm: 'Generic coaching CRM / spreadsheets', prtop: 'PR-TOP' },
    tableRows: [
      {
        label: 'Category',
        c: 'CRM, spreadsheet, or task tracker repurposed for coaching',
        p: 'Purpose-built between-session engagement platform with Telegram bot',
      },
      {
        label: 'Pricing (from)',
        c: 'CoachAccountable from ~$20/mo; Practice.do from ~$29/mo; spreadsheets free',
        p: 'Free Trial, then €9/mo Basic, €19/mo Pro',
      },
      {
        label: 'Client diary',
        c: 'Not built-in; clients email or use a separate journaling app',
        p: 'Voice / text / video diary via Telegram, encrypted, real-time',
      },
      {
        label: 'Homework accountability',
        c: 'Manual — coach checks in by email or call',
        p: 'Automated streaks, completion rates visible on dashboard',
      },
      {
        label: 'Session notes / AI',
        c: 'Manual notes or separate transcription tool',
        p: 'AI-drafted notes from audio/video upload (Whisper + configurable AI)',
      },
      {
        label: 'Client-facing channel',
        c: 'Email, WhatsApp, or a separate client portal app',
        p: 'Telegram bot — no extra app, no login friction for clients',
      },
      {
        label: 'Exercise library',
        c: 'DIY — PDFs emailed or linked in a client portal',
        p: 'Pre-built multilingual library + custom exercises, assigned in-bot',
      },
      {
        label: 'Streaks / progress data',
        c: 'Not available; manual tracking in spreadsheet',
        p: 'Built-in streak counters and completion timelines per client',
      },
      {
        label: 'Data privacy',
        c: 'Varies; most tools store data in the US with no DPA',
        p: 'EU-hosted (Hetzner), application-layer encryption, DPA included',
      },
      {
        label: 'Languages',
        c: 'Usually English only',
        p: 'English, Russian, Ukrainian, Spanish',
      },
      {
        label: 'Where it wins',
        c: 'Familiarity, scheduling/billing features, integrations with Calendly/Stripe',
        p: 'Between-session depth, Telegram engagement, AI notes, streaks, multilingual',
      },
      {
        label: 'Where it loses',
        c: 'No between-session diary; no AI notes; weak accountability data',
        p: 'No built-in scheduling or billing; no calendar integrations yet',
      },
      {
        label: 'Best for',
        c: 'Coaches who need a scheduling + billing hub and handle engagement manually',
        p: 'Coaches whose main pain point is client engagement and retention between sessions',
      },
    ],
    tableNote:
      'CoachAccountable and Practice.do pricing verified from their respective websites in July 2026. Numbers refresh quarterly.',

    // Section 5 — FAQ
    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'Can I use PR-TOP if I am not a therapist?',
        a: 'Yes. PR-TOP is designed for any professional who works with clients in recurring sessions: life coaches, business coaches, executive coaches, career coaches, and wellness coaches all use it. There is no requirement to have a clinical background. The platform does not use any clinical documentation formats or require any medical registration.',
      },
      {
        q: 'How does the Telegram bot work for clients?',
        a: 'You generate an invite link from your PR-TOP dashboard and send it to your client by email, WhatsApp, or any other channel. The client taps the link, which opens Telegram and connects them to a dedicated bot for your practice. From that point they can send diary entries (voice, text, or video), receive and complete exercises, and submit progress check-ins — all without downloading any new app, since most clients already have Telegram.',
      },
      {
        q: 'How does PR-TOP pricing compare to other coaching software?',
        a: 'PR-TOP starts with a free Trial tier that includes the encrypted dashboard, Telegram bot, diary, exercises, and AI session notes for a limited number of clients — no credit card required. Paid plans start at €9/mo (Basic) and €19/mo (Pro). Dedicated coaching CRMs like CoachAccountable start at around $20/mo and Practice.do at around $29/mo, but neither includes a client diary channel, AI session notes, or between-session streaks.',
      },
      {
        q: 'What happens to my clients\' data?',
        a: 'All client diary entries, session notes, and exercise responses are encrypted at the application layer before being written to the database — so even a database breach exposes no readable content. Data is hosted on EU servers (Hetzner) and you can export or delete any client\'s data at any time. A Data Processing Addendum is included by default with all paid plans.',
      },
      {
        q: 'Does PR-TOP replace my existing scheduling or billing tool?',
        a: 'No. PR-TOP is focused on the between-session engagement layer: diary, exercises, AI notes, and streaks. It does not currently include built-in scheduling or billing. Most coaches run PR-TOP alongside their existing calendar tool (Calendly, Acuity) and payment processor (Stripe, PayPal) without any conflict.',
      },
      {
        q: 'How quickly can I get a client set up on the Telegram bot?',
        a: 'Setup takes under two minutes. From your dashboard you copy an invite link and send it to your client. They click, the bot activates in Telegram, and they can start submitting diary entries immediately. No client account creation, no password, no separate app download needed.',
      },
    ],

    // CTA
    ctaTitle: 'Start building your between-session engagement layer',
    ctaText:
      'The free Trial takes about ten minutes to set up. No credit card. You can invite your first client and see their diary entries on your dashboard the same day.',
    ctaButton: 'Start free trial',
    ctaAiNotes: 'How AI session notes work',
    ctaBestAi: 'Best AI tools for coaches',
    footer: 'PR-TOP. All rights reserved.',

    // Internal link labels
    linkAiNotes: 'AI session notes for coaches',
    linkBestAi: 'best AI assistant tools',
    linkCompareUpheal: 'PR-TOP vs Upheal',
    linkCompareMentalyc: 'PR-TOP vs Mentalyc',
  },

  ru: {
    seoTitle: 'PR-TOP для коучей — платформа для работы между сессиями',
    seoDescription:
      'PR-TOP даёт коучам профессиональный инструмент вовлечения клиентов между сессиями через Telegram: дневник, домашние задания, стрики. Начните бесплатно.',
    articleHeadline: 'PR-TOP для коучей — платформа вовлечения между сессиями (2026)',
    articleDescription:
      'Как PR-TOP помогает коучам удерживать клиентов, сокращать время подготовки к сессиям и обеспечивать премиальную поддержку между сессиями через Telegram-бот с AI-заметками и контролем домашних заданий.',
    badge: 'Для коучей',
    h1: 'PR-TOP для коучей — платформа вовлечения между сессиями',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',
    intro:
      'PR-TOP — платформа для работы между сессиями для коучей. Клиенты ведут голосовой или текстовый дневник в Telegram, выполняют домашние задания и отправляют отчёты о прогрессе между встречами. Коучи получают AI-заметки сессий, стрики вовлечённости и полную временну́ю шкалу клиента в одном зашифрованном кабинете.',
    getsTitle: 'Что получает коуч с PR-TOP',
    getsIntro:
      'У каждой коучинговой практики одна и та же проблема: сессия длится час, а неделя клиента — 167 часов. PR-TOP заполняет этот разрыв структурированным слоем между сессиями, который работает прямо в Telegram — без дополнительных приложений для клиента, без барьеров для старта.',
    getsItems: [
      {
        heading: 'Дневник клиента в Telegram',
        body: 'Клиенты отправляют голосовые, текстовые или короткие видео-сообщения в специальный Telegram-бот. Каждая запись имеет временну́ю метку и шифруется, затем отображается в вашем кабинете — вы приходите на каждую сессию с полным контекстом, а не с чистого листа.',
      },
      {
        heading: 'Домашние задания и библиотека упражнений',
        body: 'Назначайте упражнения из готовой мультиязычной библиотеки или создавайте собственные. Клиенты выполняют их в Telegram, а их ответы появляются в хронологии клиента. Стрики выполнения дают вам сигнал об ответственности клиента без дополнительных звонков.',
      },
      {
        heading: 'AI-заметки сессий',
        body: 'Загрузите запись сессии (аудио или видео, до 100 МБ) — PR-TOP транскрибирует её через Whisper и формирует краткое содержание. Вы редактируете и сохраняете: время на заметки сокращается с 20 минут до 5. Заметки зашифрованы и не покидают ваш аккаунт.',
      },
      {
        heading: 'Отчёты о прогрессе и стрики',
        body: 'Автоматические напоминания между сессиями удерживают клиентов вовлечёнными в достижение поставленных целей. Счётчики стриков и показатели выполнения видны на дашборде — это конкретные данные для разговора на сессии и при продлении пакета.',
      },
      {
        heading: 'Зашифрованный кабинет',
        body: 'Все данные клиента — записи дневника, заметки сессий, ответы на упражнения — шифруются на уровне приложения. Вы контролируете, что видит AI. Экспортируйте всё в любой момент без привязки к платформе.',
      },
    ],
    telegramTitle: 'Опыт клиента в Telegram',
    telegramIntro:
      'Большинство клиентов уже используют Telegram каждый день. PR-TOP встречает их там, где они есть, вместо того чтобы просить скачать ещё одно приложение.',
    telegramSteps: [
      'Вы отправляете клиенту инвайт-ссылку или Telegram deep link — занимает около 30 секунд.',
      'Клиент нажимает ссылку, запускает бот и сразу получает личный дневник и ленту домашних заданий.',
      'Записи дневника, ответы на упражнения и отчёты о прогрессе поступают на ваш дашборд в реальном времени.',
      'Вы просматриваете неделю клиента за две минуты перед сессией — звонок для подготовки не нужен.',
    ],
    telegramNote:
      'Бот работает на английском, русском, украинском и испанском языках — удобно для коучей с мультиязычной аудиторией или международными когортами.',
    roiTitle: 'ROI для коучинговой практики',
    roiIntro:
      'Вовлечённость между сессиями — один из главных предикторов удержания клиентов и рекомендаций. Коучи, использующие PR-TOP, отмечают три конкретных бизнес-результата:',
    roiItems: [
      {
        heading: 'Выше удержание',
        body: 'Клиенты, выполняющие домашние задания между сессиями, значительно чаще продлевают пакеты и рекомендуют вас знакомым. Стрики создают видимый импульс, который мотивирует продолжать вкладываться.',
      },
      {
        heading: 'Меньше времени на подготовку',
        body: 'С полной хронологией дневника и AI-заметками с предыдущей сессии подготовка сокращается с 20–30 минут до 5. Это время можно направить на более прибыльную работу или просто вернуть себе.',
      },
      {
        heading: 'Премиальное позиционирование',
        body: 'Структурированная работа между сессиями — ежедневный дневник, персональные упражнения, отчёты в реальном времени — выделяет вашу практику среди коучей, которые ограничиваются email-письмами или WhatsApp. Это обосновывает премиальные цены и снижает отток.',
      },
    ],
    tableTitle: 'PR-TOP против типичных коучинговых инструментов (2026)',
    tableHead: { category: 'Категория', crm: 'Типичный CRM для коучей / таблицы', prtop: 'PR-TOP' },
    tableRows: [
      {
        label: 'Категория',
        c: 'CRM, таблица или трекер задач, адаптированный для коучинга',
        p: 'Специализированная платформа вовлечения между сессиями с Telegram-ботом',
      },
      {
        label: 'Цена (от)',
        c: 'CoachAccountable от ~$20/мес; Practice.do от ~$29/мес; таблицы бесплатно',
        p: 'Бесплатный Trial, далее €9/мес Basic, €19/мес Pro',
      },
      {
        label: 'Дневник клиента',
        c: 'Не встроен; клиенты пишут на почту или используют отдельное приложение',
        p: 'Голосовой / текстовый / видео-дневник в Telegram, с шифрованием, в реальном времени',
      },
      {
        label: 'Контроль домашних заданий',
        c: 'Ручной — коуч проверяет по email или звонку',
        p: 'Автоматические стрики, показатели выполнения видны на дашборде',
      },
      {
        label: 'Заметки сессий / AI',
        c: 'Ручные заметки или отдельный инструмент транскрипции',
        p: 'AI-заметки из аудио/видео-загрузки (Whisper + настраиваемый AI)',
      },
      {
        label: 'Канал для клиента',
        c: 'Email, WhatsApp или отдельный клиентский портал',
        p: 'Telegram-бот — никаких новых приложений, без барьеров входа для клиентов',
      },
      {
        label: 'Библиотека упражнений',
        c: 'Самодельная — PDF по почте или ссылки в клиентском портале',
        p: 'Готовая мультиязычная библиотека + кастомные упражнения, назначаются в боте',
      },
      {
        label: 'Стрики / данные прогресса',
        c: 'Не предусмотрено; ручное отслеживание в таблице',
        p: 'Встроенные счётчики стриков и хронология выполнения по каждому клиенту',
      },
      {
        label: 'Конфиденциальность данных',
        c: 'Варьируется; большинство инструментов хранят данные в США без DPA',
        p: 'Хостинг в ЕС (Hetzner), шифрование на уровне приложения, DPA включён',
      },
      {
        label: 'Языки',
        c: 'Обычно только английский',
        p: 'Английский, русский, украинский, испанский',
      },
      {
        label: 'Где выигрывает',
        c: 'Знакомый интерфейс, функции расписания/биллинга, интеграции с Calendly/Stripe',
        p: 'Глубина работы между сессиями, вовлечение через Telegram, AI-заметки, стрики, мультиязычность',
      },
      {
        label: 'Где проигрывает',
        c: 'Нет дневника между сессиями; нет AI-заметок; слабые данные об ответственности',
        p: 'Нет встроенного расписания или биллинга; нет интеграций с календарём',
      },
      {
        label: 'Кому подходит',
        c: 'Коучам, которым нужен хаб для расписания + биллинга, а вовлечение они ведут вручную',
        p: 'Коучам, чья главная боль — вовлечённость и удержание клиентов между сессиями',
      },
    ],
    tableNote:
      'Цены CoachAccountable и Practice.do сверены с их сайтами в июле 2026 года. Данные обновляются ежеквартально.',
    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'Можно ли использовать PR-TOP без медицинского образования?',
        a: 'Да. PR-TOP создан для любого специалиста, который работает с клиентами в регулярном формате: лайф-коучи, бизнес-коучи, карьерные коучи, велнес-специалисты. Платформа не требует клинической лицензии и не использует медицинских форматов документации.',
      },
      {
        q: 'Как работает Telegram-бот для клиентов?',
        a: 'Вы генерируете инвайт-ссылку в кабинете PR-TOP и отправляете её клиенту любым способом — по email, в WhatsApp и т. д. Клиент нажимает ссылку, она открывает Telegram и подключает его к боту вашей практики. Далее клиент может отправлять записи дневника (голос, текст, видео), выполнять упражнения и отправлять отчёты о прогрессе — без скачивания нового приложения.',
      },
      {
        q: 'Как цены PR-TOP соотносятся с другими коучинговыми инструментами?',
        a: 'PR-TOP начинается с бесплатного тарифа Trial: зашифрованный кабинет, Telegram-бот, дневник, упражнения и AI-заметки сессий для ограниченного числа клиентов — без банковской карты. Платные тарифы — от €9/мес (Basic) и €19/мес (Pro). CoachAccountable стоит от $20/мес, Practice.do — от $29/мес, но ни один из них не включает канал для дневника клиента, AI-заметки или стрики.',
      },
      {
        q: 'Что происходит с данными моих клиентов?',
        a: 'Все записи дневника, заметки сессий и ответы на упражнения шифруются на уровне приложения до записи в базу данных — даже при утечке базы читаемый контент недоступен. Данные хранятся на серверах в ЕС (Hetzner), вы можете экспортировать или удалить данные любого клиента в любой момент. DPA включён по умолчанию во все платные тарифы.',
      },
      {
        q: 'Заменяет ли PR-TOP мой инструмент для расписания или оплаты?',
        a: 'Нет. PR-TOP сфокусирован на слое вовлечения между сессиями: дневник, упражнения, AI-заметки, стрики. Встроенного расписания и биллинга пока нет. Большинство коучей используют PR-TOP параллельно с Calendly или Acuity и своим платёжным сервисом без каких-либо конфликтов.',
      },
      {
        q: 'Как быстро можно подключить клиента к боту?',
        a: 'Менее двух минут. Вы копируете инвайт-ссылку из кабинета и отправляете клиенту. Он нажимает, бот активируется в Telegram, и клиент сразу может начать вести дневник. Регистрация аккаунта, пароль и скачивание приложения не требуются.',
      },
    ],
    ctaTitle: 'Начните строить слой вовлечения между сессиями',
    ctaText:
      'Бесплатный Trial настраивается примерно за десять минут. Без банковской карты. Вы можете пригласить первого клиента и увидеть его записи на дашборде в тот же день.',
    ctaButton: 'Начать бесплатно',
    ctaAiNotes: 'Как работают AI-заметки сессий',
    ctaBestAi: 'Лучшие AI-инструменты для коучей',
    footer: 'PR-TOP. Все права защищены.',
    linkAiNotes: 'AI-заметки сессий для коучей',
    linkBestAi: 'лучшие AI-ассистенты',
    linkCompareUpheal: 'PR-TOP против Upheal',
    linkCompareMentalyc: 'PR-TOP против Mentalyc',
  },

  uk: {
    seoTitle: 'PR-TOP для коучів — платформа залучення між сесіями',
    seoDescription:
      'PR-TOP дає коучам професійний інструмент залучення клієнтів між сесіями через Telegram: щоденник, домашні завдання, стрики. Почніть безкоштовно.',
    articleHeadline: 'PR-TOP для коучів — платформа залучення між сесіями (2026)',
    articleDescription:
      'Як PR-TOP допомагає коучам утримувати клієнтів, скорочувати час підготовки до сесій і забезпечувати преміальну підтримку між сесіями через Telegram-бот з AI-нотатками та контролем домашніх завдань.',
    badge: 'Для коучів',
    h1: 'PR-TOP для коучів — платформа залучення між сесіями',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',
    intro:
      'PR-TOP — платформа для роботи між сесіями для коучів. Клієнти ведуть голосовий або текстовий щоденник у Telegram, виконують домашні завдання й надсилають звіти про прогрес між зустрічами. Коучі отримують AI-нотатки сесій, стрики залученості та повну часову шкалу клієнта в одному зашифрованому кабінеті.',
    getsTitle: 'Що отримує коуч з PR-TOP',
    getsIntro:
      'У кожній коучинговій практиці одна й та сама проблема: сесія триває годину, а тиждень клієнта — 167 годин. PR-TOP заповнює цей розрив структурованим шаром між сесіями, який працює прямо в Telegram — без додаткових застосунків для клієнта, без бар\'єрів для старту.',
    getsItems: [
      {
        heading: 'Щоденник клієнта у Telegram',
        body: 'Клієнти надсилають голосові, текстові або короткі відео-повідомлення до спеціального Telegram-бота. Кожен запис має часову мітку й шифрується, потім відображається у вашому кабінеті — ви приходите на кожну сесію з повним контекстом, а не з чистого аркуша.',
      },
      {
        heading: 'Домашні завдання та бібліотека вправ',
        body: 'Призначайте вправи з готової мультимовної бібліотеки або створюйте власні. Клієнти виконують їх у Telegram, а їхні відповіді з\'являються в хронології клієнта. Стрики виконання дають вам сигнал про відповідальність клієнта без додаткових дзвінків.',
      },
      {
        heading: 'AI-нотатки сесій',
        body: 'Завантажте запис сесії (аудіо або відео, до 100 МБ) — PR-TOP транскрибує її через Whisper та формує короткий зміст. Ви редагуєте і зберігаєте: час на нотатки скорочується з 20 хвилин до 5. Нотатки зашифровані й не залишають ваш акаунт.',
      },
      {
        heading: 'Звіти про прогрес і стрики',
        body: 'Автоматичні нагадування між сесіями утримують клієнтів залученими до досягнення спільно встановлених цілей. Лічильники стриків і показники виконання видно на дашборді — це конкретні дані для розмови на сесії та при продовженні пакету.',
      },
      {
        heading: 'Зашифрований кабінет',
        body: 'Усі дані клієнта — записи щоденника, нотатки сесій, відповіді на вправи — шифруються на рівні застосунку. Ви контролюєте, що бачить AI. Експортуйте все будь-коли без прив\'язки до платформи.',
      },
    ],
    telegramTitle: 'Досвід клієнта у Telegram',
    telegramIntro:
      'Більшість клієнтів уже використовують Telegram щодня. PR-TOP зустрічає їх там, де вони є, замість того щоб просити завантажити ще один застосунок.',
    telegramSteps: [
      'Ви надсилаєте клієнту інвайт-посилання або Telegram deep link — займає близько 30 секунд.',
      'Клієнт натискає посилання, запускає бота і одразу отримує особистий щоденник та стрічку домашніх завдань.',
      'Записи щоденника, відповіді на вправи та звіти про прогрес надходять на ваш дашборд у реальному часі.',
      'Ви переглядаєте тиждень клієнта за дві хвилини перед сесією — підготовчий дзвінок не потрібен.',
    ],
    telegramNote:
      'Бот працює англійською, російською, українською та іспанською мовами — зручно для коучів із багатомовною аудиторією або міжнародними когортами.',
    roiTitle: 'ROI для коучингової практики',
    roiIntro:
      'Залученість між сесіями — один з головних предикторів утримання клієнтів і рекомендацій. Коучі, які використовують PR-TOP, відзначають три конкретні бізнес-результати:',
    roiItems: [
      {
        heading: 'Вище утримання',
        body: 'Клієнти, які виконують домашні завдання між сесіями, значно частіше продовжують пакети та рекомендують вас знайомим. Стрики створюють видимий імпульс, який мотивує продовжувати вкладатися.',
      },
      {
        heading: 'Менше часу на підготовку',
        body: 'З повною хронологією щоденника та AI-нотатками з попередньої сесії підготовка скорочується з 20–30 хвилин до 5. Цей час можна направити на більш прибуткову роботу або просто повернути собі.',
      },
      {
        heading: 'Преміальне позиціонування',
        body: 'Структурована робота між сесіями — щоденний щоденник, персональні вправи, звіти в реальному часі — виділяє вашу практику серед коучів, які обмежуються листами або WhatsApp. Це обґрунтовує преміальні ціни та знижує відтік.',
      },
    ],
    tableTitle: 'PR-TOP проти типових коучингових інструментів (2026)',
    tableHead: { category: 'Категорія', crm: 'Типовий CRM для коучів / таблиці', prtop: 'PR-TOP' },
    tableRows: [
      {
        label: 'Категорія',
        c: 'CRM, таблиця або трекер задач, адаптований для коучингу',
        p: 'Спеціалізована платформа залучення між сесіями з Telegram-ботом',
      },
      {
        label: 'Ціна (від)',
        c: 'CoachAccountable від ~$20/міс; Practice.do від ~$29/міс; таблиці безкоштовно',
        p: 'Безкоштовний Trial, далі €9/міс Basic, €19/міс Pro',
      },
      {
        label: 'Щоденник клієнта',
        c: 'Не вбудований; клієнти пишуть на пошту або використовують окремий застосунок',
        p: 'Голосовий / текстовий / відео-щоденник у Telegram, із шифруванням, у реальному часі',
      },
      {
        label: 'Контроль домашніх завдань',
        c: 'Ручний — коуч перевіряє по email або дзвінку',
        p: 'Автоматичні стрики, показники виконання видно на дашборді',
      },
      {
        label: 'Нотатки сесій / AI',
        c: 'Ручні нотатки або окремий інструмент транскрипції',
        p: 'AI-нотатки з аудіо/відео-завантаження (Whisper + налаштовуваний AI)',
      },
      {
        label: 'Канал для клієнта',
        c: 'Email, WhatsApp або окремий клієнтський портал',
        p: 'Telegram-бот — жодних нових застосунків, без бар\'єрів входу для клієнтів',
      },
      {
        label: 'Бібліотека вправ',
        c: 'Саморобна — PDF поштою або посилання у клієнтському порталі',
        p: 'Готова мультимовна бібліотека + кастомні вправи, призначаються в боті',
      },
      {
        label: 'Стрики / дані прогресу',
        c: 'Не передбачено; ручне відстеження в таблиці',
        p: 'Вбудовані лічильники стриків і хронологія виконання по кожному клієнту',
      },
      {
        label: 'Конфіденційність даних',
        c: 'Варіюється; більшість інструментів зберігають дані в США без DPA',
        p: 'Хостинг у ЄС (Hetzner), шифрування на рівні застосунку, DPA включений',
      },
      {
        label: 'Мови',
        c: 'Зазвичай лише англійська',
        p: 'Англійська, російська, українська, іспанська',
      },
      {
        label: 'Де виграє',
        c: 'Знайомий інтерфейс, функції розкладу/білінгу, інтеграції з Calendly/Stripe',
        p: 'Глибина роботи між сесіями, залучення через Telegram, AI-нотатки, стрики, мультимовність',
      },
      {
        label: 'Де програє',
        c: 'Немає щоденника між сесіями; немає AI-нотаток; слабкі дані про відповідальність',
        p: 'Немає вбудованого розкладу або білінгу; немає інтеграцій з календарем',
      },
      {
        label: 'Кому підходить',
        c: 'Коучам, яким потрібен хаб для розкладу + білінгу, а залучення вони ведуть вручну',
        p: 'Коучам, чий головний біль — залученість і утримання клієнтів між сесіями',
      },
    ],
    tableNote:
      'Ціни CoachAccountable і Practice.do звірено з їхніми сайтами у липні 2026 року. Дані оновлюються щокварталу.',
    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'Чи можна використовувати PR-TOP без медичної освіти?',
        a: 'Так. PR-TOP створений для будь-якого фахівця, який працює з клієнтами у регулярному форматі: лайф-коучі, бізнес-коучі, кар\'єрні коучі, велнес-спеціалісти. Платформа не потребує клінічної ліцензії та не використовує медичних форматів документації.',
      },
      {
        q: 'Як працює Telegram-бот для клієнтів?',
        a: 'Ви генеруєте інвайт-посилання в кабінеті PR-TOP і надсилаєте його клієнту будь-яким способом — по email, у WhatsApp тощо. Клієнт натискає посилання, воно відкриває Telegram і підключає його до бота вашої практики. Далі клієнт може надсилати записи щоденника (голос, текст, відео), виконувати вправи та надсилати звіти про прогрес — без завантаження нового застосунку.',
      },
      {
        q: 'Як ціни PR-TOP співвідносяться з іншими коучинговими інструментами?',
        a: 'PR-TOP починається з безкоштовного тарифу Trial: зашифрований кабінет, Telegram-бот, щоденник, вправи та AI-нотатки сесій для обмеженої кількості клієнтів — без банківської картки. Платні тарифи — від €9/міс (Basic) і €19/міс (Pro). CoachAccountable коштує від $20/міс, Practice.do — від $29/міс, але жоден з них не включає канал для щоденника клієнта, AI-нотатки або стрики.',
      },
      {
        q: 'Що відбувається з даними моїх клієнтів?',
        a: 'Усі записи щоденника, нотатки сесій і відповіді на вправи шифруються на рівні застосунку до запису в базу даних — навіть при витоку бази читабельний контент недоступний. Дані зберігаються на серверах у ЄС (Hetzner), ви можете експортувати або видалити дані будь-якого клієнта будь-коли. DPA включений за замовчуванням у всі платні тарифи.',
      },
      {
        q: 'Чи замінює PR-TOP мій інструмент для розкладу або оплати?',
        a: 'Ні. PR-TOP сфокусований на шарі залучення між сесіями: щоденник, вправи, AI-нотатки, стрики. Вбудованого розкладу та білінгу поки немає. Більшість коучів використовують PR-TOP паралельно з Calendly або Acuity і своїм платіжним сервісом без жодних конфліктів.',
      },
      {
        q: 'Як швидко можна підключити клієнта до бота?',
        a: 'Менше двох хвилин. Ви копіюєте інвайт-посилання з кабінету і надсилаєте клієнту. Він натискає, бот активується в Telegram, і клієнт одразу може почати вести щоденник. Реєстрація акаунту, пароль і завантаження застосунку не потрібні.',
      },
    ],
    ctaTitle: 'Починайте будувати шар залучення між сесіями',
    ctaText:
      'Безкоштовний Trial налаштовується приблизно за десять хвилин. Без банківської картки. Ви можете запросити першого клієнта й побачити його записи на дашборді того ж дня.',
    ctaButton: 'Почати безкоштовно',
    ctaAiNotes: 'Як працюють AI-нотатки сесій',
    ctaBestAi: 'Найкращі AI-інструменти для коучів',
    footer: 'PR-TOP. Усі права захищено.',
    linkAiNotes: 'AI-нотатки сесій для коучів',
    linkBestAi: 'найкращі AI-асистенти',
    linkCompareUpheal: 'PR-TOP проти Upheal',
    linkCompareMentalyc: 'PR-TOP проти Mentalyc',
  },

  es: {
    seoTitle: 'PR-TOP para coaches — software de engagement entre sesiones',
    seoDescription:
      'PR-TOP da a los coaches una capa profesional de engagement con clientes entre sesiones vía Telegram: diario, tareas, rachas de progreso. Empieza gratis.',
    articleHeadline: 'PR-TOP para coaches — software de engagement entre sesiones (2026)',
    articleDescription:
      'Cómo PR-TOP ayuda a los coaches a retener más clientes, reducir el tiempo de preparación de sesiones y ofrecer una experiencia premium entre sesiones vía bot de Telegram con notas de sesión con IA y seguimiento de tareas.',
    badge: 'Para coaches',
    h1: 'PR-TOP para coaches — software de engagement entre sesiones',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',
    intro:
      'PR-TOP es una plataforma de engagement entre sesiones para coaches. Los clientes llevan un diario de voz o texto en Telegram, completan ejercicios de tarea y envían check-ins de progreso entre sesiones. Los coaches reciben notas de sesión generadas por IA, rachas de engagement y una línea de tiempo completa del cliente — todo en un panel cifrado.',
    getsTitle: 'Qué obtienen los coaches con PR-TOP',
    getsIntro:
      'Toda práctica de coaching tiene el mismo hueco: una sesión dura una hora; la semana del cliente son 167 horas. PR-TOP llena ese hueco con una capa estructurada entre sesiones que funciona dentro de Telegram — sin apps extra para que descarguen los clientes, sin fricción para empezar.',
    getsItems: [
      {
        heading: 'Diario del cliente vía Telegram',
        body: 'Los clientes envían notas de voz, entradas de texto o vídeos cortos directamente a un bot de Telegram dedicado. Cada entrada tiene marca de tiempo y se cifra, y luego aparece en su panel para que llegue a cada sesión con contexto completo, sin partir de cero.',
      },
      {
        heading: 'Tareas y biblioteca de ejercicios',
        body: 'Asigne ejercicios de una biblioteca multilingüe prefabricada o cree los suyos propios. Los clientes los completan dentro de Telegram y sus respuestas aparecen en la línea de tiempo del cliente. Las rachas de completado le dan una señal de rendición de cuentas de un vistazo, sin necesidad de llamadas adicionales.',
      },
      {
        heading: 'Notas de sesión con IA',
        body: 'Suba una grabación de sesión (audio o vídeo, hasta 100 MB) y PR-TOP la transcribe con Whisper y genera un resumen. Usted edita y guarda — el tiempo de toma de notas baja de 20 minutos a menos de cinco. Las notas están cifradas y nunca salen de su cuenta.',
      },
      {
        heading: 'Check-ins de progreso y rachas',
        body: 'Los recordatorios automatizados entre sesiones mantienen a los clientes comprometidos con los objetivos que fijaron juntos. Los contadores de rachas y las tasas de completado son visibles en su panel, lo que le da datos concretos para compartir durante las sesiones y en las conversaciones de renovación.',
      },
      {
        heading: 'Panel cifrado',
        body: 'Todos los datos del cliente — entradas de diario, notas de sesión, respuestas a ejercicios — se cifran en la capa de aplicación. Usted controla qué puede ver la IA y qué permanece privado. Exporte todo en cualquier momento; sin lock-in.',
      },
    ],
    telegramTitle: 'La experiencia del cliente en Telegram',
    telegramIntro:
      'La mayoría de los clientes ya usan Telegram a diario. PR-TOP les encuentra donde están en lugar de pedirles que descarguen otra app de bienestar.',
    telegramSteps: [
      'Usted envía al cliente un enlace de invitación o un deep link de Telegram — tarda unos 30 segundos.',
      'El cliente toca el enlace, inicia el bot y de inmediato tiene un canal de diario privado y un feed de tareas.',
      'Las entradas del diario, las respuestas a ejercicios y los check-ins de progreso llegan a su panel en tiempo real.',
      'Usted revisa la semana del cliente en dos minutos antes de que empiece la sesión — sin llamada de preparación previa.',
    ],
    telegramNote:
      'El bot habla inglés, ruso, ucraniano y español — útil para coaches con listas de clientes multilingües o cohortes internacionales.',
    roiTitle: 'El caso de ROI para la práctica de coaching',
    roiIntro:
      'El engagement entre sesiones es uno de los mejores predictores de la retención de clientes y las referencias. Los coaches que usan PR-TOP reportan tres resultados de negocio concretos:',
    roiItems: [
      {
        heading: 'Mayor retención',
        body: 'Los clientes que completan tareas entre sesiones tienen muchas más probabilidades de renovar paquetes y recomendar a compañeros. Las rachas de completado crean un impulso visible que motiva a seguir invirtiendo.',
      },
      {
        heading: 'Menos tiempo de preparación',
        body: 'Con una línea de tiempo completa del diario y las notas de sesión anteriores generadas por IA, la preparación baja de 20-30 minutos a menos de cinco. Es tiempo que puede redirigir a trabajo que genera ingresos o simplemente recuperar.',
      },
      {
        heading: 'Posicionamiento premium',
        body: 'Una experiencia estructurada entre sesiones — diario diario, ejercicios personalizados, check-ins en tiempo real — diferencia su práctica de los coaches que dependen de correos electrónicos o seguimientos por WhatsApp. Justifica precios premium y reduce la tasa de abandono.',
      },
    ],
    tableTitle: 'PR-TOP vs herramientas de coaching genéricas (2026)',
    tableHead: { category: 'Categoría', crm: 'CRM de coaching genérico / hojas de cálculo', prtop: 'PR-TOP' },
    tableRows: [
      {
        label: 'Categoría',
        c: 'CRM, hoja de cálculo o gestor de tareas adaptado para el coaching',
        p: 'Plataforma de engagement entre sesiones con bot de Telegram específicamente diseñada',
      },
      {
        label: 'Precio (desde)',
        c: 'CoachAccountable desde ~$20/mes; Practice.do desde ~$29/mes; hojas de cálculo gratis',
        p: 'Trial gratuito, luego €9/mes Basic, €19/mes Pro',
      },
      {
        label: 'Diario del cliente',
        c: 'No integrado; los clientes escriben por correo o usan una app de journaling aparte',
        p: 'Diario de voz / texto / vídeo vía Telegram, cifrado, en tiempo real',
      },
      {
        label: 'Responsabilidad de tareas',
        c: 'Manual — el coach hace seguimiento por correo o llamada',
        p: 'Rachas automáticas, tasas de completado visibles en el panel',
      },
      {
        label: 'Notas de sesión / IA',
        c: 'Notas manuales o herramienta de transcripción separada',
        p: 'Notas con IA a partir de audio/vídeo subido (Whisper + IA configurable)',
      },
      {
        label: 'Canal para clientes',
        c: 'Correo, WhatsApp o un portal de cliente separado',
        p: 'Bot de Telegram — sin app extra, sin fricción de acceso para los clientes',
      },
      {
        label: 'Biblioteca de ejercicios',
        c: 'Bricolaje — PDFs por correo o enlazados en un portal de cliente',
        p: 'Biblioteca multilingüe prefabricada + ejercicios propios, asignados dentro del bot',
      },
      {
        label: 'Rachas / datos de progreso',
        c: 'No disponible; seguimiento manual en hoja de cálculo',
        p: 'Contadores de rachas integrados y líneas de tiempo de completado por cliente',
      },
      {
        label: 'Privacidad de datos',
        c: 'Variable; la mayoría almacena datos en EE. UU. sin DPA',
        p: 'Alojado en la UE (Hetzner), cifrado en capa de aplicación, DPA incluido',
      },
      {
        label: 'Idiomas',
        c: 'Normalmente solo inglés',
        p: 'Inglés, ruso, ucraniano, español',
      },
      {
        label: 'Dónde gana',
        c: 'Familiaridad, funciones de agenda/facturación, integraciones con Calendly/Stripe',
        p: 'Profundidad entre sesiones, engagement en Telegram, notas con IA, rachas, multilingüe',
      },
      {
        label: 'Dónde pierde',
        c: 'Sin diario entre sesiones; sin notas con IA; datos de responsabilidad débiles',
        p: 'Sin agenda ni facturación integradas; sin integraciones de calendario aún',
      },
      {
        label: 'Ideal para',
        c: 'Coaches que necesitan un hub de agenda + facturación y gestionan el engagement manualmente',
        p: 'Coaches cuyo mayor problema es el engagement y la retención de clientes entre sesiones',
      },
    ],
    tableNote:
      'Precios de CoachAccountable y Practice.do verificados en sus respectivos sitios web en julio de 2026. Las cifras se actualizan trimestralmente.',
    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿Puedo usar PR-TOP si no soy terapeuta?',
        a: 'Sí. PR-TOP está diseñado para cualquier profesional que trabaje con clientes en sesiones recurrentes: coaches de vida, coaches de negocios, coaches ejecutivos, coaches de carrera y especialistas en bienestar. No se requiere formación clínica. La plataforma no utiliza formatos de documentación clínica ni requiere ningún tipo de registro médico.',
      },
      {
        q: '¿Cómo funciona el bot de Telegram para los clientes?',
        a: 'Usted genera un enlace de invitación desde su panel de PR-TOP y se lo envía al cliente por correo, WhatsApp o cualquier otro canal. El cliente toca el enlace, que abre Telegram y lo conecta al bot dedicado de su práctica. A partir de ese momento puede enviar entradas de diario (voz, texto o vídeo), recibir y completar ejercicios y enviar check-ins de progreso — sin descargar ninguna app nueva, ya que la mayoría de los clientes ya tienen Telegram.',
      },
      {
        q: '¿Cómo se compara el precio de PR-TOP con otro software de coaching?',
        a: 'PR-TOP comienza con un nivel Trial gratuito que incluye el panel cifrado, el bot de Telegram, el diario, los ejercicios y las notas de sesión con IA para un número limitado de clientes — sin tarjeta de crédito. Los planes de pago empiezan en €9/mes (Basic) y €19/mes (Pro). CoachAccountable empieza en unos $20/mes y Practice.do en unos $29/mes, pero ninguno incluye un canal de diario para clientes, notas de sesión con IA ni rachas de seguimiento.',
      },
      {
        q: '¿Qué sucede con los datos de mis clientes?',
        a: 'Todas las entradas del diario, las notas de sesión y las respuestas a ejercicios se cifran en la capa de aplicación antes de escribirse en la base de datos — por lo que incluso una brecha de la base de datos no expone contenido legible. Los datos están alojados en servidores de la UE (Hetzner) y usted puede exportar o eliminar los datos de cualquier cliente en cualquier momento. Se incluye un Addendum de Procesamiento de Datos por defecto en todos los planes de pago.',
      },
      {
        q: '¿PR-TOP reemplaza mi herramienta de agenda o facturación?',
        a: 'No. PR-TOP se centra en la capa de engagement entre sesiones: diario, ejercicios, notas con IA y rachas. Actualmente no incluye agenda ni facturación integradas. La mayoría de los coaches usan PR-TOP junto a su herramienta de calendario (Calendly, Acuity) y su procesador de pagos (Stripe, PayPal) sin ningún conflicto.',
      },
      {
        q: '¿Cuánto tarda en incorporar a un cliente al bot de Telegram?',
        a: 'Menos de dos minutos. Copia un enlace de invitación desde su panel y se lo envía al cliente. Este hace clic, el bot se activa en Telegram y el cliente puede empezar a enviar entradas de diario de inmediato. No se necesita crear una cuenta, no hay contraseña ni descarga de app.',
      },
    ],
    ctaTitle: 'Empiece a construir su capa de engagement entre sesiones',
    ctaText:
      'El Trial gratuito tarda unos diez minutos en configurarse. Sin tarjeta de crédito. Puede invitar a su primer cliente y ver sus entradas de diario en su panel el mismo día.',
    ctaButton: 'Empezar gratis',
    ctaAiNotes: 'Cómo funcionan las notas de sesión con IA',
    ctaBestAi: 'Las mejores herramientas de IA para coaches',
    footer: 'PR-TOP. Todos los derechos reservados.',
    linkAiNotes: 'notas de sesión con IA para coaches',
    linkBestAi: 'mejores asistentes de IA',
    linkCompareUpheal: 'PR-TOP vs Upheal',
    linkCompareMentalyc: 'PR-TOP vs Mentalyc',
  },
};

export default function ForCoaches() {
  const { i18n } = useTranslation();
  const lp = useLocalePath();
  const locale = ['ru', 'uk', 'es'].includes(i18n.language) ? i18n.language : 'en';
  const c = CONTENT[locale];
  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : `/${locale}`}/for-coaches`;

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
        path="/for-coaches"
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
          {/* Rule 5 — visible stamp */}
          <p className="text-sm text-gray-500">{c.stamp}</p>
        </header>

        {/* Rule 1 — direct-answer block, 40-60 words, hedge-free */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">{c.intro}</p>
        </div>

        {/* Rule 7 — wedge in first H2: diary + exercises + streaks + Telegram */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{c.getsTitle}</h2>
          <p className="text-gray-700 leading-relaxed mb-6">{c.getsIntro}</p>
          <div className="space-y-6">
            {c.getsItems.map((item) => (
              <div key={item.heading}>
                <h3 className="text-base font-semibold text-gray-900 mb-1">{item.heading}</h3>
                <p className="text-gray-700 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rule 7 — wedge in second H2: Telegram named explicitly */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{c.telegramTitle}</h2>
          <p className="text-gray-700 leading-relaxed mb-4">{c.telegramIntro}</p>
          <ol className="list-decimal pl-5 space-y-2 text-gray-700 leading-relaxed mb-4">
            {c.telegramSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="text-gray-600 text-sm italic">{c.telegramNote}</p>
        </section>

        {/* ROI section */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{c.roiTitle}</h2>
          <p className="text-gray-700 leading-relaxed mb-6">{c.roiIntro}</p>
          <div className="space-y-5">
            {c.roiItems.map((item) => (
              <div key={item.heading} className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                    {c.roiItems.indexOf(item) + 1}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{item.heading}</h3>
                  <p className="text-gray-700 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rule 3 — honest comparison table */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{c.tableTitle}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.category}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.crm}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.prtop}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.tableRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="p-3 border border-gray-200 font-medium">{row.label}</td>
                    <td className="p-3 border border-gray-200">{row.c}</td>
                    <td className="p-3 border border-gray-200">{row.p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">{c.tableNote}</p>
        </section>

        {/* Rule 6 — internal links to sibling pages */}
        <section className="mb-10 p-5 bg-gray-50 border border-gray-200 rounded-lg">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            {locale === 'ru' ? 'Материалы по теме' :
             locale === 'uk' ? 'Матеріали за темою' :
             locale === 'es' ? 'Recursos relacionados' :
             'Related resources'}
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to={lp('/best-ai-assistant-for-therapists')} className="text-primary underline hover:no-underline">
                {c.linkBestAi}
              </Link>
            </li>
            <li>
              <Link to={lp('/compare/upheal')} className="text-primary underline hover:no-underline">
                {c.linkCompareUpheal}
              </Link>
            </li>
            <li>
              <Link to={lp('/compare/mentalyc')} className="text-primary underline hover:no-underline">
                {c.linkCompareMentalyc}
              </Link>
            </li>
            <li>
              <Link to={lp('/')} className="text-primary underline hover:no-underline">
                {locale === 'ru' ? 'Главная страница PR-TOP' :
                 locale === 'uk' ? 'Головна сторінка PR-TOP' :
                 locale === 'es' ? 'Inicio — PR-TOP' :
                 'PR-TOP home'}
              </Link>
            </li>
          </ul>
        </section>

        {/* Rule 4 — FAQ block */}
        <section className="mb-10" id="faq">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{c.faqTitle}</h2>
          <div className="space-y-6">
            {c.faqItems.map((item) => (
              <div key={item.q}>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-700 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA bottom section */}
        <section className="mb-4 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{c.ctaTitle}</h2>
          <p className="text-gray-700 mb-4">{c.ctaText}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={lp('/')}
              className="inline-flex items-center px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {c.ctaButton}
            </Link>
            <Link
              to={lp('/compare/upheal')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.linkCompareUpheal}
            </Link>
            <Link
              to={lp('/best-ai-assistant-for-therapists')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaBestAi}
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
