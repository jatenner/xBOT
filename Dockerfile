FROM mcr.microsoft.com/playwright:v1.47.0-jammy
WORKDIR /app
ENV NODE_ENV=production NPM_CONFIG_CACHE=/tmp/.npm LIVE_POSTS=false
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm","run","start:prod"]