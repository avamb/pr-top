import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /client-diary-for-therapists  —  dedicated landing for PR-TOP's #3-ranking query.
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest feature/price comparison table (Approach, Cost, Diary type,
 *      Therapist visibility, Encryption, Best for) — PR-TOP vs no diary vs
 *      paper vs WhatsApp vs Upheal vs custom apps
 *   4. FAQ block + FAQPage JSON-LD (5-6 Q&As)
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / + sibling pages:
 *      /ai-session-notes-for-therapists, /therapy-documentation-ai,
 *      /for-coaches, /coaching-session-management,
 *      /security/encryption, /security/gdpr
 *   7. PR-TOP wedge in first two H2 sections:
 *      diary + exercises + crisis alerts + Telegram all named
 *
 * Page angle: this IS the diary page. PR-TOP gives therapists a structured,
 * encrypted, real-time Telegram diary for every client — something no
 * note-taking competitor (Upheal, Quill, Supanote) offers at all.
 *
 * Competitor data verified July 2026.
 */

const CONTENT = {
  en: {
    seoTitle: 'Client diary for therapists — PR-TOP encrypted Telegram diary (2026)',
    seoDescription:
      'Client diary for therapists via Telegram: voice, text and video entries encrypted in PR-TOP\'s dashboard. See every session\'s context. Try free.',
    articleHeadline: 'Client diary for therapists — how PR-TOP keeps clients connected between sessions',
    articleDescription:
      'Full guide to the client diary for therapists in PR-TOP: voice, text and video entries via Telegram, AES-encrypted dashboard, consent enforcement, and session-prep context.',
    badge: 'Feature guide',
    h1: 'Client diary for therapists — how PR-TOP keeps clients connected',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    intro:
      'A client diary for therapists captures what happens between appointments — the moments therapy is actually about. PR-TOP gives every client a Telegram channel to send voice notes, text entries or short videos. You see all of it in an encrypted dashboard, with consent enforced and context ready before every session.',

    whyDiaryTitle: 'Why client diaries matter for therapy',
    whyDiaryP1:
      'Sessions are 50 minutes. The other 10,030 minutes of the week are where clients actually live their struggles, make progress, spiral, and recover. A therapist who arrives at Monday\'s appointment without that context is working from memory and the client\'s edited self-report, not from the raw record of what the week actually looked like.',
    whyDiaryP2:
      'The most common complaint therapists give about between-session work is not that it doesn\'t happen — it is that the information never reaches them in a structured way. Clients text on WhatsApp (GDPR risk), forget what they wrote in a paper journal, or simply don\'t know what to record. The result is that valuable between-session data either never exists or exists in silos that never connect to the therapeutic record.',
    whyDiaryP3:
      'A structured, encrypted client diary inside the same platform as your session notes changes that. The context arrives automatically. You stop spending the first ten minutes of every session reconstructing the week. You start deeper, faster.',

    howPrtopTitle: 'How the PR-TOP client diary works',
    howPrtopP1:
      'Every client you add to PR-TOP gets a personal Telegram bot interface. They open the bot from their phone and tap to send a voice message, type a text entry, or upload a short video clip. No app download, no account registration, no friction — if they already use Telegram, the diary is a single tap away. You can also assign exercises via the same bot and track whether clients complete them before the next session.',
    howPrtopP2:
      'On your side, every diary entry, exercise response, and crisis alert appears on the client\'s timeline in the encrypted PR-TOP dashboard. Entries are encrypted as Class A data at the application layer before reaching the database — meaning the database stores ciphertext, not plaintext client content. A one-tap SOS from the client sends a multi-channel alert (in-dashboard notification, email) directly to you. All diary activity flows into the same dashboard as session transcripts and AI summaries, so your record of each client is complete in one place.',
    howPrtopP3:
      'Consent is enforced at the data layer, not as a policy checkbox. A client whose consent status is inactive cannot have their diary viewed, and no data is surfaced until consent is confirmed. This is not configurable off — it is structural.',
    howPrtopLead: 'See also: ',
    howPrtopLinkNotes: 'AI session notes for therapists',
    howPrtopAnd: ' and ',
    howPrtopLinkDocs: 'therapy documentation AI',
    howPrtopTail: '.',

    tableTitle: 'Comparison: approaches to client diary and between-session tracking (2026)',
    tableHead: {
      approach: 'Approach',
      cost: 'Cost',
      diaryType: 'Diary type',
      visibility: 'Therapist visibility',
      encryption: 'Encryption',
      bestFor: 'Best for',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        cost: 'Free Trial → €9/mo Basic',
        diaryType: 'Voice + text + video via Telegram',
        visibility: 'Real-time in encrypted dashboard',
        encryption: 'AES app-layer',
        bestFor: 'Therapists who want structured, encrypted between-session insight',
      },
      {
        label: 'Paper diary',
        cost: '$0',
        diaryType: 'Written (client controls)',
        visibility: 'Only at session — client brings it',
        encryption: 'None',
        bestFor: 'Low-tech, low-budget practices with in-person sessions',
      },
      {
        label: 'Generic messaging (WhatsApp, Signal)',
        cost: '$0',
        diaryType: 'Text / voice messages',
        visibility: 'Real-time in chat',
        encryption: 'Transport only (not app-layer)',
        bestFor: 'Informal practices — GDPR risk, no structured record',
      },
      {
        label: 'Upheal',
        cost: 'From ~$79/mo',
        diaryType: 'None (session notes only)',
        visibility: 'Session notes only',
        encryption: 'Yes',
        bestFor: 'Note-taking / EHR workflow — no between-session client channel',
      },
      {
        label: 'Custom client app',
        cost: '$3,000+ setup',
        diaryType: 'Varies by build',
        visibility: 'Dashboard (if built)',
        encryption: 'Varies',
        bestFor: 'Large clinics with IT budget and developer resources',
      },
    ],
    tableNote:
      'Pricing verified against each vendor\'s public pricing page in July 2026. Numbers refresh quarterly. PR-TOP pricing is in EUR; competitor prices are in USD.',

    sessionPrepTitle: 'The "session prep" advantage: arriving with six days of context',
    sessionPrepP1:
      'Compare two scenarios. In the first, you open Monday\'s session with a blank screen and ask "How was your week?" The client gives you a two-minute summary filtered through how they feel right now. In the second, you spent five minutes before the session reading a voice note from Tuesday, a text entry from Thursday describing a conflict, and the completed exercise you assigned the previous week.',
    sessionPrepP2:
      'The second scenario is what PR-TOP makes routine. The diary is not supplementary context — it is the primary between-session record. Therapists who use it consistently report that sessions go deeper faster, that clients feel heard without having to re-explain everything, and that the therapeutic relationship has more continuity than a weekly 50-minute slot can normally provide.',
    sessionPrepP3:
      'This is also the reason PR-TOP combines the diary with exercises and crisis alerts in the same channel. Assigning an exercise and seeing whether the client actually did it — captured as a diary entry — closes the loop that paper assignments never do. And if a client is in crisis between sessions, the SOS button in Telegram reaches you immediately, not during office hours.',
    sessionPrepLead: 'See also: ',
    sessionPrepLinkCoaches: 'PR-TOP for coaches',
    sessionPrepAnd: ' and ',
    sessionPrepLinkCoaching: 'coaching session management',
    sessionPrepTail: '.',

    privacyTitle: 'Privacy and consent: how PR-TOP protects client diary data',
    privacyP1:
      'Client diary entries are Class A data in PR-TOP\'s two-tier encryption model. Every voice note, text entry, and video clip is encrypted with AES at the application layer before the database ever sees it. The database stores ciphertext. A server breach does not expose client content — there is no plaintext to steal.',
    privacyP2:
      'Consent is structural, not advisory. The system refuses to display diary entries for a client whose consent is inactive, regardless of who is logged in. Therapists can grant, revoke, and audit consent status from the dashboard. Clients can request data export or deletion through the Telegram bot, and you can wipe an entire client record in one dashboard action. All processing runs on EU infrastructure (Hetzner), with self-hosted Umami analytics and no third-party trackers. A Data Processing Addendum is included by default — not on request.',
    privacyLead: 'Details: ',
    privacyLinkEncryption: 'encryption architecture',
    privacyAnd: ' and ',
    privacyLinkGdpr: 'GDPR compliance',
    privacyTail: '.',

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'What types of diary entries can clients submit via Telegram?',
        a: 'Clients can send three types of diary entries through the PR-TOP Telegram bot: voice messages (spoken recordings of any length), text entries (typed messages), and short video clips. All three formats are encrypted as Class A data immediately on receipt and appear on the client\'s timeline in the therapist dashboard. Clients do not need to download a separate app — if they already use Telegram, no additional setup is required on their side.',
      },
      {
        q: 'How does the client diary appear in the therapist dashboard?',
        a: 'Each client has a timeline view in the PR-TOP dashboard that shows diary entries, exercise completions, session notes, and AI summaries in chronological order. Diary entries display the type (voice / text / video), timestamp, and decrypted content. Voice and video entries can be played back inline. The timeline gives you a full picture of the week before you open a session — no switching between tools or chasing messages in a chat app.',
      },
      {
        q: 'Can clients see each other\'s diary entries?',
        a: 'No. Each client\'s diary is completely isolated. Clients interact only with their own personal Telegram bot instance and can see only their own entries. Therapists see only the clients in their own account. There is no shared space, no group view, and no way for one client\'s data to appear in another client\'s record. Consent enforcement adds a second layer: even for a therapist\'s own clients, entries for a client with inactive consent cannot be displayed.',
      },
      {
        q: 'What happens if a client sends an SOS via Telegram?',
        a: 'The PR-TOP Telegram bot includes a one-tap SOS button. When a client triggers it, PR-TOP immediately sends a multi-channel alert to the therapist: an in-dashboard notification and an email to the registered therapist address. The SOS is also logged on the client\'s timeline with a timestamp and lifecycle status (triggered, acknowledged, resolved). Therapists can update the SOS status from the dashboard, creating a full audit trail of how each crisis event was handled.',
      },
      {
        q: 'Does the client diary replace session notes?',
        a: 'No — it complements them. Session notes (transcription via Whisper, AI summarization) capture what happened during the appointment. The client diary captures what happened between appointments. Both appear on the client\'s timeline in the same dashboard, giving you a continuous record that neither tool could provide alone. Most PR-TOP therapists use the diary and session notes together; some also use a specialist note-taker alongside PR-TOP for deeper clinical template formats.',
      },
      {
        q: 'Can I try the client diary feature without a credit card?',
        a: 'Yes. The free Trial tier includes the full client diary — voice, text, and video entries via Telegram — along with the encrypted dashboard, exercise assignment, and SOS alerts for a limited number of clients. No credit card is required and there is no automatic conversion to a paid plan. You upgrade only when you decide to, and you can export all your data at any time.',
      },
    ],

    ctaTitle: 'Start reading your clients\' weeks, not just their sessions',
    ctaText:
      'The free Trial takes about ten minutes to set up and includes the full client diary. No credit card. If PR-TOP does not fit your workflow, you can export all data and leave — no lock-in.',
    ctaButton: 'Start free trial',
    ctaLinkNotes: 'AI session notes for therapists',
    ctaLinkDocs: 'Therapy documentation AI',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'Дневник клиента для психологов — зашифрованный Telegram-дневник PR-TOP (2026)',
    seoDescription:
      'Дневник клиента для психологов через Telegram: голосовые, текстовые и видеозаписи в зашифрованном кабинете PR-TOP. Попробуйте бесплатно сейчас.',
    articleHeadline: 'Дневник клиента для психологов — как PR-TOP поддерживает связь с клиентами между сессиями',
    articleDescription:
      'Полное руководство по дневнику клиента для психологов в PR-TOP: голос, текст и видео через Telegram, зашифрованный кабинет с AES, контроль согласия и контекст к каждой сессии.',
    badge: 'Руководство по функции',
    h1: 'Дневник клиента для психологов — как PR-TOP поддерживает связь с клиентами',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',

    intro:
      'Дневник клиента для психологов фиксирует то, что происходит между встречами — именно там разворачивается жизнь клиента. PR-TOP даёт каждому клиенту Telegram-канал для голосовых заметок, текстовых записей и коротких видео. Вы видите всё в зашифрованном кабинете с контролем согласия и готовым контекстом перед каждой сессией.',

    whyDiaryTitle: 'Почему дневник клиента важен в психологической практике',
    whyDiaryP1:
      'Сессия длится 50 минут. Остальные 10 030 минут недели — это то, где клиент на самом деле проживает свои трудности, делает прогресс, срывается и восстанавливается. Психолог, который приходит на понедельничный приём без этого контекста, работает по памяти и по отредактированному самоотчёту клиента, а не по реальной картине недели.',
    whyDiaryP2:
      'Самая частая жалоба психологов на работу между сессиями — не то, что её нет, а то, что информация не доходит до них в структурированном виде. Клиенты пишут в WhatsApp (риск GDPR), забывают, что записали в бумажный дневник, или просто не знают, что фиксировать. В итоге ценные данные между сессиями либо не появляются вовсе, либо существуют в разрозненных каналах, которые так и не попадают в терапевтическую запись.',
    whyDiaryP3:
      'Структурированный зашифрованный дневник клиента внутри той же платформы, где хранятся заметки к сессиям, меняет это. Контекст поступает автоматически. Вы перестаёте тратить первые десять минут каждой сессии на восстановление недели. Вы начинаете глубже и быстрее.',

    howPrtopTitle: 'Как работает дневник клиента в PR-TOP',
    howPrtopP1:
      'Каждый клиент, которого вы добавляете в PR-TOP, получает личный Telegram-бот. Он открывает бот с телефона и одним нажатием отправляет голосовое сообщение, вводит текст или загружает короткое видео. Не нужно скачивать приложение, регистрировать аккаунт, преодолевать барьеры — если клиент уже пользуется Telegram, дневник доступен в один клик. Через тот же бот вы можете назначать упражнения и отслеживать, выполнил ли их клиент до следующей сессии.',
    howPrtopP2:
      'На вашей стороне каждая запись дневника, ответ на упражнение и кризисное оповещение появляются на временной шкале клиента в зашифрованном кабинете PR-TOP. Записи шифруются как данные класса A на уровне приложения до того, как попасть в базу данных — то есть база хранит шифротекст, а не открытые данные клиентов. Нажатие SOS от клиента отправляет многоканальное оповещение (уведомление в кабинете, email) прямо вам. Вся активность дневника попадает в тот же кабинет, что и транскрипты сессий и AI-резюме, — запись по каждому клиенту полная в одном месте.',
    howPrtopP3:
      'Согласие контролируется на уровне данных, а не как галочка в политике. Клиент с неактивным статусом согласия не позволяет просматривать его дневник, и ни одна запись не отображается до подтверждения согласия. Это не настройка — это структурное требование.',
    howPrtopLead: 'Смотрите также: ',
    howPrtopLinkNotes: 'AI-заметки к сессии для психологов',
    howPrtopAnd: ' и ',
    howPrtopLinkDocs: 'AI-документация для терапии',
    howPrtopTail: '.',

    tableTitle: 'Сравнение: подходы к дневнику клиента и работе между сессиями (2026)',
    tableHead: {
      approach: 'Подход',
      cost: 'Стоимость',
      diaryType: 'Тип дневника',
      visibility: 'Видимость психологу',
      encryption: 'Шифрование',
      bestFor: 'Кому подходит',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        cost: 'Бесплатный Trial → €9/мес Basic',
        diaryType: 'Голос + текст + видео через Telegram',
        visibility: 'В реальном времени в зашифрованном кабинете',
        encryption: 'AES на уровне приложения',
        bestFor: 'Психологам, которым нужен структурированный зашифрованный контекст между сессиями',
      },
      {
        label: 'Бумажный дневник',
        cost: '$0',
        diaryType: 'Рукописный (клиент контролирует)',
        visibility: 'Только на сессии — клиент приносит',
        encryption: 'Нет',
        bestFor: 'Традиционные практики с очными сессиями и ограниченным бюджетом',
      },
      {
        label: 'Мессенджеры (WhatsApp, Signal)',
        cost: '$0',
        diaryType: 'Текст / голосовые сообщения',
        visibility: 'В реальном времени в чате',
        encryption: 'Только транспортный уровень',
        bestFor: 'Неформальные практики — риск GDPR, нет структурированной записи',
      },
      {
        label: 'Upheal',
        cost: 'От ~$79/мес',
        diaryType: 'Нет (только заметки к сессиям)',
        visibility: 'Только заметки к сессиям',
        encryption: 'Да',
        bestFor: 'Workflow для заметок и EHR — нет канала с клиентом между сессиями',
      },
      {
        label: 'Кастомное приложение',
        cost: 'От $3 000 за разработку',
        diaryType: 'Зависит от реализации',
        visibility: 'Кабинет (если построен)',
        encryption: 'Зависит от реализации',
        bestFor: 'Крупные клиники с IT-бюджетом и ресурсами разработчиков',
      },
    ],
    tableNote:
      'Цены сверены с публичными страницами каждого вендора в июле 2026. Обновляются ежеквартально. Цены PR-TOP в EUR, цены конкурентов в USD.',

    sessionPrepTitle: 'Преимущество подготовки к сессии: приходить с шестью днями контекста',
    sessionPrepP1:
      'Сравните два сценария. В первом вы открываете понедельничную сессию с чистым экраном и спрашиваете «Как прошла неделя?». Клиент даёт двухминутный пересказ, отфильтрованный через то, как он себя чувствует прямо сейчас. Во втором вы провели пять минут перед сессией, прочитав голосовую заметку со вторника, текстовую запись четверга об одном конфликте и выполненное упражнение, которое назначили на прошлой неделе.',
    sessionPrepP2:
      'Второй сценарий — это то, что PR-TOP делает нормой. Дневник — не дополнительный контекст, а основная запись между сессиями. Психологи, которые используют его постоянно, отмечают, что сессии уходят вглубь быстрее, клиенты чувствуют себя услышанными без необходимости всё переобъяснять, а терапевтический контакт приобретает большую непрерывность, чем обычно может обеспечить еженедельный 50-минутный слот.',
    sessionPrepP3:
      'Именно поэтому PR-TOP объединяет дневник с упражнениями и кризисными оповещениями в одном канале. Назначить упражнение и увидеть, выполнил ли его клиент — зафиксированное как запись дневника — замыкает петлю, которую бумажные задания никогда не замыкали. А если клиент находится в кризисе между сессиями, кнопка SOS в Telegram доходит до вас немедленно, а не в часы приёма.',
    sessionPrepLead: 'Смотрите также: ',
    sessionPrepLinkCoaches: 'PR-TOP для коучей',
    sessionPrepAnd: ' и ',
    sessionPrepLinkCoaching: 'управление коучинговыми сессиями',
    sessionPrepTail: '.',

    privacyTitle: 'Конфиденциальность и согласие: как PR-TOP защищает данные дневника клиента',
    privacyP1:
      'Записи дневника клиента — это данные класса A в двухуровневой модели шифрования PR-TOP. Каждое голосовое сообщение, текстовая запись и видеоклип шифруются с AES на уровне приложения до того, как попасть в базу данных. База хранит шифротекст. Взлом сервера не раскроет содержимое — красть будет нечего.',
    privacyP2:
      'Согласие структурно, а не декларативно. Система не отображает записи дневника клиента с неактивным статусом согласия — независимо от того, кто вошёл в систему. Психологи могут выдавать, отзывать и проверять статус согласия из кабинета. Клиенты могут запросить экспорт или удаление данных через Telegram-бот, а вы можете удалить всю запись клиента одним действием в кабинете. Вся обработка проходит на инфраструктуре ЕС (Hetzner), с аналитикой на self-hosted Umami и без сторонних трекеров. DPA включён по умолчанию, а не по запросу.',
    privacyLead: 'Подробности: ',
    privacyLinkEncryption: 'архитектура шифрования',
    privacyAnd: ' и ',
    privacyLinkGdpr: 'соответствие GDPR',
    privacyTail: '.',

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'Какие типы записей клиент может отправлять через Telegram?',
        a: 'Клиенты могут отправлять три типа записей через Telegram-бот PR-TOP: голосовые сообщения (любой продолжительности), текстовые записи (набранные сообщения) и короткие видеоклипы. Все три формата шифруются как данные класса A сразу при получении и появляются на временной шкале клиента в кабинете психолога. Клиентам не нужно скачивать отдельное приложение — если они уже пользуются Telegram, никакой дополнительной настройки с их стороны не требуется.',
      },
      {
        q: 'Как дневник клиента отображается в кабинете психолога?',
        a: 'У каждого клиента есть временная шкала в кабинете PR-TOP, на которой записи дневника, выполнения упражнений, заметки к сессиям и AI-резюме отображаются в хронологическом порядке. Записи дневника показывают тип (голос / текст / видео), время и расшифрованное содержимое. Голосовые и видеозаписи можно воспроизводить прямо в кабинете. Временная шкала даёт полную картину недели ещё до того, как вы откроете сессию — без переключения между инструментами или поиска сообщений в чате.',
      },
      {
        q: 'Могут ли клиенты видеть записи дневников друг друга?',
        a: 'Нет. Дневник каждого клиента полностью изолирован. Клиенты взаимодействуют только со своим личным экземпляром Telegram-бота и видят только свои записи. Психологи видят только клиентов своего аккаунта. Нет общего пространства, нет группового просмотра и нет возможности для данных одного клиента попасть в запись другого. Контроль согласия добавляет второй уровень: даже для собственных клиентов психолога записи клиента с неактивным согласием не отображаются.',
      },
      {
        q: 'Что происходит, если клиент отправляет SOS через Telegram?',
        a: 'В Telegram-боте PR-TOP есть кнопка SOS в одно касание. Когда клиент нажимает её, PR-TOP немедленно отправляет многоканальное оповещение психологу: уведомление в кабинете и email на зарегистрированный адрес. SOS также фиксируется на временной шкале клиента с отметкой времени и статусом жизненного цикла (активирован, принят, закрыт). Психологи могут обновлять статус SOS из кабинета, создавая полный аудиттрейл обработки каждого кризисного события.',
      },
      {
        q: 'Заменяет ли дневник клиента заметки к сессиям?',
        a: 'Нет — он их дополняет. Заметки к сессиям (транскрипция через Whisper, AI-резюме) фиксируют то, что произошло во время приёма. Дневник клиента фиксирует то, что произошло между приёмами. Оба отображаются на временной шкале клиента в одном кабинете, давая непрерывную запись, которую ни один из инструментов не мог бы обеспечить по отдельности. Большинство психологов PR-TOP используют дневник и заметки к сессиям вместе; некоторые также используют специализированный инструмент для заметок рядом с PR-TOP для более глубоких клинических шаблонов.',
      },
      {
        q: 'Можно ли попробовать функцию дневника клиента без банковской карты?',
        a: 'Да. Бесплатный тариф Trial включает полный дневник клиента — голосовые, текстовые и видеозаписи через Telegram — а также зашифрованный кабинет, назначение упражнений и SOS-оповещения для ограниченного числа клиентов. Карта не нужна, и нет автоматического перехода на платный план. Вы переходите только по собственному решению, а экспортировать все данные можно в любой момент.',
      },
    ],

    ctaTitle: 'Начните читать недели своих клиентов, а не только сессии',
    ctaText:
      'Настройка бесплатного Trial занимает около десяти минут и включает полный дневник клиента. Без банковской карты. Если PR-TOP не вписывается в ваш рабочий процесс, вы можете выгрузить все данные и уйти без привязки.',
    ctaButton: 'Начать бесплатно',
    ctaLinkNotes: 'AI-заметки к сессии для психологов',
    ctaLinkDocs: 'AI-документация для терапии',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'Щоденник клієнта для психологів — зашифрований Telegram-щоденник PR-TOP (2026)',
    seoDescription:
      'Щоденник клієнта для психологів через Telegram: голосові, текстові та відеозаписи у зашифрованому кабінеті PR-TOP. Спробуйте безкоштовно зараз.',
    articleHeadline: 'Щоденник клієнта для психологів — як PR-TOP підтримує зв\'язок із клієнтами між сесіями',
    articleDescription:
      'Повний посібник зі щоденника клієнта для психологів у PR-TOP: голос, текст і відео через Telegram, зашифрований кабінет з AES, контроль згоди та контекст до кожної сесії.',
    badge: 'Посібник з функції',
    h1: 'Щоденник клієнта для психологів — як PR-TOP підтримує зв\'язок із клієнтами',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',

    intro:
      'Щоденник клієнта для психологів фіксує те, що відбувається між зустрічами — саме там проходить реальне життя клієнта. PR-TOP дає кожному клієнту Telegram-канал для голосових нотаток, текстових записів і коротких відео. Ви бачите все у зашифрованому кабінеті з контролем згоди та готовим контекстом перед кожною сесією.',

    whyDiaryTitle: 'Чому щоденник клієнта важливий у психологічній практиці',
    whyDiaryP1:
      'Сесія триває 50 хвилин. Решта 10 030 хвилин тижня — це те, де клієнт насправді переживає свої труднощі, робить прогрес, зривається і відновлюється. Психолог, який приходить на понеділкову зустріч без цього контексту, працює по пам\'яті та відредагованому самозвіту клієнта, а не за реальною картиною тижня.',
    whyDiaryP2:
      'Найчастіша скарга психологів на роботу між сесіями — не те, що її нема, а те, що інформація не доходить до них структуровано. Клієнти пишуть у WhatsApp (ризик GDPR), забувають, що записали в паперовий щоденник, або просто не знають, що фіксувати. У підсумку цінні дані між сесіями або взагалі не з\'являються, або існують у розрізнених каналах, які так і не потрапляють до терапевтичного запису.',
    whyDiaryP3:
      'Структурований зашифрований щоденник клієнта всередині тієї самої платформи, де зберігаються нотатки до сесій, змінює це. Контекст надходить автоматично. Ви перестаєте витрачати перші десять хвилин кожної сесії на відновлення тижня. Ви починаєте глибше і швидше.',

    howPrtopTitle: 'Як працює щоденник клієнта в PR-TOP',
    howPrtopP1:
      'Кожен клієнт, якого ви додаєте до PR-TOP, отримує особистий Telegram-бот. Він відкриває бота з телефону й одним дотиком надсилає голосове повідомлення, вводить текст або завантажує коротке відео. Не потрібно завантажувати застосунок, реєструвати акаунт, долати бар\'єри — якщо клієнт уже користується Telegram, щоденник доступний за один дотик. Через того самого бота ви можете призначати вправи та відстежувати, чи виконав їх клієнт до наступної сесії.',
    howPrtopP2:
      'На вашому боці кожен запис щоденника, відповідь на вправу та кризове сповіщення з\'являються на часовій шкалі клієнта у зашифрованому кабінеті PR-TOP. Записи шифруються як дані класу A на рівні застосунку до того, як потрапити до бази даних — тобто база зберігає шифротекст, а не відкриті дані клієнтів. Натискання SOS від клієнта надсилає багатоканальне сповіщення (повідомлення в кабінеті, email) прямо вам. Уся активність щоденника потрапляє до того самого кабінету, що й транскрипти сесій та AI-резюме, — запис по кожному клієнту повний в одному місці.',
    howPrtopP3:
      'Згода контролюється на рівні даних, а не як галочка в політиці. Клієнт з неактивним статусом згоди не дозволяє переглядати його щоденник, і жоден запис не відображається до підтвердження згоди. Це не налаштування — це структурна вимога.',
    howPrtopLead: 'Дивіться також: ',
    howPrtopLinkNotes: 'AI-нотатки до сесії для психологів',
    howPrtopAnd: ' та ',
    howPrtopLinkDocs: 'AI-документація для терапії',
    howPrtopTail: '.',

    tableTitle: 'Порівняння: підходи до щоденника клієнта та роботи між сесіями (2026)',
    tableHead: {
      approach: 'Підхід',
      cost: 'Вартість',
      diaryType: 'Тип щоденника',
      visibility: 'Видимість психологу',
      encryption: 'Шифрування',
      bestFor: 'Кому підходить',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        cost: 'Безкоштовний Trial → €9/міс Basic',
        diaryType: 'Голос + текст + відео через Telegram',
        visibility: 'У реальному часі у зашифрованому кабінеті',
        encryption: 'AES на рівні застосунку',
        bestFor: 'Психологам, яким потрібен структурований зашифрований контекст між сесіями',
      },
      {
        label: 'Паперовий щоденник',
        cost: '$0',
        diaryType: 'Рукописний (клієнт контролює)',
        visibility: 'Тільки на сесії — клієнт приносить',
        encryption: 'Нема',
        bestFor: 'Традиційні практики з очними сесіями та обмеженим бюджетом',
      },
      {
        label: 'Месенджери (WhatsApp, Signal)',
        cost: '$0',
        diaryType: 'Текст / голосові повідомлення',
        visibility: 'У реальному часі в чаті',
        encryption: 'Тільки транспортний рівень',
        bestFor: 'Неформальні практики — ризик GDPR, немає структурованого запису',
      },
      {
        label: 'Upheal',
        cost: 'Від ~$79/міс',
        diaryType: 'Нема (лише нотатки до сесій)',
        visibility: 'Лише нотатки до сесій',
        encryption: 'Так',
        bestFor: 'Workflow для нотаток і EHR — немає каналу з клієнтом між сесіями',
      },
      {
        label: 'Кастомний застосунок',
        cost: 'Від $3 000 за розробку',
        diaryType: 'Залежить від реалізації',
        visibility: 'Кабінет (якщо побудований)',
        encryption: 'Залежить від реалізації',
        bestFor: 'Великі клініки з IT-бюджетом і ресурсами розробників',
      },
    ],
    tableNote:
      'Ціни звірено з публічними сторінками кожного вендора у липні 2026. Оновлюються щокварталу. Ціни PR-TOP в EUR, ціни конкурентів в USD.',

    sessionPrepTitle: 'Перевага підготовки до сесії: приходити з шістьма днями контексту',
    sessionPrepP1:
      'Порівняйте два сценарії. У першому ви відкриваєте понеділкову сесію з чистим екраном і питаєте «Як минув тиждень?». Клієнт дає двохвилинний переказ, відфільтрований через те, як він почувається зараз. У другому ви провели п\'ять хвилин перед сесією, прочитавши голосову нотатку з вівторка, текстовий запис четверга про один конфлікт і виконану вправу, яку призначили минулого тижня.',
    sessionPrepP2:
      'Другий сценарій — це те, що PR-TOP робить нормою. Щоденник — це не додатковий контекст, а основний запис між сесіями. Психологи, які використовують його постійно, зазначають, що сесії йдуть глибше швидше, клієнти почуваються почутими без потреби все пояснювати заново, а терапевтичний контакт набуває більшої безперервності, ніж зазвичай може забезпечити щотижневий 50-хвилинний слот.',
    sessionPrepP3:
      'Саме тому PR-TOP поєднує щоденник із вправами та кризовими сповіщеннями в одному каналі. Призначити вправу і побачити, чи виконав її клієнт — зафіксоване як запис щоденника — замикає петлю, яку паперові завдання ніколи не замикали. А якщо клієнт перебуває в кризі між сесіями, кнопка SOS у Telegram доходить до вас негайно, а не в години прийому.',
    sessionPrepLead: 'Дивіться також: ',
    sessionPrepLinkCoaches: 'PR-TOP для коучів',
    sessionPrepAnd: ' та ',
    sessionPrepLinkCoaching: 'управління коучинговими сесіями',
    sessionPrepTail: '.',

    privacyTitle: 'Конфіденційність і згода: як PR-TOP захищає дані щоденника клієнта',
    privacyP1:
      'Записи щоденника клієнта — це дані класу A в двохрівневій моделі шифрування PR-TOP. Кожне голосове повідомлення, текстовий запис і відеокліп шифруються з AES на рівні застосунку до того, як потрапити до бази даних. База зберігає шифротекст. Злом сервера не розкриє вміст — красти буде нічого.',
    privacyP2:
      'Згода структурна, а не декларативна. Система не відображає записи щоденника клієнта з неактивним статусом згоди — незалежно від того, хто увійшов у систему. Психологи можуть видавати, відкликати й перевіряти статус згоди з кабінету. Клієнти можуть запросити експорт або видалення даних через Telegram-бота, а ви можете видалити весь запис клієнта однією дією в кабінеті. Уся обробка відбувається на інфраструктурі ЄС (Hetzner), з аналітикою на self-hosted Umami і без сторонніх трекерів. DPA включено за замовчуванням, а не за запитом.',
    privacyLead: 'Докладніше: ',
    privacyLinkEncryption: 'архітектура шифрування',
    privacyAnd: ' та ',
    privacyLinkGdpr: 'відповідність GDPR',
    privacyTail: '.',

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'Які типи записів клієнт може надсилати через Telegram?',
        a: 'Клієнти можуть надсилати три типи записів через Telegram-бот PR-TOP: голосові повідомлення (будь-якої тривалості), текстові записи (набрані повідомлення) та короткі відеокліпи. Усі три формати шифруються як дані класу A одразу при отриманні й з\'являються на часовій шкалі клієнта в кабінеті психолога. Клієнтам не потрібно завантажувати окремий застосунок — якщо вони вже користуються Telegram, жодного додаткового налаштування з їхнього боку не потрібно.',
      },
      {
        q: 'Як щоденник клієнта відображається в кабінеті психолога?',
        a: 'У кожного клієнта є часова шкала в кабінеті PR-TOP, на якій записи щоденника, виконання вправ, нотатки до сесій і AI-резюме відображаються в хронологічному порядку. Записи щоденника показують тип (голос / текст / відео), час і розшифрований вміст. Голосові й відеозаписи можна відтворювати прямо в кабінеті. Часова шкала дає повну картину тижня ще до того, як ви відкриєте сесію — без перемикання між інструментами або пошуку повідомлень у чаті.',
      },
      {
        q: 'Чи можуть клієнти бачити записи щоденників одне одного?',
        a: 'Ні. Щоденник кожного клієнта повністю ізольований. Клієнти взаємодіють лише зі своїм особистим екземпляром Telegram-бота і бачать лише свої записи. Психологи бачать лише клієнтів свого акаунту. Немає спільного простору, немає групового перегляду і немає можливості для даних одного клієнта потрапити до запису іншого. Контроль згоди додає другий рівень: навіть для власних клієнтів психолога записи клієнта з неактивною згодою не відображаються.',
      },
      {
        q: 'Що відбувається, якщо клієнт надсилає SOS через Telegram?',
        a: 'У Telegram-боті PR-TOP є кнопка SOS в один дотик. Коли клієнт натискає її, PR-TOP негайно надсилає багатоканальне сповіщення психологу: повідомлення в кабінеті та email на зареєстровану адресу. SOS також фіксується на часовій шкалі клієнта з відміткою часу та статусом життєвого циклу (активовано, прийнято, закрито). Психологи можуть оновлювати статус SOS з кабінету, створюючи повний аудитслід обробки кожної кризової події.',
      },
      {
        q: 'Чи замінює щоденник клієнта нотатки до сесій?',
        a: 'Ні — він їх доповнює. Нотатки до сесій (транскрипція через Whisper, AI-резюме) фіксують те, що відбувалося під час прийому. Щоденник клієнта фіксує те, що відбувалося між прийомами. Обидва відображаються на часовій шкалі клієнта в одному кабінеті, даючи безперервний запис, який жоден із інструментів не міг би забезпечити окремо. Більшість психологів PR-TOP використовують щоденник і нотатки до сесій разом; деякі також використовують спеціалізований інструмент для нотаток поряд із PR-TOP для глибших клінічних шаблонів.',
      },
      {
        q: 'Чи можна спробувати функцію щоденника клієнта без банківської картки?',
        a: 'Так. Безкоштовний тариф Trial включає повний щоденник клієнта — голосові, текстові та відеозаписи через Telegram — а також зашифрований кабінет, призначення вправ і SOS-сповіщення для обмеженої кількості клієнтів. Картка не потрібна і немає автоматичного переходу на платний план. Ви переходите лише за власним рішенням, а експортувати всі дані можна будь-коли.',
      },
    ],

    ctaTitle: 'Почніть читати тижні своїх клієнтів, а не лише сесії',
    ctaText:
      'Налаштування безкоштовного Trial займає близько десяти хвилин і включає повний щоденник клієнта. Без банківської картки. Якщо PR-TOP не вписується у ваш робочий процес, ви можете вивантажити всі дані й піти без прив\'язки.',
    ctaButton: 'Почати безкоштовно',
    ctaLinkNotes: 'AI-нотатки до сесії для психологів',
    ctaLinkDocs: 'AI-документація для терапії',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Diario del cliente para terapeutas — diario Telegram cifrado de PR-TOP (2026)',
    seoDescription:
      'Diario del cliente para terapeutas vía Telegram: entradas de voz, texto y vídeo cifradas en el panel de PR-TOP. Vea el contexto de cada sesión. Prueba gratis.',
    articleHeadline: 'Diario del cliente para terapeutas — cómo PR-TOP mantiene la conexión entre sesiones',
    articleDescription:
      'Guía completa del diario del cliente para terapeutas en PR-TOP: voz, texto y vídeo vía Telegram, panel cifrado con AES, control de consentimiento y contexto listo para cada sesión.',
    badge: 'Guía de funciones',
    h1: 'Diario del cliente para terapeutas — cómo PR-TOP mantiene la conexión entre sesiones',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',

    intro:
      'Un diario del cliente para terapeutas captura lo que ocurre entre citas — los momentos en que la terapia realmente importa. PR-TOP da a cada cliente un canal de Telegram para notas de voz, entradas de texto o vídeos cortos. Usted lo ve todo en un panel cifrado, con consentimiento aplicado y contexto listo antes de cada sesión.',

    whyDiaryTitle: 'Por qué los diarios de clientes importan en la práctica terapéutica',
    whyDiaryP1:
      'Las sesiones duran 50 minutos. Los otros 10.030 minutos de la semana son donde los clientes realmente viven sus dificultades, avanzan, se desmoronan y se recuperan. Un terapeuta que llega a la cita del lunes sin ese contexto trabaja desde la memoria y el informe editado del cliente, no desde el registro real de cómo fue la semana.',
    whyDiaryP2:
      'La queja más común de los terapeutas sobre el trabajo entre sesiones no es que no ocurra — es que la información nunca les llega de manera estructurada. Los clientes escriben por WhatsApp (riesgo GDPR), olvidan lo que anotaron en un diario de papel, o simplemente no saben qué registrar. El resultado es que los datos valiosos entre sesiones o no existen, o existen en silos que nunca se conectan con el registro terapéutico.',
    whyDiaryP3:
      'Un diario de cliente estructurado y cifrado dentro de la misma plataforma que sus notas de sesión cambia eso. El contexto llega automáticamente. Deja de gastar los primeros diez minutos de cada sesión en reconstruir la semana. Empieza más profundo, más rápido.',

    howPrtopTitle: 'Cómo funciona el diario del cliente en PR-TOP',
    howPrtopP1:
      'Cada cliente que usted añade a PR-TOP recibe una interfaz personal de bot de Telegram. Abre el bot desde su teléfono y toca para enviar un mensaje de voz, escribir una entrada de texto o subir un vídeo corto. Sin descargar ninguna app, sin registrar una cuenta, sin fricciones — si ya usan Telegram, el diario está a un toque. También puede asignar ejercicios a través del mismo bot y ver si los clientes los completan antes de la próxima sesión.',
    howPrtopP2:
      'En su lado, cada entrada de diario, respuesta a un ejercicio y alerta de crisis aparece en la línea de tiempo del cliente en el panel cifrado de PR-TOP. Las entradas se cifran como datos de clase A en la capa de aplicación antes de llegar a la base de datos — lo que significa que la base de datos almacena texto cifrado, no el contenido del cliente en texto claro. Un SOS con un toque del cliente envía una alerta multicanal (notificación en el panel, correo electrónico) directamente a usted. Toda la actividad del diario fluye al mismo panel que las transcripciones de sesiones y los resúmenes de IA, de modo que el registro de cada cliente está completo en un solo lugar.',
    howPrtopP3:
      'El consentimiento se aplica en la capa de datos, no como una casilla de verificación de política. Un cliente cuyo estado de consentimiento está inactivo no permite ver su diario, y no se muestra ningún dato hasta que se confirme el consentimiento. Esto no es configurable — es estructural.',
    howPrtopLead: 'Consulte también: ',
    howPrtopLinkNotes: 'notas de sesión con IA para terapeutas',
    howPrtopAnd: ' y ',
    howPrtopLinkDocs: 'documentación terapéutica con IA',
    howPrtopTail: '.',

    tableTitle: 'Comparativa: enfoques para el diario del cliente y el seguimiento entre sesiones (2026)',
    tableHead: {
      approach: 'Enfoque',
      cost: 'Coste',
      diaryType: 'Tipo de diario',
      visibility: 'Visibilidad del terapeuta',
      encryption: 'Cifrado',
      bestFor: 'Ideal para',
    },
    tableRows: [
      {
        label: 'PR-TOP',
        cost: 'Trial gratuito → €9/mes Basic',
        diaryType: 'Voz + texto + vídeo vía Telegram',
        visibility: 'Tiempo real en panel cifrado',
        encryption: 'AES capa de aplicación',
        bestFor: 'Terapeutas que quieren información estructurada y cifrada entre sesiones',
      },
      {
        label: 'Diario de papel',
        cost: '$0',
        diaryType: 'Escrito (cliente lo controla)',
        visibility: 'Solo en la sesión — cliente lo trae',
        encryption: 'Ninguno',
        bestFor: 'Prácticas tradicionales con sesiones presenciales y presupuesto limitado',
      },
      {
        label: 'Mensajería genérica (WhatsApp, Signal)',
        cost: '$0',
        diaryType: 'Texto / mensajes de voz',
        visibility: 'Tiempo real en el chat',
        encryption: 'Solo nivel de transporte',
        bestFor: 'Prácticas informales — riesgo GDPR, sin registro estructurado',
      },
      {
        label: 'Upheal',
        cost: 'Desde ~$79/mes',
        diaryType: 'Ninguno (solo notas de sesión)',
        visibility: 'Solo notas de sesión',
        encryption: 'Sí',
        bestFor: 'Flujo de trabajo de notas / EHR — sin canal entre sesiones para clientes',
      },
      {
        label: 'App cliente personalizada',
        cost: 'Desde $3.000 de desarrollo',
        diaryType: 'Varía según la implementación',
        visibility: 'Panel (si se construye)',
        encryption: 'Varía',
        bestFor: 'Clínicas grandes con presupuesto de IT y recursos de desarrollo',
      },
    ],
    tableNote:
      'Precios verificados en las páginas públicas de cada proveedor en julio de 2026. Las cifras se actualizan cada trimestre. Los precios de PR-TOP están en EUR; los de los competidores, en USD.',

    sessionPrepTitle: 'La ventaja de la preparación de sesión: llegar con seis días de contexto',
    sessionPrepP1:
      'Compare dos escenarios. En el primero, abre la sesión del lunes con la pantalla en blanco y pregunta "¿Cómo fue la semana?". El cliente da un resumen de dos minutos filtrado por cómo se siente ahora mismo. En el segundo, pasó cinco minutos antes de la sesión leyendo una nota de voz del martes, una entrada de texto del jueves sobre un conflicto y el ejercicio completado que asignó la semana anterior.',
    sessionPrepP2:
      'El segundo escenario es lo que PR-TOP convierte en rutina. El diario no es contexto suplementario — es el registro primario entre sesiones. Los terapeutas que lo usan de forma consistente informan que las sesiones van más profundo más rápido, que los clientes se sienten escuchados sin tener que volver a explicar todo, y que la relación terapéutica tiene más continuidad de la que normalmente puede ofrecer un turno semanal de 50 minutos.',
    sessionPrepP3:
      'Esta es también la razón por la que PR-TOP combina el diario con ejercicios y alertas de crisis en el mismo canal. Asignar un ejercicio y ver si el cliente realmente lo hizo — capturado como una entrada de diario — cierra el bucle que las tareas en papel nunca cierran. Y si un cliente está en crisis entre sesiones, el botón SOS en Telegram le llega de inmediato, no durante el horario de atención.',
    sessionPrepLead: 'Consulte también: ',
    sessionPrepLinkCoaches: 'PR-TOP para coaches',
    sessionPrepAnd: ' y ',
    sessionPrepLinkCoaching: 'gestión de sesiones de coaching',
    sessionPrepTail: '.',

    privacyTitle: 'Privacidad y consentimiento: cómo PR-TOP protege los datos del diario del cliente',
    privacyP1:
      'Las entradas del diario del cliente son datos de clase A en el modelo de cifrado de dos niveles de PR-TOP. Cada nota de voz, entrada de texto y videoclip se cifra con AES en la capa de aplicación antes de que la base de datos los vea. La base de datos almacena texto cifrado. Una brecha en el servidor no expone el contenido del cliente — no hay texto claro que robar.',
    privacyP2:
      'El consentimiento es estructural, no consultivo. El sistema se niega a mostrar entradas de diario de un cliente cuyo consentimiento está inactivo, independientemente de quién haya iniciado sesión. Los terapeutas pueden otorgar, revocar y auditar el estado de consentimiento desde el panel. Los clientes pueden solicitar exportación o eliminación de datos a través del bot de Telegram, y usted puede borrar un registro completo de cliente en una sola acción del panel. Todo el procesamiento se ejecuta en infraestructura de la UE (Hetzner), con análisis en Umami autoalojado y sin rastreadores de terceros. Un Addendum de Procesamiento de Datos está incluido por defecto, no bajo petición.',
    privacyLead: 'Detalles: ',
    privacyLinkEncryption: 'arquitectura de cifrado',
    privacyAnd: ' y ',
    privacyLinkGdpr: 'cumplimiento del GDPR',
    privacyTail: '.',

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿Qué tipos de entradas de diario pueden enviar los clientes vía Telegram?',
        a: 'Los clientes pueden enviar tres tipos de entradas de diario a través del bot de Telegram de PR-TOP: mensajes de voz (grabaciones habladas de cualquier duración), entradas de texto (mensajes escritos) y videoclips cortos. Los tres formatos se cifran como datos de clase A de inmediato al recibirlos y aparecen en la línea de tiempo del cliente en el panel del terapeuta. Los clientes no necesitan descargar una app separada — si ya usan Telegram, no se requiere ninguna configuración adicional por su parte.',
      },
      {
        q: '¿Cómo aparece el diario del cliente en el panel del terapeuta?',
        a: 'Cada cliente tiene una vista de línea de tiempo en el panel de PR-TOP que muestra las entradas de diario, las completaciones de ejercicios, las notas de sesión y los resúmenes de IA en orden cronológico. Las entradas de diario muestran el tipo (voz / texto / vídeo), la marca de tiempo y el contenido descifrado. Las entradas de voz y vídeo se pueden reproducir en línea. La línea de tiempo le da una imagen completa de la semana antes de abrir una sesión — sin cambiar entre herramientas ni buscar mensajes en una app de chat.',
      },
      {
        q: '¿Pueden los clientes ver las entradas de diario de los demás?',
        a: 'No. El diario de cada cliente está completamente aislado. Los clientes interactúan solo con su propia instancia personal del bot de Telegram y solo pueden ver sus propias entradas. Los terapeutas solo ven los clientes de su propia cuenta. No hay espacio compartido, no hay vista de grupo y no hay forma de que los datos de un cliente aparezcan en el registro de otro. La aplicación del consentimiento añade una segunda capa: incluso para los propios clientes de un terapeuta, las entradas de un cliente con consentimiento inactivo no se pueden mostrar.',
      },
      {
        q: '¿Qué ocurre si un cliente envía un SOS vía Telegram?',
        a: 'El bot de Telegram de PR-TOP incluye un botón de SOS con un toque. Cuando un cliente lo activa, PR-TOP envía inmediatamente una alerta multicanal al terapeuta: una notificación en el panel y un correo electrónico a la dirección del terapeuta registrado. El SOS también se registra en la línea de tiempo del cliente con una marca de tiempo y un estado de ciclo de vida (activado, reconocido, resuelto). Los terapeutas pueden actualizar el estado del SOS desde el panel, creando un historial de auditoría completo de cómo se manejó cada evento de crisis.',
      },
      {
        q: '¿El diario del cliente reemplaza las notas de sesión?',
        a: 'No — las complementa. Las notas de sesión (transcripción vía Whisper, resumen de IA) capturan lo que ocurrió durante la cita. El diario del cliente captura lo que ocurrió entre citas. Ambos aparecen en la línea de tiempo del cliente en el mismo panel, dando un registro continuo que ninguna herramienta podría proporcionar por sí sola. La mayoría de los terapeutas de PR-TOP usan el diario y las notas de sesión juntos; algunos también usan un tomador de notas especializado junto a PR-TOP para formatos de plantillas clínicas más profundos.',
      },
      {
        q: '¿Puedo probar la función de diario del cliente sin tarjeta de crédito?',
        a: 'Sí. El nivel Trial gratuito incluye el diario del cliente completo — entradas de voz, texto y vídeo vía Telegram — junto con el panel cifrado, la asignación de ejercicios y las alertas SOS para un número limitado de clientes. No se requiere tarjeta de crédito y no hay conversión automática a un plan de pago. Solo cambia de plan cuando usted lo decide, y puede exportar todos sus datos en cualquier momento.',
      },
    ],

    ctaTitle: 'Empiece a leer las semanas de sus clientes, no solo las sesiones',
    ctaText:
      'La versión Trial gratuita se configura en unos diez minutos e incluye el diario del cliente completo. Sin tarjeta de crédito. Si PR-TOP no encaja en su flujo de trabajo, puede exportar todos sus datos e irse sin ataduras.',
    ctaButton: 'Empezar gratis',
    ctaLinkNotes: 'Notas de sesión con IA para terapeutas',
    ctaLinkDocs: 'Documentación terapéutica con IA',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function ClientDiaryForTherapists() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const c = CONTENT[locale] || CONTENT.en;
  const lp = useLocalePath();
  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : `/${locale}`}/client-diary-for-therapists`;

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
        path="/client-diary-for-therapists"
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

        {/* Rule 7 — PR-TOP wedge in first H2: why client diaries matter. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whyDiaryTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whyDiaryP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whyDiaryP2}</p>
          <p className="text-gray-700 leading-relaxed">{c.whyDiaryP3}</p>
        </section>

        {/* Rule 7 — PR-TOP wedge in second H2: how the PR-TOP diary works. */}
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
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.approach}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.cost}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.diaryType}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.visibility}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.encryption}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.bestFor}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.tableRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="p-3 border border-gray-200 font-medium whitespace-nowrap">{row.label}</td>
                    <td className="p-3 border border-gray-200">{row.cost}</td>
                    <td className="p-3 border border-gray-200">{row.diaryType}</td>
                    <td className="p-3 border border-gray-200">{row.visibility}</td>
                    <td className="p-3 border border-gray-200">{row.encryption}</td>
                    <td className="p-3 border border-gray-200">{row.bestFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">{c.tableNote}</p>
        </section>

        {/* Session prep advantage */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.sessionPrepTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.sessionPrepP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.sessionPrepP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.sessionPrepP3}</p>
          {/* Rule 6 — internal links to sibling pages. */}
          <p className="text-gray-700 leading-relaxed">
            {c.sessionPrepLead}
            <Link to={lp('/for-coaches')} className="text-primary underline hover:no-underline">
              {c.sessionPrepLinkCoaches}
            </Link>
            {c.sessionPrepAnd}
            <Link to={lp('/coaching-session-management')} className="text-primary underline hover:no-underline">
              {c.sessionPrepLinkCoaching}
            </Link>
            {c.sessionPrepTail}
          </p>
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
              to={lp('/ai-session-notes-for-therapists')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkNotes}
            </Link>
            <Link
              to={lp('/therapy-documentation-ai')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkDocs}
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
