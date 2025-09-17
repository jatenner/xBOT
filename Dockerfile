# ---- Builder ----
FROM node:20-bullseye AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts

# Build Typescript (no JSX/Next)
RUN npm run build

# ---- Runtime ----
FROM node:20-bullseye AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY tools/start.js ./tools/start.js

# Health & start
EXPOSE 8080
CMD ["node","tools/start.js"]