#!/bin/bash

# 🚀 RENDER BUILD SCRIPT FOR AUTONOMOUS TWITTER BOT
# Ensures Playwright browsers install correctly with all system dependencies

set -e  # Exit on any error

echo "🚀 Starting Render build for Autonomous Twitter Bot..."

# Step 1: Install Node dependencies
echo "📦 Installing npm dependencies..."
npm ci

# Step 2: Install Playwright browsers with system dependencies
echo "🎭 Installing Playwright browsers with system dependencies..."
echo "📋 Current environment:"
echo "  - Node version: $(node --version)"
echo "  - NPM version: $(npm --version)" 
echo "  - Platform: $(uname -a)"

# Force install Playwright browsers (ensures fresh installation)
echo "🌐 Installing Chromium browser..."
npx playwright install chromium

# Additional: Install system dependencies if needed (Render handles most of this)
echo "🔧 Installing Playwright system dependencies..."
npx playwright install-deps chromium || echo "⚠️ System deps install failed (may not be needed on Render)"

# Step 3: Verify Playwright installation
echo "🔍 Verifying Playwright installation..."
npx playwright --version

# Step 4: Debug browser installation paths
echo "📋 Debugging browser installation..."
echo "Checking Playwright cache directory:"
if [ -d "/opt/render/.cache/ms-playwright" ]; then
    echo "✅ Found Playwright cache:"
    ls -la /opt/render/.cache/ms-playwright/
    
    echo "🔍 Searching for Chromium executables:"
    find /opt/render/.cache/ms-playwright -name "*chrom*" -type f 2>/dev/null | head -10
    
    echo "🔍 Searching for any browser executables:"
    find /opt/render/.cache/ms-playwright -type f -executable 2>/dev/null | head -10
else
    echo "⚠️ Playwright cache directory not found at /opt/render/.cache/ms-playwright"
fi

# Alternative: Check if browsers are in different location
echo "🔍 Checking alternative Playwright locations..."
if [ -d "$HOME/.cache/ms-playwright" ]; then
    echo "✅ Found alternative cache at $HOME/.cache/ms-playwright"
    ls -la "$HOME/.cache/ms-playwright/"
fi

# Step 5: Build TypeScript project
echo "🔨 Building TypeScript project..."
NODE_OPTIONS=--max_old_space_size=1024 npm run build

# Step 6: Verify postbuild steps ran
echo "📂 Verifying build artifacts..."
if [ -d "dist" ]; then
    echo "✅ TypeScript build successful - dist/ directory exists"
    
    if [ -d "dist/dashboard" ]; then
        echo "✅ Dashboard files copied successfully"
        ls -la dist/dashboard/
    else
        echo "⚠️ Dashboard files may not have been copied"
    fi
    
    if [ -d "dist/prompts" ]; then
        echo "✅ Prompts copied successfully"
        ls -la dist/prompts/
    else
        echo "⚠️ Prompts may not have been copied"
    fi
else
    echo "❌ Build failed - no dist/ directory found"
    exit 1
fi

echo "✅ Render build completed successfully!"
echo "🎯 Autonomous Twitter Bot ready for deployment!"
echo "🤖 Browser-based posting system initialized!"
echo "📊 Analytics dashboard ready!"
echo "🧠 Real-time learning engine prepared!" 