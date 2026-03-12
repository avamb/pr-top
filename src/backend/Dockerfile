FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/

# Create data directories for SQLite and file uploads
RUN mkdir -p /app/data /app/data/sessions

# Expose backend port
EXPOSE 3001

# Run database migrations then start the server
CMD ["npm", "start"]
