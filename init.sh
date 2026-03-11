#!/bin/bash
# PsyLink - Development Environment Setup & Start Script
# ======================================================
# This script installs dependencies and starts all services needed
# for development of the PsyLink therapist assistant platform.

set -e

PROJECT_ROOT="$(dirname "$(readlink -f "$0")")"

echo "============================================"
echo "  PsyLink - Development Environment Setup"
echo "============================================"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
if [[ "$NODE_VERSION" == "not found" ]]; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
echo "Node.js version: $NODE_VERSION"

# Check npm
NPM_VERSION=$(npm -v 2>/dev/null || echo "not found")
if [[ "$NPM_VERSION" == "not found" ]]; then
    echo "ERROR: npm is not installed."
    exit 1
fi
echo "npm version: $NPM_VERSION"

echo ""
echo "--- Installing Backend Dependencies ---"
if [ -f "$PROJECT_ROOT/src/backend/package.json" ]; then
    npm install --prefix "$PROJECT_ROOT/src/backend"
else
    echo "No backend package.json found. Skipping."
fi

echo ""
echo "--- Installing Frontend Dependencies ---"
if [ -f "$PROJECT_ROOT/src/frontend/package.json" ]; then
    npm install --prefix "$PROJECT_ROOT/src/frontend"
else
    echo "No frontend package.json found. Skipping."
fi

echo ""
echo "--- Installing Bot Dependencies ---"
if [ -f "$PROJECT_ROOT/src/bot/package.json" ]; then
    npm install --prefix "$PROJECT_ROOT/src/bot"
else
    echo "No bot package.json found. Skipping."
fi

echo ""
echo "--- Setting Up Environment ---"

# Create .env file if it doesn't exist
if [ ! -f "$PROJECT_ROOT/src/backend/.env" ]; then
    echo "Creating default .env file for backend..."
    cat > "$PROJECT_ROOT/src/backend/.env" << 'ENVEOF'
# PsyLink Backend Environment Variables
NODE_ENV=development
PORT=3001
DATABASE_URL=sqlite:./data/psylink.db
ENCRYPTION_MASTER_KEY=dev-master-key-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
AI_API_KEY=your-ai-api-key
TRANSCRIPTION_API_KEY=your-transcription-api-key
VECTOR_DB_URL=http://localhost:6333
LOG_LEVEL=debug
ENVEOF
fi

# Create data directory for SQLite
mkdir -p "$PROJECT_ROOT/src/backend/data"

echo ""
echo "--- Starting Services ---"

# Start backend server
echo "Starting backend server on port 3001..."
npm run dev --prefix "$PROJECT_ROOT/src/backend" &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend to start..."
sleep 5

# Start frontend dev server
echo "Starting frontend dev server on port 3000..."
npm run dev --prefix "$PROJECT_ROOT/src/frontend" &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "============================================"
echo "  PsyLink Development Environment Ready!"
echo "============================================"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo "  API Health: http://localhost:3001/api/health"
echo ""
echo "  Backend PID:  $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "============================================"

# Wait for any process to exit
wait
