# Multi-stage build for xBOT with proper Playwright support
FROM node:20.18.1-bullseye-slim AS builder

WORKDIR /app

# Install pnpm directly and disable corepack (avoid corepack keyid issues)
RUN npm install -g pnpm@10.18.2 && corepack disable || true

# Verify pnpm installation (proof that corepack shim is not used)
RUN /usr/local/bin/pnpm --version && which pnpm && echo "PNPM_PATH=$(which pnpm)"

# Copy package files and pnpm lockfile
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including TypeScript for build)
# Use absolute path to ensure corepack shim is not used
RUN /usr/local/bin/pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Ensure required directories exist (prevent COPY failures in production stage)
RUN mkdir -p dist public supabase

# Build TypeScript to dist/
# Use absolute path to ensure corepack shim is not used
RUN /usr/local/bin/pnpm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

# Install pnpm directly and disable corepack (avoid corepack keyid issues)
RUN npm install -g pnpm@10.18.2 && corepack disable || true

# Copy package files and pnpm lockfile
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only (no devDependencies needed)
# Use absolute path to ensure corepack shim is not used
RUN /usr/local/bin/pnpm install --prod --frozen-lockfile

# Prune production dependencies (remove devDependencies)
RUN /usr/local/bin/pnpm prune --prod

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

