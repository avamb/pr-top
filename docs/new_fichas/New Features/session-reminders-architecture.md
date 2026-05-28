# Architecture Proposal: Session Reminder & No-show Prevention Feature

**Internal code name:** `Appointment Confirmations`
**Status:** Draft — architectural research only (no implementation yet)
**Author:** Project assistant (Hermes follow-up)
**Created:** 2026-05-26
**Related ADRs:** [0002-zoom-meet-integration.md](../../decisions/0002-zoom-meet-integration.md) — confirms PR-TOP is a post-hoc record-keeping system, not a booking system. This proposal extends the model into the *pre-session* space for the first time.

---

## 0. TL;DR

PR-TOP today is a **between-session** assistant. We propose adding a **before-session** layer — a soft, ethical *Session Reminder & Attendance Assistant* — to reduce no-shows for therapists, coaches, and helping practitioners.

The codebase is **surprisingly close** to being ready:

- `sessions.scheduled_at`, `users.timezone`, `users.reminders_enabled` (tri-state), `audit_logs` deduplication pattern, `node-cron` scheduler, `telegramNotify`, Telegram inline keyboards (`callback_query`), and 4-language i18n already exist.
- Notably missing: a cancellation/confirmation **status machine** on sessions, a **reminder schedule policy** model, a **reschedule** endpoint, and per-tier feature gating for reminders.

**MVP estimate:** 1 small DB migration + 1 new scheduler job + 1 bot callback handler + 3 new API endpoints + 1 settings panel + **1 standalone landing page with its own registration flow**. ~2 weeks of focused work.

**Business framing (decided):**
- Standalone **entry-level "Confirm" plan** (≈ $9/mo).
- Acquired *only* via a dedicated landing page (`/confirm` or similar) — no menu, no sidebar, full-funnel page that goes straight from value-prop → signup → Stripe.
- For Basic / Pro / Premium therapists, the feature is **included by default** at no extra charge.
- Email notifications are **always on** (Telegram + email for every client who has both); no channel toggle in MVP.

---

## 1. Current Architecture Summary

### 1.1 Layout
- **Backend** — Node.js + Express, `better-sqlite3`, single `connection.js` (1864 lines) holding the entire schema as `CREATE TABLE IF NOT EXISTS` + idempotent `ALTER TABLE … ADD COLUMN` migrations (numbered T-01 … T-26).
- **Frontend** — React SPA (Vite), Zustand, Tailwind, `react-i18next` (EN/RU/ES/UK).
- **Bot** — `node-telegram-bot-api` long-polling process; talks to backend via authenticated REST (`x-bot-api-key`). Backend → Telegram is via direct `fetch()` to Telegram Bot API in `utils/telegramNotify.js`.
- **Scheduler** — `services/scheduler.js`: 6 in-process `node-cron` jobs (trial expiry, downgrade, expiry warning, diary reminder, CSRF cleanup, daily backup).
- **Realtime** — `services/websocketService.js` emits to therapist sockets (`emitSosAlert`, `emitNewDiaryEntry`, etc.). **Not used by scheduler today.**
- **Email** — `services/emailService.js`: 7 fixed templates, in-memory rate limit (10/min/recipient), no generic "send any email" endpoint.
- **AI** — multi-provider (OpenAI / Anthropic / Gemini / OpenRouter), used for summarisation, transcription, NL queries, assistant chat.

### 1.2 Data model (relevant subset)
| Table | Relevant columns |
|---|---|
| `users` | `id, role (therapist\|client\|superadmin\|viewer), therapist_id FK, telegram_id, email, language, timezone, blocked_at, consent_therapist_access, consent_version, reminders_enabled_default (therapist), reminders_enabled (client tri-state), escalation_preferences JSON` |
| `sessions` | `id, therapist_id, client_id, scheduled_at TEXT, title, status TEXT (free-form after T-19), recording_mode, post_session_notes_encrypted, inquiry_id, created_at` |
| `subscriptions` | `therapist_id, plan, status, current_period_end, trial_ends_at, pending_plan, stripe_*` |
| `platform_settings` | k/v overrides for plan limits and prices (admin-editable) |
| `audit_logs` | `actor_id, action, target_type, target_id, details_encrypted, ip_address, created_at` — universal idempotency ledger |

### 1.3 Things that already work in our favour
- Multi-tenancy is enforced by `therapist_id` FK on every domain table and by `verifyClientConsent()` middleware (`utils/consentCheck.js:13–54`).
- Tri-state per-client reminder toggle (`reminders_enabled IS NULL → inherit therapist default`) is already shipped (T-16).
- Audit-log-as-dedup ledger pattern is established (`scheduler.js:198–208`, `:290–300`).
- Bot already handles `callback_query` flows (consent, assignments, exercise start, timezone selection) — we have the right primitives for Confirm / Reschedule / Cancel buttons.

### 1.4 Things that are missing / weak
- **No status enum for sessions** (cancelled / no_show / confirmed do not exist; T-19 relaxed the CHECK constraint specifically to let us extend it).
- **No reschedule endpoint** — only PATCH title/meeting_date/inquiry_id and DELETE.
- **Scheduler is server-UTC only** — none of the cron jobs honour `users.timezone` today.
- **No retry / DLQ** in scheduler; outbound message failures are silently logged.
- **No working_hours / availability** model for therapists.
- **No reusable "outbox" for scheduled messages**: each job re-queries the DB at fire time. Fine at our scale, but the planned new job must follow the same pattern to stay consistent.

---

## 2. Existing Building Blocks We Can Reuse

| Need | Reuse | File:line |
|---|---|---|
| "Send to client at time T" | `telegramNotify.sendMessage()` + scheduler cron | `utils/telegramNotify.js:29–71`, `services/scheduler.js` |
| Per-client opt-in | `users.reminders_enabled` tri-state | `db/connection.js:407–440` |
| Dedup (don't send twice) | Audit-log probe pattern | `services/scheduler.js:198–208, 290–300` |
| Localised templates | `bot/src/i18n.js` (EN/RU/ES/UK) and `emailService.js` | `bot/src/i18n.js`, `services/emailService.js:143–635` |
| Inline buttons (Confirm/Cancel/Reschedule) | `callback_query` handler | `bot/src/index.js:1020+` |
| Client identity ↔ Telegram | Invite-code / deep-link flow + `users.telegram_id` | `bot/src/index.js:531–594, 634–655` |
| Real-time therapist push | `websocketService.emitToTherapist()` | `services/websocketService.js:119–150` |
| Consent gating | `verifyClientConsent()` | `utils/consentCheck.js:13–54` |
| Plan gating | `checkClientLimit()` style pattern | `utils/planLimits.js:67–100` |
| Schema migration | `ALTER TABLE … ADD COLUMN` in try/catch + `connection.js` T-XX comment | `db/connection.js:407–440, 1284–1349` |
| Calendar UI primitive | `SessionCalendar.jsx` | `frontend/src/components/SessionCalendar.jsx` |
| Settings panel UX | `pages/Settings.jsx` | `frontend/src/pages/Settings.jsx` |

---

## 3. Product Goal

> Help specialists reduce no-shows **without** making the client feel policed, fined, or shamed.

Concretely:
1. Send a small number of gentle, well-timed reminders.
2. Give the client a one-tap way to **confirm**, **request a reschedule**, or **release the slot**.
3. Make it trivial for the therapist to see *“who hasn’t confirmed tomorrow”* and act on it.
4. When a slot is freed early, help the therapist fill it (manual notice → list of candidates).
5. Track aggregate attendance signals for the **therapist’s** own learning — never the client’s “score”.

### 3.1 Non-goals (MVP)
- ❌ Automated penalties / late fees / deposit holds.
- ❌ Sharing attendance data between therapists or with the platform.
- ❌ Public ratings of clients.
- ❌ Full booking / availability calendar (still post-hoc compatible with existing flow).

### 3.2 Ethical / UX constraints (carried into every name and string)
| ✅ Use | ❌ Avoid |
|---|---|
| "Напоминания о сессии" / "Session reminders" | "No-show penalties" |
| "Подтверждение встречи" / "Confirm meeting" | "Discipline" |
| "Правила переноса и отмены" / "Reschedule & cancellation policy" | "Fines" / "Penalties" |
| "Свободные слоты" / "Open slots" | "Black list" |
| "Загрузка расписания" / "Schedule load" | "Client compliance" |
| Soft, optional, opt-out by default for the client | Mandatory acknowledgements |

---

## 4. Recommended MVP

A single, opinionated path. Therapist sees value in week 1.

### 4.1 MVP scope
1. Therapist sets one **reminder policy** at user level: enabled, tone preset (`neutral` / `warm` / `brief`), and the cancellation/reschedule lead-hours allowed for the client. **Channel and schedule are fixed** in MVP (see #2 below) — no per-therapist customisation of timing/channel to keep the cognitive load minimal.
2. **Fixed wall-clock-anchored schedule** in the client's timezone:
   - **Reminder #1:** at **09:00** local time **on the day before** the session.
   - **Reminder #2:** at **09:00** local time **on the day of** the session, but **no later than `scheduled_at − 2h`** (if 09:00 falls inside the 2h pre-session window, the reminder is sent at `scheduled_at − 2h` instead). If `scheduled_at − 2h` falls inside client quiet hours, the reminder is *skipped* (logged) — never push a reminder into the night.
   - Both reminders go to **both channels** for every client where contact info exists (Telegram if `telegram_id`, email if `email`).
3. Each reminder includes inline buttons (Telegram) and three signed-link buttons (email): **✅ I'll be there** / **🔄 Ask to reschedule** / **🆓 Release this slot**.
4. Client tap → status update (`confirmed` / `reschedule_requested` / `cancelled_by_client`) + dashboard event.
5. Therapist dashboard shows a small **"Upcoming — confirmation status"** widget for next 7 days.
6. If client releases the slot, the session is marked `cancelled_by_client` and a **manual** *"Offer to another client"* action is exposed (no automation in MVP — just opens a list of recent clients with a pre-filled message template).
7. Read-only **monthly stats** for the therapist: confirmed / reschedules / late cancellations / no-shows.
8. **Consent for the new data flow (3C-strict):** existing clients do NOT auto-receive session reminders. The first time a therapist enables the feature for an existing client, the bot sends a single one-shot **opt-in notice** with `[✅ Ok, remind me]` / `[🔕 Don't]` buttons. Silence = treated as *not opted in* (no reminders sent), and the therapist sees the unanswered state in the dashboard with a "Resend / Contact manually" affordance. **New clients** sign their consent during the existing T-18 5-checkbox flow, with a new pre-checked `consent_session_reminders` checkbox.

### 4.2 Explicitly deferred to v2+
- Automatic waitlist matching.
- WhatsApp / SMS channels.
- AI-personalised message tone.
- iCal / Google Calendar 2-way sync.
- Late-cancellation fee integration (Stripe).
- Per-client cancellation policy.

### 4.3 Why this is the right MVP
- Reuses 100% of existing infra: scheduler, telegramNotify, audit-log dedup, callback_query, tri-state opt-in.
- Adds **only one** new table (`session_reminder_dispatches`) and **only three** new columns on `sessions`.
- The therapist sees value before any client interaction (just having the *“who hasn’t confirmed”* widget is worth ~50% of the perceived feature).

---

## 5. Data Model Proposal

> **Principle:** add the minimum required state. Lean on `audit_logs` for history. Don’t create tables we will only fill in v2.

### 5.1 Columns added to existing tables

`sessions` — extend the status machine (T-19 already relaxed the CHECK constraint):

| Column | Type | Notes |
|---|---|---|
| `attendance_status` | `TEXT NULL` | One of: `null` (default), `confirmed`, `reschedule_requested`, `cancelled_by_client`, `cancelled_by_therapist`, `no_show`, `attended`. Separate from `status` (which tracks recording lifecycle) to avoid clobbering existing values. |
| `attendance_updated_at` | `TEXT NULL` | When the attendance_status last changed. |
| `attendance_updated_by` | `INTEGER NULL FK users(id)` | `client_id`, `therapist_id`, or `0` for system. |
| `duration_minutes` | `INTEGER DEFAULT 60` | Needed for reminder offsets and slot release UI. Optional, defaults to 60. |
| `client_timezone_snapshot` | `TEXT NULL` | Snapshot of client tz at scheduling time (handles tz changes between scheduling and reminder send). |

`users` — therapist settings (single JSON to avoid bloat):

| Column | Type | Notes |
|---|---|---|
| `reminder_policy_json` | `TEXT NULL` | Therapist policy: `{enabled, tone:'neutral'|'warm'|'brief', allow_client_reschedule:true, allow_client_release:true, reschedule_lead_hours:24, release_lead_hours:12, custom_templates:{...}}`. NULL → use system default. **Note:** schedule (09:00 + min-2h) and channels (telegram+email both) are NOT in this JSON in MVP — they are system constants. Promoting them to the policy is a v2 change. |

> Why JSON: avoids 10+ new columns; matches existing pattern (`escalation_preferences` is also a JSON column). Validated server-side.

`users` (clients) — **add a separate tri-state for session reminders** (decision 3C-strict; the existing `reminders_enabled` continues to govern *diary* reminders only):

| Column | Type | Notes |
|---|---|---|
| `session_reminders_enabled` | `INTEGER NULL` | Tri-state: `NULL` = not yet asked (needs the one-shot opt-in notice); `1` = client opted in via bot button or registration consent; `0` = client explicitly declined. **Default for new T-18 consent flow:** `1` (pre-checked checkbox). **Default for pre-existing clients at feature launch:** `NULL`. |
| `session_reminders_asked_at` | `TEXT NULL` | When the opt-in notice was first dispatched to this client. NULL = never asked. Used to throttle re-asks and surface "still waiting" state in the dashboard. |

### 5.2 New table

```
session_reminder_dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER NOT NULL REFERENCES users(id),
  offset_minutes INTEGER NOT NULL,           -- 1440, 120, etc.
  scheduled_send_at TEXT NOT NULL,           -- UTC ISO; = session.scheduled_at - offset, applied in client tz
  channel TEXT NOT NULL,                     -- 'telegram'|'email'
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending'|'sent'|'failed'|'skipped'|'superseded'
  sent_at TEXT,
  error TEXT,
  message_ref TEXT,                          -- Telegram message_id, for later edit / cleanup
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_srd_due ON session_reminder_dispatches(status, scheduled_send_at);
CREATE INDEX idx_srd_session ON session_reminder_dispatches(session_id);
CREATE UNIQUE INDEX uq_srd_session_offset_channel
  ON session_reminder_dispatches(session_id, offset_minutes, channel);
```

> **Why this table is worth adding** (instead of pure audit_logs):
> 1. The unique constraint **structurally** prevents duplicate dispatches even under cron overlap or restart.
> 2. Rescheduling a session ↔ mark previous dispatches `superseded` and re-plan — trivial query.
> 3. The therapist UI needs to render *"reminder will go at 09:00 in client’s tz tomorrow"* — much easier with this denormalised row.
> 4. `message_ref` lets us **edit** the original Telegram message after the client clicks (replace buttons with "Got it, see you tomorrow ✅").

### 5.3 Tables explicitly NOT added in MVP
| Considered table | Verdict | Why |
|---|---|---|
| `reminder_rules` | ❌ Skip | Therapist policy fits in `users.reminder_policy_json`. Promote to a table only if we need per-client policies (v2). |
| `attendance_confirmations` | ❌ Skip | The event is the *change in `sessions.attendance_status`*, which is already audit-logged. |
| `cancellation_policies` | ❌ Skip | MVP has one global "soft" policy (request → therapist confirms). |
| `slot_waitlist` / `replacement_candidates` | ❌ Skip — defer to v2 | MVP only exposes a manual "offer to client X" flow. |
| `message_templates` | ❌ Skip — defer to v2 | Therapist can override 3 strings via `reminder_policy_json.custom_templates`. A real templates table comes when we have >5 message types. |
| `no_show_analytics` | ❌ Skip | Aggregate at read time from `sessions.attendance_status`. Materialise only if it becomes slow. |

### 5.4 Migration plan (single T-27 block)
```
T-27: Session reminders (Appointment Confirmations)
  - ALTER TABLE sessions ADD COLUMN attendance_status TEXT
  - ALTER TABLE sessions ADD COLUMN attendance_updated_at TEXT
  - ALTER TABLE sessions ADD COLUMN attendance_updated_by INTEGER
  - ALTER TABLE sessions ADD COLUMN duration_minutes INTEGER DEFAULT 60
  - ALTER TABLE sessions ADD COLUMN client_timezone_snapshot TEXT
  - ALTER TABLE users    ADD COLUMN reminder_policy_json TEXT          -- therapist policy
  - ALTER TABLE users    ADD COLUMN session_reminders_enabled INTEGER  -- client tri-state, default NULL
  - ALTER TABLE users    ADD COLUMN session_reminders_asked_at TEXT
  - CREATE TABLE session_reminder_dispatches (...)
  - CREATE INDEX idx_srd_due, idx_srd_session, uq_srd_session_offset_channel
```
All `ALTER TABLE` statements wrapped in try/catch to keep migrations idempotent (existing pattern, `connection.js:407–440`).
Bump consent disclaimer version (T-18 mechanism): `consent_version` advances; add one line to the disclaimer text in all 4 locales acknowledging session-reminder messages.

---

## 6. API Proposal

All routes follow the existing convention: `therapist_id` derived from JWT, consent verified for any `client_id` parameter.

### 6.1 Therapist-facing

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/settings/reminder-policy` | Read current `reminder_policy_json` (with system defaults filled in). |
| `PUT` | `/api/settings/reminder-policy` | Update policy. Validates `enabled` boolean, `tone` ∈ enum, lead-hour fields are positive integers ≤168. Channel and schedule are NOT accepted here in MVP (system constants). |
| `POST` | `/api/clients/:id/resend-opt-in` | Therapist re-prompts a client whose `session_reminders_enabled IS NULL` and who never answered. Clears `session_reminders_asked_at` so the next `dispatch-opt-in-notices` tick re-sends. Rate-limited to 1 retry per 48h per client. |
| `GET` | `/api/sessions?from=…&to=…&include=attendance` | Extend existing endpoint; include `attendance_status`, `next_reminder_at`, `last_reminder_status`. |
| `POST` | `/api/sessions/:id/reschedule` | Body `{new_scheduled_at, notify_client:bool}`. Marks old dispatches `superseded`, plans new ones. |
| `POST` | `/api/sessions/:id/attendance` | Body `{status, reason?}`. Therapist marks `attended`, `no_show`, `cancelled_by_therapist`. |
| `GET` | `/api/dashboard/attendance-summary?range=month` | Read-only counts: confirmed / pending / cancelled / no-show. |
| `POST` | `/api/sessions/:id/offer-to-client` | Body `{candidate_client_id, message?}`. Sends a manual *"slot just opened"* Telegram message via the bot. No DB binding to the offer — just a logged outreach. |

### 6.2 Bot-facing (backend ↔ bot, same auth header pattern as existing `/api/bot/*`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/bot/session-attendance` | Body `{telegram_user_id, session_id, action: 'confirm'|'request_reschedule'|'release', note?}`. Bot calls this from its `callback_query` handler. |
| `GET` | `/api/bot/upcoming-session/:client_id` | Client can ask the bot "когда наша следующая встреча?" — returns next scheduled session with safe fields. |

### 6.3 Internal (used by scheduler)
Not HTTP — direct DB + service calls inside the Node process:
- `reminderService.planForSession(session)` — recomputes `session_reminder_dispatches` rows for a session (called on create/reschedule/policy change).
- `reminderService.dispatchDue()` — called by the cron job; selects `status='pending' AND scheduled_send_at <= now()` with `LIMIT 200` to bound work; sends; updates status; logs audit.
- `reminderService.markNoShows()` — sweeps sessions whose `scheduled_at + duration_minutes < now - GRACE` and `attendance_status NOT IN ('attended', 'cancelled_*')` → sets `attendance_status='no_show'` *only as a soft default* (therapist can override).

### 6.4 Status state machine (sessions.attendance_status)

```
                 ┌──────────────────────────────────────────────┐
                 │                                              │
                 ▼                                              │
   (null) ──► confirmed ──► attended ◄── therapist marks        │
      │           │                                             │
      │           └──► reschedule_requested ──► (therapist      │
      │                                          updates time)  │
      │                                          → (null) again │
      │                                                         │
      ├──► cancelled_by_client (client tapped Release)          │
      ├──► cancelled_by_therapist                               │
      └──► no_show (auto soft-default; therapist can override) ─┘
```

`null` is *not* a terminal state — it's the “awaiting client action / no reminder yet” state.

---

## 7. Background Jobs / Scheduling

### 7.1 New cron jobs (added to `services/scheduler.js`)

| Job | Cron | What it does |
|---|---|---|
| `plan-reminders` | `*/15 * * * *` (every 15 min) | Find sessions with `scheduled_at` in `[now, now+72h]` that have no plan rows yet → call `planForSession()`. Cheap, idempotent (unique index). Catches new bookings without waiting for a daily sweep. |
| `dispatch-opt-in-notices` | `*/10 * * * *` (every 10 min) | For each future session whose client has `session_reminders_enabled IS NULL` AND `session_reminders_asked_at IS NULL`, send the one-shot opt-in notice (3C-strict). Stamp `session_reminders_asked_at`. Don't queue any actual reminders until the client clicks `Ok`. |
| `dispatch-due-reminders` | `*/5 * * * *` (every 5 min) | `SELECT … WHERE status='pending' AND scheduled_send_at <= now() LIMIT 200`. Send. Update. Granularity is enough to land the day-of "2h-min-lead" reminder within ±5 min of its target. |
| `mark-no-shows` | `0 * * * *` (hourly) | Soft-default no-shows after `scheduled_at + duration + 30min`, only if `attendance_status` is null or `confirmed`. |

> Why 5-minute granularity? It's a sweet spot: short enough that a "2h before" reminder fires within ±5 min, long enough not to thrash the DB. Existing diary reminder runs daily at 10:00 — we're adding 4 new ticks, well within budget.

### 7.2 Wall-clock anchored planning (the core of the new logic)

The existing scheduler ignores timezones. This feature **must not** — it's the whole point.

**`planForSession(session)` algorithm** (only runs if the client has `session_reminders_enabled = 1`):

1. Snapshot the client's timezone into `sessions.client_timezone_snapshot` if not already set.
2. Compute two candidate wall-clock targets in the client's tz, using `Intl.DateTimeFormat` for DST-safe math (the same primitive `clients.js:29–81` already uses):
   - **Target A (day-before):** `(session_local_date − 1 day) @ 09:00`.
   - **Target B (day-of):** `min(session_local_date @ 09:00, session_local_time − 2h)`.
3. Convert each target to UTC → store in `session_reminder_dispatches.scheduled_send_at`.
4. For each target, create up to **two rows** (one per channel) depending on what contact info the client has on file:
   - `channel='telegram'` if `users.telegram_id IS NOT NULL`
   - `channel='email'` if `users.email IS NOT NULL`
5. Skip targets that fall in the **past** (e.g. session booked for tomorrow morning at 08:00 → "day-before 09:00" is already past).
6. Skip targets that fall inside the client's **quiet hours** (`escalation_preferences.quiet_hours_*`); never push into the night.
7. Inserts use `INSERT OR IGNORE` so the unique index `(session_id, offset_minutes, channel)` makes the operation idempotent. (Use bucket labels: `offset_minutes = 1440` for "day-before 09:00" target, `offset_minutes = -1` synthetic value for "day-of" target — purely to satisfy the unique index, not used for math.)

**Therapist-facing rendering:** dashboard renders `session.scheduled_at` in `therapist.timezone`. Two clocks in the system — one for the client (dispatcher), one for the therapist (UI) — and they never get mixed.

### 7.3 Idempotency, retries, failure handling

- **Idempotency:** unique index `(session_id, offset_minutes, channel)` + status transitions. Even if `dispatchDue()` runs in two overlapping cron ticks, the second tick’s `UPDATE … WHERE status='pending'` will only flip rows not yet flipped.
- **Retries:** on Telegram/email error, set `status='failed'`, store `error`. A 6-hourly `retry-failed-reminders` sweep retries up to 2 times for `failed AND sent_at IS NULL AND retry_count < 2`. (Add `retry_count INTEGER DEFAULT 0`.)
- **Reschedule:** when a session is rescheduled, *all* its `pending` dispatches → `superseded`, then `planForSession()` re-creates fresh rows.
- **Cancellation:** when a session’s `attendance_status` becomes `cancelled_*`, mark `pending` dispatches `superseded` (don’t spam a cancelled session’s client).
- **Outbox edit on click:** when client taps a button, `editMessageReplyMarkup` against the `message_ref` removes the buttons and replaces them with a confirmation footer. Falls back gracefully if Telegram returns *"message can't be edited"* (>48h old).

### 7.4 The opt-in notice flow (3C-strict)

This is a separate dispatch flow from the actual reminders. Rules:

1. **Trigger condition** (`dispatch-opt-in-notices` job): client has `role='client'`, `blocked_at IS NULL`, `consent_therapist_access=1`, `session_reminders_enabled IS NULL`, `session_reminders_asked_at IS NULL`, AND has at least one future `session` in the next 14 days assigned to a therapist with `reminder_policy_json.enabled=true`.
2. **Send a single bot message** with two callback buttons: `[✅ Ok, remind me]` / `[🔕 Don't send reminders]`. Localised in EN/RU/ES/UK. Sent in the client's language (`users.language`).
3. **Stamp `session_reminders_asked_at = now()`** — never re-ask automatically.
4. **On `Ok` callback** → set `session_reminders_enabled = 1`, edit the message to *"Спасибо! Я напомню за день и в день встречи."*, and *immediately* run `planForSession()` for all the client's upcoming sessions (so the therapist doesn't have to wait for the next 15-min `plan-reminders` tick).
5. **On `Don't` callback** → set `session_reminders_enabled = 0`, edit the message to *"Ок, не буду присылать напоминания о встречах. Если передумаешь, попроси Михаила включить."*.
6. **Silence (no click):** the client stays in `NULL` (de-facto opt-out). The therapist dashboard shows a "🕓 awaiting client reply" badge on the affected session row, with a one-click "Resend opt-in request" affordance — the therapist can re-prompt manually (which clears `session_reminders_asked_at`).
7. **Therapist policy disabled later:** if the therapist sets `reminder_policy_json.enabled = false`, in-flight `pending` dispatches → `superseded`. Opt-in state on the client (`session_reminders_enabled`) is *preserved* and reused if the therapist turns the feature back on.

---

## 8. Frontend UX Proposal

### 8.1 Therapist dashboard
- **New widget on `pages/Dashboard.jsx`:** “Upcoming — confirmation status” (next 7 days).
  - Columns: client, scheduled (in therapist tz), `attendance_status`, last reminder, action buttons (`Mark attended` / `Mark no-show` / `Reschedule…`).
- **`SessionCalendar.jsx`:** add a colour dot per day (green = all confirmed, amber = some pending, red = no-show flagged).
- **Settings page (`pages/Settings.jsx`):** new section *"Session reminders"*. Deliberately small — schedule and channels are system-fixed in MVP.
  - Toggle: enabled / disabled (the master switch).
  - Read-only info row: *"Reminders are sent at 09:00 the day before, and again on the day of the session (no later than 2 hours before). Both Telegram and email are used when available."*
  - Radio: tone preset (Neutral / Warm / Brief) — drives default copy.
  - Optional: edit each of the 3 message templates per language; live preview against `{{client_first_name}} {{session_time}} {{therapist_first_name}}` placeholders.
  - Sliders: "Client can request reschedule up to N hours before" (default 24), "Client can release slot up to N hours before" (default 12).
  - Block: pending opt-in clients — list of clients who haven't answered the bot's consent prompt, with "Resend request" / "Contact manually" links.
- **Session detail page (`pages/SessionDetail.jsx`):** add an “Attendance” panel showing the timeline (sent → confirmed at 19:32 → attended) drawn from `audit_logs` + `session_reminder_dispatches`.
- **`pages/Subscription.jsx`:** add the new *Confirm* tier card (see §10 / §13).

### 8.2 Client experience (bot only)
Three reminder message variants, fully localised, no jargon. Example (RU, *Warm* preset, 24h before):

> Привет, Аня. Завтра в 18:00 у нас встреча с Михаилом. Подтвердить?
> [ ✅ Буду ] [ 🔄 Хочу перенести ] [ 🆓 Не смогу прийти ]

On *Reschedule* tap → bot follow-up: *“Я передал Михаилу, что вы просите перенос. Он напишет вам с новым временем.”* No exposed scheduling UI on the client side in MVP — it’s a request, not a self-service booking.

On *Release* tap → bot: *“Спасибо, что предупредили заранее. Я сообщу Михаилу.”* Therapist gets a WebSocket toast + bot message; session is marked `cancelled_by_client`.

### 8.3 Components to add
- `frontend/src/components/UpcomingConfirmationsWidget.jsx`
- `frontend/src/components/ReminderPolicyForm.jsx` (settings section)
- `frontend/src/components/AttendanceTimeline.jsx` (in SessionDetail)
- `frontend/src/components/RescheduleModal.jsx`
- `frontend/src/components/OfferSlotToClientModal.jsx`
- `frontend/src/components/PendingOptInList.jsx` (settings sub-block)
- **Landing-only:**
  - `frontend/src/pages/LandingConfirm.jsx`
  - `frontend/src/components/landing/ConfirmHero.jsx`
  - `frontend/src/components/landing/ConfirmHowItWorks.jsx`
  - `frontend/src/components/landing/ConfirmPriceCard.jsx`
  - `frontend/src/components/landing/ConfirmFAQ.jsx`
  - `frontend/src/components/landing/ConfirmSignupForm.jsx` (embedded registration)

### 8.4 i18n keys
Add a new namespace `reminders.*` to each of `en/ru/es/uk` locales. Keep neutral / warm / brief variants under `reminders.client.template.{neutral|warm|brief}.{day_before|day_of|release_confirm|…}`. Also add a `landingConfirm.*` namespace for the standalone landing.

### 8.5 Standalone "Confirm" landing page (`/confirm`)

**Concept:** a self-contained, single-purpose acquisition page. It is the **only** way to sign up for the Confirm tier. No header, no sidebar, no app menu — landing → embedded signup → Stripe Checkout → first-login wizard.

**Routing:**
- New top-level React Router route `/confirm` (and locale-prefixed variants `/ru/confirm`, `/es/confirm`, `/uk/confirm`).
- Rendered **outside** `AppLayout` (which provides the dashboard nav/sidebar) — uses a minimal layout that just shows footer + language switcher.
- Indexable by search engines (no auth, no robots blocking). Add OpenGraph + Twitter Card meta tags.

**Page structure (sections, top to bottom):**
1. **Hero**: headline (e.g. *"Меньше пропусков, меньше переписки"*), 1-sentence subheadline, primary CTA *"Попробовать бесплатно 7 дней"*.
2. **Pain hooks** (3 cards): no-show, late cancellation, manual reminders.
3. **How it works** (3 steps): connect your clients to the bot → set your tone → reminders go out at 09:00 with one-tap Confirm/Reschedule/Release.
4. **Live example screenshot** of the Telegram reminder (mocked, 4 languages).
5. **Price card**: $9/mo, 7-day free trial, what's included, what's NOT included (sets expectation: this tier has only reminders).
6. **FAQ**: 6-8 Q&A covering "Что если клиент откажется?", "А мои данные? Шифруются?", "А WhatsApp/SMS?", "Можно ли потом апгрейднуться?".
7. **Embedded signup form** (the *only* signup CTA): email + password + language + timezone + consent checkboxes (T-18 disclaimer + new session-reminder disclosure pre-checked).
8. **Footer**: link to main pr-top.com site, privacy, terms, language switcher.

**Signup flow (backend impact):**
- Form POST → `POST /api/auth/register` with new optional field `intended_plan: 'confirm'`.
- Backend creates `users` row + `subscriptions` row with `plan='confirm'` and `status='trialing'`, `trial_ends_at = now + 7 days`. **No "trial" plan; goes straight to Confirm-in-trial.** That's the simplest mental model and matches Stripe's native `trial_period_days`.
- After 7 days, scheduler's existing `trial-expiration` job (`services/scheduler.js:84–112`) catches it. We need to extend that job to ALSO support the `confirm` trial (today it only handles the existing `trial` plan). Or simpler: keep the existing trial expiry mechanism per-plan-agnostic by checking `status='trialing'`.
- Stripe Checkout opens *after* the trial ends (or sooner if user clicks "Upgrade now"). On successful payment → `status='active'`.

**Acquisition isolation:**
- Confirm-tier users **cannot** access Pro/Premium-gated routes. Plan-limits helper `canUseSessionReminders()` returns true for all paid plans including `confirm`; all other gated features (NL queries, full export, etc.) reject `confirm`.
- The dashboard for Confirm-tier users shows a deliberately simplified view (essentially: client list + upcoming-confirmation widget + settings). Hide modules the tier doesn't include via plan-aware nav rendering (matches existing pattern in `Sidebar.jsx`).

**Tracking:**
- Reuse `viewer_sessions` + `leads` tables (already exist per PRD §4.x and `db/connection.js:878–926`) to track funnel: landing visit → signup form view → registration → Stripe success.
- Mark `leads.source = 'landing_confirm'` so we can A/B test landing copy without polluting the main funnel.

---

## 9. Notification Channels

| Channel | Today | After this feature |
|---|---|---|
| Telegram (client) | ✅ direct API send via `telegramNotify` | ✅ primary channel; inline keyboard for confirm/reschedule/release |
| Email (client) | ⚠️ templates exist only for therapist; no client email today | ➕ Optional: only if client has `email` on file. New template `session_reminder`. |
| WebSocket (therapist) | ✅ used for SOS/diary | ➕ emit `attendance_status_changed` event to refresh dashboard |
| Email (therapist) | ✅ for SOS/subscription | Not used in MVP for reminders (avoid noise) |
| WhatsApp / SMS | ❌ | Out of scope, v2+. Likely Twilio if requested. |
| iCal feed | ❌ | Out of scope, v2+. Read-only ICS export of upcoming sessions would be cheap. |
| Google Calendar 2-way | ❌ | v3+. Heavy. |

> Note: by default in MVP, **client email is OFF**. Many clients in this space prefer Telegram-only contact. We do not want to silently start emailing diary-bot clients who never expected email from us.

---

## 10. Architecture Options

### Variant A — Minimal: piggy-back on `sessions` + audit_logs

- Add `attendance_status` to `sessions`.
- Use **audit_logs as the sole dispatch ledger** (no new table). Query *"have I sent action='session_reminder_24h' for target_id=session.id today"* before sending.
- Reuse existing scheduler with a single new daily 10:00 UTC job that sweeps next 48h.

**Pros**
- Tiniest diff. Zero new tables. Maps perfectly to today’s diary-reminder pattern.
- Can ship in days.

**Cons**
- No unique index → race risk under cron overlap or process restart.
- Timezone story is hard to fix without per-row planning (everyone gets reminded at 10:00 UTC).
- No `message_ref` → can’t edit the Telegram message after the client taps.
- Therapist UI must reconstruct "next reminder at" by inference (ugly).
- Doesn’t scale to 2 offsets (24h + 2h) cleanly — too granular for daily sweep.

**Risk:** UX feels dumb (“why does my reminder come at 4 AM Moscow time?”), and the messy data shape makes V2 painful.

**Complexity:** S. **Time to prod:** ~3–5 days.

---

### Variant B — Recommended: dispatch table + policy JSON ← **proposed MVP**

Exactly §5 + §7 above.

**Pros**
- Right granularity for multiple offsets and timezone-aware sends.
- Idempotent by construction (unique index).
- Editable Telegram messages via stored `message_ref`.
- Therapist dashboard widgets are a 1-query join.
- Open path to v2 (templates table, waitlist) without rewriting MVP.
- Reuses ALL existing infra (scheduler, telegramNotify, audit_logs for history, i18n, callback_query, consent middleware).

**Cons**
- 1 new table + 5 new columns + ~3 new cron jobs.
- Need to write a thin reminderService layer (≈300 LOC).
- Reminder-policy JSON validation must be solid (schema in code, not just trust).

**Risk:** moderate-low. The main risk is forgetting an edge case (rescheduled across DST, client revokes Telegram, etc.); mitigated by §11.

**Complexity:** M. **Time to prod:** ~7–10 working days for one developer.

---

### Variant C — Extensible: full workflow engine

- Promote everything: `reminder_rules` table (per-client overrides), `message_templates` table, `slot_waitlist` table with status machine, calendar integrations (iCal, Google), multi-channel router (Twilio for SMS/WhatsApp), automatic candidate-suggestion AI ranker.
- Replace cron with a small job queue (e.g. table-backed BullMQ-light or upgrade to a worker process).

**Pros**
- Future-proof for a year+ of feature work.
- Clean separation of concerns; new channels are a 1-file add.
- Enables true automated waitlist / "next available client" matching.

**Cons**
- ~4–6× the LOC and surface area of MVP.
- Pulls in real operational risk: queue persistence, dead-letter inspection, observability.
- Probably overkill before we’ve validated demand with even 5 therapists.
- Slows time-to-customer-feedback dramatically.

**Risk:** building the wrong abstractions before customer signal. Classic premature-architecture trap.

**Complexity:** L+. **Time to prod:** ~6–10 weeks.

---

### Recommendation
**Ship Variant B as MVP.** Keep the door open to Variant C by keeping `reminder_policy_json` as a JSON column (easy to promote to a table later) and by making `session_reminder_dispatches.channel` a string column (easy to add `whatsapp`/`sms` rows later). Variant A is rejected — it saves a week of dev time but creates a UX and TZ problem we’ll have to undo within a quarter.

---

## 11. Risks & Edge Cases

| Risk | Mitigation |
|---|---|
| **Timezone drift** between scheduling and sending | Snapshot `client_timezone_snapshot` at plan time; recompute only on explicit reschedule. |
| **Daylight saving transitions** within reminder window | Use IANA `Intl.DateTimeFormat` zone math (already used in `clients.js:29–81`), not raw `±offset` math. |
| **Duplicate reminders** (cron overlap, restart) | Unique index `(session_id, offset_minutes, channel)` + `status='pending'` transition guard. |
| **Session moved → stale reminders fire** | On reschedule/cancel, mark all pending dispatches `superseded`. |
| **Client revokes consent / blocks bot** | `users.blocked_at IS NOT NULL` or `consent_therapist_access=0` → skip; log `status='skipped'`. |
| **Telegram message can’t be edited (>48h)** | Try `editMessageReplyMarkup`; on Telegram error code 400, send a fresh follow-up message instead. |
| **Delivery failure** | Mark `failed`, store `error`. Retry sweep up to 2x. After 2 failures, surface in therapist dashboard (“we couldn’t reach this client — please contact them another way”). |
| **Cross-therapist leakage** (Client A’s reminder mentions Therapist B) | Every query joins on `therapist_id`. The `reminderService.planForSession()` is fed a session row that already has therapist_id; messages are templated from that. Unit test the SQL with a 2-therapist fixture. |
| **Language fallback** | If `users.language` not in `[en, ru, es, uk]`, fall back to `en`. Same as current bot logic. |
| **Quiet hours respected** | If `scheduled_send_at` falls inside `quiet_hours_*` for the client, push forward to next non-quiet 15-min slot; skip if that would arrive after the session. |
| **Client doesn't have Telegram, only email** | Email is always on in MVP. The planner creates only the email dispatch row for that client. If client has neither telegram nor email, log `skipped` and surface a warning on the therapist dashboard (this should be rare — at least one channel was supplied at registration). |
| **Client opted in via bot, then unlinks Telegram later** | Email-only dispatch continues. If neither channel is reachable, `dispatchDue()` logs `failed`; therapist sees the warning. |
| **Client never answers opt-in notice** | Treated as opt-out (3C-strict). Therapist sees a "awaiting reply" badge with a "Resend" button (rate-limited 1×/48h). No silent fallback to sending real reminders. |
| **Email-flood / cost runaway** | Existing `emailService.js` rate limit is 10/min/recipient — fine. **But:** therapist has many clients × 2 dispatches each → could push monthly volume up significantly. Add a soft daily ceiling per therapist (e.g., 200 email dispatches/day) and a soft platform ceiling (configurable in `platform_settings`). Alert admin if exceeded. |
| **Landing-only acquisition is fragile** | The Confirm tier has *only one* entry point. If the landing breaks (404, slow, broken signup), the whole tier stalls. Add: synthetic monitor hitting `/confirm` every 5 min; Umami funnel tracking; failed-signup alerting from `auth.js` keyed on `intended_plan='confirm'`. |
| **Trial-to-paid conversion on Confirm tier** | The 7-day trial-then-Stripe model needs the existing trial-expiration cron to handle a NEW plan name. Risk: existing job ignores `plan='confirm'`. Mitigation: refactor the job to check `status='trialing'` (plan-agnostic) — see §12. |
| **PII / privacy** | The only Class-A datum touched is *the fact a session is scheduled at time T* — already known to both parties. We do NOT include diary content, notes, summaries, or anamnesis in reminders. Add to consent disclaimer (T-18 mechanism: new `consent_version`, additive disclosure). |
| **Soft no-show heuristic is wrong** | The auto "no_show" sweep is *soft* — clearly labelled in UI as "auto-flagged" and one-click overrideable. The therapist is always the source of truth. |
| **Emotional harm from misfired automation** | Never send anything after `scheduled_at` has passed. Never send to `blocked_at IS NOT NULL`. Never include the word "fine", "penalty", "violation". |
| **Race: client confirms while reminder #2 is being sent** | Right before send, dispatcher re-reads `sessions.attendance_status`; if `confirmed`, mark dispatch `superseded` instead of sending. |
| **Audit + compliance** | Every state change goes to `audit_logs` (`action='attendance_confirmed' | 'attendance_release_requested' | 'reminder_sent' | 'reminder_failed'`). |

---

## 12. Implementation Plan

Sequenced for safe rollout. Each step independently mergeable. Step 0 (consent disclaimer) must merge before any client-facing send.

0. **Consent disclaimer update (T-18 mechanism)** — bump `consent_version`; add one line to disclaimer ("Session reminders may be sent to you by Telegram and email…") in all 4 locales. Add the `consent_session_reminders` pre-checked checkbox to the existing 5-checkbox flow.
1. **Schema (T-27)** — single migration block in `connection.js`. Verify with regression scripts following existing T-XX pattern. *No code paths reading the new columns yet.*
2. **`reminderService` skeleton** — `planForSession`, `dispatchDue`, `dispatchOptInNotices`, `markNoShows`, `cancelPendingForSession`. No cron wiring yet; unit-testable. Include the wall-clock-anchored target computation as a pure function (easy to test).
3. **Settings — therapist policy** — `GET/PUT /api/settings/reminder-policy`, `ReminderPolicyForm.jsx`, i18n strings. Feature flag (env var `FEATURE_SESSION_REMINDERS=on`) gates the UI section.
4. **Wire scheduler** — `plan-reminders`, `dispatch-opt-in-notices`, `dispatch-due-reminders` crons. Start dispatching to a single internal QA therapist + dummy clients; verify in staging across 2 timezones.
5. **Bot inline buttons + callbacks** — extend `bot/src/index.js:1020` callback handler with `confirm_session_*`, `reschedule_*`, `release_*`, `optin_session_reminders_*`. `POST /api/bot/session-attendance` and `POST /api/bot/session-reminders-optin`. Edit message on click.
6. **Therapist dashboard widgets** — `UpcomingConfirmationsWidget`, calendar dots, attendance panel on session detail, `PendingOptInList` in settings.
7. **Reschedule / mark no-show endpoints** — `POST /api/sessions/:id/reschedule`, `POST /api/sessions/:id/attendance`. Hook to scheduler re-plan. Reschedule is *always* therapist-driven (per product decision #4) — clients only *request* via bot button.
8. **Soft no-show sweep** — `mark-no-shows` cron + override UI.
9. **Monthly stats endpoint + small chart on Analytics page.**
10. **Manual "offer slot" flow** — `POST /api/sessions/:id/offer-to-client` + modal.
11. **Subscription tier wiring** — new `confirm` plan in `stripe.js`, `planLimits.js`, `subscription.jsx`, `subscription.js` validPlans, `admin.js` validPlans, `connection.js` defaults. Refactor `trial-expiration` job in `scheduler.js:84–112` to be **plan-agnostic** (key off `status='trialing'`, not `plan='trial'`) so it correctly handles `confirm`-in-trial.
12. **`canUseSessionReminders()` plan gate** — helper in `utils/planLimits.js`. Allow on `confirm | basic | pro | premium`; deny on legacy `trial` (since `confirm` replaces that funnel for this feature).
13. **Standalone "Confirm" landing page** — `pages/LandingConfirm.jsx` rendered outside `AppLayout`. Section components per §8.5. `POST /api/auth/register` accepts new optional `intended_plan='confirm'` field (validate against an allowlist). Locale-aware route. SEO meta. Stripe Checkout flow.
14. **Funnel telemetry** — extend `viewer_sessions` / `leads` ingestion to tag `source='landing_confirm'`. Umami events `confirm_landing_view`, `confirm_signup_submitted`, `confirm_payment_success`.
15. **Pilot rollout** — enable for 3–5 friendly therapists on existing tiers first; then run a 2-week closed beta of the standalone landing with paid traffic capped at $200; collect feedback before public release.

### 12.1 Tier integration (the "Appointment Confirmations" plan)
Per the subscription investigation, the system supports adding a new tier with ~10 constant updates in 4 files:

| File | Change |
|---|---|
| `services/stripe.js:192–196` | Add `confirm: { amount: 900, currency: 'usd', name: 'Confirm', interval: 'month' }` |
| `utils/planLimits.js:8–13` | Add `confirm: { clients: 25, sessions_per_month: 0, reminder_dispatches_per_month: 500 }` |
| `pages/Subscription.jsx:7–12` | Add Confirm plan card |
| `subscription.jsx:14`, `subscription.js:328` | Plan order placement |
| `subscription.js:291, 451`, `admin.js:68` | Add `'confirm'` to `validPlans` |
| `db/connection.js:1007–1030` | Default platform_settings entries |

Then add a single feature-gate helper `canUseSessionReminders(therapistId) → bool` that allows `confirm | basic | pro | premium` (i.e. everything except `trial` if we want, or all paid plans). Centralised in `utils/planLimits.js`.

---

## 13. Open Questions

All major product questions have been resolved in the kickoff conversation; resolutions are recorded below. A short list of residual ones remains.

### 13.1 Resolved (decisions of record)

| # | Question | Decision |
|---|---|---|
| 1 | Tier model | **Standalone entry-level "Confirm" tier** (~$9/mo) acquired only via a dedicated landing page. Feature is also **included by default** in Basic/Pro/Premium (no extra charge). |
| 2 | Reminder schedule | **Wall-clock-anchored in client tz**: day-before @09:00 + day-of @09:00 (but no later than `scheduled_at − 2h`). System-fixed in MVP; not therapist-configurable. |
| 3 | Existing-client opt-in | **3C-strict**: separate `session_reminders_enabled` tri-state column. One-shot opt-in notice via bot. Silence = no reminders. New clients get a pre-checked `consent_session_reminders` box in the T-18 5-checkbox flow. |
| 4 | Reschedule UX | **Client requests → therapist decides → therapist manually changes the time.** No self-service rescheduling. |
| 5 | Email-to-clients | **Always on.** Both Telegram and email are dispatched for every client where contact info exists. No channel toggle in MVP. |
| 6 | PRD update | **Yes**, add a new section to `docs/PRD.md` with a clear "Experimental / R&D" tag. |
| 7 | Soft no-show auto-flag | **Yes**, soft-default with one-click therapist override. UI string is "Не состоялась" — never "No-show" in client-facing copy. |
| 8 | Acquisition channel for Confirm tier | **Dedicated landing page only.** No menu/sidebar on this page. Registration funnel originates *only* from the landing. |
| 9 | Morning hour | **Fixed at 09:00 client local** (not therapist-configurable in MVP). |
| 10 | Locales for MVP | Ship all 4 (EN/RU/ES/UK) at once — they're already required by the rest of the platform. |

### 13.2 Remaining residual questions

1. **Landing URL** — `/confirm` on the same domain (`app.pr-top.com/confirm`), or a separate subdomain (e.g. `confirm.pr-top.com`)? Same-domain is operationally simpler (one nginx config); subdomain is cleaner for marketing/SEO isolation. **Recommend same-domain `/confirm`** for MVP.
2. **Consent disclaimer wording (T-18)** — Need a one-liner approved by product/legal. Proposed (EN): *"Reminders about your upcoming sessions may be sent to you via Telegram and email. You can opt out at any time."* Equivalents needed in RU/ES/UK.
3. **WebSocket fan-out and viewer role** — `viewer` role users (read-only therapist viewers) should be able to *see* attendance status but NOT mark `attended`/`no_show` or trigger reschedule. Confirm this is the desired permission boundary.
4. **Trial length on Confirm tier** — 7 days proposed (matches industry default). Should we A/B test 14 days as well? *(Not blocking — can decide after launch.)*
5. **Email per-therapist daily cap** — Soft-cap value? 200/day proposed. *(Not blocking — operational tuning.)*

---

## Appendix A — Naming conventions (final, neutral)

| Code identifier | UI string (EN) | UI string (RU) |
|---|---|---|
| `attendance_status` | Attendance | Подтверждение |
| `confirmed` | Confirmed | Подтверждено |
| `reschedule_requested` | Reschedule requested | Запрошен перенос |
| `cancelled_by_client` | Cancelled by client | Отменено клиентом |
| `cancelled_by_therapist` | Cancelled | Отменено |
| `attended` | Attended | Состоялась |
| `no_show` | No-show *(internal only — UI says "Marked as not attended")* | *в интерфейсе:* "Не состоялась" |
| `reminder_policy_json` | Session reminders | Напоминания о сессиях |
| `session_reminder_dispatches` | Reminder log | Журнал напоминаний |
| Tier name | "Confirm" | "Подтверждения" |

> The string `no_show` lives only in code and analytics. The UI calls it *"Marked as not attended"* / *"Не состоялась"*.

---

## Appendix B — File-by-file change map (for the future implementer)

| Layer | File | Change |
|---|---|---|
| DB | `src/backend/src/db/connection.js` | T-27 block: ALTERs + new table + indexes |
| Service | `src/backend/src/services/reminderService.js` *(new)* | `planForSession`, `dispatchDue`, `markNoShows`, `cancelPendingForSession` |
| Service | `src/backend/src/services/scheduler.js` | Register 3 new jobs |
| Service | `src/backend/src/services/emailService.js` | New template `session_reminder` (optional MVP) |
| Routes | `src/backend/src/routes/settings.js` | `GET/PUT /reminder-policy` |
| Routes | `src/backend/src/routes/sessions.js` | `POST /:id/reschedule`, `POST /:id/attendance`, `POST /:id/offer-to-client` |
| Routes | `src/backend/src/routes/bot.js` | `POST /session-attendance`, `GET /upcoming-session/:client_id` |
| Routes | `src/backend/src/routes/dashboard.js` | `GET /attendance-summary` |
| Utils | `src/backend/src/utils/planLimits.js` | `canUseSessionReminders()` helper; new tier limits |
| Bot | `src/bot/src/index.js` | Extend `callback_query` for `confirm_session_*`, `reschedule_*`, `release_*` |
| Bot | `src/bot/src/i18n.js` | Add `reminders.*` keys in EN/RU/ES/UK |
| Bot | `src/bot/src/keyboards.js` | `sessionReminderKeyboard(sessionId)` factory |
| Frontend | `src/frontend/src/pages/Settings.jsx` | Mount `ReminderPolicyForm` + `PendingOptInList` |
| Frontend | `src/frontend/src/pages/Dashboard.jsx` | Mount `UpcomingConfirmationsWidget` |
| Frontend | `src/frontend/src/pages/SessionDetail.jsx` | Mount `AttendanceTimeline` + reschedule action |
| Frontend | `src/frontend/src/pages/Subscription.jsx` | Add Confirm tier card |
| Frontend | `src/frontend/src/pages/LandingConfirm.jsx` *(new)* | Standalone landing page, rendered outside `AppLayout` |
| Frontend | `src/frontend/src/components/landing/Confirm*.jsx` *(new dir)* | Hero / How-it-works / PriceCard / FAQ / SignupForm |
| Frontend | `src/frontend/src/components/*` | 6 new in-app components (see §8.3) |
| Frontend | `src/frontend/src/App.jsx` | Add `/confirm` route + locale variants, outside the auth-guarded `AppLayout` |
| Frontend | `src/frontend/src/i18n/*.json` | `reminders.*` and `landingConfirm.*` namespaces |
| Subscription | `src/backend/src/services/stripe.js` | Add `confirm` plan (amount 900, name 'Confirm', interval 'month') |
| Subscription | `src/backend/src/services/scheduler.js` | Refactor `trial-expiration` job to be plan-agnostic (`status='trialing'`) |
| Subscription | `src/backend/src/routes/auth.js` | Accept optional `intended_plan='confirm'` on register; create trialing subscription |
| Admin | `src/backend/src/routes/admin.js` | Allow `confirm` in `validPlans` |

---

---

## Appendix C — "Confirm" Standalone Landing Page Spec

### C.1 URL & rendering
- Route: `/confirm` (default English), `/ru/confirm`, `/es/confirm`, `/uk/confirm`.
- **No `AppLayout`** — uses a minimal wrapper (`LandingLayout`) with only a small footer + language switcher in the top-right corner.
- No sidebar, no app navigation, no user menu. **Single-purpose page.**
- The page is **public and SEO-indexable** (set `<meta name="robots" content="index,follow">`, OpenGraph tags for social sharing).

### C.2 Conversion funnel (single CTA throughout)
Hero CTA → Pain → How → Live demo → Price → FAQ → **Signup form** → Stripe Checkout → "Check your email" → first login → dashboard.

There is exactly **one** signup form on the page, near the bottom but visible in the sticky CTA bar from the start.

### C.3 Signup form fields (minimum viable)
| Field | Required | Notes |
|---|---|---|
| Email | ✅ | Used for login + reminder fallback channel |
| Password | ✅ | Standard rules (matches existing register endpoint) |
| Display name | ✅ | First name only — used in client-facing reminder copy as `{{therapist_first_name}}` |
| Language | ✅ | 4 options; default = current page locale |
| Timezone | ✅ | Auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`, user-overridable |
| Consent checkboxes | ✅ | Existing T-18 disclaimer set, with the new pre-checked `consent_session_reminders` row added |

**No phone, no organisation, no specialty.** Friction kills entry-level tiers — every extra field is a ~5–10% conversion hit.

### C.4 Backend signup flow
```
POST /api/auth/register
  body: { email, password, name, language, timezone, intended_plan: 'confirm', consents: {...} }

  → users INSERT (role='therapist')
  → subscriptions INSERT (plan='confirm', status='trialing', trial_ends_at=now+7d)
  → leads INSERT (source='landing_confirm')
  → emailService.sendWelcome(email, lang, { trial_ends_at })
  → JWT issued, HttpOnly cookie set
  → response: { ok, redirect: '/dashboard?welcome=confirm' }
```

After trial: existing `trial-expiration` scheduler job (after the plan-agnostic refactor in §12 step 11) handles transition. If user has added Stripe payment method → status='active'; else → status='expired' (read-only dashboard, banner asking to pay).

### C.5 What's "in" and "out" of the Confirm tier
**In:**
- Up to 25 clients connected to the bot.
- Session reminders (the entire feature in this document).
- Read-only dashboard widgets: upcoming sessions list, attendance summary chart for the month.
- Manual "offer slot to client" action.
- Bot interaction (client diary remains accessible to clients, but the *therapist's* view of diary is hidden — that's Basic+).

**Out (visible as locked items in nav with "Upgrade" CTA):**
- Audio upload, transcription, AI summaries (Basic+).
- Exercises library and assignments (Basic+).
- NL queries, semantic search (Pro+).
- Full analytics & export (Pro+).
- Custom AI provider, supervision share (Premium).

### C.6 Marketing assets needed (not architectural, but blocking for launch)
- 1 hero image / illustration.
- 1 short demo video or animated GIF of the Telegram reminder flow.
- 4 screenshots of the reminder message (one per locale).
- Privacy + Terms paragraphs specific to the Confirm tier (or a stub linking to the full ones).
- Copy in 4 languages (~ 800 words per locale).

### C.7 Out-of-scope for the landing (future)
- A/B testing infrastructure beyond Umami events.
- Multi-step funnel (lead capture → email nurture → trial).
- Affiliate / partner referral codes.
- In-page chatbot demo.

---

**End of architecture proposal.** No source code changes have been made. Next step: review §13.2 residual questions (landing URL, T-18 wording, viewer role permissions), then break into implementation tickets following §12.
