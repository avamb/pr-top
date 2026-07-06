import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /alternatives/upheal  —  Upheal alternatives listicle (F20, localized EN/RU/UK/ES).
 *
 * Follows docs/seo/CONTENT_RULES.md rules 1–7.
 * Competitor data verified 2026-07 against:
 *   - https://www.upheal.io/
 *   - https://www.mentalyc.com/pricing
 *   - https://twofold.ai/
 *   - https://www.heidihealth.com/
 *   - https://www.supanote.ai/
 */

// Rich-text paragraphs are stored as segment arrays: plain strings render as
// text, { b: '...' } renders <strong>, { em: '...' } renders <em>.
const CONTENT = {
  en: {
    seoTitle: 'Upheal alternatives (2026): Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    seoDescription:
      'Ranked Upheal alternatives for therapists in 2026. Honest comparison of Mentalyc, Twofold, Heidi, Supanote, and PR-TOP for between-session client engagement.',
    articleHeadline: 'Upheal alternatives (2026) — Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    articleDescription:
      'Ranked list of Upheal alternatives for therapists in 2026: Mentalyc, Twofold, Heidi, Supanote, and PR-TOP for between-session continuity.',
    backHome: '← Back to home',
    badge: 'Alternatives',
    h1: 'Upheal alternatives for therapists (2026)',
    updated: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    intro: [
      'The best ',
      { b: 'Upheal alternatives' },
      ' for therapists in 2026 fall in two groups. For deeper AI session notes: ',
      { b: 'Mentalyc' },
      ', ',
      { b: 'Twofold' },
      ', ',
      { b: 'Heidi' },
      ', ',
      { b: 'Supanote' },
      '. For the space AI note-takers ignore — between-session client engagement via diary, exercises and crisis alerts inside Telegram — there is ',
      { b: 'PR-TOP' },
      ', which is EU-hosted and GDPR-first.',
    ],
    howToPickH2: 'How to pick',
    pick1: [
      'AI note-takers document your sessions. PR-TOP also stays with your clients between sessions — diary, exercises, crisis alerts — inside the messenger they already use every day. Decide first whether your bottleneck is ',
      { em: 'writing session notes' },
      ' or ',
      { em: 'keeping context between sessions' },
      ', then pick from the group that matches.',
    ],
    pick2:
      "All prices below were verified against each vendor's live site in July 2026 and are refreshed quarterly.",
    comparisonH2: 'Comparison at a glance',
    thProduct: 'Product',
    thCategory: 'Category',
    thPrice: 'Pricing (from)',
    thBestFor: 'Best for',
    sourcesNote:
      'Sources: vendor pricing pages, July 2026. See per-item detail below for what each product wins and loses on.',
    labelCategory: 'Category:',
    labelPrice: 'Pricing (from):',
    labelWins: 'Where it wins:',
    labelLoses: 'Where it loses:',
    labelBestFor: 'Best for:',
    compareLinkText: 'See the full PR-TOP vs Upheal comparison →',
    items: [
      {
        name: 'PR-TOP',
        internal: true,
        internalHref: '/compare/upheal',
        tagline: 'Between-session assistant with a Telegram client bot',
        category: 'Between-session assistant + AI notes',
        priceFrom: 'Free Trial, then €9/mo Basic, €19/mo Pro',
        wins: 'Only option with a Telegram client channel (diary, exercises, crisis alerts). EU-hosted, GDPR-first, EN/RU/UK/ES.',
        loses: 'No billing or scheduling. AI-notes templates less deep than Upheal or Mentalyc.',
        bestFor:
          'EU / CIS / LATAM therapists who want between-session continuity and a client channel in Telegram.',
      },
      {
        name: 'Mentalyc',
        internal: false,
        tagline: 'Privacy-first AI note-taker for therapists',
        category: 'AI session notes',
        priceFrom: 'From ~$39/mo (limited free tier)',
        wins: 'Strong privacy posture, mature clinical templates (SOAP/DAP/BIRP), well-known brand in US therapy circles.',
        loses: 'US-first, no client-facing channel, no messenger integration, English only.',
        bestFor:
          'US-based therapists whose top priority is AI-drafted session notes with strong privacy claims.',
      },
      {
        name: 'Twofold',
        internal: false,
        tagline: 'Fast AI notes with a light UI',
        category: 'AI session notes',
        priceFrom: 'From ~$29/mo',
        wins: 'Clean, opinionated UX; fast turnarounds on note drafts.',
        loses: 'Narrower feature set than Upheal or Mentalyc; no client-facing app; US-market first.',
        bestFor: 'Solo therapists who want AI notes with less UI friction than Upheal.',
      },
      {
        name: 'Heidi',
        internal: false,
        tagline: 'Generic clinical AI scribe (broader than therapy)',
        category: 'AI clinical scribe',
        priceFrom: 'Free tier + paid plans',
        wins: 'Fast, works across many clinical specialties, generous free tier.',
        loses: 'Not therapy-specific; user reports of reliability issues at scale; no client channel.',
        bestFor: 'Multidisciplinary practices that want one AI scribe across several clinical roles.',
      },
      {
        name: 'Supanote',
        internal: false,
        tagline: 'AI notes with therapy-focused templates',
        category: 'AI session notes',
        priceFrom: 'From ~$25/mo',
        wins: 'Therapy-specific templates, competitive pricing, growing feature set.',
        loses: 'Smaller ecosystem than Upheal, no client channel, US-market first.',
        bestFor: 'Therapists who want a lower-cost AI-notes tool with therapy templates.',
      },
    ],
    faqH2: 'Frequently asked questions',
    faq: [
      {
        q: 'What is the best alternative to Upheal for therapists?',
        a: 'There is no single best answer — pick by job. Mentalyc is the strongest privacy-first AI note-taker. Twofold and Supanote focus on speed and simplicity. Heidi is a fast generic transcription/notes assistant. PR-TOP is the only option here that owns the between-session channel via a Telegram client bot, not just documentation.',
      },
      {
        q: 'Is there a free alternative to Upheal?',
        a: 'Yes. PR-TOP has a free Trial tier with the client bot, diary, exercises and encrypted dashboard enabled. Mentalyc offers a limited free plan. Most session-notes competitors (Twofold, Heidi, Supanote) run short free trials rather than a permanent free tier.',
      },
      {
        q: 'Which Upheal alternative is best for EU / GDPR-first therapists?',
        a: 'PR-TOP is the most explicitly EU-native option: hosted on Hetzner (EU), application-layer encryption for Class A data, DPA by default, self-hosted analytics with no third-party trackers. Mentalyc emphasizes privacy but is US-based. Most other alternatives are US-market first.',
      },
      {
        q: 'Which alternative works with Telegram?',
        a: 'Only PR-TOP. Every other tool in this list is browser or mobile-app only. If your clients are in EU / CIS / LATAM markets where Telegram is dominant, PR-TOP is currently the only option that meets clients where they already are.',
      },
      {
        q: 'How often is this list updated?',
        a: 'Quarterly. Competitor pricing, features and positioning are re-verified against each vendor site every three months, and the comparison rows and the "Updated" date at the top are refreshed at the same time.',
      },
      {
        q: 'What did you not include in this list?',
        a: 'Enterprise-only tools (Eleos), pure practice-management suites without AI notes (SimplePractice, TherapyNotes) and dictation-only tools without therapy-specific templates. Those solve different problems and would make the list less useful.',
      },
    ],
    ctaH2: 'Between-session continuity is what most of this list is missing',
    ctaBody:
      'Every other product on this page stops at documenting your sessions. If preserving client context across the week is your real problem, PR-TOP is the only option here that solves it. Free Trial, no card, no lock-in.',
    ctaStart: 'Start free trial',
    ctaCompare: 'PR-TOP vs Upheal (detail)',
    ctaGdpr: 'How PR-TOP handles GDPR',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'Альтернативы Upheal (2026): Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    seoDescription:
      'Рейтинг альтернатив Upheal для психологов в 2026 году: честное сравнение Mentalyc, Twofold, Heidi, Supanote и PR-TOP для работы с клиентами между сессиями.',
    articleHeadline: 'Альтернативы Upheal (2026) — Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    articleDescription:
      'Рейтинг альтернатив Upheal для психологов в 2026 году: Mentalyc, Twofold, Heidi, Supanote и PR-TOP для непрерывности между сессиями.',
    backHome: '← На главную',
    badge: 'Альтернативы',
    h1: 'Альтернативы Upheal для психологов (2026)',
    updated: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    intro: [
      'Лучшие ',
      { b: 'альтернативы Upheal' },
      ' для психологов в 2026 году делятся на две группы. Для более глубоких AI-заметок по сессиям: ',
      { b: 'Mentalyc' },
      ', ',
      { b: 'Twofold' },
      ', ',
      { b: 'Heidi' },
      ', ',
      { b: 'Supanote' },
      '. Для того, что AI-ассистенты для заметок игнорируют, — поддержки клиента между сессиями через дневник, упражнения и кризисные оповещения в Telegram — есть ',
      { b: 'PR-TOP' },
      ': сервис размещён в ЕС и построен вокруг GDPR.',
    ],
    howToPickH2: 'Как выбрать',
    pick1: [
      'AI-ассистенты для заметок документируют ваши сессии. PR-TOP также остаётся с вашими клиентами между сессиями — дневник, упражнения, кризисные оповещения — в мессенджере, которым они и так пользуются каждый день. Сначала определите, что для вас узкое место: ',
      { em: 'написание заметок по сессиям' },
      ' или ',
      { em: 'сохранение контекста между сессиями' },
      ', — и выбирайте из подходящей группы.',
    ],
    pick2:
      'Все цены ниже сверены с действующими сайтами вендоров в июле 2026 года и обновляются ежеквартально.',
    comparisonH2: 'Краткое сравнение',
    thProduct: 'Продукт',
    thCategory: 'Категория',
    thPrice: 'Цена (от)',
    thBestFor: 'Кому подходит',
    sourcesNote:
      'Источники: страницы с ценами вендоров, июль 2026. Ниже — подробно о сильных и слабых сторонах каждого продукта.',
    labelCategory: 'Категория:',
    labelPrice: 'Цена (от):',
    labelWins: 'В чём выигрывает:',
    labelLoses: 'В чём уступает:',
    labelBestFor: 'Кому подходит:',
    compareLinkText: 'Полное сравнение PR-TOP и Upheal →',
    items: [
      {
        name: 'PR-TOP',
        internal: true,
        internalHref: '/compare/upheal',
        tagline: 'Ассистент между сессиями с клиентским ботом в Telegram',
        category: 'Ассистент между сессиями + AI-заметки',
        priceFrom: 'Бесплатный Trial, далее €9/мес Basic, €19/мес Pro',
        wins: 'Единственный вариант с клиентским каналом в Telegram (дневник, упражнения, кризисные оповещения). Хостинг в ЕС, GDPR-first, EN/RU/UK/ES.',
        loses: 'Нет биллинга и расписания. Шаблоны AI-заметок менее глубокие, чем у Upheal или Mentalyc.',
        bestFor:
          'Психологи из ЕС / СНГ / Латинской Америки, которым нужны непрерывность между сессиями и клиентский канал в Telegram.',
      },
      {
        name: 'Mentalyc',
        internal: false,
        tagline: 'AI-ассистент для заметок с фокусом на приватность',
        category: 'AI-заметки по сессиям',
        priceFrom: 'От ~$39/мес (ограниченный бесплатный тариф)',
        wins: 'Сильная позиция по приватности, зрелые клинические шаблоны (SOAP/DAP/BIRP), известный бренд среди терапевтов в США.',
        loses: 'Ориентирован на США, нет клиентского канала, нет интеграции с мессенджерами, только английский язык.',
        bestFor:
          'Терапевты из США, для которых главное — черновики заметок по сессиям с сильными гарантиями приватности.',
      },
      {
        name: 'Twofold',
        internal: false,
        tagline: 'Быстрые AI-заметки с лёгким интерфейсом',
        category: 'AI-заметки по сессиям',
        priceFrom: 'От ~$29/мес',
        wins: 'Чистый, продуманный UX; быстрые черновики заметок.',
        loses: 'Более узкий набор функций, чем у Upheal или Mentalyc; нет клиентского приложения; в первую очередь рынок США.',
        bestFor: 'Частнопрактикующие терапевты, которым нужны AI-заметки с меньшим трением в интерфейсе, чем в Upheal.',
      },
      {
        name: 'Heidi',
        internal: false,
        tagline: 'Универсальный клинический AI-скрайб (шире, чем терапия)',
        category: 'Клинический AI-скрайб',
        priceFrom: 'Бесплатный тариф + платные планы',
        wins: 'Быстрый, работает во многих клинических специальностях, щедрый бесплатный тариф.',
        loses: 'Не специализирован под терапию; пользователи сообщают о проблемах со стабильностью под нагрузкой; нет клиентского канала.',
        bestFor: 'Мультидисциплинарные практики, которым нужен один AI-скрайб для нескольких клинических ролей.',
      },
      {
        name: 'Supanote',
        internal: false,
        tagline: 'AI-заметки с шаблонами для терапии',
        category: 'AI-заметки по сессиям',
        priceFrom: 'От ~$25/мес',
        wins: 'Шаблоны под терапию, конкурентные цены, растущий набор функций.',
        loses: 'Экосистема меньше, чем у Upheal, нет клиентского канала, в первую очередь рынок США.',
        bestFor: 'Терапевты, которым нужен более доступный инструмент AI-заметок с шаблонами для терапии.',
      },
    ],
    faqH2: 'Часто задаваемые вопросы',
    faq: [
      {
        q: 'Какая альтернатива Upheal лучше всего подходит терапевтам?',
        a: 'Единственно правильного ответа нет — выбирайте под задачу. Mentalyc — сильнейший AI-ассистент для заметок с фокусом на приватность. Twofold и Supanote делают ставку на скорость и простоту. Heidi — быстрый универсальный ассистент для транскрибации и заметок. PR-TOP — единственный вариант в списке, который закрывает канал между сессиями через клиентского бота в Telegram, а не только документацию.',
      },
      {
        q: 'Есть ли бесплатная альтернатива Upheal?',
        a: 'Да. У PR-TOP есть бесплатный тариф Trial с клиентским ботом, дневником, упражнениями и зашифрованной панелью. У Mentalyc — ограниченный бесплатный план. Большинство конкурентов в сегменте заметок (Twofold, Heidi, Supanote) предлагают короткие пробные периоды, а не постоянный бесплатный тариф.',
      },
      {
        q: 'Какая альтернатива Upheal лучше для терапевтов из ЕС с фокусом на GDPR?',
        a: 'PR-TOP — самый явно «европейский» вариант: хостинг на Hetzner (ЕС), шифрование данных класса A на уровне приложения, DPA по умолчанию, собственная аналитика без сторонних трекеров. Mentalyc подчёркивает приватность, но базируется в США. Большинство остальных альтернатив ориентированы прежде всего на рынок США.',
      },
      {
        q: 'Какая альтернатива работает с Telegram?',
        a: 'Только PR-TOP. Все остальные инструменты в списке доступны только через браузер или мобильное приложение. Если ваши клиенты — в ЕС, СНГ или Латинской Америке, где доминирует Telegram, PR-TOP сейчас единственный вариант, который встречает клиентов там, где они уже есть.',
      },
      {
        q: 'Как часто обновляется этот список?',
        a: 'Ежеквартально. Цены, функции и позиционирование конкурентов перепроверяются по сайтам вендоров каждые три месяца; одновременно обновляются строки сравнения и дата «Обновлено» вверху страницы.',
      },
      {
        q: 'Что не вошло в этот список?',
        a: 'Инструменты только для энтерпрайза (Eleos), чистые системы управления практикой без AI-заметок (SimplePractice, TherapyNotes) и инструменты только для диктовки без шаблонов для терапии. Они решают другие задачи и сделали бы список менее полезным.',
      },
    ],
    ctaH2: 'Непрерывность между сессиями — то, чего не хватает большинству в этом списке',
    ctaBody:
      'Все остальные продукты на этой странице останавливаются на документировании сессий. Если ваша настоящая проблема — сохранить контекст клиента в течение недели, PR-TOP — единственный вариант здесь, который её решает. Бесплатный Trial, без карты, без привязки.',
    ctaStart: 'Начать бесплатно',
    ctaCompare: 'PR-TOP vs Upheal (подробно)',
    ctaGdpr: 'Как PR-TOP соблюдает GDPR',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'Альтернативи Upheal (2026): Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    seoDescription:
      'Рейтинг альтернатив Upheal для психологів у 2026 році: чесне порівняння Mentalyc, Twofold, Heidi, Supanote і PR-TOP для роботи з клієнтами між сесіями.',
    articleHeadline: 'Альтернативи Upheal (2026) — Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    articleDescription:
      'Рейтинг альтернатив Upheal для психологів у 2026 році: Mentalyc, Twofold, Heidi, Supanote і PR-TOP для безперервності між сесіями.',
    backHome: '← На головну',
    badge: 'Альтернативи',
    h1: 'Альтернативи Upheal для психологів (2026)',
    updated: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    intro: [
      'Найкращі ',
      { b: 'альтернативи Upheal' },
      ' для психологів у 2026 році поділяються на дві групи. Для глибших AI-нотаток із сесій: ',
      { b: 'Mentalyc' },
      ', ',
      { b: 'Twofold' },
      ', ',
      { b: 'Heidi' },
      ', ',
      { b: 'Supanote' },
      '. Для того, що AI-асистенти для нотаток ігнорують, — підтримки клієнта між сесіями через щоденник, вправи та кризові сповіщення в Telegram — є ',
      { b: 'PR-TOP' },
      ': сервіс розміщено в ЄС і побудовано довкола GDPR.',
    ],
    howToPickH2: 'Як обрати',
    pick1: [
      'AI-асистенти для нотаток документують ваші сесії. PR-TOP також залишається з вашими клієнтами між сесіями — щоденник, вправи, кризові сповіщення — у месенджері, яким вони й так користуються щодня. Спершу визначте, що для вас вузьке місце: ',
      { em: 'написання нотаток із сесій' },
      ' чи ',
      { em: 'збереження контексту між сесіями' },
      ', — і обирайте з відповідної групи.',
    ],
    pick2:
      'Усі ціни нижче звірено з чинними сайтами вендорів у липні 2026 року; вони оновлюються щокварталу.',
    comparisonH2: 'Стисле порівняння',
    thProduct: 'Продукт',
    thCategory: 'Категорія',
    thPrice: 'Ціна (від)',
    thBestFor: 'Кому підходить',
    sourcesNote:
      'Джерела: сторінки з цінами вендорів, липень 2026. Нижче — докладно про сильні та слабкі сторони кожного продукту.',
    labelCategory: 'Категорія:',
    labelPrice: 'Ціна (від):',
    labelWins: 'У чому виграє:',
    labelLoses: 'У чому поступається:',
    labelBestFor: 'Кому підходить:',
    compareLinkText: 'Повне порівняння PR-TOP і Upheal →',
    items: [
      {
        name: 'PR-TOP',
        internal: true,
        internalHref: '/compare/upheal',
        tagline: 'Асистент між сесіями з клієнтським ботом у Telegram',
        category: 'Асистент між сесіями + AI-нотатки',
        priceFrom: 'Безкоштовний Trial, далі €9/міс Basic, €19/міс Pro',
        wins: 'Єдиний варіант із клієнтським каналом у Telegram (щоденник, вправи, кризові сповіщення). Хостинг у ЄС, GDPR-first, EN/RU/UK/ES.',
        loses: 'Немає білінгу та розкладу. Шаблони AI-нотаток менш глибокі, ніж в Upheal чи Mentalyc.',
        bestFor:
          'Психологи з ЄС / СНД / Латинської Америки, яким потрібні безперервність між сесіями та клієнтський канал у Telegram.',
      },
      {
        name: 'Mentalyc',
        internal: false,
        tagline: 'AI-асистент для нотаток із фокусом на приватність',
        category: 'AI-нотатки із сесій',
        priceFrom: 'Від ~$39/міс (обмежений безкоштовний тариф)',
        wins: 'Сильна позиція щодо приватності, зрілі клінічні шаблони (SOAP/DAP/BIRP), відомий бренд серед терапевтів у США.',
        loses: 'Орієнтований на США, немає клієнтського каналу, немає інтеграції з месенджерами, лише англійська мова.',
        bestFor:
          'Терапевти зі США, для яких головне — чернетки нотаток із сесій із сильними гарантіями приватності.',
      },
      {
        name: 'Twofold',
        internal: false,
        tagline: 'Швидкі AI-нотатки з легким інтерфейсом',
        category: 'AI-нотатки із сесій',
        priceFrom: 'Від ~$29/міс',
        wins: 'Чистий, продуманий UX; швидкі чернетки нотаток.',
        loses: 'Вужчий набір функцій, ніж в Upheal чи Mentalyc; немає клієнтського застосунку; насамперед ринок США.',
        bestFor: 'Терапевти-соло, яким потрібні AI-нотатки з меншим тертям в інтерфейсі, ніж в Upheal.',
      },
      {
        name: 'Heidi',
        internal: false,
        tagline: 'Універсальний клінічний AI-скрайб (ширше, ніж терапія)',
        category: 'Клінічний AI-скрайб',
        priceFrom: 'Безкоштовний тариф + платні плани',
        wins: 'Швидкий, працює в багатьох клінічних спеціальностях, щедрий безкоштовний тариф.',
        loses: 'Не спеціалізований під терапію; користувачі повідомляють про проблеми зі стабільністю під навантаженням; немає клієнтського каналу.',
        bestFor: 'Мультидисциплінарні практики, яким потрібен один AI-скрайб для кількох клінічних ролей.',
      },
      {
        name: 'Supanote',
        internal: false,
        tagline: 'AI-нотатки з шаблонами для терапії',
        category: 'AI-нотатки із сесій',
        priceFrom: 'Від ~$25/міс',
        wins: 'Шаблони під терапію, конкурентні ціни, набір функцій, що зростає.',
        loses: 'Менша екосистема, ніж в Upheal, немає клієнтського каналу, насамперед ринок США.',
        bestFor: 'Терапевти, яким потрібен доступніший інструмент AI-нотаток із шаблонами для терапії.',
      },
    ],
    faqH2: 'Поширені запитання',
    faq: [
      {
        q: 'Яка альтернатива Upheal найкраща для терапевтів?',
        a: 'Єдиної правильної відповіді немає — обирайте під завдання. Mentalyc — найсильніший AI-асистент для нотаток із фокусом на приватність. Twofold і Supanote роблять ставку на швидкість і простоту. Heidi — швидкий універсальний асистент для транскрибації та нотаток. PR-TOP — єдиний варіант у списку, який закриває канал між сесіями через клієнтського бота в Telegram, а не лише документацію.',
      },
      {
        q: 'Чи є безкоштовна альтернатива Upheal?',
        a: 'Так. У PR-TOP є безкоштовний тариф Trial із клієнтським ботом, щоденником, вправами та зашифрованою панеллю. У Mentalyc — обмежений безкоштовний план. Більшість конкурентів у сегменті нотаток (Twofold, Heidi, Supanote) пропонують короткі пробні періоди, а не постійний безкоштовний тариф.',
      },
      {
        q: 'Яка альтернатива Upheal найкраща для терапевтів із ЄС із фокусом на GDPR?',
        a: 'PR-TOP — найбільш явно «європейський» варіант: хостинг на Hetzner (ЄС), шифрування даних класу A на рівні застосунку, DPA за замовчуванням, власна аналітика без сторонніх трекерів. Mentalyc наголошує на приватності, але базується у США. Більшість інших альтернатив орієнтовані насамперед на ринок США.',
      },
      {
        q: 'Яка альтернатива працює з Telegram?',
        a: 'Лише PR-TOP. Усі інші інструменти в цьому списку доступні тільки через браузер або мобільний застосунок. Якщо ваші клієнти — у ЄС, СНД чи Латинській Америці, де домінує Telegram, PR-TOP наразі єдиний варіант, який зустрічає клієнтів там, де вони вже є.',
      },
      {
        q: 'Як часто оновлюється цей список?',
        a: 'Щокварталу. Ціни, функції та позиціювання конкурентів переперевіряються за сайтами вендорів кожні три місяці; водночас оновлюються рядки порівняння та дата «Оновлено» вгорі сторінки.',
      },
      {
        q: 'Що не увійшло до цього списку?',
        a: 'Інструменти лише для ентерпрайзу (Eleos), суто системи управління практикою без AI-нотаток (SimplePractice, TherapyNotes) та інструменти лише для диктування без шаблонів для терапії. Вони розв’язують інші задачі й зробили б список менш корисним.',
      },
    ],
    ctaH2: 'Безперервність між сесіями — те, чого бракує більшості в цьому списку',
    ctaBody:
      'Усі інші продукти на цій сторінці зупиняються на документуванні сесій. Якщо ваша справжня проблема — зберегти контекст клієнта впродовж тижня, PR-TOP — єдиний варіант тут, який її розв’язує. Безкоштовний Trial, без картки, без прив’язки.',
    ctaStart: 'Почати безкоштовно',
    ctaCompare: 'PR-TOP vs Upheal (докладно)',
    ctaGdpr: 'Як PR-TOP дотримується GDPR',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'Alternativas a Upheal (2026): Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    seoDescription:
      'Ranking de alternativas a Upheal para terapeutas en 2026: comparativa honesta de Mentalyc, Twofold, Heidi, Supanote y PR-TOP para el seguimiento entre sesiones.',
    articleHeadline: 'Alternativas a Upheal (2026) — Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    articleDescription:
      'Ranking de alternativas a Upheal para terapeutas en 2026: Mentalyc, Twofold, Heidi, Supanote y PR-TOP para la continuidad entre sesiones.',
    backHome: '← Volver al inicio',
    badge: 'Alternativas',
    h1: 'Alternativas a Upheal para terapeutas (2026)',
    updated: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    intro: [
      'Las mejores ',
      { b: 'alternativas a Upheal' },
      ' para terapeutas en 2026 se dividen en dos grupos. Para notas de sesión con IA más profundas: ',
      { b: 'Mentalyc' },
      ', ',
      { b: 'Twofold' },
      ', ',
      { b: 'Heidi' },
      ', ',
      { b: 'Supanote' },
      '. Para el espacio que los asistentes de notas ignoran —el acompañamiento del cliente entre sesiones con diario, ejercicios y alertas de crisis dentro de Telegram— está ',
      { b: 'PR-TOP' },
      ', alojado en la UE y GDPR-first.',
    ],
    howToPickH2: 'Cómo elegir',
    pick1: [
      'Los asistentes de notas con IA documentan sus sesiones. PR-TOP, además, acompaña a sus clientes entre sesiones —diario, ejercicios, alertas de crisis— dentro del mensajero que ya usan a diario. Decida primero cuál es su cuello de botella: ',
      { em: 'redactar las notas de sesión' },
      ' o ',
      { em: 'mantener el contexto entre sesiones' },
      ', y elija del grupo correspondiente.',
    ],
    pick2:
      'Todos los precios que aparecen a continuación se verificaron en el sitio de cada proveedor en julio de 2026 y se actualizan trimestralmente.',
    comparisonH2: 'Comparativa de un vistazo',
    thProduct: 'Producto',
    thCategory: 'Categoría',
    thPrice: 'Precio (desde)',
    thBestFor: 'Ideal para',
    sourcesNote:
      'Fuentes: páginas de precios de cada proveedor, julio de 2026. Más abajo se detalla en qué gana y en qué pierde cada producto.',
    labelCategory: 'Categoría:',
    labelPrice: 'Precio (desde):',
    labelWins: 'En qué gana:',
    labelLoses: 'En qué pierde:',
    labelBestFor: 'Ideal para:',
    compareLinkText: 'Ver la comparativa completa PR-TOP vs Upheal →',
    items: [
      {
        name: 'PR-TOP',
        internal: true,
        internalHref: '/compare/upheal',
        tagline: 'Asistente entre sesiones con bot de Telegram para clientes',
        category: 'Asistente entre sesiones + notas con IA',
        priceFrom: 'Trial gratuito; después €9/mes Basic, €19/mes Pro',
        wins: 'La única opción con canal de cliente en Telegram (diario, ejercicios, alertas de crisis). Alojado en la UE, GDPR-first, EN/RU/UK/ES.',
        loses: 'Sin facturación ni agenda. Las plantillas de notas con IA son menos profundas que las de Upheal o Mentalyc.',
        bestFor:
          'Terapeutas de la UE / CEI / LATAM que buscan continuidad entre sesiones y un canal de cliente en Telegram.',
      },
      {
        name: 'Mentalyc',
        internal: false,
        tagline: 'Notas con IA para terapeutas con enfoque en la privacidad',
        category: 'Notas de sesión con IA',
        priceFrom: 'Desde ~$39/mes (plan gratuito limitado)',
        wins: 'Sólida postura de privacidad, plantillas clínicas maduras (SOAP/DAP/BIRP), marca reconocida entre terapeutas de EE. UU.',
        loses: 'Orientado a EE. UU., sin canal para el cliente, sin integración con mensajería, solo en inglés.',
        bestFor:
          'Terapeutas de EE. UU. cuya prioridad son las notas de sesión redactadas por IA con fuertes garantías de privacidad.',
      },
      {
        name: 'Twofold',
        internal: false,
        tagline: 'Notas con IA rápidas y con interfaz ligera',
        category: 'Notas de sesión con IA',
        priceFrom: 'Desde ~$29/mes',
        wins: 'UX limpia y bien pensada; borradores de notas muy rápidos.',
        loses: 'Funcionalidad más limitada que Upheal o Mentalyc; sin app para el cliente; centrado en el mercado de EE. UU.',
        bestFor: 'Terapeutas independientes que quieren notas con IA con menos fricción de interfaz que Upheal.',
      },
      {
        name: 'Heidi',
        internal: false,
        tagline: 'Escriba clínico de IA genérico (más amplio que la terapia)',
        category: 'Escriba clínico de IA',
        priceFrom: 'Plan gratuito + planes de pago',
        wins: 'Rápido, funciona en muchas especialidades clínicas, plan gratuito generoso.',
        loses: 'No es específico de terapia; hay usuarios que reportan problemas de fiabilidad a gran escala; sin canal para el cliente.',
        bestFor: 'Consultas multidisciplinares que quieren un único escriba de IA para varios roles clínicos.',
      },
      {
        name: 'Supanote',
        internal: false,
        tagline: 'Notas con IA con plantillas centradas en terapia',
        category: 'Notas de sesión con IA',
        priceFrom: 'Desde ~$25/mes',
        wins: 'Plantillas específicas de terapia, precios competitivos, funcionalidad en crecimiento.',
        loses: 'Ecosistema más pequeño que el de Upheal, sin canal para el cliente, centrado en el mercado de EE. UU.',
        bestFor: 'Terapeutas que buscan una herramienta de notas con IA más económica y con plantillas de terapia.',
      },
    ],
    faqH2: 'Preguntas frecuentes',
    faq: [
      {
        q: '¿Cuál es la mejor alternativa a Upheal para terapeutas?',
        a: 'No hay una única respuesta: elija según la tarea. Mentalyc es el tomador de notas con IA más sólido en privacidad. Twofold y Supanote apuestan por la rapidez y la sencillez. Heidi es un asistente genérico y rápido de transcripción y notas. PR-TOP es la única opción de esta lista que cubre el canal entre sesiones mediante un bot de Telegram para clientes, no solo la documentación.',
      },
      {
        q: '¿Existe una alternativa gratuita a Upheal?',
        a: 'Sí. PR-TOP ofrece un plan Trial gratuito con el bot de cliente, el diario, los ejercicios y el panel cifrado activados. Mentalyc tiene un plan gratuito limitado. La mayoría de los competidores de notas de sesión (Twofold, Heidi, Supanote) ofrecen pruebas gratuitas cortas en lugar de un plan gratuito permanente.',
      },
      {
        q: '¿Qué alternativa a Upheal es mejor para terapeutas de la UE con enfoque GDPR?',
        a: 'PR-TOP es la opción más explícitamente europea: alojado en Hetzner (UE), cifrado a nivel de aplicación para datos de clase A, DPA por defecto y analítica propia sin rastreadores de terceros. Mentalyc destaca la privacidad, pero tiene sede en EE. UU. La mayoría de las demás alternativas se orientan primero al mercado estadounidense.',
      },
      {
        q: '¿Qué alternativa funciona con Telegram?',
        a: 'Solo PR-TOP. Todas las demás herramientas de esta lista funcionan únicamente en navegador o aplicación móvil. Si sus clientes están en la UE, la CEI o LATAM, donde Telegram es dominante, PR-TOP es hoy la única opción que llega a los clientes donde ya están.',
      },
      {
        q: '¿Con qué frecuencia se actualiza esta lista?',
        a: 'Trimestralmente. Los precios, funciones y posicionamiento de los competidores se vuelven a verificar en el sitio de cada proveedor cada tres meses, y las filas de la comparativa y la fecha de «Actualizado» de la parte superior se renuevan al mismo tiempo.',
      },
      {
        q: '¿Qué no se incluyó en esta lista?',
        a: 'Herramientas solo para grandes organizaciones (Eleos), suites de gestión de consulta sin notas con IA (SimplePractice, TherapyNotes) y herramientas de solo dictado sin plantillas específicas de terapia. Resuelven problemas distintos y harían la lista menos útil.',
      },
    ],
    ctaH2: 'La continuidad entre sesiones es lo que le falta a casi toda esta lista',
    ctaBody:
      'Todos los demás productos de esta página se detienen en documentar sus sesiones. Si su verdadero problema es conservar el contexto del cliente durante la semana, PR-TOP es la única opción aquí que lo resuelve. Trial gratuito, sin tarjeta, sin permanencia.',
    ctaStart: 'Empezar gratis',
    ctaCompare: 'PR-TOP vs Upheal (en detalle)',
    ctaGdpr: 'Cómo PR-TOP gestiona el GDPR',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

// Renders a segment array (strings + { b } / { em } marks) as JSX.
function renderSegments(parts) {
  return parts.map((p, i) => {
    if (typeof p === 'string') return <React.Fragment key={i}>{p}</React.Fragment>;
    if (p.b) return <strong key={i}>{p.b}</strong>;
    return <em key={i}>{p.em}</em>;
  });
}

export default function AlternativesUpheal() {
  const { i18n } = useTranslation();
  const lp = useLocalePath();
  const locale = ['ru', 'uk', 'es'].includes(i18n.language) ? i18n.language : 'en';
  const c = CONTENT[locale];

  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : '/' + locale}/alternatives/upheal`;

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

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: c.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <Seo
        path="/alternatives/upheal"
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
            {c.backHome}
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
          <p className="text-sm text-gray-500">
            {c.updated}
          </p>
        </header>

        {/* Rule 1 — direct-answer block, 40-60 words. */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">
            {renderSegments(c.intro)}
          </p>
        </div>

        {/* Rule 7 — wedge in top H2. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.howToPickH2}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            {renderSegments(c.pick1)}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {c.pick2}
          </p>
        </section>

        {/* Rule 3 — honest comparison table. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.comparisonH2}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">{c.thProduct}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.thCategory}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.thPrice}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.thBestFor}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.items.map((it, i) => (
                  <tr key={it.name} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="p-3 border border-gray-200 font-medium">{it.name}</td>
                    <td className="p-3 border border-gray-200">{it.category}</td>
                    <td className="p-3 border border-gray-200">{it.priceFrom}</td>
                    <td className="p-3 border border-gray-200">{it.bestFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {c.sourcesNote}
          </p>
        </section>

        {c.items.map((it, idx) => (
          <section key={it.name} className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">
              {idx + 1}. {it.name}
            </h2>
            <p className="text-gray-500 italic mb-4">{it.tagline}</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
              <li><strong>{c.labelCategory}</strong> {it.category}</li>
              <li><strong>{c.labelPrice}</strong> {it.priceFrom}</li>
              <li><strong>{c.labelWins}</strong> {it.wins}</li>
              <li><strong>{c.labelLoses}</strong> {it.loses}</li>
              <li><strong>{c.labelBestFor}</strong> {it.bestFor}</li>
            </ul>
            <div className="mt-3">
              {/* External competitor links intentionally omitted — names only */}
              {it.internal && (
                <Link
                  to={lp(it.internalHref)}
                  className="text-sm text-primary underline hover:no-underline"
                >
                  {c.compareLinkText}
                </Link>
              )}
            </div>
          </section>
        ))}

        <section className="mb-10" id="faq">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.faqH2}
          </h2>
          <div className="space-y-6">
            {c.faq.map((item) => (
              <div key={item.q}>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-700 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-4 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {c.ctaH2}
          </h2>
          <p className="text-gray-700 mb-4">
            {c.ctaBody}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={lp('/')}
              className="inline-flex items-center px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {c.ctaStart}
            </Link>
            <Link
              to={lp('/compare/upheal')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaCompare}
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
