import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /coaching-session-management  —  coaching feature guide + wedge page (EN/RU/UK/ES).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest product comparison table: PR-TOP vs CoachAccountable vs Practice Better vs Satori
 *   4. FAQ block + FAQPage JSON-LD (6 Q&As)
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + sibling pages: /for-coaches, /client-diary-for-therapists,
 *      /ai-practice-management
 *   7. PR-TOP wedge in first two H2 sections:
 *      diary (reframed as "client journal") + exercises (as "homework") +
 *      crisis alerts (as "urgent support requests") + Telegram all named
 *
 * CRITICAL: NO clinical/HIPAA/diagnosis/therapy vocabulary. Business outcomes only:
 * client retention, engagement between sessions, streaks, session prep, ROI.
 *
 * Page angle: Coaches need session management software that keeps clients engaged
 * between sessions without EHR complexity. PR-TOP's Telegram bot tracks homework,
 * streaks, and journal entries and gives the coach session prep context.
 *
 * Competitor data verified against:
 *   CoachAccountable: coachaccountable.com (from ~$20/mo)
 *   Practice Better: practicebetter.io (from ~$25/mo)
 *   Satori: satorihq.com (from ~$33/mo)
 * in July 2026.
 */

const CONTENT = {
  en: {
    seoTitle: 'Coaching session management software (2026) — PR-TOP for coaches',
    seoDescription:
      'Coaching session management with PR-TOP: Telegram client bot for homework tracking, between-session check-ins, streaks and session prep. Try free.',
    articleHeadline: 'Coaching session management software — PR-TOP for coaches',
    articleDescription:
      'Honest 2026 guide to coaching session management software: how CoachAccountable, Practice Better and Satori compare, and why PR-TOP\'s Telegram-native client bot keeps clients engaged between sessions without EHR complexity.',
    badge: 'For coaches',
    h1: 'Coaching session management software — PR-TOP for coaches',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    intro:
      'PR-TOP gives coaches a Telegram-native client bot that handles between-session check-ins, homework assignments, completion tracking, and streak data — all visible in a secure web dashboard before every call. No new app for clients. No EHR complexity. From €9/mo, less than the cost of one cancelled session.',

    whyBetweenTitle: 'Why between-session engagement drives coaching ROI',
    whyBetweenP1:
      'The value of a coaching engagement is rarely decided in the session itself. It is decided by what the client does — or does not do — in the days between calls. A client who completes their homework, tracks their progress, and feels accountable to the process is far more likely to renew, refer, and report results. The session is the conversation; the between-session period is where the work happens.',
    whyBetweenP2:
      'Most coaching session management platforms address scheduling, billing, and note-taking well. The gap is the between-session layer: real-time client check-ins, homework tracking, streaks, and the ability for a client to reach you quickly when they need support. PR-TOP was built around that gap.',
    whyBetweenP3:
      'Clients use Telegram — the messenger they already have on their phone. They send check-in entries (voice, text, or short video), complete homework assignments the coach sent them, and can trigger an urgent support request with a single tap if they need immediate attention. All of this arrives in your encrypted dashboard before the next session call. You walk into every call already prepared.',
    whyBetweenWedge:
      'The four things that make the difference between sessions: a client journal your clients actually use (because it lives in Telegram, not a new app), homework assignments they can complete without friction, urgent support requests for moments that can\'t wait, and streak data that shows you — and them — how consistent they\'ve been.',

    howPrtopTitle: 'How PR-TOP handles coaching session management',
    howPrtopP1:
      'Before the session call, you open the client\'s dashboard page and see everything since the last session: journal entries (voice, text, video), homework completion status, and any urgent support requests. You did not have to chase the client for an update. The context is already there, timestamped and searchable.',
    howPrtopP2:
      'During the session, you take notes directly in the dashboard. After the session, you assign the next round of homework through the dashboard — one click, and the client\'s Telegram bot delivers it instantly. You can attach instructions, set a deadline, and track whether it was marked complete before the next call.',
    howPrtopP3:
      'Between sessions, the client\'s Telegram bot keeps them engaged: daily or weekly check-in prompts, homework reminders, streak counters, and the ability to send a voice or text entry any time. You receive a notification for urgent support requests. Everything is encrypted and stored in the same place, not scattered across a notes app, a messaging thread, and a separate scheduling tool.',
    howPrtopLead: 'See also: ',
    howPrtopLinkCoaches: 'PR-TOP for coaches',
    howPrtopAnd: ' and ',
    howPrtopLinkPractice: 'AI practice management',
    howPrtopTail: '.',

    tableTitle: 'Coaching session management tools compared (2026)',
    tableHead: {
      category: 'Tool',
      pricing: 'Pricing',
      wins: 'Where it wins',
      loses: 'Where it loses',
      bestFor: 'Best for',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        pricing: 'Free Trial, then €9/mo Basic, €19/mo Pro',
        wins: 'Telegram-native client bot, between-session check-ins, homework tracking, streaks, urgent support requests, 4 languages, EU-hosted',
        loses: 'No built-in scheduling or billing, no coaching-specific progress metrics out of the box, simpler session notes',
        bestFor: 'Coaches who want a Telegram-native client engagement layer without building a new app or adding EHR complexity',
      },
      {
        label: 'CoachAccountable',
        pricing: 'From ~$20/mo',
        wins: 'Purpose-built for coaches, action tracking, accountability journal, goal metrics, good client portal',
        loses: 'Client portal is a separate web app (not Telegram), limited voice/video check-in, English-first',
        bestFor: 'English-speaking coaches who want a fully featured coaching management suite with built-in goal tracking',
      },
      {
        label: 'Practice Better',
        pricing: 'From ~$25/mo',
        wins: 'Strong scheduling + billing, client portal, forms and questionnaires, good for health coaches',
        loses: 'More complex onboarding, client must use a dedicated app, US-centric pricing, limited between-session engagement',
        bestFor: 'Health and wellness coaches who also need scheduling, billing, and intake forms in one platform',
      },
      {
        label: 'Satori',
        pricing: 'From ~$33/mo',
        wins: 'Clean proposal and contract workflow, e-signature, session packages, professional client experience',
        loses: 'Limited between-session engagement, no client journal or homework tracking, no crisis/urgent request feature',
        bestFor: 'Coaches who prioritise the client onboarding and sales process (proposals, contracts, packages) over session engagement',
      },
    ],
    tableNote:
      'Pricing verified against each vendor\'s public pricing page in July 2026. Numbers refresh quarterly. PR-TOP pricing is in EUR; competitor prices are in USD.',

    retentionTitle: 'Client retention: how between-session engagement compounds',
    retentionItems: [
      'A client who submits a journal entry between sessions arrives at the next call with momentum — the conversation starts from progress, not recap.',
      'Homework completion tracking gives you hard data on which assignments work and which fall away. You adjust faster.',
      'Streak data (consecutive days of check-ins) creates a visible accountability metric the client can see too — a quiet motivator that does not require a coaching conversation.',
      'Urgent support requests mean clients do not disappear silently when they hit a wall between sessions. You catch disengagement early.',
      'All of this reduces churn: clients who feel supported between sessions are more likely to renew and to refer peers.',
    ],

    sessionPrepTitle: 'What session prep looks like in PR-TOP',
    sessionPrepP1:
      'Five minutes before the call, you open the client\'s page in the PR-TOP dashboard. You see the journal entries they submitted since the last session — voice transcribed, text searchable. You see which homework items were completed and which were not. You see the streak counter and whether there was a gap.',
    sessionPrepP2:
      'You also see any urgent support requests they sent and how they were resolved. In ten minutes you have more context than you would get in the first twenty minutes of a session spent on "so, how has your week been?" You can open the call with a specific observation instead.',
    sessionPrepLead: 'See also: ',
    sessionPrepLinkDiary: 'client diary for therapists',
    sessionPrepAnd: ' and ',
    sessionPrepLinkPractice: 'AI practice management',
    sessionPrepTail: '.',

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'Is PR-TOP designed for coaches or therapists?',
        a: 'PR-TOP was built for any professional who works in a repeating session model with clients — therapists, psychologists, counsellors, and coaches. The feature set (between-session check-ins, homework assignments, urgent support requests, journal entries, streak tracking) maps directly to coaching workflows. You do not need any clinical background to use it, and the platform language is configurable to match your niche.',
      },
      {
        q: 'Does my client need to download a new app?',
        a: 'No. Clients use Telegram — the messaging app most of them already have. You send them an invite link; they click it, and the PR-TOP client bot connects to their existing Telegram account. There is no separate app download, no new account to create, and no login screen to remember. For clients, it feels like messaging their coach, not onboarding a new tool.',
      },
      {
        q: 'How do I assign homework between sessions?',
        a: 'From the client\'s page in your PR-TOP dashboard, you create a homework assignment: title, description, and optional deadline. With one click it is sent to the client\'s Telegram bot. They receive it as a message, can read the instructions, and mark it complete directly in Telegram when done. You see the completion status in real time.',
      },
      {
        q: 'Can I track whether clients completed their assignments?',
        a: 'Yes. Every homework assignment has a completion status visible in the client\'s dashboard page. You can see at a glance how many assignments were sent, how many were completed, and when. If a client consistently leaves assignments incomplete, the data is there for a coaching conversation about accountability.',
      },
      {
        q: 'What does "session prep" look like in PR-TOP?',
        a: 'Before each session, you open the client page in the PR-TOP dashboard. You see: all journal entries (voice, text, video) submitted since the last session, homework completion status, streak data, and any urgent support requests. You walk into the call with full context — no recap needed, more time for the actual coaching conversation.',
      },
      {
        q: 'What\'s the pricing for coaches?',
        a: 'PR-TOP starts with a free Trial tier that includes the encrypted dashboard, Telegram client bot, journal, homework assignments, and urgent support requests for a limited number of clients — no credit card required. The Basic plan at €9/mo covers more clients, and the Pro plan at €19/mo adds AI features including session transcription and summaries. Less than the revenue from one cancelled session per month.',
      },
    ],

    ctaTitle: 'Keep clients engaged between sessions — try PR-TOP free',
    ctaText:
      'Set up takes about ten minutes. No credit card. If PR-TOP does not fit your coaching workflow, you can export all your data and leave. No lock-in.',
    ctaButton: 'Start free trial',
    ctaLinkCoaches: 'PR-TOP for coaches',
    ctaLinkPractice: 'AI practice management',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'ПО для управления сессиями коучинга (2026) — PR-TOP для коучей',
    seoDescription:
      'Управление сессиями коучинга с PR-TOP: Telegram-бот для отслеживания домашних заданий, чекинов, стриков и подготовки к сессии. Попробуйте бесплатно.',
    articleHeadline: 'Программное обеспечение для управления сессиями коучинга — PR-TOP для коучей',
    articleDescription:
      'Честное руководство 2026 года по ПО для управления сессиями коучинга: сравнение CoachAccountable, Practice Better и Satori, и почему Telegram-ботнейтивный клиентский бот PR-TOP удерживает клиентов между сессиями без сложности EHR.',
    badge: 'Для коучей',
    h1: 'Программное обеспечение для управления сессиями коучинга — PR-TOP для коучей',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',

    intro:
      'PR-TOP даёт коучам Telegram-нативный клиентский бот для чекинов между сессиями, назначения домашних заданий, отслеживания их выполнения и данных о стриках — всё отображается в защищённом веб-кабинете перед каждым звонком. Без нового приложения для клиентов. Без сложности EHR. От €9/мес — дешевле отменённой сессии.',

    whyBetweenTitle: 'Почему вовлечённость между сессиями определяет ROI коучинга',
    whyBetweenP1:
      'Ценность коучинга редко определяется самой сессией. Она определяется тем, что клиент делает — или не делает — в дни между звонками. Клиент, который выполняет домашние задания, отслеживает прогресс и ощущает ответственность перед процессом, гораздо вероятнее продлит контракт, порекомендует вас и отчитается о результатах. Сессия — это разговор; период между сессиями — это то, где происходит работа.',
    whyBetweenP2:
      'Большинство платформ управления сессиями коучинга хорошо решают расписание, биллинг и ведение заметок. Пробел — это уровень между сессиями: чекины клиентов в реальном времени, отслеживание домашних заданий, стрики и возможность клиента быстро связаться с вами, когда ему нужна поддержка. PR-TOP создан именно для этого пробела.',
    whyBetweenP3:
      'Клиенты используют Telegram — мессенджер, который уже есть у них на телефоне. Они отправляют записи чекинов (голосовые, текстовые или короткие видео), выполняют домашние задания, которые отправил коуч, и могут отправить запрос на срочную поддержку одним нажатием, если им нужна немедленная помощь. Всё это попадает в ваш зашифрованный кабинет до следующего звонка. Вы приходите на каждый звонок уже подготовленным.',
    whyBetweenWedge:
      'Четыре вещи, которые определяют разницу между сессиями: журнал клиента, который клиенты действительно используют (потому что он в Telegram, а не в новом приложении), домашние задания, которые они могут выполнить без лишних усилий, запросы на срочную поддержку для моментов, которые не могут ждать, и данные стриков, которые показывают вам — и им — насколько они последовательны.',

    howPrtopTitle: 'Как PR-TOP работает с управлением сессиями коучинга',
    howPrtopP1:
      'Перед звонком вы открываете страницу клиента в кабинете и видите всё с момента последней сессии: записи журнала (голос, текст, видео), статус выполнения домашних заданий и любые запросы на срочную поддержку. Вам не пришлось просить клиента обновить информацию. Контекст уже здесь, с временными метками и поиском.',
    howPrtopP2:
      'Во время сессии вы делаете заметки прямо в кабинете. После сессии вы назначаете следующий раунд домашних заданий через кабинет — одно нажатие, и Telegram-бот клиента доставляет их мгновенно. Вы можете прикрепить инструкции, установить срок и отслеживать, было ли задание отмечено как выполненное до следующего звонка.',
    howPrtopP3:
      'Между сессиями Telegram-бот клиента поддерживает его вовлечённость: ежедневные или еженедельные подсказки для чекинов, напоминания о домашних заданиях, счётчики стриков и возможность отправить голосовую или текстовую запись в любое время. Вы получаете уведомление о запросах на срочную поддержку. Всё зашифровано и хранится в одном месте, а не рассредоточено по приложению для заметок, треду переписки и отдельному инструменту планирования.',
    howPrtopLead: 'Смотрите также: ',
    howPrtopLinkCoaches: 'PR-TOP для коучей',
    howPrtopAnd: ' и ',
    howPrtopLinkPractice: 'AI-управление практикой',
    howPrtopTail: '.',

    tableTitle: 'Инструменты управления сессиями коучинга: сравнение (2026)',
    tableHead: {
      category: 'Инструмент',
      pricing: 'Цена',
      wins: 'Где выигрывает',
      loses: 'Где проигрывает',
      bestFor: 'Кому подходит',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        pricing: 'Бесплатный Trial, далее €9/мес Basic, €19/мес Pro',
        wins: 'Telegram-нативный клиентский бот, чекины между сессиями, отслеживание домашних заданий, стрики, запросы на срочную поддержку, 4 языка, EU-хостинг',
        loses: 'Нет встроенного расписания или биллинга, нет специфических метрик прогресса коучинга из коробки, более простые заметки к сессиям',
        bestFor: 'Коучам, которым нужен Telegram-нативный уровень вовлечённости клиентов без нового приложения и сложности EHR',
      },
      {
        label: 'CoachAccountable',
        pricing: 'От ~$20/мес',
        wins: 'Создан специально для коучей, отслеживание действий, журнал подотчётности, метрики целей, хороший клиентский портал',
        loses: 'Клиентский портал — отдельное веб-приложение (не Telegram), ограниченный голосовой/видео чекин, англоязычный в первую очередь',
        bestFor: 'Англоязычным коучам, которым нужна полнофункциональная система управления коучингом со встроенным отслеживанием целей',
      },
      {
        label: 'Practice Better',
        pricing: 'От ~$25/мес',
        wins: 'Надёжное расписание и биллинг, клиентский портал, формы и анкеты, подходит для коучей по здоровью',
        loses: 'Более сложный онбординг, клиент должен использовать отдельное приложение, ценообразование ориентировано на США, ограниченная вовлечённость между сессиями',
        bestFor: 'Коучам по здоровью и велнес, которым также нужны расписание, биллинг и формы приёма в одной платформе',
      },
      {
        label: 'Satori',
        pricing: 'От ~$33/мес',
        wins: 'Чистый процесс предложений и контрактов, электронная подпись, пакеты сессий, профессиональный клиентский опыт',
        loses: 'Ограниченная вовлечённость между сессиями, нет журнала клиента или отслеживания домашних заданий, нет функции кризисных/срочных запросов',
        bestFor: 'Коучам, которые ставят приоритет на онбординг и продажи (предложения, контракты, пакеты), а не на вовлечённость в сессии',
      },
    ],
    tableNote:
      'Цены сверены с публичными страницами каждого вендора в июле 2026. Обновляются ежеквартально. Цены PR-TOP в EUR, цены конкурентов в USD.',

    retentionTitle: 'Удержание клиентов: как накапливается вовлечённость между сессиями',
    retentionItems: [
      'Клиент, который делает записи в журнале между сессиями, приходит на следующий звонок с импульсом — разговор начинается с прогресса, а не с пересказа.',
      'Отслеживание выполнения домашних заданий даёт вам реальные данные о том, какие задания работают, а какие нет. Вы корректируете быстрее.',
      'Данные стриков (дни подряд с чекинами) создают видимый показатель подотчётности, который клиент тоже видит — тихий мотиватор, не требующий коучинговой беседы.',
      'Запросы на срочную поддержку означают, что клиенты не исчезают молча, когда упираются в стену между сессиями. Вы замечаете отчуждение рано.',
      'Всё это снижает отток: клиенты, которые чувствуют поддержку между сессиями, с большей вероятностью продлят контракт и порекомендуют вас коллегам.',
    ],

    sessionPrepTitle: 'Как выглядит подготовка к сессии в PR-TOP',
    sessionPrepP1:
      'За пять минут до звонка вы открываете страницу клиента в кабинете PR-TOP. Вы видите: все записи журнала (голос, текст, видео), отправленные с момента последней сессии, статус выполнения домашних заданий, данные стриков и любые запросы на срочную поддержку и то, как они были решены.',
    sessionPrepP2:
      'За десять минут у вас больше контекста, чем вы получили бы за первые двадцать минут сессии, потраченные на «ну, как была ваша неделя?». Вы можете открыть звонок с конкретным наблюдением вместо этого.',
    sessionPrepLead: 'Смотрите также: ',
    sessionPrepLinkDiary: 'дневник клиента для психологов',
    sessionPrepAnd: ' и ',
    sessionPrepLinkPractice: 'AI-управление практикой',
    sessionPrepTail: '.',

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'PR-TOP предназначен для коучей или терапевтов?',
        a: 'PR-TOP создан для любого специалиста, который работает в повторяющейся модели сессий с клиентами — терапевтов, психологов, консультантов и коучей. Набор функций (чекины между сессиями, домашние задания, запросы на срочную поддержку, записи журнала, отслеживание стриков) напрямую соответствует рабочим процессам коучинга. Вам не нужно медицинское образование для его использования, а язык платформы настраивается под вашу нишу.',
      },
      {
        q: 'Мой клиент должен скачать новое приложение?',
        a: 'Нет. Клиенты используют Telegram — мессенджер, который у большинства из них уже есть. Вы отправляете им пригласительную ссылку; они нажимают на неё, и клиентский бот PR-TOP подключается к их существующему аккаунту Telegram. Никакого отдельного скачивания приложения, никакого нового аккаунта и никакого экрана входа для запоминания. Для клиентов это ощущается как переписка с коучем, а не как онбординг нового инструмента.',
      },
      {
        q: 'Как мне назначить домашнее задание между сессиями?',
        a: 'Со страницы клиента в вашем кабинете PR-TOP вы создаёте домашнее задание: название, описание и необязательный срок. Одним нажатием оно отправляется в Telegram-бот клиента. Они получают его как сообщение, могут прочитать инструкции и отметить его выполненным прямо в Telegram. Вы видите статус выполнения в реальном времени.',
      },
      {
        q: 'Могу ли я отслеживать, выполнили ли клиенты свои задания?',
        a: 'Да. Каждое домашнее задание имеет статус выполнения, видимый на странице клиента в кабинете. Вы можете с первого взгляда увидеть, сколько заданий было отправлено, сколько выполнено и когда. Если клиент постоянно оставляет задания невыполненными, данные есть для коучинговой беседы о подотчётности.',
      },
      {
        q: 'Как выглядит «подготовка к сессии» в PR-TOP?',
        a: 'Перед каждой сессией вы открываете страницу клиента в кабинете PR-TOP. Вы видите: все записи журнала (голос, текст, видео), отправленные с момента последней сессии, статус выполнения домашних заданий, данные стриков и любые запросы на срочную поддержку. Вы приходите на звонок с полным контекстом — не нужен пересказ, больше времени для реального коучингового разговора.',
      },
      {
        q: 'Какова цена для коучей?',
        a: 'PR-TOP начинается с бесплатного тарифа Trial, который включает зашифрованный кабинет, Telegram-бот для клиентов, журнал, домашние задания и запросы на срочную поддержку для ограниченного числа клиентов — карта не нужна. Тариф Basic за €9/мес охватывает больше клиентов, а тариф Pro за €19/мес добавляет AI-функции, включая транскрипцию и резюме сессий. Дешевле дохода от одной отменённой сессии в месяц.',
      },
    ],

    ctaTitle: 'Удерживайте клиентов между сессиями — попробуйте PR-TOP бесплатно',
    ctaText:
      'Настройка занимает около десяти минут. Без банковской карты. Если PR-TOP не вписывается в ваш рабочий процесс коучинга, вы можете выгрузить все данные и уйти без привязки.',
    ctaButton: 'Начать бесплатно',
    ctaLinkCoaches: 'PR-TOP для коучей',
    ctaLinkPractice: 'AI-управление практикой',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'ПЗ для управління сесіями коучингу (2026) — PR-TOP для коучів',
    seoDescription:
      'Управління сесіями коучингу з PR-TOP: Telegram-бот для відстеження завдань, чекінів, серій і підготовки до сесії. Спробуйте безкоштовно сьогодні.',
    articleHeadline: 'Програмне забезпечення для управління сесіями коучингу — PR-TOP для коучів',
    articleDescription:
      'Чесний посібник 2026 року з ПЗ для управління сесіями коучингу: порівняння CoachAccountable, Practice Better і Satori, і чому Telegram-нативний клієнтський бот PR-TOP утримує клієнтів між сесіями без складності EHR.',
    badge: 'Для коучів',
    h1: 'Програмне забезпечення для управління сесіями коучингу — PR-TOP для коучів',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',

    intro:
      'PR-TOP дає коучам Telegram-нативний клієнтський бот для чекінів між сесіями, призначення домашніх завдань, відстеження їх виконання та даних про серії — всі відображаються в захищеному веб-кабінеті перед кожним дзвінком. Без нового застосунку для клієнтів. Без складності EHR. Від €9/міс — дешевше скасованої сесії.',

    whyBetweenTitle: 'Чому залученість між сесіями визначає ROI коучингу',
    whyBetweenP1:
      'Цінність коучингу рідко визначається самою сесією. Вона визначається тим, що клієнт робить — або не робить — у дні між дзвінками. Клієнт, який виконує домашні завдання, відстежує прогрес і відчуває відповідальність перед процесом, набагато вірогідніше продовжить контракт, порекомендує вас і звітуватиме про результати. Сесія — це розмова; період між сесіями — це те, де відбувається робота.',
    whyBetweenP2:
      'Більшість платформ управління сесіями коучингу добре вирішують розклад, білінг і ведення нотаток. Прогалина — це рівень між сесіями: чекіни клієнтів у реальному часі, відстеження домашніх завдань, серії і можливість клієнта швидко зв\'язатися з вами, коли йому потрібна підтримка. PR-TOP створено саме для цієї прогалини.',
    whyBetweenP3:
      'Клієнти використовують Telegram — месенджер, який вже є у них на телефоні. Вони надсилають записи чекінів (голосові, текстові або короткі відео), виконують домашні завдання, які надіслав коуч, і можуть надіслати запит на термінову підтримку одним дотиком, якщо їм потрібна негайна допомога. Все це потрапляє у ваш зашифрований кабінет до наступного дзвінка. Ви приходите на кожен дзвінок вже підготовленим.',
    whyBetweenWedge:
      'Чотири речі, що визначають різницю між сесіями: журнал клієнта, який клієнти справді використовують (бо він у Telegram, а не в новому застосунку), домашні завдання, які вони можуть виконати без зайвих зусиль, запити на термінову підтримку для моментів, що не можуть чекати, і дані серій, які показують вам — і їм — наскільки вони послідовні.',

    howPrtopTitle: 'Як PR-TOP працює з управлінням сесіями коучингу',
    howPrtopP1:
      'Перед дзвінком ви відкриваєте сторінку клієнта в кабінеті і бачите все з моменту останньої сесії: записи журналу (голос, текст, відео), статус виконання домашніх завдань і будь-які запити на термінову підтримку. Вам не довелося просити клієнта оновити інформацію. Контекст вже тут, з часовими мітками та пошуком.',
    howPrtopP2:
      'Під час сесії ви робите нотатки прямо в кабінеті. Після сесії ви призначаєте наступний раунд домашніх завдань через кабінет — одне натискання, і Telegram-бот клієнта доставляє їх миттєво. Ви можете додати інструкції, встановити термін і відстежувати, чи було завдання позначено як виконане до наступного дзвінка.',
    howPrtopP3:
      'Між сесіями Telegram-бот клієнта підтримує його залученість: щоденні або щотижневі підказки для чекінів, нагадування про домашні завдання, лічильники серій і можливість надіслати голосовий або текстовий запис будь-коли. Ви отримуєте сповіщення про запити на термінову підтримку. Все зашифровано і зберігається в одному місці, а не розпорошено по застосунку для нотаток, треду переписки та окремому інструменту планування.',
    howPrtopLead: 'Дивіться також: ',
    howPrtopLinkCoaches: 'PR-TOP для коучів',
    howPrtopAnd: ' та ',
    howPrtopLinkPractice: 'AI-управління практикою',
    howPrtopTail: '.',

    tableTitle: 'Інструменти управління сесіями коучингу: порівняння (2026)',
    tableHead: {
      category: 'Інструмент',
      pricing: 'Ціна',
      wins: 'Де виграє',
      loses: 'Де програє',
      bestFor: 'Кому підходить',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        pricing: 'Безкоштовний Trial, далі €9/міс Basic, €19/міс Pro',
        wins: 'Telegram-нативний клієнтський бот, чекіни між сесіями, відстеження домашніх завдань, серії, запити на термінову підтримку, 4 мови, EU-хостинг',
        loses: 'Немає вбудованого розкладу або білінгу, немає специфічних метрик прогресу коучингу з коробки, простіші нотатки до сесій',
        bestFor: 'Коучам, яким потрібен Telegram-нативний рівень залученості клієнтів без нового застосунку і складності EHR',
      },
      {
        label: 'CoachAccountable',
        pricing: 'Від ~$20/міс',
        wins: 'Створено спеціально для коучів, відстеження дій, журнал підзвітності, метрики цілей, хороший клієнтський портал',
        loses: 'Клієнтський портал — окремий веб-застосунок (не Telegram), обмежений голосовий/відео чекін, в першу чергу англомовний',
        bestFor: 'Англомовним коучам, яким потрібна повнофункціональна система управління коучингом із вбудованим відстеженням цілей',
      },
      {
        label: 'Practice Better',
        pricing: 'Від ~$25/міс',
        wins: 'Надійний розклад і білінг, клієнтський портал, форми та анкети, підходить для коучів з охорони здоров\'я',
        loses: 'Складніший онбординг, клієнт повинен використовувати окремий застосунок, ціноутворення орієнтоване на США, обмежена залученість між сесіями',
        bestFor: 'Коучам з охорони здоров\'я та велнесу, яким також потрібні розклад, білінг і форми прийому в одній платформі',
      },
      {
        label: 'Satori',
        pricing: 'Від ~$33/міс',
        wins: 'Чіткий процес пропозицій і контрактів, електронний підпис, пакети сесій, професійний клієнтський досвід',
        loses: 'Обмежена залученість між сесіями, немає журналу клієнта або відстеження домашніх завдань, немає функції кризових/термінових запитів',
        bestFor: 'Коучам, які надають пріоритет онбордингу та продажам (пропозиції, контракти, пакети), а не залученості в сесії',
      },
    ],
    tableNote:
      'Ціни звірено з публічними сторінками кожного вендора у липні 2026. Оновлюються щокварталу. Ціни PR-TOP в EUR, ціни конкурентів в USD.',

    retentionTitle: 'Утримання клієнтів: як накопичується залученість між сесіями',
    retentionItems: [
      'Клієнт, який робить записи в журналі між сесіями, приходить на наступний дзвінок з імпульсом — розмова починається з прогресу, а не з переказу.',
      'Відстеження виконання домашніх завдань дає вам реальні дані про те, які завдання працюють, а які ні. Ви коригуєте швидше.',
      'Дані серій (дні поспіль з чекінами) створюють видимий показник підзвітності, який клієнт теж бачить — тихий мотиватор, що не вимагає коучингової бесіди.',
      'Запити на термінову підтримку означають, що клієнти не зникають мовчки, коли впираються в стіну між сесіями. Ви помічаєте відчуження рано.',
      'Все це знижує відтік: клієнти, які відчувають підтримку між сесіями, з більшою вірогідністю продовжать контракт і порекомендують вас колегам.',
    ],

    sessionPrepTitle: 'Як виглядає підготовка до сесії в PR-TOP',
    sessionPrepP1:
      'За п\'ять хвилин до дзвінка ви відкриваєте сторінку клієнта в кабінеті PR-TOP. Ви бачите: всі записи журналу (голос, текст, відео), надіслані з моменту останньої сесії, статус виконання домашніх завдань, дані серій і будь-які запити на термінову підтримку та те, як вони були вирішені.',
    sessionPrepP2:
      'За десять хвилин у вас більше контексту, ніж ви отримали б за перші двадцять хвилин сесії, витрачені на «ну, як був ваш тиждень?». Ви можете відкрити дзвінок з конкретним спостереженням замість цього.',
    sessionPrepLead: 'Дивіться також: ',
    sessionPrepLinkDiary: 'щоденник клієнта для психологів',
    sessionPrepAnd: ' та ',
    sessionPrepLinkPractice: 'AI-управління практикою',
    sessionPrepTail: '.',

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'PR-TOP призначений для коучів чи терапевтів?',
        a: 'PR-TOP створено для будь-якого фахівця, який працює в моделі сесій, що повторюються, з клієнтами — терапевтів, психологів, консультантів і коучів. Набір функцій (чекіни між сесіями, домашні завдання, запити на термінову підтримку, записи журналу, відстеження серій) безпосередньо відповідає робочим процесам коучингу. Вам не потрібна медична освіта для його використання, а мова платформи налаштовується під вашу нішу.',
      },
      {
        q: 'Мій клієнт повинен завантажити новий застосунок?',
        a: 'Ні. Клієнти використовують Telegram — месенджер, який у більшості з них вже є. Ви надсилаєте їм запрошувальне посилання; вони натискають на нього, і клієнтський бот PR-TOP підключається до їхнього існуючого облікового запису Telegram. Жодного окремого завантаження застосунку, жодного нового облікового запису та жодного екрана входу для запам\'ятовування. Для клієнтів це відчувається як листування з коучем, а не як онбординг нового інструменту.',
      },
      {
        q: 'Як мені призначити домашнє завдання між сесіями?',
        a: 'Зі сторінки клієнта у вашому кабінеті PR-TOP ви створюєте домашнє завдання: назву, опис і необов\'язковий термін. Одним натисканням воно надсилається в Telegram-бот клієнта. Вони отримують його як повідомлення, можуть прочитати інструкції і позначити його виконаним прямо в Telegram. Ви бачите статус виконання в реальному часі.',
      },
      {
        q: 'Чи можу я відстежувати, чи виконали клієнти свої завдання?',
        a: 'Так. Кожне домашнє завдання має статус виконання, видимий на сторінці клієнта в кабінеті. Ви можете з першого погляду побачити, скільки завдань було надіслано, скільки виконано і коли. Якщо клієнт постійно залишає завдання невиконаними, дані є для коучингової бесіди про підзвітність.',
      },
      {
        q: 'Як виглядає «підготовка до сесії» в PR-TOP?',
        a: 'Перед кожною сесією ви відкриваєте сторінку клієнта в кабінеті PR-TOP. Ви бачите: всі записи журналу (голос, текст, відео), надіслані з моменту останньої сесії, статус виконання домашніх завдань, дані серій і будь-які запити на термінову підтримку. Ви приходите на дзвінок з повним контекстом — не потрібен переказ, більше часу для реальної коучингової розмови.',
      },
      {
        q: 'Яка ціна для коучів?',
        a: 'PR-TOP починається з безкоштовного тарифу Trial, який включає зашифрований кабінет, Telegram-бот для клієнтів, журнал, домашні завдання і запити на термінову підтримку для обмеженої кількості клієнтів — картка не потрібна. Тариф Basic за €9/міс охоплює більше клієнтів, а тариф Pro за €19/міс додає AI-функції, включаючи транскрипцію та резюме сесій. Дешевше доходу від однієї скасованої сесії на місяць.',
      },
    ],

    ctaTitle: 'Утримуйте клієнтів між сесіями — спробуйте PR-TOP безкоштовно',
    ctaText:
      'Налаштування займає близько десяти хвилин. Без банківської картки. Якщо PR-TOP не вписується у ваш робочий процес коучингу, ви можете вивантажити всі дані й піти без прив\'язки.',
    ctaButton: 'Почати безкоштовно',
    ctaLinkCoaches: 'PR-TOP для коучів',
    ctaLinkPractice: 'AI-управління практикою',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Software de gestión de sesiones de coaching (2026) — PR-TOP para coaches',
    seoDescription:
      'Gestión de sesiones de coaching con PR-TOP: bot de Telegram para seguimiento de tareas, check-ins entre sesiones, rachas y preparación. Prueba gratis.',
    articleHeadline: 'Software de gestión de sesiones de coaching — PR-TOP para coaches',
    articleDescription:
      'Guía honesta de 2026 sobre software de gestión de sesiones de coaching: cómo se comparan CoachAccountable, Practice Better y Satori, y por qué el bot cliente nativo de Telegram de PR-TOP mantiene a los clientes comprometidos entre sesiones sin la complejidad de un EHR.',
    badge: 'Para coaches',
    h1: 'Software de gestión de sesiones de coaching — PR-TOP para coaches',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',

    intro:
      'PR-TOP da a los coaches un bot cliente nativo de Telegram para check-ins entre sesiones, asignación de tareas, seguimiento de su cumplimiento y datos de rachas — todo visible en un panel web seguro antes de cada llamada. Sin nueva app para los clientes. Sin complejidad de EHR. Desde €9/mes, menos que una sesión cancelada.',

    whyBetweenTitle: 'Por qué el compromiso entre sesiones impulsa el ROI del coaching',
    whyBetweenP1:
      'El valor de un compromiso de coaching rara vez se decide en la sesión misma. Se decide por lo que el cliente hace — o no hace — en los días entre llamadas. Un cliente que completa sus tareas, hace un seguimiento de su progreso y se siente responsable del proceso tiene muchas más probabilidades de renovar, referir y reportar resultados. La sesión es la conversación; el período entre sesiones es donde ocurre el trabajo.',
    whyBetweenP2:
      'La mayoría de las plataformas de gestión de sesiones de coaching abordan bien la programación, la facturación y la toma de notas. La brecha está en la capa entre sesiones: check-ins del cliente en tiempo real, seguimiento de tareas, rachas y la capacidad del cliente de contactarle rápidamente cuando necesita apoyo. PR-TOP fue construido alrededor de esa brecha.',
    whyBetweenP3:
      'Los clientes usan Telegram — el mensajero que ya tienen en su teléfono. Envían entradas de check-in (voz, texto o vídeo corto), completan las tareas que les envió el coach y pueden activar una solicitud de apoyo urgente con un solo toque si necesitan atención inmediata. Todo esto llega a su panel cifrado antes de la próxima llamada. Llega a cada llamada ya preparado.',
    whyBetweenWedge:
      'Las cuatro cosas que marcan la diferencia entre sesiones: un diario del cliente que los clientes realmente usan (porque vive en Telegram, no en una nueva app), tareas que pueden completar sin fricción, solicitudes de apoyo urgente para momentos que no pueden esperar, y datos de rachas que le muestran — a usted y a ellos — cuán consistentes han sido.',

    howPrtopTitle: 'Cómo gestiona PR-TOP las sesiones de coaching',
    howPrtopP1:
      'Antes de la llamada, abre la página del cliente en el panel y ve todo desde la última sesión: entradas del diario (voz, texto, vídeo), estado de cumplimiento de tareas y cualquier solicitud de apoyo urgente. No tuvo que pedirle al cliente una actualización. El contexto ya está ahí, con marca de tiempo y buscable.',
    howPrtopP2:
      'Durante la sesión, toma notas directamente en el panel. Después de la sesión, asigna la siguiente ronda de tareas a través del panel — un clic, y el bot de Telegram del cliente las entrega al instante. Puede adjuntar instrucciones, establecer una fecha límite y realizar un seguimiento de si se marcó como completada antes de la próxima llamada.',
    howPrtopP3:
      'Entre sesiones, el bot de Telegram del cliente lo mantiene comprometido: prompts de check-in diarios o semanales, recordatorios de tareas, contadores de rachas y la capacidad de enviar una entrada de voz o texto en cualquier momento. Recibe una notificación para las solicitudes de apoyo urgente. Todo está cifrado y almacenado en el mismo lugar, no disperso entre una app de notas, un hilo de mensajes y una herramienta de programación separada.',
    howPrtopLead: 'Consulte también: ',
    howPrtopLinkCoaches: 'PR-TOP para coaches',
    howPrtopAnd: ' y ',
    howPrtopLinkPractice: 'gestión de consulta con IA',
    howPrtopTail: '.',

    tableTitle: 'Herramientas de gestión de sesiones de coaching comparadas (2026)',
    tableHead: {
      category: 'Herramienta',
      pricing: 'Precio',
      wins: 'Dónde gana',
      loses: 'Dónde pierde',
      bestFor: 'Ideal para',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        pricing: 'Trial gratuito, luego €9/mes Basic, €19/mes Pro',
        wins: 'Bot cliente nativo de Telegram, check-ins entre sesiones, seguimiento de tareas, rachas, solicitudes de apoyo urgente, 4 idiomas, alojado en UE',
        loses: 'Sin programación ni facturación integrada, sin métricas de progreso específicas de coaching de serie, notas de sesión más simples',
        bestFor: 'Coaches que quieren una capa de compromiso del cliente nativa de Telegram sin construir una nueva app ni añadir complejidad de EHR',
      },
      {
        label: 'CoachAccountable',
        pricing: 'Desde ~$20/mes',
        wins: 'Diseñado específicamente para coaches, seguimiento de acciones, diario de responsabilidad, métricas de objetivos, buen portal del cliente',
        loses: 'El portal del cliente es una app web separada (no Telegram), check-in de voz/vídeo limitado, principalmente en inglés',
        bestFor: 'Coaches de habla inglesa que quieren una suite de gestión de coaching completa con seguimiento de objetivos integrado',
      },
      {
        label: 'Practice Better',
        pricing: 'Desde ~$25/mes',
        wins: 'Sólida programación y facturación, portal del cliente, formularios y cuestionarios, ideal para coaches de salud',
        loses: 'Incorporación más compleja, el cliente debe usar una app dedicada, precios centrados en EE. UU., compromiso entre sesiones limitado',
        bestFor: 'Coaches de salud y bienestar que también necesitan programación, facturación y formularios de incorporación en una sola plataforma',
      },
      {
        label: 'Satori',
        pricing: 'Desde ~$33/mes',
        wins: 'Flujo de propuestas y contratos limpio, firma electrónica, paquetes de sesiones, experiencia de cliente profesional',
        loses: 'Compromiso entre sesiones limitado, sin diario del cliente ni seguimiento de tareas, sin función de solicitudes urgentes/crisis',
        bestFor: 'Coaches que priorizan el proceso de incorporación y ventas del cliente (propuestas, contratos, paquetes) sobre el compromiso en la sesión',
      },
    ],
    tableNote:
      'Precios verificados en las páginas públicas de cada proveedor en julio de 2026. Las cifras se actualizan cada trimestre. Los precios de PR-TOP están en EUR; los de los competidores, en USD.',

    retentionTitle: 'Retención de clientes: cómo se acumula el compromiso entre sesiones',
    retentionItems: [
      'Un cliente que envía una entrada de diario entre sesiones llega a la próxima llamada con impulso — la conversación comienza desde el progreso, no desde el repaso.',
      'El seguimiento del cumplimiento de tareas le da datos concretos sobre qué asignaciones funcionan y cuáles no. Se ajusta más rápido.',
      'Los datos de rachas (días consecutivos de check-ins) crean una métrica de responsabilidad visible que el cliente también puede ver — un motivador silencioso que no requiere una conversación de coaching.',
      'Las solicitudes de apoyo urgente significan que los clientes no desaparecen silenciosamente cuando chocan con un obstáculo entre sesiones. Detecta el desenganche antes.',
      'Todo esto reduce la deserción: los clientes que se sienten apoyados entre sesiones son más propensos a renovar y a referir a sus compañeros.',
    ],

    sessionPrepTitle: 'Cómo es la preparación de sesión en PR-TOP',
    sessionPrepP1:
      'Cinco minutos antes de la llamada, abre la página del cliente en el panel de PR-TOP. Ve: todas las entradas del diario (voz, texto, vídeo) enviadas desde la última sesión, el estado de cumplimiento de tareas, los datos de rachas y cualquier solicitud de apoyo urgente y cómo se resolvieron.',
    sessionPrepP2:
      'En diez minutos tiene más contexto del que obtendría en los primeros veinte minutos de una sesión dedicados a "bueno, ¿cómo ha sido tu semana?". Puede abrir la llamada con una observación específica en su lugar.',
    sessionPrepLead: 'Consulte también: ',
    sessionPrepLinkDiary: 'diario del cliente para terapeutas',
    sessionPrepAnd: ' y ',
    sessionPrepLinkPractice: 'gestión de consulta con IA',
    sessionPrepTail: '.',

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿PR-TOP está diseñado para coaches o terapeutas?',
        a: 'PR-TOP fue construido para cualquier profesional que trabaja en un modelo de sesiones repetidas con clientes — terapeutas, psicólogos, consejeros y coaches. El conjunto de funciones (check-ins entre sesiones, tareas, solicitudes de apoyo urgente, entradas de diario, seguimiento de rachas) se corresponde directamente con los flujos de trabajo de coaching. No necesita ningún conocimiento clínico para usarlo, y el idioma de la plataforma es configurable para adaptarse a su nicho.',
      },
      {
        q: '¿Mi cliente necesita descargar una nueva app?',
        a: 'No. Los clientes usan Telegram — la app de mensajería que la mayoría ya tiene. Usted les envía un enlace de invitación; lo hacen clic, y el bot cliente de PR-TOP se conecta a su cuenta de Telegram existente. No hay descarga de app separada, no hay cuenta nueva que crear y no hay pantalla de inicio de sesión que recordar. Para los clientes, se siente como enviar mensajes a su coach, no como incorporar una nueva herramienta.',
      },
      {
        q: '¿Cómo asigno tareas entre sesiones?',
        a: 'Desde la página del cliente en su panel de PR-TOP, crea una tarea: título, descripción y fecha límite opcional. Con un clic se envía al bot de Telegram del cliente. Lo reciben como un mensaje, pueden leer las instrucciones y marcarlo como completado directamente en Telegram cuando terminen. Usted ve el estado de cumplimiento en tiempo real.',
      },
      {
        q: '¿Puedo hacer un seguimiento de si los clientes completaron sus asignaciones?',
        a: 'Sí. Cada tarea tiene un estado de cumplimiento visible en la página del cliente en el panel. Puede ver de un vistazo cuántas tareas se enviaron, cuántas se completaron y cuándo. Si un cliente deja sistemáticamente las tareas sin completar, los datos están ahí para una conversación de coaching sobre responsabilidad.',
      },
      {
        q: '¿Cómo es la "preparación de sesión" en PR-TOP?',
        a: 'Antes de cada sesión, abre la página del cliente en el panel de PR-TOP. Ve: todas las entradas del diario (voz, texto, vídeo) enviadas desde la última sesión, el estado de cumplimiento de tareas, los datos de rachas y cualquier solicitud de apoyo urgente. Llega a la llamada con contexto completo — sin necesidad de repaso, más tiempo para la conversación de coaching real.',
      },
      {
        q: '¿Cuál es el precio para coaches?',
        a: 'PR-TOP comienza con un nivel Trial gratuito que incluye el panel cifrado, el bot de Telegram para clientes, el diario, las tareas y las solicitudes de apoyo urgente para un número limitado de clientes — sin tarjeta de crédito. El plan Basic a €9/mes cubre más clientes, y el plan Pro a €19/mes añade funciones de IA, incluida la transcripción y los resúmenes de sesiones. Menos que los ingresos de una sesión cancelada al mes.',
      },
    ],

    ctaTitle: 'Mantenga a los clientes comprometidos entre sesiones — pruebe PR-TOP gratis',
    ctaText:
      'La configuración tarda unos diez minutos. Sin tarjeta de crédito. Si PR-TOP no encaja en su flujo de trabajo de coaching, puede exportar todos sus datos e irse sin ataduras.',
    ctaButton: 'Empezar gratis',
    ctaLinkCoaches: 'PR-TOP para coaches',
    ctaLinkPractice: 'Gestión de consulta con IA',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function CoachingSessionManagement() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const c = CONTENT[locale] || CONTENT.en;
  const lp = useLocalePath();
  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : `/${locale}`}/coaching-session-management`;

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
        path="/coaching-session-management"
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

        {/* Rule 7 — PR-TOP wedge in first H2: between-session engagement framing. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whyBetweenTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whyBetweenP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whyBetweenP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whyBetweenP3}</p>
          <p className="text-gray-700 leading-relaxed">{c.whyBetweenWedge}</p>
        </section>

        {/* Rule 7 — PR-TOP wedge in second H2: how session management works. */}
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
            <Link to={lp('/for-coaches')} className="text-primary underline hover:no-underline">
              {c.howPrtopLinkCoaches}
            </Link>
            {c.howPrtopAnd}
            <Link to={lp('/ai-practice-management')} className="text-primary underline hover:no-underline">
              {c.howPrtopLinkPractice}
            </Link>
            {c.howPrtopTail}
          </p>
        </section>

        {/* Rule 3 — honest comparison table. */}
        {/* Competitor pricing sources: coachaccountable.com, practicebetter.io, satorihq.com — verified July 2026 */}
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

        {/* Client retention section */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.retentionTitle}
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            {c.retentionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* Session prep section */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.sessionPrepTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.sessionPrepP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.sessionPrepP2}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.sessionPrepLead}
            <Link to={lp('/client-diary-for-therapists')} className="text-primary underline hover:no-underline">
              {c.sessionPrepLinkDiary}
            </Link>
            {c.sessionPrepAnd}
            <Link to={lp('/ai-practice-management')} className="text-primary underline hover:no-underline">
              {c.sessionPrepLinkPractice}
            </Link>
            {c.sessionPrepTail}
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
              to={lp('/for-coaches')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkCoaches}
            </Link>
            <Link
              to={lp('/ai-practice-management')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkPractice}
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
