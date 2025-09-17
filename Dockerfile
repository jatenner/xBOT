# Multi-stage Docker build for xBOT production
# Builder stage: Install deps and compile TypeScript
FROM node:20-bullseye AS builder

WORKDIR /app

# Install CA certificates for SSL
RUN apt-get update && apt-get install -y ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

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

# Install CA certificates for SSL
RUN apt-get update && apt-get install -y ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy tools for startup
COPY tools/start.js ./tools/start.js

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/status || exit 1

# Expose port
EXPOSE 8080

# Start with compiled entry point
CMD ["node", "dist/src/main-bulletproof.js"]