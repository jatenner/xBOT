# Production Dockerfile for xBOT on Railway
FROM node:22-bookworm-slim

# --- CA certificates + System dependencies ---
# Install CA bundle, openssl for debugging, and system deps for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl wget xvfb curl \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
 && update-ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# SSL Configuration - Use system CA bundle
ENV SSL_CERT_DIR=/etc/ssl/certs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# --- Install Chromium for Playwright ---
RUN npx --yes playwright install --with-deps chromium
ENV PLAYWRIGHT_BROWSERS_PATH=0

# Copy application code
COPY . .

# Build application
RUN npm run build

# Set production environment
ENV NODE_ENV=production

# SSL Configuration (verified only)
ENV DB_SSL_MODE=require
ENV MIGRATION_SSL_MODE=require
ENV ALLOW_SSL_FALLBACK=false

# Default environment variables
ENV DAILY_OPENAI_LIMIT_USD=5
ENV POSTING_DISABLED=true
ENV REAL_METRICS_ENABLED=true

# Expose port
EXPOSE 8080

# Start application (prestart will run migrations automatically)
CMD ["npm", "start"]