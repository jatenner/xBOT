# Multi-stage build for xBOT with proper Playwright support
FROM node:20.18.1-bullseye-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including TypeScript for build)
RUN npm ci --no-audit

# Copy source code
COPY . .

# Ensure required directories exist (prevent COPY failures in production stage)
RUN mkdir -p dist public supabase

# Build TypeScript to dist/
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (no devDependencies needed)
RUN npm ci --omit=dev --no-audit

# Copy compiled JavaScript from dist/ (no source needed)
COPY --from=builder /app/dist ./dist
# Copy supporting directories (guaranteed to exist from builder stage)
COPY --from=builder /app/public ./public
COPY --from=builder /app/supabase ./supabase
# Copy package.json for node to resolve dependencies
COPY --from=builder /app/package.json ./package.json

# Expose port (Railway sets PORT env var)
EXPOSE 8080

# Start application via npm start (runs node dist/src/railwayEntrypoint.js)
# Entrypoint starts health server immediately, then runs background init
CMD ["npm", "start"]

