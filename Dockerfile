# 🚀 RELIABLE RAILWAY DEPLOYMENT (Forces Docker builder, no Nixpacks cache mounts)
FROM node:20-alpine as build

WORKDIR /app

ENV NODE_ENV=development \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_CACHE=/tmp/npmcache

# 1) Install deps with devDependencies so TypeScript can compile
COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=warn

# 2) Copy source and build
COPY . .
RUN npx tsc --skipLibCheck

# 3) Create runtime image with pruned deps
FROM node:20-alpine as runtime
WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_CACHE=/tmp/npmcache

# Copy package files to run prune in identical tree
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=warn || true

# Copy built app and needed files
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/emergency_simple_start.js ./
COPY --from=build /app/.npmrc ./

# Default port (adjust if your app uses another)
EXPOSE 3000

CMD ["node", "emergency_simple_start.js"]
