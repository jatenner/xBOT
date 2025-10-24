# Multi-stage build for xBOT with proper Playwright support
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including TypeScript for build)
RUN npm ci --no-audit

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.48.2-noble

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --no-audit

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "dist/src/main-bulletproof.js"]

