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

# Build TypeScript (creates empty dist folder for compatibility)
RUN npm run build || true

# Production stage
FROM mcr.microsoft.com/playwright:v1.48.2-noble

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies (tsx and typescript are now in dependencies)
RUN npm ci --omit=dev --no-audit

# Copy source code (needed for tsx runtime)
COPY --from=builder /app/src ./src

# Copy supporting directories (guaranteed to exist from builder stage)
COPY --from=builder /app/public ./public
COPY --from=builder /app/supabase ./supabase
COPY --from=builder /app/dist ./dist

# Expose port (Railway sets PORT env var)
EXPOSE 8080

# Start application via npm start (runs tsx src/railwayEntrypoint.ts)
# Entrypoint starts server immediately, then runs background init
CMD ["npm", "start"]

