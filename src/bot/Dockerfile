FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=384"

# Bot runs as a long-running process, no port exposed.
# Run node directly so signals and fatal aborts terminate the container.
CMD ["node", "src/index.js"]
