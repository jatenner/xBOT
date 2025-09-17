# ---- Builder ----
FROM node:18-bullseye AS builder
WORKDIR /app

# Ensure npm version is stable with our lock
RUN npm i -g npm@10.8.2

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts

# Build Typescript (no JSX/Next)
RUN npm run build

# Prune to prod-only deps AFTER build
RUN npm prune --omit=dev

# ---- Runtime ----
FROM node:18-bullseye AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Only copy what we need
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist

# Health & start
EXPOSE 8080
CMD ["node","dist/main-bulletproof.js"]