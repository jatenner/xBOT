#!/bin/bash

# 🚀 STARTUP SCRIPT FOR AUTONOMOUS TWITTER BOT
# Sets environment variables and starts the bot

echo "🚀 Starting Autonomous Twitter Bot..."

# Set Playwright environment variables for Railway/Alpine
export PLAYWRIGHT_BROWSERS_PATH=0
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false

echo "🔧 Environment variables set:"
echo "   PLAYWRIGHT_BROWSERS_PATH: $PLAYWRIGHT_BROWSERS_PATH"
echo "   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: $PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"
echo "   NODE_ENV: $NODE_ENV"

# Verify Alpine Chromium installation
echo "🔍 Verifying Alpine Chromium installation..."
if [ -f "/usr/bin/chromium-browser" ]; then
    echo "✅ Alpine Chromium found: /usr/bin/chromium-browser"
    /usr/bin/chromium-browser --version 2>/dev/null || echo "⚠️ Chromium version check failed"
else
    echo "❌ Alpine Chromium not found - checking for Playwright fallback"
    
    # Check for Playwright browsers as fallback
    if [ -d "/opt/render/.cache/ms-playwright" ]; then
        echo "✅ Playwright cache found as fallback"
        CHROMIUM_EXEC=$(find /opt/render/.cache/ms-playwright -name "chrome" -type f -executable 2>/dev/null | head -1)
        if [ -n "$CHROMIUM_EXEC" ]; then
            echo "✅ Found Playwright Chromium executable: $CHROMIUM_EXEC"
        fi
    fi
fi

# Start the bot
echo "🤖 Starting bot application..."
exec node dist/main.js 