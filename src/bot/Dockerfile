# Node 22 LTS, minor + Alpine release pinned for reproducible builds.
# (node:18 reached end of life in April 2025.)
FROM node:22.23.4-alpine3.24

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=384"

# The bot has no volumes and writes nothing to disk, so it can run as the
# unprivileged "node" user directly (no entrypoint needed). Code stays
# root-owned/read-only for node.
USER node

# Bot runs as a long-running process, no port exposed.
# Run node directly so signals and fatal aborts terminate the container.
CMD ["node", "src/index.js"]
