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

## License

Proprietary - All rights reserved.
