# Railway deployment Dockerfile
FROM node:18-slim

# Install SSL certificates
RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Create SSL directory and download Supabase CA
RUN mkdir -p /etc/ssl/certs/
RUN curl -s https://raw.githubusercontent.com/supabase/postgres-meta/main/certs/prod-ca-2021.crt \
    -o /etc/ssl/certs/supabase-ca.crt

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

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