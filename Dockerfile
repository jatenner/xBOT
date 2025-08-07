# 🚀 SIMPLIFIED RAILWAY DEPLOYMENT
# Minimal, reliable build process

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with clean cache
RUN npm ci --only=production=false --no-cache --silent

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc --skipLibCheck

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "optimized_start.js"]