# 🚀 RAILWAY PLAYWRIGHT-READY DEPLOYMENT
FROM node:20-alpine as build

WORKDIR /app

ENV NODE_ENV=development \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_CACHE=/tmp/npmcache

# 1) Install system dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# 2) Install Node.js deps with devDependencies
COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=warn

# 3) Copy source and build
COPY . .
RUN npx tsc --skipLibCheck

# 4) Runtime stage with Playwright support
FROM node:20-alpine as runtime
WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_CACHE=/tmp/npmcache \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 5) Install system deps for runtime (Alpine Chromium)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# 6) Copy package files and install production deps
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=warn

# 7) Copy built app and needed files
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/.npmrc ./

# 8) Create data directory for persistent session storage
RUN mkdir -p /app/data && chmod 777 /app/data

# Default port (Railway sets PORT); keep 3000 for local
EXPOSE 3000

# Start full app entrypoint
CMD ["node", "dist/main.js"]
