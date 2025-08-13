FROM mcr.microsoft.com/playwright:v1.47.2-jammy
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
CMD ["node","dist/main.js"]