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

# Expose backend port
EXPOSE 3001

# Run database migrations then start the server
CMD ["npm", "start"]
