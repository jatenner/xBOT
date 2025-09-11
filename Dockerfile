# Railway deployment Dockerfile
FROM node:18-slim

# Install SSL certificates
RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*

# --- CA cert for Supabase SSL ---
RUN mkdir -p /etc/ssl/certs \
 && curl -fsSL https://r2.supabase.com/ca-certs/supabase-ca.crt -o /etc/ssl/certs/supabase-ca.crt

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# --- Playwright browsers ---
# Install Chromium with dependencies at build time (no runtime downloads)
RUN npx playwright install --with-deps chromium

# Copy application code
COPY . .

# Ensure critical directories are present
RUN mkdir -p supabase/migrations scripts
COPY supabase/migrations/ ./supabase/migrations/
COPY scripts/ ./scripts/

# Build application
RUN npm run build

# Expose port
EXPOSE 8080

# Set environment variables for SSL
ENV DB_SSL_MODE=require
ENV DB_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt
ENV MIGRATION_SSL_MODE=require
ENV MIGRATION_SSL_ROOT_CERT_PATH=/etc/ssl/certs/supabase-ca.crt

# Start application
CMD ["npm", "start"]