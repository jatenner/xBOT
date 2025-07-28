#!/bin/bash

# 🚀 RENDER BUILD SCRIPT FOR SNAP2HEALTH XBOT
# Ensures Playwright installs correctly with all dependencies

set -e  # Exit on any error

echo "🚀 Starting Render build process for Snap2Health xBOT..."

# Step 1: Install npm dependencies
echo "📦 Installing npm dependencies..."
npm ci

# Step 2: Install Playwright with system dependencies
echo "🎭 Installing Playwright browsers and system dependencies..."
npx playwright install --with-deps chromium

# Step 3: Verify Playwright installation
echo "🔍 Verifying Playwright installation..."
npx playwright --version

# Step 4: List installed browsers for debugging
echo "📋 Checking installed browser locations..."
find /opt/render/.cache/ms-playwright -name "*chrome*" -type f 2>/dev/null || echo "Browser paths not found in cache"

# Step 5: Build TypeScript project
echo "🔨 Building TypeScript project..."
NODE_OPTIONS=--max_old_space_size=1024 npm run build

echo "✅ Render build completed successfully!"
echo "🎯 Ready for autonomous Twitter domination!" 