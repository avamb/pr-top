# PR-TOP

**Therapist-controlled between-session assistant platform**

PR-TOP helps practicing psychologists preserve client context, reduce double documentation, work deeper between sessions, and maintain therapist control over all sensitive client flows. Built on top of the MindSetHappyBot/3hours Telegram bot codebase.

> For the full Product Requirements Document, see [docs/PRD.md](docs/PRD.md).

## Architecture

The platform consists of three application components plus the web edge:

- **Web Application** (`src/frontend/`) - React + Tailwind CSS
  - Public landing page with pricing and registration
  - Therapist dashboard (client management, analytics, sessions)
  - Superadmin panel (platform management, AI configuration, statistics, logs)

- **Backend API** (`src/backend/`) - Node.js REST API
  - SQLite database (via `sql.js`, SQLite compiled to WebAssembly) with application-layer encryption for sensitive data. The whole database lives in memory and is flushed atomically to `/app/data` (see `src/backend/src/db/connection.js`); a move to `better-sqlite3` with WAL is planned but not done.
  - Stripe integration for subscription management
  - Vector DB for semantic search
  - AI summarization and transcription pipelines
  - WebSocket notifications for real-time updates

- **Telegram Bot** (`src/bot/`) - Telegram Bot API
  - Client diary input (text, voice, video)
  - Custom Exercises ("My Exercises") and pre-seeded exercise library
  - SOS/safety features with escalation notifications
  - Client consent management

- **Web edge** - Cloudflare (SSL Full) -> Dokploy Traefik -> the `frontend` container's nginx (`src/frontend/nginx.conf`)
  - Serves the prerendered SPA, proxies `/api/` and `/ws` to the backend (`backend:3001`) and `/analytics/` to Umami
  - Security headers and cache policy live in `src/frontend/security-headers.conf`; TLS is terminated at Cloudflare/Traefik, not inside the stack
  - The top-level `nginx/` directory is a legacy standalone reverse proxy and is **not** used by `docker-compose.yml`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Tailwind CSS, React Router, Zustand, i18next |
| Backend | Node.js 22, Express, SQLite (sql.js), Stripe SDK, node-cron |
| Bot | Telegram Bot API |
| AI | OpenAI, Anthropic, Google Gemini, OpenRouter (configurable) |
| Transcription | OpenAI Whisper (configurable provider) |
| Search | Vector embeddings for semantic search |
| Real-time | WebSocket (ws) |
| Email | Nodemailer (SMTP) |
| Languages | English, Russian, Spanish, Ukrainian |
| PWA | Service worker, manifest.json |

## Getting Started

### Prerequisites

- Node.js 22 (the Docker images and CI use Node 22)
- npm
- Telegram Bot Token
- Stripe API Keys (test mode for development)

### Setup

```bash
# Make init script executable
chmod +x init.sh

# Run the setup and start script
./init.sh
```

This will:
1. Install all dependencies
2. Set up the SQLite database
3. Start the backend server (port 3001)
4. Start the frontend dev server (port 3000)

### Tests and CI

```bash
# Backend: node:test suites, each file boots its own temp database with dummy env
cd src/backend && npm test

# Bot: unit tests for the pure helpers (escapeMd, mdInEntity, commandRegex, redact)
cd src/bot && npm test
```

The tests never read `.env` and make no network calls (Stripe, Telegram, SMTP and LLM calls are stubbed). GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and pull requests to `dev` and `master`: per package `npm ci`, `node --check` on all sources and `npm test`; for the backend also `npm run docs:assistant:check` and `node _t_assistant_kb_audit.js`; for the frontend `npx vite build` (no prerender). `npm audit` runs as a non-blocking step.

### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health

## Project Structure

```
src/
  backend/
    src/
      config/       # App configuration
      db/           # Database schema, migrations, connection
      middleware/   # Auth, CSRF, rate limiting, i18n, encryption
      models/       # Data models
      routes/       # API route handlers
      services/     # Business logic (encryption, AI, Stripe, etc.)
        aiProviders/ # Multi-provider AI abstraction (OpenAI, Anthropic, Google, OpenRouter)
      i18n/         # Backend translations (EN, RU, ES, UK)
      utils/        # Shared utilities
  frontend/
    src/
      components/   # Reusable UI components
      contexts/     # React context providers
      hooks/        # Custom hooks
      i18n/         # Internationalization (EN, RU, ES, UK)
      pages/        # Page components
      styles/       # Global styles
      utils/        # Frontend utilities
    public/         # Static assets, PWA manifest, service worker
  bot/
    src/
      index.js      # Telegram bot entry point
      i18n.js       # Bot translations (EN, RU, ES, UK)
.github/
  workflows/ci.yml      # CI (backend, bot, frontend)
scripts/
  generate-assistant-docs.mjs  # `npm run docs:assistant` (assistant KB reference)
  legacy/               # old one-off audit/debug scripts, kept for reference
nginx/                  # legacy standalone reverse proxy, NOT used by docker-compose.yml
docs/
  PRD.md                # Full Product Requirements Document
  assistant-kb/         # Knowledge base for the "Ask about PR-TOP" assistant
```

Backend and bot tests live in `src/backend/test/` and `src/bot/test/`.

## Security

- **Class A data** (diary content, notes, transcripts, summaries) is encrypted at the application layer before database storage
- **Encryption key versioning and rotation** supported
- **Audit logging** for all sensitive data access
- **Role-based access control** (therapist, client, superadmin)
- **Consent-based data sharing** - clients explicitly grant/revoke therapist access
- **CSRF protection** with double-submit cookie pattern
- **Rate limiting** on authentication endpoints

## Subscription Tiers

| Feature | Trial | Basic | Pro | Premium |
|---------|-------|-------|-----|---------|
| Price | Free | ~$19/mo | ~$49/mo | ~$99/mo |
| Clients | 3 | 10 | 30 | Unlimited |
| Sessions/mo | 5 | 20 | 60 | Unlimited |
| NL Queries | No | No | Yes | Yes |
| Analytics | Basic | Basic | Full | Full + Export |

## Environment Variables

All secrets are injected via `.env` file (never baked into images). See `.env.example` for the full list.

### Required Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Random string for JWT signing |
| `ENCRYPTION_MASTER_KEY` | Random string for data encryption |
| `BOT_API_KEY` | Shared secret between bot and backend |
| `TELEGRAM_BOT_TOKEN` | From BotFather |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API key for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `AI_PROVIDER` | AI provider: openai, anthropic, google, openrouter (default: openai) |
| `AI_MODEL` | AI model name (default: gpt-4o-mini) |
| `AI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude models) |
| `GOOGLE_AI_API_KEY` | Google AI API key (for Gemini models) |
| `OPENROUTER_API_KEY` | OpenRouter API key (unified model access) |
| `TRANSCRIPTION_PROVIDER` | Transcription provider (default: openai) |
| `TRANSCRIPTION_MODEL` | Transcription model (default: whisper-1) |
| `TRANSCRIPTION_API_KEY` | Transcription API key |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP server port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender email address |
| `SCHEDULER_ENABLED` | Enable scheduled tasks (default: true) |
| `BACKUP_DIR` | Backup directory (default: ./backups) |
| `BACKUP_RETENTION_COUNT` | Number of backups to retain (default: 30) |
| `BACKUP_CRON` | Backup schedule (default: 0 3 * * *) |
| `LOG_LEVEL` | Logging level (default: info) |
| `DOMAIN` | Production domain name (e.g., prtop.example.com) |
| `SSL_EMAIL` | Email for Let's Encrypt certificate |

## Docker Deployment

PR-TOP is containerized for deployment via Docker Compose (compatible with Dokploy on Hetzner).

### Quick Start with Docker

```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env with your actual secrets, Telegram token, Stripe keys, etc.

# 2. Build and start all services
docker-compose up --build -d

# 3. Access the application
# The compose file only `expose`s ports (no host port mapping). Put a reverse
# proxy in front (production: Dokploy/Traefik) or add a `ports:` mapping to the
# `frontend` service locally. The frontend nginx then serves:
#   Landing page:    /
#   Backend API:     /api/health
#   Umami analytics: /analytics/
```

### Services

| Service | Description | Port |
|---------|-------------|------|
| **frontend** | React SPA served via nginx; proxies `/api/`, `/ws`, `/analytics/` (entry point behind Traefik) | 80 (internal) |
| **backend** | Node.js Express API with SQLite (sql.js) | 3001 (internal) |
| **bot** | Telegram bot (long-polling, no port) | none |
| **umami** | Umami web analytics (privacy-first) | 3000 (internal) |
| **umami-db** | PostgreSQL for Umami data | 5432 (internal) |

### Architecture

- **Frontend nginx** (`src/frontend/nginx.conf`): the single HTTP entry point of the stack. Serves the prerendered SPA, proxies `/api/` and `/ws` to the backend and `/analytics/` to Umami, and sets security headers and cache policy. Cloudflare (SSL Full) and Dokploy's Traefik sit in front of it.
- **Frontend image**: multi-stage build (Vite build + Playwright prerender, then nginx:alpine).
- **Backend**: Node.js 22 Alpine, runs as the unprivileged `node` user. SQLite data persisted in a Docker named volume (`backend-data`). The image also carries a read-only snapshot of only the files the assistant knowledge base reads (`docs/assistant-kb`, `docs/*.md`, `README.md`, UI i18n strings) under `/app/project-root`.
- **Bot**: Node.js 22 Alpine, unprivileged. Connects to the backend via the internal Docker network and receives only the environment variables it needs.
- **Umami**: Privacy-first analytics accessible at `/analytics/` through the frontend nginx.

### TLS (Production)

TLS is terminated outside this stack: Cloudflare (SSL mode Full) in front of Dokploy's Traefik, which forwards to the `frontend` container on port 80. There is nothing to configure in the repo for certificates.

### Production Notes

- Change all default secrets in `.env` before deploying
- No service publishes host ports; Traefik (Dokploy) routes to the `frontend` container, and every other service is internal
- Set `UMAMI_APP_SECRET` and `UMAMI_DB_PASSWORD` (and a matching `UMAMI_DATABASE_URL`) in Dokploy: compose falls back to insecure local defaults when they are unset
- The `backend-data` volume persists the SQLite database across container restarts
- The `backend-uploads` volume persists encrypted audio/video session files separately
- Health checks are configured on every service (the bot's checks a heartbeat file it rewrites every 30 s while Telegram polling works); the frontend and bot wait for the backend to be healthy

### Backend Resilience (auto-restart on hang / memory growth)

Docker only *marks* a container unhealthy — it never restarts it. After a
two-day API hang in September 2026 (slow memory growth → GC thrash → blocked
event loop → every `/api/*` request hanging) the backend now has layered
guard rails; details and the incident write-up are in
[`docs/troubleshooting/backend-hang-runbook.md`](docs/troubleshooting/backend-hang-runbook.md).

- `GET /api/health/live` — cheap liveness probe (no Stripe/network calls) used by the container healthcheck.
- `src/backend/healthcheck.sh` — after `HEALTHCHECK_MAX_FAILURES` consecutive misses it kills the node process; `restart: unless-stopped` recreates it (compose runs the container with `init: true` so the kill is honoured).
- In-process memory watchdog — logs `[MEMORY] rss=…` hourly and exits (→ restart) once RSS ≥ `MEMORY_WATCHDOG_MAX_RSS_MB` (default 1024).
- `NODE_OPTIONS=--max-old-space-size=768 --heapsnapshot-signal=SIGUSR2` — V8 aborts fast on a leak; `docker kill -s SIGUSR2 <backend>` writes a heap snapshot to `/app` for analysis.
- `mem_limit`/`memswap_limit` (1536m backend, 512m bot and umami, 256m umami-db, 128m frontend) — hard ceiling, no swap, so one service can no longer drag the host into swap thrash.
- Graceful shutdown on SIGTERM: scheduler stopped, in-memory SQLite flushed to disk, server closed.

### Common Commands

```bash
# View logs
docker-compose logs -f

# Restart a single service
docker-compose restart backend

# Rebuild after code changes
docker-compose up --build -d

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

## License

Proprietary - All rights reserved.
