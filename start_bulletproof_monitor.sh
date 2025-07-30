#!/bin/bash

# 🚀 BULLETPROOF RAILWAY MONITOR LAUNCHER
# =======================================
# Ensures the monitor always runs and never requires manual intervention

echo "🚀 Starting Bulletproof Railway Monitor..."
echo "📊 This monitor will:"
echo "   ✅ Auto-reconnect if disconnected"
echo "   ✅ Display real-time stats"
echo "   ✅ NEVER require manual 'Resume Log Stream' clicks"
echo "   ✅ Monitor bot health automatically"
echo ""

# Make sure Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Make the monitor executable
chmod +x bulletproof_railway_monitor.js

# Start the monitor
node bulletproof_railway_monitor.js