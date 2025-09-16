# ---------- Build stage ----------
FROM node:18-bullseye AS build
WORKDIR /app

# Speed up installs
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY tools ./tools
COPY supabase ./supabase

# Build TypeScript to dist/
RUN npm run build

# ---------- Runtime stage ----------
FROM node:18-bullseye AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Prune dev deps to keep the image small
COPY package*.json ./
RUN npm ci --omit=dev

# Bring compiled code + tools only
COPY --from=build /app/dist ./dist
COPY --from=build /app/tools ./tools
COPY --from=build /app/supabase ./supabase
COPY docker/entrypoint.sh ./docker/entrypoint.sh

# Health check endpoint (adjust the path if you have an HTTP server)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "process.exit(0)" || exit 1

EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]