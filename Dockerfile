FROM mcr.microsoft.com/playwright:v1.47.2-jammy
ENV NODE_ENV=production
# ✅ Force Playwright to use the preinstalled browsers in the image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
CMD ["node","dist/main.js"]