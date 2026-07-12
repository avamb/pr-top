import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /compare/mentalyc  —  PR-TOP vs Mentalyc comparison (F21, localized en/ru/uk/es).
 *
 * Follows docs/seo/CONTENT_RULES.md (mirrors CompareUpheal structure):
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest feature/price <table>
 *   4. FAQ block + FAQPage JSON-LD
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to /, /alternatives/mentalyc, /security/gdpr,
 *      /security/data-sovereignty (both are privacy-first angles)
 *   7. PR-TOP wedge: Mentalyc ends at documentation; PR-TOP adds the
 *      client-facing between-session layer (diary + exercises + SOS + Telegram)
 *
 * Competitor data source (verified 2026-07):
 *   https://www.mentalyc.com/  https://www.mentalyc.com/pricing
 *   Mentalyc's own privacy angle: anonymized transcripts, no long-term
 *   audio storage, HIPAA-first. Acknowledged honestly below.
 */

const CONTENT = {
  en: {
    seoTitle: 'PR-TOP vs Mentalyc (2026) — honest comparison for therapists',
    seoDescription:
      'Mentalyc is a privacy-first AI note-taker for therapists. PR-TOP adds the between-session layer: Telegram diary, exercises, SOS. EU-hosted.',
    articleHeadline: 'PR-TOP vs Mentalyc — comparison for therapists (2026)',
    articleDescription:
      'Honest 2026 comparison of Mentalyc (privacy-first AI note-taker) and PR-TOP (therapist-controlled between-session assistant with Telegram client bot).',
    badge: 'Comparison',
    h1: 'PR-TOP vs Mentalyc — comparison for therapists',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',
    intro1:
      ' is a privacy-first AI note-taker for therapists, from about $39/mo, HIPAA-aligned and US-hosted.',
    intro2:
      ' is a therapist-controlled between-session assistant: an encrypted dashboard plus a Telegram client bot for diary, exercises and one-tap crisis alerts. Both are privacy-first; they solve different jobs and many EU practices run them together.',
    stopsTitle: 'Where each product stops',
    stopsP1a:
      'Mentalyc ends at documentation: it turns the audio of a session into a clean progress note and stops there. PR-TOP also drafts notes, but its wedge is the space ',
    stopsP1em: 'between',
    stopsP1b:
      ' sessions — a Telegram channel where clients keep a voice/text/video diary, receive exercises, and can trigger an SOS to your inbox. If your bottleneck is writing session notes, Mentalyc is a strong pick. If your bottleneck is preserving client context across the week and reducing double documentation, PR-TOP is built for that.',
    stopsP2:
      'The two are complementary. An EU practice can run Mentalyc (or any AI note-taker) for documentation and PR-TOP for the client-facing channel, because their scopes barely overlap.',
    privacyTitle: 'Two flavours of privacy-first',
    privacyP1a:
      'Mentalyc’s approach: anonymize the transcript on ingest, avoid long-term audio storage, align with US HIPAA. PR-TOP’s approach: keep ',
    privacyP1em: 'everything',
    privacyP1b:
      ' in the EU, encrypt Class A data (diary, transcripts, private notes) at the application layer so the database never holds plaintext, and ship a DPA by default. Both reduce the blast radius of a breach; they just do it from different angles.',
    seeLead: 'See ',
    linkEncryption: 'PR-TOP’s encryption architecture',
    linkGdpr: 'GDPR compliance',
    seeAnd: ' and ',
    linkSovereignty: 'data sovereignty',
    seeTail: ' for the full picture.',
    tableTitle: 'Feature and price comparison (2026)',
    tableHead: { category: 'Category', mentalyc: 'Mentalyc', prtop: 'PR-TOP' },
    tableRows: [
      {
        label: 'Category',
        m: 'Privacy-first AI note-taker for therapists',
        p: 'Between-session assistant + Telegram client bot',
      },
      {
        label: 'Pricing (from)',
        m: 'Limited free tier, then ~$39/mo',
        p: 'Free Trial, then €9/mo Basic, €19/mo Pro',
      },
      {
        label: 'AI session notes',
        m: 'Core product — mature templates (SOAP/DAP/BIRP/GIRP, treatment plans)',
        p: 'Yes (Whisper + configurable providers), simpler templates',
      },
      {
        label: 'Client-facing app',
        m: 'No native client app',
        p: 'Telegram bot (voice/text/video diary, exercises, SOS)',
      },
      {
        label: 'Between-session diary',
        m: 'Not in scope',
        p: 'Yes — voice / text / video, encrypted',
      },
      {
        label: 'Crisis / SOS alerts',
        m: 'Not in scope',
        p: 'One-tap client SOS with multi-channel therapist notify',
      },
      {
        label: 'Privacy model',
        m: 'Anonymized transcripts, HIPAA-aligned, no long-term audio storage',
        p: 'Application-layer AES for Class A data (diary, transcripts, notes)',
      },
      {
        label: 'Hosting / data residency',
        m: 'US-hosted',
        p: 'EU-only (Hetzner), self-hostable',
      },
      {
        label: 'GDPR posture',
        m: 'Standard contractual clauses; US-registered',
        p: 'EU-first; DPA by default; no third-party trackers',
      },
      {
        label: 'Languages',
        m: 'English (primary)',
        p: 'English, Russian, Ukrainian, Spanish',
      },
      {
        label: 'Where it wins',
        m: 'Depth of AI notes, mature clinical templates, strong US privacy story',
        p: 'Between-session continuity, EU/GDPR, client channel in Telegram',
      },
      {
        label: 'Where it loses',
        m: 'No client channel, US-hosted, English-only, US-centric compliance',
        p: 'Simpler note templates, no US-EHR integrations, no scheduling/billing',
      },
      {
        label: 'Best for',
        m: 'US therapists whose top priority is privacy-conscious AI session notes',
        p: 'EU/CIS/LATAM therapists wanting between-session context + a client channel',
      },
    ],
    tableNote:
      'Mentalyc figures verified against mentalyc.com/pricing in July 2026. Numbers refresh quarterly.',
    whenMentalycTitle: 'When to choose Mentalyc',
    whenMentalycItems: [
      'You are a US-based therapist whose top priority is privacy-conscious AI session notes.',
      'You want a mature template library (SOAP/DAP/BIRP/GIRP, treatment plans) out of the box.',
      'Your clients meet with you on Zoom or in person and you do not need a between-session engagement channel.',
      'HIPAA is your compliance frame of reference, not GDPR.',
    ],
    whenPrtopTitle: 'When to choose PR-TOP',
    whenPrtopItems: [
      'You want your clients to keep a real-time diary (voice, text, video) between sessions.',
      'You want a one-tap crisis / SOS channel from the client’s phone to your inbox.',
      'You want to assign exercises and see whether the client actually did them.',
      'You are in the EU or CIS and prefer GDPR-first, EU-hosted software with a DPA by default.',
      'You want your interface (and your clients’ interface) in Russian, Ukrainian or Spanish, not only English.',
    ],
    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'Is PR-TOP a replacement for Mentalyc?',
        a: 'No. Mentalyc is an AI note-taker: it listens to sessions and drafts progress notes in clinical formats (SOAP, DAP, BIRP, GIRP). PR-TOP is a between-session assistant that also drafts notes, but its center of gravity is the client-facing channel — a Telegram bot for diary, exercises and crisis alerts. Many EU therapists use both.',
      },
      {
        q: 'Which is more private — Mentalyc or PR-TOP?',
        a: 'Both are privacy-first, but the models differ. Mentalyc anonymizes transcripts, deletes audio after processing, and is HIPAA-aligned on US infrastructure. PR-TOP is EU-hosted (Hetzner), GDPR-first with a DPA by default, and encrypts Class A data (diary, transcripts, private notes) at the application layer — so the database itself does not hold plaintext client content.',
      },
      {
        q: 'Does Mentalyc work with Telegram or offer a client-facing app?',
        a: 'No. Mentalyc is therapist-facing only: a web app that captures the session and produces the note. PR-TOP is the only comparable tool with a native client channel — clients keep a diary, receive exercises and can trigger an SOS directly inside Telegram, which most EU / CIS / LATAM clients already use daily.',
      },
      {
        q: 'Which is better for GDPR / EU compliance?',
        a: 'PR-TOP. Mentalyc has a solid privacy posture but is US-registered and US-hosted; GDPR compliance for EU therapists relies on standard contractual clauses. PR-TOP is EU-hosted, ships a Data Processing Addendum by default, keeps zero third-party trackers (self-hosted Umami analytics), and lets you export or wipe all encrypted client data on request.',
      },
      {
        q: 'What does PR-TOP not do that Mentalyc does?',
        a: 'Mentalyc has a deeper, more mature clinical-note template library (SOAP/DAP/BIRP/GIRP variants, treatment-plan generators, DSM/ICD prompts) and stronger integrations with US EHRs. PR-TOP’s note templates are simpler and provider-configurable, and it does not integrate with US EHRs. If your priority is depth of AI notes, Mentalyc wins.',
      },
      {
        q: 'Can I try PR-TOP without a credit card?',
        a: 'Yes. PR-TOP has a free Trial tier with the encrypted dashboard, Telegram client bot, diary, exercises and SOS enabled for a limited number of clients. No card is required and there is no automatic conversion to a paid plan — you upgrade only when you choose to.',
      },
    ],
    ctaTitle: 'Try PR-TOP alongside your current tools',
    ctaText:
      'The free Trial takes about ten minutes to set up. No credit card. If you decide it does not fit your workflow, you can export your data and leave with no lock-in.',
    ctaStart: 'Start free trial',
    ctaAlternatives: 'See other Mentalyc alternatives',
    ctaGdpr: 'How PR-TOP handles GDPR',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'PR-TOP или Mentalyc — сравнение для психологов (2026)',
    seoDescription:
      'Mentalyc — приватный AI-инструмент для заметок сессий из США. PR-TOP добавляет работу между сессиями: дневник в Telegram, упражнения, SOS. Хостинг в ЕС, GDPR.',
    articleHeadline: 'PR-TOP или Mentalyc — сравнение для психологов (2026)',
    articleDescription:
      'Честное сравнение 2026 года: Mentalyc (приватный AI-инструмент для заметок сессий) и PR-TOP (ассистент между сессиями под контролем психолога с Telegram-ботом для клиента).',
    badge: 'Сравнение',
    h1: 'PR-TOP или Mentalyc — сравнение для психологов',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',
    intro1:
      ' — приватный AI-инструмент для заметок сессий: от ~$39/мес, ориентация на HIPAA, серверы в США.',
    intro2:
      ' — ассистент между сессиями под контролем психолога: зашифрованный кабинет плюс Telegram-бот для клиента — дневник, упражнения и SOS в одно касание. Оба сервиса ставят приватность на первое место, но решают разные задачи, и многие практики в ЕС используют их вместе.',
    stopsTitle: 'Где заканчивается каждый продукт',
    stopsP1a:
      'Mentalyc заканчивается на документации: он превращает аудиозапись сессии в аккуратную клиническую заметку — и на этом всё. PR-TOP тоже составляет заметки, но его сила — в пространстве ',
    stopsP1em: 'между',
    stopsP1b:
      ' сессиями: Telegram-канал, где клиент ведёт голосовой/текстовый/видео-дневник, получает упражнения и может отправить SOS прямо вам. Если ваше узкое место — написание заметок сессий, Mentalyc будет сильным выбором. Если же вам важно сохранять контекст клиента в течение недели и уйти от двойной документации, PR-TOP создан именно для этого.',
    stopsP2:
      'Эти продукты дополняют друг друга. Практика в ЕС может использовать Mentalyc (или любой другой AI-инструмент для заметок) для документации, а PR-TOP — как канал для клиентов: их зоны почти не пересекаются.',
    privacyTitle: 'Два подхода к приватности',
    privacyP1a:
      'Подход Mentalyc: анонимизировать транскрипт при загрузке, не хранить аудио долгосрочно, ориентироваться на американский HIPAA. Подход PR-TOP: держать ',
    privacyP1em: 'всё',
    privacyP1b:
      ' в ЕС, шифровать данные класса A (дневник, транскрипты, приватные заметки) на уровне приложения — база данных никогда не хранит открытый текст — и включать DPA по умолчанию. Оба подхода уменьшают последствия возможной утечки, просто с разных сторон.',
    seeLead: 'Подробнее: ',
    linkEncryption: 'архитектура шифрования PR-TOP',
    linkGdpr: 'соответствие GDPR',
    seeAnd: ' и ',
    linkSovereignty: 'суверенитет данных',
    seeTail: '.',
    tableTitle: 'Сравнение функций и цен (2026)',
    tableHead: { category: 'Категория', mentalyc: 'Mentalyc', prtop: 'PR-TOP' },
    tableRows: [
      {
        label: 'Категория',
        m: 'Приватный AI-инструмент для заметок сессий',
        p: 'Ассистент между сессиями + Telegram-бот для клиента',
      },
      {
        label: 'Цена (от)',
        m: 'Ограниченный бесплатный тариф, далее ~$39/мес',
        p: 'Бесплатный Trial, далее €9/мес Basic, €19/мес Pro',
      },
      {
        label: 'AI-заметки сессий',
        m: 'Ядро продукта — зрелые шаблоны (SOAP/DAP/BIRP/GIRP, планы терапии)',
        p: 'Да (Whisper + настраиваемые провайдеры), более простые шаблоны',
      },
      {
        label: 'Приложение для клиента',
        m: 'Нет нативного клиентского приложения',
        p: 'Telegram-бот (голосовой/текстовый/видео-дневник, упражнения, SOS)',
      },
      {
        label: 'Дневник между сессиями',
        m: 'Вне рамок продукта',
        p: 'Да — голос / текст / видео, с шифрованием',
      },
      {
        label: 'Кризисные / SOS-оповещения',
        m: 'Вне рамок продукта',
        p: 'SOS клиента в одно касание с мультиканальным уведомлением психолога',
      },
      {
        label: 'Модель приватности',
        m: 'Анонимизированные транскрипты, ориентация на HIPAA, без долгосрочного хранения аудио',
        p: 'AES на уровне приложения для данных класса A (дневник, транскрипты, заметки)',
      },
      {
        label: 'Хостинг / резиденция данных',
        m: 'Хостинг в США',
        p: 'Только ЕС (Hetzner), возможен self-hosting',
      },
      {
        label: 'Позиция по GDPR',
        m: 'Стандартные договорные положения; регистрация в США',
        p: 'EU-first; DPA по умолчанию; без сторонних трекеров',
      },
      {
        label: 'Языки',
        m: 'Английский (основной)',
        p: 'Английский, русский, украинский, испанский',
      },
      {
        label: 'Где выигрывает',
        m: 'Глубина AI-заметок, зрелые клинические шаблоны, сильная приватность по меркам США',
        p: 'Непрерывность между сессиями, ЕС/GDPR, клиентский канал в Telegram',
      },
      {
        label: 'Где проигрывает',
        m: 'Нет клиентского канала, хостинг в США, только английский, комплаенс с прицелом на США',
        p: 'Более простые шаблоны заметок, нет интеграций с американскими EHR, нет расписания и биллинга',
      },
      {
        label: 'Кому подходит',
        m: 'Психологам из США, для которых главное — приватные AI-заметки сессий',
        p: 'Психологам из ЕС/СНГ/LATAM, которым нужны контекст между сессиями и канал для клиентов',
      },
    ],
    tableNote:
      'Данные Mentalyc сверены с mentalyc.com/pricing в июле 2026. Цифры обновляются ежеквартально.',
    whenMentalycTitle: 'Когда выбрать Mentalyc',
    whenMentalycItems: [
      'Вы практикуете в США, и ваш главный приоритет — приватные AI-заметки сессий.',
      'Вам нужна зрелая библиотека шаблонов (SOAP/DAP/BIRP/GIRP, планы терапии) без дополнительной настройки.',
      'Вы встречаетесь с клиентами в Zoom или очно, и канал вовлечения между сессиями вам не нужен.',
      'Ваша система координат в комплаенсе — HIPAA, а не GDPR.',
    ],
    whenPrtopTitle: 'Когда выбрать PR-TOP',
    whenPrtopItems: [
      'Вы хотите, чтобы клиенты вели дневник (голос, текст, видео) между сессиями в реальном времени.',
      'Вам нужен кризисный SOS-канал в одно касание — с телефона клиента прямо к вам.',
      'Вы хотите назначать упражнения и видеть, выполнил ли их клиент на самом деле.',
      'Вы работаете в ЕС или СНГ и предпочитаете GDPR-first софт с хостингом в ЕС и DPA по умолчанию.',
      'Вам нужен интерфейс (и интерфейс ваших клиентов) на русском, украинском или испанском, а не только на английском.',
    ],
    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'PR-TOP заменяет Mentalyc?',
        a: 'Нет. Mentalyc — AI-инструмент для заметок: он слушает сессию и составляет клинические заметки в форматах SOAP, DAP, BIRP, GIRP. PR-TOP — ассистент между сессиями: он тоже составляет заметки, но его центр тяжести — канал для клиента: Telegram-бот с дневником, упражнениями и кризисными оповещениями. Многие психологи в ЕС используют оба сервиса.',
      },
      {
        q: 'Что приватнее — Mentalyc или PR-TOP?',
        a: 'Оба сервиса ставят приватность на первое место, но модели разные. Mentalyc анонимизирует транскрипты, удаляет аудио после обработки и ориентируется на HIPAA на инфраструктуре в США. PR-TOP размещён в ЕС (Hetzner), построен вокруг GDPR с DPA по умолчанию и шифрует данные класса A (дневник, транскрипты, приватные заметки) на уровне приложения — сама база данных не хранит контент клиентов в открытом виде.',
      },
      {
        q: 'Работает ли Mentalyc с Telegram? Есть ли приложение для клиента?',
        a: 'Нет. Mentalyc обращён только к терапевту: веб-приложение записывает сессию и выдаёт заметку. PR-TOP — единственный сопоставимый инструмент с нативным клиентским каналом: клиенты ведут дневник, получают упражнения и могут отправить SOS прямо в Telegram, которым большинство клиентов в ЕС / СНГ / LATAM и так пользуются каждый день.',
      },
      {
        q: 'Что лучше для GDPR и комплаенса в ЕС?',
        a: 'PR-TOP. У Mentalyc сильная позиция по приватности, но компания зарегистрирована и размещена в США; соответствие GDPR для психологов из ЕС опирается на стандартные договорные положения. PR-TOP размещён в ЕС, включает DPA по умолчанию, не использует сторонние трекеры (self-hosted аналитика Umami) и позволяет выгрузить или удалить все зашифрованные данные клиентов по запросу.',
      },
      {
        q: 'Чего PR-TOP не умеет из того, что умеет Mentalyc?',
        a: 'У Mentalyc более глубокая и зрелая библиотека клинических шаблонов (варианты SOAP/DAP/BIRP/GIRP, генераторы планов терапии, подсказки по DSM/ICD) и более сильные интеграции с американскими EHR. Шаблоны заметок в PR-TOP проще и настраиваются провайдером, интеграций с американскими EHR нет. Если ваш приоритет — глубина AI-заметок, выигрывает Mentalyc.',
      },
      {
        q: 'Можно ли попробовать PR-TOP без банковской карты?',
        a: 'Да. У PR-TOP есть бесплатный тариф Trial: зашифрованный кабинет, Telegram-бот для клиентов, дневник, упражнения и SOS доступны для ограниченного числа клиентов. Карта не нужна, автоматического перехода на платный план нет — вы переходите на него только по собственному решению.',
      },
    ],
    ctaTitle: 'Попробуйте PR-TOP вместе с вашими текущими инструментами',
    ctaText:
      'Настройка бесплатного Trial занимает около десяти минут. Без банковской карты. Если решите, что сервис не вписывается в ваш рабочий процесс, вы сможете выгрузить данные и уйти без привязки.',
    ctaStart: 'Начать бесплатно',
    ctaAlternatives: 'Другие альтернативы Mentalyc',
    ctaGdpr: 'Как PR-TOP работает с GDPR',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'PR-TOP чи Mentalyc — порівняння для психологів (2026)',
    seoDescription:
      'Mentalyc — американський AI-інструмент для нотаток сесій. PR-TOP додає роботу між сесіями: щоденник у Telegram, вправи, SOS. Хостинг у ЄС, GDPR.',
    articleHeadline: 'PR-TOP чи Mentalyc — порівняння для психологів (2026)',
    articleDescription:
      'Чесне порівняння 2026 року: Mentalyc (приватний AI-інструмент для нотаток сесій) і PR-TOP (асистент між сесіями під контролем психолога з Telegram-ботом для клієнта).',
    badge: 'Порівняння',
    h1: 'PR-TOP чи Mentalyc — порівняння для психологів',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',
    intro1:
      ' — приватний AI-інструмент для нотаток сесій: від ~$39/міс, орієнтація на HIPAA, сервери у США.',
    intro2:
      ' — асистент між сесіями під контролем психолога: зашифрований кабінет плюс Telegram-бот для клієнта — щоденник, вправи та SOS в один дотик. Обидва сервіси ставлять приватність на перше місце, але розв’язують різні задачі, і багато практик у ЄС використовують їх разом.',
    stopsTitle: 'Де закінчується кожен продукт',
    stopsP1a:
      'Mentalyc закінчується на документації: він перетворює аудіозапис сесії на охайну клінічну нотатку — і на цьому все. PR-TOP також складає нотатки, але його сила — у просторі ',
    stopsP1em: 'між',
    stopsP1b:
      ' сесіями: Telegram-канал, де клієнт веде голосовий/текстовий/відео-щоденник, отримує вправи й може надіслати SOS просто вам. Якщо ваше вузьке місце — написання нотаток сесій, Mentalyc буде сильним вибором. Якщо ж вам важливо зберігати контекст клієнта впродовж тижня та позбутися подвійної документації, PR-TOP створено саме для цього.',
    stopsP2:
      'Ці продукти доповнюють один одного. Практика в ЄС може використовувати Mentalyc (або будь-який інший AI-інструмент для нотаток) для документації, а PR-TOP — як канал для клієнтів: їхні зони майже не перетинаються.',
    privacyTitle: 'Два підходи до приватності',
    privacyP1a:
      'Підхід Mentalyc: анонімізувати транскрипт під час завантаження, не зберігати аудіо довгостроково, орієнтуватися на американський HIPAA. Підхід PR-TOP: тримати ',
    privacyP1em: 'все',
    privacyP1b:
      ' в ЄС, шифрувати дані класу A (щоденник, транскрипти, приватні нотатки) на рівні застосунку — база даних ніколи не зберігає відкритий текст — і включати DPA за замовчуванням. Обидва підходи зменшують наслідки можливого витоку, просто з різних боків.',
    seeLead: 'Докладніше: ',
    linkEncryption: 'архітектура шифрування PR-TOP',
    linkGdpr: 'відповідність GDPR',
    seeAnd: ' та ',
    linkSovereignty: 'суверенітет даних',
    seeTail: '.',
    tableTitle: 'Порівняння функцій і цін (2026)',
    tableHead: { category: 'Категорія', mentalyc: 'Mentalyc', prtop: 'PR-TOP' },
    tableRows: [
      {
        label: 'Категорія',
        m: 'Приватний AI-інструмент для нотаток сесій',
        p: 'Асистент між сесіями + Telegram-бот для клієнта',
      },
      {
        label: 'Ціна (від)',
        m: 'Обмежений безкоштовний тариф, далі ~$39/міс',
        p: 'Безкоштовний Trial, далі €9/міс Basic, €19/міс Pro',
      },
      {
        label: 'AI-нотатки сесій',
        m: 'Ядро продукту — зрілі шаблони (SOAP/DAP/BIRP/GIRP, плани терапії)',
        p: 'Так (Whisper + налаштовувані провайдери), простіші шаблони',
      },
      {
        label: 'Застосунок для клієнта',
        m: 'Немає нативного клієнтського застосунку',
        p: 'Telegram-бот (голосовий/текстовий/відео-щоденник, вправи, SOS)',
      },
      {
        label: 'Щоденник між сесіями',
        m: 'Поза межами продукту',
        p: 'Так — голос / текст / відео, із шифруванням',
      },
      {
        label: 'Кризові / SOS-сповіщення',
        m: 'Поза межами продукту',
        p: 'SOS клієнта в один дотик із мультиканальним сповіщенням психолога',
      },
      {
        label: 'Модель приватності',
        m: 'Анонімізовані транскрипти, орієнтація на HIPAA, без довгострокового зберігання аудіо',
        p: 'AES на рівні застосунку для даних класу A (щоденник, транскрипти, нотатки)',
      },
      {
        label: 'Хостинг / резиденція даних',
        m: 'Хостинг у США',
        p: 'Лише ЄС (Hetzner), можливий self-hosting',
      },
      {
        label: 'Позиція щодо GDPR',
        m: 'Стандартні договірні положення; реєстрація у США',
        p: 'EU-first; DPA за замовчуванням; без сторонніх трекерів',
      },
      {
        label: 'Мови',
        m: 'Англійська (основна)',
        p: 'Англійська, російська, українська, іспанська',
      },
      {
        label: 'Де виграє',
        m: 'Глибина AI-нотаток, зрілі клінічні шаблони, сильна приватність за мірками США',
        p: 'Безперервність між сесіями, ЄС/GDPR, клієнтський канал у Telegram',
      },
      {
        label: 'Де програє',
        m: 'Немає клієнтського каналу, хостинг у США, лише англійська, комплаєнс із прицілом на США',
        p: 'Простіші шаблони нотаток, немає інтеграцій з американськими EHR, немає розкладу та білінгу',
      },
      {
        label: 'Кому підходить',
        m: 'Психологам зі США, для яких головне — приватні AI-нотатки сесій',
        p: 'Психологам з ЄС/СНД/LATAM, яким потрібні контекст між сесіями та канал для клієнтів',
      },
    ],
    tableNote:
      'Дані Mentalyc звірено з mentalyc.com/pricing у липні 2026. Цифри оновлюються щокварталу.',
    whenMentalycTitle: 'Коли обрати Mentalyc',
    whenMentalycItems: [
      'Ви практикуєте у США, і ваш головний пріоритет — приватні AI-нотатки сесій.',
      'Вам потрібна зріла бібліотека шаблонів (SOAP/DAP/BIRP/GIRP, плани терапії) без додаткових налаштувань.',
      'Ви зустрічаєтеся з клієнтами в Zoom або наживо, і канал залучення між сесіями вам не потрібен.',
      'Ваша система координат у комплаєнсі — HIPAA, а не GDPR.',
    ],
    whenPrtopTitle: 'Коли обрати PR-TOP',
    whenPrtopItems: [
      'Ви хочете, щоб клієнти вели щоденник (голос, текст, відео) між сесіями в реальному часі.',
      'Вам потрібен кризовий SOS-канал в один дотик — з телефона клієнта просто до вас.',
      'Ви хочете призначати вправи й бачити, чи клієнт справді їх виконав.',
      'Ви працюєте в ЄС або СНД і надаєте перевагу GDPR-first софту з хостингом у ЄС і DPA за замовчуванням.',
      'Вам потрібен інтерфейс (і інтерфейс ваших клієнтів) українською, російською чи іспанською, а не лише англійською.',
    ],
    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'PR-TOP замінює Mentalyc?',
        a: 'Ні. Mentalyc — AI-інструмент для нотаток: він слухає сесію та складає клінічні нотатки у форматах SOAP, DAP, BIRP, GIRP. PR-TOP — асистент між сесіями: він також складає нотатки, але його центр ваги — канал для клієнта: Telegram-бот зі щоденником, вправами та кризовими сповіщеннями. Багато психологів у ЄС використовують обидва сервіси.',
      },
      {
        q: 'Що приватніше — Mentalyc чи PR-TOP?',
        a: 'Обидва сервіси ставлять приватність на перше місце, але моделі різні. Mentalyc анонімізує транскрипти, видаляє аудіо після обробки й орієнтується на HIPAA на інфраструктурі у США. PR-TOP розміщений у ЄС (Hetzner), побудований довкола GDPR із DPA за замовчуванням і шифрує дані класу A (щоденник, транскрипти, приватні нотатки) на рівні застосунку — сама база даних не зберігає контент клієнтів у відкритому вигляді.',
      },
      {
        q: 'Чи працює Mentalyc з Telegram? Чи має він застосунок для клієнта?',
        a: 'Ні. Mentalyc звернений лише до терапевта: вебзастосунок записує сесію та видає нотатку. PR-TOP — єдиний порівнянний інструмент із нативним клієнтським каналом: клієнти ведуть щоденник, отримують вправи й можуть надіслати SOS просто в Telegram, яким більшість клієнтів у ЄС / СНД / LATAM і так користуються щодня.',
      },
      {
        q: 'Що краще для GDPR і комплаєнсу в ЄС?',
        a: 'PR-TOP. У Mentalyc сильна позиція щодо приватності, але компанія зареєстрована й розміщена у США; відповідність GDPR для психологів з ЄС спирається на стандартні договірні положення. PR-TOP розміщений у ЄС, включає DPA за замовчуванням, не використовує сторонні трекери (self-hosted аналітика Umami) і дозволяє вивантажити або видалити всі зашифровані дані клієнтів за запитом.',
      },
      {
        q: 'Чого PR-TOP не вміє з того, що вміє Mentalyc?',
        a: 'У Mentalyc глибша та зріліша бібліотека клінічних шаблонів (варіанти SOAP/DAP/BIRP/GIRP, генератори планів терапії, підказки за DSM/ICD) і сильніші інтеграції з американськими EHR. Шаблони нотаток у PR-TOP простіші й налаштовуються провайдером, інтеграцій з американськими EHR немає. Якщо ваш пріоритет — глибина AI-нотаток, виграє Mentalyc.',
      },
      {
        q: 'Чи можна спробувати PR-TOP без банківської картки?',
        a: 'Так. PR-TOP має безкоштовний тариф Trial: зашифрований кабінет, Telegram-бот для клієнтів, щоденник, вправи та SOS доступні для обмеженої кількості клієнтів. Картка не потрібна, автоматичного переходу на платний план немає — ви переходите на нього лише за власним рішенням.',
      },
    ],
    ctaTitle: 'Спробуйте PR-TOP разом із вашими поточними інструментами',
    ctaText:
      'Налаштування безкоштовного Trial займає близько десяти хвилин. Без банківської картки. Якщо вирішите, що сервіс не вписується у ваш робочий процес, ви зможете вивантажити дані й піти без прив’язки.',
    ctaStart: 'Почати безкоштовно',
    ctaAlternatives: 'Інші альтернативи Mentalyc',
    ctaGdpr: 'Як PR-TOP працює з GDPR',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'PR-TOP vs Mentalyc: comparativa para terapeutas (2026)',
    seoDescription:
      'Mentalyc es un asistente de notas con IA alojado en EE. UU. PR-TOP añade la capa entre sesiones: diario en Telegram, ejercicios y SOS. Alojado en la UE, GDPR.',
    articleHeadline: 'PR-TOP vs Mentalyc: comparativa para terapeutas (2026)',
    articleDescription:
      'Comparativa honesta de 2026 entre Mentalyc (notas con IA centradas en la privacidad) y PR-TOP (asistente entre sesiones controlado por el terapeuta con bot de Telegram para clientes).',
    badge: 'Comparativa',
    h1: 'PR-TOP vs Mentalyc: comparativa para terapeutas',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',
    intro1:
      ' es un asistente de notas con IA centrado en la privacidad, desde ~$39/mes, alineado con HIPAA y alojado en EE. UU.',
    intro2:
      ' es un asistente entre sesiones controlado por el terapeuta: un panel cifrado más un bot de Telegram para el cliente con diario, ejercicios y alertas de crisis con un toque. Ambos priorizan la privacidad; resuelven tareas distintas y muchas consultas en la UE los usan juntos.',
    stopsTitle: 'Dónde termina cada producto',
    stopsP1a:
      'Mentalyc termina en la documentación: convierte el audio de la sesión en una nota clínica limpia y ahí se detiene. PR-TOP también redacta notas, pero su fuerte es el espacio ',
    stopsP1em: 'entre',
    stopsP1b:
      ' sesiones: un canal de Telegram donde el cliente lleva un diario de voz/texto/vídeo, recibe ejercicios y puede enviar un SOS directamente a su bandeja. Si su cuello de botella es redactar notas de sesión, Mentalyc es una gran opción. Si lo que necesita es conservar el contexto del cliente durante la semana y reducir la doble documentación, PR-TOP está hecho para eso.',
    stopsP2:
      'Los dos productos se complementan. Una consulta en la UE puede usar Mentalyc (o cualquier asistente de notas con IA) para la documentación y PR-TOP como canal para clientes, porque sus ámbitos apenas se solapan.',
    privacyTitle: 'Dos formas de entender la privacidad',
    privacyP1a:
      'El enfoque de Mentalyc: anonimizar la transcripción al procesarla, evitar el almacenamiento prolongado de audio y alinearse con la HIPAA estadounidense. El enfoque de PR-TOP: mantener ',
    privacyP1em: 'todo',
    privacyP1b:
      ' en la UE, cifrar los datos de clase A (diario, transcripciones, notas privadas) en la capa de aplicación —la base de datos nunca guarda texto en claro— e incluir un DPA por defecto. Ambos reducen el impacto de una posible brecha, solo que desde ángulos distintos.',
    seeLead: 'Consulte ',
    linkEncryption: 'la arquitectura de cifrado de PR-TOP',
    linkGdpr: 'el cumplimiento del GDPR',
    seeAnd: ' y ',
    linkSovereignty: 'la soberanía de datos',
    seeTail: ' para ver el panorama completo.',
    tableTitle: 'Comparativa de funciones y precios (2026)',
    tableHead: { category: 'Categoría', mentalyc: 'Mentalyc', prtop: 'PR-TOP' },
    tableRows: [
      {
        label: 'Categoría',
        m: 'Asistente de notas con IA centrado en la privacidad',
        p: 'Asistente entre sesiones + bot de Telegram para clientes',
      },
      {
        label: 'Precio (desde)',
        m: 'Nivel gratuito limitado, luego ~$39/mes',
        p: 'Trial gratuito, luego €9/mes Basic, €19/mes Pro',
      },
      {
        label: 'Notas de sesión con IA',
        m: 'Producto principal: plantillas maduras (SOAP/DAP/BIRP/GIRP, planes de tratamiento)',
        p: 'Sí (Whisper + proveedores configurables), plantillas más sencillas',
      },
      {
        label: 'App para clientes',
        m: 'Sin app nativa para clientes',
        p: 'Bot de Telegram (diario de voz/texto/vídeo, ejercicios, SOS)',
      },
      {
        label: 'Diario entre sesiones',
        m: 'Fuera de su alcance',
        p: 'Sí: voz / texto / vídeo, cifrado',
      },
      {
        label: 'Alertas de crisis / SOS',
        m: 'Fuera de su alcance',
        p: 'SOS del cliente con un toque y aviso multicanal al terapeuta',
      },
      {
        label: 'Modelo de privacidad',
        m: 'Transcripciones anonimizadas, alineado con HIPAA, sin almacenamiento prolongado de audio',
        p: 'AES en la capa de aplicación para datos de clase A (diario, transcripciones, notas)',
      },
      {
        label: 'Alojamiento / residencia de datos',
        m: 'Alojado en EE. UU.',
        p: 'Solo UE (Hetzner), autoalojable',
      },
      {
        label: 'Postura ante el GDPR',
        m: 'Cláusulas contractuales tipo; registrado en EE. UU.',
        p: 'UE primero; DPA por defecto; sin rastreadores de terceros',
      },
      {
        label: 'Idiomas',
        m: 'Inglés (principal)',
        p: 'Inglés, ruso, ucraniano, español',
      },
      {
        label: 'Dónde gana',
        m: 'Profundidad de las notas con IA, plantillas clínicas maduras, sólida privacidad en EE. UU.',
        p: 'Continuidad entre sesiones, UE/GDPR, canal de clientes en Telegram',
      },
      {
        label: 'Dónde pierde',
        m: 'Sin canal para clientes, alojado en EE. UU., solo en inglés, cumplimiento centrado en EE. UU.',
        p: 'Plantillas de notas más sencillas, sin integraciones con EHR de EE. UU., sin agenda ni facturación',
      },
      {
        label: 'Ideal para',
        m: 'Terapeutas de EE. UU. cuya prioridad son notas de sesión con IA respetuosas con la privacidad',
        p: 'Terapeutas de UE/CEI/LATAM que quieren contexto entre sesiones y un canal para clientes',
      },
    ],
    tableNote:
      'Datos de Mentalyc verificados en mentalyc.com/pricing en julio de 2026. Las cifras se actualizan cada trimestre.',
    whenMentalycTitle: 'Cuándo elegir Mentalyc',
    whenMentalycItems: [
      'Ejerce en EE. UU. y su máxima prioridad son las notas de sesión con IA respetuosas con la privacidad.',
      'Quiere una biblioteca de plantillas madura (SOAP/DAP/BIRP/GIRP, planes de tratamiento) lista para usar.',
      'Ve a sus clientes por Zoom o en persona y no necesita un canal de acompañamiento entre sesiones.',
      'Su marco de cumplimiento es HIPAA, no el GDPR.',
    ],
    whenPrtopTitle: 'Cuándo elegir PR-TOP',
    whenPrtopItems: [
      'Quiere que sus clientes lleven un diario en tiempo real (voz, texto, vídeo) entre sesiones.',
      'Quiere un canal de crisis / SOS con un toque, del teléfono del cliente a su bandeja.',
      'Quiere asignar ejercicios y ver si el cliente realmente los hizo.',
      'Está en la UE o la CEI y prefiere software GDPR-first alojado en la UE con DPA por defecto.',
      'Quiere su interfaz (y la de sus clientes) en ruso, ucraniano o español, no solo en inglés.',
    ],
    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿PR-TOP sustituye a Mentalyc?',
        a: 'No. Mentalyc es un asistente de notas con IA: escucha las sesiones y redacta notas de evolución en formatos clínicos (SOAP, DAP, BIRP, GIRP). PR-TOP es un asistente entre sesiones que también redacta notas, pero su centro de gravedad es el canal orientado al cliente: un bot de Telegram con diario, ejercicios y alertas de crisis. Muchos terapeutas de la UE usan ambos.',
      },
      {
        q: '¿Cuál es más privado: Mentalyc o PR-TOP?',
        a: 'Ambos priorizan la privacidad, pero con modelos distintos. Mentalyc anonimiza las transcripciones, elimina el audio tras procesarlo y se alinea con HIPAA sobre infraestructura estadounidense. PR-TOP se aloja en la UE (Hetzner), es GDPR-first con DPA por defecto y cifra los datos de clase A (diario, transcripciones, notas privadas) en la capa de aplicación, de modo que la base de datos no guarda contenido de clientes en texto claro.',
      },
      {
        q: '¿Mentalyc funciona con Telegram u ofrece una app para clientes?',
        a: 'No. Mentalyc está orientado solo al terapeuta: una aplicación web que captura la sesión y produce la nota. PR-TOP es la única herramienta comparable con un canal nativo para clientes: llevan un diario, reciben ejercicios y pueden activar un SOS directamente en Telegram, que la mayoría de los clientes de la UE, la CEI y LATAM ya usan a diario.',
      },
      {
        q: '¿Cuál es mejor para el GDPR y el cumplimiento en la UE?',
        a: 'PR-TOP. Mentalyc tiene una postura de privacidad sólida, pero está registrado y alojado en EE. UU.; su cumplimiento del GDPR para terapeutas de la UE depende de cláusulas contractuales tipo. PR-TOP se aloja en la UE, incluye un DPA por defecto, no usa rastreadores de terceros (analítica Umami autoalojada) y permite exportar o borrar todos los datos cifrados de los clientes bajo petición.',
      },
      {
        q: '¿Qué no hace PR-TOP que sí hace Mentalyc?',
        a: 'Mentalyc tiene una biblioteca de plantillas clínicas más profunda y madura (variantes de SOAP/DAP/BIRP/GIRP, generadores de planes de tratamiento, guías DSM/ICD) e integraciones más sólidas con EHR estadounidenses. Las plantillas de notas de PR-TOP son más sencillas y configurables por el proveedor, y no se integra con EHR de EE. UU. Si su prioridad es la profundidad de las notas con IA, gana Mentalyc.',
      },
      {
        q: '¿Puedo probar PR-TOP sin tarjeta de crédito?',
        a: 'Sí. PR-TOP tiene un nivel Trial gratuito con el panel cifrado, el bot de Telegram, el diario, los ejercicios y el SOS activados para un número limitado de clientes. No se requiere tarjeta y no hay conversión automática a un plan de pago: solo cambia de plan cuando usted lo decide.',
      },
    ],
    ctaTitle: 'Pruebe PR-TOP junto a sus herramientas actuales',
    ctaText:
      'La versión Trial gratuita se configura en unos diez minutos. Sin tarjeta de crédito. Si decide que no encaja en su flujo de trabajo, puede exportar sus datos e irse sin ataduras.',
    ctaStart: 'Empezar gratis',
    ctaAlternatives: 'Ver otras alternativas a Mentalyc',
    ctaGdpr: 'Cómo gestiona PR-TOP el GDPR',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function CompareMentalyc() {
  const { i18n } = useTranslation();
  const lp = useLocalePath();
  const locale = ['ru', 'uk', 'es'].includes(i18n.language) ? i18n.language : 'en';
  const c = CONTENT[locale];
  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : `/${locale}`}/compare/mentalyc`;

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

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.articleHeadline,
    description: c.articleDescription,
    inLanguage: locale,
    datePublished: '2026-07-06',
    dateModified: '2026-07-06',
    author: { '@type': 'Organization', name: 'PR-TOP' },
    publisher: { '@type': 'Organization', name: 'PR-TOP' },
    mainEntityOfPage: pageUrl,
  };

  return (
    <div className="min-h-screen bg-white">
      <Seo
        path="/compare/mentalyc"
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
          <p className="text-gray-800 leading-relaxed">
            <strong>Mentalyc</strong>
            {c.intro1}
            <strong> PR-TOP</strong>
            {c.intro2}
          </p>
        </div>

        {/* Rule 7 — wedge in first H2. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.stopsTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            {c.stopsP1a}
            <em>{c.stopsP1em}</em>
            {c.stopsP1b}
          </p>
          <p className="text-gray-700 leading-relaxed">{c.stopsP2}</p>
        </section>

        {/* Rule 7 — privacy contrast section (Mentalyc-specific). */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.privacyTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            {c.privacyP1a}
            <em>{c.privacyP1em}</em>
            {c.privacyP1b}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {c.seeLead}
            <Link to={lp('/security/encryption')} className="text-primary underline hover:no-underline">
              {c.linkEncryption}
            </Link>
            {', '}
            <Link to={lp('/security/gdpr')} className="text-primary underline hover:no-underline">
              {c.linkGdpr}
            </Link>
            {c.seeAnd}
            <Link to={lp('/security/data-sovereignty')} className="text-primary underline hover:no-underline">
              {c.linkSovereignty}
            </Link>
            {c.seeTail}
          </p>
        </section>

        {/* Rule 3 — honest feature/price table. Data verified 2026-07 against
            https://www.mentalyc.com/ and https://www.mentalyc.com/pricing */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.tableTitle}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.category}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.mentalyc}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.prtop}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.tableRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="p-3 border border-gray-200 font-medium">{row.label}</td>
                    <td className="p-3 border border-gray-200">{row.m}</td>
                    <td className="p-3 border border-gray-200">{row.p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">{c.tableNote}</p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whenMentalycTitle}
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            {c.whenMentalycItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

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
              {c.ctaStart}
            </Link>
            <Link
              to={lp('/alternatives/mentalyc')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaAlternatives}
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
