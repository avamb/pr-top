# PR-TOP Product Requirements Document

**Version:** 1.0
**Last Updated:** 2026-03-14
**Status:** Implemented

---

## 1. Product Overview

**PR-TOP** (formerly PsyLink) is a therapist-controlled between-session assistant platform built on the MindSetHappyBot/3hours Telegram bot codebase. It helps practicing psychologists:

- **Preserve client context** across sessions
- **Reduce double documentation** by unifying diary entries, session recordings, and notes
- **Work deeper between sessions** with AI-powered search, transcription, and summarization
- **Maintain therapist control** over all sensitive client data flows

The platform consists of three components:

1. **Web Application** — React SPA with landing page, therapist dashboard, and superadmin panel
2. **Backend API** — Node.js REST API with encrypted SQLite storage
3. **Telegram Bot** — Client-facing bot for diary input, exercises, and SOS

---

## 2. User Roles

### 2.1 Therapist

Therapists are the primary users. They register via the web application and manage clients through both the web dashboard and Telegram bot.

**Capabilities:**
- View and manage linked clients
- Read client diary entries (decrypted on authorized access)
- Create and edit private therapist notes
- Upload session audio; view AI-generated transcripts and summaries
- View unified client timeline (diary, sessions, notes, exercises, SOS)
- Assign exercises from the library or create custom exercises
- Receive SOS notifications with configurable escalation
- Add client context (anamnesis, goals, AI instructions, contraindications)
- Use natural language queries for client information (Pro/Premium)
- Access analytics dashboard with export capabilities
- Generate and refresh client invite codes
- Configure language, timezone, and escalation preferences

**Protected Routes:** `/dashboard/*`, `/api/clients/*`, `/api/sessions/*`, `/api/notes/*`

### 2.2 Client

Clients interact exclusively through the Telegram bot. They connect to their therapist via an invite code.

**Capabilities:**
- Write diary entries (text, voice, video)
- Complete exercises assigned by therapist
- Trigger SOS button for crisis situations
- Connect to therapist via invite code
- Grant or revoke consent for therapist data access
- View own diary history
- Select preferred language

**Interface:** Telegram bot only (no web panel access)

### 2.3 Superadmin

Superadmins manage the platform through a dedicated admin panel.

**Capabilities:**
- View all therapists and their status
- Block/unblock therapist accounts
- View platform-wide user and subscription statistics
- View UTM attribution and registration analytics
- View and search audit logs and system logs
- Configure AI providers, models, and spending limits
- Monitor AI usage and costs per therapist
- Manage platform settings
- Trigger and manage database backups

**Protected Routes:** `/admin/*`, `/api/admin/*`

---

## 3. Architecture

### 3.1 System Components

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React)                │
│  Landing │ Therapist Dashboard │ Admin Panel     │
│  Port 3000 (dev) / 80 (Docker via nginx)        │
└──────────────────────┬──────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────┴──────────────────────────┐
│              Backend (Node.js/Express)           │
│  Auth │ API Routes │ Services │ Middleware       │
│  Port 3001                                       │
└────────┬────────────────┬───────────────────────┘
         │                │
    ┌────┴────┐    ┌──────┴──────┐
    │ SQLite  │    │ Telegram Bot │
    │ (data/) │    │ (long-poll)  │
    └─────────┘    └─────────────┘
```

### 3.2 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Tailwind CSS, React Router, Zustand, react-i18next |
| Backend | Node.js, Express, better-sqlite3, Stripe SDK, node-cron |
| Bot | Telegram Bot API (node-telegram-bot-api) |
| AI | OpenAI, Anthropic, Google Gemini, OpenRouter (configurable) |
| Transcription | OpenAI Whisper (configurable provider) |
| Search | Vector embeddings for semantic search |
| Real-time | WebSocket (ws) for push notifications |
| Email | Nodemailer (SMTP or console fallback) |
| Languages | English, Russian, Spanish, Ukrainian |
| PWA | Service worker, manifest.json, installable |

### 3.3 Data Flow

1. **Client → Bot → Backend** — Diary entries, exercise completions, SOS events
2. **Therapist → Dashboard → Backend** — Session uploads, notes, exercise assignments, queries
3. **Backend → AI Provider** — Transcription, summarization, embeddings, NL queries
4. **Backend → Therapist** — WebSocket notifications (SOS, exercises, diary updates)

---

## 4. Feature List by Module

### 4.1 Authentication & User Management

| Feature | Description |
|---------|-------------|
| Therapist Registration | Email/password registration with validation |
| Login/Logout | JWT-based auth with HttpOnly cookies |
| Password Reset | Email-based reset flow with tokenized links |
| Profile Settings | Language, timezone, escalation preferences |
| Invite Code System | Generate/refresh codes for client onboarding |
| Account Blocking | Superadmin can block/unblock therapist accounts |

### 4.2 Client Management

| Feature | Description |
|---------|-------------|
| Client List | Paginated list with search and filtering |
| Client Detail | Comprehensive profile with tabbed sections |
| Client Timeline | Unified view of diary, sessions, notes, exercises, SOS |
| Client Context | Anamnesis, goals, AI instructions, contraindications |
| Consent Management | Clients grant/revoke therapist access to their data |
| Consent Enforcement | All API routes respect consent status; denied access is audit-logged |
| Bulk Client Import | CSV/JSON import for onboarding multiple clients |

### 4.3 Session Management

| Feature | Description |
|---------|-------------|
| Audio/Video Upload | File upload (up to 100MB) with progress bar |
| Transcription | AI-powered speech-to-text (Whisper) |
| Summarization | AI-generated session summaries |
| Session Detail View | Transcript, summary, and audio player |
| Audio/Video Player | HTML5 player with playback speed, seeking, volume |
| Streaming Playback | HTTP 206 range requests for large files |
| Encrypted Storage | Opaque file IDs, signed-access only |

### 4.4 Exercises

| Feature | Description |
|---------|-------------|
| Exercise Library | Pre-seeded multilingual library (Breathing, Mindfulness, CBT, Journaling) |
| Custom Exercises | Therapists create/edit/delete their own exercises ("My Exercises") |
| Exercise Assignment | Send exercises to clients via bot |
| Exercise Completion | Clients submit responses; therapist sees results |
| Multilingual Exercises | All exercises available in EN, RU, ES, UK |

### 4.5 Diary & Notes

| Feature | Description |
|---------|-------------|
| Client Diary (Text) | Text diary entries via Telegram bot |
| Client Diary (Voice) | Voice messages with automatic transcription |
| Client Diary (Video) | Video messages with transcription |
| Therapist Notes | Private notes per client, encrypted at rest |
| Diary History | Clients can view their own diary entries |

### 4.6 SOS & Escalation

| Feature | Description |
|---------|-------------|
| SOS Button | One-tap crisis trigger in Telegram bot |
| SOS Event Tracking | Status lifecycle: new → in_progress → resolved |
| Escalation Notifications | Telegram, email, web push, sound alerts |
| Escalation Configuration | Quiet hours, delay settings, per-therapist preferences |
| SOS Dashboard Widget | Real-time SOS alerts on therapist dashboard |

### 4.7 Search & Discovery

| Feature | Description |
|---------|-------------|
| Semantic Search | Vector embedding search across diary, sessions, notes |
| Search Visualization | Relevance bars, highlighted terms, sort by relevance/date |
| Natural Language Queries | Text/voice queries about clients (Pro/Premium) |
| Query Expansion | Automatic synonym and related term expansion |

### 4.8 Analytics & Reporting

| Feature | Description |
|---------|-------------|
| Dashboard Stats | Quick overview: clients, sessions, notes, active SOS |
| Activity Feed | Recent events across all clients |
| Analytics Dashboard | Charts for sessions, diary entries, client activity over time |
| PDF Export | Analytics reports as downloadable PDFs |
| Data Export | GDPR-compliant JSON/CSV export per client |
| ZIP Archive | Bulk export of multiple clients |
| Tier-Gated Export | Trial/Basic: limited; Pro: full JSON/CSV; Premium: full + analytics |

### 4.9 Subscriptions & Payments

| Feature | Description |
|---------|-------------|
| Stripe Integration | Customer creation, checkout sessions, subscription management |
| Subscription Plans | Trial (14 days free), Basic ($19/mo), Pro ($49/mo), Premium ($99/mo) |
| Plan Limits | Client count, session count, feature gating by tier |
| Webhook Handling | payment_intent.succeeded, subscription.created/updated/deleted |
| Plan Upgrade Flow | In-app upgrade with Stripe Checkout redirect |

**Plan Comparison:**

| Feature | Trial | Basic | Pro | Premium |
|---------|-------|-------|-----|---------|
| Price | Free (14 days) | ~$19/mo | ~$49/mo | ~$99/mo |
| Clients | 3 | 10 | 30 | Unlimited |
| Sessions/mo | 5 | 20 | 60 | Unlimited |
| NL Queries | No | No | Yes | Yes |
| Analytics | Basic | Basic | Full | Full + Export |
| Data Export | Limited | Limited | Full | Full + Analytics |

### 4.10 Therapist Guide

| Feature | Description |
|---------|-------------|
| Interactive Guide | Multi-section onboarding guide for new therapists |
| FAQ Section | Common questions about consent, data, security |
| Illustrated Sections | Custom SVG illustrations for each guide section |
| Multilingual Guide | Full translations in EN, RU, ES, UK |
| Exercise Guide | "My Exercises" section explaining custom exercise creation |

### 4.11 Email Notifications

| Feature | Description |
|---------|-------------|
| Welcome Email | Sent on therapist registration |
| Password Reset Email | Tokenized reset link |
| SOS Notification Email | Alert when client triggers SOS |
| Subscription Receipts | Payment confirmation emails |
| Expiry Warnings | Trial/subscription expiration reminders |
| Console Fallback | Emails logged to terminal when SMTP not configured |
| Rate Limiting | Prevents email flood attacks |

### 4.12 Real-Time Features

| Feature | Description |
|---------|-------------|
| WebSocket Notifications | Push updates for SOS alerts, diary entries, exercises, sessions |
| Live Dashboard Updates | Real-time activity feed and notification badges |
| PWA Install Prompt | Browser-native install prompt for mobile |
| Service Worker | Offline caching, background sync, update notifications |

---

## 5. Security & Encryption

### 5.1 Data Sensitivity Classes

**Class A — Encrypted at Application Layer:**
- Client diary content (text, voice transcripts, video transcripts)
- Conversation messages
- Voice/video transcripts
- Therapist notes
- Session summaries
- Anamnesis / client context
- AI instructions / contraindications
- Alarm/SOS excerpts
- Exercise responses from client

**Class B — Access-Controlled Metadata (plaintext):**
- Timestamps
- Therapist/client linkage IDs
- Statuses and role types
- Language tags, counters
- Scheduling metadata
- Payment metadata (Stripe handles PCI)
- UTM attribution data

### 5.2 Security Measures

| Measure | Implementation |
|---------|---------------|
| Authentication | JWT with HttpOnly cookies |
| CSRF Protection | Double-submit cookie pattern |
| Encryption at Rest | AES encryption for all Class A data |
| Key Rotation | Encryption key versioning with re-encryption support |
| Password Security | bcrypt hashing with strength validation |
| Rate Limiting | Brute-force protection on auth endpoints |
| Audit Logging | All sensitive data access logged with actor, action, timestamp |
| Role-Based Access | Route guards + API middleware for therapist/admin/client |
| Consent Enforcement | All client data routes check consent_therapist_access flag |
| File Security | Opaque IDs for uploaded files, signed-access streaming |

---

## 6. Subscription Tiers

See Section 4.9 for full plan comparison.

**Tier-Gated Features:**
- **Trial:** 3 clients, 5 sessions/mo, basic analytics, limited export
- **Basic:** 10 clients, 20 sessions/mo, basic analytics, limited export
- **Pro:** 30 clients, 60 sessions/mo, full analytics, NL queries, full export
- **Premium:** Unlimited clients/sessions, full analytics + export, NL queries, priority support

---

## 7. Internationalization (i18n)

### 7.1 Supported Languages

| Code | Language | Coverage |
|------|----------|----------|
| EN | English | Full (frontend, backend, bot, exercises, guide) |
| RU | Russian | Full (frontend, backend, bot, exercises, guide) |
| ES | Spanish | Full (frontend, backend, bot, exercises, guide) |
| UK | Ukrainian | Full (frontend, backend, bot, exercises, guide) |

### 7.2 i18n Implementation

- **Frontend:** react-i18next with JSON translation files
- **Backend:** Custom i18n middleware with language detection (header, user preference)
- **Bot:** Telegram language detection + user language preference
- **Language Switcher:** Available on all UI layers (sidebar, settings, bot)
- **Exercise Translations:** All library exercises translated in all 4 languages
- **Therapist Guide:** All guide sections and FAQs translated

---

## 8. AI & ML Features

### 8.1 Multi-Provider AI Support

| Provider | Models | Use Cases |
|----------|--------|-----------|
| OpenAI | gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1-nano, gpt-4.1, o4-mini | Summarization, NL queries |
| Anthropic | claude-3.5-haiku, claude-4-sonnet | Summarization, NL queries |
| Google Gemini | gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro | Summarization, NL queries |
| OpenRouter | deepseek-v3, deepseek-r1, qwen-2.5-72b, + others | Summarization, NL queries |

### 8.2 Transcription Pipeline

- **Provider:** OpenAI Whisper (configurable)
- **Input:** Audio/video files (webm, mp4, wav, etc.)
- **Process:** Upload → Decrypt → Transcribe → Encrypt transcript → Store
- **Languages:** Auto-detect or configured via TRANSCRIPTION_LANGUAGE

### 8.3 Summarization Pipeline

- **Input:** Session transcript (decrypted)
- **Process:** Transcript → AI summarization → Encrypt summary → Store
- **Output:** Structured summary with key themes, recommendations
- **Spending Check:** Checks monthly AI spending limit before each API call

### 8.4 Vector Embeddings & Semantic Search

- **Sources:** Diary entries, session transcripts, session summaries
- **Embedding:** Text → vector embedding → stored in vector_embeddings table
- **Search:** Query → embedding → cosine similarity → ranked results
- **Visualization:** Relevance bars, highlighted terms, search time display

### 8.5 Natural Language Queries (Pro/Premium)

- **Input:** Text or voice query about a specific client
- **Process:** Query → expansion (synonyms) → semantic search → AI-ranked results
- **Output:** Relevant diary entries, sessions, notes with relevance scores
- **Gating:** Only available on Pro and Premium subscription tiers

### 8.6 AI Usage Monitoring

- **Logging:** Every AI API call logged with tokens, cost, provider, model
- **Dashboard:** Admin AI usage & cost dashboard with per-therapist breakdown
- **Spending Limits:** Configurable monthly limits with warning thresholds
- **Auto-Block:** AI calls blocked when monthly spending limit reached
- **Model Pricing:** Comprehensive pricing table for all supported models

---

## 9. Integrations

### 9.1 Telegram Bot

- **Framework:** node-telegram-bot-api (long-polling)
- **Commands:** /start (role selection), /connect (invite code), /register
- **Client Features:** Diary input (text/voice/video), exercises, SOS, history, consent
- **Therapist Features:** Client management, notes, queries (via bot interface)
- **Language:** Auto-detect from Telegram settings, user-configurable
- **Communication:** REST API calls to backend with BOT_API_KEY authentication

### 9.2 Stripe

- **Payments:** Subscription billing with 4 tiers
- **Webhooks:** Payment success, subscription lifecycle events
- **Checkout:** Stripe-hosted checkout page redirect
- **Customer Portal:** Link to Stripe customer portal for billing management

### 9.3 SMTP Email

- **Provider:** Any SMTP service (SendGrid, Mailgun, Gmail, etc.)
- **Templates:** HTML email templates for SOS, welcome, receipt, expiry, reset
- **Fallback:** Console logging when SMTP not configured (development mode)
- **Rate Limiting:** Prevents email abuse

---

## 10. Infrastructure

### 10.1 Docker Compose

Three services defined in `docker-compose.yml`:

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| frontend | Node 18 + nginx | 80 (exposed) | React SPA build, nginx reverse proxy |
| backend | Node 18 Alpine | 3001 (internal) | Express API, SQLite |
| bot | Node 18 Alpine | none | Telegram long-polling |

**Volumes:**
- `backend-data` — SQLite database persistence
- `backend-uploads` — Encrypted session files

### 10.2 Environment Variables

All configuration via `.env` file. Key variable groups:

| Group | Variables |
|-------|-----------|
| Security | JWT_SECRET, ENCRYPTION_MASTER_KEY, BOT_API_KEY |
| Admin | SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD |
| Telegram | TELEGRAM_BOT_TOKEN |
| Stripe | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET |
| AI Provider | AI_PROVIDER, AI_MODEL, AI_API_KEY |
| Anthropic | ANTHROPIC_API_KEY, ANTHROPIC_API_URL |
| Google | GOOGLE_AI_API_KEY |
| OpenRouter | OPENROUTER_API_KEY |
| Transcription | TRANSCRIPTION_PROVIDER, TRANSCRIPTION_MODEL, TRANSCRIPTION_API_KEY |
| Email | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM |
| Scheduler | SCHEDULER_ENABLED |
| Backups | BACKUP_DIR, BACKUP_RETENTION_COUNT, BACKUP_CRON |
| Logging | LOG_LEVEL |

### 10.3 Database Backups

- **Automated:** Cron-based backups (default: daily at 3 AM)
- **Encrypted:** Backup snapshots encrypted with master key
- **Retention:** Configurable count (default: 30 backups)
- **Admin UI:** Trigger manual backup, view backup history, restore

### 10.4 Health Checks

- **Endpoint:** GET /api/health
- **Docker:** Backend health check configured; frontend depends on backend health
- **Monitoring:** Response includes uptime, database status

### 10.5 Scheduled Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| Trial Expiry | Daily | Downgrade expired trial accounts |
| Subscription Downgrade | Daily | Handle expired subscriptions |
| Expiry Warning | Daily | Email warnings before subscription expires |
| Diary Reminder | Daily | Remind inactive clients to journal |
| CSRF Cleanup | Hourly | Remove expired CSRF tokens |
| Database Backup | Configurable | Automated encrypted backups |

### 10.6 Deployment

- **Target:** Dokploy on Hetzner (or any Docker-compatible host)
- **SSL:** Via reverse proxy (Traefik, Caddy, or Dokploy built-in)
- **CI/CD:** Git-based deployment via Dokploy

---

## Appendix A: Project Structure

```
src/
  backend/
    src/
      config/         # App configuration
      db/             # Database schema, connection
      middleware/     # Auth, CSRF, rate limiting, i18n
      models/         # Data models
      routes/         # API route handlers (15 files)
      services/       # Business logic (19 files)
        aiProviders/  # Multi-provider AI abstraction
      i18n/           # Backend translations (EN, RU, ES, UK)
      utils/          # Shared utilities
    backups/          # Database backup storage
    data/             # SQLite database files
  frontend/
    src/
      components/     # Reusable UI components (14 files)
      contexts/       # React context providers
      hooks/          # Custom hooks (4 files)
      i18n/           # Frontend translations (EN, RU, ES, UK)
      pages/          # Page components (22 files)
      styles/         # Global styles
      utils/          # Frontend utilities
    public/
      icons/          # PWA icons (192x192, 512x512)
      images/         # Brand images
      manifest.json   # PWA manifest
      sw.js           # Service worker
  bot/
    src/
      index.js        # Bot entry point with commands and handlers
      i18n.js         # Bot translations (EN, RU, ES, UK)
docs/
  PRD.md              # This document
```

---

## Appendix B: API Route Summary

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/register | Public | Therapist registration |
| POST | /api/auth/login | Public | Login |
| POST | /api/auth/logout | Auth | Logout |
| POST | /api/auth/forgot-password | Public | Request password reset |
| POST | /api/auth/reset-password | Public | Reset password with token |
| GET | /api/auth/me | Auth | Current user profile |
| GET | /api/clients | Therapist | List therapist's clients |
| POST | /api/clients | Therapist | Create client |
| GET | /api/clients/:id | Therapist | Client detail |
| PUT | /api/clients/:id | Therapist | Update client |
| DELETE | /api/clients/:id | Therapist | Delete client |
| GET | /api/clients/:id/diary | Therapist | Client diary entries |
| POST | /api/sessions | Therapist | Upload session audio |
| GET | /api/sessions/:id | Therapist | Session detail |
| GET | /api/sessions/:id/stream | Therapist | Stream audio/video |
| POST | /api/sessions/:id/transcribe | Therapist | Trigger transcription |
| POST | /api/sessions/:id/summarize | Therapist | Trigger summarization |
| DELETE | /api/sessions/:id | Therapist | Delete session |
| GET | /api/exercises | Therapist | Exercise library |
| POST | /api/exercises | Therapist | Create custom exercise |
| PUT | /api/exercises/:id | Therapist | Update exercise |
| DELETE | /api/exercises/:id | Therapist | Delete exercise |
| GET | /api/dashboard/stats | Therapist | Dashboard statistics |
| GET | /api/dashboard/activity | Therapist | Activity feed |
| GET | /api/dashboard/analytics | Therapist | Analytics data |
| POST | /api/search | Therapist | Semantic search |
| POST | /api/query | Therapist (Pro+) | Natural language query |
| GET | /api/export/client/:id | Therapist | Export client data |
| GET | /api/export/analytics | Therapist | Export analytics |
| GET | /api/export/zip | Therapist | Bulk export archive |
| GET | /api/subscription/current | Therapist | Current subscription |
| POST | /api/subscription/checkout | Therapist | Create checkout session |
| GET | /api/invite-code | Therapist | Get invite code |
| POST | /api/invite-code/regenerate | Therapist | Regenerate invite code |
| GET | /api/settings/profile | Therapist | Get profile settings |
| PUT | /api/settings/profile | Therapist | Update profile settings |
| POST | /api/webhooks/stripe | Public | Stripe webhook receiver |
| GET | /api/admin/therapists | Admin | List all therapists |
| PUT | /api/admin/therapists/:id/block | Admin | Block therapist |
| PUT | /api/admin/therapists/:id/unblock | Admin | Unblock therapist |
| GET | /api/admin/analytics | Admin | Platform analytics |
| GET | /api/admin/ai-usage | Admin | AI usage statistics |
| PUT | /api/admin/ai/limits | Admin | Set AI spending limits |
| GET | /api/admin/logs | Admin | System logs |
| GET | /api/admin/backup | Admin | Backup management |
| POST | /api/bot/register | Bot | Register user from bot |
| POST | /api/bot/diary | Bot | Submit diary entry |
| POST | /api/bot/sos | Bot | Trigger SOS event |
| GET | /api/health | Public | Health check |
