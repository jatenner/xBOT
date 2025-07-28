#!/bin/bash

# 🚀 RENDER BUILD SCRIPT FOR PLAYWRIGHT
# Installs Playwright browsers and dependencies for Render deployment

echo "🚀 Starting Render build process..."

# Install Playwright browsers with system dependencies
echo "📦 Installing Playwright browsers and dependencies..."
npx playwright install --with-deps chromium

# Verify Playwright installation
echo "🔍 Verifying Playwright installation..."
npx playwright --version

# Build the TypeScript project
echo "🔨 Building TypeScript project..."
npm run build

echo "✅ Render build completed successfully!" 