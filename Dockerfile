# Multi-stage build for xBOT with proper Playwright support
# Base stage: Install pnpm once
FROM node:20.18.1-bullseye-slim AS base

WORKDIR /app

# Force npm global prefix to /usr/local
ENV NPM_CONFIG_PREFIX=/usr/local
ENV PATH=/usr/local/bin:$PATH

# Install pnpm and verify installation
RUN npm i -g pnpm@10.18.2 && pnpm --version && npm config get prefix && command -v pnpm

# Disable corepack (non-critical, allow failure)
RUN corepack disable || true

# Builder stage: Install deps and build TypeScript
FROM base AS builder

# Copy package files and pnpm lockfile
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including TypeScript for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Ensure required directories exist (prevent COPY failures in production stage)
RUN mkdir -p dist public supabase

# Build TypeScript to dist/
RUN pnpm run build

# Production stage: Use Playwright base + pnpm from base
FROM mcr.microsoft.com/playwright:v1.57.0-noble AS runner

WORKDIR /app

# Copy pnpm installation from base stage
COPY --from=base /usr/local/bin/pnpm /usr/local/bin/pnpm
COPY --from=base /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/pnpm

# Ensure pnpm is in PATH
ENV PATH=/usr/local/bin:$PATH

# Copy package files and pnpm lockfile
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only (no devDependencies needed)
RUN pnpm install --prod --frozen-lockfile

# Prune production dependencies (remove devDependencies)
RUN pnpm prune --prod

# Copy compiled JavaScript from dist/ (no source needed)
COPY --from=builder /app/dist ./dist
# Copy supporting directories (guaranteed to exist from builder stage)
COPY --from=builder /app/public ./public
COPY --from=builder /app/supabase ./supabase
# Copy package.json for runtime
COPY --from=builder /app/package.json ./package.json
# node_modules already installed in this stage via pnpm install --prod above

# Expose port (Railway sets PORT env var dynamically)
EXPOSE 8080

# Start application directly (runs node dist/src/railwayEntrypoint.js)
# Entrypoint starts health server immediately, then runs background init
CMD ["node", "dist/src/railwayEntrypoint.js"]
