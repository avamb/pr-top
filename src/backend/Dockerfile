# Node 22 LTS, minor + Alpine release pinned for reproducible builds.
# (node:18 reached end of life in April 2025.)
FROM node:22.23.4-alpine3.24

# su-exec: the entrypoint starts as root only to repair volume ownership and
# then drops to the unprivileged "node" user (see docker-entrypoint.sh).
RUN apk add --no-cache su-exec

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

# Create data directories for SQLite and file uploads, and make /app itself
# (non-recursive) writable for node so V8 heap snapshots (SIGUSR2) can be
# written to the cwd. Application code under /app/src stays root-owned and
# read-only for node. docker-entrypoint.sh re-owns the volumes at start-up
# (existing prod volumes are root-owned).
RUN mkdir -p /app/data /app/data/sessions /app/backups \
 && chown node:node /app /app/data /app/data/sessions /app/backups

# Liveness probe + watchdog used by the compose healthcheck (see healthcheck.sh)
COPY src/backend/healthcheck.sh /app/healthcheck.sh

# Entrypoint: chown volumes as root, then `exec su-exec node "$@"`.
# The sed strips CR characters in case the scripts were checked out with CRLF
# line endings (a CR in the shebang line would break them).
COPY src/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh /app/healthcheck.sh \
 && chmod +x /usr/local/bin/docker-entrypoint.sh /app/healthcheck.sh

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
# `init: true`, so docker-init is PID 1; the entrypoint execs su-exec which
# execs node, so node is an ordinary child of docker-init running as "node".
# The image USER stays root on purpose (the entrypoint needs it to fix volume
# ownership, and healthcheck.sh needs it to signal node); node itself never
# runs as root.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
