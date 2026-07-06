import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /compare/upheal  —  PR-TOP vs Upheal comparison (F20, localized EN/RU/UK/ES).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. Honest feature/price <table>
 *   4. FAQ block + FAQPage JSON-LD
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to / and to sibling /alternatives/upheal
 *   7. PR-TOP wedge (diary + exercises + crisis alerts + Telegram) in top H2s
 *
 * Competitor data source (verified 2026-07): https://www.upheal.io/pricing
 */

const CONTENT = {
  en: {
    seoTitle: 'PR-TOP vs Upheal (2026) — honest comparison for therapists',
    seoDescription:
      'Upheal is an AI-native session-notes EHR from ~$29/mo. PR-TOP is a between-session assistant with Telegram client bot, diary, crisis alerts.',
    backHome: '← Back to home',
    badge: 'Comparison',
    h1: 'PR-TOP vs Upheal — comparison for therapists',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    answer: {
      upheal:
        'is an AI-native EHR for therapists built around session notes, scheduling and billing, from roughly $29/mo and US-market-oriented.',
      prtop:
        'is a therapist-controlled between-session assistant: an encrypted dashboard plus a Telegram client bot for diary, exercises and one-tap crisis alerts. GDPR-first, EU-hosted, four languages (EN/RU/UK/ES). Different jobs — many practices use both.',
    },
    jobs: {
      h2: 'Different jobs, not a head-to-head',
      p1a: 'AI note-takers like Upheal document your sessions. PR-TOP also stays with your clients ',
      p1em: 'between',
      p1b: ' sessions — diary, exercises, crisis alerts — inside the messenger they already use every day (Telegram). If your main pain point is writing session notes faster, Upheal is a strong choice. If your main pain point is preserving client context and reducing double-documentation across the week, PR-TOP is built for exactly that.',
      p2: 'Both products can coexist: an EU practice can run Upheal (or a local EHR) for documentation and PR-TOP for the client-facing channel, because their scopes barely overlap.',
    },
    table: {
      h2: 'Feature and price comparison (2026)',
      headers: ['Category', 'Upheal', 'PR-TOP'],
      rows: [
        ['Category', 'AI-native session-notes EHR', 'Between-session assistant + Telegram client bot'],
        ['Pricing (from)', '~$29/mo (Starter), scales up per feature', 'Free Trial, then €9/mo Basic, €19/mo Pro'],
        ['AI session notes', 'Core product — deep, mature, SOAP/DAP/etc.', 'Yes (Whisper + configurable providers), simpler templates'],
        ['Client-facing app', 'No native client app', 'Telegram bot (voice/text/video diary, exercises, SOS)'],
        ['Between-session diary', 'Not in scope', 'Yes — voice / text / video, encrypted'],
        ['Crisis / SOS alerts', 'Not in scope', 'One-tap client SOS with multi-channel therapist notify'],
        ['Scheduling & billing', 'Yes (calendar, invoicing, US insurance flow)', 'Not included — pair with a local EHR'],
        ['Encryption model', 'TLS + at-rest; enterprise-grade', 'Application-layer AES for Class A data (diary, transcripts, notes)'],
        ['Hosting / data residency', 'US-centric', 'EU-only (Hetzner)'],
        ['Languages', 'English (primary)', 'English, Russian, Ukrainian, Spanish'],
        ['Where it wins', 'Depth of AI notes, EHR features, US-market fit', 'Between-session continuity, EU/GDPR, client channel'],
        ['Where it loses', 'No client channel, US-centric compliance context, higher price', 'No billing/scheduling, notes templates less deep than Upheal'],
        ['Best for', 'US-based practices needing a full AI-notes EHR', 'EU/CIS/LATAM therapists wanting between-session context + a client channel'],
      ],
      note: 'Upheal figures verified against upheal.io/pricing in July 2026. Numbers refresh quarterly.',
    },
    chooseUpheal: {
      h2: 'When to choose Upheal',
      items: [
        'You are a US-based practice that needs AI-generated notes in SOAP/DAP/BIRP formats out of the box.',
        'You want scheduling, invoicing and (optionally) insurance flows in one tool.',
        'Your clients meet with you on Zoom or in person and you do not need a between-session engagement channel.',
      ],
    },
    choosePrtop: {
      h2: 'When to choose PR-TOP',
      items: [
        'You want your clients to keep a real-time diary (voice, text, video) between sessions.',
        'You want a one-tap crisis / SOS channel from the client’s phone to your inbox.',
        'You want to assign exercises and see whether the client actually did them.',
        'You are in the EU or CIS and prefer GDPR-first, EU-hosted software with a DPA by default.',
        'You want your interface (and your clients’ interface) in Russian, Ukrainian or Spanish, not only English.',
      ],
    },
    faq: {
      h2: 'Frequently asked questions',
      items: [
        {
          q: 'Is PR-TOP a replacement for Upheal?',
          a: 'Not directly. Upheal is an AI-native EHR built around session documentation, scheduling and billing. PR-TOP is a between-session assistant: it does not replace an EHR. Many EU therapists use PR-TOP alongside a lightweight local practice-management tool because their compliance context is GDPR, not US HIPAA.',
        },
        {
          q: 'Which is cheaper — Upheal or PR-TOP?',
          a: 'PR-TOP starts free (Trial), then Basic is €9/mo and Pro €19/mo. Upheal starts at about $29/mo and scales up per feature set. On a like-for-like AI-notes-only comparison Upheal has more depth; on total client-engagement surface (bot + diary + exercises + alerts) PR-TOP is broader for less money.',
        },
        {
          q: 'Does Upheal work with Telegram?',
          a: 'No. Upheal is a browser + mobile app that sits between the therapist and their session recordings. PR-TOP is Telegram-native for the client side: clients keep a diary, receive exercises, and can trigger a crisis alert directly inside the messenger they already use every day.',
        },
        {
          q: 'Is Upheal GDPR-compliant for EU therapists?',
          a: 'Upheal publishes a GDPR page and a DPA, but hosting and go-to-market are US-centric. PR-TOP is EU-hosted (Hetzner), ships a Data Processing Addendum by default, encrypts Class A data (diary entries, transcripts, private notes) at the application layer, and runs self-hosted analytics with no third-party trackers.',
        },
        {
          q: 'What does PR-TOP not do that Upheal does?',
          a: 'PR-TOP does not currently ship insurance billing, calendar/scheduling with automated reminders, or a US-market EHR feature set. If those are your top priorities, Upheal (or SimplePractice) is the better fit. PR-TOP focuses on the between-session channel and encrypted client context, not full practice management.',
        },
        {
          q: 'Can I try PR-TOP without a credit card?',
          a: 'Yes. PR-TOP has a free Trial tier with all core features enabled for a limited number of clients. There is no credit card required to start, and no automatic conversion to a paid plan — you choose when to upgrade.',
        },
      ],
    },
    cta: {
      h2: 'Try PR-TOP alongside your current tools',
      p: 'The free Trial takes about ten minutes to set up. No credit card. If you decide it does not fit your workflow, you can export your data and leave with no lock-in.',
      start: 'Start free trial',
      alternatives: 'See other Upheal alternatives',
      gdpr: 'How PR-TOP handles GDPR',
    },
    footerRights: 'PR-TOP. All rights reserved.',
    jsonld: {
      headline: 'PR-TOP vs Upheal — comparison for therapists (2026)',
      description:
        'Honest 2026 comparison of Upheal (AI-native EHR for session notes) and PR-TOP (therapist-controlled between-session assistant with Telegram client bot).',
    },
  },

  ru: {
    seoTitle: 'PR-TOP или Upheal — сравнение для психологов (2026)',
    seoDescription:
      'Upheal — американская AI-EHR для заметок сессий от ~$29/мес. PR-TOP — ассистент между сессиями: Telegram-бот, дневник, SOS-оповещения, GDPR и хостинг в ЕС.',
    backHome: '← На главную',
    badge: 'Сравнение',
    h1: 'PR-TOP или Upheal — сравнение для психологов',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    answer: {
      upheal:
        '— это AI-native EHR для терапевтов, построенная вокруг заметок сессий, расписания и биллинга: примерно от $29/мес и с ориентацией на рынок США.',
      prtop:
        '— это ассистент между сессиями под контролем терапевта: зашифрованный кабинет плюс Telegram-бот для клиента — дневник, упражнения и SOS-кнопка в одно касание. GDPR-first, хостинг в ЕС, четыре языка (EN/RU/UK/ES). Это разные задачи — многие практики используют оба инструмента.',
    },
    jobs: {
      h2: 'Разные задачи, а не прямое соперничество',
      p1a: 'ИИ-ассистенты для заметок вроде Upheal документируют ваши сессии. PR-TOP же остаётся с вашими клиентами ',
      p1em: 'между',
      p1b: ' сессиями — дневник, упражнения, кризисные оповещения — прямо в мессенджере, которым они и так пользуются каждый день (Telegram). Если ваша главная боль — быстрее писать заметки сессий, Upheal — сильный выбор. Если главная боль — сохранять контекст клиента и избавиться от двойной документации в течение недели, PR-TOP создан именно для этого.',
      p2: 'Оба продукта прекрасно сосуществуют: практика в ЕС может вести документацию в Upheal (или локальной EHR), а PR-TOP использовать как канал для клиентов — их зоны ответственности почти не пересекаются.',
    },
    table: {
      h2: 'Сравнение функций и цен (2026)',
      headers: ['Категория', 'Upheal', 'PR-TOP'],
      rows: [
        ['Категория', 'AI-native EHR для заметок сессий', 'Ассистент между сессиями + Telegram-бот для клиента'],
        ['Цена (от)', '~$29/мес (Starter), дороже по мере роста функций', 'Бесплатный Trial, далее Basic €9/мес, Pro €19/мес'],
        ['ИИ-заметки сессий', 'Ядро продукта — глубокие, зрелые, SOAP/DAP и др.', 'Да (Whisper + настраиваемые провайдеры), шаблоны проще'],
        ['Приложение для клиента', 'Нет нативного клиентского приложения', 'Telegram-бот (голосовой/текстовый/видеодневник, упражнения, SOS)'],
        ['Дневник между сессиями', 'Вне фокуса продукта', 'Да — голос / текст / видео, с шифрованием'],
        ['Кризисные / SOS-оповещения', 'Вне фокуса продукта', 'SOS клиента в одно касание с мультиканальным уведомлением терапевта'],
        ['Расписание и биллинг', 'Да (календарь, счета, страховой флоу США)', 'Не входит — сочетайте с локальной EHR'],
        ['Модель шифрования', 'TLS + шифрование при хранении; корпоративный уровень', 'AES на уровне приложения для данных класса A (дневник, транскрипты, заметки)'],
        ['Хостинг / резидентность данных', 'Ориентация на США', 'Только ЕС (Hetzner)'],
        ['Языки', 'Английский (основной)', 'Английский, русский, украинский, испанский'],
        ['Где выигрывает', 'Глубина ИИ-заметок, функции EHR, соответствие рынку США', 'Непрерывность между сессиями, ЕС/GDPR, канал для клиентов'],
        ['Где проигрывает', 'Нет клиентского канала, комплаенс-контекст США, выше цена', 'Нет биллинга и расписания, шаблоны заметок проще, чем у Upheal'],
        ['Кому подходит', 'Практикам в США, которым нужна полноценная AI-EHR для заметок', 'Терапевтам из ЕС/СНГ/Латинской Америки, которым нужны контекст между сессиями и канал для клиентов'],
      ],
      note: 'Данные Upheal сверены с upheal.io/pricing в июле 2026 года. Цифры обновляются ежеквартально.',
    },
    chooseUpheal: {
      h2: 'Когда выбрать Upheal',
      items: [
        'Вы практикуете в США, и вам нужны ИИ-заметки в форматах SOAP/DAP/BIRP из коробки.',
        'Вам нужны расписание, выставление счетов и (опционально) страховые флоу в одном инструменте.',
        'Клиенты встречаются с вами в Zoom или очно, и канал вовлечения между сессиями вам не нужен.',
      ],
    },
    choosePrtop: {
      h2: 'Когда выбрать PR-TOP',
      items: [
        'Вы хотите, чтобы клиенты вели дневник в реальном времени (голос, текст, видео) между сессиями.',
        'Вам нужен кризисный / SOS-канал в одно касание — с телефона клиента прямо к вам.',
        'Вы хотите назначать упражнения и видеть, выполнил ли их клиент на самом деле.',
        'Вы находитесь в ЕС или СНГ и предпочитаете GDPR-first-софт с хостингом в ЕС и DPA по умолчанию.',
        'Вам нужен интерфейс (и интерфейс ваших клиентов) на русском, украинском или испанском, а не только на английском.',
      ],
    },
    faq: {
      h2: 'Часто задаваемые вопросы',
      items: [
        {
          q: 'Заменяет ли PR-TOP Upheal?',
          a: 'Не напрямую. Upheal — это AI-native EHR, построенная вокруг документации сессий, расписания и биллинга. PR-TOP — ассистент между сессиями и не заменяет EHR. Многие терапевты в ЕС используют PR-TOP вместе с лёгким локальным инструментом управления практикой, потому что их комплаенс-контекст — GDPR, а не американский HIPAA.',
        },
        {
          q: 'Что дешевле — Upheal или PR-TOP?',
          a: 'PR-TOP начинается бесплатно (Trial), далее Basic — €9/мес и Pro — €19/мес. Upheal стартует примерно от $29/мес и дорожает по мере расширения функций. Если сравнивать только ИИ-заметки, у Upheal больше глубины; по общему охвату работы с клиентом (бот + дневник + упражнения + оповещения) PR-TOP шире и дешевле.',
        },
        {
          q: 'Работает ли Upheal с Telegram?',
          a: 'Нет. Upheal — это браузерное и мобильное приложение между терапевтом и записями его сессий. PR-TOP же нативен для Telegram на стороне клиента: клиенты ведут дневник, получают упражнения и могут отправить кризисное оповещение прямо в мессенджере, которым пользуются каждый день.',
        },
        {
          q: 'Соответствует ли Upheal GDPR для терапевтов из ЕС?',
          a: 'У Upheal есть страница о GDPR и DPA, но хостинг и стратегия выхода на рынок ориентированы на США. PR-TOP размещён в ЕС (Hetzner), по умолчанию включает Data Processing Addendum, шифрует данные класса A (записи дневника, транскрипты, приватные заметки) на уровне приложения и использует self-hosted-аналитику без сторонних трекеров.',
        },
        {
          q: 'Чего PR-TOP не умеет из того, что умеет Upheal?',
          a: 'В PR-TOP пока нет страхового биллинга, календаря с автоматическими напоминаниями и набора функций EHR для рынка США. Если это ваши приоритеты, Upheal (или SimplePractice) подойдёт лучше. PR-TOP сосредоточен на канале между сессиями и зашифрованном контексте клиента, а не на полном управлении практикой.',
        },
        {
          q: 'Можно ли попробовать PR-TOP без банковской карты?',
          a: 'Да. У PR-TOP есть бесплатный тариф Trial со всеми ключевыми функциями для ограниченного числа клиентов. Карта для старта не нужна, автоматического перевода на платный тариф нет — вы сами выбираете момент апгрейда.',
        },
      ],
    },
    cta: {
      h2: 'Попробуйте PR-TOP вместе с вашими текущими инструментами',
      p: 'Настройка бесплатного Trial занимает около десяти минут. Банковская карта не нужна. Если решите, что инструмент не вписался в ваш процесс, вы сможете выгрузить данные и уйти без привязки к платформе.',
      start: 'Начать бесплатно',
      alternatives: 'Другие альтернативы Upheal',
      gdpr: 'Как PR-TOP работает с GDPR',
    },
    footerRights: 'PR-TOP. Все права защищены.',
    jsonld: {
      headline: 'PR-TOP или Upheal — сравнение для психологов (2026)',
      description:
        'Честное сравнение 2026 года: Upheal (AI-native EHR для заметок сессий) и PR-TOP (ассистент между сессиями под контролем терапевта с Telegram-ботом для клиента).',
    },
  },

  uk: {
    seoTitle: 'PR-TOP чи Upheal — порівняння для психологів (2026)',
    seoDescription:
      'Upheal — американська AI-EHR для нотаток сесій від ~$29/міс. PR-TOP — асистент між сесіями: Telegram-бот, щоденник, SOS-сповіщення, GDPR і хостинг у ЄС.',
    backHome: '← На головну',
    badge: 'Порівняння',
    h1: 'PR-TOP чи Upheal — порівняння для психологів',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    answer: {
      upheal:
        '— це AI-native EHR для терапевтів, побудована навколо нотаток сесій, розкладу та білінгу: приблизно від $29/міс і з орієнтацією на ринок США.',
      prtop:
        '— це асистент між сесіями під контролем терапевта: зашифрований кабінет плюс Telegram-бот для клієнта — щоденник, вправи та SOS-кнопка в один дотик. GDPR-first, хостинг у ЄС, чотири мови (EN/RU/UK/ES). Це різні завдання — багато практик використовують обидва інструменти.',
    },
    jobs: {
      h2: 'Різні завдання, а не пряме суперництво',
      p1a: 'ШІ-асистенти для нотаток на кшталт Upheal документують ваші сесії. PR-TOP натомість залишається з вашими клієнтами ',
      p1em: 'між',
      p1b: ' сесіями — щоденник, вправи, кризові сповіщення — просто в месенджері, яким вони й так користуються щодня (Telegram). Якщо ваш головний біль — швидше писати нотатки сесій, Upheal — сильний вибір. Якщо головний біль — зберігати контекст клієнта та позбутися подвійної документації протягом тижня, PR-TOP створено саме для цього.',
      p2: 'Обидва продукти чудово співіснують: практика в ЄС може вести документацію в Upheal (або локальній EHR), а PR-TOP використовувати як канал для клієнтів — їхні зони відповідальності майже не перетинаються.',
    },
    table: {
      h2: 'Порівняння функцій і цін (2026)',
      headers: ['Категорія', 'Upheal', 'PR-TOP'],
      rows: [
        ['Категорія', 'AI-native EHR для нотаток сесій', 'Асистент між сесіями + Telegram-бот для клієнта'],
        ['Ціна (від)', '~$29/міс (Starter), дорожче з розширенням функцій', 'Безкоштовний Trial, далі Basic €9/міс, Pro €19/міс'],
        ['ШІ-нотатки сесій', 'Ядро продукту — глибокі, зрілі, SOAP/DAP тощо', 'Так (Whisper + налаштовувані провайдери), простіші шаблони'],
        ['Застосунок для клієнта', 'Немає нативного клієнтського застосунку', 'Telegram-бот (голосовий/текстовий/відеощоденник, вправи, SOS)'],
        ['Щоденник між сесіями', 'Поза фокусом продукту', 'Так — голос / текст / відео, із шифруванням'],
        ['Кризові / SOS-сповіщення', 'Поза фокусом продукту', 'SOS клієнта в один дотик із мультиканальним сповіщенням терапевта'],
        ['Розклад і білінг', 'Так (календар, рахунки, страховий флоу США)', 'Не входить — поєднуйте з локальною EHR'],
        ['Модель шифрування', 'TLS + шифрування під час зберігання; корпоративний рівень', 'AES на рівні застосунку для даних класу A (щоденник, транскрипти, нотатки)'],
        ['Хостинг / резидентність даних', 'Орієнтація на США', 'Лише ЄС (Hetzner)'],
        ['Мови', 'Англійська (основна)', 'Англійська, російська, українська, іспанська'],
        ['Де виграє', 'Глибина ШІ-нотаток, функції EHR, відповідність ринку США', 'Безперервність між сесіями, ЄС/GDPR, канал для клієнтів'],
        ['Де програє', 'Немає клієнтського каналу, комплаєнс-контекст США, вища ціна', 'Немає білінгу та розкладу, шаблони нотаток простіші, ніж в Upheal'],
        ['Кому підходить', 'Практикам у США, яким потрібна повноцінна AI-EHR для нотаток', 'Терапевтам з ЄС/СНД/Латинської Америки, яким потрібні контекст між сесіями та канал для клієнтів'],
      ],
      note: 'Дані Upheal звірено з upheal.io/pricing у липні 2026 року. Цифри оновлюються щокварталу.',
    },
    chooseUpheal: {
      h2: 'Коли обрати Upheal',
      items: [
        'Ви практикуєте в США, і вам потрібні ШІ-нотатки у форматах SOAP/DAP/BIRP з коробки.',
        'Вам потрібні розклад, виставлення рахунків і (опційно) страхові флоу в одному інструменті.',
        'Клієнти зустрічаються з вами в Zoom або наживо, і канал залучення між сесіями вам не потрібен.',
      ],
    },
    choosePrtop: {
      h2: 'Коли обрати PR-TOP',
      items: [
        'Ви хочете, щоб клієнти вели щоденник у реальному часі (голос, текст, відео) між сесіями.',
        'Вам потрібен кризовий / SOS-канал в один дотик — з телефона клієнта просто до вас.',
        'Ви хочете призначати вправи й бачити, чи справді клієнт їх виконав.',
        'Ви в ЄС чи СНД і надаєте перевагу GDPR-first-софту з хостингом у ЄС і DPA за замовчуванням.',
        'Вам потрібен інтерфейс (і інтерфейс ваших клієнтів) українською, російською чи іспанською, а не лише англійською.',
      ],
    },
    faq: {
      h2: 'Часті запитання',
      items: [
        {
          q: 'Чи замінює PR-TOP Upheal?',
          a: 'Не напряму. Upheal — це AI-native EHR, побудована навколо документації сесій, розкладу та білінгу. PR-TOP — асистент між сесіями і не замінює EHR. Багато терапевтів у ЄС використовують PR-TOP разом із легким локальним інструментом управління практикою, бо їхній комплаєнс-контекст — GDPR, а не американський HIPAA.',
        },
        {
          q: 'Що дешевше — Upheal чи PR-TOP?',
          a: 'PR-TOP починається безкоштовно (Trial), далі Basic — €9/міс і Pro — €19/міс. Upheal стартує приблизно від $29/міс і дорожчає з розширенням функцій. Якщо порівнювати лише ШІ-нотатки, в Upheal більше глибини; за загальним охопленням роботи з клієнтом (бот + щоденник + вправи + сповіщення) PR-TOP ширший і дешевший.',
        },
        {
          q: 'Чи працює Upheal з Telegram?',
          a: 'Ні. Upheal — це браузерний і мобільний застосунок між терапевтом та записами його сесій. PR-TOP натомість нативний для Telegram на боці клієнта: клієнти ведуть щоденник, отримують вправи й можуть надіслати кризове сповіщення просто в месенджері, яким користуються щодня.',
        },
        {
          q: 'Чи відповідає Upheal GDPR для терапевтів з ЄС?',
          a: 'В Upheal є сторінка про GDPR і DPA, але хостинг і стратегія виходу на ринок орієнтовані на США. PR-TOP розміщено в ЄС (Hetzner), за замовчуванням включає Data Processing Addendum, шифрує дані класу A (записи щоденника, транскрипти, приватні нотатки) на рівні застосунку й використовує self-hosted-аналітику без сторонніх трекерів.',
        },
        {
          q: 'Чого PR-TOP не вміє з того, що вміє Upheal?',
          a: 'У PR-TOP поки немає страхового білінгу, календаря з автоматичними нагадуваннями та набору функцій EHR для ринку США. Якщо це ваші пріоритети, Upheal (або SimplePractice) підійде краще. PR-TOP зосереджений на каналі між сесіями та зашифрованому контексті клієнта, а не на повному управлінні практикою.',
        },
        {
          q: 'Чи можна спробувати PR-TOP без банківської картки?',
          a: 'Так. У PR-TOP є безкоштовний тариф Trial з усіма ключовими функціями для обмеженої кількості клієнтів. Картка для старту не потрібна, автоматичного переходу на платний план немає — ви самі обираєте момент апгрейду.',
        },
      ],
    },
    cta: {
      h2: 'Спробуйте PR-TOP поряд із вашими поточними інструментами',
      p: 'Налаштування безкоштовного Trial займає близько десяти хвилин. Банківська картка не потрібна. Якщо вирішите, що інструмент не вписався у ваш процес, ви зможете вивантажити дані й піти без прив’язки до платформи.',
      start: 'Почати безкоштовно',
      alternatives: 'Інші альтернативи Upheal',
      gdpr: 'Як PR-TOP працює з GDPR',
    },
    footerRights: 'PR-TOP. Усі права захищено.',
    jsonld: {
      headline: 'PR-TOP чи Upheal — порівняння для психологів (2026)',
      description:
        'Чесне порівняння 2026 року: Upheal (AI-native EHR для нотаток сесій) і PR-TOP (асистент між сесіями під контролем терапевта з Telegram-ботом для клієнта).',
    },
  },

  es: {
    seoTitle: 'PR-TOP vs Upheal: comparativa para terapeutas (2026)',
    seoDescription:
      'Upheal es un EHR de notas de sesión con IA desde ~$29/mes. PR-TOP es un asistente entre sesiones con bot de Telegram, diario, alertas SOS y alojamiento en la UE.',
    backHome: '← Volver al inicio',
    badge: 'Comparativa',
    h1: 'PR-TOP vs Upheal: comparativa para terapeutas',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    answer: {
      upheal:
        'es un EHR con IA nativa para terapeutas, centrado en notas de sesión, agenda y facturación: desde unos $29/mes y orientado al mercado estadounidense.',
      prtop:
        'es un asistente entre sesiones controlado por el terapeuta: un panel cifrado más un bot de Telegram para el cliente con diario, ejercicios y alerta de crisis con un toque. GDPR primero, alojado en la UE, cuatro idiomas (EN/RU/UK/ES). Son trabajos distintos: muchas consultas usan ambos.',
    },
    jobs: {
      h2: 'Trabajos distintos, no un duelo directo',
      p1a: 'Los asistentes de notas con IA como Upheal documentan sus sesiones. PR-TOP, además, acompaña a sus clientes ',
      p1em: 'entre',
      p1b: ' sesiones — diario, ejercicios, alertas de crisis — dentro del mensajero que ya usan a diario (Telegram). Si su principal problema es redactar las notas de sesión más rápido, Upheal es una gran opción. Si su principal problema es conservar el contexto del cliente y reducir la doble documentación a lo largo de la semana, PR-TOP está diseñado exactamente para eso.',
      p2: 'Ambos productos pueden coexistir: una consulta en la UE puede usar Upheal (o un EHR local) para la documentación y PR-TOP como canal orientado al cliente, porque sus ámbitos apenas se solapan.',
    },
    table: {
      h2: 'Comparativa de funciones y precios (2026)',
      headers: ['Categoría', 'Upheal', 'PR-TOP'],
      rows: [
        ['Categoría', 'EHR de notas de sesión con IA nativa', 'Asistente entre sesiones + bot de Telegram para el cliente'],
        ['Precio (desde)', '~$29/mes (Starter), sube según las funciones', 'Trial gratuito; luego Basic €9/mes y Pro €19/mes'],
        ['Notas de sesión con IA', 'Núcleo del producto: profundas, maduras, SOAP/DAP, etc.', 'Sí (Whisper + proveedores configurables), plantillas más simples'],
        ['App para el cliente', 'Sin app nativa para el cliente', 'Bot de Telegram (diario de voz/texto/vídeo, ejercicios, SOS)'],
        ['Diario entre sesiones', 'Fuera de su alcance', 'Sí: voz / texto / vídeo, cifrado'],
        ['Alertas de crisis / SOS', 'Fuera de su alcance', 'SOS del cliente con un toque y aviso multicanal al terapeuta'],
        ['Agenda y facturación', 'Sí (calendario, facturas, flujo de seguros de EE. UU.)', 'No incluido: combínelo con un EHR local'],
        ['Modelo de cifrado', 'TLS + cifrado en reposo; nivel empresarial', 'AES a nivel de aplicación para datos de clase A (diario, transcripciones, notas)'],
        ['Alojamiento / residencia de datos', 'Centrado en EE. UU.', 'Solo UE (Hetzner)'],
        ['Idiomas', 'Inglés (principal)', 'Inglés, ruso, ucraniano, español'],
        ['Dónde gana', 'Profundidad de las notas con IA, funciones de EHR, encaje en EE. UU.', 'Continuidad entre sesiones, UE/GDPR, canal para el cliente'],
        ['Dónde pierde', 'Sin canal para el cliente, contexto de cumplimiento de EE. UU., precio más alto', 'Sin facturación ni agenda; plantillas de notas menos profundas que Upheal'],
        ['Ideal para', 'Consultas en EE. UU. que necesitan un EHR completo de notas con IA', 'Terapeutas de la UE/CEI/LatAm que quieren contexto entre sesiones y un canal para el cliente'],
      ],
      note: 'Cifras de Upheal verificadas en upheal.io/pricing en julio de 2026. Los datos se actualizan trimestralmente.',
    },
    chooseUpheal: {
      h2: 'Cuándo elegir Upheal',
      items: [
        'Su consulta está en EE. UU. y necesita notas generadas por IA en formatos SOAP/DAP/BIRP desde el primer día.',
        'Quiere agenda, facturación y (opcionalmente) flujos de seguros en una sola herramienta.',
        'Sus clientes se reúnen con usted por Zoom o en persona y no necesita un canal de acompañamiento entre sesiones.',
      ],
    },
    choosePrtop: {
      h2: 'Cuándo elegir PR-TOP',
      items: [
        'Quiere que sus clientes lleven un diario en tiempo real (voz, texto, vídeo) entre sesiones.',
        'Quiere un canal de crisis / SOS con un toque, del teléfono del cliente directo a su bandeja.',
        'Quiere asignar ejercicios y comprobar si el cliente realmente los hizo.',
        'Está en la UE o la CEI y prefiere software GDPR primero, alojado en la UE y con DPA por defecto.',
        'Quiere su interfaz (y la de sus clientes) en ruso, ucraniano o español, no solo en inglés.',
      ],
    },
    faq: {
      h2: 'Preguntas frecuentes',
      items: [
        {
          q: '¿Es PR-TOP un sustituto de Upheal?',
          a: 'No directamente. Upheal es un EHR con IA nativa centrado en la documentación de sesiones, la agenda y la facturación. PR-TOP es un asistente entre sesiones: no sustituye a un EHR. Muchos terapeutas de la UE usan PR-TOP junto a una herramienta local ligera de gestión de consulta, porque su marco de cumplimiento es el GDPR, no la HIPAA estadounidense.',
        },
        {
          q: '¿Cuál es más barato: Upheal o PR-TOP?',
          a: 'PR-TOP empieza gratis (Trial); después, Basic cuesta €9/mes y Pro €19/mes. Upheal parte de unos $29/mes y sube según el conjunto de funciones. Comparando solo las notas con IA, Upheal tiene más profundidad; en superficie total de acompañamiento al cliente (bot + diario + ejercicios + alertas), PR-TOP abarca más por menos dinero.',
        },
        {
          q: '¿Funciona Upheal con Telegram?',
          a: 'No. Upheal es una aplicación de navegador y móvil situada entre el terapeuta y las grabaciones de sus sesiones. PR-TOP es nativo de Telegram en el lado del cliente: los clientes llevan un diario, reciben ejercicios y pueden activar una alerta de crisis directamente en el mensajero que ya usan a diario.',
        },
        {
          q: '¿Cumple Upheal el GDPR para terapeutas de la UE?',
          a: 'Upheal publica una página sobre GDPR y un DPA, pero su alojamiento y su enfoque comercial se centran en EE. UU. PR-TOP se aloja en la UE (Hetzner), incluye un Data Processing Addendum por defecto, cifra los datos de clase A (entradas del diario, transcripciones, notas privadas) a nivel de aplicación y usa analítica autoalojada sin rastreadores de terceros.',
        },
        {
          q: '¿Qué no hace PR-TOP que sí hace Upheal?',
          a: 'PR-TOP no incluye por ahora facturación de seguros, calendario con recordatorios automáticos ni el conjunto de funciones de un EHR para el mercado de EE. UU. Si esas son sus prioridades, Upheal (o SimplePractice) encaja mejor. PR-TOP se centra en el canal entre sesiones y en el contexto cifrado del cliente, no en la gestión integral de la consulta.',
        },
        {
          q: '¿Puedo probar PR-TOP sin tarjeta de crédito?',
          a: 'Sí. PR-TOP tiene un plan Trial gratuito con todas las funciones principales para un número limitado de clientes. No se requiere tarjeta de crédito para empezar y no hay conversión automática a un plan de pago: usted decide cuándo pasar a un plan superior.',
        },
      ],
    },
    cta: {
      h2: 'Pruebe PR-TOP junto a sus herramientas actuales',
      p: 'El Trial gratuito se configura en unos diez minutos. Sin tarjeta de crédito. Si decide que no encaja en su flujo de trabajo, puede exportar sus datos y marcharse sin ataduras.',
      start: 'Empezar gratis',
      alternatives: 'Ver otras alternativas a Upheal',
      gdpr: 'Cómo gestiona PR-TOP el GDPR',
    },
    footerRights: 'PR-TOP. Todos los derechos reservados.',
    jsonld: {
      headline: 'PR-TOP vs Upheal: comparativa para terapeutas (2026)',
      description:
        'Comparativa honesta de 2026 entre Upheal (EHR de notas de sesión con IA) y PR-TOP (asistente entre sesiones controlado por el terapeuta con bot de Telegram).',
    },
  },
};

export default function CompareUpheal() {
  const { i18n } = useTranslation();
  const lp = useLocalePath();
  const locale = ['ru', 'uk', 'es'].includes(i18n.language) ? i18n.language : 'en';
  const c = CONTENT[locale];

  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : '/' + locale}/compare/upheal`;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: c.faq.items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.jsonld.headline,
    description: c.jsonld.description,
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
        path="/compare/upheal"
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
            {c.stamp}
          </p>
        </header>

        {/* Rule 1 — direct-answer block, 40-60 words. */}
        <div className="bg-primary/5 border-l-4 border-primary p-5 rounded-r-lg mb-10">
          <p className="text-gray-800 leading-relaxed">
            <strong>Upheal</strong> {c.answer.upheal}{' '}
            <strong>PR-TOP</strong> {c.answer.prtop}
          </p>
        </div>

        {/* Rule 7 — wedge in first H2. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.jobs.h2}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            {c.jobs.p1a}<em>{c.jobs.p1em}</em>{c.jobs.p1b}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {c.jobs.p2}
          </p>
        </section>

        {/* Rule 3 — honest feature/price table. Data verified 2026-07 against
            https://www.upheal.io/ and https://www.upheal.io/pricing */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.table.h2}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  {c.table.headers.map((h) => (
                    <th key={h} className="p-3 border border-gray-200 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.table.rows.map((row, i) => (
                  <tr key={row[0]} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="p-3 border border-gray-200 font-medium">{row[0]}</td>
                    <td className="p-3 border border-gray-200">{row[1]}</td>
                    <td className="p-3 border border-gray-200">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {c.table.note}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.chooseUpheal.h2}
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            {c.chooseUpheal.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.choosePrtop.h2}
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            {c.choosePrtop.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10" id="faq">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.faq.h2}
          </h2>
          <div className="space-y-6">
            {c.faq.items.map((item) => (
              <div key={item.q}>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-700 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-4 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {c.cta.h2}
          </h2>
          <p className="text-gray-700 mb-4">
            {c.cta.p}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={lp('/')}
              className="inline-flex items-center px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {c.cta.start}
            </Link>
            <Link
              to={lp('/alternatives/upheal')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.cta.alternatives}
            </Link>
            <Link
              to={lp('/security/gdpr')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.cta.gdpr}
            </Link>
          </div>
        </section>
      </article>

      <footer className="bg-gray-900 text-white/60 text-center py-6 text-xs">
        &copy; {new Date().getFullYear()} {c.footerRights}
      </footer>
    </div>
  );
}
