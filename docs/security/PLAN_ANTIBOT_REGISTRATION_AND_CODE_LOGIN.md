# План: защита регистрации от ботов + вход по коду из письма

Дата: 2026-09-28. Статус: согласован, к реализации. Ветка: `dev` (master не трогаем).

## 1. Проблема

### Что наблюдали (backend-логи прод, 26–28.09.2026)

18 регистраций за 2,3 суток (users id 22–39), ни одного имени. Подозрительные:
- `leopold695.heidenreich_1968@sigismail.com` и `justin221reichel_2009@sigismail.com` — с разницей 2 минуты, шаблон «имя+цифры_год» на одноразовом домене;
- `vip-support-team@airmedplus.de` — служебный адрес;
- `conchair@animestl.net`.

Остальные 14 — gmail/yahoo/hotmail/comcast/`mcmaster.ca`/`curry.edu`/`nifty.com` (США, Канада, Япония). Могут быть как боты с реальными адресами, так и живые люди из рекламы — без IP/UA и поведения после регистрации не различить.

Не проверено (нужны права на чтение прод-сервера `lead-parser`): nginx access-log с IP/User-Agent на `POST /api/auth/register`, поля `utm_source`/`timezone`/`language`/`last_login`/число клиентов у новых аккаунтов, исходы welcome-писем (bounce).

### Почему нет имён

На странице `/register` поля имени нет — форма запрашивает только email и пароль (`src/frontend/src/pages/Register.jsx`). Бэкенд поле `name` принимает, но шлёт его только `ConfirmSignupForm`. Отсутствие имён само по себе не признак ботов.

### Почему боты проходят (`src/backend/src/routes/auth.js` `/register`, `src/backend/src/index.js` лимитеры)

1. Нет CAPTCHA, honeypot, проверки времени заполнения.
2. Нет подтверждения email: аккаунт активен сразу — JWT, триал, welcome-письмо. Любой может зарегистрировать чужой адрес, наш SMTP разошлёт письма → репутация отправителя.
3. Лимит слабый: 50 запросов / 15 мин на IP, общий для логина и регистрации.
4. **Вероятный баг определения IP.** Цепочка Cloudflare → Traefik → nginx → backend; nginx добавляет `$proxy_add_x_forwarded_for` (`src/frontend/nginx.conf`), Express стоит `trust proxy = 1`. Скорее всего `req.ip` = адрес Traefik для всех запросов, т.е. лимитер **общий на весь сайт** (50 auth-запросов/15 мин на всех): ботов не останавливает, живых людей в пике может блокировать. Проверить логированием `req.ip`.
5. Нет фильтра одноразовых доменов и MX-проверки.

## 2. Принципы

- Человек не должен заметить защиту: **Turnstile в invisible-режиме**, никаких картинок.
- **Мягкая верификация email**: в дашборд пускаем сразу, подтверждаем изнутри; блокируются только действия, где бот приносит вред.
- **Одно письмо вместо двух**: welcome заменяется на «подтвердите email + добро пожаловать».
- **Всё за флагами env**: `TURNSTILE_SECRET` не задан → проверка пропускается, dev и тесты не ломаются.
- **Вход по коду** — альтернатива паролю, не замена. Успешный вход по коду доказывает владение почтой и закрывает верификацию.
- Не хранить Cloudflare-токен в чате/репо. Всё нужное делается в дашборде; при автоматизации — токен в Dokploy env.

## 3. Фазы

### Фаза 0 — сегодня, без кода (Cloudflare dashboard, ~15 мин)

1. **Security → WAF → Rate limiting rules**: `POST` на `pr-top.com/api/auth/register*` (покрывает `register-lead`) — 5 запросов / 10 мин с IP → Block на 1 час. На Free доступно 1 правило — это оно.
2. **Security → Bots — Bot Fight Mode НЕ включать.** Он челленджит любой автоматизированный трафик на весь сайт и может резать AI-краулеры (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot, Bingbot), а мы хотим, чтобы нейросети индексировали сайт и отдавали структурную информацию. Там же проверить, что переключатель **«Block AI bots / AI Scrapers and Crawlers» выключен**. Вся защита от ботов — только на POST-эндпоинтах регистрации (правила 1 и 3 + бэкенд), GET-страницы остаются открытыми.
3. **Security → WAF → Custom rule**: `URI path starts with /register` AND `not cf.client.bot` AND (`User-Agent contains "python-requests"|"curl"|"Go-http-client"` или пустой UA) → Managed Challenge.
4. **Turnstile → Add widget**: домен `pr-top.com`, режим **Invisible**. Site key → frontend build arg `VITE_TURNSTILE_SITE_KEY`, Secret → backend env `TURNSTILE_SECRET` (Dokploy). До выката кода ключи просто лежат.
5. **Hetzner firewall**: ограничить 80/443 на origin только с IP-диапазонов Cloudflare (если все сайты хоста за CF); иначе включить Authenticated Origin Pulls для `pr-top.com` в Cloudflare. Причина: `CF-Connecting-IP` заголовок надёжен только если origin недостижим напрямую.

### Фаза 1 — быстрые фиксы бэкенда (~1 день)

**1.1 Определение IP.** nginx: `proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;`. Express: `keyGenerator` лимитеров читает `CF-Connecting-IP` с fallback на `req.ip`. Проверка: временно логировать `req.ip` на `/register`.

**1.2 Отдельный лимитер регистрации**: `/api/auth/register`, `/register-lead` — 5/час на IP, независимо от логина.

**1.3 Turnstile server-side.** Middleware `verifyTurnstile`: `turnstile_token` из body → POST `https://challenges.cloudflare.com/turnstile/v0/siteverify`; провал → 403 с i18n-ошибкой. Вешается на `/register`, `/register-lead`, `/register-viewer`, `/forgot-password`, `/login-code/request`, `/api/assistant/public-chat`. `TURNSTILE_SECRET` пуст → `next()`.

**1.4 Honeypot + timing.** Скрытое поле `website` (`position:absolute; left:-9999px`, не `display:none`) и `form_started_at`. Заполнено / <3 с → **200 с фейковым успехом**, ничего не создаём, лог `[ANTIBOT]`.

**1.5 Фильтр email.** Пакет `disposable-email-domains` (обновляемый), MX-lookup с кэшем (таймаут 2 с; ошибка DNS → пропускаем, не блокируем). Ролевые адреса (`support@`, `vip-*`, `noreply@`, `admin@`) не блокировать — флаг `suspicious` для админки.

**1.6 Frontend.** Turnstile-виджет в `Register.jsx`, `ConfirmSignupForm.jsx`, форме лида в `PublicAssistantChatPanel.jsx`. CSP на фронте нет (helmet только на API) — скрипт `challenges.cloudflare.com` загрузится без правок.

### Фаза 2 — мягкая верификация email (~2–3 дня)

**2.1 Схема.** `users.email_verified_at TEXT`, `users.verification_token`, `users.verification_expires_at` (как в `leads`, `src/backend/src/db/connection.js`). Миграция: существующим пользователям с логинами / клиентами / Stripe проставить `email_verified_at = created_at`.

**2.2 Регистрация.** Аккаунт, триал, JWT — как сейчас; вместо `sendWelcomeEmail` одно письмо «Подтвердите email» с приветствием и ссылкой (токен 48 ч). `GET /api/auth/verify-email?token=` → `email_verified_at`, редирект `/dashboard?verified=1`. Переиспользовать паттерн `verify-lead` и страницу `VerifyLead.jsx`.

**2.3 Гейт.** Middleware `requireVerifiedEmail` рядом с `requireRole` (`src/backend/src/middleware/auth.js`); `authenticate` добавляет `req.user.emailVerified`. Гейтим: создание клиента, инвайт-коды и deep links, `/import-bulk`, загрузку сессий, AI-вызовы, экспорт. **Не** гейтим: дашборд, профиль, библиотеку упражнений, подписку. Ответ 403 `EMAIL_NOT_VERIFIED` → фронт показывает баннер.

**2.4 Дашборд.** Баннер «Подтвердите email — письмо отправлено на X. [Отправить ещё раз] [Изменить адрес]». Resend — 3/час.

**2.5 Confirm-флоу (Stripe).** Webhook `checkout.session.completed` ставит `email_verified_at`, если пусто.

**2.6 Очистка.** Cron `30 3 * * *` (`src/backend/src/services/scheduler.js`): неподтверждённые аккаунты старше 7 дней без единого логина и клиентов → удалить с записью в `audit_logs`.

**2.7 Админка** `/admin/therapists`: фильтр «не подтверждён», бейдж `suspicious`, «подтвердить вручную» / «удалить». Текущие 18 аккаунтов чистить выборочно **после ручного просмотра**, не автоматически.

### Фаза 2b — вход по коду из письма (~1,5–2 дня)

**Как это работает для пользователя**
1. На `/login` вводит email → «Получить код». Пароль не спрашиваем.
2. Если email зарегистрирован — уходит письмо с 6-значным кодом **и** кнопкой «Войти» (ссылка с длинным токеном). На экране всегда одинаково: «Если адрес зарегистрирован, код отправлен» — перебор базы невозможен.
3. Вводит код (или нажимает кнопку в письме) → обычная сессия (JWT + cookie).
4. Пароль остаётся: «Войти с паролем» — второстепенная ссылка. Сброс пароля остаётся.

Решения: **код и ссылка — оба**. Экран `/login`: email → «Получить код» (основная кнопка) + ссылка «Войти с паролем».

**Бэкенд**
- Таблица `login_codes` (по образцу `password_reset_tokens`): `user_id`, `code_hash` (SHA-256 с солью или bcrypt, открытым текстом не хранить), `link_token` (для кнопки в письме), `expires_at` (10 мин), `attempts` (макс 5), `used`, `created_at`, `ip`. Индексы по `user_id`, `link_token`, `expires_at`.
- `POST /api/auth/login-code/request` `{ email, turnstile_token }` — всегда 200. Если пользователь есть и не `blocked_at`: старые коды → `used`, новый код `crypto.randomInt(100000, 999999)`, хэш, запись, письмо. Лимиты: 3 кода / 15 мин на email, 10 / час на IP. Turnstile. Для несуществующего email — искусственная задержка ~ bcrypt-время (одинаковый тайминг). Audit `login_code_requested`.
- `POST /api/auth/login-code/verify` `{ email, code }` — последний неиспользованный код пользователя; срок и `attempts < 5`; сравнение хэша. Неверный → `attempts++`, общая ошибка «Неверный или просроченный код»; после 5 — код сгорает. Верный → `used = 1`, `email_verified_at` (если пусто), сессия. Код привязан к email (пара email+code). Audit `login_code_success` / `login_code_failed`.
- `GET /api/auth/login-code/link?token=` — та же запись по `link_token`; успех → сессия + редирект `/dashboard`; ошибка → `/login?code_error=expired`.
- Helper `issueSession(res, user)` — вынести выдачу JWT+cookie из `/login` и `/register`, использовать во всех трёх местах.
- Письмо `login_code` в `emailService.js`: тема «Ваш код входа: 123456», крупный код, срок 10 минут, кнопка «Войти», «если это не вы — проигнорируйте». EN/RU/ES/UK. Встроенный лимит emailService (10/мин на адрес) остаётся страховкой.
- Cron 02:15: удалять `login_codes` старше суток.
- Логин по паролю не трогаем.

**Фронтенд** (`Login.jsx`) — три состояния:
1. Email + «Получить код» + «Войти с паролем».
2. Ввод кода: 6 ячеек с автофокусом, вставка из буфера, автоотправка на 6-й цифре, таймер «отправить ещё раз» (60 с), «изменить email».
3. Режим пароля — текущая форма.
Ошибки через i18n: неверный / просрочен / слишком много попыток / лимит запросов.

**Безопасность**: код только хэшированный; 6 цифр × 5 попыток × 10 мин — перебор невозможен; одинаковый ответ и тайминг для существующего и несуществующего email; заблокированному коды не шлём, ответ тот же 200.

**Отложено**: регистрация без пароля («email → код → дашборд», пароль опционален в настройках) — после того как вход по коду приживётся.

### Фаза 3 — онбординг легче (~1–2 дня)

- Имя на `/register` — необязательное, либо вопрос на первом экране дашборда («Как к вам обращаться?»).
- Magic link по сути реализуется в 2b (кнопка в письме кода).
- Предзаполнение подтверждения timezone.

### Фаза 4 — измерение (параллельно с 2)

- Umami-события: `register_submitted`, `register_bot_rejected` (причина: turnstile / honeypot / disposable / ratelimit), `email_verified`, `login_code_requested`, `login_code_success`, `first_client_added`.
- Админ-виджет: регистрации → подтверждения → первый клиент за 7/30 дней. Подтверждает <60% → верификация мешает людям, разбираться.
- Лог `[ANTIBOT]` смотреть неделю после деплоя: если режет настоящий gmail с человеческим таймингом — ослаблять.

## 4. Порядок и оценка

| Фаза | Срок | Эффект |
|---|---|---|
| 0 Cloudflare | сегодня, 15 мин | режет скрипты сразу |
| 1 бэкенд | 1 день | IP-фикс + Turnstile + honeypot ≈ 95% ботов |
| 2 верификация | 2–3 дня | остаток + защита SMTP-репутации |
| 2b вход по коду | 1,5–2 дня | забытые пароли, верификация «бесплатно» |
| 3 онбординг | 1–2 дня | компенсирует трение |
| 4 метрики | параллельно | контроль, что людей не режем |

Вариант ускорения: 2b можно делать **до** 2 — вход по коду сам верифицирует всех, кто им воспользуется.

## 5. Definition of Done (по CLAUDE.md)

Каждая фаза:
- обновляет `docs/assistant-kb/registration-and-onboarding.md` (верификация, что заблокировано до подтверждения, resend) и добавляет страницу «Вход по коду из письма» (как получить, срок, если не пришло, лимиты);
- Q&A в seeded FAQ: «не пришло письмо подтверждения», «не пришёл код входа»;
- `npm run docs:assistant`, `node _t_assistant_kb_audit.js`;
- переводы EN/RU/ES/UK одновременно во все четыре файла (баннер, ошибки Turnstile и кода, письма).

## 6. Открытые вопросы

- Подтвердить баг с IP логированием `req.ip` до фикса 1.1.
- Получить с прода IP/UA регистраций и исходы welcome-писем для 18 аккаунтов — решить, кого удалять.
- Дизайн экрана ввода кода (6 ячеек) — согласовать с текущим стилем `/login`.
