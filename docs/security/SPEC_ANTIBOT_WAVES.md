# Спецификация реализации: анти-бот регистрация, верификация email, вход по коду

Основание: `docs/security/PLAN_ANTIBOT_REGISTRATION_AND_CODE_LOGIN.md` (план, согласован 2026-09-28).
Ветка: `dev`. Три волны, внутри волны — параллельные треки без пересечений по файлам.

## 0. Архитектурные решения (фиксируем до начала)

| # | Решение | Почему |
|---|---|---|
| A1 | Новые роутеры вместо роста `auth.js` (уже 900+ строк): `routes/loginCode.js`, `routes/emailVerification.js`. Монтируются в `index.js` под `/api/auth`. | Два трека волны 2 не редактируют один файл. |
| A2 | Выдача сессии — единый helper `utils/session.js: issueSession(res, userRow) → { token, user }`. Делается в волне 1, до того как появятся новые точки входа. | `/login`, `/register`, `/login-code/verify`, `/login-code/link` — один код, один формат ответа, одни cookie-опции. |
| A3 | Схема БД (`users.email_verified_at`, `login_codes`) и `req.user.emailVerified` добавляются в волне 1, **без** гейта. Гейт (`requireVerifiedEmail`) — волна 2. | Волна 2 не трогает `middleware/auth.js` и `db/connection.js` двумя треками. |
| A4 | Реальный IP — `utils/clientIp.js: getClientIp(req)`: `CF-Connecting-IP` → иначе `req.ip`. Все лимитеры используют `keyGenerator: getClientIp`. `trust proxy` не трогаем. | Цепочка CF→Traefik→nginx→backend; число хопов различается dev/prod. Заголовок CF надёжен, если origin закрыт от прямого доступа (см. фаза 0, п.5). |
| A5 | Анти-бот — один middleware `middleware/antibot.js` с тремя проверками: Turnstile, honeypot, timing. Порядок: honeypot/timing (дёшево, без сети) → Turnstile (сеть). Отказ **honeypot** = фейковый успех, форма ответа повторяет реальный успех конкретного роута (`fake: 'register'|'viewer'|'lead'|'forgot'`), с задержкой 250–450 мс и dummy-cookie. Отказ **timing** = честный `400 { code: 'FORM_TOO_FAST' }` (повтор проходит). Отказ Turnstile = 403 `{ error, code: 'TURNSTILE_FAILED' }`; дополнительно проверяются `hostname` и `action` из ответа siteverify. | Бот по honeypot не должен узнать, что отсечён (и по форме, и по таймингу ответа). Тайминг даёт ложные срабатывания у людей с менеджером паролей — им нужен повторяемый честный отказ. Turnstile-ошибка бывает у людей (adblock) — им нужен честный текст. |
| A6 | Все защиты за env-флагами: пустой `TURNSTILE_SECRET` → пропуск; `ANTIBOT_ENABLED=false` → пропуск honeypot/timing; `EMAIL_VERIFICATION_GATE=false` → гейт не блокирует. Dev-ключи Turnstile: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (always pass). | Существующие `test_*.js` и dev-стенд не ломаются. |
| A7 | Коды входа: 6 цифр, `crypto.randomInt`, хранится `sha256(code + LOGIN_CODE_PEPPER)`; `link_token` — 32 байта hex, хранится хэш так же. TTL 10 мин, 5 попыток. | bcrypt не нужен для 6 цифр с лимитом попыток; SHA-256+pepper быстрее и достаточен. |
| A8 | Ответ `login-code/request` всегда `200 { message }`, задержка выравнивается до ~300 мс (`setTimeout` до минимальной длительности). | Не раскрывать существование email ни текстом, ни таймингом. |
| A9 | Верификация не блокирует вход в дашборд. Гейт — только на мутации с «вредом от бота»: см. §2 таблицу гейта. | Лёгкий онбординг — принцип плана. |
| A10 | Фронтенд узнаёт `email_verified` из `/api/auth/me` (не из localStorage) — баннер запрашивает `/me` при монтировании и после resend. | Состояние меняется вне вкладки (клик по письму). |
| A11 | **AI-краулеры не блокируем.** Все анти-бот меры действуют только на POST формы записи (`/api/auth/register*`, `/forgot-password`, `/login-code/*`). Никаких site-wide челленджей (Bot Fight Mode, «Block AI bots»), никаких UA-правил на GET. `robots.txt` явно разрешает GPTBot, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, Applebot-Extended, Bingbot, CCBot; `/register`, `/login`, `/dashboard`, `/admin`, `/api/` — `Disallow` для всех (там нечего индексировать). Сами robots.txt/llms.txt — не в этой спеке: это F16 и соседние пункты в `docs/seo/AUTOFORGE_FEATURES_GEO.md` / `docs/seo/AGENTIC_SEO_PLAN.md`; здесь — только запрет вводить site-wide блокировки. | Владелец: сайт должен находиться и цитироваться через ChatGPT / Perplexity / Claude; цель — структурная информация для нейросетей, а не закрытие. |

### Env-переменные (добавить в `.env.example`, Dokploy, docker-compose)

| Переменная | Где | Default | Смысл |
|---|---|---|---|
| `TURNSTILE_SECRET` | backend | пусто (=off) | секрет Turnstile |
| `VITE_TURNSTILE_SITE_KEY` | frontend build arg | пусто (=виджет не рендерится, токен не шлётся) | site key |
| `ANTIBOT_ENABLED` | backend | `true` | honeypot + timing |
| `ANTIBOT_MIN_FORM_MS` | backend | `3000` | минимальное время заполнения |
| `REGISTER_RATE_LIMIT_MAX` | backend | prod `5` / dev `1000` | регистраций в час на IP |
| `LOGIN_CODE_RATE_LIMIT_MAX` | backend | prod `10` / dev `1000` | запросов кода в час на IP |
| `LOGIN_CODE_PEPPER` | backend | обязателен в prod (fallback = `JWT_SECRET`) | pepper для хэшей |
| `LOGIN_CODE_TTL_MIN` | backend | `10` | срок кода |
| `EMAIL_VERIFICATION_GATE` | backend | `true` | блокировать гейт-роуты для неподтверждённых |
| `EMAIL_VERIFICATION_TTL_H` | backend | `48` | срок ссылки подтверждения |
| `UNVERIFIED_CLEANUP_DAYS` | backend | `7` | удаление неподтверждённых без активности |

## 1. Уровни агентов

| Уровень | Модель | Для чего |
|---|---|---|
| **L1 дешёвый** | haiku | i18n-ключи ×4 языка, email-шаблоны по образцу, `.env.example`/compose/Dockerfile, KB-страницы и FAQ по готовому конспекту, cron-джоб по образцу, простые тест-скрипты |
| **L2 стандарт** | sonnet | React-компоненты, рестрактуринг `Login.jsx`, `emailHygiene`, админ-фильтр, тест-скрипты с логикой, code-review волны |
| **L3 архитектурный** | opus / fable | всё, что касается безопасности и общих контрактов: `clientIp` + лимитеры, `antibot` middleware, `issueSession`, гейт, эндпоинты кода входа, миграция существующих пользователей, security-review |

Правило: L1/L2 получают в промпте точный контракт из этой спеки и список файлов; не принимают решений о безопасности. Любая правка `middleware/auth.js`, `csrf.js`, `index.js` (лимитеры) — только L3.

Каждая волна: треки параллельно → `node test_*.js` (новые + `test_403_ratelimit.js`, `test_api_regression.js`) → code-review (L2) → фиксы → security-review (L3, волны 1 и 2) → коммит одним PR-стайл коммитом на трек.

---

## 2. Волна 1 — фундамент + быстрые фиксы (план: фаза 1 + подготовка фазы 2)

### Трек 1A — backend: IP, лимитеры, antibot, session helper, схема — **L3**

Файлы: `src/backend/src/utils/clientIp.js` (новый), `src/backend/src/middleware/antibot.js` (новый), `src/backend/src/utils/session.js` (новый), `src/backend/src/index.js`, `src/backend/src/routes/auth.js`, `src/backend/src/middleware/auth.js`, `src/backend/src/db/connection.js`, `src/frontend/nginx.conf`.

1. **`utils/clientIp.js`**
   ```js
   function getClientIp(req) // CF-Connecting-IP (валидный IPv4/IPv6) → req.ip
   ```
   nginx.conf `location /api/`: `proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;`.
2. **`index.js` лимитеры**: у `limiter` и `authLimiter` добавить `keyGenerator: getClientIp`. Новый `registerLimiter` (60 мин, `REGISTER_RATE_LIMIT_MAX`) на `/api/auth/register`, `/api/auth/register-lead`, `/api/auth/register-viewer`; `authLimiter` с `/api/auth/register` снять. Новый `loginCodeLimiter` (60 мин, `LOGIN_CODE_RATE_LIMIT_MAX`) на `/api/auth/login-code` — монтируется уже сейчас, роутер придёт в волне 2. Временный лог `logger.info('[IP] register from ' + getClientIp(req))` в `/register` — убрать в волне 3 после подтверждения на проде.
3. **`middleware/antibot.js`** — экспорт `antibot({ turnstile: true|false })`:
   - honeypot: `req.body.website` непустой → `fakeSuccess(res)`;
   - timing: `req.body.form_started_at` (unix ms) отсутствует или `Date.now() - form_started_at < ANTIBOT_MIN_FORM_MS` → `fakeSuccess(res)`. Если `ANTIBOT_ENABLED=false` — пропуск;
   - Turnstile: если `TURNSTILE_SECRET` задан — POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` (`secret`, `response = req.body.turnstile_token`, `remoteip = getClientIp(req)`), таймаут 5 с; `success !== true` → `403 { error: t('auth.turnstileFailed'), code: 'TURNSTILE_FAILED' }`; сетевая ошибка siteverify → **пропускаем** с `logger.warn` (не блокировать людей из-за нашего сбоя);
   - `fakeSuccess`: `201 { message: 'User registered successfully', user: { id: 0, email, role: 'therapist' }, token: <random 32 hex> }`, лог `[ANTIBOT] reason=honeypot|timing ip=… email=…`;
   - удалить `website`, `form_started_at`, `turnstile_token` из `req.body` после проверки.
   Повесить: `/register`, `/register-lead`, `/register-viewer`, `/forgot-password` (все с `turnstile: true`). `/public-chat` (в `routes/publicAssistant.js`) — **не в волне 1**: Turnstile-токен одноразовый, чат шлёт много сообщений, нужен per-message `turnstile.execute()` на фронте → перенесено в волну 3 (трек 3C). У чата есть собственный лимит сообщений для лидов.

   **Зависимость деплоя:** 1A и 1B выкатываются только вместе — без фронтенд-полей `form_started_at` все формы (включая `/forgot-password`) получат фейковый 201.
4. **`utils/session.js`**: `issueSession(res, { id, email, role, timezone })` → ставит cookie `SESSION_COOKIE_OPTIONS`, возвращает `{ token, user: { id, email, role, timezone } }`. Перевести `/login` и `/register` в `auth.js` на него (формат ответа не меняется; `/register` добавляет `created_at`, `next_action` как сейчас).
5. **Схема** (`db/connection.js`, по паттерну `ALTER TABLE … try/catch`):
   - `users.email_verified_at TEXT`, `users.verification_token_hash TEXT`, `users.verification_expires_at TEXT`, `users.suspicious INTEGER DEFAULT 0`;
   - `CREATE TABLE IF NOT EXISTS login_codes (id, user_id REFERENCES users(id), code_hash TEXT NOT NULL, link_token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER DEFAULT 0, used INTEGER DEFAULT 0, ip TEXT, created_at TEXT DEFAULT (datetime('now')))` + индексы `user_id`, `link_token_hash`, `expires_at`;
   - **миграция один раз** (флаг в `platform_settings` `migration_email_verified_backfill=1`): `UPDATE users SET email_verified_at = created_at WHERE role IN ('therapist','superadmin') AND email_verified_at IS NULL AND (EXISTS клиент с therapist_id=users.id OR EXISTS subscriptions с stripe_customer_id OR EXISTS audit_logs actor_id=users.id action='login' …)`. Точный критерий: любой из — есть клиенты; есть `stripe_customer_id`; `created_at < '2026-09-20'` (до волны ботов). Остальные (id 22–39 и будущие) остаются неподтверждёнными.
6. **`middleware/auth.js`** `authenticate`: SELECT добавить `email_verified_at`; `req.user.emailVerified = !!row.email_verified_at`. `GET /api/auth/me` в `auth.js` возвращает `email_verified: boolean`.
7. **`csrf.js`**: `publicPaths` без изменений (login-code эндпоинты пойдут с CSRF-токеном, как `/login`).

Приёмка: `node test_antibot.js` (трек 1D) зелёный; `test_403_ratelimit.js`, `test_api_regression.js` зелёные; `curl -H 'CF-Connecting-IP: 1.2.3.4'` даёт разные счётчики лимитера для разных IP.

### Трек 1B — frontend: Turnstile + honeypot в трёх формах — **L2**

Файлы: `src/frontend/src/components/TurnstileWidget.jsx` (новый), `src/frontend/src/hooks/useAntibotFields.js` (новый), `src/frontend/src/pages/Register.jsx`, `src/frontend/src/components/landing/ConfirmSignupForm.jsx`, `src/frontend/src/components/PublicAssistantChatPanel.jsx` (форма лида), `src/frontend/src/pages/ForgotPassword.jsx`.

1. **`TurnstileWidget`**: props `onToken(token)`, `onExpire()`, `action` (строка, напр. `register`). Один раз подгружает `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` (guard на `window.turnstile`), рендерит `appearance: 'interaction-only'`, `size: 'invisible'`… — конкретно: `execution: 'render'`, `appearance: 'interaction-only'`. Если `import.meta.env.VITE_TURNSTILE_SITE_KEY` пуст — рендерит `null`, `onToken(null)` сразу. На unmount — `turnstile.remove`.
2. **`useAntibotFields()`** → `{ honeypotProps, hiddenFields }`: `honeypotProps` = `{ name:'website', tabIndex:-1, autoComplete:'off', 'aria-hidden':true, style:{position:'absolute',left:'-9999px',height:0,width:0,opacity:0} }`; `hiddenFields` = `{ website, form_started_at }` (`form_started_at = Date.now()` при монтировании).
3. В четырёх формах: инпут-honeypot (`<input {...honeypotProps} value={website} onChange=…/>`), `TurnstileWidget`, в body добавить `...hiddenFields, turnstile_token`. Кнопка submit **не** блокируется ожиданием токена (invisible-режим выдаёт токен за <1 с; если токена нет к моменту submit — ждать до 3 с, затем слать без токена). Обработка `code === 'TURNSTILE_FAILED'` → текст `t('auth.turnstileFailed')` + повторный `turnstile.reset()`.
4. `Register.jsx`: добавить необязательное поле «Имя» (`name`, max 100) — бэкенд уже принимает.

Приёмка: формы работают с пустым `VITE_TURNSTILE_SITE_KEY` и с dev-ключом; honeypot не виден и не в tab-order; Lighthouse a11y без регресса.

### Трек 1C — инфраструктура, i18n, документация — **L1**

Файлы: `.env.example` (backend), `docker-compose.yml`, `src/frontend/Dockerfile`, `src/backend/src/i18n/{en,ru,es,uk}.json`, `src/frontend/src/i18n/{en,ru,es,uk}.json`, `docs/assistant-kb/registration-and-onboarding.md`, `docs/troubleshooting/antibot-runbook.md` (новый).

1. compose/Dockerfile: `ARG VITE_TURNSTILE_SITE_KEY` по образцу `VITE_UMAMI_WEBSITE_ID`; backend env-переменные из §0 в `.env.example` с комментариями.
2. i18n backend: `auth.turnstileFailed`, `auth.tooManyRegistrations`; frontend: `auth.turnstileFailed`, `auth.nameOptional`, `auth.namePlaceholder`. Все четыре языка одновременно.
3. KB: в `registration-and-onboarding.md` раздел «Защита от автоматических регистраций» (что видит человек: ничего; что делать при ошибке Turnstile: отключить блокировщик, обновить страницу; необязательное имя). Без раскрытия honeypot/timing (audience остаётся public → технику не описывать).
4. `docs/troubleshooting/antibot-runbook.md`: как читать `[ANTIBOT]`/`[IP]` логи, как временно выключить (`ANTIBOT_ENABLED=false`, пустой `TURNSTILE_SECRET`), как проверить IP-лимитер.
5. `docs/security/PLAN_…md` §3 фаза 0 п.5 добавить: «Hetzner firewall / ufw: 80/443 только с IP-диапазонов Cloudflare (если все сайты хоста за CF); иначе — Authenticated Origin Pulls для pr-top.com».

### Трек 1D — тесты — **L2**

Файл: `src/backend/test_antibot.js` (по образцу `test_403_ratelimit.js`: поднимает fetch на `baseUrl`, печатает PASS/FAIL, exit code).

Кейсы: (1) регистрация без antibot-полей и `ANTIBOT_ENABLED=false` → 201; (2) `website` заполнен → 201, но пользователя в БД нет (проверка через `/login` → 401); (3) `form_started_at = Date.now()` → фейковый 201; (4) с dev-secret Turnstile и `turnstile_token='x'` → 403 `TURNSTILE_FAILED` (dev secret `2x0000000000000000000000000000000AA` = always fail); (5) `CF-Connecting-IP` разные → лимитер независим; (6) `/api/auth/me` содержит `email_verified`.

### Завершение волны 1
`npm run docs:assistant` → `docs:assistant:check` → `node _t_assistant_kb_audit.js` → code-review (L2) → security-review (L3) по треку 1A → коммиты: `feat(security): real client IP + per-route limiters`, `feat(security): antibot middleware (turnstile/honeypot/timing)`, `refactor(auth): issueSession helper + email_verified schema`, `feat(frontend): turnstile + honeypot on public forms`, `docs: antibot runbook, KB, env`.

---

## 3. Волна 2 — верификация email + вход по коду (план: фазы 2, 2b)

Треки 2A и 2B независимы по файлам (A1, A3). Оба используют `issueSession`, `getClientIp`, схему из волны 1.

### Трек 2A — backend верификации — **L3**

Файлы: `src/backend/src/routes/emailVerification.js` (новый), `src/backend/src/middleware/auth.js` (только добавление `requireVerifiedEmail`), `src/backend/src/index.js` (монтирование + гейт), `src/backend/src/routes/auth.js` (`/register`: письмо), `src/backend/src/routes/webhooks.js`, `src/backend/src/services/scheduler.js`, `src/backend/src/services/emailService.js` (только вызов; шаблон — трек 2C).

1. **`/register`**: вместо `sendWelcomeEmail` → создать токен (32 байта hex, хранить sha256), `verification_expires_at = now + EMAIL_VERIFICATION_TTL_H`, `sendVerificationEmail(email, token, locale, { trialDays })`. Для `intended_plan='confirm'` — тоже (Stripe подтвердит раньше — п.4).
2. **`routes/emailVerification.js`** (монтируется `app.use('/api/auth', emailVerificationRoutes)` до `authRoutes`):
   - `GET /verify-email?token=` — публичный; хэш → пользователь; просрочен → redirect `${FRONTEND_URL}/verify-email?status=expired`; ок → `email_verified_at = now`, токен обнулить, audit `email_verified`, **`issueSession`** (человек сразу залогинен) → redirect `/dashboard?verified=1`; уже подтверждён → `/dashboard?verified=already`;
   - `POST /resend-verification` — `authenticate`; лимит 3/час на user (счётчик в `platform_settings`-стиле не нужен — считать по `audit_logs` за час: `action='verification_resent'`); новый токен, письмо; `200 { message }`;
   - `POST /change-unverified-email` — `authenticate`, только если `email_verified_at IS NULL`; `{ email, password }` — проверить пароль, уникальность, сменить email, новый токен, письмо. (Позволяет исправить опечатку без поддержки.)
3. **Гейт** `requireVerifiedEmail` в `middleware/auth.js`: если `EMAIL_VERIFICATION_GATE !== 'false'` и `req.user.role === 'therapist'` и `!req.user.emailVerified` → `403 { error: t('auth.emailNotVerified'), code: 'EMAIL_NOT_VERIFIED' }`. Superadmin — всегда пропуск.

   | Гейтим (в `index.js` после `requireActiveSubscription`, или на роуте) | Не гейтим |
   |---|---|
   | `POST /api/clients/solo`, `POST /api/clients/:id/import`, `POST /api/clients/import-bulk`, `POST /api/clients/link` | `GET /api/clients*` |
   | `POST /api/invite-code/regenerate`, `GET /api/invite-code/link` | `GET /api/invite-code/` (показать код можно) |
   | `POST /api/sessions` (upload), `/:id/transcribe`, `/:id/summarize`, `/:id/transcribe-voice-note` | `GET /api/sessions*` |
   | `POST /api/assistant/chat` (AI для залогиненных) | `/api/assistant/public-chat` (свой лимит) |
   | `GET */export` (`clients/:id/diary/export`, analytics export) | `/api/settings/*`, `/api/subscription/*`, `/api/exercises` (чтение), `/api/auth/*` |

   Реализация: обёртка `app.use('/api/clients', requireActiveSubscription, gateMutations(requireVerifiedEmail), clientsRoutes)`, где `gateMutations` применяет middleware только к `POST/PUT/DELETE` и к путям с `/export`. Для `/api/assistant/chat` — прямо на роуте.
4. **Stripe** `webhooks.js` `checkout.session.completed` (добавить case): по `customer_email`/`client_reference_id` → `email_verified_at = COALESCE(email_verified_at, now)`.
5. **Cron** `scheduler.js` Job 11 `unverified-cleanup` `30 3 * * *`: `DELETE` пользователей `role='therapist' AND email_verified_at IS NULL AND created_at < now - UNVERIFIED_CLEANUP_DAYS AND нет клиентов AND нет stripe_customer_id AND нет audit_logs action IN ('login','login_code_success')` — вместе с их `subscriptions`, `login_codes`; запись в `audit_logs` (actor NULL, action `unverified_user_purged`, details email). Job 12 `login-codes-cleanup` `15 2 * * *` (в существующий блок 2:15): `DELETE FROM login_codes WHERE created_at < now - 1 day`.
6. **Admin** `routes/admin.js` `GET /therapists`: добавить в выдачу `email_verified_at`, `suspicious`; query `?verified=0|1`; `POST /therapists/:id/verify-email` (ручное подтверждение, audit).

### Трек 2B — backend вход по коду — **L3**

Файлы: `src/backend/src/routes/loginCode.js` (новый), `src/backend/src/index.js` (монтирование `app.use('/api/auth/login-code', loginCodeLimiter, loginCodeRoutes)` **до** `app.use('/api/auth', …)`), `src/backend/src/utils/loginCodes.js` (новый: генерация/хэш/проверка).

1. `utils/loginCodes.js`: `generate()` → `{ code: '123456', linkToken: hex64 }`; `hash(value)` = sha256(value + PEPPER); `createFor(userId, ip)` (старые `used=1`, insert); `findActive(userId)`; `verifyCode(userId, code)` → `{ ok, reason: 'expired'|'attempts'|'mismatch'|'none' }` (инкремент attempts на mismatch, `used=1` при ok или attempts≥5); `verifyLink(linkToken)`.
2. `POST /request` `{ email, turnstile_token }` — `antibot({ turnstile: true, honeypot: false })`; старт таймера; email нормализовать; найти пользователя `role IN ('therapist','superadmin') AND blocked_at IS NULL`; per-email лимит 3/15 мин (по `login_codes.created_at`); если всё ок — `createFor`, `sendLoginCodeEmail(email, { code, linkUrl, ttlMin }, locale)`; audit `login_code_requested`; **всегда** дождаться min 300 мс → `200 { message: t('auth.codeSentIfExists') }`.
3. `POST /verify` `{ email, code }` — код `^\d{6}$`; пользователь; `verifyCode`; fail → `401 { error: t('auth.codeInvalid'), code: 'CODE_INVALID' }` (одинаковый для всех причин, кроме `attempts` → `code: 'CODE_LOCKED'` — можно сказать честно, это не утечка); ok → `email_verified_at = COALESCE(…, now)`, audit `login_code_success`, `issueSession` → `200 { message, user, token }` (тот же формат, что `/login`). Роль `client` → 403 как в `/login`.
4. `GET /link?token=` — `verifyLink`; ok → сессия, redirect `${FRONTEND_URL}/dashboard`; fail → redirect `${FRONTEND_URL}/login?code_error=expired`.
5. Логи: `[LOGIN_CODE] requested/verified/failed user=… ip=…` без самого кода.

### Трек 2C — email-шаблоны, i18n — **L1**

Файлы: `src/backend/src/services/emailService.js` (два шаблона + два `send*` по образцу `leadVerificationTemplate`/`passwordResetTemplate`), i18n backend+frontend ×4.

1. `email_verification` template: приветствие + trialDays + кнопка «Подтвердить email» (`verifyUrl`) + «ссылка действует 48 ч». `sendVerificationEmail(email, token, locale, { trialDays })`.
2. `login_code` template: тема `«Ваш код входа: 123456»`, код крупно (моноширинный, letter-spacing), «действует 10 минут», кнопка «Войти» (`linkUrl`), «если это не вы — проигнорируйте». `sendLoginCodeEmail(email, { code, linkUrl, ttlMin }, locale)`.
3. `sendEmail` switch: добавить оба case.
4. i18n backend: `auth.emailNotVerified`, `auth.codeSentIfExists`, `auth.codeInvalid`, `auth.codeLocked`, `auth.verificationResent`, `auth.resendLimit`. Frontend: `auth.loginWithCode`, `auth.loginWithPassword`, `auth.getCode`, `auth.enterCode`, `auth.codeSentTo`, `auth.resendCode`, `auth.resendIn`, `auth.changeEmail`, `auth.codeInvalid`, `auth.codeLocked`, `auth.codeExpiredLink`, `verifyEmail.bannerTitle`, `verifyEmail.bannerText`, `verifyEmail.resend`, `verifyEmail.changeEmail`, `verifyEmail.sent`, `verifyEmail.gateToast`, `verifyEmail.statusExpired`, `verifyEmail.statusAlready`, `verifyEmail.statusSuccess`. Четыре языка.

### Трек 2D — frontend — **L2**

Файлы: `src/frontend/src/pages/Login.jsx`, `src/frontend/src/components/auth/CodeInput.jsx` (новый), `src/frontend/src/components/EmailVerificationBanner.jsx` (новый), `src/frontend/src/components/AppLayout.jsx` (одна строка после `TimezoneDetectionBanner`), `src/frontend/src/pages/VerifyEmail.jsx` (новый, по образцу `VerifyLead.jsx`), `src/frontend/src/App.jsx` (роут `/verify-email`), `src/frontend/src/utils/api.js` или общий fetch-обработчик — перехват `EMAIL_NOT_VERIFIED`.

1. **`Login.jsx`** — состояние `mode: 'email' | 'code' | 'password'`:
   - `email`: поле email, кнопка «Получить код» (primary), ссылка «Войти с паролем». Submit → `POST /api/auth/login-code/request` (CSRF, `turnstile_token`) → `mode='code'` независимо от результата (ответ всегда 200);
   - `code`: текст «Код отправлен на {email}», `CodeInput` (6 ячеек, автофокус, paste, автосабмит на 6-й), «Отправить ещё раз» с таймером 60 с, «Изменить email» (→ `mode='email'`), ссылка «Войти с паролем». Verify → `POST /api/auth/login-code/verify` → тот же post-login код, что у пароля (вынести в `handleLoginSuccess(data)`: localStorage, профиль/язык, redirect по роли);
   - `password`: текущая форма + ссылка «Войти по коду». Query `?code_error=expired` → сообщение `auth.codeExpiredLink` в режиме `email`.
2. **`CodeInput`**: props `value, onChange, onComplete, disabled, error`; `inputMode="numeric"`, `autoComplete="one-time-code"`, backspace переходит назад, paste 6 цифр раскладывает по ячейкам.
3. **`EmailVerificationBanner`**: на mount `GET /api/auth/me`; если `email_verified === false` — жёлтый баннер с email, кнопки «Отправить ещё раз» (→ `/resend-verification`, после успеха текст `verifyEmail.sent`, кнопка disabled 60 с) и «Изменить адрес» (модалка: новый email + пароль → `/change-unverified-email`). После `?verified=1` в URL — зелёный тост и баннер не показывать. Слушать `focus` окна → повторный `/me` (человек кликнул письмо в другой вкладке).
4. **Перехват гейта**: в общем месте fetch (если есть `api.js`/interceptor; иначе — в `AppLayout` через `window.addEventListener('prtop:email-not-verified')` из `apiFetch`) — при `403 code=EMAIL_NOT_VERIFIED` показывать тост `verifyEmail.gateToast` и скроллить к баннеру.
5. **`VerifyEmail.jsx`**: статусы `expired` (кнопка «Войти, чтобы отправить заново»), `error`; `success`/`already` на эту страницу не приходят (редирект в дашборд).

### Трек 2E — тесты — **L2**

`src/backend/test_login_code.js`: request для несуществующего email → 200 и ≥300 мс; для существующего → 200; чтение кода из БД невозможно (хэш) → тест берёт код из лога? Нет — в `NODE_ENV!=='production'` `POST /request` возвращает `dev_code` в ответе (только dev, флаг `LOGIN_CODE_DEV_ECHO=true`); verify неверный ×5 → `CODE_LOCKED`; verify верный → token, `/me` `email_verified=true`; повторный verify тем же кодом → 401; link → 302 на `/dashboard`.
`src/backend/test_email_verification.js`: register → `/me` `email_verified=false`; `POST /api/clients/solo` → 403 `EMAIL_NOT_VERIFIED`; `GET /api/clients` → 200; `verify-email` с dev-echo токеном → 302 `/dashboard?verified=1`; после — `/clients/solo` 201; resend 4-й раз за час → 429/400 `resendLimit`.

### Трек 2F — KB и FAQ — **L1** (после 2A/2B, чтобы описывать факт)

Файлы: `docs/assistant-kb/registration-and-onboarding.md` (раздел «Подтверждение email»: что заблокировано — перечислить по таблице гейта, как переотправить, как сменить адрес), `docs/assistant-kb/login-with-email-code.md` (новый, ≥800 слов: intro → prerequisites → шаги → edge cases (код не пришёл, 5 неверных, ссылка просрочена, adblock/Turnstile) → troubleshooting → FAQ), `docs/assistant-kb/faq-seed.json` (+ «Не пришло письмо подтверждения», «Не пришёл код входа», «Могу ли войти без пароля»). Без tier-gating формулировок. `npm run docs:assistant` → `check` → audit.

### Завершение волны 2
Тесты 2E + все прежние → code-review L2 → security-review L3 (2A, 2B) → коммиты по трекам.

---

## 4. Волна 3 — онбординг, метрики, админ, уборка (план: фазы 3, 4)

| Трек | Уровень | Содержание |
|---|---|---|
| 3A события | L1 | `trackUmamiEvent`: `register_submitted`, `register_turnstile_failed`, `login_code_requested`, `login_code_success`, `email_verified` (по `?verified=1`), `first_client_added` (в клиенте после 201 на `/clients/solo`, если список был пуст). Backend: `[ANTIBOT]` уже есть; добавить `register_bot_rejected` в `audit_logs` (actor NULL, details reason) для админ-статистики. |
| 3B админ-виджет | L2 | `AdminDashboard.jsx` + `routes/admin.js GET /stats/funnel?days=7|30`: регистрации → подтверждения → первый клиент; отклонённые ботом по причинам. `AdminTherapists.jsx`: фильтр «не подтверждён», бейдж `suspicious`, кнопки «Подтвердить email» / «Удалить». |
| 3C emailHygiene | L2 | `src/backend/src/utils/emailHygiene.js`: `isDisposable(domain)` по пакету `disposable-email-domains` (добавить в `package.json`), `hasMx(domain)` (`dns.promises.resolveMx`, таймаут 2 с, LRU-кэш 1 ч, ошибка → `true`), `isRoleAddress(local)`. В `/register`: disposable → `400 { error: t('auth.emailDisposable') }`; нет MX → тот же 400; role-address → `suspicious=1`. Тест `test_email_hygiene.js`. |
| 3D уборка | L3 | Убрать временный `[IP]` лог; ручной просмотр users id 22–39 в админке (пользователь решает); проверить на проде `[ANTIBOT]` и `email_verified` конверсию за неделю; при <60% — ослабить (например, отложить гейт на 72 ч: `EMAIL_VERIFICATION_GRACE_H`). |
| 3E docs | L1 | KB: раздел про недопустимые адреса (одноразовые домены); runbook: метрики и пороги. `docs:assistant` + audit. |

Отложено (не в этих волнах): регистрация без пароля; magic-link при регистрации (уже покрыто ссылкой в письме верификации, которая логинит).

---

## 5. Порядок запуска и контроль

1. **Волна 1**: параллельно 1A (L3), 1B (L2), 1C (L1); затем 1D (L2, после 1A); затем review/security/commit. Оценка: 1 рабочий день агентов.
2. **Фаза 0 Cloudflare** — делает владелец вручную по плану §3 (dashboard). Ключи Turnstile → Dokploy env **до** деплоя волны 1, иначе виджет не рендерится (это безопасно — проверка просто выключена).
3. **Волна 2**: параллельно 2A, 2B (L3), 2C (L1), 2D (L2); затем 2E, 2F; review/security/commit. Оценка: 2 дня.
4. **Деплой волны 1 и 2 раздельно**, между ними — 2–3 дня наблюдения `[ANTIBOT]`.
5. **Волна 3** после недели прод-данных.

Для каждого агентского промпта: ссылка на этот файл + номер трека, список файлов трека (не выходить за него), запрет менять чужие треки, обязательные тест-команды, формат отчёта «что сделал / что не сделал / что проверил».
