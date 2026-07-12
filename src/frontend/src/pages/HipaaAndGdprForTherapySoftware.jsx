import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo';
import useLocalePath from '../hooks/useLocalePath';

/**
 * /hipaa-and-gdpr-for-therapy-software  —  compliance explainer + honest posture page (EN/RU/UK/ES).
 *
 * Follows docs/seo/CONTENT_RULES.md:
 *   1. 40-60 word direct-answer block right below H1
 *   2. Single H1, clean H2/H3 hierarchy
 *   3. HIPAA safeguard vs PR-TOP control table (not a product comparison table)
 *   4. FAQ block + FAQPage JSON-LD (6 Q&As)
 *   5. Visible "Updated: July 2026" stamp + dateModified in JSON-LD
 *   6. Internal links to /security/encryption, /security/gdpr, /security/audit-log,
 *      /security/data-sovereignty, /ai-session-notes-for-therapists
 *   7. PR-TOP wedge in first two H2 sections:
 *      diary + exercises + crisis alerts + Telegram all named
 *
 * CRITICAL: PR-TOP is GDPR-native and EU-hosted. This page MUST NOT claim HIPAA
 * compliance or a BAA. It maps PR-TOP's real controls to HIPAA expectations
 * and states the current posture honestly.
 *
 * Page angle: International therapists ask "is this HIPAA compliant?" — answer
 * honestly, map HIPAA requirements to PR-TOP's real controls, explain why
 * GDPR-first is the right choice for EU/CIS/LATAM practices.
 */

const CONTENT = {
  en: {
    seoTitle: 'HIPAA and GDPR for therapy software — PR-TOP security posture',
    seoDescription:
      'HIPAA and GDPR for therapy software: PR-TOP maps its AES encryption, audit log and consent controls to HIPAA expectations. EU-hosted, GDPR-first.',
    articleHeadline: 'HIPAA and GDPR for therapy software — what PR-TOP offers',
    articleDescription:
      'Honest guide to HIPAA and GDPR for therapy software: how PR-TOP maps its AES encryption, audit log and consent controls to HIPAA expectations, and why GDPR-first hosting is the right choice for EU/CIS/LATAM practices.',
    badge: 'Security & compliance',
    h1: 'HIPAA and GDPR for therapy software — what PR-TOP offers',
    stamp: 'Updated: July 2026 · Reviewed by the PR-TOP team',
    backHome: 'Back to home',

    intro:
      'PR-TOP is EU-hosted and GDPR-native. It applies AES application-layer encryption, an immutable audit log, role-based access control, and consent enforcement to all client data. It does not hold HIPAA certification and does not offer a Business Associate Agreement. EU, Ukrainian, Russian, and LATAM practices should use the GDPR Data Processing Addendum included by default.',

    whatHipaaTitle: 'What HIPAA actually requires',
    whatHipaaP1:
      'HIPAA (the US Health Insurance Portability and Accountability Act) applies to US-based "covered entities" — healthcare providers, health plans, and healthcare clearinghouses — and their "business associates." It sets administrative, physical, and technical safeguards for Protected Health Information (PHI). If you are a therapist licensed in the US and you process PHI, your software vendors must be willing to sign a Business Associate Agreement (BAA).',
    whatHipaaP2:
      'Most non-US therapists encounter HIPAA as a question, not a legal obligation. International practitioners — in the EU, Ukraine, Russia, Latin America — are not HIPAA-covered entities. They are subject to their local data protection law: GDPR in the EU, the Law on Personal Data Protection in Ukraine and Russia, and national privacy laws in LATAM countries. For these practices, GDPR compliance is the correct bar, not HIPAA.',
    whatHipaaP3:
      'PR-TOP is built for this international market. It meets GDPR requirements and applies strong technical controls that parallel many HIPAA safeguards — but it has not been independently audited for HIPAA, and it does not offer the BAA that US covered entities require. This page explains exactly where PR-TOP\'s controls map to HIPAA expectations, and where the gaps are.',
    whatHipaaWedge:
      'PR-TOP sits between sessions — not just at the note-writing moment. Clients keep a voice, text or video diary via Telegram between appointments. Therapists assign exercises, and clients can send one-tap crisis alerts directly to the therapist\'s inbox. All of this data flows through the same AES-encrypted application layer, so the between-session record is protected by the same controls as the session transcript.',

    tableTitle: 'HIPAA safeguards mapped to PR-TOP controls',
    tableHead: {
      safeguard: 'HIPAA safeguard',
      requirement: 'What HIPAA requires',
      control: 'PR-TOP control',
      gap: 'Gap / Notes',
    },
    tableRows: [
      {
        safeguard: 'Access Control',
        requirement: 'Unique user IDs, emergency access procedures, automatic logoff',
        control: 'JWT auth with HttpOnly cookies, role-based access (therapist / client / admin), session tokens with expiry',
        gap: 'No BAA offered; not independently audited for HIPAA; no automatic logoff timer configured by default',
      },
      {
        safeguard: 'Audit Controls',
        requirement: 'Record and examine activity in systems that contain ePHI',
        control: 'Append-only immutable audit log for all Class A data access (diary, transcripts, notes, summaries)',
        gap: 'Audit log is designed to meet this expectation; not formally certified',
      },
      {
        safeguard: 'Encryption at Rest',
        requirement: 'Addressable — encrypt ePHI in storage where reasonable and appropriate',
        control: 'AES application-layer encryption for all Class A data before storage; database holds ciphertext, not plaintext',
        gap: 'Meets the addressable standard; encryption is at the application layer, not full-disk',
      },
      {
        safeguard: 'Integrity',
        requirement: 'Protect ePHI from improper alteration or destruction',
        control: 'Immutable audit trail; no edit-in-place on Class A data; deletions are logged',
        gap: 'Meets the intent; not formally audited against HIPAA integrity requirements',
      },
      {
        safeguard: 'Transmission Security',
        requirement: 'Protect ePHI transmitted over electronic networks',
        control: 'TLS 1.2+ on all connections, HTTPS-only, no plaintext data transfer',
        gap: 'Standard implementation; meets the requirement',
      },
      {
        safeguard: 'Business Associate Agreement',
        requirement: 'Required for covered entities using a business associate\'s service',
        control: 'NOT OFFERED — PR-TOP is not a HIPAA Business Associate',
        gap: 'EU/international practices should use the GDPR Data Processing Addendum instead',
      },
    ],
    tableNote:
      'This table maps PR-TOP\'s existing controls to HIPAA safeguard categories for informational purposes only. It does not constitute legal advice and does not represent HIPAA certification. US covered entities must consult legal counsel before using PR-TOP for PHI.',

    gdprTitle: 'Why GDPR-first may be the right choice for your practice',
    gdprP1:
      'GDPR (the EU General Data Protection Regulation) sets a high bar for data processing: lawful basis, data minimisation, purpose limitation, rights for data subjects (access, rectification, erasure, portability), mandatory breach notification, and — for processors — a Data Processing Addendum (DPA). PR-TOP meets all of these requirements by design.',
    gdprP2:
      'For EU-licensed therapists, GDPR is the binding legal framework. For Ukrainian therapists, the Law on Personal Data Protection applies and is closely aligned with GDPR principles. For LATAM therapists, national frameworks (LGPD in Brazil, Ley 1581 in Colombia, etc.) are either modelled on GDPR or compatible with it. In each case, the correct compliance framework is local law, not HIPAA.',
    gdprP3:
      'PR-TOP processes all data on EU infrastructure (Hetzner data centres). There are no US-based sub-processors for client data. A Data Processing Addendum is available by default — not on request, not behind an enterprise tier. Clients can exercise GDPR data subject rights (access, rectification, erasure) directly through the therapist dashboard. You can export or wipe an entire client record in one action.',
    gdprLead: 'See: ',
    gdprLinkGdpr: 'GDPR compliance details',
    gdprAnd: ', ',
    gdprLinkSovereignty: 'data sovereignty',
    gdprAnd2: ', and ',
    gdprLinkAudit: 'audit log architecture',
    gdprTail: '.',

    wedgeTitle: 'Between-session data: where encryption matters most',
    wedgeP1:
      'Most therapy software focuses on the session record — the note, the transcript, the billing line. The between-session space is where data protection gaps usually appear: informal messages, homework check-ins, and crisis contacts that live in unencrypted consumer apps.',
    wedgeP2:
      'PR-TOP routes all between-session data through the same encrypted application layer as the session record. A client\'s Telegram diary entry, a completed exercise, a one-tap SOS alert — each is encrypted as Class A data before it reaches the database. The therapist sees a unified, encrypted timeline. There are no unencrypted side-channels.',
    wedgeLead: 'See also: ',
    wedgeLinkEncryption: 'encryption architecture',
    wedgeAnd: ' and ',
    wedgeLinkNotes: 'AI session notes for therapists',
    wedgeTail: '.',

    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'Is PR-TOP HIPAA compliant?',
        a: 'No. PR-TOP has not been independently audited for HIPAA compliance and does not offer a Business Associate Agreement (BAA). It applies strong technical controls — AES application-layer encryption, immutable audit logging, role-based access control, TLS 1.2+ — that parallel many HIPAA safeguards, but it is EU-hosted and designed primarily for GDPR compliance. US therapists who are covered entities and need a HIPAA-compliant platform with a BAA should use a US-based EHR system.',
      },
      {
        q: 'Does PR-TOP offer a Business Associate Agreement?',
        a: 'No. PR-TOP does not offer a BAA. A BAA is a contractual requirement for US covered entities under HIPAA. PR-TOP is an EU-hosted platform governed by GDPR. For practices that need a data processing contract, PR-TOP provides a GDPR Data Processing Addendum (DPA) by default — included in the Terms of Service, not gated behind an enterprise tier.',
      },
      {
        q: 'What encryption does PR-TOP use?',
        a: 'PR-TOP applies AES encryption at the application layer for all Class A data: diary entries, session transcripts, AI summaries, and private therapist notes. Encryption happens before data reaches the database, so the database stores ciphertext, not plaintext. Class B data (timestamps, metadata, IDs) is access-controlled plaintext. All data transmission uses TLS 1.2+.',
      },
      {
        q: 'Is PR-TOP safe for EU therapists under GDPR?',
        a: 'Yes. PR-TOP is designed and hosted in the EU (Hetzner infrastructure). It processes all client data under a GDPR-compliant framework: lawful basis, data minimisation, data subject rights, and a Data Processing Addendum available by default. There are no third-party analytics trackers — analytics run on self-hosted Umami. You can export or delete a complete client record in one action.',
      },
      {
        q: 'Can US therapists use PR-TOP?',
        a: 'US therapists who are not covered entities under HIPAA (e.g., coaches, certain counsellors, therapists who do not bill insurance) can use PR-TOP and benefit from its strong encryption and GDPR-aligned controls. US therapists who are covered entities and must sign a BAA with their software vendors cannot use PR-TOP for PHI, as PR-TOP does not offer a BAA. Consult your own legal counsel if you are unsure of your HIPAA status.',
      },
      {
        q: 'What data does PR-TOP encrypt?',
        a: 'All Class A data is encrypted with AES at the application layer before storage: client diary entries (text, voice, video), session audio and video files, Whisper transcripts, AI-generated summaries, and private therapist notes. Class B data — timestamps, metadata, identifiers — is access-controlled plaintext. A server breach does not expose the content of client records.',
      },
    ],

    ctaTitle: 'GDPR-first, EU-hosted — try PR-TOP free',
    ctaText:
      'The free Trial tier includes the encrypted dashboard, Telegram client bot, diary, exercises, and SOS for a limited number of clients. No credit card required. GDPR Data Processing Addendum included by default.',
    ctaButton: 'Start free trial',
    ctaLinkEncryption: 'Encryption architecture',
    ctaLinkNotes: 'AI session notes for therapists',
    footer: 'PR-TOP. All rights reserved.',
  },

  ru: {
    seoTitle: 'HIPAA и GDPR для ПО психолога — позиция PR-TOP по безопасности',
    seoDescription:
      'HIPAA и GDPR для ПО для психологов: PR-TOP сопоставляет шифрование AES, журнал аудита и контроль согласия с требованиями. EU-хостинг, GDPR-first.',
    articleHeadline: 'HIPAA и GDPR для программного обеспечения терапевтов — что предлагает PR-TOP',
    articleDescription:
      'Честное руководство по HIPAA и GDPR для ПО психолога: как PR-TOP сопоставляет шифрование AES, журнал аудита и контроль согласия с требованиями HIPAA, и почему GDPR-first хостинг — правильный выбор для практик ЕС/СНГ/LATAM.',
    badge: 'Безопасность и соответствие',
    h1: 'HIPAA и GDPR для программного обеспечения терапевтов — что предлагает PR-TOP',
    stamp: 'Обновлено: июль 2026 · Проверено командой PR-TOP',
    backHome: 'На главную',

    intro:
      'PR-TOP размещён в ЕС и разработан с приоритетом GDPR. Он применяет шифрование AES на уровне приложения, неизменяемый журнал аудита, управление доступом на основе ролей и контроль согласия ко всем данным клиентов. Сертификация HIPAA отсутствует, BAA не предлагается. Практикам из ЕС, Украины, России и LATAM следует использовать включённое по умолчанию Дополнение об обработке данных GDPR.',

    whatHipaaTitle: 'Что на самом деле требует HIPAA',
    whatHipaaP1:
      'HIPAA (Закон о переносимости и подотчётности медицинского страхования США) распространяется на «покрытые организации» в США — поставщиков медицинских услуг, планы медицинского страхования и расчётные палаты здравоохранения — а также на их «деловых партнёров». Он устанавливает административные, физические и технические меры защиты защищённой медицинской информации (PHI). Если вы лицензированный терапевт в США, обрабатывающий PHI, ваши поставщики программного обеспечения должны быть готовы подписать Соглашение о деловом партнёрстве (BAA).',
    whatHipaaP2:
      'Большинство нероссийских терапевтов сталкиваются с HIPAA как с вопросом, а не как с правовым обязательством. Международные специалисты — из ЕС, Украины, России, Латинской Америки — не являются покрытыми организациями HIPAA. На них распространяется местное законодательство о защите данных: GDPR в ЕС, Закон о персональных данных на Украине и в России, национальные законы о конфиденциальности в странах LATAM. Для этих практик правильной планкой является соответствие GDPR, а не HIPAA.',
    whatHipaaP3:
      'PR-TOP создан для международного рынка. Он соответствует требованиям GDPR и применяет строгие технические меры контроля, которые параллельны многим требованиям HIPAA — но он не прошёл независимый аудит на соответствие HIPAA и не предлагает BAA, который требуется американским покрытым организациям. На этой странице объясняется, где именно средства контроля PR-TOP соответствуют требованиям HIPAA, а где есть пробелы.',
    whatHipaaWedge:
      'PR-TOP работает между сессиями — не только в момент написания заметок. Клиенты ведут голосовой, текстовый или видео-дневник через Telegram между приёмами. Психологи назначают упражнения, а клиенты могут отправить одним нажатием SOS-сигнал прямо на почту психолога. Все эти данные проходят через тот же уровень шифрования AES, что и транскрипт сессии, поэтому записи между сессиями защищены теми же средствами контроля.',

    tableTitle: 'Требования HIPAA в сопоставлении со средствами контроля PR-TOP',
    tableHead: {
      safeguard: 'Требование HIPAA',
      requirement: 'Что требует HIPAA',
      control: 'Средство контроля PR-TOP',
      gap: 'Пробел / Примечания',
    },
    tableRows: [
      {
        safeguard: 'Контроль доступа',
        requirement: 'Уникальные идентификаторы пользователей, процедуры экстренного доступа, автоматический выход',
        control: 'JWT-аутентификация с HttpOnly-cookies, управление доступом на основе ролей (психолог / клиент / администратор), токены сессий с истечением срока',
        gap: 'BAA не предлагается; независимый аудит HIPAA не проводился; таймер автоматического выхода не настроен по умолчанию',
      },
      {
        safeguard: 'Аудит-контроль',
        requirement: 'Запись и анализ активности в системах, содержащих ePHI',
        control: 'Неизменяемый журнал аудита для всего доступа к данным класса A (дневник, транскрипты, заметки, резюме)',
        gap: 'Журнал аудита разработан для соответствия этому требованию; формальная сертификация отсутствует',
      },
      {
        safeguard: 'Шифрование при хранении',
        requirement: 'Адресуемый стандарт — шифровать ePHI при хранении там, где это разумно и уместно',
        control: 'Шифрование AES на уровне приложения для всех данных класса A перед хранением; база данных хранит шифротекст, а не открытый текст',
        gap: 'Соответствует адресуемому стандарту; шифрование на уровне приложения, а не полного диска',
      },
      {
        safeguard: 'Целостность',
        requirement: 'Защита ePHI от ненадлежащего изменения или уничтожения',
        control: 'Неизменяемый журнал аудита; отсутствие редактирования данных класса A на месте; удаления регистрируются',
        gap: 'Соответствует намерению; формальный аудит по требованиям целостности HIPAA не проводился',
      },
      {
        safeguard: 'Безопасность передачи',
        requirement: 'Защита ePHI при передаче по электронным сетям',
        control: 'TLS 1.2+ для всех соединений, только HTTPS, без передачи данных в открытом тексте',
        gap: 'Стандартная реализация; требование выполнено',
      },
      {
        safeguard: 'Соглашение о деловом партнёрстве',
        requirement: 'Требуется для покрытых организаций, использующих услуги делового партнёра',
        control: 'НЕ ПРЕДЛАГАЕТСЯ — PR-TOP не является деловым партнёром HIPAA',
        gap: 'Международным практикам следует использовать Дополнение об обработке данных GDPR',
      },
    ],
    tableNote:
      'Эта таблица сопоставляет существующие средства контроля PR-TOP с категориями требований HIPAA только в информационных целях. Она не является юридической консультацией и не представляет собой сертификацию HIPAA. Покрытые организации США должны проконсультироваться с юрисконсультом перед использованием PR-TOP для PHI.',

    gdprTitle: 'Почему GDPR-first может быть правильным выбором для вашей практики',
    gdprP1:
      'GDPR (Общий регламент ЕС о защите данных) устанавливает высокую планку для обработки данных: правовое основание, минимизация данных, ограничение цели, права субъектов данных (доступ, исправление, удаление, переносимость), обязательное уведомление об утечках и — для обработчиков — Дополнение об обработке данных (DPA). PR-TOP соответствует всем этим требованиям по умолчанию.',
    gdprP2:
      'Для психологов с лицензией ЕС GDPR является обязательной правовой базой. Для украинских психологов применяется Закон о персональных данных, который тесно согласован с принципами GDPR. Для LATAM-психологов национальные рамки (LGPD в Бразилии, Ley 1581 в Колумбии и т. д.) либо смоделированы на основе GDPR, либо совместимы с ним. В каждом случае правильной системой соответствия является местное законодательство, а не HIPAA.',
    gdprP3:
      'PR-TOP обрабатывает все данные на инфраструктуре ЕС (центры обработки данных Hetzner). Для данных клиентов нет американских суб-обработчиков. Дополнение об обработке данных доступно по умолчанию — не по запросу, не за корпоративным уровнем. Клиенты могут реализовать права субъектов данных GDPR (доступ, исправление, удаление) непосредственно через панель психолога. Вы можете экспортировать или удалить полную запись клиента одним действием.',
    gdprLead: 'Подробнее: ',
    gdprLinkGdpr: 'соответствие GDPR',
    gdprAnd: ', ',
    gdprLinkSovereignty: 'суверенитет данных',
    gdprAnd2: ' и ',
    gdprLinkAudit: 'архитектура журнала аудита',
    gdprTail: '.',

    wedgeTitle: 'Данные между сессиями: где шифрование важнее всего',
    wedgeP1:
      'Большинство программ для терапевтов сосредоточено на записях сессий — заметке, транскрипте, строке биллинга. Пространство между сессиями — это то место, где обычно возникают пробелы в защите данных: неформальные сообщения, проверки домашних заданий и кризисные контакты, которые хранятся в незашифрованных потребительских приложениях.',
    wedgeP2:
      'PR-TOP направляет все данные между сессиями через тот же зашифрованный уровень приложения, что и запись сессии. Запись в дневнике клиента в Telegram, выполненное упражнение, SOS-сигнал одним нажатием — каждый из них шифруется как данные класса A до попадания в базу данных. Психолог видит единую зашифрованную временную шкалу. Незашифрованных боковых каналов нет.',
    wedgeLead: 'Смотрите также: ',
    wedgeLinkEncryption: 'архитектура шифрования',
    wedgeAnd: ' и ',
    wedgeLinkNotes: 'AI-заметки к сессиям для психологов',
    wedgeTail: '.',

    faqTitle: 'Частые вопросы',
    faqItems: [
      {
        q: 'PR-TOP соответствует требованиям HIPAA?',
        a: 'Нет. PR-TOP не прошёл независимый аудит на соответствие HIPAA и не предлагает Соглашение о деловом партнёрстве (BAA). Он применяет строгие технические средства контроля — шифрование AES на уровне приложения, неизменяемый журнал аудита, управление доступом на основе ролей, TLS 1.2+ — которые параллельны многим требованиям HIPAA, но размещён в ЕС и разработан в первую очередь для соответствия GDPR. Психологи из США, являющиеся покрытыми организациями и нуждающиеся в HIPAA-совместимой платформе с BAA, должны использовать американскую EHR-систему.',
      },
      {
        q: 'PR-TOP предлагает Соглашение о деловом партнёрстве?',
        a: 'Нет. PR-TOP не предлагает BAA. BAA является договорным требованием для покрытых организаций США по HIPAA. PR-TOP — это платформа, размещённая в ЕС и регулируемая GDPR. Для практик, которым нужен договор об обработке данных, PR-TOP по умолчанию предоставляет Дополнение об обработке данных GDPR (DPA) — включено в Условия обслуживания, не за корпоративным уровнем.',
      },
      {
        q: 'Какое шифрование использует PR-TOP?',
        a: 'PR-TOP применяет шифрование AES на уровне приложения для всех данных класса A: записей дневника, транскриптов сессий, AI-резюме и приватных заметок психолога. Шифрование происходит до попадания данных в базу данных, поэтому база данных хранит шифротекст, а не открытый текст. Данные класса B (временные метки, метаданные, идентификаторы) — это открытый текст с контролем доступа. Вся передача данных использует TLS 1.2+.',
      },
      {
        q: 'PR-TOP безопасен для психологов из ЕС в соответствии с GDPR?',
        a: 'Да. PR-TOP разработан и размещён в ЕС (инфраструктура Hetzner). Он обрабатывает все данные клиентов в соответствии с GDPR: правовое основание, минимизация данных, права субъектов данных и Дополнение об обработке данных, доступное по умолчанию. Сторонних аналитических трекеров нет — аналитика работает на self-hosted Umami. Вы можете экспортировать или удалить полную запись клиента одним действием.',
      },
      {
        q: 'Могут ли психологи из США использовать PR-TOP?',
        a: 'Психологи из США, не являющиеся покрытыми организациями HIPAA (например, коучи, некоторые консультанты, психологи, не выставляющие счета страховым компаниям), могут использовать PR-TOP и воспользоваться его надёжным шифрованием и средствами контроля, соответствующими GDPR. Психологи из США, являющиеся покрытыми организациями и обязанные подписывать BAA с поставщиками программного обеспечения, не могут использовать PR-TOP для PHI, поскольку PR-TOP не предлагает BAA. Проконсультируйтесь с юрисконсультом, если вы не уверены в своём статусе по HIPAA.',
      },
      {
        q: 'Какие данные PR-TOP шифрует?',
        a: 'Все данные класса A шифруются с помощью AES на уровне приложения перед хранением: записи дневника клиента (текст, голос, видео), аудио- и видеофайлы сессий, транскрипты Whisper, AI-резюме и приватные заметки психолога. Данные класса B — временные метки, метаданные, идентификаторы — представляют собой открытый текст с контролем доступа. Взлом сервера не раскроет содержимое записей клиентов.',
      },
    ],

    ctaTitle: 'GDPR-first, EU-hosted — попробуйте PR-TOP бесплатно',
    ctaText:
      'Бесплатный тариф Trial включает зашифрованный кабинет, Telegram-бот для клиентов, дневник, упражнения и SOS для ограниченного числа клиентов. Карта не нужна. DPA GDPR включён по умолчанию.',
    ctaButton: 'Начать бесплатно',
    ctaLinkEncryption: 'Архитектура шифрования',
    ctaLinkNotes: 'AI-заметки к сессиям',
    footer: 'PR-TOP. Все права защищены.',
  },

  uk: {
    seoTitle: 'HIPAA і GDPR для ПЗ психолога — позиція PR-TOP щодо безпеки',
    seoDescription:
      'HIPAA і GDPR для ПЗ для психологів: PR-TOP зіставляє шифрування AES, журнал аудиту та контроль згоди з вимогами. EU-хостинг, GDPR-first. Спробуйте.',
    articleHeadline: 'HIPAA і GDPR для програмного забезпечення терапевтів — що пропонує PR-TOP',
    articleDescription:
      'Чесний посібник з HIPAA і GDPR для ПЗ психолога: як PR-TOP зіставляє шифрування AES, журнал аудиту та контроль згоди з вимогами HIPAA, і чому GDPR-first хостинг — правильний вибір для практик ЄС/СНД/LATAM.',
    badge: 'Безпека та відповідність',
    h1: 'HIPAA і GDPR для програмного забезпечення терапевтів — що пропонує PR-TOP',
    stamp: 'Оновлено: липень 2026 · Перевірено командою PR-TOP',
    backHome: 'На головну',

    intro:
      'PR-TOP розміщено в ЄС і розроблено з пріоритетом GDPR. Він застосовує шифрування AES на рівні застосунку, незмінний журнал аудиту, управління доступом на основі ролей і контроль згоди до всіх даних клієнтів. Сертифікація HIPAA відсутня, BAA не пропонується. Практикам з ЄС, України, Росії та LATAM слід використовувати включене за замовчуванням Доповнення з обробки даних GDPR.',

    whatHipaaTitle: 'Що насправді вимагає HIPAA',
    whatHipaaP1:
      'HIPAA (Закон США про переносимість та підзвітність медичного страхування) поширюється на «покриті організації» в США — постачальників медичних послуг, плани медичного страхування та розрахункові палати охорони здоров\'я — а також на їхніх «ділових партнерів». Він встановлює адміністративні, фізичні та технічні заходи захисту захищеної медичної інформації (PHI). Якщо ви ліцензований терапевт у США, який обробляє PHI, ваші постачальники програмного забезпечення повинні бути готові підписати Угоду про ділове партнерство (BAA).',
    whatHipaaP2:
      'Більшість нескаутських терапевтів стикаються з HIPAA як із запитанням, а не як із правовим зобов\'язанням. Міжнародні фахівці — з ЄС, України, Росії, Латинської Америки — не є покритими організаціями HIPAA. На них поширюється місцеве законодавство про захист даних: GDPR в ЄС, Закон про персональні дані в Україні та Росії, національні закони про конфіденційність у країнах LATAM. Для цих практик правильною планкою є відповідність GDPR, а не HIPAA.',
    whatHipaaP3:
      'PR-TOP створено для міжнародного ринку. Він відповідає вимогам GDPR і застосовує суворі технічні засоби контролю, які паралельні багатьом вимогам HIPAA — але він не пройшов незалежний аудит на відповідність HIPAA і не пропонує BAA, який вимагається американським покритим організаціям. На цій сторінці пояснюється, де саме засоби контролю PR-TOP відповідають вимогам HIPAA, а де є прогалини.',
    whatHipaaWedge:
      'PR-TOP працює між сесіями — не лише в момент написання нотаток. Клієнти ведуть голосовий, текстовий або відео-щоденник через Telegram між прийомами. Психологи призначають вправи, а клієнти можуть надіслати одним дотиком SOS-сигнал прямо на пошту психолога. Всі ці дані проходять через той самий рівень шифрування AES, що й транскрипт сесії, тому записи між сесіями захищені тими ж засобами контролю.',

    tableTitle: 'Вимоги HIPAA у зіставленні із засобами контролю PR-TOP',
    tableHead: {
      safeguard: 'Вимога HIPAA',
      requirement: 'Що вимагає HIPAA',
      control: 'Засіб контролю PR-TOP',
      gap: 'Прогалина / Примітки',
    },
    tableRows: [
      {
        safeguard: 'Контроль доступу',
        requirement: 'Унікальні ідентифікатори користувачів, процедури екстреного доступу, автоматичний вихід',
        control: 'JWT-автентифікація з HttpOnly-cookies, управління доступом на основі ролей (психолог / клієнт / адміністратор), токени сесій з терміном дії',
        gap: 'BAA не пропонується; незалежний аудит HIPAA не проводився; таймер автоматичного виходу не налаштовано за замовчуванням',
      },
      {
        safeguard: 'Аудит-контроль',
        requirement: 'Запис і аналіз активності в системах, що містять ePHI',
        control: 'Незмінний журнал аудиту для всього доступу до даних класу A (щоденник, транскрипти, нотатки, резюме)',
        gap: 'Журнал аудиту розроблено для відповідності цій вимозі; формальна сертифікація відсутня',
      },
      {
        safeguard: 'Шифрування при зберіганні',
        requirement: 'Адресований стандарт — шифрувати ePHI при зберіганні там, де це розумно і доречно',
        control: 'Шифрування AES на рівні застосунку для всіх даних класу A перед зберіганням; база даних зберігає шифротекст, а не відкритий текст',
        gap: 'Відповідає адресованому стандарту; шифрування на рівні застосунку, а не повного диска',
      },
      {
        safeguard: 'Цілісність',
        requirement: 'Захист ePHI від неналежної зміни або знищення',
        control: 'Незмінний журнал аудиту; відсутність редагування даних класу A на місці; видалення реєструються',
        gap: 'Відповідає наміру; формальний аудит за вимогами цілісності HIPAA не проводився',
      },
      {
        safeguard: 'Безпека передачі',
        requirement: 'Захист ePHI при передачі по електронних мережах',
        control: 'TLS 1.2+ для всіх з\'єднань, лише HTTPS, без передачі даних у відкритому тексті',
        gap: 'Стандартна реалізація; вимога виконана',
      },
      {
        safeguard: 'Угода про ділове партнерство',
        requirement: 'Вимагається для покритих організацій, що використовують послуги ділового партнера',
        control: 'НЕ ПРОПОНУЄТЬСЯ — PR-TOP не є діловим партнером HIPAA',
        gap: 'Міжнародним практикам слід використовувати Доповнення з обробки даних GDPR',
      },
    ],
    tableNote:
      'Ця таблиця зіставляє наявні засоби контролю PR-TOP із категоріями вимог HIPAA лише з інформаційною метою. Вона не є юридичною консультацією і не є сертифікацією HIPAA. Покриті організації США повинні проконсультуватися з юрисконсультом перед використанням PR-TOP для PHI.',

    gdprTitle: 'Чому GDPR-first може бути правильним вибором для вашої практики',
    gdprP1:
      'GDPR (Загальний регламент ЄС про захист даних) встановлює високу планку для обробки даних: правова підстава, мінімізація даних, обмеження мети, права суб\'єктів даних (доступ, виправлення, видалення, переносимість), обов\'язкове повідомлення про витоки і — для обробників — Доповнення з обробки даних (DPA). PR-TOP відповідає всім цим вимогам за замовчуванням.',
    gdprP2:
      'Для психологів із ліцензією ЄС GDPR є обов\'язковою правовою базою. Для українських психологів застосовується Закон про персональні дані, який тісно узгоджений з принципами GDPR. Для LATAM-психологів національні рамки (LGPD у Бразилії, Ley 1581 у Колумбії тощо) або змодельовані на основі GDPR, або сумісні з ним. У кожному випадку правильною системою відповідності є місцеве законодавство, а не HIPAA.',
    gdprP3:
      'PR-TOP обробляє всі дані на інфраструктурі ЄС (центри обробки даних Hetzner). Для даних клієнтів немає американських суб-обробників. Доповнення з обробки даних доступне за замовчуванням — не за запитом, не за корпоративним рівнем. Клієнти можуть реалізувати права суб\'єктів даних GDPR (доступ, виправлення, видалення) безпосередньо через панель психолога. Ви можете експортувати або видалити повний запис клієнта однією дією.',
    gdprLead: 'Докладніше: ',
    gdprLinkGdpr: 'відповідність GDPR',
    gdprAnd: ', ',
    gdprLinkSovereignty: 'суверенітет даних',
    gdprAnd2: ' та ',
    gdprLinkAudit: 'архітектура журналу аудиту',
    gdprTail: '.',

    wedgeTitle: 'Дані між сесіями: де шифрування важливіше всього',
    wedgeP1:
      'Більшість програм для терапевтів зосереджена на записах сесій — нотатці, транскрипті, рядку білінгу. Простір між сесіями — це те місце, де зазвичай виникають прогалини в захисті даних: неформальні повідомлення, перевірки домашніх завдань і кризові контакти, які зберігаються в незашифрованих споживчих застосунках.',
    wedgeP2:
      'PR-TOP направляє всі дані між сесіями через той самий зашифрований рівень застосунку, що й запис сесії. Запис у щоденнику клієнта в Telegram, виконана вправа, SOS-сигнал одним дотиком — кожен з них шифрується як дані класу A до потрапляння до бази даних. Психолог бачить єдину зашифровану часову шкалу. Незашифрованих бокових каналів немає.',
    wedgeLead: 'Дивіться також: ',
    wedgeLinkEncryption: 'архітектура шифрування',
    wedgeAnd: ' та ',
    wedgeLinkNotes: 'AI-нотатки до сесій для психологів',
    wedgeTail: '.',

    faqTitle: 'Поширені запитання',
    faqItems: [
      {
        q: 'PR-TOP відповідає вимогам HIPAA?',
        a: 'Ні. PR-TOP не пройшов незалежний аудит на відповідність HIPAA і не пропонує Угоду про ділове партнерство (BAA). Він застосовує суворі технічні засоби контролю — шифрування AES на рівні застосунку, незмінний журнал аудиту, управління доступом на основі ролей, TLS 1.2+ — які паралельні багатьом вимогам HIPAA, але розміщений в ЄС і розроблений насамперед для відповідності GDPR. Психологи зі США, які є покритими організаціями і потребують HIPAA-сумісної платформи з BAA, повинні використовувати американську EHR-систему.',
      },
      {
        q: 'PR-TOP пропонує Угоду про ділове партнерство?',
        a: 'Ні. PR-TOP не пропонує BAA. BAA є договірною вимогою для покритих організацій США за HIPAA. PR-TOP — це платформа, розміщена в ЄС і регульована GDPR. Для практик, яким потрібен договір з обробки даних, PR-TOP за замовчуванням надає Доповнення з обробки даних GDPR (DPA) — включено до Умов надання послуг, не за корпоративним рівнем.',
      },
      {
        q: 'Яке шифрування використовує PR-TOP?',
        a: 'PR-TOP застосовує шифрування AES на рівні застосунку для всіх даних класу A: записів щоденника, транскриптів сесій, AI-резюме та приватних нотаток психолога. Шифрування відбувається до потрапляння даних до бази даних, тому база даних зберігає шифротекст, а не відкритий текст. Дані класу B (часові мітки, метадані, ідентифікатори) — це відкритий текст з контролем доступу. Вся передача даних використовує TLS 1.2+.',
      },
      {
        q: 'PR-TOP безпечний для психологів з ЄС відповідно до GDPR?',
        a: 'Так. PR-TOP розроблено і розміщено в ЄС (інфраструктура Hetzner). Він обробляє всі дані клієнтів відповідно до GDPR: правова підстава, мінімізація даних, права суб\'єктів даних і Доповнення з обробки даних, доступне за замовчуванням. Сторонніх аналітичних трекерів немає — аналітика працює на self-hosted Umami. Ви можете експортувати або видалити повний запис клієнта однією дією.',
      },
      {
        q: 'Чи можуть психологи зі США використовувати PR-TOP?',
        a: 'Психологи зі США, які не є покритими організаціями HIPAA (наприклад, коучі, деякі консультанти, психологи, які не виставляють рахунки страховим компаніям), можуть використовувати PR-TOP і скористатися його надійним шифруванням і засобами контролю, що відповідають GDPR. Психологи зі США, які є покритими організаціями і зобов\'язані підписувати BAA з постачальниками програмного забезпечення, не можуть використовувати PR-TOP для PHI, оскільки PR-TOP не пропонує BAA. Проконсультуйтеся з юрисконсультом, якщо ви не впевнені у своєму статусі за HIPAA.',
      },
      {
        q: 'Які дані PR-TOP шифрує?',
        a: 'Всі дані класу A шифруються за допомогою AES на рівні застосунку перед зберіганням: записи щоденника клієнта (текст, голос, відео), аудіо- та відеофайли сесій, транскрипти Whisper, AI-резюме та приватні нотатки психолога. Дані класу B — часові мітки, метадані, ідентифікатори — це відкритий текст з контролем доступу. Злом сервера не розкриє вміст записів клієнтів.',
      },
    ],

    ctaTitle: 'GDPR-first, EU-hosted — спробуйте PR-TOP безкоштовно',
    ctaText:
      'Безкоштовний тариф Trial включає зашифрований кабінет, Telegram-бот для клієнтів, щоденник, вправи та SOS для обмеженої кількості клієнтів. Картка не потрібна. DPA GDPR включено за замовчуванням.',
    ctaButton: 'Почати безкоштовно',
    ctaLinkEncryption: 'Архітектура шифрування',
    ctaLinkNotes: 'AI-нотатки до сесій',
    footer: 'PR-TOP. Усі права захищено.',
  },

  es: {
    seoTitle: 'HIPAA y GDPR para software de terapia — postura de seguridad de PR-TOP',
    seoDescription:
      'HIPAA y GDPR para software de terapia: PR-TOP alinea su cifrado AES, registro de auditoría y controles de consentimiento con HIPAA. Alojado en UE.',
    articleHeadline: 'HIPAA y GDPR para software de terapia — lo que ofrece PR-TOP',
    articleDescription:
      'Guía honesta sobre HIPAA y GDPR para software de terapia: cómo PR-TOP alinea su cifrado AES, registro de auditoría y controles de consentimiento con las expectativas de HIPAA, y por qué el alojamiento GDPR-first es la elección correcta para prácticas de UE/CEI/LATAM.',
    badge: 'Seguridad y cumplimiento',
    h1: 'HIPAA y GDPR para software de terapia — lo que ofrece PR-TOP',
    stamp: 'Actualizado: julio de 2026 · Revisado por el equipo PR-TOP',
    backHome: 'Volver al inicio',

    intro:
      'PR-TOP está alojado en la UE y es nativo de GDPR. Aplica cifrado AES en la capa de aplicación, un registro de auditoría inmutable, control de acceso basado en roles y aplicación del consentimiento a todos los datos del cliente. No tiene certificación HIPAA y no ofrece un Acuerdo de Socio Comercial. Las prácticas de la UE, Ucrania, Rusia y LATAM deben usar el Addendum de Procesamiento de Datos GDPR incluido por defecto.',

    whatHipaaTitle: 'Qué requiere HIPAA realmente',
    whatHipaaP1:
      'HIPAA (la Ley de Portabilidad y Responsabilidad de Seguros de Salud de EE. UU.) se aplica a las "entidades cubiertas" en EE. UU. — proveedores de atención médica, planes de salud y cámaras de compensación de atención médica — y sus "socios comerciales". Establece salvaguardas administrativas, físicas y técnicas para la Información de Salud Protegida (PHI). Si usted es un terapeuta con licencia en EE. UU. que procesa PHI, sus proveedores de software deben estar dispuestos a firmar un Acuerdo de Socio Comercial (BAA).',
    whatHipaaP2:
      'La mayoría de los terapeutas fuera de EE. UU. se encuentran con HIPAA como una pregunta, no como una obligación legal. Los profesionales internacionales — de la UE, Ucrania, Rusia, América Latina — no son entidades cubiertas por HIPAA. Están sujetos a su ley de protección de datos local: GDPR en la UE, la Ley de Datos Personales en Ucrania y Rusia, y leyes de privacidad nacionales en países de LATAM. Para estas prácticas, el cumplimiento del GDPR es el estándar correcto, no HIPAA.',
    whatHipaaP3:
      'PR-TOP está creado para este mercado internacional. Cumple los requisitos del GDPR y aplica controles técnicos sólidos que son paralelos a muchas salvaguardas de HIPAA — pero no ha sido auditado de forma independiente para HIPAA y no ofrece el BAA que requieren las entidades cubiertas de EE. UU. Esta página explica exactamente dónde los controles de PR-TOP se corresponden con las expectativas de HIPAA y dónde están las brechas.',
    whatHipaaWedge:
      'PR-TOP está presente entre sesiones — no solo en el momento de escribir notas. Los clientes llevan un diario de voz, texto o vídeo a través de Telegram entre las citas. Los terapeutas asignan ejercicios y los clientes pueden enviar alertas de crisis con un toque directamente a la bandeja del terapeuta. Todos estos datos fluyen a través de la misma capa de cifrado AES que la transcripción de la sesión, por lo que el registro entre sesiones está protegido por los mismos controles.',

    tableTitle: 'Salvaguardas de HIPAA mapeadas a los controles de PR-TOP',
    tableHead: {
      safeguard: 'Salvaguarda HIPAA',
      requirement: 'Qué requiere HIPAA',
      control: 'Control de PR-TOP',
      gap: 'Brecha / Notas',
    },
    tableRows: [
      {
        safeguard: 'Control de Acceso',
        requirement: 'IDs de usuario únicos, procedimientos de acceso de emergencia, cierre de sesión automático',
        control: 'Autenticación JWT con cookies HttpOnly, control de acceso basado en roles (terapeuta / cliente / admin), tokens de sesión con vencimiento',
        gap: 'No se ofrece BAA; no auditado de forma independiente para HIPAA; no hay temporizador de cierre automático configurado por defecto',
      },
      {
        safeguard: 'Controles de Auditoría',
        requirement: 'Registrar y examinar la actividad en sistemas que contienen ePHI',
        control: 'Registro de auditoría inmutable y de solo adición para todo acceso a datos de clase A (diario, transcripciones, notas, resúmenes)',
        gap: 'El registro de auditoría está diseñado para cumplir esta expectativa; no certificado formalmente',
      },
      {
        safeguard: 'Cifrado en Reposo',
        requirement: 'Direccionable — cifrar ePHI en almacenamiento donde sea razonable y apropiado',
        control: 'Cifrado AES en la capa de aplicación para todos los datos de clase A antes del almacenamiento; la base de datos guarda texto cifrado, no texto claro',
        gap: 'Cumple el estándar direccionable; el cifrado está en la capa de aplicación, no en disco completo',
      },
      {
        safeguard: 'Integridad',
        requirement: 'Proteger ePHI de alteración o destrucción inadecuada',
        control: 'Registro de auditoría inmutable; sin edición en el lugar de datos de clase A; las eliminaciones se registran',
        gap: 'Cumple la intención; no auditado formalmente contra los requisitos de integridad de HIPAA',
      },
      {
        safeguard: 'Seguridad en la Transmisión',
        requirement: 'Proteger ePHI transmitida a través de redes electrónicas',
        control: 'TLS 1.2+ en todas las conexiones, solo HTTPS, sin transferencia de datos en texto claro',
        gap: 'Implementación estándar; cumple el requisito',
      },
      {
        safeguard: 'Acuerdo de Socio Comercial',
        requirement: 'Requerido para entidades cubiertas que usan el servicio de un socio comercial',
        control: 'NO SE OFRECE — PR-TOP no es un Socio Comercial de HIPAA',
        gap: 'Las prácticas internacionales deben usar el Addendum de Procesamiento de Datos GDPR en su lugar',
      },
    ],
    tableNote:
      'Esta tabla mapea los controles existentes de PR-TOP a las categorías de salvaguardas de HIPAA solo con fines informativos. No constituye asesoramiento legal y no representa la certificación HIPAA. Las entidades cubiertas de EE. UU. deben consultar a un abogado antes de usar PR-TOP para PHI.',

    gdprTitle: 'Por qué GDPR-first puede ser la elección correcta para su práctica',
    gdprP1:
      'El GDPR (Reglamento General de Protección de Datos de la UE) establece un alto estándar para el procesamiento de datos: base legal, minimización de datos, limitación de propósito, derechos de los interesados (acceso, rectificación, supresión, portabilidad), notificación obligatoria de brechas y — para los encargados — un Addendum de Procesamiento de Datos (DPA). PR-TOP cumple todos estos requisitos por diseño.',
    gdprP2:
      'Para los terapeutas con licencia de la UE, el GDPR es el marco legal vinculante. Para los terapeutas ucranianos, se aplica la Ley de Datos Personales, que está estrechamente alineada con los principios del GDPR. Para los terapeutas de LATAM, los marcos nacionales (LGPD en Brasil, Ley 1581 en Colombia, etc.) están modelados según el GDPR o son compatibles con él. En cada caso, el marco de cumplimiento correcto es la ley local, no HIPAA.',
    gdprP3:
      'PR-TOP procesa todos los datos en infraestructura de la UE (centros de datos de Hetzner). No hay sub-procesadores con base en EE. UU. para datos de clientes. Un Addendum de Procesamiento de Datos está disponible por defecto — no bajo petición, no detrás de un nivel empresarial. Los clientes pueden ejercer los derechos GDPR de los interesados (acceso, rectificación, supresión) directamente a través del panel del terapeuta. Puede exportar o borrar un registro completo del cliente en una sola acción.',
    gdprLead: 'Ver: ',
    gdprLinkGdpr: 'detalles de cumplimiento GDPR',
    gdprAnd: ', ',
    gdprLinkSovereignty: 'soberanía de datos',
    gdprAnd2: ' y ',
    gdprLinkAudit: 'arquitectura del registro de auditoría',
    gdprTail: '.',

    wedgeTitle: 'Datos entre sesiones: donde más importa el cifrado',
    wedgeP1:
      'La mayoría del software de terapia se centra en el registro de la sesión — la nota, la transcripción, la línea de facturación. El espacio entre sesiones es donde suelen aparecer las brechas de protección de datos: mensajes informales, seguimiento de tareas y contactos de crisis que viven en aplicaciones de consumo sin cifrar.',
    wedgeP2:
      'PR-TOP enruta todos los datos entre sesiones a través de la misma capa de aplicación cifrada que el registro de la sesión. Una entrada del diario de Telegram del cliente, un ejercicio completado, una alerta SOS con un toque — cada uno se cifra como datos de clase A antes de llegar a la base de datos. El terapeuta ve una línea de tiempo unificada y cifrada. No hay canales laterales sin cifrar.',
    wedgeLead: 'Consulte también: ',
    wedgeLinkEncryption: 'arquitectura de cifrado',
    wedgeAnd: ' y ',
    wedgeLinkNotes: 'notas de sesión con IA para terapeutas',
    wedgeTail: '.',

    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        q: '¿Es PR-TOP compatible con HIPAA?',
        a: 'No. PR-TOP no ha sido auditado de forma independiente para el cumplimiento de HIPAA y no ofrece un Acuerdo de Socio Comercial (BAA). Aplica controles técnicos sólidos — cifrado AES en la capa de aplicación, registro de auditoría inmutable, control de acceso basado en roles, TLS 1.2+ — que son paralelos a muchas salvaguardas de HIPAA, pero está alojado en la UE y diseñado principalmente para el cumplimiento del GDPR. Los terapeutas de EE. UU. que son entidades cubiertas y necesitan una plataforma compatible con HIPAA con un BAA deben usar un sistema EHR con base en EE. UU.',
      },
      {
        q: '¿PR-TOP ofrece un Acuerdo de Socio Comercial?',
        a: 'No. PR-TOP no ofrece un BAA. Un BAA es un requisito contractual para las entidades cubiertas de EE. UU. bajo HIPAA. PR-TOP es una plataforma alojada en la UE regida por el GDPR. Para las prácticas que necesitan un contrato de procesamiento de datos, PR-TOP proporciona un Addendum de Procesamiento de Datos GDPR (DPA) por defecto — incluido en los Términos de Servicio, no detrás de un nivel empresarial.',
      },
      {
        q: '¿Qué cifrado usa PR-TOP?',
        a: 'PR-TOP aplica cifrado AES en la capa de aplicación para todos los datos de clase A: entradas de diario, transcripciones de sesiones, resúmenes de IA y notas privadas del terapeuta. El cifrado ocurre antes de que los datos lleguen a la base de datos, por lo que la base de datos almacena texto cifrado, no texto claro. Los datos de clase B (marcas de tiempo, metadatos, identificadores) son texto claro con control de acceso. Toda la transmisión de datos utiliza TLS 1.2+.',
      },
      {
        q: '¿Es PR-TOP seguro para los terapeutas de la UE bajo el GDPR?',
        a: 'Sí. PR-TOP está diseñado y alojado en la UE (infraestructura de Hetzner). Procesa todos los datos del cliente bajo un marco compatible con el GDPR: base legal, minimización de datos, derechos de los interesados y un Addendum de Procesamiento de Datos disponible por defecto. No hay rastreadores de análisis de terceros — los análisis se ejecutan en Umami autoalojado. Puede exportar o eliminar un registro completo del cliente en una sola acción.',
      },
      {
        q: '¿Pueden usar PR-TOP los terapeutas de EE. UU.?',
        a: 'Los terapeutas de EE. UU. que no son entidades cubiertas bajo HIPAA (por ejemplo, coaches, ciertos consejeros, terapeutas que no facturan al seguro) pueden usar PR-TOP y beneficiarse de su sólido cifrado y controles alineados con el GDPR. Los terapeutas de EE. UU. que son entidades cubiertas y deben firmar un BAA con sus proveedores de software no pueden usar PR-TOP para PHI, ya que PR-TOP no ofrece un BAA. Consulte a su propio asesor legal si no está seguro de su estado bajo HIPAA.',
      },
      {
        q: '¿Qué datos cifra PR-TOP?',
        a: 'Todos los datos de clase A se cifran con AES en la capa de aplicación antes del almacenamiento: entradas del diario del cliente (texto, voz, vídeo), archivos de audio y vídeo de sesiones, transcripciones de Whisper, resúmenes generados por IA y notas privadas del terapeuta. Los datos de clase B — marcas de tiempo, metadatos, identificadores — son texto claro con control de acceso. Una brecha en el servidor no expone el contenido de los registros del cliente.',
      },
    ],

    ctaTitle: 'GDPR-first, alojado en la UE — pruebe PR-TOP gratis',
    ctaText:
      'El nivel Trial gratuito incluye el panel cifrado, el bot de Telegram para clientes, el diario, los ejercicios y el SOS para un número limitado de clientes. No se requiere tarjeta de crédito. Addendum de Procesamiento de Datos GDPR incluido por defecto.',
    ctaButton: 'Empezar gratis',
    ctaLinkEncryption: 'Arquitectura de cifrado',
    ctaLinkNotes: 'Notas de sesión con IA para terapeutas',
    footer: 'PR-TOP. Todos los derechos reservados.',
  },
};

export default function HipaaAndGdprForTherapySoftware() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const c = CONTENT[locale] || CONTENT.en;
  const lp = useLocalePath();
  const pageUrl = `https://pr-top.com${locale === 'en' ? '' : `/${locale}`}/hipaa-and-gdpr-for-therapy-software`;

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
        path="/hipaa-and-gdpr-for-therapy-software"
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

        {/* Rule 7 — PR-TOP wedge in first H2: HIPAA context + between-session framing. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.whatHipaaTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whatHipaaP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whatHipaaP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.whatHipaaP3}</p>
          <p className="text-gray-700 leading-relaxed">{c.whatHipaaWedge}</p>
        </section>

        {/* Rule 3 — HIPAA safeguard vs PR-TOP control table. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.tableTitle}
          </h2>
          {/* Pricing data: no competitor pricing on this page — internal controls table only */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.safeguard}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.requirement}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.control}</th>
                  <th className="p-3 border border-gray-200 font-semibold">{c.tableHead.gap}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {c.tableRows.map((row, i) => (
                  <tr key={row.safeguard} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    <td className="p-3 border border-gray-200 font-medium whitespace-nowrap">{row.safeguard}</td>
                    <td className="p-3 border border-gray-200">{row.requirement}</td>
                    <td className="p-3 border border-gray-200">{row.control}</td>
                    <td className="p-3 border border-gray-200">{row.gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">{c.tableNote}</p>
        </section>

        {/* Rule 7 — PR-TOP wedge in second H2: GDPR-first reasoning. */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.gdprTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.gdprP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.gdprP2}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.gdprP3}</p>
          {/* Rule 6 — internal links. */}
          <p className="text-gray-700 leading-relaxed">
            {c.gdprLead}
            <Link to={lp('/security/gdpr')} className="text-primary underline hover:no-underline">
              {c.gdprLinkGdpr}
            </Link>
            {c.gdprAnd}
            <Link to={lp('/security/data-sovereignty')} className="text-primary underline hover:no-underline">
              {c.gdprLinkSovereignty}
            </Link>
            {c.gdprAnd2}
            <Link to={lp('/security/audit-log')} className="text-primary underline hover:no-underline">
              {c.gdprLinkAudit}
            </Link>
            {c.gdprTail}
          </p>
        </section>

        {/* Between-session data section */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {c.wedgeTitle}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">{c.wedgeP1}</p>
          <p className="text-gray-700 leading-relaxed mb-3">{c.wedgeP2}</p>
          <p className="text-gray-700 leading-relaxed">
            {c.wedgeLead}
            <Link to={lp('/security/encryption')} className="text-primary underline hover:no-underline">
              {c.wedgeLinkEncryption}
            </Link>
            {c.wedgeAnd}
            <Link to={lp('/ai-session-notes-for-therapists')} className="text-primary underline hover:no-underline">
              {c.wedgeLinkNotes}
            </Link>
            {c.wedgeTail}
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
              to={lp('/security/encryption')}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              {c.ctaLinkEncryption}
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
