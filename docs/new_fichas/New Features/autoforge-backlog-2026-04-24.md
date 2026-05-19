# AutoForge Backlog — PR-TOP Customer Development Features

**Дата:** 2026-04-24
**Источник:** `docs/new_fichas/customer-development-meetings/`
**План фич:** `docs/new_fichas/New Features/cusdev-features-plan-2026-04-24.md`
**Ветка для работы:** `dev` (НЕ master, НЕ prod)

---

## 0. Выбор модели AutoForge

### Рекомендация

- **Opus 4.7** — для P1–P2 (архитектурные изменения, permissions, AI-pipeline)
- **Sonnet 4.6** — для P3–P4 (изолированные фичи, багфиксы, контент, i18n)

### Правило большого пальца

| Критерий | Модель |
|----------|--------|
| Меняет схему БД + миграции + шифрование | **Opus 4.7** |
| Меняет permission/consent-модель | **Opus 4.7** |
| Новый AI-pipeline (RAG, кастомные промпты) | **Opus 4.7** |
| Новый entity + связанный CRUD в backend/frontend/bot | **Opus 4.7** |
| Bug fix с понятным scope | **Sonnet 4.6** |
| Добавить поле/флаг | **Sonnet 4.6** |
| Контент + i18n в 4 языках | **Sonnet 4.6** |
| Toggle / preference setting | **Sonnet 4.6** |

### Карта «тикет → модель»

| Тикет | Модель | Оценка сложности |
|-------|--------|------------------|
| T-01 Inquiry entity | Opus 4.7 | L |
| T-02 Session calendar + date-based UI | Opus 4.7 | M |
| T-03 Assignments entity | Opus 4.7 | L |
| T-04 Free-form progress reports | Opus 4.7 | M |
| T-05 Final report + acceptance flow | Opus 4.7 | M |
| T-06 Solo mode (therapist-only) | Opus 4.7 | L |
| T-07 Upload audio via admin (bug) | Sonnet 4.6 | S |
| T-08 Custom summary prompts per modality | Opus 4.7 | M |
| T-09 Personal knowledge base (RAG) | Opus 4.7 | L |
| T-10 Dual-comment model refactor | Opus 4.7 | M |
| T-11 Therapist comment visibility toggle | Sonnet 4.6 | S |
| T-12 Client private comments | Sonnet 4.6 | S |
| T-13 "Example" label on library exercises | Sonnet 4.6 | S |
| T-14 Exercise library content cleanup | Sonnet 4.6 | M |
| T-15 Post-session therapist notes field | Sonnet 4.6 | S |
| T-16 Optional reminders (off by default) | Sonnet 4.6 | S |
| T-17 Supervision share mode | Sonnet 4.6 | M |
| T-18 Extended consent disclaimer | Sonnet 4.6 | S |
| T-19 Single-track (therapist-only) recording | Opus 4.7 | L |
| T-20 Auto-link audio by date metadata | Sonnet 4.6 | M |
| T-21 Photo attachments to reports | Sonnet 4.6 | S |
| T-22 Per-exercise-run comments | Sonnet 4.6 | S |
| T-23 Zoom SDK integration | Opus 4.7 | XL (research first) |
| T-24 Russia accessibility (mirror) | Opus 4.7 | L (infra research) |
| T-25 Client engagement analytics | Sonnet 4.6 | M |
| T-26 AI source disclaimers | Sonnet 4.6 | S |

Легенда: S = ≤ 1 день, M = 1–3 дня, L = 3–7 дней, XL = > 1 недели

---

## 1. Общие правила для AutoForge

### 1.1. Рабочая ветка и процесс
- Вся разработка — в ветке `dev`. Не трогать `master`, не пушить в prod.
- Каждый тикет — отдельный коммит (или серия коммитов) с префиксом `feat:` / `fix:` / `refactor:`.
- После каждого тикета — прогонять backend-тесты (если есть) и `npm run build` фронтенда.

### 1.2. i18n
- Любой user-facing текст должен быть добавлен в **4 языка**: `en`, `ru`, `es`, `uk`.
- Затронутые файлы: frontend `src/locales/*`, backend `i18n/*`, bot `bot/i18n/*`, `exercises/*`.
- При добавлении ключа — обновить ВСЕ 4 языка синхронно.

### 1.3. Шифрование
- Любые данные клиента (тексты, транскрипты, фото, голос) — **Class A**, AES-шифрование на application layer.
- Новые поля с контентом клиента — через существующие encryption helpers.
- Метаданные (timestamps, IDs, флаги) — **Class B**, plaintext.

### 1.4. Permissions
- Все новые API-роуты `/api/clients/*`, `/api/sessions/*`, `/api/notes/*` — проверяют consent и принадлежность терапевту.
- Audit log для всех доступов к данным клиента.

### 1.5. Миграции БД
- better-sqlite3 — миграции через существующий механизм.
- Backward-compatible: новые колонки с дефолтными значениями.
- Data migration скрипт для существующих клиентов (если нужен).

### 1.6. Тесты
- Каждая новая бизнес-логика — unit-тест.
- API-роуты — integration-тест с consent-enforcement.
- UI — smoke-test основного флоу в браузере (см. `webapp-testing` skill).

---

## 2. Тикеты

> Формат тикета:
> - **Title** — короткое имя
> - **Priority / Model / Size**
> - **Depends on** — блокирующие тикеты
> - **User story** — зачем
> - **Интервью-цитата** — из cusdev (ссылка на строки)
> - **Затронутые области**
> - **Acceptance criteria**
> - **Implementation hints**
> - **Testing**
> - **i18n keys** (если user-facing)

---

### 🔴 P1 — Критические

---

#### T-01: Entity «Запрос» (Inquiry / ClientRequest)

- **Priority:** P1 / **Model:** Opus 4.7 / **Size:** L
- **Depends on:** —

**User story:**
Терапевт ведёт долгую работу с клиентом в рамках «запроса» («меньше срываться на близких», «работа с детскими воспоминаниями»). Один клиент может иметь несколько параллельных/последовательных запросов.

**Интервью:** Миша, стр.217–274 (`misha_drozd_2026-04-19.md`).
> «Вот у меня есть клиенты, которые возвращаются. И возвращаются с новыми запросами. [...] В рамках этого же клиента я открываю другое обращение»

**Затронутые области:**
- Backend: миграция БД + модель `inquiries` (id, client_id, therapist_id, title, description, status, opened_at, closed_at, created_at, updated_at); API routes `/api/clients/:clientId/inquiries/*`.
- Frontend: новая вкладка в client detail «Запросы», CRUD UI.
- Bot: опционально показывать активные запросы в `/context` команде.
- i18n: добавить ключи `inquiry.*` в 4 языках.

**Acceptance criteria:**
- [ ] Таблица `inquiries` с PK, FK на client, consent-enforcement на уровне API.
- [ ] Title и description — Class A (encrypted).
- [ ] Клиент может иметь N активных запросов одновременно.
- [ ] Запрос имеет статусы: `active`, `paused`, `closed`.
- [ ] Запрос содержит 0..N сессий (см. T-02 — связь Session → Inquiry).
- [ ] UI: список запросов на странице клиента, создать/редактировать/закрыть.
- [ ] Аудит-лог для операций над запросами.

**Implementation hints:**
- Существующие сессии НЕ привязываются автоматически — оставить `inquiry_id` nullable. Добавить UI-механизм «переместить сессию в запрос».
- Статус `closed` не удаляет данные — сессии внутри остаются доступными.

**Testing:**
- Unit: CRUD inquiry сервиса.
- Integration: consent-enforcement на `/api/clients/:id/inquiries`.
- UI smoke: создать запрос, добавить в него сессию, закрыть запрос.

**i18n keys:** `inquiry.title`, `inquiry.description`, `inquiry.status.*`, `inquiry.create`, `inquiry.close`, `inquiry.empty`.

---

#### T-02: Session c date-based identification и календарь

- **Priority:** P1 / **Model:** Opus 4.7 / **Size:** M
- **Depends on:** T-01

**User story:**
Сессии узнаются и ищутся по дате встречи (не по теме). Навигация — через стандартный календарь. Сессия принадлежит запросу (T-01).

**Интервью:** Миша, стр.46–86.
> «признак, по которому искать, это дата встречи. [...] Стандартный календарик, он зашёл»

**Затронутые области:**
- Backend: добавить колонку `sessions.inquiry_id` (nullable FK), `sessions.meeting_date` (distinct от `created_at`), `sessions.title` (optional, Class A).
- Frontend: календарный виджет в client detail → sessions. Существующий список сессий заменить / дополнить календарём.
- Bot: команда `/sessions` показывает последние 5 с датами.

**Acceptance criteria:**
- [ ] Миграция: добавить `inquiry_id`, `meeting_date`, `title` в `sessions`. Backfill `meeting_date = created_at` для существующих.
- [ ] Календарь на странице клиента: точки на датах встреч, клик → открыть сессию.
- [ ] Фильтр по запросу (если выбран — показывать только сессии этого запроса).
- [ ] Поиск/сортировка по дате работает и при отсутствии title.
- [ ] `title` — optional, не ломает UI при пустом значении.

**Implementation hints:**
- Используй `react-day-picker` или аналог — не изобретай календарь.
- `meeting_date` вводится терапевтом при создании сессии, default = сегодня.

**Testing:**
- Migration rollforward/rollback test.
- UI: создать 3 сессии в разные даты, навигация по календарю.

**i18n keys:** `session.meetingDate`, `session.title`, `session.calendar.*`.

---

#### T-03: Entity «Задание» (Assignment) привязанное к сессии

- **Priority:** P1 / **Model:** Opus 4.7 / **Size:** L
- **Depends on:** T-02

**User story:**
Внутри сессии терапевт ставит 1+ задание. Задание может включать упражнение из библиотеки ИЛИ быть freeform текстом под клиента.

**Интервью:** Миша, стр.110–181.
> «В рамке встречи задаётся что-то, куда человек дальше начинает писать свои отчёты по заданиям»

**Затронутые области:**
- Backend: таблица `assignments` (id, session_id, therapist_id, client_id, title, description, exercise_id nullable, report_frequency enum, deadline, status, created_at).
- API: `/api/sessions/:id/assignments/*`, `/api/clients/:id/assignments/*` (список).
- Bot: команда `/assignments` для клиента — список активных заданий с возможностью написать отчёт.
- Frontend: вкладка «Задания» внутри сессии; также агрегированный список на странице клиента.

**Acceptance criteria:**
- [ ] Создать задание из сессии — либо выбрать упражнение из библиотеки, либо ввести кастомное.
- [ ] `report_frequency`: `daily`, `every_n_days` (+ n), `weekly`, `on_demand`.
- [ ] Задание видно клиенту в боте после создания.
- [ ] Статусы: `active`, `completed` (после accept — см. T-05), `abandoned`.
- [ ] Title/description — Class A.

**Implementation hints:**
- `exercise_id` nullable: если заполнен — reuse существующей библиотеки; если нет — только freeform description.
- При удалении сессии — задания НЕ удалять, а сохранять с `session_id = null` (или soft-delete session).

**Testing:**
- Unit: создать задание с exercise_id и без.
- Integration: клиент получает уведомление в боте о новом задании.

**i18n keys:** `assignment.*`, `assignment.frequency.*`.

---

#### T-04: Freeform progress reports клиента по заданию

- **Priority:** P1 / **Model:** Opus 4.7 / **Size:** M
- **Depends on:** T-03

**User story:**
Клиент пишет текст по ходу выполнения задания — сколько угодно раз. Терапевт и клиент видят ленту отчётов.

**Интервью:** Миша, стр.125–196.
> «Он по конкретному упражнению пишет отчётики, и для себя понятно, что он делал, и видно делал, не делал»

**Затронутые области:**
- Backend: таблица `assignment_reports` (id, assignment_id, client_id, content, is_final boolean default false, acceptance_status enum, therapist_comment_id nullable, created_at).
- API: `/api/assignments/:id/reports/*`.
- Bot: `/report <assignment_id>` — клиент наговаривает или пишет отчёт.
- Frontend: лента отчётов внутри задания, therapist-side.

**Acceptance criteria:**
- [ ] Клиент создаёт неограниченное кол-во non-final отчётов через бот.
- [ ] Content — Class A (encrypted).
- [ ] Voice-отчёт транскрибируется автоматически (reuse Whisper pipeline).
- [ ] Отчёты отображаются в хронологическом порядке.
- [ ] Терапевт видит новый отчёт через WebSocket push (reuse существующей инфры).

**Implementation hints:**
- Переиспользовать diary entry infrastructure — там уже text/voice/video и транскрипция. Фактически `assignment_reports` = специализированный diary с привязкой к assignment.
- Фото-вложения — T-21 (P3), пока текст+голос.

**Testing:**
- Клиент пишет 3 отчёта → терапевт видит все в правильном порядке.
- Voice-отчёт транскрибируется в < 30 сек.

**i18n keys:** `assignment.report.*`.

---

#### T-05: Final report + acceptance flow терапевта

- **Priority:** P1 / **Model:** Opus 4.7 / **Size:** M
- **Depends on:** T-04

**User story:**
Клиент оформляет итоговый отчёт («я завершил»). Терапевт либо принимает, либо возвращает на доработку — с ОБЯЗАТЕЛЬНЫМ комментарием.

**Интервью:** Миша, стр.303–345.
> «У психолога должна быть возможность принять этот отчёт или сказать, ну, всё же надо ещё поработать. Не просто мы отчёт отменяем, а к этому должен быть какой-то комментарий психолога»

**Затронутые области:**
- Backend: `assignment_reports.is_final = true`, `acceptance_status: 'pending' | 'accepted' | 'returned'`, `therapist_comment` (Class A, обязательно при `returned`).
- API: `POST /api/assignments/:id/reports/:reportId/accept`, `POST .../return` (требует body.comment).
- Frontend: кнопки accept / return в карточке финального отчёта; модал с textarea для return-comment.
- Bot: клиент получает push: «Ваш отчёт принят» или «Терапевт вернул отчёт: <comment>».

**Acceptance criteria:**
- [ ] `return` без комментария → 400 Bad Request.
- [ ] При accept → статус задания = `completed`.
- [ ] При return → клиент получает notification в боте, может писать новые отчёты.
- [ ] История accept/return видна в ленте отчётов.
- [ ] Клиент может отправить несколько final-отчётов (если предыдущий был returned).

**Implementation hints:**
- Валидация `return` comment — минимум 10 символов (против пустых/шаблонных).
- Accept — one-way (нельзя передумать); return — reversible.

**Testing:**
- API: `return` без комментария → 400.
- E2E: клиент → final report → терапевт returns с комментом → клиент пишет новый → accept → статус `completed`.

**i18n keys:** `assignment.report.accept`, `.return`, `.returnReasonRequired`, `.commentFromTherapist`.

---

#### T-06: Solo mode — режим «умная тетрадка» (therapist-only)

- **Priority:** P1 / **Model:** Opus 4.7 / **Size:** L
- **Depends on:** —

**User story:**
Психоаналитики (и работающие с параноидальными клиентами) не могут подключать клиента через Telegram-бота. Нужен режим: терапевт создаёт «клиента» вручную, клиент о системе не знает, терапевт записывает только свои заметки/голос и получает transcript + summary.

**Интервью:** Алексей, стр.801–935.
> «сделаем, что ты вводишь через админку, идентифицируешь его удобным тебе именем [...] у него клиента вообще нет. [...] Ну, это как тетрадка. [...] умная тетрадка, которая ещё имеет доступ к базе знаний»

**Затронутые области:**
- Backend: `clients.mode` enum `bot_connected` | `solo`. Для `solo`: отсутствует `telegram_user_id`, `invite_code` не генерируется, диари-роуты возвращают 404 (клиент не существует в боте).
- API: `POST /api/clients/solo` — создание без invite.
- Frontend: в create-client wizard — toggle «Клиент не будет подключаться к боту (solo mode)». При toggle — упрощённая форма (имя-идентификатор, заметка).
- Bot: ничего не делать — solo-клиенты невидимы в боте.
- Permissions: все existing routes должны работать с solo-клиентами, но endpoints связанные с clientbot (SOS, diary-from-bot) — skip для solo.

**Acceptance criteria:**
- [ ] Create solo client: только имя + опциональная заметка.
- [ ] Solo-клиент появляется в client list с бейджем «Solo» или «Personal Notebook».
- [ ] Session upload, post-session notes, summary, NL-queries — работают.
- [ ] Exercises, diary entries, SOS — disabled в UI для solo-клиента (возвращают 403 / скрываются).
- [ ] Consent — авто-выставляется `granted` на момент создания (сам терапевт и клиент — это одна сущность с т.з. системы).
- [ ] Миграция: существующие клиенты получают `mode = 'bot_connected'`.

**Implementation hints:**
- Не плодить параллельную сущность `solo_client` — добавь `mode` к существующему `clients`.
- `consent_therapist_access` для solo — всегда `true` (нет другой стороны).
- UI: прячь вкладки «Диари», «Упражнения», «SOS» для solo-клиентов; оставь «Сессии», «Заметки», «Summary», «NL Search».

**Testing:**
- Create solo client → upload audio → transcription + summary → NL query работает.
- Bot-endpoints возвращают 404 для solo-клиентов.

**i18n keys:** `client.mode.solo`, `client.mode.botConnected`, `client.solo.description`, `client.solo.badge`.

---

#### T-07: Bug fix — upload audio через админку

- **Priority:** P1 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** —

**User story:**
На момент интервью Алексей не смог найти, куда загрузить audio-файл через веб-интерфейс — только через Telegram.

**Интервью:** Алексей, стр.94–101.
> «я пока загрузки, я её сам не вижу, я знаю, что её можно загрузить [...] запишем баг. То, что нужно сделать ещё загрузку здесь в админке»

**Затронутые области:**
- Frontend: session detail / session create page — добавить dropzone для audio/video.
- Backend: проверить, что `POST /api/sessions/:id/upload` работает и с админ-флоу (не только с bot API key).

**Acceptance criteria:**
- [ ] На странице клиента: кнопка «New session» → форма с `meeting_date`, optional `title`, `inquiry` (dropdown, см. T-01), и dropzone для файла.
- [ ] Drag-n-drop + click-to-select.
- [ ] Progress bar при загрузке.
- [ ] После upload → редирект на страницу сессии, показывается статус транскрипции.
- [ ] Поддержка форматов: mp3, m4a, wav, mp4, webm, ogg.
- [ ] Валидация: max 100MB (существующий лимит).

**Implementation hints:**
- Если dropzone частично уже есть — найти и доделать. Не изобретать заново.
- Reuse существующий upload endpoint, только UI-обёртка.

**Testing:**
- Upload m4a 50MB → транскрипция стартует → через ~2 мин появляется транскрипт + summary.

**i18n keys:** `session.upload.*`, `session.upload.dragDrop`, `session.upload.progress`.

---

### 🟠 P2 — Высокие

---

#### T-08: Custom summary prompts per modality

- **Priority:** P2 / **Model:** Opus 4.7 / **Size:** M
- **Depends on:** —

**User story:**
Психоаналитику нужен другой summary чем КПТ-шнику или НЛП-практику. Терапевт настраивает, на что AI обращает внимание при summary.

**Интервью:** Алексей, стр.227–269.
> «у КПТ-шника будет другая история. Ему другое Summary нужно, поведенческое [...] Да, настраиваться он может, и индивидуально»

**Затронутые области:**
- Backend: `therapists.summary_specialization` (enum presets: `psychoanalysis`, `cbt`, `nlp`, `gestalt`, `generic`), `therapists.custom_summary_prompt` (Class A, free text, optional override).
- AI service: при вызове summarization — подставлять preset prompt + custom-prompt добавка.
- Frontend: Settings → «Summary-специализация» с dropdown + textarea для кастомного промпта.

**Acceptance criteria:**
- [ ] 5 preset'ов с описанием что выделяет каждый.
- [ ] Кастомный промпт — опциональный, добавляется к preset'у (не заменяет — или заменяет, с явным toggle «полностью заменить»).
- [ ] Существующие терапевты получают `generic` как default.
- [ ] Smoke-тест: `psychoanalysis` и `cbt` на одном транскрипте дают ЗАМЕТНО разные summary.

**Implementation hints:**
- Preset'ы хранить в коде (`services/ai/summary-presets.js`), не в БД — это знания разработчика.
- Кастомный промпт limit ~2000 символов.

**Testing:**
- Unit: генерация summary с разными preset'ами → проверка что system prompt отличается.

**i18n keys:** `settings.summary.specialization.*`, `settings.summary.customPrompt`, `settings.summary.presets.psychoanalysis` etc.

---

#### T-09: Personal knowledge base (RAG) терапевта

- **Priority:** P2 / **Model:** Opus 4.7 / **Size:** L
- **Depends on:** T-08

**User story:**
Терапевт загружает учебники/статьи/литературу своей школы. AI использует как контекст при генерации summary и NL-queries.

**Интервью:** Алексей, стр.275–356.
> «можно ещё подгружать свои источники, которым он как бы доверяет. Это учебники, просто загрузите всё это направление»

**Затронутые области:**
- Backend: таблица `therapist_knowledge_base` (id, therapist_id, title, file_path, mime_type, chunk_count, created_at). Переиспользовать `vector_embeddings` с новым `source_type = 'kb'`.
- Ingest pipeline: PDF/DOCX/TXT/MD → chunk → embed → store.
- API: `POST /api/kb/upload`, `GET /api/kb`, `DELETE /api/kb/:id`.
- AI: при summarization и NL-query — retrieval top-K chunks из KB терапевта, добавить в context.
- Frontend: Settings → «База знаний» с upload, списком, удалением.

**Acceptance criteria:**
- [ ] Поддержка: PDF, DOCX, TXT, MD, EPUB.
- [ ] Макс размер файла: 50MB (настраиваемо).
- [ ] Chunking: 500-1000 tokens с overlap 100.
- [ ] Embeddings: reuse существующий провайдер (OpenAI/Anthropic из конфига).
- [ ] Retrieval: top-5 chunks по semantic similarity → в system prompt.
- [ ] Tier-gating: доступно только Pro/Premium (по аналогии с NL queries).
- [ ] Spending-limit проверка перед ingest (embedding тоже тратит tokens).

**Implementation hints:**
- Использовать существующий `vector_embeddings` стор. Не плодить параллельную инфру.
- Для PDF: `pdf-parse`. Для DOCX: `mammoth`.
- Ingest — async job с progress (см. existing transcription queue).

**Testing:**
- Upload PDF учебника → через несколько минут появляется в списке с chunk_count > 0.
- Summary на транскрипте использует terminology из учебника (визуальная проверка).

**i18n keys:** `kb.*`, `kb.upload`, `kb.limit.tierGate`, `kb.processing`.

---

#### T-10: Dual-comment model — два типа комментариев на сущность

- **Priority:** P2 / **Model:** Opus 4.7 / **Size:** M
- **Depends on:** T-03 (для комментов к заданиям), но можно параллельно

**User story:**
К любой сущности (сессия, задание, отчёт, упражнение) можно оставить ДВА комментария: приватный (для себя) и публичный (видимый другой стороне).

**Интервью:** Миша, стр.374–396.
> «Два поля. [...] По сути, надо два поля сделать, да.»

**Затронутые области:**
- Backend: полиморфная таблица `comments` (id, entity_type enum, entity_id, author_id, author_role enum, visibility enum `private`|`shared`, content, created_at).
- API: `GET/POST/PATCH/DELETE /api/comments` с фильтром по entity.
- Frontend: компонент `<CommentsPanel entityType entityId>` — два таба: «Для меня» / «Для клиента» (терапевту) или «Для меня» / «Для терапевта» (клиенту).
- Content — Class A.

**Acceptance criteria:**
- [ ] Entity types: `session`, `assignment`, `assignment_report`, `exercise_completion`, `inquiry`.
- [ ] Terapist: может создать private + shared; может переключить visibility уже созданного.
- [ ] Client: может создать private + shared.
- [ ] Visibility `private` автора-терапевта → клиент НЕ видит (возврат в API тоже скрыт).
- [ ] Visibility `private` автора-клиента → терапевт НЕ видит.
- [ ] Default terapist → `private`. Default client → `shared`.

**Implementation hints:**
- Полиморфная связь через `entity_type` + `entity_id`.
- Authorization middleware: проверяет что пользователь либо автор, либо имеет право видеть `shared`.
- Существующие `notes` переехать в `comments` с `entity_type='client'` и `visibility='private'` (миграция).

**Testing:**
- Unit: `private` коммент терапевта — не видит клиент через API.
- UI: два таба, переключение visibility, filter правильный.

**i18n keys:** `comments.private`, `.shared`, `.visibility.toggle`, `.emptyForYou`, `.emptyForClient`.

---

#### T-11: Therapist comment default-hidden (часть T-10)

- **Priority:** P2 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** T-10

**User story:**
По умолчанию комментарий терапевта ≠ видим клиенту. Тумблер «показать клиенту».

**Интервью:** Миша, стр.294–302.

**Acceptance criteria:**
- [ ] Новый коммент терапевта: visibility = `private`.
- [ ] UI: чекбокс/тумблер «Показать клиенту» в форме коммента (default off).
- [ ] Существующая вкладка private для терапевтов — default.

Уже покрыто acceptance-criteria в T-10, но валидация в UI отдельно.

---

#### T-12: Client private comments (часть T-10)

- **Priority:** P2 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** T-10

**User story:**
Клиент может оставить private коммент (терапевт не видит).

**Интервью:** Миша, стр.285–297.

**Acceptance criteria:**
- [ ] В боте: при записи коммента — кнопка «сделать приватным» (inline keyboard).
- [ ] Default client → shared; приватные — по явному выбору.
- [ ] Client web view (если будет в будущем) — аналогичный toggle.

Покрыто T-10, но отдельный UX-тест через бот.

---

#### T-13: «Пример / Template» label на всех библиотечных упражнениях

- **Priority:** P2 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** —

**User story:**
Психологи дискредитируют сервис, видя слабые формулировки упражнений. Нужно явно пометить каждую карточку как «пример оформления», а не «упражнение от PR-TOP».

**Интервью:** Миша, стр.410–484.
> «в каждом писать. Пример, пример, как может быть оформлено»

**Затронутые области:**
- Frontend: компонент exercise card — бейдж «Пример / Template» в правом верхнем углу.
- Backend: флаг `exercises.is_template = true` на всех seeded-упражнениях (custom exercises терапевта — `false`).
- Migration: обновить существующие seeded.

**Acceptance criteria:**
- [ ] Бейдж виден на card и в detail view.
- [ ] На hover/click бейджа — pop-up: «Это пример оформления. Вы можете использовать или создать своё упражнение в "My Exercises"».
- [ ] Custom exercises терапевта — без бейджа.

**Testing:**
- UI smoke: открыть library → все seeded с бейджем; создать custom → без бейджа.

**i18n keys:** `exercise.templateBadge`, `exercise.templateTooltip`.

---

#### T-14: Exercise library content cleanup

- **Priority:** P2 / **Model:** Sonnet 4.6 / **Size:** M
- **Depends on:** T-13

**User story:**
Удалить/переписать слабые карточки (пример: «Рефрейминг» слишком общий и дискредитирует сервис). Оставить конкретные (пример эталона: «Отслеживание привычек»).

**Интервью:** Миша, стр.429–533.

**Затронутые области:**
- Content: `backend/data/exercises/*.json` (или где seeded).
- i18n: все 4 языка.

**Acceptance criteria:**
- [ ] Audit существующих упражнений: оставить только те, что имеют чёткий пошаговый алгоритм (как «Отслеживание привычек»).
- [ ] Удалить/переписать: «Рефрейминг», и любые generic-placeholder карточки.
- [ ] Каждое оставшееся — 5+ конкретных шагов, без «подумайте и изобретите».
- [ ] 4 языка синхронно.

**Implementation hints:**
- Не выдумывать — либо использовать existing (CBT textbook refs), либо удалять.
- Согласовать список с Мариной перед коммитом.

**Testing:**
- Manual review списка с Мариной.

---

#### T-15: Post-session therapist notes field (голос + текст)

- **Priority:** P2 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** —

**User story:**
После окончания сессии терапевт быстро наговаривает (или пишет) «на что обратить внимание в следующий раз». AI учитывает это поле в summary.

**Интервью:** Алексей, стр.73–92.
> «ты можешь наговаривать свои заметки относительно этой сессии, потому что одно дело у тебя сессия, а другое дело ты после сессии говоришь себе»

**Затронутые области:**
- Backend: `sessions.post_session_notes` (Class A, nullable). Optional: `post_session_notes_audio_path`.
- API: `PATCH /api/sessions/:id` с полем.
- Frontend: в session detail — отдельная секция «Post-session notes» с textarea и кнопкой «Голосом» (reuse voice-input component).
- AI: при генерации summary — передавать post-session notes как контекст.

**Acceptance criteria:**
- [ ] Поле visible только терапевту (клиент не видит).
- [ ] Голосовой ввод → транскрипция → вставить в textarea.
- [ ] Re-generate summary button после изменения post-session notes.

**Testing:**
- Создать сессию → добавить post-note → re-summary → summary отражает post-note.

**i18n keys:** `session.postNotes.*`.

---

### 🟡 P3 — Средние

---

#### T-16: Optional reminders (off by default)

- **Priority:** P3 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** —

**User story:**
Психоанализ не использует напоминалки между сессиями. Сделать их опциональными (флаг per-therapist и per-client).

**Интервью:** Алексей, стр.745–758.

**Acceptance criteria:**
- [ ] `therapists.reminders_enabled_default` (boolean, default false).
- [ ] `clients.reminders_enabled` (boolean, nullable — fallback на therapist default).
- [ ] Существующие терапевты получают `true` (backward compat — они уже пользуются).
- [ ] Новые терапевты — `false` (по умолчанию off, как просил Алексей).
- [ ] UI: toggle в Settings и в client detail.

**i18n keys:** `settings.reminders.*`.

---

#### T-17: Supervision share mode

- **Priority:** P3 / **Model:** Sonnet 4.6 / **Size:** M
- **Depends on:** —

**User story:**
Терапевт хочет показать супервизору историю клиента — без передачи пароля.

**Интервью:** Миша, стр.346–366.

**Затронутые области:**
- Backend: таблица `supervision_share_links` (id, therapist_id, client_id, token, expires_at, anonymize boolean, created_at).
- API: `POST /api/clients/:id/supervision-share`, `GET /share/supervision/:token` (public, без auth).
- Frontend: кнопка «Share for supervision» → модал (опции: анонимизировать / нет, TTL) → copy-link.
- Supervisor view: read-only, subset данных.

**Acceptance criteria:**
- [ ] TTL: 1д / 7д / 30д.
- [ ] Анонимизация: замена имени клиента на «Client A», удаление любых персональных идентификаторов.
- [ ] Read-only view: transcripts, summaries, notes (shared only!), inquiries, sessions. НЕ включает: private comments, SOS details с личными данными.
- [ ] Audit-log: каждый access через supervision-link логируется.
- [ ] Revoke link в любой момент.

**i18n keys:** `supervision.*`.

---

#### T-18: Extended consent disclaimer

- **Priority:** P3 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** T-17 (упоминает supervision в disclaimer)

**User story:**
При подключении клиент должен явно согласиться на: хранение, AI-обработку, возможность супервизии, право отзыва.

**Интервью:** Алексей, стр.780–790; Миша, стр.353–365.

**Acceptance criteria:**
- [ ] Новый consent-flow в боте: полный текст + чекбоксы (нельзя просто /start и готово).
- [ ] Пункты: хранение / AI / анонимизированная супервизия / право отзыва / шифрование.
- [ ] Consent-текст локализован в 4 языка.
- [ ] `consent_version` в БД — при изменении текста существующие клиенты должны re-consent.

**i18n keys:** `consent.disclaimer.*` (много ключей).

---

#### T-19: Single-track (therapist-only) recording

- **Priority:** P3 / **Model:** Opus 4.7 / **Size:** L
- **Depends on:** —

**User story:**
Если клиент не согласился на запись, терапевт может загрузить Zoom-запись, но система использует ТОЛЬКО дорожку терапевта.

**Интервью:** Алексей, стр.860–872.

**Затронутые области:**
- Backend: audio pre-processing — speaker diarization.
- Provider: pyannote.audio / whisperx / OpenAI Whisper с speaker labels (если поддерживает в версии).

**Acceptance criteria:**
- [ ] При upload — опция «Keep only my voice (speaker-0)».
- [ ] Speaker diarization: автоматическое разделение на 2 дорожки.
- [ ] Терапевт выбирает «свою» дорожку (по аудио-preview первых 10 сек).
- [ ] Summary генерируется ТОЛЬКО по выбранной дорожке.
- [ ] Удалённые дорожки НЕ сохраняются на диске.

**Implementation hints:**
- Исследовать: WhisperX vs pyannote vs Deepgram — баланс качества/цены.
- Для first version допустимо manual-timestamps if too complex.

**Testing:**
- Upload 5-мин Zoom recording → правильно выделяет терапевта.

**i18n keys:** `session.upload.singleTrack.*`.

---

#### T-20: Auto-link audio by date/metadata

- **Priority:** P3 / **Model:** Sonnet 4.6 / **Size:** M
- **Depends on:** T-02, T-07

**User story:**
Терапевт загружает несколько записей за день, система автоматически угадывает, какая к какому клиенту/сессии.

**Интервью:** Алексей, стр.195–213.

**Acceptance criteria:**
- [ ] Bulk upload: drag 3 файлов.
- [ ] Система читает metadata (creation time) или parsing filename по patterns.
- [ ] Matching по existing `session.meeting_date` слотам терапевта.
- [ ] Conflict UI: если несколько клиентов — выбрать через dropdown.
- [ ] No auto-match → предложить создать новую сессию.

**i18n keys:** `session.upload.autoLink.*`.

---

#### T-21: Photo attachments to reports/diary

- **Priority:** P3 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** T-04

**User story:**
Клиент может прикрепить фото к отчёту по заданию («сфоткал дневник», «записал тренировку»).

**Интервью:** Миша, стр.51–53.

**Acceptance criteria:**
- [ ] Bot: принимает photo-message в контексте `/report`.
- [ ] Хранилище: AES-encrypted, opaque IDs (reuse существующей инфры для audio).
- [ ] Frontend: photo thumbnail в ленте отчётов, click → full size.
- [ ] Max 5 фото на отчёт, max 10MB каждое.

**i18n keys:** `report.photo.*`.

---

#### T-22: Per-exercise-run comments

- **Priority:** P3 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** T-10

**User story:**
При выполнении стандартного упражнения из библиотеки — клиент пишет running comments по ходу, плюс итоговый comment.

**Интервью:** Миша, стр.125–145.

**Acceptance criteria:**
- [ ] Для каждого exercise assignment (т.е. T-03 задания с exercise_id) — лента комментов клиента (reuse T-10 comments entity=`exercise_completion`).
- [ ] Финальный итог отдельно помечен.

Покрыто T-04 + T-10, нужен только UI-полировка (tab «Running notes» vs «Final»).

---

### 🟢 P4 — Долгосрочные / Research

---

#### T-23: Zoom / Google Meet SDK integration

- **Priority:** P4 / **Model:** Opus 4.7 / **Size:** XL
- **Depends on:** T-07, T-19
- **Первый шаг — research spike (1 день)**, не кодить сразу.

**User story:**
Терапевт запускает Zoom/Meet прямо из дашборда, запись автоматически ложится в сессию.

**Интервью:** Алексей, стр.181–193.

**Research deliverable:**
- [ ] Сравнение: Zoom Meeting SDK vs Video SDK vs RecallAI (3rd-party).
- [ ] Стоимость лицензий.
- [ ] Требования к hosting (server-side bot / client-side embed).
- [ ] Legal: consent-handling в разных юрисдикциях.
- [ ] Decision doc → решение go/no-go + оценка.

---

#### T-24: Russia accessibility (mirror / proxy)

- **Priority:** P4 / **Model:** Opus 4.7 (research + infra) / **Size:** L
- **Depends on:** —

**User story:**
Клиенты из РФ не могут открыть pr-top.com (Cloudflare заблокирован).

**Интервью:** Миша, стр.638–660.

**Research deliverable:**
- [ ] Варианты: (a) зеркало на не-CF хостинге, (b) origin direct без CF на отдельном субдомене, (c) SSH-proxy инструкция для клиентов.
- [ ] Оценка: юридические риски хостинга в РФ.
- [ ] Оценка: performance без CF CDN.
- [ ] Decision doc.

---

#### T-25: Client engagement analytics

- **Priority:** P4 / **Model:** Sonnet 4.6 / **Size:** M
- **Depends on:** T-04

**User story:**
Метрики: кол-во отчётов, длина в символах, регулярность, gaps между отчётами. Визуализация для терапевта.

**Интервью:** Миша, стр.618–632.

**Acceptance criteria:**
- [ ] Charts на странице клиента: reports over time, avg length, consistency score.
- [ ] Reuse Chart.js / recharts из analytics dashboard.

**i18n keys:** `analytics.engagement.*`.

---

#### T-26: AI source disclaimers

- **Priority:** P4 / **Model:** Sonnet 4.6 / **Size:** S
- **Depends on:** T-09

**User story:**
Если библиотечные упражнения или summary генерируются с опорой на open-source литературу — нужен disclaimer с атрибуцией.

**Интервью:** Миша, стр.513–527.

**Acceptance criteria:**
- [ ] В карточке упражнения (если AI-generated) — «Generated with AI based on: <sources>».
- [ ] Settings → показывать sources для transparency.

**i18n keys:** `ai.disclaimer.*`.

---

## 3. Рекомендованный порядок запуска AutoForge

### Фаза 1 (MVP — ~3-4 недели с Opus 4.7)
1. **T-07** — quick win, разблокирует Алексея.
2. **T-01 + T-02** — фундамент (Inquiry + Session calendar).
3. **T-03 + T-04 + T-05** — полный цикл Задание → Отчёт → Приёмка.
4. **T-06** — Solo mode (открывает сегмент психоаналитиков).
5. **T-13** — «Пример» на карточках (минимум работы, максимум доверия).

### Фаза 2 (~2-3 недели — смесь Opus/Sonnet)
6. **T-08 + T-09** — Custom summary + KB (главный дифференциатор).
7. **T-10 + T-11 + T-12** — Dual comments.
8. **T-15** — Post-session notes.
9. **T-14** — Library cleanup (content work, в параллель).

### Фаза 3 (~2 недели — Sonnet 4.6)
10. **T-16, T-18, T-21, T-22** — P3 удобства.
11. **T-17, T-20** — Supervision, auto-link.

### Фаза 4 (research-heavy)
12. **T-23, T-24** — Spike + decision docs ПЕРЕД кодом.
13. **T-19, T-25, T-26** — как остальное бюджет позволит.

---

## 4. Как скармливать в AutoForge

1. Открыть тикет (например T-01).
2. Указать модель из таблицы секции 0.
3. В prompt для AutoForge включить:
   - Весь блок тикета (User story, Acceptance criteria, Implementation hints, Testing, i18n keys).
   - Ссылку на интервью (строки из `.md`).
   - Ссылку на связанные тикеты (Depends on).
   - Общие правила из секции 1 (ветка, i18n, шифрование, миграции, тесты).
4. После завершения — проверить acceptance criteria чек-листом.
5. Переходить к следующему тикету по dependency-графу.

---

## 5. Dependency-граф (упрощённо)

```
T-07 ─────────────────────────────────────── (quick win, независимо)

T-01 (Inquiry)
  └── T-02 (Session + Calendar)
        ├── T-03 (Assignment)
        │     ├── T-04 (Reports)
        │     │     └── T-05 (Accept/Return)
        │     │     └── T-21 (Photo)
        │     │     └── T-25 (Engagement)
        │     └── T-22 (Exercise comments)
        └── T-20 (Auto-link audio)

T-06 (Solo mode) ────────────────────────── (независимо)

T-08 (Summary presets)
  └── T-09 (KB / RAG)
        └── T-26 (AI disclaimers)

T-10 (Dual comments)
  ├── T-11 (Therapist hidden)
  └── T-12 (Client private)

T-13 (Example label)
  └── T-14 (Content cleanup)

T-15 (Post-session notes) ────────────────── (независимо)

T-16 (Reminders opt) ───────────────────── (независимо)

T-17 (Supervision)
  └── T-18 (Consent disclaimer)

T-19 (Single-track) ────────────────────── (независимо)

T-23 (Zoom) ──── research spike first
T-24 (RU mirror) ──── research spike first
```
