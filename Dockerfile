# Production Dockerfile for xBOT on Railway
FROM node:lts-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- CA cert for Supabase SSL ---
RUN mkdir -p /etc/ssl/certs \
 && (curl -fsSL https://raw.githubusercontent.com/supabase/postgres-meta/main/certs/prod-ca-2021.crt -o /etc/ssl/certs/supabase-ca.crt \
     || curl -fsSL https://cacerts.digicert.com/DigiCertGlobalRootCA.crt.pem -o /etc/ssl/certs/supabase-ca.crt)

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# --- Playwright browsers ---
# Install Chromium with dependencies at build time (prevents Railway runtime errors)
RUN npx playwright install --with-deps chromium

# Verify browser installation
RUN npx playwright --version && \
    ls -la /root/.cache/ms-playwright/ || echo "Playwright cache not found"

# Copy application code
COPY . .

# Build application
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Environment variables for SSL
ENV DB_SSL_MODE=require
ENV DB_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt
ENV MIGRATION_SSL_MODE=require
ENV MIGRATION_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt

# Default environment variables
ENV DAILY_OPENAI_LIMIT_USD=5
ENV POSTING_DISABLED=true
ENV REAL_METRICS_ENABLED=true

# Expose port
EXPOSE 8080

# Start application (prestart will run migrations automatically)
CMD ["npm", "start"]