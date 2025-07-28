#!/bin/bash

# 🚀 STARTUP SCRIPT FOR AUTONOMOUS TWITTER BOT
# Sets environment variables and starts the bot

echo "🚀 Starting Autonomous Twitter Bot..."

# Set Playwright environment variables
export PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false

echo "🔧 Environment variables set:"
echo "   PLAYWRIGHT_BROWSERS_PATH: $PLAYWRIGHT_BROWSERS_PATH"
echo "   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: $PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"
echo "   NODE_ENV: $NODE_ENV"

# Verify browser installation
echo "🔍 Verifying browser installation..."
if [ -d "/opt/render/.cache/ms-playwright" ]; then
    echo "✅ Playwright cache found:"
    ls -la /opt/render/.cache/ms-playwright/ | head -5
    
    # Find chromium executables
    CHROMIUM_EXEC=$(find /opt/render/.cache/ms-playwright -name "chrome" -type f -executable 2>/dev/null | head -1)
    if [ -n "$CHROMIUM_EXEC" ]; then
        echo "✅ Found Chromium executable: $CHROMIUM_EXEC"
    else
        echo "⚠️ No Chromium executable found, may need runtime install"
    fi
else
    echo "❌ No Playwright cache found - this may cause browser failures"
fi

# Start the bot
echo "🤖 Starting bot application..."
exec node dist/main.js 