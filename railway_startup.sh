#!/bin/bash

# 🚄 RAILWAY 24/7 STARTUP SCRIPT
echo "🚄 === RAILWAY 24/7 STARTUP ==="
echo "📅 Starting: $(date)"
echo "🎯 Target: Bulletproof 24/7 operation"
echo ""

# Set Railway optimizations
export NODE_ENV=production
export RAILWAY_ENVIRONMENT=production
export NODE_OPTIONS="--max-old-space-size=1024 --expose-gc"

# Start the application with enhanced monitoring
echo "🚀 Starting enhanced Twitter bot..."
node dist/main.js

# If main process exits, restart (Railway will handle this)
echo "⚠️ Main process exited - Railway will restart"
exit 0