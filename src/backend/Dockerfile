FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY src/backend/package.json src/backend/package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy backend runtime source
COPY src/backend/src/ ./src/

# Package a read-only snapshot of the repo for assistant knowledge indexing.
# Dokploy production deploys do not provide the expected bind mounts, so the
# knowledge base must index files already present inside the image.
RUN mkdir -p /app/project-root
COPY src/ /app/project-root/src/
COPY docs/ /app/project-root/docs/
COPY docker-compose.yml README.md .env.example /app/project-root/

# Create data directories for SQLite and file uploads
RUN mkdir -p /app/data /app/data/sessions

# Liveness probe + watchdog used by the compose healthcheck (see healthcheck.sh)
COPY src/backend/healthcheck.sh /app/healthcheck.sh
RUN chmod +x /app/healthcheck.sh

ENV NODE_ENV=production
# Cap the V8 heap well below the container memory limit so a leak ends in a
# fast "heap out of memory" abort (and a restart) instead of hours of GC
# thrashing with a blocked event loop. SIGUSR2 writes a heap snapshot to /app
# for offline analysis (`docker kill -s SIGUSR2 <container>`).
ENV NODE_OPTIONS="--max-old-space-size=768 --heapsnapshot-signal=SIGUSR2"

# Expose backend port
EXPOSE 3001

# Run node directly (not via `npm start`) so signals reach the process and a
# fatal V8 abort terminates the container immediately. compose sets
# `init: true`, so docker-init is PID 1 and node is an ordinary child.
CMD ["node", "src/index.js"]
