# Multi-stage Docker build for xBOT production
# Builder stage: Install deps and compile TypeScript
FROM node:20-bullseye AS builder

WORKDIR /app

# Install CA certificates for SSL with retry logic
RUN for i in 1 2 3; do \
    apt-get update && \
    apt-get install -y ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/* && break || \
    { echo "Attempt $i failed, retrying in 5s..."; sleep 5; }; \
    done

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --no-audit

# Copy TypeScript config and source files
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts

# Build TypeScript to dist/
RUN npm run build

# Runtime stage: Production-only dependencies and compiled JS
FROM node:20-bullseye AS runtime

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Install CA certificates + Playwright system dependencies with retry logic
RUN for i in 1 2 3; do \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libasound2 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libxshmfence1 \
        libxkbcommon0 && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/* && break || \
    { echo "Attempt $i failed, retrying in 5s..."; sleep 5; }; \
    done

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit

# Install Playwright browser binary only (system deps already installed above)
RUN npx playwright install chromium

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy scripts and tools
COPY scripts ./scripts
COPY tools ./tools

# Health check - more lenient for Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/status || exit 1

# Expose port
EXPOSE ${PORT:-8080}

# Start with compiled entry point
CMD ["node", "dist/src/main-bulletproof.js"]