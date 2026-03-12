# PsyLink

**Therapist-controlled between-session assistant platform**

PsyLink helps practicing psychologists preserve client context, reduce double documentation, work deeper between sessions, and maintain therapist control over all sensitive client flows. Built on top of the MindSetHappyBot/3hours Telegram bot codebase.

## Architecture

The platform consists of three components:

- **Web Application** (`src/frontend/`) - React + Tailwind CSS
  - Public landing page with pricing and registration
  - Therapist dashboard (client management, analytics, sessions)
  - Superadmin panel (platform management, statistics, logs)

- **Backend API** (`src/backend/`) - Node.js REST API
  - SQLite database with application-layer encryption for sensitive data
  - Stripe integration for subscription management
  - Vector DB for semantic search
  - AI summarization and transcription pipelines

- **Telegram Bot** (`src/bot/`) - Telegram Bot API
  - Client diary input (text, voice, video)
  - Therapist workspace (client management, notes, queries)
  - SOS/safety features

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Tailwind CSS, React Router, Zustand, i18next |
| Backend | Node.js, Express, SQLite, Stripe SDK |
| Bot | Telegram Bot API |
| AI | Speech-to-text, AI summarization, embeddings |
| Search | Vector DB for semantic search |
| Languages | Russian, English, Spanish |

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
      middleware/   # Auth, CSRF, rate limiting, encryption
      models/       # Data models
      routes/       # API route handlers
      services/     # Business logic (encryption, AI, Stripe, etc.)
      utils/        # Shared utilities
  frontend/
    src/
      components/   # Reusable UI components
      contexts/     # React context providers
      hooks/        # Custom hooks
      i18n/         # Internationalization (RU/EN/ES)
      pages/        # Page components
      styles/       # Global styles
      utils/        # Frontend utilities
    public/         # Static assets
  bot/
    src/
      commands/     # Telegram bot commands (/start, /clients, etc.)
      handlers/     # Message and callback handlers
      services/     # Bot business logic
      utils/        # Bot utilities
```

## Security

- **Class A data** (diary content, notes, transcripts, summaries) is encrypted at the application layer before database storage
- **Encryption key versioning and rotation** supported
- **Audit logging** for all sensitive data access
- **Role-based access control** (therapist, client, superadmin)
- **Consent-based data sharing** - clients explicitly grant/revoke therapist access

## Subscription Tiers

| Feature | Trial | Basic | Pro | Premium |
|---------|-------|-------|-----|---------|
| Price | Free | ~$19/mo | ~$49/mo | ~$99/mo |
| Clients | 3 | 10 | 30 | Unlimited |
| Sessions/mo | 5 | 20 | 60 | Unlimited |
| NL Queries | No | No | Yes | Yes |
| Analytics | Basic | Basic | Full | Full + Export |

## Docker Deployment

PsyLink is containerized for deployment via Docker Compose (compatible with Dokploy on Hetzner).

### Quick Start with Docker

```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env with your actual secrets, Telegram token, Stripe keys, etc.

# 2. Build and start all services
docker-compose up --build -d

# 3. Access the application
# Frontend: http://localhost (port 80)
# Backend API: http://localhost/api/health (proxied through nginx)
```

### Services

| Service | Description | Port |
|---------|-------------|------|
| **frontend** | React SPA served via nginx, proxies /api/* to backend | 80 (exposed) |
| **backend** | Node.js Express API with SQLite | 3001 (internal) |
| **bot** | Telegram bot (long-polling, no port) | none |

### Architecture

- **Frontend**: Multi-stage build (Vite build + nginx). Nginx serves static files and reverse-proxies `/api/*` to the backend container.
- **Backend**: Node.js 18 Alpine. SQLite data persisted in a Docker named volume (`backend-data`).
- **Bot**: Node.js 18 Alpine. Connects to backend via internal Docker network.

### Environment Variables

All secrets are injected via `.env` file (never baked into images). See `.env.example` for the full list. Required variables for production:

- `JWT_SECRET` - Random string for JWT signing
- `ENCRYPTION_MASTER_KEY` - Random string for data encryption
- `BOT_API_KEY` - Shared secret between bot and backend
- `TELEGRAM_BOT_TOKEN` - From BotFather
- `STRIPE_SECRET_KEY` - Stripe API key (optional)

### Production Notes

- Change all default secrets in `.env` before deploying
- The `backend-data` volume persists the SQLite database across container restarts
- The `backend-uploads` volume persists encrypted audio/video session files separately
- For HTTPS, configure a reverse proxy (Traefik, Caddy, or Dokploy's built-in SSL) in front of the frontend container
- Health checks are configured on the backend; frontend waits for backend to be healthy before starting

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
