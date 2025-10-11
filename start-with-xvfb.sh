#!/bin/bash

# 🖥️ RAILWAY XVFB SETUP: Virtual display for "visible" browser mode
# This allows headless: false to work in Railway's Linux containers

echo "🖥️ XVFB_SETUP: Starting virtual display server..."

# Install xvfb if not present (Railway buildpack should handle this)
if ! command -v Xvfb &> /dev/null; then
    echo "⚠️ XVFB_SETUP: Xvfb not found, attempting to install..."
    apt-get update && apt-get install -y xvfb
fi

# Start virtual framebuffer display
echo "🚀 XVFB_SETUP: Starting Xvfb on display :99..."
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!

# Set display environment variable
export DISPLAY=:99

# Wait for Xvfb to start
sleep 2

echo "✅ XVFB_SETUP: Virtual display ready on DISPLAY=:99"
echo "🎯 XVFB_SETUP: Twitter will see a 'real' browser window (virtually)"

# Start the main application
echo "🚀 XVFB_SETUP: Starting main application..."
exec "$@"
