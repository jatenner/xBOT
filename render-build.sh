#!/bin/bash

# 🚀 RENDER BUILD SCRIPT FOR SNAP2HEALTH XBOT
# Ensures Playwright installs correctly with all dependencies

set -e  # Exit on any error

echo "🚀 Starting Render build process for Snap2Health xBOT..."

# Step 1: Install npm dependencies
echo "📦 Installing npm dependencies..."
npm ci

# Step 2: Install Playwright browsers with system dependencies (Render compatible)
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium --force

# Step 3: Verify Playwright installation
echo "🔍 Verifying Playwright installation..."
npx playwright --version

# Step 4: Debug browser installation paths
echo "📋 Debugging browser installation..."
echo "Checking /opt/render/.cache/ms-playwright directory:"
ls -la /opt/render/.cache/ms-playwright/ 2>/dev/null || echo "No playwright cache found"

echo "Searching for chromium executables:"
find /opt/render/.cache/ms-playwright -name "*chrom*" -type f 2>/dev/null | head -10 || echo "No chromium found"

echo "Searching for any browser executables:"
find /opt/render/.cache/ms-playwright -type f -executable 2>/dev/null | head -10 || echo "No executables found"

# Step 5: Build TypeScript project
echo "🔨 Building TypeScript project..."
NODE_OPTIONS=--max_old_space_size=1024 npm run build

echo "✅ Render build completed successfully!"
echo "🎯 Ready for autonomous Twitter domination!" 