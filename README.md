# PR-TOP

**Therapist-controlled between-session assistant platform**

PR-TOP helps practicing psychologists preserve client context, reduce double documentation, work deeper between sessions, and maintain therapist control over all sensitive client flows. Built on top of the MindSetHappyBot/3hours Telegram bot codebase.

> For the full Product Requirements Document, see [docs/PRD.md](docs/PRD.md).

## Architecture

The platform consists of four components:

- **Web Application** (`src/frontend/`) - React + Tailwind CSS
  - Public landing page with pricing and registration
  - Therapist dashboard (client management, analytics, sessions)
  - Superadmin panel (platform management, AI configuration, statistics, logs)

- **Backend API** (`src/backend/`) - Node.js REST API
  - SQLite database with application-layer encryption for sensitive data
  - Stripe integration for subscription management
  - Vector DB for semantic search
  - AI summarization and transcription pipelines
  - WebSocket notifications for real-time updates

- **Telegram Bot** (`src/bot/`) - Telegram Bot API
  - Client diary input (text, voice, video)
  - Custom Exercises ("My Exercises") and pre-seeded exercise library
  - SOS/safety features with escalation notifications
  - Client consent management

- **Nginx Reverse Proxy** (`nginx/`) - Single entry point
  - Routes `/` to frontend, `/api/` to backend, `/analytics/` to Umami
  - SSL/TLS termination (Let's Encrypt), rate limiting, security headers, gzip

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Tailwind CSS, React Router, Zustand, i18next |
| Backend | Node.js, Express, SQLite, Stripe SDK, node-cron |
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

- Node.js 18+
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
nginx/
  nginx.conf          # Reverse proxy server blocks (HTTP/HTTPS)
  locations.conf      # Shared location routing rules
  Dockerfile          # nginx:alpine with config
  certs/              # SSL certificates (not in repo)
docs/
  PRD.md            # Full Product Requirements Document
```

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
# All traffic goes through the Nginx reverse proxy:
# Landing page:   http://localhost/
# Backend API:    http://localhost/api/health
# Umami analytics: http://localhost/analytics/
```

### Services

| Service | Description | Port |
|---------|-------------|------|
| **nginx** | Reverse proxy — single entry point for all traffic | 80, 443 (public) |
| **frontend** | React SPA served via nginx (internal) | 80 (internal) |
| **backend** | Node.js Express API with SQLite | 3001 (internal) |
| **bot** | Telegram bot (long-polling, no port) | none |
| **umami** | Umami web analytics (privacy-first) | 3000 (internal) |
| **umami-db** | PostgreSQL for Umami data | 5432 (internal) |

### Architecture

- **Nginx Reverse Proxy**: Single entry point on ports 80/443. Routes `/` to frontend, `/api/` to backend, `/analytics/` to Umami. Includes rate limiting (30 req/s for API, 10 req/s for analytics), security headers (HSTS, X-Frame-Options, etc.), gzip compression, and WebSocket proxy support.
- **Frontend**: Multi-stage build (Vite build + nginx). Serves static SPA files only; API proxying handled by the external nginx reverse proxy.
- **Backend**: Node.js 18 Alpine. SQLite data persisted in a Docker named volume (`backend-data`).
- **Bot**: Node.js 18 Alpine. Connects to backend via internal Docker network.
- **Umami**: Privacy-first analytics accessible at `/analytics/` via the reverse proxy.

### SSL Setup (Production)

1. Set `DOMAIN` and `SSL_EMAIL` in `.env`
2. Place SSL certificates in `nginx/certs/` (or configure certbot)
3. Uncomment the HTTPS server block in `nginx/nginx.conf`
4. Uncomment the HTTP→HTTPS redirect

### Production Notes

- Change all default secrets in `.env` before deploying
- Only the nginx container exposes ports to the host — all other services are internal
- The `backend-data` volume persists the SQLite database across container restarts
- The `backend-uploads` volume persists encrypted audio/video session files separately
- Health checks are configured on all services; nginx waits for backend, frontend, and umami to be healthy

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
