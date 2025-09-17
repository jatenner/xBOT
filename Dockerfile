# -------- Build stage: install dev deps & compile TS --------
FROM node:18-bullseye AS build
WORKDIR /app

# Install CA certificates for TLS
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates && rm -rf /var/lib/apt/lists/*

# Force devDependencies installation even if Railway sets production flags
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false
ENV CI=true

COPY package*.json ./
RUN npm ci --include=dev

# Sanity check TypeScript is available
RUN npx tsc -v

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
COPY tools ./tools
COPY supabase ./supabase
COPY docker ./docker

# Compile TypeScript -> dist/ (production runtime only)
RUN npm run build

# -------- Runtime stage: slim prod image --------
FROM node:18-bullseye AS runtime
WORKDIR /app

# Install CA certificates for TLS in runtime stage
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Only production deps in runtime
COPY package*.json ./
RUN npm ci --omit=dev

# Bring compiled output + needed tools/migrations
COPY --from=build /app/dist ./dist
COPY --from=build /app/tools ./tools
COPY --from=build /app/supabase ./supabase
COPY --from=build /app/docker/entrypoint.sh ./docker/entrypoint.sh

# Ensure entrypoint is executable
RUN chmod +x ./docker/entrypoint.sh

# Healthcheck (adjust if you expose HTTP)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "process.exit(0)" || exit 1

EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]