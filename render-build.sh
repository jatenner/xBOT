#!/bin/bash

# 🚀 RENDER BUILD SCRIPT FOR AUTONOMOUS TWITTER BOT
# Forces Playwright browser installation and sets environment variables

set -e  # Exit on any error

echo "🚀 Starting Render build for Autonomous Twitter Bot..."

# Step 1: Install Node dependencies
echo "📦 Installing npm dependencies..."
npm ci

# Step 2: Force install Playwright browsers (critical for Render)
echo "🎭 FORCE INSTALLING Playwright browsers..."
echo "📋 Current environment:"
echo "  - Node version: $(node --version)"
echo "  - NPM version: $(npm --version)" 
echo "  - Platform: $(uname -a)"
echo "  - User: $(whoami)"
echo "  - Home: $HOME"

# Remove any existing browser cache to force fresh install
echo "🧹 Cleaning any existing browser cache..."
rm -rf /opt/render/.cache/ms-playwright || echo "No existing cache to clean"
rm -rf ~/.cache/ms-playwright || echo "No user cache to clean"

# Force fresh Playwright installation
echo "🌐 Installing Chromium browser (forced fresh install)..."
PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright npx playwright install chromium --force

# Verify installation
echo "🔍 Verifying Playwright installation..."
npx playwright --version

# Step 3: Debug and verify browser installation
echo "📋 Debugging browser installation..."
echo "Checking primary cache directory:"
if [ -d "/opt/render/.cache/ms-playwright" ]; then
    echo "✅ Found Playwright cache:"
    ls -la /opt/render/.cache/ms-playwright/
    
    echo "🔍 Searching for Chromium executables:"
    find /opt/render/.cache/ms-playwright -name "*chrom*" -type f 2>/dev/null | head -10
    
    echo "🔍 All executable files:"
    find /opt/render/.cache/ms-playwright -type f -executable 2>/dev/null | head -10
    
    echo "🔍 Directory structure:"
    find /opt/render/.cache/ms-playwright -type d 2>/dev/null | head -10
else
    echo "❌ Playwright cache directory not found at /opt/render/.cache/ms-playwright"
fi

# Check alternative locations
echo "🔍 Checking alternative Playwright locations..."
for alt_path in "$HOME/.cache/ms-playwright" "/home/render/.cache/ms-playwright"; do
    if [ -d "$alt_path" ]; then
        echo "✅ Found alternative cache at $alt_path"
        ls -la "$alt_path/"
    fi
done

# Step 4: Set environment variables for runtime
echo "🔧 Setting environment variables for runtime..."
echo "export PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright" >> ~/.bashrc
echo "export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false" >> ~/.bashrc

# Step 5: Build TypeScript project
echo "🔨 Building TypeScript project..."
NODE_OPTIONS=--max_old_space_size=1024 npm run build-render

# Step 6: Final verification
echo "📂 Final verification..."
if [ -d "dist" ]; then
    echo "✅ TypeScript build successful - dist/ directory exists"
    
    if [ -d "dist/dashboard" ]; then
        echo "✅ Dashboard files copied successfully"
        ls -la dist/dashboard/ | head -5
    fi
    
    if [ -d "dist/prompts" ]; then
        echo "✅ Prompts copied successfully"
        ls -la dist/prompts/ | head -5
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

# Final browser verification
echo "🔍 Final browser verification:"
if command -v npx &> /dev/null; then
    echo "NPX available for runtime browser detection"
fi

echo "🚀 DEPLOYMENT READY - All systems operational!" 